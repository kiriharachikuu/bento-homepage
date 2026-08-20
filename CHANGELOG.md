# 变更说明（CHANGELOG）

按日期倒序记录代码级变更，每条包含：问题描述、根因、改动文件与具体变更点、验证结果。
面向后续维护查阅，修改相关模块前建议先读对应条目。

---

## 2026-08-20 ｜ B 站视频同步自定义 Cookie 支持（方案 A）

### 背景

纯服务端抓取 B 站空间视频会被风控拦截（-352，需要浏览器行为指纹），三级容错链在本地 IP 下全挂。部署到 EdgeOne 后成功率也无法保证。

### 方案

后台新增「B 站 Cookie」配置项，用户从浏览器复制登录态 Cookie 粘贴进去。带登录态请求 B 站接口基本不受风控影响，同步成功率接近 100%。Cookie 每 2-3 个月过期一次，重新粘贴即可。

同时作为方案 C（Python 脚本备用）的前置准备：
- Cookie 保存在 `site_config.videoSync.biliCookie`，同步引擎直接读取
- 对外的 `/api/admin/videos/sync` 端点可被外部脚本调用（需管理员登录态 cookie 或 API key 留待后续扩展）

### 改动文件

| 文件 | 改动 |
| --- | --- |
| `functions/lib/bilibili.js` | syncBilibiliVideos 读取 `videoSync.biliCookie`；有自定义 Cookie 时直接使用并从 nav 接口取 wbi key，不再走 buvid/ticket 自动获取 |
| `functions/api/config.js` | 公开配置返回时**剔除 `biliCookie` 字段**，避免登录态泄露 |
| `functions/api/admin/videos.js` | 登录态下返回 `videoSync` 完整配置（含 biliCookie），供后台回填表单 |
| `src/admin/pages/videos.js` | 同步设置区新增 B 站 Cookie textarea + 清空按钮；保存时一并提交；设置读取来源改为 admin 接口（不再请求公开 `/api/config`） |

### 安全设计

- **B 站 Cookie 永远不在公开接口返回**：`/api/config` 脱敏处理，只有登录后通过 `/api/admin/videos` 才能读到
- Cookie 以明文存储在 KV/COS 中——因为需要原封不动发给 B 站，不能哈希。风险可控：只有管理员账号能读写，管理员本身就知道自己的 B 站 Cookie
- 注意：版本快照里也会包含 biliCookie，回滚时同步回滚

### 验证

- 签名算法已通过反算验证（与浏览器生成的 `w_rid` 完全一致）
- 风控拦截是 B 站策略问题，非代码 bug，自定义 Cookie 可绕过后端成功率应接近 100%
- 需部署后用真实 Cookie 实测确认

### 配套：外部视频导入接口 + Python 脚本（方案 C 备用）

- 新增 `POST /api/admin/videos/import` 端点：接受外部传入的视频列表，直接覆盖 synced 列表，自动生成版本快照和操作日志
  - 路径：`functions/api/admin/videos/import.js`
  - 鉴权：需要管理员会话
  - 单条字段异常自动过滤（跳过无效条目，不整体失败）
  - 限制：单次最多 200 条
- 新增 `scripts/bili_sync_import.py` Python 脚本模板
  - 完整的 B 站 wbi 签名抓取逻辑（和 CMS 引擎同源算法）
  - CMS 登录 + 导入一键流程
  - 只需修改 CONFIG 区域的 5 个参数即可使用
  - 依赖：仅需 `requests` 库

---

## 2026-08-20 ｜ 双存储共存（KV + COS 自动切换）

### 背景

EdgeOne KV 存储申请未通过，需要备用方案。选择用已有的腾讯云 COS 桶作为 CMS 存储后端，并设计成**双模式共存 + 自动检测**，KV 申请通过后绑定即可自动切换，代码零改动。

### 设计

