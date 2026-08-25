/**
 * GET /api/config
 * 公开配置接口：返回站点配置与合并后的视频展示列表（含边缘缓存）
 */
import { json, runHandler } from '../lib/response.js';
import { assertKV } from '../lib/kv.js';
import { getSiteConfig, getVideoData, getOverrides, mergeVideoList } from '../lib/videos.js';

export function onRequestGet(context) {
  return runHandler(async () => {
    const kv = assertKV(context);

    // 并行读取站点配置、视频数据与字段覆盖配置
    const [siteConfig, videoData, overrides] = await Promise.all([
      getSiteConfig(kv),
      getVideoData(kv),
      getOverrides(kv)
    ]);

    // 合并出前端展示用的视频列表（应用覆盖字段、过滤隐藏、置顶排序）
    const videos = mergeVideoList(videoData, overrides);

    // 封面防盗链处理：B 站等域名的封面替换为本站代理地址
    for (const v of videos) {
      v.cover = proxifyCover(v.cover);
    }

    // 公开返回的配置：剔除敏感字段（如 B 站登录态 Cookie）
    const publicConfig = { ...siteConfig };
    if (publicConfig.videoSync) {
      const { biliCookie, ...rest } = publicConfig.videoSync;
      publicConfig.videoSync = rest;
    }

    // 公开只读接口允许边缘缓存 60 秒
    return json({ ...publicConfig, videos }, { headers: { 'cache-control': 'public, max-age=60' } });
  });
}

/**
 * 判断封面是否来自需要代理的防盗链域名，是则替换为本站代理地址
 * 已经是本站相对路径、COS 域名或其他非防盗链源的，原样返回
 * @param {string} cover
 * @returns {string}
 */
function proxifyCover(cover) {
  if (!cover || typeof cover !== 'string') return '';
  // 已经是本站相对路径（含本站代理），直接返回
  if (cover.startsWith('/') || cover.startsWith('./') || cover.startsWith('../')) return cover;
  try {
    const u = new URL(cover);
    const needProxy = ['hdslb.com', 'bilibili.com', 'biliapi.com', 'biliimg.com'].some(
      (h) => u.hostname.endsWith(h)
    );
    if (needProxy) {
      return `/api/cover-proxy?url=${encodeURIComponent(cover)}`;
    }
    return cover;
  } catch {
    return cover;
  }
}