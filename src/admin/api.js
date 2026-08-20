/**
 * API 请求封装（管理后台共用）
 *
 * 约定：
 * - 与边缘函数同域部署，无需 CORS，统一携带 credentials: 'same-origin'
 * - 非 GET 请求自动附带 'X-Requested-With: fetch'（后端 CSRF 校验要求）
 * - 错误响应统一格式 { error: { code, message } }，非 2xx 抛 ApiError
 * - 401 且业务码为 UNAUTHORIZED 时，先触发全局未授权回调（main.js 注册，
 *   用于跳回登录视图），再抛错
 */

/** API 业务错误：携带 HTTP 状态码 / 业务错误码 / 错误信息 */
export class ApiError extends Error {
    /**
     * @param {number} status HTTP 状态码（网络异常时为 0）
     * @param {string} code 业务错误码（如 AUTH_FAILED / UNAUTHORIZED / NETWORK_ERROR）
     * @param {string} message 面向用户的错误信息
     */
    constructor(status, code, message) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code || '';
    }
}

/** 全局未授权回调（由 main.js 通过 setUnauthorizedHandler 注册） */
let unauthorizedHandler = null;

/**
 * 注册全局未授权回调
 * @param {() => void} fn 401 + UNAUTHORIZED 时被调用
 */
export function setUnauthorizedHandler(fn) {
    unauthorizedHandler = typeof fn === 'function' ? fn : null;
}

/** 常见 HTTP 状态码的兜底文案（响应体无 error.message 时使用） */
const STATUS_MESSAGES = {
    400: '请求参数错误',
    401: '未登录或登录已过期',
    403: '没有权限执行该操作',
    404: '请求的资源不存在',
    405: '请求方法不被支持',
    429: '请求过于频繁，请稍后再试',
    500: '服务器内部错误',
    502: '网关错误',
    503: '服务暂不可用',
    504: '网关超时'
};

/**
 * 将 query 对象拼接为查询串（值为 null/undefined/空串的键忽略）
 * @param {object} query
 * @returns {string} 形如 '?a=1&b=2'，无有效参数时为空串
 */
function buildQuery(query) {
    if (!query || typeof query !== 'object') return '';
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (value === null || value === undefined || value === '') continue;
        params.append(key, String(value));
    }
    const qs = params.toString();
    return qs ? `?${qs}` : '';
}

/**
 * 从响应体解析统一错误结构 { error: { code, message } }
 * @param {*} data 已解析的响应体（可能为 null 或非对象）
 * @returns {{code: string, message: string}|null}
 */
function parseErrorBody(data) {
    if (data && typeof data === 'object' && data.error && typeof data.error === 'object') {
        return {
            code: typeof data.error.code === 'string' ? data.error.code : '',
            message: typeof data.error.message === 'string' ? data.error.message : ''
        };
    }
    return null;
}

/**
 * 发起 API 请求
 * @param {string} path 接口路径，如 '/api/auth/login'
 * @param {object} [options]
 * @param {string} [options.method='GET'] HTTP 方法
 * @param {*} [options.body] 请求体对象，自动 JSON.stringify
 * @param {object} [options.query] 查询参数对象，自动拼接为查询串
 * @returns {Promise<any>} 2xx 时返回解析后的响应体 JSON
 * @throws {ApiError} 网络异常或非 2xx 响应
 */
export async function request(path, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const headers = {};
    const init = { method, headers, credentials: 'same-origin' };

    // 非 GET 请求：附加 CSRF 校验头，请求体自动 JSON 序列化
    if (method !== 'GET') {
        headers['X-Requested-With'] = 'fetch';
        headers['Content-Type'] = 'application/json';
        if (options.body !== undefined) {
            init.body = JSON.stringify(options.body);
        }
    }

    let response;
    try {
        response = await fetch(path + buildQuery(options.query), init);
    } catch (err) {
        // fetch 抛错一般是网络中断 / DNS 失败
        throw new ApiError(0, 'NETWORK_ERROR', '网络异常，请检查网络后重试');
    }

    // 尽力解析响应体 JSON（非 JSON 响应容错为 null）
    let data = null;
    try {
        data = await response.json();
    } catch (err) {
        data = null;
    }

    if (!response.ok) {
        const errBody = parseErrorBody(data);
        const code = errBody ? errBody.code : '';
        const message =
            (errBody && errBody.message) ||
            STATUS_MESSAGES[response.status] ||
            `请求失败（HTTP ${response.status}）`;

        // 会话失效：先触发全局回调（跳回登录视图），再抛错
        if (response.status === 401 && code === 'UNAUTHORIZED' && unauthorizedHandler) {
            try {
                await unauthorizedHandler();
            } catch (err) {
                // 回调自身异常不影响错误抛出
            }
        }
        throw new ApiError(response.status, code, message);
    }

    return data;
}

/** GET 请求快捷方法 */
export const get = (path, query) => request(path, { method: 'GET', query });

/** POST 请求快捷方法 */
export const post = (path, body) => request(path, { method: 'POST', body });
