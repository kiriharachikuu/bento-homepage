/**
 * 仪表盘页（#/dashboard）
 *
 * 职责：站点内容状态概览与快捷入口：
 * - 四个统计卡片：视频总数 / 上次同步 / 版本总数 / 日志总数
 * - 两个列表卡片：最近版本（前 5 条）、最近操作（前 5 条），各带"查看全部"链接
 * - 快捷入口：七个管理页导航 + 查看前台（新窗口）
 *
 * 数据来源（各接口独立容错，Promise.allSettled 互不阻塞）：
 * - GET /api/config         公开配置，取合并展示的 videos 列表长度作为视频总数
 * - GET /api/admin/videos   取 syncState（lastSyncAt / lastStatus / lastError）作为同步状态
 * - GET /api/admin/versions 版本列表，取总数与前 5 条
 * - GET /api/admin/logs     日志分页，一次请求同时取 total 与前 5 条
 */
import { get } from '../api.js';
import { formatTime, emptyState, showLoading, hideLoading } from '../ui.js';
import { icon } from '../icons.js';

/** HTML 转义，防止动态内容破坏结构或注入脚本 */
function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** 日志动作 -> 中文名称 */
const ACTION_NAMES = {
    login: '登录',
    logout: '登出',
    save_config: '保存配置',
    rollback: '版本回滚',
    video_sync: '视频同步',
    video_edit: '视频管理',
    password: '修改密码'
};

/** 日志动作 -> 徽章样式类（默认 badge 为主色蓝） */
const ACTION_BADGE_CLASS = {
    login: 'badge-gray',
    logout: 'badge-gray',
    save_config: 'badge',
    rollback: 'badge-warning',
    video_sync: 'badge-success',
    video_edit: 'badge',
    password: 'badge-danger'
};

/** 渲染动作徽章（未知动作原样灰底展示） */
function actionBadge(action) {
    const name = ACTION_NAMES[action] || action || '-';
    return `<span class="${ACTION_BADGE_CLASS[action] || 'badge-gray'}">${escapeHtml(name)}</span>`;
}

/** 同步状态 -> 徽章文案与样式 */
const SYNC_STATUS = {
    success: { text: '成功', cls: 'badge-success' },
    error: { text: '失败', cls: 'badge-danger' },
    never: { text: '从未同步', cls: 'badge-gray' }
};

/** 列表卡片加载失败提示 */
function loadFailed(message) {
    return `
        <div class="empty" style="padding: 24px 8px">
            <div class="empty-icon">${icon('alert-circle', { class: 'w-12 h-12' })}</div>
            <div class="empty-text" style="color: var(--color-danger)">加载失败：${escapeHtml(message || '未知错误')}</div>
        </div>`;
}

/** 统计数值加载失败占位（错误详情放悬浮提示） */
function statFailed(message) {
    return `<span style="font-size: 14px; font-weight: 500; color: var(--color-danger)" title="${escapeHtml(message || '')}">加载失败</span>`;
}

/** 渲染"上次同步"统计卡片内容 */
function renderSyncStat(el, syncState) {
    if (!syncState) {
        el.innerHTML = '<span style="color: var(--color-text-secondary)">暂无数据</span>';
        return;
    }
    const status = SYNC_STATUS[syncState.lastStatus] || {
        text: syncState.lastStatus || '未知',
        cls: 'badge-gray'
    };
    let html = `
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap">
            <span style="font-size: 18px; font-weight: 600">${escapeHtml(formatTime(syncState.lastSyncAt))}</span>
            <span class="badge ${status.cls}">${escapeHtml(status.text)}</span>
        </div>`;
    // 同步失败时附带错误信息（超长省略，悬浮查看全文）
    if (syncState.lastStatus === 'error' && syncState.lastError) {
        html += `
        <div style="margin-top: 4px; font-size: 12px; color: var(--color-danger); overflow: hidden; text-overflow: ellipsis; white-space: nowrap" title="${escapeHtml(syncState.lastError)}">${escapeHtml(syncState.lastError)}</div>`;
    }
    el.innerHTML = html;
}

