/**
 * 腾讯云 COS XML API 签名库
 * 签名算法文档：https://cloud.tencent.com/document/product/436/7778
 *
 * 核心算法（与官方 SDK util.js getAuth 一致）：
 *   SignKey      = HMAC-SHA1(密钥=SecretKey, 消息=KeyTime) 的 hex
 *   HttpString   = 小写Method + '\n' + UriPathname + '\n' + HttpParameters + '\n' + HttpHeaders + '\n'
 *   StringToSign = 'sha1' + '\n' + KeyTime + '\n' + SHA1(HttpString) 的 hex + '\n'
 *   Signature    = HMAC-SHA1(密钥=SignKey(hex 字符串), 消息=StringToSign) 的 hex
 */
import { hmacSha1Hex, sha1Hex } from './crypto.js';
import { AppError } from './response.js';

/** 默认存储桶与地域（本项目使用 chikuu-1252656027 / ap-nanjing） */
const DEFAULT_BUCKET = 'chikuu-1252656027';
const DEFAULT_REGION = 'ap-nanjing';

/**
 * 读取 COS 配置（从 EdgeOne Pages 环境变量）
 * @param {object} env context.env
 * @returns {{secretId: string, secretKey: string, bucket: string, region: string}|null}
 *          SecretId 或 SecretKey 缺失时返回 null
 */
export function getCosConfig(env) {
  const secretId = String(env?.COS_SECRET_ID || '').trim();
  const secretKey = String(env?.COS_SECRET_KEY || '').trim();
  if (!secretId || !secretKey) return null;
  return {
    secretId,
    secretKey,
    bucket: String(env?.COS_BUCKET || '').trim() || DEFAULT_BUCKET,
    region: String(env?.COS_REGION || '').trim() || DEFAULT_REGION
  };
}

/**
 * COS 规范的 URL 编码：在 encodeURIComponent 基础上额外编码 ! ' ( ) *
 * @param {string} str
 * @returns {string}
 */
function camSafeUrlEncode(str) {
  return encodeURIComponent(String(str))
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');
}

/**
 * 对象 key 编码为 URL 路径（保留路径分隔符 /）
 * @param {string} key
 * @returns {string}
 */
export function encodeUriPath(key) {
  return camSafeUrlEncode(key).replace(/%2F/g, '/');
}

/**
 * 存储桶访问域名，如 chikuu-1252656027.cos.ap-nanjing.myqcloud.com
 * @param {object} config getCosConfig 返回的配置
 * @returns {string}
 */
function cosHost(config) {
  return `${config.bucket}.cos.${config.region}.myqcloud.com`;
}

/**
 * 对象的公开访问地址（不附带签名，直接拼接）
 * @param {string} key 对象键，如 uploads/xxx.png
 * @param {object} config getCosConfig 返回的配置
 * @returns {string}
 */
export function publicUrl(key, config) {
  return `https://${cosHost(config)}/${encodeUriPath(key)}`;
}

/**
 * 将参与签名的参数/头部对象规范化为 [编码后小写key, 编码后value] 数组，按 key 字典序排序
 * @param {object} obj
 * @returns {Array<[string, string]>}
 */
function normalizeSignEntries(obj) {
  return Object.entries(obj || {})
    .map(([k, v]) => [
      camSafeUrlEncode(k).toLowerCase(),
      camSafeUrlEncode(v === undefined || v === null ? '' : String(v))
    ])
    .sort((a, b) => (a[0] === b[0] ? 0 : a[0] > b[0] ? 1 : -1));
}

/**
 * 计算签名核心：返回 Authorization / 预签名 URL 共用的签名字段拼串
 * @param {object} options
 * @param {string} options.method HTTP 方法（大小写不敏感）
 * @param {string} options.pathname 请求路径（未编码的原始路径，如 '/' 或 '/uploads/a.png'）
 * @param {object} [options.params] 参与签名的 url 参数（空对象表示不签任何参数）
 * @param {object} [options.headers] 参与签名的请求头（key 小写，如 { host }）
 * @param {number} [options.expiresSeconds] 签名有效期（秒）
 * @param {object} options.config getCosConfig 返回的配置
 * @returns {Promise<string>} 'q-sign-algorithm=sha1&q-ak=...&q-signature=...' 形式的签名字段串
 */
