/**
 * POST /api/auth/logout
 * 管理员退出登录：销毁会话并清除 Cookie
 */
import { json, runHandler } from '../../lib/response.js';
import { assertKV } from '../../lib/kv.js';
import { requireAuth, destroySession, clearCookieHeader, getClientIp } from '../../lib/session.js';
import { writeLog, LOG_ACTIONS } from '../../lib/logger.js';

export function onRequestPost(context) {
  return runHandler(async () => {
    // 鉴权失败（未登录 / CSRF 校验不通过）直接返回对应错误响应
    const auth = await requireAuth(context);
    if (!auth.ok) return auth.response;

    const kv = assertKV();
    await destroySession(kv, context.request);
    await writeLog(kv, {
      username: auth.session.username,
      action: LOG_ACTIONS.LOGOUT,
      target: 'admin',
      summary: '管理员退出登录',
      ip: getClientIp(context.request)
    });
    return json({ ok: true }, { headers: { 'set-cookie': clearCookieHeader() } });
  });
}