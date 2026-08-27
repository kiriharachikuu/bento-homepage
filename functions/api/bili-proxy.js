/**
 * GET /api/bili-proxy
 * B 站反向代理（用于 iframe 嵌入 newplayer 播放器）
 *
 * 解决的问题：
 *   1. B 站 newplayer.html 设置了 X-Frame-Options，不能直接第三方 iframe 嵌入
 *   2. 代理后 iframe origin 变成本站，播放器内部请求 api.bilibili.com 会跨域
 *   3. newplayer 作为站内播放器需要 buvid3 等设备指纹 cookie，否则报 3107 错误
 *
 * 方案：
 *   1. 服务端抓取 newplayer.html，移除 X-Frame-Options/CSP
 *   2. 在页面注入劫持脚本，把所有 B 站域名的 fetch/XHR/sendBeacon 请求重写到本站代理
 *   3. 第一次请求时从 B 站 spi 接口动态生成 buvid3/buvid4，种到本站 cookie
 *      （播放器请求时由本站边缘函数转发，同时带上 buvid3 cookie，模拟真实浏览器）
 *   4. 所有代理请求带上正确的 referer / UA / cookie，绕过 B 站风控
 *
 * Query:
 *   url - 目标 URL（必须是 B 站白名单域名）
 */
import { error, runHandler } from '../lib/response.js';

/** B 站白名单根域名（支持子域名匹配） */
const BILI_DOMAINS = [
    'bilibili.com',
    'bilivideo.com',
    'hdslb.com',
    'biliapi.com',
    'bilibili.tv'
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

/** 需要移除的响应头 */
const REMOVE_HEADERS = [
    'x-frame-options',
    'content-security-policy',
    'content-security-policy-report-only',
    'frame-options',
    'x-xss-protection',
    'x-content-type-options',
    'strict-transport-security',
    'set-cookie',
    'access-control-allow-origin',
    'access-control-allow-credentials'
];

/** 本站代理路径 */
const PROXY_PATH = '/api/bili-proxy';

/** 注入到 HTML 页面的劫持脚本（fetch / XHR / sendBeacon / img.src / dynamic script） */
function buildInjectScript() {
    const domains = JSON.stringify(BILI_DOMAINS);
    return `
<script data-bili-proxy-inject>
(function() {
    var PROXY = '${PROXY_PATH}';
    var DOMAINS = ${domains};

    function isBili(host) {
        host = host.toLowerCase();
        for (var i = 0; i < DOMAINS.length; i++) {
            var d = DOMAINS[i];
            if (host === d || host.slice(-d.length - 1) === '.' + d) return true;
        }
        return false;
    }
    function shouldProxy(url) {
        if (!url) return false;
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

    // 1. 劫持 fetch
    var _fetch = window.fetch;
    window.fetch = function(input, init) {
        var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
        if (shouldProxy(url)) {
            var nu = toProxy(url);
            if (typeof input === 'string') input = nu;
            else if (input instanceof Request) input = new Request(nu, input);
        }
        return _fetch.call(this, input, init);
    };

    // 2. 劫持 XMLHttpRequest
    var _open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(m, url) {
        if (shouldProxy(url)) url = toProxy(url);
        var a = [m, url];
        for (var i = 2; i < arguments.length; i++) a.push(arguments[i]);
        return _open.apply(this, a);
    };

    // 3. 劫持 sendBeacon
    if (navigator.sendBeacon) {
        var _sb = navigator.sendBeacon.bind(navigator);
        navigator.sendBeacon = function(url, data) {
            if (shouldProxy(url)) url = toProxy(url);
            return _sb(url, data);
        };
    }

    // 4. 劫持动态创建的 script.src（B 站播放器可能用 JSONP）
    var _create = document.createElement.bind(document);
    document.createElement = function(tag) {
        var el = _create(tag);
        if (tag && tag.toLowerCase() === 'script') {
            Object.defineProperty(el, 'src', {
                get: function() { return this.getAttribute('src') || ''; },
                set: function(v) {
                    if (shouldProxy(v)) this.setAttribute('src', toProxy(v));
                    else this.setAttribute('src', v);
                },
                configurable: true
            });
        }
        return el;
    };

    // 5. 劫持 Image 的 src
    var _imgDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (_imgDesc && _imgDesc.set) {
        Object.defineProperty(HTMLImageElement.prototype, 'src', {
            get: function() { return this.getAttribute('src') || ''; },
            set: function(v) {
                if (shouldProxy(v)) this.setAttribute('src', toProxy(v));
                else this.setAttribute('src', v);
            },
            configurable: true
        });
    }
})();
</script>`;
}

export function onRequest(context) {
    return runHandler(async () => {
        const { request } = context;

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

        // 构造上游请求头
        const upHeaders = new Headers(request.headers);

        // 基础浏览器头
        upHeaders.set('user-agent',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36');
        upHeaders.set('referer', 'https://www.bilibili.com/');
        upHeaders.set('origin', 'https://www.bilibili.com');
        upHeaders.set('accept-language', 'zh-CN,zh;q=0.9');

        // 把本站 cookie 里的 buvid 转成 B 站 cookie 格式带上
        if (buvid && buvid.buvid3) {
            const biliCookies = [];
            biliCookies.push(`buvid3=${buvid.buvid3}`);
            if (buvid.buvid4) biliCookies.push(`buvid4=${buvid.buvid4}`);
            biliCookies.push('buvid_fp_plain=undefined');
            biliCookies.push('CURRENT_FNVAL=4048');
            biliCookies.push('CURRENT_QUALITY=116'); // 1080P60 画质标识

            const existingBiliCookies = upHeaders.get('cookie') || '';
            if (existingBiliCookies) {
                upHeaders.set('cookie', existingBiliCookies + '; ' + biliCookies.join('; '));
            } else {
                upHeaders.set('cookie', biliCookies.join('; '));
            }
        }

        // 清除本站相关 header
        upHeaders.delete('host');
        upHeaders.delete('x-csrf-token');
        upHeaders.delete('x-forwarded-for');

        // 转发请求
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

        // 种 buvid cookie 到本站域名
        if (needSetCookie && buvid) {
            const cookieVal = encodeURIComponent(JSON.stringify(buvid));
            newHeaders.append('set-cookie',
                `${COOKIE_NAME}=${cookieVal}; Path=/; Max-Age=31536000; SameSite=None; Secure`);
        }

        // 处理响应体：HTML 注入劫持脚本
        const contentType = newHeaders.get('content-type') || '';
        let body = res.body;

        if (contentType.includes('text/html') && request.method === 'GET') {
            let html = await res.text();
            const inject = buildInjectScript();
            // 注入到 </head> 前，越早执行越好（在播放器脚本加载前就劫持好）
            const idx = html.indexOf('</head>');
            if (idx !== -1) {
                html = html.slice(0, idx) + inject + '\n' + html.slice(idx);
            } else {
                // 没有 </head> 就加在最前面
                html = inject + '\n' + html;
            }
            body = html;
            newHeaders.set('content-length', new TextEncoder().encode(html).length.toString());
        }

        // 缓存：HTML 不缓存，其他资源缓存 7 天
        if (contentType.includes('text/html')) {
            newHeaders.set('cache-control', 'no-cache');
        } else {
            newHeaders.set('cache-control', 'public, max-age=604800, immutable');
        }

        return new Response(body, {
            status: res.status,
            statusText: res.statusText,
            headers: newHeaders
        });
    });
}