export async function signRequest({ method, pathname, params = {}, headers = {}, expiresSeconds = 600, config }) {
  const methodLower = String(method || 'get').toLowerCase();

  // 签名有效时间窗口：起始时间回拨 60 秒以容忍少量时钟偏差
  const nowSec = Math.floor(Date.now() / 1000);
  const keyTime = `${nowSec - 60};${nowSec + expiresSeconds}`;

  // 参数与头部列表（编码后小写、字典序、分号连接）及其参与签名的键值串
  const paramEntries = normalizeSignEntries(params);
  const headerEntries = normalizeSignEntries(headers);
  const urlParamList = paramEntries.map(([k]) => k).join(';');
  const headerList = headerEntries.map(([k]) => k).join(';');
  const paramsStr = paramEntries.map(([k, v]) => `${k}=${v}`).join('&');
  const headersStr = headerEntries.map(([k, v]) => `${k}=${v}`).join('&');

  // HttpString（注意：UriPathname 使用未编码的原始路径）
  const httpString = [methodLower, pathname, paramsStr, headersStr, ''].join('\n');
  // StringToSign
  const stringToSign = ['sha1', keyTime, await sha1Hex(httpString), ''].join('\n');
  // SignKey：以 SecretKey 为密钥、KeyTime 为消息
  const signKey = await hmacSha1Hex(config.secretKey, keyTime);
  // Signature：以 SignKey（hex 字符串）为密钥、StringToSign 为消息
  const signature = await hmacSha1Hex(signKey, stringToSign);

  return [
    'q-sign-algorithm=sha1',
    'q-ak=' + config.secretId,
    'q-sign-time=' + keyTime,
    'q-key-time=' + keyTime,
    'q-header-list=' + headerList,
    'q-url-param-list=' + urlParamList,
    'q-signature=' + signature
  ].join('&');
}

/**
 * 生成预签名 URL（不签任何 header / url 参数）
 * @param {object} options
 * @param {string} options.method HTTP 方法，如 'GET' / 'PUT'
 * @param {string} options.key 对象键，如 'uploads/xxx.png'
 * @param {number} [options.expiresSeconds=600] 有效期（秒）
 * @param {object} options.config getCosConfig 返回的配置
 * @returns {Promise<string>} 预签名 URL
 */
export async function presignUrl({ method, key, expiresSeconds = 600, config }) {
  const normalizedKey = String(key || '').replace(/^\/+/, '');
  const authorization = await signRequest({
    method,
    pathname: '/' + normalizedKey,
    params: {},
    headers: {},
    expiresSeconds,
    config
  });

  // 签名字段作为 url 查询参数传递时，值需要 URL 编码（如 q-sign-time 中的 ; -> %3B）
  const query = authorization
    .split('&')
    .map((part) => {
      const idx = part.indexOf('=');
      return `${part.slice(0, idx)}=${camSafeUrlEncode(part.slice(idx + 1))}`;
    })
    .join('&');

  return `https://${cosHost(config)}/${encodeUriPath(normalizedKey)}?${query}`;
}

/**
 * 生成服务端请求使用的 Authorization 头（签 host 头，不签 url 参数）
 * @param {object} options
 * @param {string} options.method HTTP 方法，如 'GET'
 * @param {string} options.pathname 请求路径，如 '/'
 * @param {object} options.config getCosConfig 返回的配置
 * @returns {Promise<string>} Authorization 头的值
 */
export async function authorizationHeader({ method, pathname, config }) {
  return signRequest({
    method,
    pathname: pathname || '/',
    params: {},
    headers: { host: cosHost(config) },
    expiresSeconds: 600,
    config
  });
}

/**
 * 解码 XML 实体（&lt; &gt; &quot; &apos; &amp;；&amp; 必须最后解码）
 * @param {string} str
 * @returns {string}
 */
