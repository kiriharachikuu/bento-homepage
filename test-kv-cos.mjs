/**
 * KV 抽象层 COS 模式真实联调测试
 * 模拟 EdgeOne 环境：用环境变量模拟 context.env
 * 验证：kvGetJson / kvPutJson / kvDelete 在 COS 模式下行为正确
 */
import { getStorage, assertStorage, kvGetJson, kvPutJson, kvDelete } from './functions/lib/kv.js';

// 从环境变量读取 COS 配置（不要硬编码密钥到文件里）
const env = {
  COS_SECRET_ID: process.env.COS_SECRET_ID || '',
  COS_SECRET_KEY: process.env.COS_SECRET_KEY || '',
  COS_BUCKET: process.env.COS_BUCKET || 'chikuu-1252656027',
  COS_REGION: process.env.COS_REGION || 'ap-nanjing'
};

const context = { env };

let pass = 0, fail = 0;
function assert(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${detail}`); }
}

console.log('== 检测可用存储 ==');
const s = getStorage(context);
console.log('  类型:', s ? s.type : 'null');
assert('getStorage 返回非空', !!s);
assert('类型为 cos', s && s.type === 'cos');

console.log('\n== assertStorage ==');
try {
  const s2 = assertStorage(context);
  assert('assertStorage 成功', !!s2);
} catch (e) {
  assert('assertStorage 不应抛错', false, e.message);
}

console.log('\n== 写入测试 ==');
const testKey = 'test_kv_layer_' + Date.now();
await kvPutJson(s, testKey, { name: 'test', value: 42, nested: { a: 1 } });
assert('写入成功（未抛错）', true);

console.log('\n== 读取测试 ==');
const readBack = await kvGetJson(s, testKey);
assert('读取到对象', readBack && typeof readBack === 'object');
assert('name 字段正确', readBack && readBack.name === 'test');
assert('value 字段正确', readBack && readBack.value === 42);
assert('nested 字段正确', readBack && readBack.nested && readBack.nested.a === 1);

console.log('\n== 不存在的 key 返回 null ==');
const notExist = await kvGetJson(s, 'definitely_not_exist_' + Date.now());
assert('返回 null', notExist === null);

console.log('\n== 删除测试 ==');
await kvDelete(s, testKey);
assert('删除成功（未抛错）', true);
const afterDelete = await kvGetJson(s, testKey);
assert('删除后读取为 null', afterDelete === null);

console.log('\n== 边界：null 句柄 ==');
assert('null 句柄 get 返回 null', (await kvGetJson(null, 'foo')) === null);
// 下面两个不抛错即通过
await kvPutJson(null, 'foo', 1);
await kvDelete(null, 'foo');
assert('null 句柄 put/delete 不抛错', true);

console.log(`\n========== ${pass}/${pass + fail} 通过 ==========`);
process.exit(fail > 0 ? 1 : 0);
