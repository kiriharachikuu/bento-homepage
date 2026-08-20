/**
 * 公共 UI 组件与工具（管理后台共用）
 *
 * 提供：toast 浮层、confirmDialog 确认弹窗、未保存守卫（路由切换 /
 * beforeunload 双拦截）、时间与体积格式化、空状态 / 加载状态。
 *
 * 页面用法示例（Task 9/10/11 实现具体页面时）：
 *   import { toast, confirmDialog, createUnsavedGuard, registerGuard } from '../ui.js';
 *   const guard = createUnsavedGuard();
 *   registerGuard(guard);
 *   guard.setDirty(true);   // 表单变更时标记脏状态
 *   guard.setDirty(false);  // 保存成功后清除
 */

/** HTML 转义，防止文案插入时破坏结构 */
function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/* ============================================================
 * Toast 浮层
 * ============================================================ */

/**
 * 右上角浮层提示，3 秒自动消失，多条堆叠显示
 * @param {string} message 提示文案
 * @param {'success'|'error'|'warning'} type 提示类型（决定左侧色条）
 */
export function toast(message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const item = document.createElement('div');
    item.className = `toast toast-${type}`;
    item.textContent = String(message);
    container.appendChild(item);

    // 下一帧再添加 show 类，确保过渡动画生效
    requestAnimationFrame(() => item.classList.add('show'));

    // 3 秒后淡出并移除节点
    setTimeout(() => {
        item.classList.remove('show');
        setTimeout(() => item.remove(), 320);
    }, 3000);
}

/* ============================================================
 * 确认弹窗
 * ============================================================ */

/**
 * 模态确认框，返回 Promise<boolean>（true=确认，false=取消）
 * 点遮罩不关闭（防误触），必须点击按钮才结束
 * @param {object} options
 * @param {string} [options.title='确认操作'] 标题
 * @param {string} [options.message=''] 正文说明
 * @param {boolean} [options.danger=false] 危险操作：标题警示色 + 红色确认按钮
 * @param {string} [options.confirmText='确认'] 确认按钮文案
 * @param {string} [options.cancelText='取消'] 取消按钮文案
 * @returns {Promise<boolean>}
 */
export function confirmDialog({
    title = '确认操作',
    message = '',
    danger = false,
    confirmText = '确认',
    cancelText = '取消'
} = {}) {
    return new Promise((resolve) => {
        const mask = document.createElement('div');
        mask.className = 'modal-mask';
        mask.innerHTML = `
            <div class="modal" role="dialog" aria-modal="true">
                <div class="modal-title${danger ? ' modal-title-danger' : ''}">${escapeHtml(title)}</div>
                <div class="modal-body">${escapeHtml(message)}</div>
                <div class="modal-footer">
                    <button type="button" class="btn" data-role="cancel">${escapeHtml(cancelText)}</button>
                    <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-role="confirm">${escapeHtml(confirmText)}</button>
                </div>
            </div>`;

        const finish = (result) => {
            mask.remove();
            resolve(result);
        };

        mask.querySelector('[data-role="cancel"]').addEventListener('click', () => finish(false));
        mask.querySelector('[data-role="confirm"]').addEventListener('click', () => finish(true));
        // 点击遮罩不关闭，防止误触导致页面状态丢失

        document.body.appendChild(mask);
        // 焦点置于确认按钮，便于回车直接确认
        mask.querySelector('[data-role="confirm"]').focus();
    });
}

/* ============================================================
 * 未保存守卫（路由切换 + 刷新/关闭拦截）
 * ============================================================ */

/** 当前页面注册的守卫（同一时刻至多一个，随路由切换被清除） */
let activeGuard = null;

/**
 * 注册当前页面的未保存守卫（页面 render 时调用）
 * @param {{ setDirty(dirty:boolean):void, isDirty():boolean }} guard
 */
export function registerGuard(guard) {
    activeGuard = guard;
}

/**
 * 清除已注册的守卫（main.js 在路由切换完成 / 退出登录时调用）。
 * 若守卫支持 setDirty，会顺带复位以解绑其 beforeunload 监听。
 */
export function clearGuard() {
    if (activeGuard && typeof activeGuard.setDirty === 'function') {
        activeGuard.setDirty(false);
    }
    activeGuard = null;
}

