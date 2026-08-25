/**
 * GET /api/bili-player
 * B 站 newplayer 播放器页面代理
 * 后端 fetch 远程页面后，移除 X-Frame-Options / CSP frame-ancestors 等禁止嵌入的响应头，
 * 让本站 iframe 可以正常嵌入 B 站 blackboard/newplayer.html 样式的播放器。
 *
 * Query:
 *   bvid - BV 号
 *   page - 分 P（默认 1）
 *   autoplay - 是否自动播放（1/0，默认 1）
 */
import { error, runHandler } from '../lib/response.js';

/** 允许的 BV 号格式校验 */
const BVID_RE = /^BV[0-9A-Za-z]{10}$/;

export function onRequestGet(context) {
  return runHandler(async () => {
    const url = new URL(context.request.url);
    const bvid = url.searchParams.get('bvid') || '';
    const page = url.searchParams.get('page') || '1';
    const autoplay = url.searchParams.get('autoplay') || '1';

    if (!BVID_RE.test(bvid)) {
      return error(400, 'BAD_REQUEST', 'bvid 参数不合法');
    }

    // 构造 B 站 newplayer 地址
    const targetUrl =
      'https://www.bilibili.com/blackboard/newplayer.html' +
      `?crossDomain=true&bvid=${bvid}&as_wide=1&page=${page}&autoplay=${autoplay}&poster=1`;

    // 服务端请求远程页面
    const res = await fetch(targetUrl, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'accept-language': 'zh-CN,zh;q=0.9'
      }
    });

    if (!res.ok) {
      return error(502, 'UPSTREAM_ERROR', `上游返回 ${res.status}`);
    }

    // 构造新响应：透传 body，但删除禁止 iframe 嵌入的头
    const newHeaders = new Headers(res.headers);
    newHeaders.delete('x-frame-options');
    newHeaders.delete('content-security-policy');
    newHeaders.delete('content-security-policy-report-only');
    newHeaders.delete('frame-options');

    // 浏览器缓存：7 天
    newHeaders.set('cache-control', 'public, max-age=604800');

    return new Response(res.body, {
      status: res.status,
      headers: newHeaders
    });
  });
}
