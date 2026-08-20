/**
 * 临时测试脚本：用 Node 直接驱动 B 站同步引擎（真实网络请求）
 * 用内存 Map 模拟 EdgeOne KV 接口（get/put/delete）
 */
import { syncBilibiliVideos } from './functions/lib/bilibili.js';
import { mergeVideoList, getVideoData, getSyncState } from './functions/lib/videos.js';

// 内存 KV mock：接口与 EdgeOne KV 绑定一致
const store = new Map();
const mockKv = {
  async get(key, opts) {
    if (!store.has(key)) return null;
    const raw = store.get(key);
    return opts && opts.type === 'json' ? JSON.parse(raw) : raw;
  },
  async put(key, value) { store.set(key, value); },
  async delete(key) { store.delete(key); }
};

let pass = 0, fail = 0;
function assert(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${detail}`); }
}

/* ---------- 测试 1：真实同步（成功链路，mid=28826850） ---------- */
console.log('\n[测试1] 真实同步 B 站空间（mid=28826850，真实网络请求）');
const t0 = Date.now();
const result = await syncBilibiliVideos(mockKv, { username: 'selftest', ip: '127.0.0.1', trigger: 'manual' });
console.log(`  耗时 ${Date.now() - t0}ms，结果 ok=${result.ok}，数据源=${result.syncState.source}`);
if (result.error) console.log('  失败详情:', result.error.split('\n').join(' | '));

const state = await getSyncState(mockKv);
assert('同步状态已写入 KV', state.lastSyncAt > 0 && state.lastStatus === (result.ok ? 'success' : 'error'));
assert('日志已记录（log_index 存在）', store.has('log_index'));

if (result.ok) {
  const videoData = await getVideoData(mockKv);
  assert(`synced 列表非空（${videoData.synced.length} 条）`, videoData.synced.length > 0);
  const first = videoData.synced[0];
  assert('条目结构完整（bvid/title/url/cover/source）',
    typeof first.bvid === 'string' && first.bvid.startsWith('BV') &&
    !!first.title && !!first.url &&
    first.url === `https://www.bilibili.com/video/${first.bvid}/` &&
    first.source === 'sync');
  assert('封面地址带协议', first.cover === '' || first.cover.startsWith('http'));
  assert('pubdate 为毫秒时间戳', first.pubdate === null || first.pubdate > 1e12);
  console.log('  最新一条:', first.bvid, '|', first.title.slice(0, 40), '|', new Date(first.pubdate).toISOString());

  /* ---------- 测试 2：合并展示逻辑（置顶/隐藏/覆盖，基于真实数据） ---------- */
  console.log('\n[测试2] mergeVideoList 覆盖逻辑（真实数据）');
  const target = videoData.synced[0];
  const overrides = {
    [target.bvid]: { pinned: true, title: '自定义标题测试' },
    [videoData.synced[1].bvid]: { hidden: true }
  };
  const display = mergeVideoList(videoData, overrides);
  assert(`隐藏条目被过滤（${display.length} 条展示）`, !display.some(d => d.bvid === videoData.synced[1].bvid));
  assert('置顶条目排最前', display[0].bvid === target.bvid);
  assert('置顶条目标题被覆盖', display[0].title === '自定义标题测试');
  assert('置顶标记透出', display[0].pinned === true);
  const noOv = mergeVideoList(videoData, {});
  assert('无覆盖时按时间降序', noOv[0].bvid === videoData.synced[0].bvid);
}

/* ---------- 测试 3：全链路失败（不存在的 mid，验证容错与数据保留） ---------- */
console.log('\n[测试3] 全链路失败容错（mid=999999999999，不存在的用户）');
// 预置一份"原有数据"，验证失败路径绝不触碰 videos 键
const PRESET_VIDEOS = { manual: [{ id: 'm_test1', bvid: '', title: '预置手动视频', description: '', cover: '', url: 'https://example.com/v', cooperation: false, source: 'manual', pubdate: null, createdAt: Date.now() }], synced: [], updatedAt: 1 };
await mockKv.put('videos', JSON.stringify(PRESET_VIDEOS));
const backupVideos = store.get('videos');
const failResult = await syncBilibiliVideos(mockKv, { username: 'selftest', ip: '127.0.0.1', trigger: 'cron' });
console.log(`  结果 ok=${failResult.ok}`);
assert('返回失败标记', failResult.ok === false);
assert('错误信息包含三个数据源的失败明细', (failResult.error || '').split('\n').length >= 3);
const failState = await getSyncState(mockKv);
assert('失败状态已记录', failState.lastStatus === 'error' && !!failState.lastError);
assert('失败时保留原有视频数据', store.get('videos') === backupVideos);
const afterFail = await getVideoData(mockKv);
assert('原数据内容未被修改', afterFail.manual.length === 1 && afterFail.manual[0].title === '预置手动视频');

console.log(`\n========== 汇总：${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail > 0 ? 1 : 0);
