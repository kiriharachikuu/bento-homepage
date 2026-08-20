/**
 * 版本管理：保存配置快照、支持回滚
 */
import { randomHex } from './crypto.js';
import { kvGetJson, kvPutJson, kvDelete } from './kv.js';
import { AppError } from './response.js';

/** 纳入版本管理的 KV key 列表 */
export const VERSION_KEYS = ['site_config', 'videos', 'video_overrides'];

/** 版本数量上限：超过后淘汰最旧的版本 */
export const VERSION_LIMIT = 50;

/** 版本数据 key 前缀 */
const VERSION_KEY_PREFIX = 'version_';

/** 版本索引 key（存储版本元数据数组，新的在前） */
const VERSION_INDEX_KEY = 'version_index';

/**
 * 创建版本快照：保存当前所有受管模块的数据
 * @param {object} kv KV 绑定对象
 * @param {object} params
 * @param {string} params.username 操作人
 * @param {string} [params.note=''] 版本备注
 * @param {string[]} [params.modules=[]] 本次变更涉及的模块
 * @returns {Promise<{id: string, ts: number, author: string, note: string, modules: string[]}>} 版本元数据
 */
export async function createVersion(kv, { username, note = '', modules = [] }) {
  // id 形如 1787130000000_a1b2c3d4（仅含字母数字下划线，符合 KV key 规范）
  const id = Date.now() + '_' + randomHex(4);

  // 快照：逐个读取受管模块的当前值（不存在时为 null）
  const data = {};
  for (const key of VERSION_KEYS) {
    data[key] = await kvGetJson(kv, key);
  }

  const ts = Date.now();
  await kvPutJson(kv, VERSION_KEY_PREFIX + id, {
    id,
    ts,
    author: username,
    note,
    modules,
    data
  });

  // 更新索引：新的在前，超出上限淘汰最旧的版本（同时删除对应快照数据）
  const index = (await kvGetJson(kv, VERSION_INDEX_KEY)) || [];
  index.unshift({ id, ts, author: username, note, modules });
  if (index.length > VERSION_LIMIT) {
    const evicted = index.splice(VERSION_LIMIT);
    for (const item of evicted) {
      await kvDelete(kv, VERSION_KEY_PREFIX + item.id);
    }
  }
  await kvPutJson(kv, VERSION_INDEX_KEY, index);

  // 返回版本元数据（不含快照数据）
  return { id, ts, author: username, note, modules };
}

/**
 * 获取版本列表（新的在前）
 * @param {object} kv KV 绑定对象
 * @returns {Promise<Array>} 版本元数据数组
 */
export async function getVersionList(kv) {
  return (await kvGetJson(kv, VERSION_INDEX_KEY)) || [];
}

/**
 * 获取版本详情（含快照数据）
 * @param {object} kv KV 绑定对象
 * @param {string} id 版本 id
 * @returns {Promise<object>} 版本详情
 */
export async function getVersionDetail(kv, id) {
  const version = await kvGetJson(kv, VERSION_KEY_PREFIX + id);
  if (!version) {
    throw new AppError(404, 'VERSION_NOT_FOUND', '版本不存在');
  }
  return version;
}

/**
 * 回滚到指定版本：将快照数据写回 KV，并生成一个新版本记录本次回滚
 * @param {object} kv KV 绑定对象
 * @param {string} id 目标版本 id
 * @param {object} params
 * @param {string} params.username 操作人
 * @returns {Promise<object>} 回滚后生成的新版本元数据
 */
export async function rollbackToVersion(kv, id, { username }) {
  const version = await getVersionDetail(kv, id);

  // 将快照中每个模块的值写回 KV（值为 null 时删除该 key）
  for (const key of VERSION_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(version.data || {}, key)) {
      continue;
    }
    const value = version.data[key];
    if (value === null || value === undefined) {
      await kvDelete(kv, key);
    } else {
      await kvPutJson(kv, key, value);
    }
  }

  // 回滚本身也创建新版本，便于后续再次回滚
  return createVersion(kv, {
    username,
    note: '回滚到版本 ' + id,
    modules: ['rollback']
  });
}
