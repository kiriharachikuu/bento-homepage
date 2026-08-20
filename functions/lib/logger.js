/**
 * 操作日志：记录后台关键操作，支持分页与按动作筛选
 */
import { randomHex } from './crypto.js';
import { kvGetJson, kvPutJson, kvDelete } from './kv.js';

/** 日志索引 key（存储所有日志 id 的数组，新的在前） */
const LOG_INDEX_KEY = 'log_index';

/** 日志索引上限：超过后淘汰最旧的日志 */
const LOG_INDEX_LIMIT = 500;

/** 日志 key 前缀 */
const LOG_KEY_PREFIX = 'log_';

/** 操作类型枚举 */
export const LOG_ACTIONS = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  SAVE_CONFIG: 'save_config',
  ROLLBACK: 'rollback',
  VIDEO_SYNC: 'video_sync',
  VIDEO_EDIT: 'video_edit',
  PASSWORD: 'password'
};

/**
 * 写入一条操作日志，并维护日志索引（上限 500 条）
 * @param {object} kv KV 绑定对象
 * @param {object} params
 * @param {string} params.username 操作人
 * @param {string} params.action 操作类型（LOG_ACTIONS 之一）
 * @param {string} [params.target=''] 操作对象
 * @param {string} [params.summary=''] 操作摘要
 * @param {string} [params.ip='unknown'] 客户端 IP
 * @returns {Promise<string>} 日志 id
 */
export async function writeLog(kv, { username, action, target = '', summary = '', ip = 'unknown' }) {
  // id 形如 1787130000000_a1b2c3d4（仅含字母数字下划线，符合 KV key 规范）
  const id = Date.now() + '_' + randomHex(4);
  const entry = {
    id,
    ts: Date.now(),
    username,
    action,
    target,
    summary,
    ip
  };
  await kvPutJson(kv, LOG_KEY_PREFIX + id, entry);

  // 维护索引：新的在前，超出上限淘汰最旧的（同时删除对应日志数据）
  const index = (await kvGetJson(kv, LOG_INDEX_KEY)) || [];
  index.unshift(id);
  if (index.length > LOG_INDEX_LIMIT) {
    const evicted = index.splice(LOG_INDEX_LIMIT);
    for (const oldId of evicted) {
      await kvDelete(kv, LOG_KEY_PREFIX + oldId);
    }
  }
  await kvPutJson(kv, LOG_INDEX_KEY, index);
  return id;
}

/**
 * 分页查询日志
 * @param {object} kv KV 绑定对象
 * @param {object} [options]
 * @param {number} [options.page=1] 页码（从 1 开始）
 * @param {number} [options.pageSize=20] 每页条数
 * @param {string} [options.action=''] 按操作类型筛选（空字符串为不过滤）
 * @returns {Promise<{total: number, page: number, pageSize: number, items: Array}>} items 按 ts 倒序
 */
export async function listLogs(kv, { page = 1, pageSize = 20, action = '' } = {}) {
  const index = (await kvGetJson(kv, LOG_INDEX_KEY)) || [];

  if (action) {
    // 有筛选时：逐条读取日志再过滤（索引上限 500 条，逐条读取可接受）
    const all = [];
    for (const id of index) {
      const entry = await kvGetJson(kv, LOG_KEY_PREFIX + id);
      if (entry && entry.action === action) {
        all.push(entry);
      }
    }
    // 索引本身按新在前排列，过滤后即为 ts 倒序
    const total = all.length;
    const start = (page - 1) * pageSize;
    return {
      total,
      page,
      pageSize,
      items: all.slice(start, start + pageSize)
    };
  }

  // 无筛选时：先按索引分页，再读取对应条目（跳过已丢失的条目）
  const total = index.length;
  const start = (page - 1) * pageSize;
  const pageIds = index.slice(start, start + pageSize);
  const items = [];
  for (const id of pageIds) {
    const entry = await kvGetJson(kv, LOG_KEY_PREFIX + id);
    if (entry) {
      items.push(entry);
    }
  }
  return { total, page, pageSize, items };
}