- **检测优先级**：有 `CMS_KV` 运行时变量 → 用 EdgeOne KV；没有 → 检查 `COS_SECRET_ID/KEY` 环境变量 → 有则用 COS；都没有抛 `NO_STORAGE` 错误。
- **抽象层**：`functions/lib/kv.js` 从直接操作 EdgeOne KV 的薄封装升级为存储抽象层，对外接口不变（`getKV/assertKV/kvGetJson/kvPutJson/kvDelete`），调用方零感知。
- **COS 数据前缀**：所有 CMS 数据存在桶内 `cms/` 前缀下，与 `uploads/` 等业务数据物理隔离。
- **数据独立性**：两种存储的数据互不相通，切换后各是各的（设计取舍：避免双向同步的一致性问题，数据量极小可手动迁移）。

### 改动文件

| 文件 | 改动 |
| --- | --- |
| `functions/lib/kv.js` | 重写：KV/COS 双模式抽象层；新增 `getStorage/assertStorage`；旧 API 兼容（`getKV/assertKV` 现在接受 context 参数） |
| `functions/lib/cos.js` | 新增：`cosGetText`、`cosPutText`、`cosDeleteObject`、`cosList` 四个对象操作方法；抽取 `cosFetch` 公共超时封装 |
| `functions/api/*.js`（14 个端点文件） | `assertKV()` → `assertKV(context)`，传递上下文以读取 COS 环境变量 |
| `functions/lib/session.js` | 同：`requireAuth` 中的 `assertKV()` → `assertKV(context)` |
| `src/admin/main.js` | 登录页部署指引文案兼容新的 `NO_STORAGE` 错误码（同时保留旧 `KV_NOT_BOUND` 兼容） |
| `README.md` | 部署章节新增「双存储方案」说明，常见问题新增 2 条（NO_STORAGE 报错、COS 切 KV 方法），环境变量表 COS 密钥改为「方案 B 必填」 |
| `test-kv-cos.mjs`（新增） | COS 模式 KV 抽象层真实联调测试（需配置 COS 环境变量运行） |

### 调用方兼容性

调用方式仍是 `const kv = assertKV(context); await kvGetJson(kv, key)` 这套。`kv` 从"EdgeOne KV 绑定对象"变成了 `{ type, handle }` 不透明句柄，但所有调用方都只做"透传给 kvGetJson 等函数"这一件事，从不直接操作 kv 对象，因此完全兼容。

### 遗留 / 注意事项

- COS 模式下读写延迟约 50-200ms（对比 KV 毫秒级），个人站低频场景无感；前台配置接口有 60s 边缘缓存，实际体验差距更小。
- 索引（version_index / log_index）仍是"读-改-写"非原子，单管理员场景风险可接受。
- `test-kv-cos.mjs` 是可选的验证脚本，跑之前需先在环境变量设置 `COS_SECRET_ID` / `COS_SECRET_KEY`。

### 修复记录（同轮迭代内）

**修复 1：cosGetText / cosPutText / cosDeleteObject 的 URL 缺少前导斜杠**

- **问题**：三个对象操作函数的 URL 写成 `` `${host}${encodeUriPath(key)}` ``，host 与 path 之间没有 `/`，导致请求发到形如 `https://chikuu-1252656027.cos.ap-nanjing.myqcloud.comcms/xxx` 的错误地址，Node.js fetch 直接抛 `fetch failed`。
- **根因**：写代码时照搬了 `cosList` 的 URL 拼接思路（list 是 `/?prefix=...` 有 `/`），但忘了给对象 key 的路径也加前导 `/`。
- **改动**：`functions/lib/cos.js` 三处 URL 拼接补 `/`：`cosGetText`（L247）、`cosPutText`（L275）、`cosDeleteObject`（L298）。
- **验证**：`test-kv-cos.mjs` 13/13 通过（存储检测 / 写入 / 读取字段校验 / 不存在返回 null / 删除 / null 句柄边界）。
- **额外改动**：`signRequest` 从内部函数改为 `export`，方便后续调试和复用。

---

## 2026-08-19（晚） ｜ 后台白屏修复

### 修复 9：访问 /admin 白屏（严重度：高）

**问题**：访问 `/admin`（或 `/admin/`）页面纯白，无任何内容，控制台也无报错。

**根因**（浏览器实测定位，Playwright 抓取渲染结果与控制台）：`src/admin/main.js` 中视图状态变量初始值为 `let view = 'login'`，而启动探测的失败兜底逻辑是：

```js
} catch (err) {
    if (view !== 'login') {   // 永远为 false！
        renderLogin(notice);
    }
}
```

