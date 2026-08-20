/**
 * GET /api/auth/me
 * 查询当前登录的管理员信息
 */
import { json, runHandler } from '../../lib/response.js';
import { requireAuth } from '../../lib/session.js';

export function onRequestGet(context) {
  return runHandler(async () => {
    const auth = await requireAuth(context);
    if (!auth.ok) return auth.response;
    return json({ username: auth.session.username });
  });
}