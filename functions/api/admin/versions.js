/**
 * GET /api/admin/versions
 * 配置版本列表（新的在前）
 */
import { json, runHandler } from '../../lib/response.js';
import { assertKV } from '../../lib/kv.js';
import { requireAuth } from '../../lib/session.js';
import { getVersionList } from '../../lib/version.js';

export function onRequestGet(context) {
  return runHandler(async () => {
    const auth = await requireAuth(context);
    if (!auth.ok) return auth.response;

    const kv = assertKV(context);
    return json({ versions: await getVersionList(kv) });
  });
}