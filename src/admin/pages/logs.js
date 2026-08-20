/**
 * 操作日志页（#/logs）
 *
 * 职责：分页浏览管理员操作日志，支持按动作类型筛选：
 * - 筛选栏：动作类型下拉（全部 + 7 种动作）+ 查询按钮，筛选变更重置到第 1 页
 * - 表格：时间 / 操作人 / 动作（badge）/ 目标（截断）/ 摘要 / IP
 * - 分页：服务端分页（page / pageSize=20），显示总条数、当前页与总页数
 *
 * 可用 API（经 src/admin/api.js 调用）：
 * - GET /api/admin/logs?page=1&pageSize=20&action=xxx
 *   返回 { total, page, pageSize, items }，items 按 ts 倒序，日志最多保留 500 条
 */
import { get } from '../api.js';
import { formatTime, emptyState, showLoading, hideLoading } from '../ui.js';

/** 每页条数（服务端分页） */
const PAGE_SIZE = 20;

/** 动作类型清单：下拉选项 + 徽章样式（与后端 LOG_ACTIONS 对齐） */
const ACTION_OPTIONS = [
    { value: 'login', name: '登录', badge: 'badge-gray' },
    { value: 'logout', name: '登出', badge: 'badge-gray' },
    { value: 'save_config', name: '保存配置', badge: 'badge' },
    { value: 'rollback', name: '版本回滚', badge: 'badge-warning' },
    { value: 'video_sync', name: '视频同步', badge: 'badge-success' },
    { value: 'video_edit', name: '视频管理', badge: 'badge' },
    { value: 'password', name: '修改密码', badge: 'badge-danger' }
];

/** HTML 转义，防止动态内容破坏结构或注入脚本 */
function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** 渲染动作徽章（未知动作原样灰底展示） */
function actionBadge(action) {
    const option = ACTION_OPTIONS.find((item) => item.value === action);
    const name = option ? option.name : action || '-';
    const cls = option ? option.badge : 'badge-gray';
    return `<span class="badge ${cls}">${escapeHtml(name)}</span>`;
}

/** 渲染操作日志页 @param {HTMLElement} container */
export function render(container) {
    // 动作类型下拉选项
    const actionOptions = ACTION_OPTIONS.map(
        (item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.name)}</option>`
    ).join('');

    container.innerHTML = `
        <div class="page-header">
            <h2>操作日志</h2>
            <span class="page-tip">记录所有敏感操作：登录、配置保存、回滚、视频同步、密码修改等（保留最近500条）。</span>
        </div>

        <div class="toolbar">
            <select class="form-select" id="log-action" style="width: 170px">
                <option value="">全部动作</option>
                ${actionOptions}
            </select>
            <button type="button" class="btn btn-primary" id="log-query">查 询</button>
        </div>

        <div class="card">
            <div id="log-list"></div>
            <div class="pagination" id="log-pager" style="display: none"></div>
        </div>`;

    const cardEl = container.querySelector('.card');
    const listEl = container.querySelector('#log-list');
    const pagerEl = container.querySelector('#log-pager');
    const actionSelect = container.querySelector('#log-action');
    const queryBtn = container.querySelector('#log-query');

    /** 当前筛选的动作（空字符串为全部） */
    let currentAction = '';
    /** 当前页码（从 1 开始） */
    let currentPage = 1;
    /** 当前筛选下的总条数 */
    let totalCount = 0;

    /** 渲染日志表格与分页条 */
    function renderList(items) {
        if (!items.length) {
            listEl.innerHTML = emptyState('暂无操作日志');
            pagerEl.style.display = 'none';
            return;
        }

        const rows = items
            .map(
                (log) => `
            <tr>
                <td style="white-space: nowrap">${escapeHtml(formatTime(log.ts))}</td>
                <td>${escapeHtml(log.username || '-')}</td>
                <td>${actionBadge(log.action)}</td>
                <td class="cell-ellipsis" title="${escapeHtml(log.target || '')}">${escapeHtml(log.target || '-')}</td>
                <td>${escapeHtml(log.summary || '-')}</td>
                <td style="white-space: nowrap">${escapeHtml(log.ip || '-')}</td>
            </tr>`
            )
            .join('');

        listEl.innerHTML = `
            <div class="table-wrap">
                <table class="table">
                    <thead>
                        <tr>
                            <th>时间</th>
                            <th>操作人</th>
                            <th>动作</th>
                            <th>目标</th>
                            <th>摘要</th>
                            <th>IP</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;

        // 分页条：总条数 / 当前页 / 总页数 + 上一页 / 下一页
        const totalPages = Math.max(Math.ceil(totalCount / PAGE_SIZE), 1);
        pagerEl.innerHTML = `
            <button type="button" data-page="${currentPage - 1}"${currentPage <= 1 ? ' disabled' : ''}>上一页</button>
            <span class="pagination-info">共 ${totalCount} 条 · 第 ${currentPage} / ${totalPages} 页</span>
            <button type="button" data-page="${currentPage + 1}"${currentPage >= totalPages ? ' disabled' : ''}>下一页</button>`;
        pagerEl.style.display = 'flex';
    }

    /** 按当前筛选与页码拉取日志 */
    async function load() {
        showLoading(cardEl);
        try {
            const data = await get('/api/admin/logs', {
                page: currentPage,
                pageSize: PAGE_SIZE,
                action: currentAction
            });
            totalCount = (data && data.total) || 0;
            renderList((data && data.items) || []);
        } catch (err) {
            listEl.innerHTML = `
                <div class="empty">
                    <div class="empty-icon">⚠️</div>
                    <div class="empty-text" style="color: var(--color-danger)">加载失败：${escapeHtml(err.message || '未知错误')}</div>
                </div>`;
            pagerEl.style.display = 'none';
        } finally {
            hideLoading(cardEl);
        }
    }

    /** 应用筛选：重置到第 1 页并查询 */
    function applyFilter() {
        currentAction = actionSelect.value;
        currentPage = 1;
        load();
    }

    queryBtn.addEventListener('click', applyFilter);
    // 下拉切换同样立即查询（并重置到第 1 页）
    actionSelect.addEventListener('change', applyFilter);

    // 上一页 / 下一页事件委托
    pagerEl.addEventListener('click', (event) => {
        const btn = event.target.closest('button[data-page]');
        if (!btn || btn.disabled) return;
        const page = Number(btn.dataset.page);
        if (!Number.isFinite(page) || page < 1 || page === currentPage) return;
        currentPage = page;
        load();
    });

    // 初次加载
    load();
}