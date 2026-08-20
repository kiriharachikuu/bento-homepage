/**
 * GET /api/admin/version-detail?id=xxx
 * 配置版本详情（含快照数据）
 */
import { json, runHandler } from '../../lib/response.js';
import { assertKV } from '../../lib/kv.js';
import { requireAuth } from '../../lib/session.js';
import { getVersionDetail } from '../../lib/version.js';

export function onRequestGet(context) {
  return runHandler(async () => {
    const auth = await requireAuth(context);
    if (!auth.ok) return auth.response;

    const kv = assertKV(context);
    const id = new URL(context.request.url).searchParams.get('id');
    // 版本不存在时 getVersionDetail 抛出 AppError(404)，由 runHandler 统一转换为错误响应
    return json(await getVersionDetail(kv, id));
  });
}