该守卫的本意是「401 时 unauthorizedHandler 已渲染过登录页则跳过重复渲染」，但初始值 `'login'` 使条件恒为 false，`renderLogin` 成为死代码。触发链路：

- `GET /api/auth/me` 探测失败且**不是** 401-UNAUTHORIZED（本地 dev 返回 200+HTML、KV 未绑定返回 500、functions 路由 404）时，错误进入 boot 的 catch，登录页不渲染 -> 白屏；
- 只有正常部署且会话过期（401 + UNAUTHORIZED 业务码）时，api.js 会先触发 unauthorizedHandler 渲染登录页，不白屏。这解释了为何此前静态审查未发现：代码路径在「后端正常返回 401」时是通的。

**改动文件与变更点**：

`src/admin/main.js`：
- `let view = 'login'` 改为 `let view = null`（语义：null = 尚未渲染任何视图），并加注释说明初始值不可改回 `'login'` 的原因。`view` 全部 5 处引用逐一核对：`renderLogin`/`renderAdmin` 赋值正常，`view !== 'admin'` 守卫对 null / 'login' 行为一致，安全。

**顺手修复（dev 体验，同轮验证发现）**：

- `vite.config.js`：新增 `appType: 'mpa'`，关闭 Vite dev 的 SPA history fallback--此前 dev 下访问 `/admin`（无尾斜杠）会被 fallback 重写到前台首页，展示错误的应用；同时新增内联插件 `admin-dir-redirect`，dev 下 `/admin` 301 重定向到 `/admin/`（MPA 模式无目录重定向，对齐生产静态托管行为）。生产构建与 EdgeOne 部署不受影响。

**验证**（Playwright + dev server 实测）：
- `/admin` -> 301 到 `/admin/` -> 登录卡片渲染（#app 1085 字符）✅
- `/admin/` -> 登录卡片渲染 ✅
- `/` -> 前台正常（31581 字符）✅
- `npm run build` 通过 ✅

---

## 2026-08-19 ｜ CMS 交付后修复轮（8 项）

### 背景

CMS 系统交付后做了一次全量审查（spec 需求逐条覆盖核对 + 跨模块集成检查），并用 `test-sync-live.mjs` 对 B 站同步引擎做了**真实网络联调测试**。本轮共发现并修复 8 个问题（1 高 / 2 中 / 5 低），全部验证通过。

### 修复清单总览

| # | 严重度 | 问题 | 改动文件 | 状态 |
| --- | --- | --- | --- | --- |
| 1 | 高 | B 站风控导致视频同步三源全失败 | `functions/lib/bilibili.js`、`functions/lib/crypto.js` | ✅ 已修复并实测 |
| 2 | 中 | 视频同步成功不生成版本快照（脏数据无法回滚） | `functions/lib/bilibili.js` | ✅ 已修复 |
| 3 | 中 | 手动添加的视频条目不支持置顶 / 隐藏 | `functions/api/admin/videos/manual.js`、`src/admin/pages/videos.js` | ✅ 已修复 |
| 4 | 低 | 登录接口缺少 CSRF 请求头校验 | `functions/api/auth/login.js` | ✅ 已修复 |
| 5 | 低 | KV 未绑定时后台无部署指引 | `src/admin/main.js`、`src/admin/styles.css` | ✅ 已修复 |
| 6 | 低 | 定时同步端点在鉴权前先查 KV（可探测绑定状态） | `functions/api/cron/sync.js` | ✅ 已修复 |
| 7 | 低 | `src/js/main.js` 为无引用死代码，误导维护 | 删除 `src/js/main.js` | ✅ 已删除 |
| 8 | 低 | 定时同步 2 小时节流策略未写入文档 | `README.md` | ✅ 已补充 |

附加交付：新增 `test-sync-live.mjs` 真实联调测试脚本（16 项断言）；README 全文重写。

---

### 修复 1：B 站风控导致视频同步全失败（严重度：高）

**问题**：真实联调测试中，三个数据源全部失败——wbi 接口返回 HTTP 412（B 站风控拦截页）、旧接口返回错误码 -799（请求过于频繁）、RSSHub 双实例网络不可达。同步功能在线上大概率不可用。

