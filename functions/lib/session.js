/**
 * 会话管理：登录态保持、Cookie 处理、鉴权校验
 */
import { randomHex } from './crypto.js';
import { assertKV, kvPutJson, kvDelete } from './kv.js';
import { error } from './response.js';

/** 会话 Cookie 名称 */
export const SESSION_COOKIE = 'cms_session';

/** 会话有效期（秒）：7 天 */
export const SESSION_TTL_SECONDS = 7 * 24 * 3600;

/**
 * 创建会话：生成随机 token，写入 KV
 * @param {object} kv KV 绑定对象
 * @param {string} username 登录用户名
 * @returns {Promise<string>} 会话 token
 */
export async function createSession(kv, username) {
  const token = randomHex(32);
  await kvPutJson(kv, `session_${token}`, {
    username,
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000
  });
  return token;
}

/**
 * 构造会话 Cookie 响应头
 * @param {string} token
 * @param {number} [maxAgeSeconds=SESSION_TTL_SECONDS]
 * @returns {string} Set-Cookie 值
 */
export function sessionCookieHeader(token, maxAgeSeconds = SESSION_TTL_SECONDS) {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}`;
}

/**
 * 构造清除会话 Cookie 的响应头
 * @returns {string} Set-Cookie 值
 */
export function clearCookieHeader() {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

/**
 * 解析请求中的 Cookie 头，返回指定名称的值（不存在返回 null）
 * @param {Request} request
 * @param {string} name
 * @returns {string|null}
 */
function parseCookie(request, name) {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) {
      return part.slice(idx + 1).trim();
    }
  }
  return null;
}

/**
 * 读取当前请求的会话（过期或不存在返回 null）
 * @param {Request} request
 * @param {object} kv KV 绑定对象
 * @returns {Promise<{username: string, token: string}|null>}
 */
export async function getSession(request, kv) {
  const token = parseCookie(request, SESSION_COOKIE);
  if (!token || !kv) return null;
  const session = await kv.get(`session_${token}`, { type: 'json' });
  if (!session) return null;
  // 过期判断
  if (!session.expiresAt || session.expiresAt < Date.now()) {
    return null;
  }
  return { username: session.username, token };
}

/**
 * 销毁当前请求对应的会话
 * @param {object} kv KV 绑定对象
 * @param {Request} request
 */
export async function destroySession(kv, request) {
  const token = parseCookie(request, SESSION_COOKIE);
  if (!token || !kv) return;
  await kvDelete(kv, `session_${token}`);
}

/**
 * 鉴权闸门：校验会话与 CSRF 防护头
 * - 先确保 KV 已绑定；
 * - 会话无效返回 401；
 * - 写操作（POST/PUT/DELETE/PATCH）要求请求头 x-requested-with 为 fetch，否则返回 403；
 * - 成功返回 { ok: true, session }
 * @param {object} context EdgeOne Pages Functions 的请求上下文
 * @returns {Promise<{ok: boolean, session?: object, response?: Response}>}
 */
export async function requireAuth(context) {
  const kv = assertKV(context);
  const session = await getSession(context.request, kv);
  if (!session) {
    return { ok: false, response: error(401, 'UNAUTHORIZED', '请先登录') };
  }
  // 写操作需要自定义头校验，防止跨站表单提交（CSRF）
  const method = (context.request.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    if (context.request.headers.get('x-requested-with') !== 'fetch') {
      return { ok: false, response: error(403, 'CSRF', '非法请求来源') };
    }
  }
  return { ok: true, session };
}

/**
 * 获取客户端 IP
 * @param {Request} request
 * @returns {string}
 */
export function getClientIp(request) {
  const eoIp = request.headers.get('eo-connecting-ip');
  if (eoIp) return eoIp.trim();
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  return 'unknown';
}
