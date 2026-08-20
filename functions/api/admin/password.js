/**
 * POST /api/admin/password
 * 修改管理员密码（body: { oldPassword, newPassword }）
 */
import { json, error, runHandler } from '../../lib/response.js';
import { assertKV, kvGetJson, kvPutJson } from '../../lib/kv.js';
import { pbkdf2Hash, randomHex } from '../../lib/crypto.js';
import { requireAuth, getClientIp } from '../../lib/session.js';
import { writeLog, LOG_ACTIONS } from '../../lib/logger.js';

export function onRequestPost(context) {
  return runHandler(async () => {
    const auth = await requireAuth(context);
    if (!auth.ok) return auth.response;

    const kv = assertKV();

    // 解析请求体
    let body;
    try {
      body = await context.request.json();
    } catch {
      return error(400, 'BAD_REQUEST', '请求体不是合法的 JSON');
    }
    const { oldPassword, newPassword } = body || {};
    if (!oldPassword || !newPassword) {
      return error(400, 'BAD_REQUEST', '请输入旧密码和新密码');
    }

    const adminUser = await kvGetJson(kv, 'admin_user');
    if (!adminUser) {
      return error(500, 'ACCOUNT_NOT_INIT', '管理员账号尚未初始化，请先完成一次登录');
    }

    // 校验旧密码
    const oldHash = await pbkdf2Hash(String(oldPassword), adminUser.salt);
    if (oldHash !== adminUser.hash) {
      return error(400, 'WRONG_PASSWORD', '旧密码不正确');
    }

    // 新密码强度：至少 8 位
    if (String(newPassword).length < 8) {
      return error(400, 'WEAK_PASSWORD', '新密码至少8位');
    }

    // 生成新盐值并更新密码
    const salt = randomHex(16);
    const hash = await pbkdf2Hash(String(newPassword), salt);
    await kvPutJson(kv, 'admin_user', {
      username: adminUser.username,
      salt,
      hash,
      updatedAt: Date.now()
    });

    await writeLog(kv, {
      username: auth.session.username,
      action: LOG_ACTIONS.PASSWORD,
      target: 'admin',
      summary: '修改管理密码',
      ip: getClientIp(context.request)
    });

    return json({ ok: true });
  });
}