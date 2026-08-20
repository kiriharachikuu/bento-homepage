/**
 * 外部导入视频列表（需登录会话）
 * POST /api/admin/videos/import
 *
 * 用途：Python 脚本或其他外部工具在本地抓取到视频数据后，
 *       通过此接口直接写入 CMS，跳过服务端同步引擎。
 *
 * Body: {
 *   videos: [                    // 视频数组，至少 1 条
 *     {
 *       bvid: 'BV1xx...',        // 必填，BV 号
 *       title: '标题',           // 必填
 *       description: '简介',     // 可选
 *       cover: 'https://...',    // 可选，封面 URL
 *       duration: 123,           // 可选，时长（秒）
 *       pubdate: 1700000000000,  // 可选，发布时间（毫秒时间戳）
 *       tname: '音乐',           // 可选，分区名
 *       play: 12345,             // 可选，播放量
 *       videoReview: false       // 可选，是否合作视频
 *     }
 *   ],
 *   source: 'python_script',     // 可选，标记导入来源，会出现在日志和版本备注里
 *   note: '自定义备注'           // 可选，版本备注
 * }
 *
 * 返回：{ ok: true, count: 导入条数, versionId }
 *
 * 注意：
 * - 此接口会**覆盖** synced 同步视频列表，但不会影响 manual 手动条目和 overrides 覆盖配置
 * - 导入会生成版本快照，可在版本历史中回滚
 * - 单条字段异常会被过滤掉（跳过该条），不会整体失败
 */
import { json, runHandler, AppError } from '../../../lib/response.js';
import { assertKV } from '../../../lib/kv.js';
import { requireAuth, getClientIp } from '../../../lib/session.js';
import { getVideoData, saveVideoData } from '../../../lib/videos.js';
import { createVersion } from '../../../lib/version.js';
import { LOG_ACTIONS, writeLog } from '../../../lib/logger.js';
import { cacheVideoCovers } from '../../../lib/coverCache.js';

/** 单条规范化：缺关键字段的返回 null（过滤掉） */
function normalizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const bvid = String(raw.bvid || '').trim();
  const title = String(raw.title || '').trim();
  if (!bvid || !title) return null;
  if (!/^BV[0-9A-Za-z]{10}$/.test(bvid)) return null;

  // 时长：统一为数字秒
  let duration = Number(raw.duration);
  if (!Number.isFinite(duration) || duration < 0) duration = 0;

  // 发布时间：10 位以下视为秒级，转毫秒
  let pubdate = Number(raw.pubdate || raw.created || raw.pubDate);
  if (!Number.isFinite(pubdate) || pubdate <= 0) {
    pubdate = Date.now();
  } else if (pubdate < 1e11) {
    pubdate = pubdate * 1000;
  }

  // 封面：补全协议
  let cover = String(raw.cover || raw.pic || '').trim();
  if (cover.startsWith('//')) cover = 'https:' + cover;

  return {
    bvid,
    title: title.slice(0, 200),
    description: String(raw.description || raw.desc || '').slice(0, 500),
    cover,
    url: `https://www.bilibili.com/video/${bvid}/`,
    pubdate,
    duration: Math.floor(duration),
    tname: String(raw.tname || raw.typeName || '').slice(0, 50),
    play: Number(raw.play || raw.play_count || 0) || 0,
    videoReview: Boolean(raw.videoReview || raw.isCooperation || false),
    source: 'imported'
  };
}

export async function onRequestPost(context) {
  return runHandler(async () => {
    const auth = await requireAuth(context);
    if (!auth.ok) return auth.response;

    const kv = assertKV(context);

    // 解析请求体
    let body;
    try {
      body = await context.request.json();
    } catch {
      throw new AppError(400, 'BAD_REQUEST', '请求体必须是合法 JSON');
    }

    const videosRaw = body && Array.isArray(body.videos) ? body.videos : null;
    if (!videosRaw || videosRaw.length === 0) {
      throw new AppError(400, 'BAD_REQUEST', 'videos 数组不能为空');
    }
    if (videosRaw.length > 200) {
      throw new AppError(400, 'BAD_REQUEST', '单次最多导入 200 条');
    }

    // 规范化 + 过滤
    const items = videosRaw.map(normalizeItem).filter(Boolean);
    if (items.length === 0) {
      throw new AppError(400, 'BAD_REQUEST', '没有有效的视频条目（所有条目都缺少 bvid 或 title）');
    }

    const sourceLabel = String(body.source || 'external_import').slice(0, 50);
    const note = body.note ? String(body.note).slice(0, 200) : null;

    // 写入 video_data.synced
    const videoData = await getVideoData(kv);
    videoData.synced = items;

    // 封面转存到 COS（失败不阻断导入，仅记录）
    try {
      await cacheVideoCovers(videoData.synced, context);
    } catch (coverErr) {
      console.warn('[video import] 封面转存失败：', coverErr.message);
    }

    videoData.updatedAt = Date.now();
    await saveVideoData(kv, videoData);

    // 版本快照
    const versionNote = note || `视频导入（${sourceLabel}，${items.length}条）`;
    const version = await createVersion(kv, {
      username: auth.session.username,
      note: versionNote,
      modules: ['videos']
    });

    // 更新同步状态（标记为导入）
    const syncState = {
      lastSyncAt: Date.now(),
      lastStatus: 'success',
      lastError: null,
      itemCount: items.length,
      source: sourceLabel
    };
    const { kvPutJson } = await import('../../../lib/kv.js');
    await kvPutJson(kv, 'sync_state', syncState);

    // 操作日志
    await writeLog(kv, {
      username: auth.session.username,
      action: LOG_ACTIONS.VIDEO_SYNC,
      target: sourceLabel,
      summary: `外部导入成功（${sourceLabel}，${items.length}条）`,
      ip: getClientIp(context.request)
    });

    return json({
      ok: true,
      count: items.length,
      skipped: videosRaw.length - items.length,
      source: sourceLabel,
      versionId: version && version.id,
      syncState
    });
  });
}
