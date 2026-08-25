/**
 * B 站视频同步引擎
 * 数据获取容错链（依次尝试，任一成功即用）：
 *   1. bilibili_wbi     -- B 站 wbi 签名接口（x/space/wbi/arc/search）
 *   2. bilibili_legacy  -- B 站旧接口（x/space/arc/search）
 *   3. rsshub           -- RSSHub 公共实例（逐个尝试）
 */
import { md5Hex, hmacSha256Hex } from './crypto.js';
import { kvPutJson } from './kv.js';
import { LOG_ACTIONS, writeLog } from './logger.js';
import { createVersion } from './version.js';
import { getSiteConfig, getVideoData, saveVideoData } from './videos.js';
import { cacheVideoCovers } from './coverCache.js';

/** 浏览器 UA：请求 B 站与 RSSHub 时伪装为浏览器 */
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** 单次外部请求超时时间（毫秒） */
const FETCH_TIMEOUT_MS = 15000;

/** wbi 签名：mixinKey 打乱表（官方固定值） */
const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
  37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
  22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52
];

/** RSSHub 公共实例基址（依次尝试） */
const RSSHUB_BASES = ['https://rsshub.app', 'https://rsshub.rssforever.com'];

/** wbi 接口风控重试：总尝试次数与重试间隔（B 站风控为概率判定，间隔重试可显著提高成功率） */
const WBI_RETRY_MAX = 4;
const WBI_RETRY_DELAY_MS = 2000;

/** 睡眠工具 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 同步数量允许范围 */
const MIN_COUNT = 5;
const MAX_COUNT = 100;

/* ---------------------------------------------------------------- */
/* 基础工具                                                          */
/* ---------------------------------------------------------------- */

/**
 * 从任意字符串（通常是视频链接）中提取 BV 号
 * @param {string} url
 * @returns {string|null} BV 号（形如 BV1xx411c7mD），未匹配返回 null
 */
export function extractBvid(url) {
  const matched = /(BV[0-9A-Za-z]{10})/.exec(String(url || ''));
  return matched ? matched[1] : null;
}

/**
 * 归一化 Cookie 字符串：从任意格式（DevTools 表格、Netscape、JSON、标准 key=value）
 * 中提取 cookie 键值对，统一输出为 key=value; key2=value2 格式。
 * 作为后端的双重保障，防止前端保存的 cookie 格式异常导致 B 站接口失败。
 * @param {string} raw 原始 cookie 字符串
 * @returns {string} 标准化后的 cookie 字符串
 */
