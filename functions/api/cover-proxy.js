/**
 * GET /api/cover-proxy
 * 封面图片代理：服务端下载 B 站等防盗链图片后返回，绕过跨域/防盗链限制
 *
 * Query:
 *   url - 原始图片 URL（URL 编码）
 *
 * 安全限制：
 *   - 仅允许代理白名单域名的图片（B 站相关域名）
 *   - 仅支持 GET
 *   - 带 referer 伪装成来自 bilibili.com 的请求
 */
import { error, runHandler } from '../lib/response.js';

/** 允许代理的域名白名单（host 结尾匹配） */
const ALLOWED_HOSTS = [
  'hdslb.com',
  'bilibili.com',
  'biliapi.com',
  'biliimg.com',
  'b23.tv'
];

/** 浏览器 UA */
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** 最大文件大小（5MB） */
const MAX_SIZE = 5 * 1024 * 1024;

export function onRequestGet(context) {
  return runHandler(async () => {
    const url = new URL(context.request.url);
    const target = url.searchParams.get('url');
    if (!target) {
      return error(400, 'BAD_REQUEST', '缺少 url 参数');
    }

    // 校验：必须是 http(s) URL
    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      return error(400, 'BAD_REQUEST', 'url 参数不合法');
    }
    if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
      return error(400, 'BAD_REQUEST', '仅支持 http/https 协议');
    }

    // 校验：必须在白名单域名内
    const hostOk = ALLOWED_HOSTS.some((h) => targetUrl.hostname.endsWith(h));
    if (!hostOk) {
      return error(403, 'FORBIDDEN', '不在允许的代理域名范围内');
    }

    // 服务端带 referer 下载
    try {
      const res = await fetch(targetUrl.toString(), {
        headers: {
          'user-agent': BROWSER_UA,
          referer: 'https://www.bilibili.com/'
        },
        cf: { cacheTtl: 86400 }
      });

      if (!res.ok) {
        return error(502, 'UPSTREAM_ERROR', `上游返回 ${res.status}`);
      }

      // 安全大小限制
      const contentLength = Number(res.headers.get('content-length') || '0');
      if (contentLength > MAX_SIZE) {
        return error(413, 'TOO_LARGE', '图片过大');
      }

      // 构造响应：透传 content-type，加浏览器强缓存 7 天
      const contentType = res.headers.get('content-type') || 'image/jpeg';
      const body = await res.arrayBuffer();

      if (body.byteLength > MAX_SIZE) {
        return error(413, 'TOO_LARGE', '图片过大');
      }

      return new Response(body, {
        status: 200,
        headers: {
          'content-type': contentType,
          'content-length': String(body.byteLength),
          'cache-control': 'public, max-age=604800, immutable',
          'access-control-allow-origin': '*'
        }
      });
    } catch (err) {
      return error(502, 'UPSTREAM_ERROR', `下载失败：${err.message}`);
    }
  });
}
