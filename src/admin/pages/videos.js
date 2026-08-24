/**
 * 视频管理页（#/videos）
 *
 * 职责：管理首页「更多视频」列表：
 * - 同步状态展示（上次同步时间 / 状态 / 数据源 / 失败原因）与手动触发 B 站同步
 * - 同步设置（videoSync 模块：B站 UID mid / 最大同步条数 maxCount）
 * - 同步视频字段微调（override：改标题 / 描述、置顶、隐藏、标记合作）
 * - 手动视频条目的增 / 改 / 删（manual），手动条目在同步时保留
 *
 * 可用 API（均经 src/admin/api.js 调用）：
 * - GET /api/admin/videos            取数据，返回 { manual, synced, overrides, display, syncState }
 * - POST /api/admin/videos/sync      手动同步，返回 { ok, syncState, error? }（失败也是 200，看 ok 字段）
 * - POST /api/admin/videos/override  微调，body：{ bvid, overrides: { title?, description?, hidden?, pinned?, cooperation? } }
 * - POST /api/admin/videos/manual    手动条目，body：{ action: 'add'|'update'|'delete', item }
 * - GET /api/config                  公开配置接口，读取 videoSync 当前设置
 * - POST /api/admin/save-config      保存同步设置，body：{ modules: { videoSync: { mid, maxCount } } }
 *
 * 说明：列表在页面内基于 manual + synced + overrides 合并（含隐藏项，排序规则与
 * 后端 mergeVideoList 一致），以支持「显示已隐藏条目」开关；display 字段仅作参考不直接使用。
 */
import { get, post } from '../api.js';
import {
    toast,
    confirmDialog,
    createUnsavedGuard,
    registerGuard,
    formatTime,
    emptyState,
    showLoading,
    hideLoading
} from '../ui.js';
import { icon } from '../icons.js';

/* ------------------------------------------------------------
 * 常量与纯工具
 * ------------------------------------------------------------ */

/** 数据源名称映射（syncState.source -> 展示文案） */
const SOURCE_NAMES = {
    bilibili_wbi: 'B站官方接口',
    bilibili_legacy: 'B站旧接口',
    rsshub: 'RSSHub'
};

/** 同步状态徽章映射（lastStatus -> 文案与样式类） */
const STATUS_BADGES = {
    success: { text: '同步成功', cls: 'badge-success' },
    error: { text: '同步失败', cls: 'badge-danger' },
    never: { text: '从未同步', cls: 'badge-gray' }
};

/** 封面占位图（灰色 SVG，外链封面加载失败时替换，避免出现裂图） */
const COVER_PLACEHOLDER =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='24'%3E%3Crect width='40' height='24' fill='%23e5e7eb'/%3E%3C/svg%3E";

/** HTML 转义，防止视频标题 / 描述等外部内容注入破坏页面结构 */
function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * 合并 manual / synced / overrides 为完整条目列表（含隐藏项）
 * 排序规则与后端 mergeVideoList 保持一致：置顶优先（组内稳定），其余按时间降序
 * @param {object} data /api/admin/videos 响应
 * @returns {Array<object>} 展示记录数组
 */
function buildFullList(data) {
    const overrides = (data && data.overrides) || {};
    const manualList = Array.isArray(data && data.manual) ? data.manual : [];
    const syncedList = Array.isArray(data && data.synced) ? data.synced : [];

    const records = [];
    manualList.forEach((item) => {
        records.push(buildRecord(item, 'manual', null, records.length));
    });
    syncedList.forEach((item) => {
        const bvid = item && item.bvid;
        const override = bvid && overrides[bvid] ? overrides[bvid] : null;
        records.push(buildRecord(item, 'synced', override, records.length));
    });

    records.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (a.pinned) return a.index - b.index;
        if (a.ts !== b.ts) return b.ts - a.ts;
        return a.index - b.index;
    });
    return records;
}

/**
 * 构造单条展示记录（synced 条目应用 overrides 覆盖字段）
 * @param {object} item 原始条目（manual 或 synced）
 * @param {string} source 来源：'manual' | 'synced'
 * @param {object|null} override 该 bvid 的覆盖配置（仅 synced 条目）
 * @param {number} index 原始序号（稳定排序用）
 * @returns {object}
 */
