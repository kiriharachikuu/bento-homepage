/**
 * GET /api/bili-proxy
 * B 站反向代理（用于 iframe 嵌入 newplayer 播放器，实现高清播放）
 *
 * 高清播放原理：
 *   1. 代理 newplayer.html，剥离 X-Frame-Options，允许第三方 iframe 嵌入
 *   2. 注入脚本伪造 PlayerUtil.isCertifiedReferrer / isOfficialReferrer，
 *      让播放器以为自己在 bilibili.com 域名下运行，走官方 Embedded 通道
 *   3. 劫持所有 B 站 API 请求到本站代理，服务端转发时带管理员配置的 SESSDATA，
 *      playurl 接口就能返回高画质流地址
 *   4. 视频流 CDN 也通过代理转发（带 referer），绕过防盗链
 *
 * Query:
 *   url - 目标 URL（必须是 B 站白名单域名）
 */
import { error, runHandler } from '../lib/response.js';
import { getSiteConfig } from '../lib/config.js';

/** B 站白名单根域名（支持子域名匹配） */
const BILI_DOMAINS = [
    'bilibili.com',
    'bilivideo.com',
    'hdslb.com',
    'biliapi.com',
    'bilibili.tv',
    'biliimg.com'
];

/** 允许的 HTTP 方法 */
const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'POST']);

/** 本站 cookie 名（存 buvid 信息） */
const COOKIE_NAME = 'bili_proxy_buvid';

/** 判断主机是否在 B 站白名单内 */
function isBiliHost(host) {
    if (!host) return false;
    host = host.toLowerCase();
    for (const d of BILI_DOMAINS) {
        if (host === d || host.endsWith('.' + d)) return true;
    }
    return false;
}

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

/** 动态生成 buvid3/buvid4（调用 B 站 spi 接口） */
async function generateBuvid() {
    try {
        const res = await fetch('https://api.bilibili.com/x/frontend/finger/spi', {
            headers: {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                'referer': 'https://www.bilibili.com/'
            }
        });
        const data = await res.json();
        if (data && data.data && data.data.b_3) {
            return {
                buvid3: data.data.b_3,
                buvid4: data.data.b_4 || '',
                _ts: Date.now()
            };
        }
    } catch (e) {
        console.error('generate buvid failed:', e.message);
    }
    return null;
}

/** 从 KV 读取管理员配置的 B 站 cookie（SESSDATA 等登录态） */
async function getAdminBiliCookie(env) {
    try {
        const siteConfig = await getSiteConfig(env);
        const cookie = siteConfig?.videoSync?.biliCookie;
        if (cookie && typeof cookie === 'string') {
            // 简单校验：包含 SESSDATA 才是有效登录态
            if (cookie.includes('SESSDATA')) {
                return cookie;
            }
        }
    } catch (e) {
        console.error('get admin bili cookie failed:', e.message);
    }
    return '';
}

/** 需要从响应中移除的头 */
const REMOVE_HEADERS = [
    'x-frame-options',
    'content-security-policy',
    'content-security-policy-report-only',
    'frame-options',
    'x-xss-protection',
    'strict-transport-security',
    'set-cookie',
    'access-control-allow-origin',
    'access-control-allow-credentials',
    'access-control-expose-headers'
];

/** 本站代理路径 */
const PROXY_PATH = '/api/bili-proxy';

/**
 * 构造注入脚本（在 </head> 前注入，在播放器核心脚本加载前执行）
 *
 * 作用：
 *   1. 伪造 PlayerUtil.isCertifiedReferrer / isOfficialReferrer 返回 true
 *      → 播放器走官方 Embedded 通道（高画质）
 *   2. 劫持 fetch / XHR / sendBeacon → 所有 B 站 API 请求走本站代理
 *   3. 劫持 Image.src / script.src → 静态资源也走代理（绕过 referer 校验 + CORS）
 *   4. 设置 document.domain 为 bilibili.com（某些内部逻辑会校验）
 */
