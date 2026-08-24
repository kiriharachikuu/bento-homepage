/**
 * 版本历史页（#/versions）
 *
 * 职责：查看配置版本快照列表与详情，并支持回滚到指定版本：
 * - 列表：时间 / 操作人 / 备注 / 变更模块（badge），前端分页（每页 15 条）
 * - 详情：模态框展示版本信息 + 按模块分段的配置内容预览（JSON 等宽小字号可滚动）
 * - 回滚：危险操作二次确认，成功后刷新列表（回滚本身会生成新版本排在最前）
 *
 * 可用 API（均经 src/admin/api.js 调用）：
 * - GET /api/admin/versions              版本列表，返回 { versions }（新的在前，最多 50 条）
 * - GET /api/admin/version-detail?id=xxx  版本详情（含快照数据 data），版本不存在返回 404
 * - POST /api/admin/rollback             回滚，body：{ versionId }，成功 { ok: true }
 */
import { get, post } from '../api.js';
import { toast, confirmDialog, formatTime, emptyState, showLoading, hideLoading } from '../ui.js';
import { icon } from '../icons.js';

/** 每页条数（版本上限 50 条，纯前端分页） */
const PAGE_SIZE = 15;

/** 模块 key -> 中文名称（badge 展示用） */
const MODULE_NAMES = {
    site: '网站信息',
    user: '用户信息',
    socialLinks: '社交链接',
    contactText: '联系方式',
    musicPlayer: '音乐播放器',
    beian: '备案信息',
    videoSync: '视频同步',
    videos: '视频数据',
    video_overrides: '视频微调',
    rollback: '回滚'
};