function decodeXmlEntities(str) {
  return String(str)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * 从 XML 片段中提取指定标签内的文本（不存在返回空串）
 * @param {string} block XML 片段
 * @param {string} tag 标签名
 * @returns {string}
 */
function extractTag(block, tag) {
  const match = block.match(new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>'));
  return match ? match[1] : '';
}

/**
 * 通用请求发送：带超时、错误统一为 AppError
 * @param {string} url
 * @param {object} init fetch init
 * @param {string} [errPrefix='COS 接口请求失败']
 * @returns {Promise<Response>}
 */
async function cosFetch(url, init, errPrefix = 'COS 接口请求失败') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    throw new AppError(
      502,
      'COS_ERROR',
      errPrefix + ': ' + (err && err.message ? err.message : String(err))
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 读取对象的文本内容（GetObject）
 * 对象不存在时返回 null（404 / NoSuchKey）
 * @param {object} config
 * @param {string} key 对象键
 * @returns {Promise<string|null>}
 */
export async function cosGetText(config, key) {
  const path = '/' + String(key || '').replace(/^\/+/, '');
  const authorization = await authorizationHeader({ method: 'GET', pathname: path, config });
  const url = `https://${cosHost(config)}/${encodeUriPath(key)}`;
  const res = await cosFetch(url, { method: 'GET', headers: { authorization } });
  if (res.status === 404) return null;
  if (res.status !== 200) {
    throw new AppError(502, 'COS_ERROR', `COS GetObject 失败：HTTP ${res.status}`);
  }
  return res.text();
}

/**
 * 写入对象（PutObject）
 * @param {object} config
 * @param {string} key 对象键
 * @param {string} body 文本内容
 */
export async function cosPutText(config, key, body) {
  const path = '/' + String(key || '').replace(/^\/+/, '');
  const contentLength = String(new TextEncoder().encode(String(body || '')).length);
  const method = 'PUT';
  const host = cosHost(config);
  const auth = await signRequest({
    method,
    pathname: path,
    params: {},
    headers: { host, 'content-length': contentLength },
    expiresSeconds: 600,
    config
  });
  const url = `https://${host}/${encodeUriPath(key)}`;
  const res = await cosFetch(
    url,
    {
      method,
      headers: { authorization: auth, 'content-length': contentLength },
      body: String(body || '')
    },
    'COS PutObject 失败'
  );
  if (res.status !== 200) {
    throw new AppError(502, 'COS_ERROR', `COS PutObject 失败：HTTP ${res.status}`);
  }
}

/**
 * 写入二进制对象（PutObject，支持 ArrayBuffer / Uint8Array）
 * @param {object} config
 * @param {string} key 对象键
 * @param {ArrayBuffer|Uint8Array} buffer 二进制内容
 * @param {string} [contentType] Content-Type
 */
export async function cosPutBuffer(config, key, buffer, contentType = 'application/octet-stream') {
  const path = '/' + String(key || '').replace(/^\/+/, '');
  const contentLength = String(buffer ? buffer.byteLength : 0);
  const method = 'PUT';
  const host = cosHost(config);
  const auth = await signRequest({
    method,
    pathname: path,
    params: {},
    headers: { host, 'content-length': contentLength, 'content-type': contentType },
    expiresSeconds: 600,
    config
  });
  const url = `https://${host}/${encodeUriPath(key)}`;
  const res = await cosFetch(
    url,
    {
      method,
      headers: { authorization: auth, 'content-length': contentLength, 'content-type': contentType },
      body: buffer
    },
    'COS PutObject 失败'
  );
  if (res.status !== 200) {
    throw new AppError(502, 'COS_ERROR', `COS PutObject 失败：HTTP ${res.status}`);
  }
}

/**
 * 删除对象（DeleteObject），对象不存在也不报错
 * @param {object} config
 * @param {string} key 对象键
 */
export async function cosDeleteObject(config, key) {
  const path = '/' + String(key || '').replace(/^\/+/, '');
  const authorization = await authorizationHeader({ method: 'DELETE', pathname: path, config });
  const url = `https://${cosHost(config)}/${encodeUriPath(key)}`;
  const res = await cosFetch(url, { method: 'DELETE', headers: { authorization } }, 'COS DeleteObject 失败');
  // 204 / 200 都算成功；404 当不存在也不抛错
  if (res.status !== 200 && res.status !== 204 && res.status !== 404) {
    throw new AppError(502, 'COS_ERROR', `COS DeleteObject 失败：HTTP ${res.status}`);
  }
}

/**
 * 列取指定前缀的对象（List Objects V1，XML 解析）
 * @param {object} config
 * @param {object} [options]
 * @param {string} [options.prefix=''] 对象前缀
 * @param {number} [options.maxKeys=1000] 最大条数
 * @returns {Promise<Array<{key: string, lastModified: string, size: number}>>}
 */
export async function cosList(config, { prefix = '', maxKeys = 1000 } = {}) {
  const authorization = await authorizationHeader({ method: 'GET', pathname: '/', config });
  const url = `https://${cosHost(config)}/?prefix=${camSafeUrlEncode(prefix)}&max-keys=${maxKeys}`;
  const res = await cosFetch(url, { method: 'GET', headers: { authorization } }, 'COS ListObjects 失败');
  if (res.status !== 200) {
    throw new AppError(502, 'COS_ERROR', `COS ListObjects 失败：HTTP ${res.status}`);
  }
  const xml = await res.text();
  const items = [];
  const contentsRe = /<Contents>([\s\S]*?)<\/Contents>/g;
  let match;
  while ((match = contentsRe.exec(xml)) !== null) {
    const block = match[1];
    const key = decodeXmlEntities(extractTag(block, 'Key'));
    if (!key) continue;
    items.push({
      key,
      lastModified: decodeXmlEntities(extractTag(block, 'LastModified')),
      size: Number(extractTag(block, 'Size')) || 0
    });
  }
  return items;
}

/**
 * 服务端列出 uploads/ 目录下的文件（Get Bucket XML API）
 * @param {object} config getCosConfig 返回的配置
 * @param {object} [options]
 * @param {string} [options.prefix='uploads/'] 列取前缀
 * @param {number} [options.maxKeys=100] 最大条数
 * @returns {Promise<Array<{key: string, name: string, size: number, lastModified: string}>>}
 *          按 lastModified 倒序
 */
export async function listUploadFiles(config, { prefix = 'uploads/', maxKeys = 100 } = {}) {
  const authorization = await authorizationHeader({ method: 'GET', pathname: '/', config });
  const url = `https://${cosHost(config)}/?prefix=${camSafeUrlEncode(prefix)}&max-keys=${maxKeys}`;

  // 15 秒超时保护
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { authorization },
      signal: controller.signal
    });
  } catch (err) {
    throw new AppError(502, 'COS_ERROR', 'COS 接口请求失败: ' + (err && err.message ? err.message : String(err)));
  } finally {
    clearTimeout(timer);
  }

  if (response.status !== 200) {
    throw new AppError(502, 'COS_ERROR', 'COS 接口请求失败: ' + response.status);
  }

  const xml = await response.text();
  const files = [];
  const contentsRe = /<Contents>([\s\S]*?)<\/Contents>/g;
  let match;
  while ((match = contentsRe.exec(xml)) !== null) {
    const block = match[1];
    const key = decodeXmlEntities(extractTag(block, 'Key'));
    if (!key) continue;
    // 文件名取 key 最后一段；兼容历史 URL 编码形式的名字，解码失败时回退原串
    const rawName = key.split('/').pop() || key;
    let name = rawName;
    try {
      name = decodeURIComponent(rawName);
    } catch {
      name = rawName;
    }
    files.push({
      key,
      name,
      size: Number(extractTag(block, 'Size')) || 0,
      lastModified: decodeXmlEntities(extractTag(block, 'LastModified'))
    });
  }

  // ISO 8601 时间字符串按字典序排序即为时间序，倒序排列（最新在前）
  files.sort((a, b) => (a.lastModified < b.lastModified ? 1 : a.lastModified > b.lastModified ? -1 : 0));
  return files;
}