/**
 * 询问当前守卫是否允许离开（main.js 在路由切换前调用）
 * @returns {Promise<boolean>} true=允许离开；false=用户取消（应还原 hash 不跳转）
 */
export async function askGuardLeave() {
    if (!activeGuard || typeof activeGuard.isDirty !== 'function' || !activeGuard.isDirty()) {
        return true;
    }
    return confirmDialog({
        title: '未保存的更改',
        message: '当前页面有未保存的更改，确定离开吗？',
        danger: true,
        confirmText: '离开',
        cancelText: '留在本页'
    });
}

/**
 * 创建未保存守卫
 * @returns {{ setDirty(dirty:boolean):void, isDirty():boolean }}
 *   setDirty(true) 时注册 window beforeunload 拦截离开（刷新/关闭标签页）；
 *   路由级拦截由 registerGuard + main.js 的 askGuardLeave 配合完成
 */
export function createUnsavedGuard() {
    let dirty = false;
    let beforeUnloadHandler = null;

    const detachBeforeUnload = () => {
        if (beforeUnloadHandler) {
            window.removeEventListener('beforeunload', beforeUnloadHandler);
            beforeUnloadHandler = null;
        }
    };

    return {
        setDirty(value) {
            dirty = Boolean(value);
            if (dirty && !beforeUnloadHandler) {
                beforeUnloadHandler = (event) => {
                    // 阻止默认行为以让浏览器弹出离开确认
                    event.preventDefault();
                    event.returnValue = '';
                };
                window.addEventListener('beforeunload', beforeUnloadHandler);
            } else if (!dirty) {
                detachBeforeUnload();
            }
        },
        isDirty() {
            return dirty;
        }
    };
}

/* ============================================================
 * 格式化工具
 * ============================================================ */

/**
 * 时间戳转 'YYYY-MM-DD HH:mm'（本地时区）
 * 秒级（10 位）与毫秒级（13 位）时间戳自动判断
 * @param {number|string} ts 时间戳
 * @returns {string} 无效值返回 '-'
 */
export function formatTime(ts) {
    if (ts === null || ts === undefined || ts === '') return '-';
    const num = Number(ts);
    if (!Number.isFinite(num) || num <= 0) return '-';
    // 小于 1e12 视为秒级时间戳，统一转毫秒
    const ms = num < 1e12 ? num * 1000 : num;
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) return '-';
    const pad = (n) => String(n).padStart(2, '0');
    return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
}

/**
 * 字节数转可读体积（B / KB / MB / GB）
 * @param {number} bytes 字节数
 * @returns {string} 无效值返回 '-'
 */
export function formatSize(bytes) {
    const num = Number(bytes);
    if (!Number.isFinite(num) || num < 0) return '-';
    if (num < 1024) return `${num} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let value = num;
    let unit = 'B';
    for (const u of units) {
        if (value < 1024) break;
        value /= 1024;
        unit = u;
    }
    // 保留一位小数（较大值取整）
    const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
    return `${rounded} ${unit}`;
}

/* ============================================================
 * 空状态 / 加载状态
 * ============================================================ */

/**
 * 空状态 HTML 片段
 * @param {string} [message='暂无数据'] 提示文案
 * @returns {string} HTML 字符串
 */
export function emptyState(message = '暂无数据') {
    return `
        <div class="empty">
            <div class="empty-icon">📭</div>
            <div class="empty-text">${escapeHtml(message)}</div>
        </div>`;
}

/**
 * 在容器内显示加载指示（绝对定位铺满容器，容器为 static 定位时自动改为 relative）
 * @param {HTMLElement} el 容器元素
 * @param {string} [text='加载中…'] 提示文案
 */
export function showLoading(el, text = '加载中…') {
    if (!el) return;
    if (getComputedStyle(el).position === 'static') {
        el.style.position = 'relative';
    }
    let box = el.querySelector(':scope > .loading');
    if (!box) {
        box = document.createElement('div');
        box.className = 'loading';
        box.innerHTML = '<span class="loading-spinner"></span><span class="loading-text"></span>';
        el.appendChild(box);
    }
    box.querySelector('.loading-text').textContent = text;
}

/**
 * 移除容器内的加载指示
 * @param {HTMLElement} el 容器元素
 */
export function hideLoading(el) {
    if (!el) return;
    const box = el.querySelector(':scope > .loading');
    if (box) box.remove();
}
