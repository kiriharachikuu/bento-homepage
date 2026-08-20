/**
 * KV 存储访问工具
 * EdgeOne Pages 中 KV 通过项目绑定的运行时变量名（CMS_KV）作为全局变量访问
 */
import { AppError } from './response.js';

/**
 * 获取 KV 绑定对象（未绑定时返回 null）
 * @returns {object|null}
 */
export function getKV() {
  // CMS_KV 是 EdgeOne Pages 注入的全局变量，未绑定时不存在
  return typeof CMS_KV === 'undefined' ? null : CMS_KV;
}

/**
 * 获取 KV 绑定对象，未绑定时抛出业务异常
 * @returns {object}
 */
export function assertKV() {
  const kv = getKV();
  if (kv === null) {
    throw new AppError(
      500,
      'KV_NOT_BOUND',
      '请先在 EdgeOne Pages 控制台开通 KV 存储、创建命名空间并以运行时变量名 CMS_KV 绑定到本项目'
    );
  }
  return kv;
}

/**
 * 读取 JSON 值（key 不存在或未绑定 KV 时返回 null）
 * @param {object} kv KV 绑定对象
 * @param {string} key
 * @returns {Promise<*>}
 */
export async function kvGetJson(kv, key) {
  if (!kv) return null;
  return kv.get(key, { type: 'json' });
}

/**
 * 写入 JSON 值
 * @param {object} kv KV 绑定对象
 * @param {string} key
 * @param {*} value
 */
export async function kvPutJson(kv, key, value) {
  await kv.put(key, JSON.stringify(value));
}

/**
 * 删除指定 key
 * @param {object} kv KV 绑定对象
 * @param {string} key
 */
export async function kvDelete(kv, key) {
  await kv.delete(key);
}