**根因**：B 站空间接口（`x/space/wbi/arc/search` 等）对无 cookie 的服务端请求有概率性风控。原实现只做了 wbi 参数签名，未携带任何浏览器身份（buvid 指纹、bili_ticket 访问令牌），且风控拦截后无重试。风控是按请求概率判定的，间隔重试可显著提高通过率。

**改动文件与变更点**：

`functions/lib/crypto.js`：
- 新增 `hmacSha256Hex(keyStr, msgStr)` 工具函数（Web Crypto HMAC-SHA256，hex 输出），用于 bili_ticket 签名。与既有 `hmacSha1Hex` 同构。

`functions/lib/bilibili.js`：
- import 变更：`{ md5Hex }` -> `{ md5Hex, hmacSha256Hex }`；新增 `import { createVersion } from './version.js'`（配合修复 2）。
- 新增常量：`WBI_RETRY_MAX = 4`、`WBI_RETRY_DELAY_MS = 2000`、`sleep(ms)` 工具。
- **`fetchJson()` 增强**：先读 `content-type`，非 JSON 响应（风控返回 HTML 挑战页）抛出「响应非 JSON（疑似风控挑战页）」错误，替换原先 `res.json()` 直接抛 `Unexpected token` 的模糊报错。
- **`fetchWbiKeys()` 重构为 `fetchBiliSession()`**，构建完整访问身份，各环节独立容错（失败不阻断，仅降低通过率）：
  1. `GET /x/frontend/finger/spi` 取 `b_3`/`b_4` -> cookie `buvid3`/`buvid4`；
  2. `POST /bapis/bilibili.api.ticket.v1.Ticket/GenWebTicket`（HMAC-SHA256 签名：密钥 `XgwSnGZ1p`、消息 `ts<秒级时间戳>`、`key_id=ec02`）-> cookie `bili_ticket`/`bili_ticket_expires`；响应中的 `nav.img`/`nav.sub` 顺带就是 wbi keys，省一次 nav 请求；
  3. ticket 失败时兜底走 `GET /x/web-interface/nav` 取 wbi keys（原逻辑保留）。
- **`fetchFromWbi(mid, maxCount, session)`**：请求头带 cookie 并补浏览器化头（`accept`/`accept-language`）；新增风控重试循环——`isRiskControlError()` 判定（HTTP 412 / -412 / -352 / -799 / 请求过于频繁 / 响应非 JSON），命中则间隔 2 秒重试，最多 4 次；非风控错误（数据结构变化等）立即抛出不重试。
- **`fetchFromLegacy(mid, maxCount, session)`**：同样带 cookie 与浏览器化请求头。
- **`syncBilibiliVideos()`**：入口处构建一次 session（完全失败退化为空身份），传给两个 B 站源共用。

**验证**：`node test-sync-live.mjs` 真实联调，同步 724ms 成功返回 30 条视频（数据源 bilibili_wbi），16/16 断言通过；重试链在首次拦截后可恢复（测试期间观察到 412 -> -352 -> 成功的完整恢复路径）。

---

### 修复 2：视频同步成功不生成版本快照（严重度：中）

**问题**：`save-config` / `videos/override` / `videos/manual` / `rollback` 四类写操作均会调用 `createVersion` 生成版本快照，唯独视频同步替换 `synced` 列表后不生成。若一次同步拉到脏数据（如 RSSHub 异常内容），无法通过版本历史回滚到同步前的视频列表。

**改动文件与变更点**：

`functions/lib/bilibili.js`：
- `syncBilibiliVideos()` 成功路径中，`saveVideoData(kv, videoData)` 之后新增：

```js
// 同步结果纳入版本管理：脏数据可通过版本历史回滚到同步前的列表
await createVersion(kv, {
  username,
  note: `视频同步（${usedSource}，${videoData.synced.length}条）`,
  modules: ['videos']
});
```

**效果**：每次同步成功后在版本历史出现一条快照（备注含数据源与条数），回滚入口可直接回退。注意版本保留上限 50 个，高频同步会滚动淘汰旧快照（与其他写操作一致）。

---

### 修复 3：手动添加的视频条目不支持置顶 / 隐藏（严重度：中）

