/**
 * Vite 开发中间件：B 站代理
 * 模拟 EdgeOne Pages 的 /api/bili-proxy 接口，便于本地调试
 */
import {
    BILI_DOMAINS,
    PROXY_PATH,
    isBiliHost,
    generateBuvid,
    buildUpstreamHeaders,
    buildResponseHeaders,
    processHtml,
    detectContentType,
} from './functions/lib/biliProxyCore.js';

const COOKIE_NAME = 'bili_proxy_buvid';

// 开发环境用的管理员 cookie（从环境变量或默认空）
// 本地测试时可设置环境变量 BILI_COOKIE
const DEV_ADMIN_COOKIE = process.env.BILI_COOKIE || '';

function parseCookies(cookieHeader) {
    if (!cookieHeader) return {};
    const cookies = {};
    cookieHeader.split(';').forEach(s => {
        const [k, ...rest] = s.trim().split('=');
        if (k) cookies[k] = rest.join('=');
    });
    return cookies;
}

function parseBuvidCookie(cookieHeader) {
    const cookies = parseCookies(cookieHeader);
    const val = cookies[COOKIE_NAME];
    if (!val) return null;
    try {
        return JSON.parse(decodeURIComponent(val));
    } catch {
        return null;
    }
}

/**
 * 把 Node.js 的 IncomingMessage headers 转成 Headers 对象
 */
function nodeHeadersToFetchHeaders(nodeHeaders) {
    const h = new Headers();
    for (const [key, value] of Object.entries(nodeHeaders)) {
        if (Array.isArray(value)) {
            value.forEach(v => h.append(key, v));
        } else if (value !== undefined) {
            h.set(key, value);
        }
    }
    return h;
}

export function biliProxyMiddleware() {
    return {
        name: 'bili-proxy-dev',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                if (!req.url || !req.url.startsWith(PROXY_PATH)) {
                    return next();
                }

                try {
                    const url = new URL(req.url, `http://${req.headers.host}`);
                    const targetUrlStr = url.searchParams.get('url') || '';

                    if (!targetUrlStr) {
                        res.statusCode = 400;
                        res.setHeader('content-type', 'application/json');
                        res.end(JSON.stringify({ code: 400, message: '缺少 url 参数' }));
                        return;
                    }

                    let targetUrl;
                    try {
                        targetUrl = new URL(targetUrlStr);
                    } catch {
                        res.statusCode = 400;
                        res.setHeader('content-type', 'application/json');
                        res.end(JSON.stringify({ code: 400, message: 'url 参数不合法' }));
                        return;
                    }

                    if (!isBiliHost(targetUrl.hostname)) {
                        res.statusCode = 400;
                        res.setHeader('content-type', 'application/json');
                        res.end(JSON.stringify({ code: 400, message: '目标域名不在白名单' }));
                        return;
                    }

                    // OPTIONS 预检
                    if (req.method === 'OPTIONS') {
                        res.statusCode = 204;
                        res.setHeader('access-control-allow-origin', '*');
                        res.setHeader('access-control-allow-methods', 'GET, HEAD, POST, OPTIONS');
                        res.setHeader('access-control-allow-headers', '*');
                        res.end();
                        return;
                    }

                    // buvid
                    let buvid = parseBuvidCookie(req.headers.cookie || '');
                    let needSetCookie = false;
                    if (!buvid || !buvid.buvid3) {
                        buvid = await generateBuvid();
                        needSetCookie = true;
                    }

                    // 构造请求体
                    let body = undefined;
                    if (req.method !== 'GET' && req.method !== 'HEAD') {
                        // 读取请求体
                        const chunks = [];
                        for await (const chunk of req) {
                            chunks.push(chunk);
                        }
                        body = Buffer.concat(chunks);
                    }

                    // 构造上游请求头
                    const upHeaders = buildUpstreamHeaders(
                        nodeHeadersToFetchHeaders(req.headers),
                        buvid,
                        DEV_ADMIN_COOKIE,
                        targetUrl
                    );

                    console.log('[bili-proxy]', req.method, targetUrl.hostname + targetUrl.pathname);

                    // 转发
                    const fetchRes = await fetch(targetUrl.href, {
                        method: req.method,
                        headers: upHeaders,
                        body,
                        redirect: 'follow',
                    });

                    // 构造响应头
                    const newHeaders = buildResponseHeaders(fetchRes);

                    // 种 cookie
                    if (needSetCookie && buvid) {
                        const cookieVal = encodeURIComponent(JSON.stringify(buvid));
                        newHeaders.append('set-cookie',
                            `${COOKIE_NAME}=${cookieVal}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly`);
                    }

                    // 判断响应类型
                    const ct = detectContentType(fetchRes, targetUrl);

                    // 设置状态码
                    res.statusCode = fetchRes.status;
                    res.statusMessage = fetchRes.statusText;

                    // 写响应头
                    for (const [key, value] of newHeaders.entries()) {
                        res.setHeader(key, value);
                    }

                    // HTML: 注入脚本
                    if (ct.isHtml && req.method === 'GET') {
                        let html = await fetchRes.text();
                        html = processHtml(html);
                        res.setHeader('content-type', 'text/html; charset=utf-8');
                        res.setHeader('cache-control', 'no-cache, no-store, must-revalidate');
                        res.end(html);
                        return;
                    }

                    // 流式响应
                    if (fetchRes.body) {
                        // Node.js ReadableStream 转 Buffer
                        const reader = fetchRes.body.getReader();
                        async function pump() {
                            try {
                                const { done, value } = await reader.read();
                                if (done) {
                                    res.end();
                                    return;
                                }
                                res.write(Buffer.from(value));
                                return pump();
                            } catch (e) {
                                console.error('[bili-proxy] stream error:', e);
                                res.end();
                            }
                        }
                        pump();
                    } else {
                        res.end();
                    }
                } catch (e) {
                    console.error('[bili-proxy] error:', e);
                    if (!res.headersSent) {
                        res.statusCode = 500;
                        res.setHeader('content-type', 'application/json');
                    }
                    res.end(JSON.stringify({ code: 500, message: e.message }));
                }
            });
        },
    };
}