function buildRecord(item, source, override, index) {
    const merged = { ...(item || {}) };
    if (override) {
        for (const field of ['title', 'description', 'cooperation', 'pinned', 'hidden']) {
            if (override[field] !== undefined) merged[field] = override[field];
        }
    }
    return {
        key: source === 'manual' ? `manual:${merged.id || index}` : `sync:${merged.bvid || index}`,
        id: merged.id || null,
        bvid: merged.bvid || '',
        title: merged.title || '',
        description: merged.description || '',
        cover: merged.cover || '',
        url: merged.url || '',
        cooperation: merged.cooperation === true,
        source,
        pinned: merged.pinned === true,
        hidden: merged.hidden === true,
        ts: merged.pubdate || merged.createdAt || 0,
        index
    };
}

/* ------------------------------------------------------------
 * 页面渲染与交互
 * ------------------------------------------------------------ */

/** 渲染视频管理页 @param {HTMLElement} container */
export function render(container) {
    /* ---------- 页面状态 ---------- */
    /** /api/admin/videos 响应（null 表示尚未加载成功） */
    let data = null;
    /** 合并后的完整条目列表（含隐藏项） */
    let items = [];
    /** 同步设置输入值（均为字符串） */
    const settings = { mid: '', maxCount: '', biliCookie: '' };
    /** 来源筛选：'all' | 'sync' | 'manual' */
    let sourceFilter = 'all';
    /** 是否显示已隐藏条目 */
    let showHidden = false;
    /** 是否正在执行同步（期间禁用所有同步入口） */
    let syncing = false;
    /** 初始加载失败信息（null 表示无） */
    let loadError = null;

    /** 同步设置的未保存守卫（输入即标记脏，保存成功后清除） */
    const guard = createUnsavedGuard();
    registerGuard(guard);

    /* ---------- 渲染 ---------- */

    /** 页头 HTML */
    function pageHeaderHtml() {
        return `
        <div class="page-header">
            <h2>视频管理</h2>
            <span class="page-tip">管理“更多视频”列表：同步 B 站空间最新视频，可对条目置顶/隐藏/微调，手动条目同步时保留。</span>
        </div>`;
    }

    /** 同步按钮 HTML（同步进行中时禁用并显示进度文案） */
    function syncButtonHtml() {
        return syncing
            ? '<button type="button" class="btn btn-primary" data-role="sync-btn" disabled>同步中…（可能需要30秒）</button>'
            : '<button type="button" class="btn btn-primary" data-role="sync-btn">立即同步</button>';
    }

    /** 同步状态卡片 HTML（状态信息 + 失败详情 + 立即同步 + 同步设置） */
    function syncCardHtml() {
        const syncState = (data && data.syncState) || {};
        const status = STATUS_BADGES[syncState.lastStatus] || STATUS_BADGES.never;
        const sourceName = syncState.source
            ? SOURCE_NAMES[syncState.source] || String(syncState.source)
            : '-';

        // 上次同步失败：红色警示框展示错误全文（等宽字体、可换行）并提供重试入口
        const errorBox =
            syncState.lastStatus === 'error'
                ? `
        <div style="margin-top:14px;padding:12px 14px;border:1px solid #fecaca;background:#fef2f2;border-radius:6px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;">
                <span style="font-size:13px;font-weight:600;color:#b91c1c;">上次同步失败</span>
                <button type="button" class="btn btn-sm" data-role="retry-sync"${syncing ? ' disabled' : ''}>重试同步</button>
            </div>
            <pre style="margin:0;font-family:Consolas,Menlo,monospace;font-size:12px;line-height:1.6;color:#b91c1c;white-space:pre-wrap;word-break:break-all;">${escapeHtml(syncState.lastError || '未知错误')}</pre>
        </div>`
                : '';

        return `
        <div class="card" data-role="sync-card">
            <div class="card-title">同步状态</div>
            <div style="display:flex;flex-wrap:wrap;gap:12px 48px;align-items:flex-start;">
                <div>
                    <div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:4px;">上次同步</div>
                    <div>${formatTime(syncState.lastSyncAt)}</div>
                </div>
                <div>
                    <div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:4px;">状态</div>
                    <div><span class="badge ${status.cls}">${status.text}</span></div>
                </div>
                <div>
                    <div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:4px;">数据源</div>
                    <div>${escapeHtml(sourceName)}</div>
                </div>
            </div>
            ${errorBox}
            <div style="margin-top:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                ${syncButtonHtml()}
                <span style="font-size:12px;color:var(--color-text-secondary);">从 B 站拉取最新视频，约需 10-45 秒</span>
            </div>
            <div style="border-top:1px solid var(--color-border);margin-top:18px;"></div>
            <div class="form-group" style="display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;margin:16px 0 0;">
                <div style="width:200px;">
                    <label class="form-label" for="video-mid">B站 UID（mid）</label>
                    <input class="form-input" id="video-mid" type="text" inputmode="numeric"
                           placeholder="如 28826850" value="${escapeHtml(settings.mid)}">
                </div>
                <div style="width:160px;">
                    <label class="form-label" for="video-max-count">最大同步条数</label>
                    <input class="form-input" id="video-max-count" type="number" min="5" max="100" step="1"
                           value="${escapeHtml(settings.maxCount)}">
                </div>
                <button type="button" class="btn btn-sm" data-role="save-settings">保存设置</button>
            </div>
            <div class="form-group" style="margin:14px 0 0;">
                <label class="form-label" for="video-bili-cookie">B 站 Cookie（可选，大幅提高同步成功率）</label>
                <textarea class="form-input" id="video-bili-cookie" rows="3"
                    placeholder="浏览器 F12 → Application → Cookies → bilibili.com → 复制全部 cookie 值，格式如 SESSDATA=xxx; bili_jct=yyy; ...&#10;留空则使用匿名身份（风控概率高，可能同步失败）"
                    style="font-family:Consolas,Menlo,monospace;font-size:12px;">${escapeHtml(settings.biliCookie)}</textarea>
                <div class="form-hint" style="margin-top:6px;">
                    登录态 Cookie 可绕过大部分风控，建议配置。Cookie 安全存储于服务端，不会返回到前端。
                    过期后（通常 2-3 个月）重新粘贴即可。
                    <button type="button" class="link-btn" data-role="clear-cookie" style="margin-left:8px;">清空 Cookie</button>
                </div>
            </div>
            <div class="form-hint" style="margin-top:8px;">修改将在下次同步时生效</div>
        </div>`;
    }

    /** 表格操作按钮 HTML */
    function actionBtnHtml(act, item, text, danger) {
        return `<button type="button" class="btn btn-sm${danger ? ' btn-danger' : ''}" data-act="${act}" data-key="${escapeHtml(item.key)}">${escapeHtml(text)}</button>`;
    }

    /** 单行视频 HTML */
    function videoRowHtml(item) {
        const coverSrc = item.cover ? escapeHtml(item.cover) : COVER_PLACEHOLDER;

        // 状态徽章：置顶 / 合作 / 隐藏（可并列），无任何状态时显示 '-'
        const badges = [];
        if (item.pinned) badges.push('<span class="badge badge-warning">已置顶</span>');
        if (item.cooperation) badges.push('<span class="badge badge-success">合作</span>');
        if (item.hidden) badges.push('<span class="badge badge-danger">已隐藏</span>');
        const statusHtml = badges.length
            ? `<div style="display:flex;gap:6px;flex-wrap:wrap;">${badges.join('')}</div>`
            : '<span style="color:var(--color-text-secondary);">-</span>';

        // 操作按钮：两类条目均支持置顶 / 隐藏；同步条目另有编辑 / 合作切换，手动条目另有编辑 / 删除
        const actions = [];
        if (item.source === 'sync') {
            actions.push(actionBtnHtml('pin', item, item.pinned ? '取消置顶' : '置顶'));
            actions.push(actionBtnHtml('hide', item, item.hidden ? '取消隐藏' : '隐藏'));
            actions.push(actionBtnHtml('edit-sync', item, '编辑'));
            actions.push(actionBtnHtml('coop', item, item.cooperation ? '取消合作' : '合作'));
        } else {
            actions.push(actionBtnHtml('pin', item, item.pinned ? '取消置顶' : '置顶'));
            actions.push(actionBtnHtml('hide', item, item.hidden ? '取消隐藏' : '隐藏'));
            actions.push(actionBtnHtml('edit-manual', item, '编辑'));
            actions.push(actionBtnHtml('delete-manual', item, '删除', true));
        }

        return `
        <tr${item.hidden ? ' style="opacity:0.55;"' : ''}>
            <td><img class="video-cover" src="${coverSrc}" alt="封面" loading="lazy"
                 style="display:block;width:40px;height:24px;object-fit:cover;border-radius:3px;background:#f3f4f6;"></td>
            <td class="cell-ellipsis" title="${escapeHtml(item.title)}">${escapeHtml(item.title || '（无标题）')}</td>
            <td><span class="badge${item.source === 'manual' ? ' badge-gray' : ''}">${item.source === 'manual' ? '手动' : '同步'}</span></td>
            <td>${statusHtml}</td>
            <td>${formatTime(item.ts)}</td>
            <td><div class="cell-actions">${actions.join('')}</div></td>
        </tr>`;
    }

    /** 视频列表卡片 HTML（工具栏 + 表格 / 空状态） */
    function listCardHtml() {
        // 应用筛选：默认隐藏已隐藏条目；开启开关后一并显示
        const list = items.filter((item) => {
            if (!showHidden && item.hidden) return false;
            if (sourceFilter !== 'all' && item.source !== sourceFilter) return false;
            return true;
        });

        const body = list.length
            ? `<div class="table-wrap">
                <table class="table">
                    <thead>
                        <tr>
                            <th style="width:64px;">封面</th>
                            <th>标题</th>
                            <th style="width:72px;">来源</th>
                            <th style="width:180px;">状态</th>
                            <th style="width:140px;">发布时间</th>
                            <th style="width:290px;">操作</th>
                        </tr>
                    </thead>
                    <tbody>${list.map(videoRowHtml).join('')}</tbody>
                </table>
            </div>`
            : emptyState(
                  items.length
                      ? '当前筛选条件下暂无视频条目'
                      : '暂无视频条目，可点击「立即同步」从 B 站拉取，或新增手动视频'
              );

        return `
        <div class="card" data-role="list-card">
            <div class="card-title">视频列表<span class="card-tip">共 ${list.length} 条</span></div>
            <div class="toolbar">
                <select class="form-select" data-role="source-filter" style="width:auto;">
                    <option value="all"${sourceFilter === 'all' ? ' selected' : ''}>全部来源</option>
                    <option value="sync"${sourceFilter === 'sync' ? ' selected' : ''}>同步</option>
                    <option value="manual"${sourceFilter === 'manual' ? ' selected' : ''}>手动</option>
                </select>
                <span style="display:inline-flex;align-items:center;gap:8px;">
                    <label class="toggle"><input type="checkbox" data-role="show-hidden"${showHidden ? ' checked' : ''}><span class="toggle-track"></span></label>
                    <span style="font-size:13px;color:var(--color-text-secondary);">显示已隐藏条目</span>
                </span>
                <div class="toolbar-right">
                    <button type="button" class="btn" data-role="add-manual">新增手动视频</button>
                </div>
            </div>
            ${body}
        </div>`;
    }

    /** 数据加载完成后整页渲染（重建 DOM 并重新绑定事件） */
    function renderPage() {
        container.innerHTML = `${pageHeaderHtml()}
${syncCardHtml()}
${listCardHtml()}`;
        bindEvents();
    }

    /** 初始加载失败视图（提供重试入口） */
    function renderLoadError() {
        container.innerHTML = `${pageHeaderHtml()}
        <div class="card">
            <div class="empty">
                <div class="empty-icon">${icon('alert-circle', { class: 'w-12 h-12' })}</div>
                <div class="empty-text">视频数据加载失败：${escapeHtml(loadError || '未知错误')}</div>
                <div style="margin-top:12px;">
                    <button type="button" class="btn btn-sm" data-role="retry-load">重试加载</button>
                </div>
            </div>
        </div>`;
        bindEvents();
    }

    /** 首次加载骨架（配合 showLoading 遮罩） */
    function renderSkeleton() {
        container.innerHTML = `${pageHeaderHtml()}
        <div class="card">
            <div class="empty">
                <div class="empty-icon">${icon('video', { class: 'w-12 h-12' })}</div>
                <div class="empty-text">正在加载视频数据…</div>
            </div>
        </div>`;
    }

    /** 绑定页面事件（renderPage / renderLoadError 后调用，按需绑定存在的元素） */
    function bindEvents() {
        // 立即同步 / 失败重试 / 加载失败重试
        const syncBtn = container.querySelector('[data-role="sync-btn"]');
        if (syncBtn) syncBtn.addEventListener('click', handleSync);

        const retrySyncBtn = container.querySelector('[data-role="retry-sync"]');
        if (retrySyncBtn) retrySyncBtn.addEventListener('click', handleSync);

        const retryLoadBtn = container.querySelector('[data-role="retry-load"]');
        if (retryLoadBtn) retryLoadBtn.addEventListener('click', load);

        // 同步设置输入：记录当前值并标记未保存
        const midInput = container.querySelector('#video-mid');
        if (midInput) {
            midInput.addEventListener('input', () => {
                settings.mid = midInput.value;
                guard.setDirty(true);
            });
        }
        const maxCountInput = container.querySelector('#video-max-count');
        if (maxCountInput) {
            maxCountInput.addEventListener('input', () => {
                settings.maxCount = maxCountInput.value;
                guard.setDirty(true);
            });
        }
        const cookieInput = container.querySelector('#video-bili-cookie');
        if (cookieInput) {
            cookieInput.addEventListener('input', () => {
                settings.biliCookie = cookieInput.value;
                guard.setDirty(true);
            });
        }
        const clearCookieBtn = container.querySelector('[data-role="clear-cookie"]');
        if (clearCookieBtn) {
            clearCookieBtn.addEventListener('click', () => {
                settings.biliCookie = '';
                if (cookieInput) cookieInput.value = '';
                guard.setDirty(true);
                toast('已清空 Cookie（记得点保存设置生效）', 'info');
            });
        }

        const saveBtn = container.querySelector('[data-role="save-settings"]');
        if (saveBtn) saveBtn.addEventListener('click', handleSaveSettings);

        // 列表工具栏：来源筛选 / 隐藏项开关 / 新增手动视频
        const filterSelect = container.querySelector('[data-role="source-filter"]');
        if (filterSelect) {
            filterSelect.addEventListener('change', () => {
                sourceFilter = filterSelect.value;
                renderPage();
            });
        }

        const showHiddenToggle = container.querySelector('[data-role="show-hidden"]');
        if (showHiddenToggle) {
            showHiddenToggle.addEventListener('change', () => {
                showHidden = showHiddenToggle.checked;
                renderPage();
            });
        }

        const addBtn = container.querySelector('[data-role="add-manual"]');
        if (addBtn) addBtn.addEventListener('click', () => openManualModal(null));

        // 表格操作按钮（事件委托）与封面加载失败兜底
        const listCard = container.querySelector('[data-role="list-card"]');
        if (listCard) {
            listCard.addEventListener('click', (event) => {
                const btn = event.target.closest('[data-act]');
                if (!btn || !listCard.contains(btn)) return;
                const item = items.find((entry) => entry.key === btn.dataset.key);
                if (item) handleAction(btn.dataset.act, item);
            });
            listCard.querySelectorAll('img.video-cover').forEach((img) => {
                img.addEventListener(
                    'error',
                    () => {
                        img.src = COVER_PLACEHOLDER;
                    },
                    { once: true }
                );
            });
        }
    }

    /* ---------- 数据加载 ---------- */

    /** 刷新数据：重新拉取 /api/admin/videos 并整页重渲染（内部捕获错误，不向外抛） */
    async function refresh() {
        const listCard = container.querySelector('[data-role="list-card"]');
        if (listCard) showLoading(listCard, '刷新中…');
        try {
            data = await get('/api/admin/videos');
            items = buildFullList(data);
        } catch (err) {
            toast(err.message || '刷新数据失败', 'error');
        }
        // 重渲染会重建 DOM，加载遮罩随旧节点一并移除
        renderPage();
    }

    /** 首次加载：拉取视频数据（含同步设置 videoSync） */
    async function load() {
        renderSkeleton();
        showLoading(container, '正在加载视频数据…');
        try {
            const videos = await get('/api/admin/videos');
            data = videos;
            items = buildFullList(data);
            loadError = null;

            // 从 admin 接口读取 videoSync 设置，回填同步设置表单
            const videoSync = data && data.videoSync;
            if (videoSync) {
                settings.mid =
                    videoSync.mid === null || videoSync.mid === undefined ? '' : String(videoSync.mid);
                settings.maxCount =
                    videoSync.maxCount === null || videoSync.maxCount === undefined
                        ? ''
                        : String(videoSync.maxCount);
                settings.biliCookie =
                    videoSync.biliCookie === null || videoSync.biliCookie === undefined
                        ? ''
                        : String(videoSync.biliCookie);
            }
            renderPage();
        } catch (err) {
            loadError = err.message || '未知错误';
            renderLoadError();
        } finally {
            hideLoading(container);
        }
    }

    /* ---------- 同步与设置 ---------- */

    /** 立即同步：二次确认 -> 禁用入口 -> POST sync -> 按结果提示并刷新 */
    async function handleSync() {
        if (syncing) return;

        const ok = await confirmDialog({
            title: '立即同步',
            message: '将从 B 站拉取最新视频列表并更新展示，已保存的置顶/隐藏/编辑会保留。确定同步吗？',
            danger: true,
            confirmText: '开始同步'
        });
        if (!ok) return;

        syncing = true;
        updateSyncButtons();
        try {
            const result = await post('/api/admin/videos/sync');
            if (result && result.ok) {
                const count = (result.syncState && result.syncState.itemCount) || 0;
                toast(`同步成功，共 ${count} 条`, 'success');
            } else {
                // 同步失败也是 200：通过 ok / error 字段区分
                toast(`同步失败：${(result && result.error) || '未知错误'}`, 'error');
            }
        } catch (err) {
            toast(err.message || '同步请求失败', 'error');
        } finally {
            syncing = false;
            // 无论成败都刷新整页数据（同步状态与列表可能已变化）
            await refresh();
        }
    }

    /** 同步进行中状态切换：更新同步按钮的禁用态与文案（不整页重渲染） */
    function updateSyncButtons() {
        const syncBtn = container.querySelector('[data-role="sync-btn"]');
        if (syncBtn) {
            syncBtn.disabled = syncing;
            syncBtn.textContent = syncing ? '同步中…（可能需要30秒）' : '立即同步';
        }
        const retryBtn = container.querySelector('[data-role="retry-sync"]');
        if (retryBtn) retryBtn.disabled = syncing;
    }

    /** 保存同步设置：校验 -> 二次确认 -> save-config */
    async function handleSaveSettings() {
        const mid = String(settings.mid || '').trim();
        const maxCount = Number(settings.maxCount);
        const biliCookie = String(settings.biliCookie || '').trim();

        if (!/^\d+$/.test(mid)) {
            toast('请输入有效的 B 站 UID（纯数字）', 'error');
            return;
        }
        if (!Number.isInteger(maxCount) || maxCount < 5 || maxCount > 100) {
            toast('最大同步条数需为 5-100 之间的整数', 'error');
            return;
        }

        const cookieNote = biliCookie ? '（已配置 B 站 Cookie）' : '（未配置 B 站 Cookie，可能同步失败）';
        const ok = await confirmDialog({
            title: '保存同步设置',
            message: `将保存：B站 UID ${mid}，最大同步 ${maxCount} 条${cookieNote}。修改在下次同步时生效，确定保存吗？`,
            confirmText: '保存'
        });
        if (!ok) return;

        try {
            await post('/api/admin/save-config', {
                modules: { videoSync: { mid, maxCount, biliCookie } }
            });
            guard.setDirty(false);
            toast('同步设置已保存', 'success');
        } catch (err) {
            toast(err.message || '保存设置失败', 'error');
        }
    }

    /* ---------- 条目操作 ---------- */

    /**
     * 表格操作分发
     * @param {string} act 操作类型（pin / hide / coop / edit-sync / edit-manual / delete-manual）
     * @param {object} item 目标条目（合并后的展示记录）
     */
    async function handleAction(act, item) {
        if (act === 'pin') {
            const pin = !item.pinned;
            const ok = await confirmDialog({
                title: pin ? '置顶视频' : '取消置顶',
                message: pin
                    ? `确定将「${item.title}」置顶吗？置顶后将排在列表最前。`
                    : `确定取消「${item.title}」的置顶吗？`,
                confirmText: pin ? '置顶' : '取消置顶'
            });
            if (!ok) return;
            if (item.source === 'manual') {
                // 手动条目：pinned 存在条目自身字段，走 manual update
                await updateManualFields(item.id, { pinned: pin }, pin ? '已置顶' : '已取消置顶');
            } else {
                await applyOverride(item.bvid, { pinned: pin }, pin ? '已置顶' : '已取消置顶');
            }
        } else if (act === 'hide') {
            const hide = !item.hidden;
            const ok = await confirmDialog({
                title: hide ? '隐藏视频' : '恢复显示',
                message: hide
                    ? `确定隐藏「${item.title}」吗？隐藏后前台不再展示该视频。`
                    : `确定恢复显示「${item.title}」吗？`,
                confirmText: hide ? '隐藏' : '恢复显示'
            });
            if (!ok) return;
            if (item.source === 'manual') {
                // 手动条目：hidden 存在条目自身字段，走 manual update
                await updateManualFields(item.id, { hidden: hide }, hide ? '已隐藏' : '已恢复显示');
            } else {
                await applyOverride(item.bvid, { hidden: hide }, hide ? '已隐藏' : '已恢复显示');
            }
        } else if (act === 'coop') {
            const coop = !item.cooperation;
            const ok = await confirmDialog({
                title: coop ? '标记合作' : '取消合作',
                message: coop
                    ? `确定将「${item.title}」标记为合作视频吗？`
                    : `确定取消「${item.title}」的合作标记吗？`,
                confirmText: coop ? '标记合作' : '取消合作'
            });
            if (!ok) return;
            await applyOverride(item.bvid, { cooperation: coop }, coop ? '已标记合作' : '已取消合作');
        } else if (act === 'edit-sync') {
            openSyncEditModal(item);
        } else if (act === 'edit-manual') {
            openManualModal(item);
        } else if (act === 'delete-manual') {
            await handleDeleteManual(item);
        }
    }

    /**
     * 提交同步条目字段覆盖并刷新列表
     * @param {string} bvid BV 号
     * @param {object} overrides 覆盖字段（pinned / hidden / cooperation / title / description）
     * @param {string} successMsg 成功提示文案
     */
    async function applyOverride(bvid, overrides, successMsg) {
        try {
            await post('/api/admin/videos/override', { bvid, overrides });
            toast(successMsg, 'success');
            await refresh();
        } catch (err) {
            toast(err.message || '操作失败', 'error');
        }
    }

    /**
     * 更新手动条目自身字段（置顶 / 隐藏等）并刷新列表
     * @param {string} id 手动条目 id
     * @param {object} fields 要更新的字段（pinned / hidden）
     * @param {string} successMsg 成功提示文案
     */
    async function updateManualFields(id, fields, successMsg) {
        if (!id) {
            toast('条目缺少 id，无法更新', 'error');
            return;
        }
        try {
            await post('/api/admin/videos/manual', { action: 'update', item: { id, ...fields } });
            toast(successMsg, 'success');
            await refresh();
        } catch (err) {
            toast(err.message || '操作失败', 'error');
        }
    }

    /** 删除手动视频（危险操作二次确认） */
    async function handleDeleteManual(item) {
        const ok = await confirmDialog({
            title: '删除手动视频',
            message: `确定删除「${item.title}」吗？删除后不可恢复。`,
            danger: true,
            confirmText: '删除'
        });
        if (!ok) return;

        try {
            await post('/api/admin/videos/manual', { action: 'delete', item: { id: item.id } });
            toast('已删除', 'success');
            await refresh();
        } catch (err) {
            toast(err.message || '删除失败', 'error');
        }
    }

    /* ---------- 编辑弹窗 ---------- */

    /**
     * 手动视频新增 / 编辑弹窗
     * @param {object|null} item 编辑时传条目，新增时传 null
     */
    function openManualModal(item) {
        const isEdit = Boolean(item);
        const mask = document.createElement('div');
        mask.className = 'modal-mask';
        mask.innerHTML = `
            <div class="modal" role="dialog" aria-modal="true" style="width:520px;">
                <div class="modal-title">${isEdit ? '编辑手动视频' : '新增手动视频'}</div>
                <form novalidate>
                    <div class="form-group">
                        <label class="form-label">标题<span class="required">*</span></label>
                        <input class="form-input" name="title" maxlength="200"
                               placeholder="视频标题" value="${escapeHtml(item ? item.title : '')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">视频链接<span class="required">*</span></label>
                        <input class="form-input" name="url" maxlength="500"
                               placeholder="https://www.bilibili.com/video/BVxxxxxxxx"
                               value="${escapeHtml(item ? item.url : '')}">
                        <div class="form-hint">填写视频页地址，B 站链接会自动识别 BV 号</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">封面 URL</label>
                        <input class="form-input" name="cover" maxlength="1000"
                               placeholder="https://…（可选）" value="${escapeHtml(item ? item.cover : '')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">描述</label>
                        <textarea class="form-textarea" name="description" maxlength="500"
                                  placeholder="视频描述（可选）">${escapeHtml(item ? item.description : '')}</textarea>
                    </div>
                    <div class="form-group">
                        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:500;">
                            <input type="checkbox" name="cooperation"${item && item.cooperation ? ' checked' : ''}>
                            标记为合作视频
                        </label>
                    </div>
                    <div class="form-error" data-role="error"></div>
                    <div class="modal-footer">
                        <button type="button" class="btn" data-role="cancel">取消</button>
                        <button type="submit" class="btn btn-primary" data-role="submit">${isEdit ? '保存' : '添加'}</button>
                    </div>
                </form>
            </div>`;

        const form = mask.querySelector('form');
        const titleInput = form.querySelector('[name="title"]');
        const urlInput = form.querySelector('[name="url"]');
        const coverInput = form.querySelector('[name="cover"]');
        const descriptionInput = form.querySelector('[name="description"]');
        const cooperationInput = form.querySelector('[name="cooperation"]');
        const errorEl = mask.querySelector('[data-role="error"]');
        const submitBtn = mask.querySelector('[data-role="submit"]');
        const close = () => mask.remove();

        mask.querySelector('[data-role="cancel"]').addEventListener('click', close);

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const title = titleInput.value.trim();
            const url = urlInput.value.trim();
            const cover = coverInput.value.trim();
            const description = descriptionInput.value.trim();
            const cooperation = cooperationInput.checked;

            errorEl.textContent = '';
            if (!title) {
                errorEl.textContent = '请填写视频标题';
                return;
            }
            if (!url) {
                errorEl.textContent = '请填写视频链接';
                return;
            }

            submitBtn.disabled = true;
            try {
                const body = isEdit
                    ? { id: item.id, title, url, cover, description, cooperation }
                    : { title, url, cover, description, cooperation };
                await post('/api/admin/videos/manual', {
                    action: isEdit ? 'update' : 'add',
                    item: body
                });
                close();
                toast(isEdit ? '手动视频已更新' : '手动视频已添加', 'success');
                await refresh();
            } catch (err) {
                errorEl.textContent = err.message || '保存失败，请稍后重试';
                submitBtn.disabled = false;
            }
        });

        document.body.appendChild(mask);
        titleInput.focus();
    }

    /**
     * 同步视频微调弹窗（标题 / 描述 / 合作标记 -> POST override）
     * @param {object} item 合并后的同步条目
     */
    function openSyncEditModal(item) {
        const mask = document.createElement('div');
        mask.className = 'modal-mask';
        mask.innerHTML = `
            <div class="modal" role="dialog" aria-modal="true" style="width:520px;">
                <div class="modal-title">编辑同步视频</div>
                <div class="modal-body" style="margin-bottom:16px;">微调「${escapeHtml(item.title)}」的展示内容，保存后将覆盖 B 站同步的原始值。</div>
                <form novalidate>
                    <div class="form-group">
                        <label class="form-label">标题<span class="required">*</span></label>
                        <input class="form-input" name="title" maxlength="200"
                               placeholder="视频标题" value="${escapeHtml(item.title)}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">描述</label>
                        <textarea class="form-textarea" name="description" maxlength="500"
                                  placeholder="视频描述（可选）">${escapeHtml(item.description)}</textarea>
                    </div>
                    <div class="form-group">
                        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:500;">
                            <input type="checkbox" name="cooperation"${item.cooperation ? ' checked' : ''}>
                            标记为合作视频
                        </label>
                    </div>
                    <div class="form-error" data-role="error"></div>
                    <div class="modal-footer">
                        <button type="button" class="btn" data-role="cancel">取消</button>
                        <button type="submit" class="btn btn-primary" data-role="submit">保存</button>
                    </div>
                </form>
            </div>`;

        const form = mask.querySelector('form');
        const titleInput = form.querySelector('[name="title"]');
        const descriptionInput = form.querySelector('[name="description"]');
        const cooperationInput = form.querySelector('[name="cooperation"]');
        const errorEl = mask.querySelector('[data-role="error"]');
        const submitBtn = mask.querySelector('[data-role="submit"]');
        const close = () => mask.remove();

        mask.querySelector('[data-role="cancel"]').addEventListener('click', close);

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const title = titleInput.value.trim();
            const description = descriptionInput.value.trim();
            const cooperation = cooperationInput.checked;

            errorEl.textContent = '';
            if (!title) {
                errorEl.textContent = '标题不能为空';
                return;
            }

            submitBtn.disabled = true;
            try {
                await post('/api/admin/videos/override', {
                    bvid: item.bvid,
                    overrides: { title, description, cooperation }
                });
                close();
                toast('视频微调已保存', 'success');
                await refresh();
            } catch (err) {
                errorEl.textContent = err.message || '保存失败，请稍后重试';
                submitBtn.disabled = false;
            }
        });

        document.body.appendChild(mask);
        titleInput.focus();
    }

    // 启动首次加载
    load();
}