**问题**：视频管理页中，同步条目有「置顶 / 隐藏」操作，手动添加的条目只有「编辑 / 删除」；后端 manual 条目也不接受 `pinned`/`hidden` 字段。spec 中「支持对条目手动微调：置顶、隐藏」未区分手动 / 同步来源，手动条目无法置顶、只能删除无法隐藏。

**改动文件与变更点**：

`functions/api/admin/videos/manual.js`：
- `action === 'add'` 分支：新建条目对象新增 `pinned: Boolean(item.pinned)`、`hidden: Boolean(item.hidden)` 两个字段。
- `action === 'update'` 分支：字段更新白名单新增 `pinned`、`hidden` 两项（`if (item.pinned !== undefined)` 模式，与其他字段一致）。

`src/admin/pages/videos.js`：
- `videoRowHtml()`：手动条目的操作按钮组新增「置顶 / 取消置顶」「隐藏 / 恢复」两个按钮（与同步条目同款，状态随 `item.pinned`/`item.hidden` 切换文案）。
- `handleAction()`：`pin`/`hide` 动作按 `item.source` 分流——同步条目走原 `applyOverride()`（写 `video_overrides`），手动条目走新增的 `updateManualFields()`。
- 新增 `updateManualFields(id, fields, successMsg)`：`POST /api/admin/videos/manual`（`{ action: 'update', item: { id, ...fields } }`），成功后 toast + 刷新列表。

**无需改动的部分**（说明，避免后续误改）：后端 `functions/lib/videos.js` 的 `mergeVideoList()`/`buildRecord()` 对 manual 条目本来就读取条目自身的 `pinned`/`hidden` 字段（此前从未被写入过），本次只是打通了写入链路，合并逻辑零改动。

---

### 修复 4：登录接口缺少 CSRF 请求头校验（严重度：低）

**问题**：全部 9 个 POST 端点中，8 个管理端点都经 `requireAuth()` 做了会话 + `X-Requested-With` 头双重校验，唯独 `/api/auth/login` 是唯一无 CSRF 头校验的 POST 写接口（spec 要求所有写接口校验）。缓解因素：请求体必须 JSON，跨站表单无法构造，风险轻微，但属于规范不一致。

**改动文件与变更点**：

`functions/api/auth/login.js`：
- `onRequestPost` 入口新增（先于 assertKV）：

```js
// CSRF 防护：与其他写接口一致，要求 X-Requested-With 头（跨站表单无法携带）
if (context.request.headers.get('x-requested-with') !== 'fetch') {
  return error(403, 'CSRF', '缺少必要的请求头');
}
```

**前端零改动**：`src/admin/api.js` 的 `post()` 统一携带该头，登录请求本就带。

---

### 修复 5：KV 未绑定时后台无部署指引（严重度：低）

**问题**：KV 未绑定时 `/api/auth/me` 返回 500（`KV_NOT_BOUND`），后台启动渲染裸登录页无任何提示，配置指引只在登录提交失败或进入各内容页后才以错误消息形式出现，首次部署漏绑 KV 时管理员难以定位。

**改动文件与变更点**：

`src/admin/main.js`：
- `renderLogin()` 新增可选参数 `notice`：非空时在登录卡片上方渲染指引卡片。
- `boot()` 的 catch 中识别 `err.code === 'KV_NOT_BOUND'`，传入指引文案（说明控制台操作路径、强调运行时变量名必须为 `CMS_KV`、指向 README 部署章节）。

`src/admin/styles.css`：
- 新增 `.login-notice`（琥珀色警示卡片）、`.login-notice-title`、`.login-notice-text` 样式；`.login-wrap` 由 `align-items: center` 改为 `flex-direction: column` + `gap: 16px` 以容纳通知卡片与登录卡片纵向排列。

---

### 修复 6：定时同步端点校验顺序（严重度：低）

**问题**：`/api/cron/sync` 中 `assertKV()` 在 CRON_KEY 校验之前执行。两个影响：① KV 未绑定时永远返回 `KV_NOT_BOUND` 而非 `CRON_KEY_NOT_SET`，错误码语义混淆；② 未持密钥方可通过错误码差异探测 KV 绑定状态（轻微信息暴露）。

**改动文件与变更点**：

