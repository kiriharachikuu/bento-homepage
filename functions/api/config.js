/**
 * GET /api/config
 * 公开配置接口：返回站点配置与合并后的视频展示列表（含边缘缓存）
 */
import { json, runHandler } from '../lib/response.js';
import { assertKV } from '../lib/kv.js';
import { getSiteConfig, getVideoData, getOverrides, mergeVideoList } from '../lib/videos.js';

export function onRequestGet(context) {
  return runHandler(async () => {
    const kv = assertKV();

    // 并行读取站点配置、视频数据与字段覆盖配置
    const [siteConfig, videoData, overrides] = await Promise.all([
      getSiteConfig(kv),
      getVideoData(kv),
      getOverrides(kv)
    ]);

    // 合并出前端展示用的视频列表（应用覆盖字段、过滤隐藏、置顶排序）
    const videos = mergeVideoList(videoData, overrides);

    // 公开只读接口允许边缘缓存 60 秒
    return json({ ...siteConfig, videos }, { headers: { 'cache-control': 'public, max-age=60' } });
  });
}