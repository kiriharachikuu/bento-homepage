/**
 * 管理后台 SPA 入口
 *
 * 职责：
 * 1. 启动时通过 GET /api/auth/me 探测会话：有效渲染后台框架，401 渲染登录视图
 * 2. 登录 / 退出登录流程（含错误文案映射与二次确认）
 * 3. 后台框架（侧边栏导航 + 顶栏）与 hash 路由调度
 * 4. 路由切换前询问未保存守卫（ui.js 的 askGuardLeave），用户取消则还原 hash
 * 5. 注册全局 401 未授权回调：会话过期时回登录视图并提示
 *
 * 页面模块统一接口：export function render(container)（可为 async），
 * 位于 src/admin/pages/ 下，后续任务逐个替换占位实现，无需改动本文件。
 */
import { get, post, setUnauthorizedHandler } from './api.js';
import { toast, confirmDialog, askGuardLeave, clearGuard } from './ui.js';
import { render as renderDashboard } from './pages/dashboard.js';
import { render as renderSite } from './pages/site.js';
import { render as renderBeian } from './pages/beian.js';
import { render as renderContent } from './pages/content.js';
import { render as renderVideos } from './pages/videos.js';
import { render as renderVersions } from './pages/versions.js';
import { render as renderLogs } from './pages/logs.js';
import { render as renderAccount } from './pages/account.js';

/* ------------------------------------------------------------
 * 路由表：hash -> 页面模块（文件名与路由一一对应）
 * ------------------------------------------------------------ */
const routes = [
    { path: '#/dashboard', title: '仪表盘', icon: '📊', render: renderDashboard },
    { path: '#/site', title: '网站信息', icon: '🌐', render: renderSite },
    { path: '#/beian', title: '备案信息', icon: '📜', render: renderBeian },
    { path: '#/content', title: '文字内容', icon: '📝', render: renderContent },
    { path: '#/videos', title: '视频管理', icon: '🎬', render: renderVideos },
    { path: '#/versions', title: '版本历史', icon: '🕘', render: renderVersions },
    { path: '#/logs', title: '操作日志', icon: '📋', render: renderLogs },
    { path: '#/account', title: '账号设置', icon: '👤', render: renderAccount }
];

/** 默认路由 */
const DEFAULT_PATH = '#/dashboard';

/* ------------------------------------------------------------
 * 应用状态
 * ------------------------------------------------------------ */
/** 当前登录用户名（null 表示未登录 / 登录视图） */
let currentUser = null;
/** 当前视图：'login' 登录视图 | 'admin' 后台框架 */
let view = 'login';
/** 当前已渲染的路由 path（守卫取消时用于还原 hash） */
let currentPath = null;

/** #app 根容器 */
function appEl() {
    return document.getElementById('app');
}

/* ------------------------------------------------------------
 * 登录视图
 * ------------------------------------------------------------ */

/** 登录失败错误码 -> 用户提示文案 */
const LOGIN_ERROR_MESSAGES = {
    AUTH_FAILED: '用户名或密码错误',
    LOCKED: '失败次数过多，请15分钟后再试'
};

/** 渲染登录视图（居中卡片，回车提交；notice 为部署指引提示，KV 未绑定时展示） */
function renderLogin(notice) {
    view = 'login';
    currentUser = null;
    currentPath = null;

    const app = appEl();
    app.innerHTML = `
        <div class="login-wrap">
            ${notice
                ? `
            <div class="card login-notice">
                <div class="login-notice-title">⚠️ 后端存储未就绪</div>
                <div class="login-notice-text">${notice}</div>
            </div>`
                : ''}
            <div class="card login-card">
                <div class="login-logo">🛠️</div>
                <div class="login-title">知空空的空想世界 - 内容管理后台</div>
                <form id="login-form" novalidate>
                    <div class="form-group">
                        <label class="form-label" for="login-username">用户名</label>
                        <input class="form-input" id="login-username" name="username"
                               autocomplete="username" placeholder="请输入用户名" />
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="login-password">密码</label>
                        <input class="form-input" id="login-password" name="password"
                               type="password" autocomplete="current-password" placeholder="请输入密码" />
                    </div>
                    <div class="login-error" id="login-error"></div>
                    <button type="submit" class="btn btn-primary btn-block" id="login-submit">登 录</button>
                </form>
            </div>
        </div>`;

    const form = document.getElementById('login-form');
    const errorEl = document.getElementById('login-error');
    const submitBtn = document.getElementById('login-submit');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        errorEl.textContent = '';

        if (!username || !password) {
            errorEl.textContent = '请输入用户名和密码';
            return;
        }

        // 提交中禁用按钮，防止重复提交
        submitBtn.disabled = true;
        submitBtn.textContent = '登录中…';
        try {
            const data = await post('/api/auth/login', { username, password });
            currentUser = (data && data.username) || username;
            toast(`欢迎回来，${currentUser}`, 'success');
            renderAdmin();
        } catch (err) {
            // 按业务错误码映射文案，其余（含网络错误）用通用提示兜底
            errorEl.textContent =
                LOGIN_ERROR_MESSAGES[err.code] || err.message || '登录失败，请稍后重试';
        } finally {
            // 登录失败恢复按钮（成功时视图已替换，恢复无副作用）
            submitBtn.disabled = false;
            submitBtn.textContent = '登 录';
        }
    });

    // 聚焦用户名输入框
    document.getElementById('login-username').focus();
}