/** 最近版本列表（前 5 条：时间 / 操作人 / 备注） */
function renderRecentVersions(versions) {
    const list = versions.slice(0, 5);
    if (!list.length) return emptyState('暂无版本记录');
    const rows = list
        .map(
            (v) => `
        <tr>
            <td style="white-space: nowrap">${escapeHtml(formatTime(v.ts))}</td>
            <td>${escapeHtml(v.author || '-')}</td>
            <td class="cell-ellipsis" title="${escapeHtml(v.note || '')}">${escapeHtml(v.note || '-')}</td>
        </tr>`
        )
        .join('');
    return `
        <div class="table-wrap">
            <table class="table">
                <thead><tr><th>时间</th><th>操作人</th><th>备注</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
}

/** 最近操作列表（前 5 条：时间 / 动作徽章 / 摘要） */
function renderRecentLogs(items) {
    const list = items.slice(0, 5);
    if (!list.length) return emptyState('暂无操作记录');
    const rows = list
        .map(
            (log) => `
        <tr>
            <td style="white-space: nowrap">${escapeHtml(formatTime(log.ts))}</td>
            <td>${actionBadge(log.action)}</td>
            <td class="cell-ellipsis" title="${escapeHtml(log.summary || '')}">${escapeHtml(log.summary || '-')}</td>
        </tr>`
        )
        .join('');
    return `
        <div class="table-wrap">
            <table class="table">
                <thead><tr><th>时间</th><th>动作</th><th>摘要</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
}

