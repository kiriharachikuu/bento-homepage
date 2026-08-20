/**
 * 视频封面缓存到 COS
 * 将 B 站等来源的封面图下载后转存到腾讯云 COS，避免跨域/防盗链问题
 */
import { cosPutBuffer } from './cos.js';
import { getCOSEnv } from './kv.js';

/** B 站封面域名白名单（需要转存的来源） */
const BILI_COVER_HOSTS = ['hdslb.com', 'bilibili.com', 'biliapi.com'];

/** COS 中封面存储前缀 */
const COVER_PREFIX = 'cms/covers/';

/** 最大并发下载数 */
const MAX_PARALLEL = 5;

/**
 * 判断是否为需要转存的远程封面（B 站域名）
 * @param {string} url
 * @returns {boolean}
 */
function isRemoteBiliCover(url) {
  if (!url || typeof url !== 'string') return false;
  if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) return false;
  try {
    const u = new URL(url);
    return BILI_COVER_HOSTS.some((h) => u.hostname.endsWith(h));
  } catch {
    return false;
  }
}

/**
 * 从封面 URL 生成稳定的文件名
 * 优先使用 bvid，没有则用 URL 的 hash
 * @param {object} video 视频对象
 * @param {string} coverUrl 封面 URL
 * @returns {string} 文件名（含扩展名）
 */
function buildCoverFilename(video, coverUrl) {
  // 优先用 bvid
  if (video && video.bvid) {
    const ext = getExtFromUrl(coverUrl) || '.jpg';
    return `${video.bvid}${ext}`;
  }
  // 退而求其次：用 URL 的 hash（前 16 位）
  let hash = 0;
  for (let i = 0; i < coverUrl.length; i++) {
    hash = (hash * 31 + coverUrl.charCodeAt(i)) | 0;
  }
  const ext = getExtFromUrl(coverUrl) || '.jpg';
  return `u${Math.abs(hash).toString(36)}${ext}`;
}

/**
 * 从 URL 中提取扩展名
 * @param {string} url
 * @returns {string}
 */
function getExtFromUrl(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const m = pathname.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/);
    if (m) return m[0];
  } catch {}
  return '';
}

/**
 * 推断 Content-Type
 * @param {string} ext
 * @returns {string}
 */
function contentTypeForExt(ext) {
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.bmp':
      return 'image/bmp';
    default:
      return 'image/jpeg';
  }
}

/**
 * 下载单张图片
 * @param {string} url
 * @returns {Promise<{buffer: ArrayBuffer, contentType: string}>}
 */
async function downloadImage(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      referer: 'https://www.bilibili.com/'
    }
  });
  if (!res.ok) {
    throw new Error(`下载失败：HTTP ${res.status}`);
  }
  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  return { buffer, contentType };
}

/**
 * 转存单个视频封面
 * @param {object} video 视频对象（会就地修改 cover 字段）
 * @param {object} cosConfig COS 配置
 * @returns {Promise<boolean>} 是否成功转存
 */
async function cacheOneCover(video, cosConfig) {
  const coverUrl = video.cover;
  if (!isRemoteBiliCover(coverUrl)) return false;

  const filename = buildCoverFilename(video, coverUrl);
  const cosKey = `${COVER_PREFIX}${filename}`;
  const cosUrl = `https://${cosConfig.bucket}.cos.${cosConfig.region}.myqcloud.com/${cosKey}`;

  try {
    const { buffer, contentType } = await downloadImage(coverUrl);
    await cosPutBuffer(cosConfig, cosKey, buffer, contentType);
    video.cover = cosUrl;
    return true;
  } catch (err) {
    console.warn(`[coverCache] 转存封面失败 ${coverUrl}:`, err.message);
    return false;
  }
}

/**
 * 批量转存视频封面到 COS
 * 失败的条目保留原 URL，不阻断整体流程
 * @param {Array<object>} videoList 视频列表（会就地修改 cover 字段）
 * @param {object} context EdgeOne 函数上下文（用于读取环境变量）
 * @returns {Promise<{total: number, cached: number, failed: number}>}
 */
export async function cacheVideoCovers(videoList, context) {
  const cosConfig = getCOSEnv(context);
  if (!cosConfig) {
    return { total: videoList.length, cached: 0, failed: 0, skipped: videoList.length, reason: 'no_cos_config' };
  }

  // 筛选出需要转存的
  const targets = videoList.filter((v) => isRemoteBiliCover(v.cover));
  const skipCount = videoList.length - targets.length;

  let cached = 0;
  let failed = 0;

  // 并发控制：分批处理
  for (let i = 0; i < targets.length; i += MAX_PARALLEL) {
    const batch = targets.slice(i, i + MAX_PARALLEL);
    const results = await Promise.all(
      batch.map(async (video) => {
        try {
          const ok = await cacheOneCover(video, cosConfig);
          return ok ? 'ok' : 'skip';
        } catch {
          return 'fail';
        }
      })
    );
    results.forEach((r) => {
      if (r === 'ok') cached++;
      else if (r === 'fail') failed++;
    });
  }

  return { total: videoList.length, cached, failed, skipped: skipCount };
}
