/**
 * GET /api/admin/logs?page=1&pageSize=20&action=login
 * 操作日志分页查询（action 为可选的操作类型筛选）
 */
import { json, runHandler } from '../../lib/response.js';
import { assertKV } from '../../lib/kv.js';
import { requireAuth } from '../../lib/session.js';
import { listLogs } from '../../lib/logger.js';

export function onRequestGet(context) {
  return runHandler(async () => {
    const auth = await requireAuth(context);
    if (!auth.ok) return auth.response;

    const kv = assertKV();
    const params = new URL(context.request.url).searchParams;

    // page 从 1 开始，非法值回退为 1
    const page = Math.max(parseInt(params.get('page'), 10) || 1, 1);
    // pageSize 默认 20，范围 1~100
    const pageSize = Math.min(Math.max(parseInt(params.get('pageSize'), 10) || 20, 1), 100);
    // action 可选筛选（空表示不过滤）
    const action = (params.get('action') || '').trim();

    return json(await listLogs(kv, { page, pageSize, action }));
  });
}