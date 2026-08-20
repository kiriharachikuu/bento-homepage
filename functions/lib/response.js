/**
 * 统一的 HTTP 响应工具
 * 供所有 functions/api 端点复用
 */

/**
 * 构造 JSON 响应
 * @param {*} data 要序列化为 JSON 的数据
 * @param {object} [init] 可包含 status / headers，会与默认值合并（init 优先）
 * @returns {Response}
 */
export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers
  });
}

/**
 * 构造统一错误结构的 JSON 响应
 * @param {number} status HTTP 状态码
 * @param {string} code 业务错误码
 * @param {string} message 错误信息
 * @returns {Response}
 */
export function error(status, code, message) {
  return json({ error: { code, message } }, { status });
}

/**
 * 业务异常：抛出后由 runHandler 捕获并转换为对应错误响应
 */
export class AppError extends Error {
  /**
   * @param {number} status HTTP 状态码
   * @param {string} code 业务错误码
   * @param {string} message 错误信息
   */
  constructor(status, code, message) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

/**
 * 端点处理函数包装器：统一捕获异常
 * 用法：export function onRequestPost(context) { return runHandler(async () => { ...; return json({...}); }); }
 * @param {() => Promise<Response>} fn 业务处理函数，返回 Response
 * @returns {Promise<Response>}
 */
export async function runHandler(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AppError) {
      return error(err.status, err.code, err.message);
    }
    return error(500, 'INTERNAL', err instanceof Error ? err.message : String(err));
  }
}
