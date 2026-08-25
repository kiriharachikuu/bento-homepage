/**
 * 视频管理数据查询（需登录会话）
 * GET /api/admin/videos
 * 返回：manual 手动视频 / synced 同步视频 / overrides 字段覆盖配置 /
 *      display 合并展示列表 / syncState 同步状态
 */
import { json, runHandler } from '../../lib/response.js';
import { assertKV } from '../../lib/kv.js';
import { requireAuth } from '../../lib/session.js';
import { getVideoData, getOverrides, getSyncState, mergeVideoList, getSiteConfig } from '../../lib/videos.js';

export async function onRequestGet(context) {
  return runHandler(async () => {
    const auth = await requireAuth(context);
    if (!auth.ok) return auth.response;

    const kv = assertKV(context);
    const [videoData, overrides, syncState, siteConfig] = await Promise.all([
      getVideoData(kv),
      getOverrides(kv),
      getSyncState(kv),
      getSiteConfig(kv)
    ]);

    // videoSync 信息：剔除 biliCookie 敏感字段（只返回是否已配置，不返回明文）
    let videoSyncInfo = null;
    if (siteConfig && siteConfig.videoSync) {
      const { biliCookie, ...rest } = siteConfig.videoSync;
      videoSyncInfo = {
        ...rest,
        biliCookie: biliCookie ? '***已配置***' : ''
      };
    }

    return json({
      manual: videoData.manual,
      synced: videoData.synced,
      overrides,
      display: mergeVideoList(videoData, overrides),
      syncState,
      videoSync: videoSyncInfo
    });
  });
}