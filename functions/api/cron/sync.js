/**
 * 定时视频同步（由 EdgeOne Pages 定时任务触发，CRON_KEY 鉴权，不要求登录会话）
 * GET /api/cron/sync?key=xxx（密钥也可通过请求头 x-cron-key 传递）
 * 行为：
 * - 未配置 CRON_KEY 环境变量：500
 * - 密钥不匹配：401
 * - 距上次成功同步不足 2 小时：跳过（skipped: true）
 * - 否则执行同步并返回结果
 */
import { json, error, runHandler } from '../../lib/response.js';
import { assertKV } from '../../lib/kv.js';
import { getSyncState } from '../../lib/videos.js';
import { syncBilibiliVideos } from '../../lib/bilibili.js';

/** 节流间隔：距上次成功同步不足该间隔时跳过 */
const THROTTLE_MS = 2 * 3600 * 1000;

export async function onRequestGet(context) {
  return runHandler(async () => {
    // CRON_KEY 未配置（先于 KV 校验：避免未鉴权方探测 KV 绑定状态）
    const cronKey = context.env && context.env.CRON_KEY;
    if (!cronKey) {
      return error(500, 'CRON_KEY_NOT_SET', '未配置 CRON_KEY 环境变量');
    }

    // 鉴权：query 参数 key 或请求头 x-cron-key
    const url = new URL(context.request.url);
    const key = url.searchParams.get('key') || context.request.headers.get('x-cron-key') || '';
    if (key !== cronKey) {
      return error(401, 'UNAUTHORIZED', '无效的定时任务密钥');
    }

    const kv = assertKV(context);

    // 节流：距上次成功同步不足 2 小时则跳过
    const syncState = await getSyncState(kv);
    if (
      syncState.lastStatus === 'success' &&
      syncState.lastSyncAt &&
      Date.now() - syncState.lastSyncAt < THROTTLE_MS
    ) {
      return json({
        ok: true,
        skipped: true,
        reason: '距上次成功同步不足2小时',
        syncState
      });
    }

    // 执行同步（定时任务路径不要求登录会话）
    const result = await syncBilibiliVideos(kv, { username: 'cron', trigger: 'cron' });
    return json(result);
  });
}