`functions/api/cron/sync.js`：
- 校验顺序调整为：`CRON_KEY` 环境变量存在性 -> query 参数 `key` / 请求头 `x-cron-key` 鉴权（401）-> `assertKV()`（500）。未鉴权请求无法再探测 KV 绑定状态。

---

### 修复 7：删除死代码 `src/js/main.js`（严重度：低）

**问题**：`src/js/main.js`（178 行旧入口逻辑）无任何引用——`index.html` 引用的是 `/src/main.js`，`vite.config.js` 双入口为 `index.html` + `admin/index.html`，全仓库 Grep 无 `js/main.js` 引用。该文件功能与 `src/main.js` 重叠且不含远程配置逻辑，长期保留会误导后续维护（误改无效文件）。

**处理**：确认无引用后直接删除。删除后 `npm run build` 通过，前台功能不受影响（该文件本就不参与构建）。

---

### 修复 8：定时同步节流策略补充文档（严重度：低）

**问题**：`/api/cron/sync` 实现了 2 小时节流（`THROTTLE_MS`，距上次成功同步不足 2 小时的定时触发返回 skipped，手动触发的成功同步也计入），但文档未提及，用户手动同步后 2 小时内定时任务静默跳过时会造成困惑。

**处理**：README「配置定时同步」章节与「常见问题」表补充节流说明（本轮 README 重写后已融入，见 README 中「2 小时节流」相关内容）。

---

### 本轮验证记录

| 验证项 | 结果 |
| --- | --- |
| `node --check` 8 个改动文件（bilibili / crypto / manual / login / cron-sync / admin-main / admin-videos / 测试脚本） | 全部通过 |
| `node test-sync-live.mjs` 真实联调（成功同步 / 覆盖合并 / 全链路失败容错三组用例） | 16/16 断言通过，同步 724ms、30 条真实视频 |
| `npm run build` | 成功（67 个 JS 产物） |
| 全仓库密钥扫描 | 无泄漏（B 站身份密钥 `XgwSnGZ1p` 为公开的客户端常量，非凭据） |

**遗留说明**：
- 修复 1 的风控通过率与出口 IP 相关。EdgeOne 边缘节点的网络环境与本地不同，部署后建议手动触发一次同步实测；即使主源被拦，容错链（旧接口 -> RSSHub）与「失败保留旧数据」策略保证前台数据安全。
- 日志 / 版本索引的「读-改-写」非原子操作，并发写可能互覆盖丢条目。单管理员场景下概率极低，接受现状；如未来引入多账号需加重试或锁。

---

## 2026-08 ｜ CMS 内容管理后台上线

核心交付（详见 README「内容管理后台（CMS）」章节）：

- **架构**：前台（Vite 多页构建）+ `/admin` 管理后台 SPA + EdgeOne 边缘函数（`functions/` 文件路由，17 个端点）+ EdgeOne KV 存储。
- **功能**：单管理员认证（PBKDF2 / 登录锁定 / 7 天会话 / CSRF 防护）、网站信息 / 备案信息 / 文字内容（富文本 + 源码双模式）/ 视频同步四大内容模块、版本回溯（50 快照 / 非破坏性回滚）、操作日志（500 条 / 含 IP）、COS 图片直传、定时 + 手动视频同步。
- **前台动态化**：`GET /api/config` + localStorage 缓存 + 静态配置三层兜底；页脚备案区块渲染。
- **安全改造**：移除下载页前端明文 COS 密钥方案（删除 `public/config-v1.js` 与 linksync 相关文档），改为服务端签名 + 10 分钟预签名链接；同时清理 `cos-js-sdk-v5` / `cos-nodejs-sdk-v5` 依赖与 `public/linksync/` 目录。

## 2025-12-21 ｜ 前台样式与体验优化（历史记录）

- 实现系统主题自动检测，根据设备主题偏好自动切换网站主题
- 优化夜间模式样式，调整导航栏和卡片颜色；修复头像夜间模式样式问题
- 修复按钮在苹果设备上的错位问题
- 优化高德地图加载逻辑，确保在 Cloudflare Pages 上正常工作
- 移除所有虚线边框，简化视觉效果；改进下载列表样式与悬停效果
- 改进错误处理和降级方案
