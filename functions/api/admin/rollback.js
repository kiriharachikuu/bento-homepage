/**
 * POST /api/admin/rollback
 * 回滚到指定配置版本（body: { versionId }）
 */
import { json, error, runHandler } from '../../lib/response.js';
import { assertKV } from '../../lib/kv.js';
import { requireAuth, getClientIp } from '../../lib/session.js';
import { writeLog, LOG_ACTIONS } from '../../lib/logger.js';
import { rollbackToVersion } from '../../lib/version.js';

export function onRequestPost(context) {
  return runHandler(async () => {
    const auth = await requireAuth(context);
    if (!auth.ok) return auth.response;

    const kv = assertKV(context);

    // 解析请求体
    let body;
    try {
      body = await context.request.json();
    } catch {
      return error(400, 'BAD_REQUEST', '请求体不是合法的 JSON');
    }
    const versionId = body && body.versionId;
    if (!versionId) {
      return error(400, 'BAD_REQUEST', '缺少版本 ID');
    }
    const id = String(versionId);

    // 版本不存在时由 rollbackToVersion 抛出 AppError(404)
    await rollbackToVersion(kv, id, { username: auth.session.username });

    await writeLog(kv, {
      username: auth.session.username,
      action: LOG_ACTIONS.ROLLBACK,
      target: id,
      summary: '回滚配置版本',
      ip: getClientIp(context.request)
    });

    return json({ ok: true });
  });
}