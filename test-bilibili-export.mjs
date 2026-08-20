/**
 * B 站视频抓取引擎端到端测试 + 数据导出
 * 调用 functions/lib/bilibili.js 的真实同步逻辑，输出抓取结果到文件
 */
import { syncBilibiliVideos } from './functions/lib/bilibili.js';
import { kvPutJson, kvGetJson } from './functions/lib/kv.js';

// 内存模拟 KV（eo_kv 模式句柄格式）
const store = new Map();
const kv = {
  type: 'eo_kv',
  handle: {
    async get(key, opts) {
      const v = store.get(key);
      if (v === undefined) return null;
      if (opts && opts.type === 'json') {
        try { return JSON.parse(v); } catch { return null; }
      }
      return v;
    },
    async put(key, val) { store.set(key, String(val)); },
    async delete(key) { store.delete(key); }
  }
};

// 预置一个最小 site_config，让同步引擎知道 mid
await kvPutJson(kv, 'site_config', {
  videoSync: { mid: '28826850', maxCount: 30, enabled: true }
});

console.log('开始同步 B 站视频（mid=28826850，最多 30 条）...\n');
const startTime = Date.now();

try {
  const result = await syncBilibiliVideos(kv, {
    username: 'test',
    ip: '127.0.0.1',
    trigger: 'manual'
  });
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\n========== 同步完成（${duration}s） ==========`);
  console.log('返回:', JSON.stringify(result, null, 2));

  // 从 KV 读取同步后的数据
  const videoData = await kvGetJson(kv, 'video_data');
  const syncState = await kvGetJson(kv, 'sync_state');
  const siteConfig = await kvGetJson(kv, 'site_config');

  const videos = (videoData && videoData.synced) || [];
  console.log(`\n实际抓到视频数: ${videos.length}`);
  console.log(`同步状态: ${syncState ? syncState.lastStatus : 'unknown'}`);
  console.log(`使用源: ${syncState ? syncState.source : 'unknown'}`);

  if (videos.length === 0) {
    console.log('\n失败详情:', syncState ? syncState.lastError : '无');
    process.exit(1);
  }

  console.log('\n视频列表:');
  videos.forEach((v, i) => {
    const dur = formatDuration(v.duration);
    const date = v.createdAt ? new Date(v.createdAt).toLocaleString('zh-CN') : '-';
    console.log(`  ${String(i + 1).padStart(2, ' ')}. [${v.bvid || v.aid}] ${v.title}`);
    console.log(`      时长 ${dur} | 分区 ${v.tname || '-'} | 发布 ${date}`);
    if (v.cover) console.log(`      封面: ${v.cover}`);
  });

  // 导出到文件
  const fs = await import('fs');
  const exportData = {
    exportedAt: new Date().toISOString(),
    source: syncState && syncState.source,
    count: videos.length,
    duration: duration + 's',
    siteConfig: siteConfig && { videoSync: siteConfig.videoSync },
    videos
  };
  fs.writeFileSync('bilibili-videos-export.json', JSON.stringify(exportData, null, 2), 'utf8');
  console.log('\n✅ 数据已导出到 bilibili-videos-export.json');

} catch (err) {
  console.error('同步异常:', err.message);
  console.error(err.stack);
  process.exit(1);
}

function formatDuration(sec) {
  sec = Number(sec) || 0;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
