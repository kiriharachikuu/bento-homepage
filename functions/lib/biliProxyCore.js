/**
 * B 站代理核心逻辑（与运行环境无关，Node/Vite/EdgeOne 均可复用）
 *
 * 高清播放原理：
 *   1. 代理 newplayer.html，剥离 X-Frame-Options，允许第三方 iframe 嵌入
 *   2. 注入脚本伪造 PlayerUtil.isCertifiedReferrer / isOfficialReferrer，
 *      让播放器以为自己在 bilibili.com 域名下运行
 *   3. 劫持所有 B 站 API 请求到本站代理，服务端转发时带管理员配置的 SESSDATA，
 *      playurl 接口就能返回高画质流地址
 *   4. 视频流 CDN 也通过代理转发（带 referer），绕过防盗链
 */

/** B 站白名单根域名（支持子域名匹配） */
export const BILI_DOMAINS = [
    'bilibili.com',
    'bilivideo.com',
    'hdslb.com',
    'biliapi.com',
    'bilibili.tv',
    'biliimg.com',
    'bilibili.co',
];

/** 本站代理路径 */
export const PROXY_PATH = '/api/bili-proxy';

/** 判断主机是否在 B 站白名单内 */
export function isBiliHost(host) {
    if (!host) return false;
    host = host.toLowerCase();
    for (const d of BILI_DOMAINS) {
        if (host === d || host.endsWith('.' + d)) return true;
    }
    return false;
}

