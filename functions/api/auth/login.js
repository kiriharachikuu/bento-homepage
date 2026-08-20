/**
 * POST /api/auth/login
 * 管理员登录：
 * - 首次登录时用环境变量中的初始账号密码初始化 admin_user；
 * - 之后使用 KV 中存储的 PBKDF2 哈希校验；
 * - 按 IP 做失败限流（5 次失败锁定 15 分钟）。
 */
import { json, error, runHandler } from '../../lib/response.js';
import { assertKV, kvGetJson, kvPutJson, kvDelete } from '../../lib/kv.js';
import { pbkdf2Hash, randomHex } from '../../lib/crypto.js';
import { createSession, sessionCookieHeader, getClientIp } from '../../lib/session.js';
import { writeLog, LOG_ACTIONS } from '../../lib/logger.js';

/** 登录失败锁定阈值（次） */
const LOGIN_FAIL_LIMIT = 5;
/** 登录锁定时长（毫秒）：15 分钟 */
const LOGIN_LOCK_MS = 15 * 60 * 1000;

/**
 * 将 IP 字符串逐字符编码为 hex
 * （IP 可能含 . 与 : 等字符，不能直接拼进 KV key）
 * @param {string} ip
 * @returns {string}
 */
function ipToHex(ip) {
  let hex = '';
  for (let i = 0; i < ip.length; i++) {
    hex += ip.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex;
}

export function onRequestPost(context) {
  return runHandler(async () => {
    // CSRF 防护：与其他写接口一致，要求 X-Requested-With 头（跨站表单无法携带）
    if (context.request.headers.get('x-requested-with') !== 'fetch') {
      return error(403, 'CSRF', '缺少必要的请求头');
    }

    const kv = assertKV(context);

    // 解析请求体
    let body;
    try {
      body = await context.request.json();
    } catch {
      return error(400, 'BAD_REQUEST', '请输入用户名和密码');
    }
    const { username, password } = body || {};
    if (!username || !password) {
      return error(400, 'BAD_REQUEST', '请输入用户名和密码');
    }

    // 登录限流：按 IP 统计失败次数，锁定期间直接拒绝
    const ip = getClientIp(context.request);
    const lockKey = `login_lock_${ipToHex(ip)}`;
    let lock = await kvGetJson(kv, lockKey);
    if (lock && lock.lockedUntil && lock.lockedUntil > Date.now()) {
      return error(429, 'LOCKED', '失败次数过多，请15分钟后再试');
    }
    // 锁定已过期：失败计数重新开始
    if (lock && lock.lockedUntil && lock.lockedUntil <= Date.now()) {
      lock = null;
    }

    // 账号校验：admin_user 不存在时用环境变量初始化，存在时比对哈希
    let adminUser = await kvGetJson(kv, 'admin_user');
    let ok = false;
    if (adminUser === null) {
      const env = context.env || {};
      if (
        env.ADMIN_USERNAME &&
        env.ADMIN_INIT_PASSWORD &&
        username === env.ADMIN_USERNAME &&
        password === env.ADMIN_INIT_PASSWORD
      ) {
        // 初始化账号：生成盐值与哈希并落库，后续登录均走哈希校验
        const salt = randomHex(16);
        const hash = await pbkdf2Hash(password, salt);
        adminUser = { username, salt, hash, updatedAt: Date.now() };
        await kvPutJson(kv, 'admin_user', adminUser);
        ok = true;
      }
    } else if (username === adminUser.username) {
      const hash = await pbkdf2Hash(password, adminUser.salt);
      ok = hash === adminUser.hash;
    }

    if (ok) {
      // 成功：清除失败计数，创建会话并记录日志
      if (lock) {
        await kvDelete(kv, lockKey);
      }
      const token = await createSession(kv, username);
      await writeLog(kv, {
        username,
        action: LOG_ACTIONS.LOGIN,
        target: 'admin',
        summary: '管理员登录',
        ip
      });
      return json({ ok: true, username }, { headers: { 'set-cookie': sessionCookieHeader(token) } });
    }

    // 失败：累计失败次数，达到阈值后写入锁定截止时间
    const fails = ((lock && lock.fails) || 0) + 1;
    const lockedUntil = fails >= LOGIN_FAIL_LIMIT ? Date.now() + LOGIN_LOCK_MS : null;
    await kvPutJson(kv, lockKey, { fails, lockedUntil });
    return error(401, 'AUTH_FAILED', '用户名或密码错误');
  });
}