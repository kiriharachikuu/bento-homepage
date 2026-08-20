/**
 * KV 存储抽象层
 *
 * 支持两种底层存储，自动检测优先级：
 *   1. EdgeOne KV（运行时变量 CMS_KV 存在时）- 毫秒级读写，原生支持
 *   2. 腾讯云 COS（环境变量 COS_SECRET_ID/KEY 齐全时）  - 约 50-200ms，对象存储模拟 KV
 *
 * 两种模式对外接口完全一致：
 *   - getStorage(context)  / assertStorage(context)  获取存储句柄
 *   - kvGetJson(storage, key)   读取 JSON
 *   - kvPutJson(storage, key, value)   写入 JSON
 *   - kvDelete(storage, key)   删除
 *
 * 存储句柄是一个不透明对象，调用方不感知底层类型。
 * KV 模式下句柄 = EdgeOne KV 绑定对象；COS 模式下句柄 = { type: 'cos', config, prefix }
 */
import { AppError } from './response.js';
import { getCosConfig, cosGetText, cosPutText, cosDeleteObject } from './cos.js';

/** COS 模式下所有 CMS 数据的对象前缀（避免与桶内 uploads/ 等业务数据混淆） */
const COS_PREFIX = 'cms/';

/**
 * 检测当前可用存储
 * @param {object} [context] EdgeOne 函数上下文（用于读环境变量）
 * @returns {{type: string, handle: object}|null} 可用存储句柄，都不可用时返回 null
 */
export function getStorage(context) {
  // 1. 优先 EdgeOne KV
  if (typeof CMS_KV !== 'undefined' && CMS_KV) {
    return { type: 'eo_kv', handle: CMS_KV };
  }
  // 2. 降级 COS
  const cosConfig = getCosConfig(context && context.env);
  if (cosConfig) {
    return { type: 'cos', handle: cosConfig };
  }
  return null;
}

/**
 * 获取当前可用存储句柄，不可用时抛出业务异常
 * @param {object} [context]
 * @returns {{type: string, handle: object}}
 */
export function assertStorage(context) {
  const s = getStorage(context);
  if (s === null) {
    throw new AppError(
      500,
      'NO_STORAGE',
      '未配置可用存储：请在 EdgeOne Pages 控制台开通 KV 存储并以运行时变量名 CMS_KV 绑定，或配置 COS_SECRET_ID / COS_SECRET_KEY 环境变量使用 COS 作为存储'
    );
  }
  return s;
}

/* ---------- 兼容旧 API：getKV / assertKV（所有调用方仍是旧命名） ---------- */

/**
 * 获取存储句柄（旧命名兼容）
 * 说明：原实现返回 EdgeOne KV 绑定对象；现返回 { type, handle } 不透明句柄。
 * 因 kvGetJson/kvPutJson/kvDelete 的签名都是 (kv, key, ...)，调用方把句柄透传即可，
 * 无需感知内部结构。
 * @param {object} [context]
 * @returns {{type: string, handle: object}|null}
 */
export function getKV(context) {
  return getStorage(context);
}

/**
 * 获取存储句柄，失败抛错（旧命名兼容）
 * @param {object} [context]
 * @returns {{type: string, handle: object}}
 */
export function assertKV(context) {
  return assertStorage(context);
}

/* ---------- 核心读写接口 ---------- */

/**
 * 读取 JSON 值（key 不存在时返回 null）
 * @param {{type: string, handle: object}} storage getStorage 返回的句柄
 * @param {string} key
 * @returns {Promise<*>}
 */
export async function kvGetJson(storage, key) {
  if (!storage || !storage.handle) return null;

  if (storage.type === 'eo_kv') {
    return storage.handle.get(key, { type: 'json' });
  }

  if (storage.type === 'cos') {
    const text = await cosGetText(storage.handle, COS_PREFIX + key);
    if (text === null) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * 写入 JSON 值
 * @param {{type: string, handle: object}} storage
 * @param {string} key
 * @param {*} value
 */
export async function kvPutJson(storage, key, value) {
  if (!storage || !storage.handle) return;

  const body = JSON.stringify(value);

  if (storage.type === 'eo_kv') {
    await storage.handle.put(key, body);
    return;
  }

  if (storage.type === 'cos') {
    await cosPutText(storage.handle, COS_PREFIX + key, body);
  }
}

/**
 * 删除指定 key
 * @param {{type: string, handle: object}} storage
 * @param {string} key
 */
export async function kvDelete(storage, key) {
  if (!storage || !storage.handle) return;

  if (storage.type === 'eo_kv') {
    await storage.handle.delete(key);
    return;
  }

  if (storage.type === 'cos') {
    await cosDeleteObject(storage.handle, COS_PREFIX + key);
  }
}