function normalizeCookie(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';

  const pairs = new Map();

  // 1. JSON 数组 [{name, value}, ...]
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr)) {
        for (const item of arr) {
          if (item && typeof item === 'object') {
            const name = String(item.name || '').trim();
            const value = String(item.value !== undefined ? item.value : '');
            if (name) pairs.set(name, value);
          }
        }
        if (pairs.size > 0) return [...pairs.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
      }
    } catch { /* 不是 JSON，继续 */ }
  }

  // 2. JSON 对象
  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        for (const [k, v] of Object.entries(obj)) {
          pairs.set(k, String(v));
        }
        if (pairs.size > 0) return [...pairs.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
      }
    } catch { /* 不是 JSON，继续 */ }
  }

  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // 3. Netscape 格式
  const isNetscape = lines.some((l) => l.startsWith('# Netscape') || l.startsWith('# HTTP Cookie'));
  if (isNetscape) {
    for (const line of lines) {
      if (line.startsWith('#') || !line) continue;
      const cols = line.split('\t');
      if (cols.length >= 7) {
        const name = cols[5].trim();
        const value = cols[6].trim();
        if (name) pairs.set(name, value);
      }
    }
    if (pairs.size > 0) return [...pairs.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  // 4. DevTools 表格格式（Tab 分隔多列）
  const hasTabColumns = lines.length > 0 && lines.every((l) => l.includes('\t'));
  if (hasTabColumns) {
    let found = false;
    for (const line of lines) {
      const cols = line.split('\t').map((c) => c.trim());
      if (cols.length < 2) continue;
      const name = cols[0];
      const value = cols[1];
      if (/^(name|名称|名字|cookie名|键)$/i.test(name) && /^(value|值|内容|cookie值)$/i.test(value)) continue;
      if (!name || name.includes('=') || /\s/.test(name)) continue;
      pairs.set(name, value);
      found = true;
    }
    if (found) return [...pairs.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  // 5. 标准 key=value; 格式或每行一个
  for (const line of lines) {
    if (line.startsWith('#') || line.startsWith('//')) continue;
    const parts = line.split(';');
    for (const part of parts) {
      const trimmedPart = part.trim();
      if (!trimmedPart) continue;
      const eqIndex = trimmedPart.indexOf('=');
      if (eqIndex <= 0) continue;
      const name = trimmedPart.slice(0, eqIndex).trim();
      const value = trimmedPart.slice(eqIndex + 1).trim();
      if (!name || /\s/.test(name)) continue;
      pairs.set(name, value);
    }
  }

  if (pairs.size > 0) {
    return [...pairs.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
  return trimmed;
}

/**
 * 带超时的 fetch（AbortController + setTimeout，兼容性最好）
 * @param {string} url
 * @param {object} [options] fetch 配置
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    // 中止（超时）时给出更直观的错误信息
    if (err && err.name === 'AbortError') {
      throw new Error(`请求超时（${FETCH_TIMEOUT_MS / 1000}秒）`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 请求并解析 JSON（HTTP 非 2xx、返回非 JSON（风控挑战页）或解析失败时抛异常）
 * @param {string} url
 * @param {object} headers 请求头
 * @returns {Promise<*>}
 */
async function fetchJson(url, headers) {
  const res = await fetchWithTimeout(url, { headers });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();
  if (!contentType.includes('json')) {
    throw new Error(`响应非 JSON（${contentType || '未知类型'}，疑似风控挑战页）`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('响应非 JSON（解析失败）');
  }
}

/**
 * 把时间戳统一为毫秒（10 位及以下视为秒级，转为毫秒；非法值返回 null）
 * @param {*} value
 * @returns {number|null}
 */
function normalizeTimestamp(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num < 1e11 ? num * 1000 : num;
}

/**
 * 规范化封面地址：空值返回 ''；协议相对地址（以 // 开头）补全 https:
 * @param {*} cover
 * @returns {string}
 */
function normalizeCover(cover) {
  const value = String(cover || '').trim();
  if (!value) return '';
  if (value.startsWith('//')) return 'https:' + value;
  return value;
}

/**
 * 统一构造同步视频条目（vlist 与 RSS 条目共用）
 * @param {object} fields { bvid, title, description, cover, pubdate }
 * @returns {object}
 */
function buildSyncItem({ bvid, title, description, cover, pubdate }) {
  return {
    bvid,
    title: String(title || '').slice(0, 200),
    description: String(description || '').slice(0, 500),
    cover: normalizeCover(cover),
    url: `https://www.bilibili.com/video/${bvid}/`,
    pubdate,
    source: 'sync'
  };
}

/* ---------------------------------------------------------------- */
/* 源 1：B 站 wbi 签名接口                                            */
/* ---------------------------------------------------------------- */

/**
 * 从 wbi 图片地址中提取 key（文件名去掉扩展名）
 * 形如 https://i0.hdslb.com/bfs/wbi/<key>.png
 * @param {string} url
 * @returns {string} 提取失败返回 ''
 */
function keyFromImgUrl(url) {
  const matched = /\/([^/]+)\.[^/]+$/.exec(String(url || ''));
  return matched ? matched[1] : '';
}

/**
 * 构建 B 站访问身份：buvid 指纹 cookie + bili_ticket 访问令牌 + wbi keys
 * B 站空间接口对无 cookie 的服务端请求有风控（HTTP 412 / code -352 / -799），
 * 带上 buvid3/buvid4/bili_ticket 可大幅降低拦截概率。
 * 各环节独立容错：指纹或令牌获取失败不阻断，仅降低通过率。
 * @returns {Promise<{cookie: string, imgKey: string, subKey: string}>}
 */
async function fetchBiliSession() {
  const cookieParts = [];

  // 1. buvid：finger/spi 接口返回指纹 cookie 值（失败不阻断）
  try {
    const spi = await fetchJson('https://api.bilibili.com/x/frontend/finger/spi', {
      'user-agent': BROWSER_UA,
      referer: 'https://www.bilibili.com/'
    });
    if (spi && spi.data && spi.data.b_3) cookieParts.push(`buvid3=${spi.data.b_3}`);
    if (spi && spi.data && spi.data.b_4) cookieParts.push(`buvid4=${spi.data.b_4}`);
  } catch {
    /* 指纹接口失败：继续无 buvid 请求 */
  }

  // 2. bili_ticket：HMAC-SHA256 签名换取 3 天有效访问令牌（失败不阻断）
  //    响应中的 nav.img / nav.sub 同时就是 wbi keys，可省一次 nav 请求
  let imgKey = '';
  let subKey = '';
  try {
    const ts = Math.floor(Date.now() / 1000);
    const hexsign = await hmacSha256Hex('XgwSnGZ1p', `ts${ts}`);
    const ticket = await fetchJson(
      'https://api.bilibili.com/bapis/bilibili.api.ticket.v1.Ticket/GenWebTicket' +
        `?key_id=ec02&hexsign=${hexsign}&context[ts]=${ts}&csrf=`,
      { 'user-agent': BROWSER_UA, referer: 'https://www.bilibili.com/' }
    );
    const data = ticket && ticket.data;
    if (data && data.ticket && data.nav) {
      cookieParts.push(`bili_ticket=${data.ticket}`);
      if (data.created_at && data.ttl) {
        cookieParts.push(`bili_ticket_expires=${data.created_at + data.ttl}`);
      }
      imgKey = keyFromImgUrl(data.nav.img);
      subKey = keyFromImgUrl(data.nav.sub);
    }
  } catch {
    /* 令牌接口失败：继续无 ticket 请求 */
  }

  // 3. wbi keys 兜底：nav 接口（ticket 获取失败时）
  if (!imgKey || !subKey) {
    const nav = await fetchJson('https://api.bilibili.com/x/web-interface/nav', {
      'user-agent': BROWSER_UA,
      referer: 'https://www.bilibili.com/'
    });
    const wbiImg = nav && nav.data && nav.data.wbi_img;
    imgKey = wbiImg ? keyFromImgUrl(wbiImg.img_url) : '';
    subKey = wbiImg ? keyFromImgUrl(wbiImg.sub_url) : '';
    if (!imgKey || !subKey) {
      throw new Error('nav 接口未返回有效的 wbi keys');
    }
  }

  return { cookie: cookieParts.join('; '), imgKey, subKey };
}

/**
 * 用 mixinKey 打乱表计算签名密钥
 * @param {string} imgKey
 * @param {string} subKey
 * @returns {string} 32 位 mixinKey
 */
function getMixinKey(imgKey, subKey) {
  const raw = imgKey + subKey;
  return MIXIN_KEY_ENC_TAB.map((n) => raw[n]).join('').slice(0, 32);
}

/**
 * 构造 wbi 签名用的 query 串：
 * 1. 参数值过滤：删除 !'()* 字符
 * 2. 按 key 字典序排序
 * 3. 标准 URLSearchParams 编码拼接为 k=v&k=v
 * @param {object} params
 * @returns {string}
 */
function buildSortedQuery(params) {
  const filtered = {};
  for (const [key, value] of Object.entries(params)) {
    filtered[key] = String(value).replace(/[!'()*]/g, '');
  }
  const search = new URLSearchParams();
  for (const key of Object.keys(filtered).sort()) {
    search.append(key, filtered[key]);
  }
  return search.toString();
}

/**
 * 校验 B 站接口响应并提取视频列表原始数据
 * @param {*} payload 响应 JSON
 * @returns {Array} vlist 数组
 */
function extractVlist(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('响应不是合法的 JSON 对象');
  }
  if (payload.code !== 0) {
    throw new Error(`B站接口错误码 ${payload.code}${payload.message ? `（${payload.message}）` : ''}`);
  }
  const vlist = payload.data && payload.data.list && payload.data.list.vlist;
  if (!Array.isArray(vlist)) {
    throw new Error('响应中缺少视频列表字段');
  }
  return vlist;
}

/**
 * vlist 条目规范化（单条字段异常跳过该条，返回 null）
 * @param {*} item
 * @returns {object|null}
 */
function normalizeVlistItem(item) {
  if (!item || typeof item !== 'object') return null;
  const bvid = String(item.bvid || '');
  const title = String(item.title || '');
  // 缺 bvid / title 的条目跳过
  if (!bvid || !title) return null;
  return buildSyncItem({
    bvid,
    title,
    description: item.description,
    cover: item.pic,
    // created 为秒级时间戳，统一转为毫秒
    pubdate: normalizeTimestamp(item.created)
  });
}

/**
 * 判断错误是否为 B 站风控类错误（可间隔重试）
 * @param {*} err
 * @returns {boolean}
 */
function isRiskControlError(err) {
  const message = String((err && err.message) || err);
  return /HTTP 412|-412|-352|-799|风控|请求过于频繁|响应非 JSON/.test(message);
}

/**
 * 源 1：wbi 签名接口获取视频列表（带身份 cookie 与风控重试）
 * @param {string} mid
 * @param {number} maxCount
 * @param {object} session fetchBiliSession 的返回值
 * @returns {Promise<Array>} 规范化后的条目列表（可能为空数组）
 */
async function fetchFromWbi(mid, maxCount, session) {
  if (!session.imgKey || !session.subKey) {
    throw new Error('无有效 wbi keys');
  }
  const mixinKey = getMixinKey(session.imgKey, session.subKey);

  const params = {
    mid,
    pn: '1',
    ps: String(maxCount),
    order: 'pubdate',
    platform: 'web',
    web_location: '1550101',
    wts: String(Math.floor(Date.now() / 1000))
  };
  const query = buildSortedQuery(params);
  const wRid = md5Hex(query + mixinKey);

  const headers = {
    'user-agent': BROWSER_UA,
    referer: `https://space.bilibili.com/${mid}/upload/video`,
    accept: 'application/json, text/plain, */*',
    'accept-language': 'zh-CN,zh;q=0.9'
  };
  if (session.cookie) {
    headers.cookie = session.cookie;
  }

  // B 站风控为概率判定：间隔重试提高成功率；非风控错误（结构变化等）直接抛出
  let lastError = null;
  for (let attempt = 1; attempt <= WBI_RETRY_MAX; attempt++) {
    if (attempt > 1) {
      await sleep(WBI_RETRY_DELAY_MS);
    }
    try {
      const payload = await fetchJson(
        `https://api.bilibili.com/x/space/wbi/arc/search?${query}&w_rid=${wRid}`,
        headers
      );
      return extractVlist(payload)
        .map(normalizeVlistItem)
        .filter(Boolean);
    } catch (err) {
      lastError = err;
      if (!isRiskControlError(err)) {
        throw err;
      }
    }
  }
  throw lastError;
}

/**
 * 源 2：旧接口获取视频列表（带身份 cookie，单次尝试）
 * @param {string} mid
 * @param {number} maxCount
 * @param {object} session fetchBiliSession 的返回值
 * @returns {Promise<Array>} 规范化后的条目列表（可能为空数组）
 */
async function fetchFromLegacy(mid, maxCount, session) {
  const headers = {
    'user-agent': BROWSER_UA,
    referer: `https://space.bilibili.com/${mid}/upload/video`,
    accept: 'application/json, text/plain, */*',
    'accept-language': 'zh-CN,zh;q=0.9'
  };
  if (session.cookie) {
    headers.cookie = session.cookie;
  }
  const payload = await fetchJson(
    `https://api.bilibili.com/x/space/arc/search?mid=${mid}&pn=1&ps=${maxCount}&order=pubdate`,
    headers
  );
  return extractVlist(payload)
    .map(normalizeVlistItem)
    .filter(Boolean);
}
/* ---------------------------------------------------------------- */
/* 源 3：RSSHub 公共实例                                              */
/* ---------------------------------------------------------------- */

/**
 * 提取 RSS 块中指定标签的文本（兼容 CDATA 与普通文本两种写法）
 * @param {string} block 单个 <item> 块内容
 * @param {string} tag 标签名
 * @returns {string} 未找到返回 ''
 */
function extractTag(block, tag) {
  const cdata = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i').exec(block);
  if (cdata) return cdata[1];
  const plain = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(block);
  return plain ? plain[1] : '';
}

/**
 * 码点转字符（超出 Unicode 范围时返回空串）
 * @param {number} code
 * @returns {string}
 */
function safeFromCodePoint(code) {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

/**
 * 解码常见 HTML 实体（&amp; 必须最后解码，避免二次解码）
 * @param {string} str
 * @returns {string}
 */
function decodeHtmlEntities(str) {
  return String(str)
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => safeFromCodePoint(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&amp;/g, '&');
}

/**
 * 去掉字符串中的 HTML 标签
 * @param {string} str
 * @returns {string}
 */
function stripHtmlTags(str) {
  return String(str).replace(/<[^>]*>/g, '');
}

/**
 * 单个 RSS item 块规范化（无 bvid 或无 title 的条目跳过，返回 null）
 * @param {string} block
 * @returns {object|null}
 */
function normalizeRssItem(block) {
  // 从 link 中提取 BV 号
  const bvid = extractBvid(extractTag(block, 'link'));
  if (!bvid) return null;

  const title = decodeHtmlEntities(extractTag(block, 'title')).trim();
  if (!title) return null;

  // description：提取第一张图作为封面；去标签后截断 100 字符作为简介
  const decodedDescription = decodeHtmlEntities(extractTag(block, 'description'));
  const imgMatched = /<img[^>]+src="([^"]+)"/i.exec(decodedDescription);
  const description = stripHtmlTags(decodedDescription).trim().slice(0, 100);

  // pubDate：解析失败用 null（Date.parse 返回毫秒时间戳）
  const pubDateText = extractTag(block, 'pubDate').trim();
  const parsed = pubDateText ? Date.parse(pubDateText) : NaN;

  return buildSyncItem({
    bvid,
    title,
    description,
    cover: imgMatched ? imgMatched[1] : '',
    pubdate: Number.isFinite(parsed) ? parsed : null
  });
}

/**
 * 解析 RSS XML，返回规范化条目列表
 * @param {string} xml
 * @returns {Array}
 */
function parseRssItems(xml) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let matched;
  while ((matched = itemRe.exec(xml)) !== null) {
    const item = normalizeRssItem(matched[1]);
    if (item) items.push(item);
  }
  return items;
}

/**
 * 源 3：RSSHub 公共实例获取视频列表（逐个实例尝试）
 * @param {string} mid
 * @returns {Promise<Array>} 规范化后的条目列表（可能为空数组）
 */
async function fetchFromRsshub(mid) {
  const errors = [];
  for (const base of RSSHUB_BASES) {
    try {
      const res = await fetchWithTimeout(`${base}/bilibili/user/video/${mid}`, {
        headers: { 'user-agent': BROWSER_UA }
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const items = parseRssItems(await res.text());
      if (items.length === 0) {
        throw new Error('RSS 中无有效视频条目');
      }
      return items;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${base.replace(/^https?:\/\//, '')} ${message}`);
    }
  }
  throw new Error(errors.join('；'));
}

/* ---------------------------------------------------------------- */
/* 同步主流程                                                        */
/* ---------------------------------------------------------------- */

/**
 * 同步 B 站视频：依次尝试三个数据源，成功则更新 KV 中的 synced 列表与同步状态
 * 全部失败时保留原视频数据不动，仅记录失败状态
 * @param {object} kv KV 绑定对象
 * @param {object} [options]
 * @param {string} [options.username='unknown'] 操作人（写入操作日志）
 * @param {string} [options.ip='unknown'] 客户端 IP
 * @param {string} [options.trigger='manual'] 触发方式（manual / cron）
 * @returns {Promise<{ok: boolean, syncState: object, error?: string}>}
 */
export async function syncBilibiliVideos(context, kv, { username = 'unknown', ip = 'unknown', trigger = 'manual' } = {}) {
  // 读取站点配置，确定 mid、同步数量上限、以及可选的自定义 Cookie
  const siteConfig = await getSiteConfig(kv);
  const mid = String((siteConfig && siteConfig.videoSync && siteConfig.videoSync.mid) || '28826850');
  let maxCount = Number(siteConfig && siteConfig.videoSync && siteConfig.videoSync.maxCount) || 30;
  if (maxCount < MIN_COUNT) maxCount = MIN_COUNT;
  if (maxCount > MAX_COUNT) maxCount = MAX_COUNT;
  // 自定义 Cookie：用户在后台粘贴的 SESSDATA 等登录态 cookie，可大幅降低风控概率
  const rawCookie = String(
    (siteConfig && siteConfig.videoSync && siteConfig.videoSync.biliCookie) || ''
  ).trim();
  // 归一化 cookie 格式（确保是 key=value; 标准格式，防止粘贴的非标准格式导致 B 站接口失败）
  const customCookie = normalizeCookie(rawCookie);

  // 构建 B 站访问身份（两个 B 站源共用；完全失败时退化为无 cookie 请求）
  // 有自定义 Cookie 时直接使用，不再自动获取 buvid/ticket（登录态 cookie 本身已含完整身份）
  let session = { cookie: '', imgKey: '', subKey: '' };
  if (customCookie) {
    session = { cookie: customCookie, imgKey: '', subKey: '' };
    // 登录态下也需要 wbi key 来算签名，单独取一次
    try {
      const nav = await fetchJson('https://api.bilibili.com/x/web-interface/nav', {
        'user-agent': BROWSER_UA,
        referer: 'https://www.bilibili.com/',
        cookie: customCookie
      });
      const wbiImg = nav && nav.data && nav.data.wbi_img;
      if (wbiImg) {
        session.imgKey = keyFromImgUrl(wbiImg.img_url);
        session.subKey = keyFromImgUrl(wbiImg.sub_url);
      }
    } catch {
      /* nav 失败不阻断——wbi 源拿不到 key 就跳过，走旧接口或 RSSHub */
    }
  } else {
    try {
      session = await fetchBiliSession();
    } catch {
      /* 身份构建失败：继续用空身份请求 */
    }
  }

  // 依次尝试三个数据源，任一成功即用；记录每次失败原因（源名 + 错误信息）
  const sources = [
    { name: 'bilibili_wbi', fetch: () => fetchFromWbi(mid, maxCount, session) },
    { name: 'bilibili_legacy', fetch: () => fetchFromLegacy(mid, maxCount, session) },
    { name: 'rsshub', fetch: () => fetchFromRsshub(mid) }
  ];
  const failures = [];
  let list = null;
  let usedSource = null;
  for (const source of sources) {
    try {
      const result = await source.fetch();
      // 整体列表为空数组视为该源失败
      if (!Array.isArray(result) || result.length === 0) {
        throw new Error('获取到的视频列表为空');
      }
      list = result;
      usedSource = source.name;
      break;
    } catch (err) {
      const message = String(err instanceof Error ? err.message : err).slice(0, 200);
      failures.push(`${source.name}: ${message}`);
    }
  }

  // 成功：更新 synced 列表与同步状态
  if (list) {
    const videoData = await getVideoData(kv);
    videoData.synced = list.slice(0, maxCount);

    // 封面转存到 COS（失败不阻断同步，仅记录）
    let coverCacheResult = null;
    try {
      coverCacheResult = await cacheVideoCovers(videoData.synced, context);
    } catch (coverErr) {
      console.warn('[bilibili sync] 封面转存失败：', coverErr.message);
    }

    videoData.updatedAt = Date.now();
    await saveVideoData(kv, videoData);

    // 同步结果纳入版本管理：脏数据可通过版本历史回滚到同步前的列表
    await createVersion(kv, {
      username,
      note: `视频同步（${usedSource}，${videoData.synced.length}条）`,
      modules: ['videos']
    });

    const syncState = {
      lastSyncAt: Date.now(),
      lastStatus: 'success',
      lastError: null,
      itemCount: videoData.synced.length,
      source: usedSource
    };
    await kvPutJson(kv, 'sync_state', syncState);

    await writeLog(kv, {
      username,
      action: LOG_ACTIONS.VIDEO_SYNC,
      target: mid,
      summary: `同步成功（${usedSource}，${syncState.itemCount}条）`,
      ip
    });
    return { ok: true, syncState };
  }

  // 全部失败：记录失败状态与日志，保留原视频数据不动
  const lastError = failures.join('\n');
  const syncState = {
    lastSyncAt: Date.now(),
    lastStatus: 'error',
    lastError,
    itemCount: 0,
    source: null
  };
  await kvPutJson(kv, 'sync_state', syncState);

  await writeLog(kv, {
    username,
    action: LOG_ACTIONS.VIDEO_SYNC,
    target: mid,
    summary: `同步失败：${lastError}`,
    ip
  });
  return { ok: false, syncState, error: lastError };
}