function buildInjectScript() {
    const domains = JSON.stringify(BILI_DOMAINS);
    return `
<script data-bili-proxy-inject>
(function() {
    'use strict';
    var PROXY = '${PROXY_PATH}';
    var DOMAINS = ${domains};

    function isBili(host) {
        host = (host || '').toLowerCase();
        for (var i = 0; i < DOMAINS.length; i++) {
            var d = DOMAINS[i];
            if (host === d || host.slice(-d.length - 1) === '.' + d) return true;
        }
        return false;
    }
    function shouldProxy(url) {
        if (!url) return false;
        if (typeof url !== 'string') return false;
        if (url.charAt(0) === '/' && url.charAt(1) !== '/') return false;
        try {
            var u = new URL(url, location.href);
            return isBili(u.hostname);
        } catch(e) { return false; }
    }
    function toProxy(url) {
        try {
            var u = new URL(url, location.href);
            return PROXY + '?url=' + encodeURIComponent(u.href);
        } catch(e) { return url; }
    }

    // ===== 1. 伪造 Referrer 校验，让播放器以为自己是官方来源 =====
    // 用 Object.defineProperty 监听 PlayerUtil 对象，一旦出现就立刻替换方法
    var fakeUtilInstalled = false;
    function installFakePlayerUtil() {
        if (fakeUtilInstalled) return;
        var PU = window.PlayerUtil;
        if (!PU) return;
        fakeUtilInstalled = true;
        PU.isCertifiedReferrer = function() { return true; };
        PU.isOfficialReferrer = function() { return true; };
        PU.isIframe = function() { return true; };
        // 阻止原始白名单校验
        if (window.__CROSSDOMAIN_PLAYER_WHITELIST__) {
            window.__CROSSDOMAIN_PLAYER_WHITELIST__ = null;
        }
    }

    // 轮询等待 PlayerUtil 加载
    var pollCount = 0;
    var pollTimer = setInterval(function() {
        pollCount++;
        if (window.PlayerUtil) {
            clearInterval(pollTimer);
            installFakePlayerUtil();
        }
        if (pollCount > 200) clearInterval(pollTimer); // 最多等 10 秒
    }, 50);

    // 同时用 defineProperty 提前拦截
    try {
        var _playerUtil = null;
        Object.defineProperty(window, 'PlayerUtil', {
            configurable: true,
            get: function() { return _playerUtil; },
            set: function(v) {
                _playerUtil = v;
                installFakePlayerUtil();
            }
        });
    } catch(e) {}

    // ===== 2. 劫持 fetch =====
    var _fetch = window.fetch;
    window.fetch = function(input, init) {
        var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
        if (shouldProxy(url)) {
            var nu = toProxy(url);
            if (typeof input === 'string') {
                input = nu;
            } else if (input instanceof Request) {
                input = new Request(nu, input);
            }
        }
        return _fetch.call(this, input, init);
    };

    // ===== 3. 劫持 XMLHttpRequest =====
    var _open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        if (shouldProxy(url)) url = toProxy(url);
        var args = [method, url];
        for (var i = 2; i < arguments.length; i++) args.push(arguments[i]);
        return _open.apply(this, args);
    };

    // ===== 4. 劫持 sendBeacon =====
    if (navigator.sendBeacon) {
        var _sb = navigator.sendBeacon.bind(navigator);
        navigator.sendBeacon = function(url, data) {
            if (shouldProxy(url)) url = toProxy(url);
            return _sb(url, data);
        };
    }

    // ===== 5. 劫持动态 script.src（JSONP 等） =====
    var _createEl = document.createElement.bind(document);
    document.createElement = function(tag) {
        var el = _createEl(tag);
        if (tag && tag.toLowerCase() === 'script') {
            (function(scriptEl) {
                var src = '';
                Object.defineProperty(scriptEl, 'src', {
                    configurable: true,
                    get: function() { return src; },
                    set: function(v) {
                        src = shouldProxy(v) ? toProxy(v) : v;
                        scriptEl.setAttribute('src', src);
                    }
                });
            })(el);
        }
        return el;
    };

    // ===== 6. 劫持 Image.src（封面图、视频画面等） =====
    try {
        var _imgProto = HTMLImageElement.prototype;
        var _origSrc = Object.getOwnPropertyDescriptor(_imgProto, 'src');
        if (_origSrc && _origSrc.set) {
            Object.defineProperty(_imgProto, 'src', {
                configurable: true,
                get: function() {
                    return this.getAttribute('src') || '';
                },
                set: function(v) {
                    if (shouldProxy(v)) {
                        this.setAttribute('src', toProxy(v));
                    } else {
                        this.setAttribute('src', v);
                    }
                }
            });
        }
    } catch(e) {}

    // ===== 7. 劫持 CSS @import / background-image 里的 URL（可选）=====
    // 暂不实现，影响性能且必要性不高

})();
</script>`;
}

