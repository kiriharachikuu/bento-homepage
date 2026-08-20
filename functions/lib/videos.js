/**
 * 视频数据读写与展示列表合并
 */
import { kvGetJson, kvPutJson } from './kv.js';
import { DEFAULT_SITE_CONFIG, DEFAULT_VIDEOS, deepMergeConfig } from './defaultConfig.js';

/** 深拷贝工具（配置与默认数据都是可 JSON 序列化的纯数据） */
function deepCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * 读取视频数据（manual 手动添加 + synced 同步获取）
 * KV 中无数据时返回默认结构（manual 为默认视频的深拷贝）
 * @param {object} kv KV 绑定对象
 * @returns {Promise<{manual: Array, synced: Array, updatedAt: number|null}>}
 */
export async function getVideoData(kv) {
  const data = await kvGetJson(kv, 'videos');
  if (data === null) {
    return {
      manual: deepCopy(DEFAULT_VIDEOS),
      synced: [],
      updatedAt: null
    };
  }
  return data;
}

/**
 * 保存视频数据
 * @param {object} kv KV 绑定对象
 * @param {object} data 视频数据（{ manual, synced, updatedAt }）
 */
export async function saveVideoData(kv, data) {
  await kvPutJson(kv, 'videos', data);
}

/**
 * 读取同步视频的字段覆盖配置（key 为 bvid）
 * @param {object} kv KV 绑定对象
 * @returns {Promise<object>}
 */
export async function getOverrides(kv) {
  return (await kvGetJson(kv, 'video_overrides')) || {};
}

/**
 * 保存同步视频的字段覆盖配置
 * @param {object} kv KV 绑定对象
 * @param {object} overrides 覆盖配置对象
 */
export async function saveOverrides(kv, overrides) {
  await kvPutJson(kv, 'video_overrides', overrides);
}

/**
 * 读取视频同步状态
 * @param {object} kv KV 绑定对象
 * @returns {Promise<{lastSyncAt: number|null, lastStatus: string, lastError: string|null, itemCount: number, source: string|null}>}
 */
export async function getSyncState(kv) {
  return (
    (await kvGetJson(kv, 'sync_state')) || {
      lastSyncAt: null,
      lastStatus: 'never',
      lastError: null,
      itemCount: 0,
      source: null
    }
  );
}

/**
 * 合并展示列表
 * 规则：
 * 1. manual 条目直接使用自身字段（source: 'manual'）
 * 2. synced 条目查 overrides[bvid]，有则覆盖 title/description/cooperation/pinned/hidden 字段
 * 3. 过滤 hidden === true 的条目
 * 4. 排序：pinned 条目优先（组内保持原相对顺序），其余按时间戳降序（pubdate || createdAt || 0）
 * 5. 无时间戳的条目组内保持原数组顺序（manual 在前、synced 在后）
 * @param {object} videoData 视频数据（{ manual, synced }）
 * @param {object} overrides 字段覆盖配置
 * @returns {Array<{bvid: string, title: string, description: string, cover: string, url: string, cooperation: boolean, source: string, pinned: boolean}>}
 */
export function mergeVideoList(videoData, overrides) {
  const ov = overrides || {};
  const manualList =
    videoData && Array.isArray(videoData.manual) ? videoData.manual : [];
  const syncedList =
    videoData && Array.isArray(videoData.synced) ? videoData.synced : [];

  // 构造内部记录：manual 在前、synced 在后，记录原始序号用于稳定排序
  const records = [];
  manualList.forEach((item) => {
    records.push(buildRecord(item, 'manual', null, records.length));
  });
  syncedList.forEach((item) => {
    const override = item && item.bvid ? ov[item.bvid] : null;
    records.push(buildRecord(item, 'synced', override, records.length));
  });

  // 过滤 hidden 条目
  const visible = records.filter((r) => r.hidden !== true);

  // 排序：pinned 优先（组内保持原相对顺序），其余按时间戳降序，时间戳相同（含 0）保持原顺序
  visible.sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return a.pinned ? -1 : 1;
    }
    if (a.pinned) {
      return a.index - b.index;
    }
    if (a.ts !== b.ts) {
      return b.ts - a.ts;
    }
    return a.index - b.index;
  });

  // 输出为展示字段
  return visible.map((r) => ({
    bvid: r.bvid,
    title: r.title,
    description: r.description,
    cover: r.cover,
    url: r.url,
    cooperation: r.cooperation,
    source: r.source,
    pinned: r.pinned
  }));
}

/**
 * 构造排序用的内部记录
 * @param {object} item 视频条目
 * @param {string} source 来源（manual / synced）
 * @param {object|null} override 覆盖配置（仅 synced 条目有）
 * @param {number} index 原始序号
 */
function buildRecord(item, source, override, index) {
  const merged = { ...item };
  // synced 条目应用覆盖字段
  if (override) {
    for (const field of ['title', 'description', 'cooperation', 'pinned', 'hidden']) {
      if (override[field] !== undefined) {
        merged[field] = override[field];
      }
    }
  }
  return {
    bvid: merged.bvid,
    title: merged.title,
    description: merged.description,
    cover: merged.cover,
    url: merged.url,
    cooperation: merged.cooperation === true,
    source,
    pinned: merged.pinned === true,
    hidden: merged.hidden === true,
    // 时间戳：优先 pubdate，其次 createdAt，无则 0
    ts: merged.pubdate || merged.createdAt || 0,
    index
  };
}

/**
 * 读取站点配置：KV 无数据时返回默认配置，否则与默认配置深度合并
 * （保证新增字段有默认值）
 * @param {object} kv KV 绑定对象
 * @returns {Promise<object>}
 */
export async function getSiteConfig(kv) {
  const stored = await kvGetJson(kv, 'site_config');
  if (stored === null) {
    return deepCopy(DEFAULT_SITE_CONFIG);
  }
  return deepMergeConfig(DEFAULT_SITE_CONFIG, stored);
}

/**
 * 保存站点配置
 * @param {object} kv KV 绑定对象
 * @param {object} config 站点配置
 */
export async function saveSiteConfig(kv, config) {
  await kvPutJson(kv, 'site_config', config);
}