/** 渲染仪表盘页 @param {HTMLElement} container */
export async function render(container) {
    container.innerHTML = `
        <div class="page-header">
            <h2>内容管理后台</h2>
            <span class="page-tip">概览站点内容状态，快速进入各管理模块。</span>
        </div>

        <!-- 统计卡片：横排自适应换行（行内样式归零 card 相邻叠加的默认上边距） -->
        <div style="display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 16px">
            <div class="card" style="flex: 1; min-width: 170px; margin-top: 0">
                <div style="font-size: 13px; color: var(--color-text-secondary)">视频总数</div>
                <div style="font-size: 26px; font-weight: 600; margin-top: 6px" id="stat-videos">-</div>
            </div>
            <div class="card" style="flex: 1.2; min-width: 220px; margin-top: 0">
                <div style="font-size: 13px; color: var(--color-text-secondary)">上次同步</div>
                <div style="margin-top: 6px; min-height: 34px" id="stat-sync">-</div>
            </div>
            <div class="card" style="flex: 1; min-width: 170px; margin-top: 0">
                <div style="font-size: 13px; color: var(--color-text-secondary)">版本总数</div>
                <div style="font-size: 26px; font-weight: 600; margin-top: 6px" id="stat-versions">-</div>
            </div>
            <div class="card" style="flex: 1; min-width: 170px; margin-top: 0">
                <div style="font-size: 13px; color: var(--color-text-secondary)">日志总数</div>
                <div style="font-size: 26px; font-weight: 600; margin-top: 6px" id="stat-logs">-</div>
            </div>
        </div>

        <!-- 列表卡片：最近版本 / 最近操作（宽屏并排，窄屏换行） -->
        <div style="display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 16px">
            <div style="flex: 1; min-width: 340px">
                <div class="card" style="margin-top: 0; height: 100%">
                    <div class="card-title" style="display: flex; align-items: center; justify-content: space-between">
                        <span>最近版本</span>
                        <a href="#/versions" style="font-size: 13px; font-weight: 400">查看全部 »</a>
                    </div>
                    <div id="dash-versions"></div>
                </div>
            </div>
            <div style="flex: 1; min-width: 340px">
                <div class="card" style="margin-top: 0; height: 100%">
                    <div class="card-title" style="display: flex; align-items: center; justify-content: space-between">
                        <span>最近操作</span>
                        <a href="#/logs" style="font-size: 13px; font-weight: 400">查看全部 »</a>
                    </div>
                    <div id="dash-logs"></div>
                </div>
            </div>
        </div>

        <!-- 快捷入口 -->
        <div class="card">
            <div class="card-title">快捷入口</div>
            <div style="display: flex; flex-wrap: wrap; gap: 10px">
                <a class="btn inline-flex items-center gap-2" href="#/site">${icon('globe', { class: 'w-4 h-4' })}网站信息</a>
                <a class="btn inline-flex items-center gap-2" href="#/beian">${icon('file-text', { class: 'w-4 h-4' })}备案信息</a>
                <a class="btn inline-flex items-center gap-2" href="#/content">${icon('edit-3', { class: 'w-4 h-4' })}文字内容</a>
                <a class="btn inline-flex items-center gap-2" href="#/videos">${icon('video', { class: 'w-4 h-4' })}视频管理</a>
                <a class="btn inline-flex items-center gap-2" href="#/versions">${icon('clock', { class: 'w-4 h-4' })}版本历史</a>
                <a class="btn inline-flex items-center gap-2" href="#/logs">${icon('list', { class: 'w-4 h-4' })}操作日志</a>
                <a class="btn inline-flex items-center gap-2" href="#/account">${icon('user', { class: 'w-4 h-4' })}账号设置</a>
                <a class="btn inline-flex items-center gap-2" href="/" target="_blank" rel="noopener">${icon('globe', { class: 'w-4 h-4' })}查看前台</a>
            </div>
        </div>`;

    const statVideos = container.querySelector('#stat-videos');
    const statSync = container.querySelector('#stat-sync');
    const statVersions = container.querySelector('#stat-versions');
    const statLogs = container.querySelector('#stat-logs');
    const recentVersionsEl = container.querySelector('#dash-versions');
    const recentLogsEl = container.querySelector('#dash-logs');

    showLoading(container);
    try {
        // 四个接口并行请求、独立容错：单个失败只影响对应卡片，不阻塞其他数据
        const [configRes, videosRes, versionsRes, logsRes] = await Promise.allSettled([
            get('/api/config'),
            get('/api/admin/videos'),
            get('/api/admin/versions'),
            get('/api/admin/logs', { pageSize: 5 })
        ]);

        // 视频总数（前台合并展示列表的长度）
        if (configRes.status === 'fulfilled') {
            const videos = (configRes.value && configRes.value.videos) || [];
            statVideos.textContent = String(videos.length);
        } else {
            statVideos.innerHTML = statFailed(configRes.reason && configRes.reason.message);
        }

        // 上次同步时间与状态徽章
        if (videosRes.status === 'fulfilled') {
            renderSyncStat(statSync, videosRes.value && videosRes.value.syncState);
        } else {
            statSync.innerHTML = statFailed(videosRes.reason && videosRes.reason.message);
        }

        // 版本总数 + 最近版本列表
        if (versionsRes.status === 'fulfilled') {
            const versions = (versionsRes.value && versionsRes.value.versions) || [];
            statVersions.textContent = String(versions.length);
            recentVersionsEl.innerHTML = renderRecentVersions(versions);
        } else {
            const message = versionsRes.reason && versionsRes.reason.message;
            statVersions.innerHTML = statFailed(message);
            recentVersionsEl.innerHTML = loadFailed(message);
        }

        // 日志总数 + 最近操作列表
        if (logsRes.status === 'fulfilled') {
            const data = logsRes.value || {};
            statLogs.textContent = String(data.total || 0);
            recentLogsEl.innerHTML = renderRecentLogs(data.items || []);
        } else {
            const message = logsRes.reason && logsRes.reason.message;
            statLogs.innerHTML = statFailed(message);
            recentLogsEl.innerHTML = loadFailed(message);
        }
    } finally {
        hideLoading(container);
    }
}