/**
 * 同步视频字段微调（需登录会话）
 * POST /api/admin/videos/override
 * body: { bvid, overrides: { title?, description?, hidden?, pinned?, cooperation? } }
 * 白名单字段合并进现有覆盖配置；全为 falsy 默认值时删除该 bvid 条目
 */
import { json, runHandler, AppError } from '../../../lib/response.js';
import { assertKV } from '../../../lib/kv.js';
import { requireAuth, getClientIp } from '../../../lib/session.js';
import { LOG_ACTIONS, writeLog } from '../../../lib/logger.js';
import { createVersion } from '../../../lib/version.js';
import { getOverrides, saveOverrides } from '../../../lib/videos.js';
import { extractBvid } from '../../../lib/bilibili.js';

export async function onRequestPost(context) {
  return runHandler(async () => {
    const auth = await requireAuth(context);
    if (!auth.ok) return auth.response;

    const kv = assertKV();

    let body;
    try {
      body = await context.request.json();
    } catch {
      throw new AppError(400, 'INVALID_BODY', '请求体不是合法 JSON');
    }

    // bvid 校验：非空且符合 BV 号格式（允许直接传 BV 号或完整链接）
    const bvid = extractBvid(String((body && body.bvid) || ''));
    if (!bvid) {
      throw new AppError(400, 'INVALID_PARAM', 'bvid 不能为空且需符合 BV 号格式');
    }

    // 只保留白名单字段：title/description 为字符串截断，hidden/pinned/cooperation 强制 Boolean
    const input =
      body && body.overrides && typeof body.overrides === 'object' ? body.overrides : {};
    const patch = {};
    if (input.title !== undefined) {
      patch.title = String(input.title ?? '').slice(0, 200);
    }
    if (input.description !== undefined) {
      patch.description = String(input.description ?? '').slice(0, 500);
    }
    for (const field of ['hidden', 'pinned', 'cooperation']) {
      if (input[field] !== undefined) {
        patch[field] = Boolean(input[field]);
      }
    }

    // 合并进现有覆盖配置
    const overrides = await getOverrides(kv);
    const merged = { ...(overrides[bvid] || {}), ...patch };
    // 所有字段均为 falsy 默认值（空串 / false / null）时删除该 bvid 条目
    const hasOverride = Object.values(merged).some(
      (v) => v !== undefined && v !== null && v !== '' && v !== false
    );
    if (hasOverride) {
      overrides[bvid] = merged;
    } else {
      delete overrides[bvid];
    }
    await saveOverrides(kv, overrides);

    await createVersion(kv, {
      username: auth.session.username,
      note: `视频微调 ${bvid}`,
      modules: ['videos']
    });

    // 日志摘要：描述本次变更内容
    const changes = [];
    if (patch.pinned !== undefined) changes.push(patch.pinned ? '置顶' : '取消置顶');
    if (patch.hidden !== undefined) changes.push(patch.hidden ? '隐藏' : '取消隐藏');
    if (patch.cooperation !== undefined) changes.push(patch.cooperation ? '标记合作' : '取消合作');
    if (patch.title !== undefined) changes.push('修改标题');
    if (patch.description !== undefined) changes.push('修改描述');
    await writeLog(kv, {
      username: auth.session.username,
      action: LOG_ACTIONS.VIDEO_EDIT,
      target: bvid,
      summary: changes.length ? `视频微调 ${bvid}：${changes.join('、')}` : `视频微调 ${bvid}`,
      ip: getClientIp(context.request)
    });

    return json({ ok: true, overrides });
  });
}