/** 动态生成 buvid3/buvid4（调用 B 站 spi 接口） */
export async function generateBuvid() {
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

/** 需要从响应中移除的头 */
export const REMOVE_HEADERS = [
    'x-frame-options',
    'content-security-policy',
    'content-security-policy-report-only',
    'frame-options',
    'x-xss-protection',
    'strict-transport-security',
    'set-cookie',
    'access-control-allow-origin',
    'access-control-allow-credentials',
    'access-control-expose-headers',
    'timing-allow-origin',
];

/**
 * 构造注入脚本（在第一个 <script> 之前注入，在播放器核心脚本加载前执行）
 */
export function buildInjectScript() {
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
            var u = new URL(url, REAL_HREF);
            return isBili(u.hostname);
        } catch(e) { return false; }
    }
    function rewriteWbiUrl(url) {
        // wbi 签名接口必须带 w_rid/wts，而签名在代理转发后会失效（-400/3107）。
        // 统一改写为对应的非 wbi 路径并删除签名参数：非 wbi 接口不校验签名。
        try {
            var u = new URL(url, REAL_HREF);
            var p = u.pathname;
            var isPlayurl = /\\/player\\/wbi\\/playurl/.test(p);
            var isWbiData = /\\/wbi\\//.test(p);
            if (!isPlayurl && !isWbiData) return url;
            // /wbi/ 段去掉 -> 非 wbi 路径（如 /x/web-interface/wbi/view/detail -> /x/web-interface/view/detail）
            u.pathname = p.replace('/wbi/', '/');
            // 移除 wbi 签名参数
            u.searchParams.delete('w_rid');
            u.searchParams.delete('wts');
            if (isPlayurl) {
                // 确保请求 dash + hevc + dolby 高画质
                if (!u.searchParams.get('fnval')) u.searchParams.set('fnval', '4048');
                if (!u.searchParams.get('fourk')) u.searchParams.set('fourk', '1');
                if (!u.searchParams.get('qn')) u.searchParams.set('qn', '120');
            }
            return u.href;
        } catch(e) { return url; }
    }
    // ===== 0a. 还原真实播放器地址 =====
    // iframe 实际地址是 /api/bili-proxy?url=<编码后的 newplayer URL>，
    // 播放器靠 location.search 读取 bvid/cid 等参数，直接读会拿到 ?url=... 而拿不到 bvid，
    // 导致 view/detail 不带 bvid 返回 -400（错误码 3107）。
    var REAL_HREF = location.href;
    var REAL_SEARCH = location.search;
    try {
        var _proxyUrl = new URL(location.href).searchParams.get('url');
        if (_proxyUrl) {
            var _real = new URL(_proxyUrl);
            REAL_HREF = _real.href;
            REAL_SEARCH = _real.search;
        }
    } catch(e) {}

    function toProxy(url) {
        try {
            var u = new URL(url, REAL_HREF);
            // B 站 API/CDN 统一走 https：http 请求会被 B 站拒绝（-400）或重定向
            if (u.protocol === 'http:') u.protocol = 'https:';
            var rewritten = rewriteWbiUrl(u.href);
            return PROXY + '?url=' + encodeURIComponent(rewritten);
        } catch(e) { return url; }
    }

    // ===== 0b. 伪造环境 =====
    try { Object.defineProperty(document, 'referrer', { configurable: true, get: function() { return 'https://www.bilibili.com/'; } }); } catch(e) {}
    // 伪造 location.search / href，让播放器能读到真实的 bvid 等查询参数
    // 注意：window.location 的 search/href 通常不可 defineProperty（会静默失败），
    // 播放器通过 PlayerUtil.getNormalQuery -> getUrlValue 读 location.search 取 bvid，
    // 因此改为在伪造的 PlayerUtil 上覆盖 getNormalQuery，从真实播放器 URL 解析参数。

    // ===== 1. 伪造 PlayerUtil Referrer 校验 =====
    var fakeUtilInstalled = false;
    function installFakePlayerUtil() {
        if (fakeUtilInstalled) return;
        var PU = window.PlayerUtil;
        if (!PU) return;
        fakeUtilInstalled = true;
        PU.isCertifiedReferrer = function() { return true; };
        PU.isOfficialReferrer = function() { return true; };
        PU.isIframe = function() { return true; };
        PU.getPath = function() { return '/'; };
        // 关键：让播放器从真实播放器地址（?bvid=...&cid=...）读取参数，
        // 而不是代理地址（?url=...），否则 bvid 为 null -> view/detail 返回 -400 -> 3107
        var _origGetNormalQuery = typeof PU.getNormalQuery === 'function' ? PU.getNormalQuery.bind(PU) : null;
        PU.getNormalQuery = function(paramType) {
            var result = _origGetNormalQuery ? _origGetNormalQuery(paramType) : {};
            try {
                var realParams = new URL(REAL_HREF).searchParams;
                Object.keys(paramType || {}).forEach(function(key) {
                    var v = realParams.get(key);
                    if (v == null || v === '') return;
                    if (paramType[key] === 'number') v = +v;
                    else if (paramType[key] === 'boolean') v = (v === 'true');
                    result[key] = v;
                });
            } catch(e) {}
            return result;
        };
        // 覆盖跨域白名单（该属性可能是只读 getter，赋值需 try/catch）
        try {
            window.__CROSSDOMAIN_PLAYER_WHITELIST__ = [location.hostname];
        } catch(e) {}
    }

    // 用 defineProperty 提前拦截 PlayerUtil 的挂载
    try {
        var _playerUtil = null;
        Object.defineProperty(window, 'PlayerUtil', {
            configurable: true,
            get: function() { return _playerUtil; },
            set: function(v) {
                _playerUtil = v;
                installFakePlayerUtil();
                return true;
            }
        });
    } catch(e) {}

    // 兜底：轮询等待
    var pollCount = 0;
    var pollTimer = setInterval(function() {
        pollCount++;
        if (window.PlayerUtil) { clearInterval(pollTimer); installFakePlayerUtil(); }
        if (pollCount > 200) clearInterval(pollTimer);
    }, 50);

    // ===== 2. 劫持 fetch =====
    var _fetch = window.fetch;
    window.fetch = function(input, init) {
        var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
        if (shouldProxy(url)) {
            var nu = toProxy(url);
            if (typeof input === 'string') { input = nu; }
            else if (input instanceof Request) { input = new Request(nu, input); }
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

    // ===== 6. 劫持 Image.src =====
    try {
        var _imgProto = HTMLImageElement.prototype;
        var _origSrc = Object.getOwnPropertyDescriptor(_imgProto, 'src');
        if (_origSrc && _origSrc.set) {
            Object.defineProperty(_imgProto, 'src', {
                configurable: true,
                get: function() { return this.getAttribute('src') || ''; },
                set: function(v) {
                    if (shouldProxy(v)) { this.setAttribute('src', toProxy(v)); }
                    else { this.setAttribute('src', v); }
                }
            });
        }
    } catch(e) {}

    // ===== 7. 劫持 location 相关（防止跳转到 bilibili.com） =====
    // 暂不实现

})();
</script>`;
}

/**
 * 构造上游请求头（从原始请求 + buvid + adminCookie 组装）
 * @param {Headers|Object} origHeaders - 原始请求头
 * @param {Object} buvid - buvid 对象
 * @param {string} adminCookie - 管理员 B 站登录态 cookie
 * @param {URL} targetUrl - 目标 URL
 * @returns {Headers}
 */
export function buildUpstreamHeaders(origHeaders, buvid, adminCookie, targetUrl) {
    const upHeaders = new Headers(origHeaders || {});

    upHeaders.set('user-agent',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36');
    upHeaders.set('referer', 'https://www.bilibili.com/');
    upHeaders.set('origin', 'https://www.bilibili.com');
    upHeaders.set('accept-language', 'zh-CN,zh;q=0.9,en;q=0.8');
    upHeaders.set('accept-encoding', 'identity'); // 禁用压缩，方便处理

    const isApiRequest = targetUrl.hostname.includes('api.bilibili') ||
                         targetUrl.hostname.includes('interface.') ||
                         targetUrl.pathname.includes('/x/player/') ||
                         targetUrl.pathname.includes('/pgc/player/');

    const biliCookieParts = [];
    if (buvid && buvid.buvid3) {
        biliCookieParts.push(`buvid3=${buvid.buvid3}`);
        if (buvid.buvid4) biliCookieParts.push(`buvid4=${buvid.buvid4}`);
    }
    biliCookieParts.push('buvid_fp_plain=undefined');
    biliCookieParts.push('CURRENT_FNVAL=4048');
    biliCookieParts.push('CURRENT_QUALITY=120');
    biliCookieParts.push('bp_t_offset=0');
    biliCookieParts.push('_uuid=0');
    biliCookieParts.push('i-wanna-go-back=-1');
    biliCookieParts.push('b_ut=7');
    biliCookieParts.push('b_lsid=0');
    biliCookieParts.push('bsource=search_google');

    if (adminCookie && isApiRequest) {
        biliCookieParts.push(adminCookie);
    }

    upHeaders.set('cookie', biliCookieParts.join('; '));

    // 清除不应该转发的 header
    upHeaders.delete('host');
    upHeaders.delete('x-csrf-token');
    upHeaders.delete('x-forwarded-for');
    upHeaders.delete('x-forwarded-proto');
    upHeaders.delete('cf-ray');
    upHeaders.delete('cf-connecting-ip');
    // 清除浏览器侧 CORS/风控相关头：这些头会让 B 站把请求当作跨域 XHR 做更严格校验（-400）
    upHeaders.delete('x-requested-with');
    upHeaders.delete('sec-fetch-dest');
    upHeaders.delete('sec-fetch-mode');
    upHeaders.delete('sec-fetch-site');
    upHeaders.delete('sec-fetch-user');
    upHeaders.delete('service-worker-allowed');
    // 浏览器 referer 是本站代理地址，已在上面统一伪造为 bilibili.com，删除旧值避免残留
    upHeaders.delete('referer');
    upHeaders.set('referer', 'https://www.bilibili.com/');

    return upHeaders;
}

/**
 * 处理 HTML 响应：
 *   1. 把所有 B 站域名的静态资源 URL（iframe/script/link/img 等的 src/href）替换为代理地址
 *      （确保子 iframe、子资源也走代理，避免 CORS 和跨 iframe 劫持失效问题）
 *   2. 注入劫持脚本
 */
export function processHtml(html) {
    // 第一步：替换所有 B 站域名的 URL 为代理地址
    html = rewriteBiliUrlsInHtml(html);

    // 第二步：注入劫持脚本
    const inject = buildInjectScript();

    // 注入到 <head> 内第一个 <script> 之前
    const headEnd = html.indexOf('</head>');
    const firstScript = html.indexOf('<script');
    let injectPos = -1;

    if (firstScript !== -1 && (headEnd === -1 || firstScript < headEnd)) {
        injectPos = firstScript;
    } else if (headEnd !== -1) {
        injectPos = headEnd;
    }

    if (injectPos !== -1) {
        return html.slice(0, injectPos) + inject + '\n' + html.slice(injectPos);
    }
    return inject + '\n' + html;
}

/**
 * 替换 HTML 中所有 B 站域名的 URL 为代理地址
 * 匹配：src="..."  href="..."  src='...'  href='...'
 * 确保 iframe、script、link、img 等静态资源也走代理
 */
export function rewriteBiliUrlsInHtml(html) {
    const proxyPath = PROXY_PATH;

    function replaceAttr(match, attr, quote, url) {
        if (!url) return match;
        // 站点根相对路径（/xxx 而非 //host）保持原样
        if (url.startsWith('/') && !url.startsWith('//')) return match;
        // data: / blob: 协议跳过
        if (/^(data:|blob:|javascript:)/i.test(url)) {
            return match;
        }
        try {
            // 协议相对 URL（//host/...）用 https: 补全
            const u = new URL(url, 'https://www.bilibili.com/');
            if (isBiliHost(u.hostname)) {
                const proxied = proxyPath + '?url=' + encodeURIComponent(u.href);
                return `${attr}=${quote}${proxied}${quote}`;
            }
        } catch (e) {
            // 不是合法 URL，原样返回
        }
        return match;
    }

    // 双引号属性
    html = html.replace(/\b(src|href|poster|data-src|data-href)\s*=\s*"([^"]+)"/g,
        (m, attr, url) => replaceAttr(m, attr, '"', url));

    // 单引号属性
    html = html.replace(/\b(src|href|poster|data-src|data-href)\s*=\s*'([^']+)'/g,
        (m, attr, url) => replaceAttr(m, attr, "'", url));

    return html;
}

/**
 * 判断响应类型并构造响应头
 * @param {Response} res - 上游响应
 * @param {URL} targetUrl - 目标 URL
 * @returns {{ contentType: string, isHtml: boolean, isJson: boolean, isVideo: boolean, isImage: boolean, isJs: boolean, isCss: boolean }}
 */
export function detectContentType(res, targetUrl) {
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const path = targetUrl.pathname || '';

    return {
        contentType,
        isHtml: contentType.includes('text/html'),
        isJson: contentType.includes('application/json') || contentType.includes('json'),
        isVideo: contentType.includes('video/') ||
                 contentType.includes('application/octet-stream') ||
                 /\.(mp4|flv|m4s|m3u8|ts|webm|dash)(\?|$)/i.test(path),
        isImage: contentType.includes('image/'),
        isJs: contentType.includes('javascript') || path.endsWith('.js'),
        isCss: contentType.includes('css') || path.endsWith('.css'),
    };
}

/**
 * 构建最终响应头（剥离安全头、添加 CORS）
 */
export function buildResponseHeaders(res) {
    const newHeaders = new Headers(res.headers);
    for (const h of REMOVE_HEADERS) {
        newHeaders.delete(h);
    }
    newHeaders.set('access-control-allow-origin', '*');
    newHeaders.set('access-control-allow-methods', 'GET, HEAD, POST, OPTIONS');
    newHeaders.set('access-control-allow-headers', '*');
    newHeaders.set('access-control-expose-headers', 'Content-Length, Content-Range');
    newHeaders.delete('content-length');
    return newHeaders;
}
