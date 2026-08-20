/**
 * 手动触发 B 站视频同步（需登录会话）
 * POST /api/admin/videos/sync
 * 返回：{ ok, syncState, error? }
 */
import { json, runHandler } from '../../../lib/response.js';
import { assertKV } from '../../../lib/kv.js';
import { requireAuth, getClientIp } from '../../../lib/session.js';
import { syncBilibiliVideos } from '../../../lib/bilibili.js';

export async function onRequestPost(context) {
  return runHandler(async () => {
    const auth = await requireAuth(context);
    if (!auth.ok) return auth.response;

    const kv = assertKV(context);
    const result = await syncBilibiliVideos(kv, {
      username: auth.session.username,
      ip: getClientIp(context.request),
      trigger: 'manual'
    });

    // 同步失败仍返回 200，通过 ok 字段与 error 信息区分结果
    return json({
      ok: result.ok,
      syncState: result.syncState,
      error: result.error
    });
  });
}