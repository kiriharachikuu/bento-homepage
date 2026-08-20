/**
 * 手动视频管理（需登录会话）
 * POST /api/admin/videos/manual
 * body: { action: 'add' | 'update' | 'delete', item }
 * - add：item = { title, description, cover, url, cooperation }
 * - update：按 item.id 定位，更新 title/description/cover/url/cooperation
 * - delete：按 item.id 移除
 */
import { json, runHandler, AppError } from '../../../lib/response.js';
import { assertKV } from '../../../lib/kv.js';
import { requireAuth, getClientIp } from '../../../lib/session.js';
import { LOG_ACTIONS, writeLog } from '../../../lib/logger.js';
import { createVersion } from '../../../lib/version.js';
import { getVideoData, saveVideoData } from '../../../lib/videos.js';
import { extractBvid } from '../../../lib/bilibili.js';
import { randomHex } from '../../../lib/crypto.js';

export async function onRequestPost(context) {
  return runHandler(async () => {
    const auth = await requireAuth(context);
    if (!auth.ok) return auth.response;

    const kv = assertKV(context);

    let body;
    try {
      body = await context.request.json();
    } catch {
      throw new AppError(400, 'INVALID_BODY', '请求体不是合法 JSON');
    }

    const action = String((body && body.action) || '');
    if (!['add', 'update', 'delete'].includes(action)) {
      throw new AppError(400, 'INVALID_PARAM', 'action 必须为 add / update / delete');
    }
    const item = body && body.item;
    if (!item || typeof item !== 'object') {
      throw new AppError(400, 'INVALID_PARAM', 'item 不能为空');
    }

    // add / update 时 title 必填非空，url 非空
    if (action !== 'delete') {
      if (!String(item.title || '').trim()) {
        throw new AppError(400, 'INVALID_PARAM', 'title 不能为空');
      }
      if (!String(item.url || '').trim()) {
        throw new AppError(400, 'INVALID_PARAM', 'url 不能为空');
      }
    }

    const videoData = await getVideoData(kv);
    if (!Array.isArray(videoData.manual)) {
      videoData.manual = [];
    }

    let logTarget = '';
    let logSummary = `手动视频${action}`;

    if (action === 'add') {
      const entry = {
        id: `m_${Date.now()}_${randomHex(3)}`,
        bvid: extractBvid(item.url) || '',
        title: String(item.title).trim(),
        description: String(item.description || ''),
        cover: String(item.cover || ''),
        url: String(item.url).trim(),
        cooperation: Boolean(item.cooperation),
        pinned: Boolean(item.pinned),
        hidden: Boolean(item.hidden),
        source: 'manual',
        pubdate: null,
        createdAt: Date.now()
      };
      videoData.manual.push(entry);
      logTarget = entry.id;
      logSummary = `手动视频${action}：${entry.title}`;
    } else if (action === 'update') {
      const id = String(item.id || '');
      if (!id) {
        throw new AppError(400, 'INVALID_PARAM', 'item.id 不能为空');
      }
      const entry = videoData.manual.find((v) => v && v.id === id);
      if (!entry) {
        throw new AppError(404, 'NOT_FOUND', '视频条目不存在');
      }
      // 逐个更新提供的字段
      if (item.title !== undefined) {
        entry.title = String(item.title).trim();
      }
      if (item.description !== undefined) {
        entry.description = String(item.description || '');
      }
      if (item.cover !== undefined) {
        entry.cover = String(item.cover || '');
      }
      if (item.url !== undefined) {
        entry.url = String(item.url).trim();
        // url 变更后同步刷新 bvid
        entry.bvid = extractBvid(entry.url) || '';
      }
      if (item.cooperation !== undefined) {
        entry.cooperation = Boolean(item.cooperation);
      }
      if (item.pinned !== undefined) {
        entry.pinned = Boolean(item.pinned);
      }
      if (item.hidden !== undefined) {
        entry.hidden = Boolean(item.hidden);
      }
      logTarget = entry.id;
      logSummary = `手动视频${action}：${entry.title}`;
    } else {
      // delete：按 item.id 移除
      const id = String(item.id || '');
      if (!id) {
        throw new AppError(400, 'INVALID_PARAM', 'item.id 不能为空');
      }
      const index = videoData.manual.findIndex((v) => v && v.id === id);
      if (index === -1) {
        throw new AppError(404, 'NOT_FOUND', '视频条目不存在');
      }
      const [removed] = videoData.manual.splice(index, 1);
      logTarget = id;
      logSummary = `手动视频${action}：${(removed && removed.title) || id}`;
    }

    await saveVideoData(kv, videoData);
    await createVersion(kv, {
      username: auth.session.username,
      note: `手动视频${action}`,
      modules: ['videos']
    });
    await writeLog(kv, {
      username: auth.session.username,
      action: LOG_ACTIONS.VIDEO_EDIT,
      target: logTarget,
      summary: logSummary,
      ip: getClientIp(context.request)
    });

    return json({ ok: true, manual: videoData.manual });
  });
}