/**
 * GET /api/bili-proxy
 * B 站反向代理（用于 iframe 嵌入 newplayer 播放器，实现高清播放）
 *
 * Query:
 *   url - 目标 URL（必须是 B 站白名单域名）
 */
import { error, runHandler } from '../lib/response.js';
import { getSiteConfig } from '../lib/videos.js';
import { assertKV } from '../lib/kv.js';
import {
    BILI_DOMAINS,
    PROXY_PATH,
    isBiliHost,
    generateBuvid,
    buildUpstreamHeaders,
    buildResponseHeaders,
    processHtml,
    detectContentType,
} from '../lib/biliProxyCore.js';

/** 允许的 HTTP 方法 */
const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'POST', 'OPTIONS']);

/** 本站 cookie 名（存 buvid 信息） */
const COOKIE_NAME = 'bili_proxy_buvid';

/** 从 cookie 中解析 buvid3/buvid4 */
function parseBuvidCookie(cookieHeader) {
    if (!cookieHeader) return null;
    const match = cookieHeader.split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE_NAME + '='));
    if (!match) return null;
    const value = decodeURIComponent(match.substring(COOKIE_NAME.length + 1));
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

/** 从 KV 读取管理员配置的 B 站 cookie（SESSDATA 等登录态） */
async function getAdminBiliCookie(kv) {
    try {
        const siteConfig = await getSiteConfig(kv);
        const cookie = siteConfig?.videoSync?.biliCookie;
        if (cookie && typeof cookie === 'string' && cookie.includes('SESSDATA')) {
            return cookie;
        }
    } catch (e) {
        console.error('get admin bili cookie failed:', e.message);
    }
    return '';
}

export function onRequest(context) {
    return runHandler(async () => {
        const { request } = context;
        const kv = assertKV(context);

        // 预检请求
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'access-control-allow-origin': '*',
                    'access-control-allow-methods': 'GET, HEAD, POST, OPTIONS',
                    'access-control-allow-headers': '*',
                    'access-control-max-age': '86400',
                }
            });
        }

        if (!ALLOWED_METHODS.has(request.method)) {
            return error(405, 'METHOD_NOT_ALLOWED', '仅支持 GET / HEAD / POST');
        }

        const reqUrl = new URL(request.url);
        const targetUrlStr = reqUrl.searchParams.get('url') || '';

        if (!targetUrlStr) {
            return error(400, 'BAD_REQUEST', '缺少 url 参数');
        }

        let targetUrl;
        try {
            targetUrl = new URL(targetUrlStr);
        } catch {
            return error(400, 'BAD_REQUEST', 'url 参数不合法');
        }

        if (targetUrl.protocol !== 'https:' && targetUrl.protocol !== 'http:') {
            return error(400, 'BAD_REQUEST', '仅支持 http/https');
        }
        if (!isBiliHost(targetUrl.hostname)) {
            return error(400, 'BAD_REQUEST', '目标域名不在白名单');
        }

        // 获取或生成 buvid
        const cookieHeader = request.headers.get('cookie') || '';
        let buvid = parseBuvidCookie(cookieHeader);
        let needSetCookie = false;
        if (!buvid || !buvid.buvid3) {
            buvid = await generateBuvid();
            needSetCookie = true;
        }

        // 获取管理员配置的 B 站登录态 cookie（用于高画质 playurl）
        const adminCookie = await getAdminBiliCookie(kv);

        // 构造上游请求头
        const upHeaders = buildUpstreamHeaders(request.headers, buvid, adminCookie, targetUrl);

        // 转发请求（流式）
        const res = await fetch(targetUrl.href, {
            method: request.method,
            headers: upHeaders,
            body: (request.method !== 'GET' && request.method !== 'HEAD') ? request.body : undefined,
            redirect: 'follow'
        });

        // 构造响应头
        const newHeaders = buildResponseHeaders(res);

        // 种 buvid cookie 到本站域名（有效期 1 年）
        if (needSetCookie && buvid) {
            const cookieVal = encodeURIComponent(JSON.stringify(buvid));
            newHeaders.append('set-cookie',
                `${COOKIE_NAME}=${cookieVal}; Path=/; Max-Age=31536000; SameSite=None; Secure; HttpOnly`);
        }

        // 判断响应类型
        const ct = detectContentType(res, targetUrl);

        // HTML 页面：注入劫持脚本
        if (ct.isHtml && request.method === 'GET') {
            let html = await res.text();
            html = processHtml(html);
            newHeaders.set('content-type', 'text/html; charset=utf-8');
            newHeaders.set('cache-control', 'no-cache, no-store, must-revalidate');
            return new Response(html, {
                status: res.status,
                statusText: res.statusText,
                headers: newHeaders
            });
        }

        // JSON 响应（API 返回）
        if (ct.isJson) {
            newHeaders.set('cache-control', 'no-cache');
            newHeaders.set('content-type', 'application/json; charset=utf-8');
            return new Response(res.body, {
                status: res.status,
                statusText: res.statusText,
                headers: newHeaders
            });
        }

        // 视频流：流式转发，支持 Range
        if (ct.isVideo) {
            newHeaders.set('cache-control', 'public, max-age=31536000, immutable');
            // 保留 content-range, accept-ranges
            if (res.headers.get('content-range')) {
                newHeaders.set('content-range', res.headers.get('content-range'));
            }
            if (res.headers.get('accept-ranges')) {
                newHeaders.set('accept-ranges', res.headers.get('accept-ranges'));
            }
            return new Response(res.body, {
                status: res.status,
                statusText: res.statusText,
                headers: newHeaders
            });
        }

        // 图片：缓存 7 天
        if (ct.isImage) {
            newHeaders.set('cache-control', 'public, max-age=604800, immutable');
            return new Response(res.body, {
                status: res.status,
                statusText: res.statusText,
                headers: newHeaders
            });
        }

        // JS/CSS 等静态资源：缓存 7 天
        if (ct.isJs || ct.isCss) {
            newHeaders.set('cache-control', 'public, max-age=604800, immutable');
            return new Response(res.body, {
                status: res.status,
                statusText: res.statusText,
                headers: newHeaders
            });
        }

        // 其他：默认透传
        return new Response(res.body, {
            status: res.status,
            statusText: res.statusText,
            headers: newHeaders
        });
    });
}
