# 变更说明（CHANGELOG）

按日期倒序记录代码级变更，每条包含：问题描述、根因、改动文件与具体变更点、验证结果。
面向后续维护查阅，修改相关模块前建议先读对应条目。

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