/** 版本详情中站点配置的分段预览顺序 */
const SITE_CONFIG_SECTIONS = [
    'site',
    'user',
    'socialLinks',
    'contactText',
    'musicPlayer',
    'beian',
    'videoSync'
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

/** 渲染变更模块徽章组（rollback 用警示色） */
function moduleBadges(modules) {
    const list = Array.isArray(modules) ? modules : [];
    if (!list.length) return '-';
    return list
        .map(
            (m) =>
                `<span class="badge${m === 'rollback' ? ' badge-warning' : ''}">${escapeHtml(MODULE_NAMES[m] || m)}</span>`
        )
        .join(' ');
}

/** 列表加载失败提示 */
function loadFailed(message) {
    return `
        <div class="empty">
            <div class="empty-icon">${icon('alert-circle', { class: 'w-12 h-12' })}</div>
            <div class="empty-text" style="color: var(--color-danger)">加载失败：${escapeHtml(message || '未知错误')}</div>
        </div>`;
}

/** 单个模块的 JSON 预览段（等宽小字号，可滚动） */
function jsonSection(title, value) {
    const text = JSON.stringify(value, null, 2);
    return `
        <div style="margin-bottom: 14px">
            <div style="font-size: 13px; font-weight: 600; margin-bottom: 6px">${escapeHtml(title)}</div>
            <pre style="margin: 0; padding: 10px 12px; background: #f9fafb; border: 1px solid var(--color-border); border-radius: 6px; font-size: 12px; line-height: 1.5; font-family: Consolas, Monaco, 'Courier New', monospace; overflow: auto; max-height: 240px">${escapeHtml(text === undefined ? '无数据' : text)}</pre>
        </div>`;
}

/** 摘要预览段（一行文字说明，用于 videos / video_overrides） */
function summarySection(title, text) {
    return `
        <div style="margin-bottom: 14px">
            <div style="font-size: 13px; font-weight: 600; margin-bottom: 6px">${escapeHtml(title)}</div>
            <div style="font-size: 13px; color: var(--color-text-secondary)">${escapeHtml(text)}</div>
        </div>`;
}

/** 视频数据条数概要（不展示全量 JSON） */
function videosSummary(videosData) {
    if (!videosData || typeof videosData !== 'object') return '无视频数据';
    const manual = Array.isArray(videosData.manual) ? videosData.manual.length : 0;
    const synced = Array.isArray(videosData.synced) ? videosData.synced.length : 0;
    return `手动 ${manual} 条，同步 ${synced} 条`;
}

/** 视频覆盖配置条数概要 */
function overridesSummary(overrides) {
    if (!overrides || typeof overrides !== 'object') return '无覆盖配置';
    return `共 ${Object.keys(overrides).length} 条覆盖记录`;
}

/** 渲染版本详情内容：版本信息 + 按模块分段的配置预览 */
function renderDetailBody(el, detail) {
    const info = detail || {};
    const data = info.data || {};
    const siteConfig = data.site_config || {};

    // 版本基础信息
    let html = `
        <div style="display: grid; grid-template-columns: 84px 1fr; gap: 8px 14px; font-size: 13px; margin-bottom: 18px">
            <span style="color: var(--color-text-secondary)">时间</span><span>${escapeHtml(formatTime(info.ts))}</span>
            <span style="color: var(--color-text-secondary)">操作人</span><span>${escapeHtml(info.author || '-')}</span>
            <span style="color: var(--color-text-secondary)">备注</span><span>${escapeHtml(info.note || '-')}</span>
            <span style="color: var(--color-text-secondary)">变更模块</span><span>${moduleBadges(info.modules)}</span>
        </div>`;

    // 站点配置内的各模块分段 JSON 预览（快照中缺失的模块跳过）
    let sectionCount = 0;
    for (const key of SITE_CONFIG_SECTIONS) {
        if (!Object.prototype.hasOwnProperty.call(siteConfig, key)) continue;
        html += jsonSection(MODULE_NAMES[key] || key, siteConfig[key]);
        sectionCount++;
    }
    if (!sectionCount) {
        html += '<div style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 14px">该版本未包含站点配置数据</div>';
    }

    // 视频数据与覆盖配置仅显示条数摘要
    html += summarySection('视频数据', videosSummary(data.videos));
    html += summarySection('视频微调配置', overridesSummary(data.video_overrides));

    el.innerHTML = html;
}

/** 渲染版本历史页 @param {HTMLElement} container */
export function render(container) {
    container.innerHTML = `
        <div class="page-header">
            <h2>版本历史</h2>
            <span class="page-tip">每次保存配置都会生成快照版本（保留最近50个），可查看详情或回滚。</span>
        </div>
        <div class="card">
            <div id="version-list"></div>
            <div class="pagination" id="version-pager" style="display: none"></div>
        </div>`;

    const cardEl = container.querySelector('.card');
    const listEl = container.querySelector('#version-list');
    const pagerEl = container.querySelector('#version-pager');

    /** 全部版本（新的在前） */
    let allVersions = [];
    /** 当前页码（从 1 开始） */
    let currentPage = 1;

    /** 渲染当前页的表格与分页条 */
    function renderList() {
        const total = allVersions.length;
        if (!total) {
            listEl.innerHTML = emptyState('暂无版本记录');
            pagerEl.style.display = 'none';
            return;
        }

        const totalPages = Math.ceil(total / PAGE_SIZE);
        if (currentPage > totalPages) currentPage = totalPages;
        const start = (currentPage - 1) * PAGE_SIZE;
        const pageItems = allVersions.slice(start, start + PAGE_SIZE);

        const rows = pageItems
            .map(
                (v) => `
            <tr>
                <td style="white-space: nowrap">${escapeHtml(formatTime(v.ts))}</td>
                <td>${escapeHtml(v.author || '-')}</td>
                <td class="cell-ellipsis" title="${escapeHtml(v.note || '')}">${escapeHtml(v.note || '-')}</td>
                <td>${moduleBadges(v.modules)}</td>
                <td>
                    <div class="cell-actions">
                        <button type="button" class="btn btn-sm" data-action="detail" data-id="${escapeHtml(v.id)}">查看详情</button>
                        <button type="button" class="btn btn-sm btn-danger" data-action="rollback" data-id="${escapeHtml(v.id)}">回滚到此版本</button>
                    </div>
                </td>
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
                            <th>备注</th>
                            <th>变更模块</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;

        // 分页条（仅一页时隐藏）
        if (totalPages <= 1) {
            pagerEl.style.display = 'none';
            return;
        }
        let pager = `<button type="button" data-page="${currentPage - 1}"${currentPage <= 1 ? ' disabled' : ''}>上一页</button>`;
        for (let p = 1; p <= totalPages; p++) {
            pager += `<button type="button" class="${p === currentPage ? 'current' : ''}" data-page="${p}">${p}</button>`;
        }
        pager += `<button type="button" data-page="${currentPage + 1}"${currentPage >= totalPages ? ' disabled' : ''}>下一页</button>`;
        pager += `<span class="pagination-info">共 ${total} 个版本</span>`;
        pagerEl.innerHTML = pager;
        pagerEl.style.display = 'flex';
    }

    /** 加载版本列表 @param {boolean} resetPage 是否重置到第 1 页 */
    async function load(resetPage) {
        if (resetPage) currentPage = 1;
        showLoading(cardEl);
        try {
            const data = await get('/api/admin/versions');
            allVersions = (data && data.versions) || [];
            renderList();
        } catch (err) {
            listEl.innerHTML = loadFailed(err.message);
            pagerEl.style.display = 'none';
        } finally {
            hideLoading(cardEl);
        }
    }

    /** 打开版本详情模态框（拉取快照数据后分段渲染） */
    async function showDetail(version) {
        const mask = document.createElement('div');
        mask.className = 'modal-mask';
        mask.innerHTML = `
            <div class="modal" style="width: 720px; max-height: 70vh" role="dialog" aria-modal="true">
                <div class="modal-title">版本详情</div>
                <div class="modal-body">
                    <div style="padding: 24px; text-align: center; color: var(--color-text-secondary)">快照数据加载中…</div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn" data-role="close">关闭</button>
                </div>
            </div>`;
        document.body.appendChild(mask);

        const bodyEl = mask.querySelector('.modal-body');
        const close = () => mask.remove();
        mask.querySelector('[data-role="close"]').addEventListener('click', close);
        // 点击遮罩空白处关闭（点击弹窗内部不关闭）
        mask.addEventListener('click', (event) => {
            if (event.target === mask) close();
        });

        try {
            const detail = await get('/api/admin/version-detail', { id: version.id });
            renderDetailBody(bodyEl, detail);
        } catch (err) {
            bodyEl.innerHTML = `
                <div style="padding: 24px; text-align: center; color: var(--color-danger)">详情加载失败：${escapeHtml(err.message || '未知错误')}</div>`;
        }
    }

    /** 回滚到指定版本（危险操作：二次确认 + 请求期间禁用按钮防重复提交） */
    async function handleRollback(version, btn) {
        const ok = await confirmDialog({
            title: '危险操作：回滚配置',
            message: `将把网站配置与视频数据回滚到 ${formatTime(version.ts)} 的版本，此操作会生成新的版本记录（不会丢失历史）。确定回滚吗？`,
            danger: true,
            confirmText: '确定回滚'
        });
        if (!ok) return;

        btn.disabled = true;
        try {
            await post('/api/admin/rollback', { versionId: version.id });
            toast('已回滚', 'success');
            // 回滚会生成新版本（排在最前），重置到第 1 页刷新列表
            await load(true);
        } catch (err) {
            btn.disabled = false;
            toast(err.message || '回滚失败，请稍后重试', 'error');
        }
    }

    // 行内操作按钮（查看详情 / 回滚）事件委托
    listEl.addEventListener('click', (event) => {
        const btn = event.target.closest('button[data-action]');
        if (!btn) return;
        const version = allVersions.find((v) => v.id === btn.dataset.id);
        if (!version) return;
        if (btn.dataset.action === 'detail') {
            showDetail(version);
        } else if (btn.dataset.action === 'rollback') {
            handleRollback(version, btn);
        }
    });

    // 分页按钮事件委托
    pagerEl.addEventListener('click', (event) => {
        const btn = event.target.closest('button[data-page]');
        if (!btn || btn.disabled) return;
        const page = Number(btn.dataset.page);
        if (!Number.isFinite(page) || page < 1 || page === currentPage) return;
        currentPage = page;
        renderList();
    });

    // 初次加载
    load(true);
}