export function onRequest(context) {
    return runHandler(async () => {
        const { request, env } = context;

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
        // 仅对 API 请求带，静态资源不带（减少开销）
        const isApiRequest = targetUrl.hostname.includes('api.bilibili') ||
                             targetUrl.hostname.includes('interface.');
        let adminCookie = '';
        if (isApiRequest) {
            adminCookie = await getAdminBiliCookie(env);
        }

        // 构造上游请求头
        const upHeaders = new Headers(request.headers);

        // 基础浏览器头
        upHeaders.set('user-agent',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36');
        upHeaders.set('referer', 'https://www.bilibili.com/');
        upHeaders.set('origin', 'https://www.bilibili.com');
        upHeaders.set('accept-language', 'zh-CN,zh;q=0.9,en;q=0.8');

        // 组装 B 站 cookie：buvid 指纹 + 管理员登录态（如果有）
        const biliCookieParts = [];
        if (buvid && buvid.buvid3) {
            biliCookieParts.push(`buvid3=${buvid.buvid3}`);
            if (buvid.buvid4) biliCookieParts.push(`buvid4=${buvid.buvid4}`);
        }
        biliCookieParts.push('buvid_fp_plain=undefined');
        biliCookieParts.push('CURRENT_FNVAL=4048');
        biliCookieParts.push('CURRENT_QUALITY=116'); // 1080P60
        biliCookieParts.push('bp_t_offset=0');
        biliCookieParts.push('_uuid=0');

        if (adminCookie) {
            biliCookieParts.push(adminCookie);
        }

        upHeaders.set('cookie', biliCookieParts.join('; '));

        // 清除不应该转发给 B 站的 header
        upHeaders.delete('host');
        upHeaders.delete('x-csrf-token');
        upHeaders.delete('x-forwarded-for');
        upHeaders.delete('x-forwarded-proto');
        upHeaders.delete('cf-ray');
        upHeaders.delete('cf-connecting-ip');

        // 转发请求（流式，视频文件不会全部加载到内存）
        const res = await fetch(targetUrl.href, {
            method: request.method,
            headers: upHeaders,
            body: (request.method !== 'GET' && request.method !== 'HEAD') ? request.body : undefined,
            redirect: 'follow'
        });

        // 构造响应头
        const newHeaders = new Headers(res.headers);
        for (const h of REMOVE_HEADERS) {
            newHeaders.delete(h);
        }
        newHeaders.set('access-control-allow-origin', '*');
        newHeaders.set('access-control-allow-methods', 'GET, HEAD, POST, OPTIONS');
        newHeaders.set('access-control-allow-headers', '*');
        newHeaders.delete('content-length'); // 让浏览器自动处理分块传输

        // 种 buvid cookie 到本站域名（有效期 1 年）
        if (needSetCookie && buvid) {
            const cookieVal = encodeURIComponent(JSON.stringify(buvid));
            newHeaders.append('set-cookie',
                `${COOKIE_NAME}=${cookieVal}; Path=/; Max-Age=31536000; SameSite=None; Secure; HttpOnly`);
        }

        // 判断响应类型
        const contentType = newHeaders.get('content-type') || '';
        const isHtml = contentType.includes('text/html') && request.method === 'GET';
        const isJson = contentType.includes('application/json');
        const isVideo = contentType.includes('video/') ||
                        contentType.includes('application/octet-stream') ||
                        targetUrl.pathname.match(/\.(mp4|flv|m4s|m3u8|ts|webm)$/i);
        const isImage = contentType.includes('image/');
        const isJs = contentType.includes('javascript') || targetUrl.pathname.endsWith('.js');

        // HTML 页面：注入劫持脚本
        if (isHtml) {
            let html = await res.text();
            const inject = buildInjectScript();
            // 注入到 </head> 前，在播放器脚本加载前执行
            const idx = html.indexOf('</head>');
            if (idx !== -1) {
                html = html.slice(0, idx) + inject + '\n' + html.slice(idx);
            } else {
                html = inject + '\n' + html;
            }

            // 把页面里所有的 //xxx.hdslb.com 之类的协议相对路径转成代理地址
            // （script / link / img 标签的 src/href 中的相对路径）
            // 这个比较复杂，我们依赖劫持脚本运行时处理，这里只替换明显的静态资源引用
            // 实际上劫持 Image.src / script.src createElement 已经处理了大部分情况

            newHeaders.set('content-type', 'text/html; charset=utf-8');
            newHeaders.set('cache-control', 'no-cache, no-store, must-revalidate');
            return new Response(html, {
                status: res.status,
                statusText: res.statusText,
                headers: newHeaders
            });
        }

        // JSON 响应（API 返回）：允许跨域
        if (isJson) {
            newHeaders.set('cache-control', 'no-cache');
            newHeaders.set('content-type', 'application/json; charset=utf-8');
            return new Response(res.body, {
                status: res.status,
                statusText: res.statusText,
                headers: newHeaders
            });
        }

        // 视频流：流式转发，长缓存
        if (isVideo) {
            newHeaders.set('cache-control', 'public, max-age=31536000, immutable');
            // 保留 content-range 等视频相关头
            return new Response(res.body, {
                status: res.status,
                statusText: res.statusText,
                headers: newHeaders
            });
        }

        // 图片：缓存 7 天
        if (isImage) {
            newHeaders.set('cache-control', 'public, max-age=604800, immutable');
            return new Response(res.body, {
                status: res.status,
                statusText: res.statusText,
                headers: newHeaders
            });
        }

        // JS/CSS 等静态资源：缓存 7 天
        if (isJs || contentType.includes('css')) {
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