/* ------------------------------------------------------------
 * 后台框架
 * ------------------------------------------------------------ */

/** 渲染后台框架（侧边栏 + 顶栏 + 内容容器），随后调度当前路由 */
function renderAdmin() {
    view = 'admin';
    currentPath = null;

    const navItems = routes
        .map(
            (route) => `
            <a class="nav-item" href="${route.path}" data-path="${route.path}">
                <span class="nav-icon">${route.icon}</span><span>${route.title}</span>
            </a>`
        )
        .join('');

    const app = appEl();
    app.innerHTML = `
        <div class="layout">
            <aside class="sidebar">
                <div class="sidebar-logo"><span>🛠️</span><span>内容管理</span></div>
                <nav class="sidebar-nav">${navItems}</nav>
                <div class="sidebar-footer">知空空的空想世界</div>
            </aside>
            <div class="main">
                <header class="topbar">
                    <div class="topbar-title" id="page-title">加载中…</div>
                    <div class="topbar-user">
                        <span class="topbar-username" id="topbar-username"></span>
                        <button type="button" class="btn btn-sm" id="btn-logout">退出</button>
                    </div>
                </header>
                <main class="content" id="page-container"></main>
            </div>
        </div>`;

    // 用户名来自服务端，用 textContent 避免 HTML 注入
    document.getElementById('topbar-username').textContent = `管理员：${currentUser}`;
    document.getElementById('btn-logout').addEventListener('click', handleLogout);

    // 按当前 hash 渲染首个页面
    handleRouteChange();
}

/** 渲染指定路由页面（更新顶栏标题、导航高亮并挂载页面） */
function renderRoute(route) {
    currentPath = route.path;

    // 顶栏标题与侧边栏高亮
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = route.title;
    document.querySelectorAll('.nav-item').forEach((item) => {
        item.classList.toggle('active', item.dataset.path === route.path);
    });

    const container = document.getElementById('page-container');
    if (!container) return;
    container.innerHTML = '';

    // 页面 render 可为 async，异常时展示错误卡片而不破坏框架
    Promise.resolve(route.render(container)).catch((err) => {
        container.innerHTML = `
            <div class="card">
                <div class="empty">
                    <div class="empty-icon">⚠️</div>
                    <div class="empty-text">页面加载失败：${err && err.message ? err.message : '未知错误'}</div>
                </div>
            </div>`;
    });
}

/**
 * hash 路由调度（hashchange 与初始化共用）：
 * 1. 未登录时不处理；
 * 2. 未匹配路由跳转默认路由；
 * 3. 先询问未保存守卫，用户取消则还原 hash 不跳转；
 * 4. 通过后清除旧守卫并渲染新页面
 */
async function handleRouteChange() {
    if (view !== 'admin') return;

    const target = location.hash || DEFAULT_PATH;
    const route = routes.find((item) => item.path === target);
    if (!route) {
        // 未匹配：跳默认路由（触发的 hashchange 会再次进入本函数）
        location.replace(DEFAULT_PATH);
        return;
    }

    // 已在该页（含守卫取消后的 hash 还原）则忽略
    if (route.path === currentPath) return;

    // 未保存守卫：用户取消则还原 hash（触发的 hashchange 因路径未变被上面忽略）
    const allowed = await askGuardLeave();
    if (!allowed) {
        if (currentPath) location.hash = currentPath;
        return;
    }

    clearGuard();
    renderRoute(route);
}

/* ------------------------------------------------------------
 * 退出登录
 * ------------------------------------------------------------ */

async function handleLogout() {
    const ok = await confirmDialog({
        title: '退出登录',
        message: '确定要退出当前账号吗？',
        confirmText: '退出'
    });
    if (!ok) return;

    try {
        await post('/api/auth/logout');
    } catch (err) {
        // 会话可能已过期，忽略错误，本地一律回登录视图
    }
    clearGuard();
    renderLogin();
    toast('已退出登录', 'success');
}

/* ------------------------------------------------------------
 * 全局 401 处理与启动
 * ------------------------------------------------------------ */

// 会话过期（任意接口返回 401 + UNAUTHORIZED）时回登录视图；
// 启动探测 /api/auth/me 的 401 也走这里，因尚未登录（currentUser 为空）不弹过期提示
setUnauthorizedHandler(() => {
    const wasLoggedIn = currentUser !== null;
    clearGuard();
    renderLogin();
    if (wasLoggedIn) {
        toast('登录已过期，请重新登录', 'error');
    }
});

// hash 变化统一交给路由调度
window.addEventListener('hashchange', handleRouteChange);

// 启动：探测会话
(async function boot() {
    try {
        const me = await get('/api/auth/me');
        currentUser = (me && me.username) || '';
        if (!currentUser) throw new Error('会话数据异常');
        renderAdmin();
    } catch (err) {
        // 未登录或网络异常：渲染登录视图（unauthorizedHandler 可能已渲染，幂等）
        if (view !== 'login') {
            // KV 未绑定时在登录页顶部给出部署指引，避免首次部署排障困难
            const notice =
                err && err.code === 'KV_NOT_BOUND'
                    ? 'EdgeOne KV 存储尚未绑定：请在 EdgeOne Pages 控制台开通 KV、创建命名空间，并以运行时变量名 <b>CMS_KV</b> 绑定到本项目，然后重新部署（详见 README「部署配置」章节）。'
                    : '';
            renderLogin(notice);
        }
    }
})();
