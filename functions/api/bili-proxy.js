/**
 * GET /api/bili-proxy
 * B 站反向代理（单入口版本，通过 query 参数指定目标 URL）
 *
 * 用途：
 *   让本站 iframe 可以嵌入 B 站 newplayer 播放器（绕过 X-Frame-Options + 内部 API 跨域）。
 *
 * Query:
 *   url - 目标 URL（必须是 B 站白名单域名
 *
 * 工作流程：
 *   1. 本站 iframe 请求 /api/bili-proxy?url=https://www.bilibili.com/blackboard/newplayer.html?...
 *   2. 服务端抓取页面，注入 fetch/XHR 劫持脚本，把页面中所有 B 站 API 请求重写为本站代理地址
 *   3. 播放器内部 API 通过代理转发到 B 站，带上正确的 referer/UA，剥掉 X-Frame-Options/CSP
 *
 * 安全限制：
 *   - 仅允许 B 站白名单域名
 *   - 仅允许 GET/HEAD（播放器只读）
 *   - 不转发本站 cookie
 */
import { error, runHandler } from '../lib/response.js';

/** 允许代理的 B 站域名白名单（支持子域名匹配） */
const ALLOWED_DOMAINS = [
    'bilibili.com',
    'bilivideo.com',
    'hdslb.com',
    'biliapi.com',
    'bilibili.tv',
    'bilibili.co'
];

/** 允许的 HTTP 方法（播放器只用 GET/HEAD） */
const ALLOWED_METHODS = new Set(['GET', 'HEAD']);

/** 判断主机是否在白名单内（支持子域名） */
function isAllowedHost(host) {
    if (!host) return false;
    host = host.toLowerCase();
    for (const domain of ALLOWED_DOMAINS) {
        if (host === domain || host.endsWith('.' + domain)) return true;
    }
    return false;
}

/** 需要移除的响应头（禁止嵌入 / CSP 等限制） */
const HEADERS_TO_REMOVE = [
    'x-frame-options',
    'content-security-policy',
    'content-security-policy-report-only',
    'frame-options',
    'x-xss-protection',
    'x-content-type-options',
    'strict-transport-security',
    'access-control-allow-origin',
    'access-control-allow-credentials'
];

/** 本站代理的基础路径（注入脚本中使用） */
const PROXY_PATH = '/api/bili-proxy';

/**
 * 注入到 HTML 页面底部的劫持脚本
 * 重写 window.fetch 和 XMLHttpRequest.prototype.open
 * 把所有 B 站域名请求转到本站代理
 */
function buildInjectScript() {
    // 把白名单域名（注入到页面脚本中
    const domainsJson = JSON.stringify(ALLOWED_DOMAINS);
    return `
<script data-bili-proxy-inject>
(function(){
    var PROXY = '${PROXY_PATH}';
    var DOMAINS = ${domainsJson};

    function isBili(host) {
        host = host.toLowerCase();
        for (var i = 0; i < DOMAINS.length; i++) {
            var d = DOMAINS[i];
            if (host === d || host.indexOf('.' + d) !== -1 && host.slice(-d.length - 1) === '.' + d) return true;
        }
        return false;
    }

    function shouldProxy(url) {
        if (!url) return false;
        if (url.indexOf('/') === 0) return false;
        try {
            var u = new URL(url, location.href);
            return isBili(u.hostname);
        } catch(e) { return false; }
    }

    function toProxyUrl(url) {
        try {
            var u = new URL(url, location.href);
            return PROXY + '?url=' + encodeURIComponent(u.href);
        } catch(e) { return url; }
    }

    // 劫持 fetch
    var origFetch = window.fetch;
    window.fetch = function(input, init) {
        var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
        if (shouldProxy(url)) {
            var newUrl = toProxyUrl(url);
            if (typeof input === 'string') {
                input = newUrl;
            } else if (input instanceof Request) {
                input = new Request(newUrl, input);
            }
        }
        return origFetch.call(this, input, init);
    };

    // 劫持 XMLHttpRequest
    var origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        if (shouldProxy(url)) {
            url = toProxyUrl(url);
        }
        var args = [method, url];
        for (var i = 2; i < arguments.length; i++) args.push(arguments[i]);
        return origOpen.apply(this, args);
    };

    // 劫持 img src（图片资源也走代理，防止 referer 校验
    // （视频地址在播放器内部加载时跨域）
    var origImgDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (origImgDescriptor && origImgDescriptor.set) {
        Object.defineProperty(HTMLImageElement.prototype, 'src', {
            get: function() { return this.getAttribute('src') || ''; },
            set: function(v) {
                if (shouldProxy(v)) {
                    this.setAttribute('src', toProxyUrl(v));
                } else {
                    this.setAttribute('src', v);
                }
            }
        });
    }
})();
</script>`;
}

export function onRequest(context) {
    return runHandler(async () => {
        const { request } = context;

        if (!ALLOWED_METHODS.has(request.method)) {
            return error(405, 'METHOD_NOT_ALLOWED', '仅支持 GET / HEAD 请求');
        }

        const url = new URL(request.url);
        const targetUrl = url.searchParams.get('url') || '';

        if (!targetUrl) {
            return error(400, 'BAD_REQUEST', '缺少 url 参数');
        }

        let target;
        try {
            target = new URL(targetUrl);
        } catch {
            return error(400, 'BAD_REQUEST', 'url 参数不合法');
        }

        if (target.protocol !== 'https:' && target.protocol !== 'http:') {
            return error(400, 'BAD_REQUEST', '仅支持 http/https 协议');
        }

        if (!isAllowedHost(target.hostname)) {
            return error(400, 'BAD_REQUEST', '目标域名不在白名单内');
        }

        // 构造上游请求头：模拟从 bilibili.com 发起
        const upstreamHeaders = new Headers(request.headers);
        upstreamHeaders.set('user-agent',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36');
        upstreamHeaders.set('referer', 'https://www.bilibili.com/');
        upstreamHeaders.set('origin', 'https://www.bilibili.com');
        upstreamHeaders.set('accept-language', 'zh-CN,zh;q=0.9');
        // 不转发本站 cookie / CSRF 头
        upstreamHeaders.delete('cookie');
        upstreamHeaders.delete('host');
        upstreamHeaders.delete('x-csrf-token');
        upstreamHeaders.delete('x-requested-with');

        const res = await fetch(target.href, {
            method: request.method,
            headers: upstreamHeaders,
            redirect: 'follow'
        });

        // 构造新响应头
        const newHeaders = new Headers(res.headers);
        for (const h of HEADERS_TO_REMOVE) {
            newHeaders.delete(h);
        }
        newHeaders.set('access-control-allow-origin', '*');
        newHeaders.set('access-control-allow-methods', 'GET, HEAD, OPTIONS');

        // 如果是 HTML 页面（newplayer 主页面等），注入劫持脚本
        const contentType = newHeaders.get('content-type') || '';
        let body = res.body;
        if (contentType.includes('text/html') && request.method === 'GET') {
            let html = await res.text();
            const inject = buildInjectScript();
            // 脚本注入到 </body> 前
            const injected = html.replace('</body>', inject + '\n</body>');
            //如果没有 </body> 就加到 </head> 后
            if (injected === html) {
                html = html.replace('</head>', '</head>\n' + inject);
            } else {
                html = injected;
            }
            body = html;
            newHeaders.set('content-length', new TextEncoder().encode(html).length.toString());
        }

        // 缓存策略：HTML 不缓存，静态资源缓存 7 天
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
