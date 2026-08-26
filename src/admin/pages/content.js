/**
 * 内容编辑页（#/content）
 *
 * 页内 tab 分四组编辑，每组独立保存（避免一键保存跨 tab 误覆盖）：
 * 1. 个人信息：user.name / user.title / user.description（富文本）/ user.avatar / user.learnMoreLink
 * 2. 关于我长文：user.learnMoreContent（富文本，内容较长单独成 tab）
 * 3. 社交与联系：socialLinks（四项） + contactText + contactButtonLink（两张卡片分别保存）
 * 4. 音乐与留言：musicPlayer.playlistId + comments.carouselInterval + comments.list
 *
 * 保存时分别提交对应模块，互不干扰。路由离开时的未保存守卫仍为全局粒度。
 *
 * 富文本字段组件（createRichTextField）说明：
 * - 默认富文本模式：页面加载时直接创建 wangEditor，所见即所得编辑
 * - 「切换到源码」：等宽字体 textarea 显示原始 HTML，原样保存不重排
 * - 「切换回富文本」：把 textarea 内容写回编辑器（富文本模式可能重排 HTML 结构）
 * - 「预览」：模态框内 iframe（srcdoc 引入 Tailwind CDN）正确预览含 class 的内容
 * - 编辑器内图片上传复用 presign 直传流程（customUpload）
 */
import { createEditor, createToolbar } from '@wangeditor/editor';
import '@wangeditor/editor/dist/css/style.css';
import { toast, confirmDialog, createUnsavedGuard, registerGuard, showLoading, hideLoading } from '../ui.js';
import { icon } from '../icons.js';
import { escapeHtml, loadSiteConfig, saveConfigModules, uploadImage, createImageField, watchFormChanges } from './_shared.js';

/* ============================================================
 * 富文本字段组件（「简介」与「了解更多长文」共用）
 * ============================================================ */

/** 字段实例序号（保证 wangEditor 挂载点 id 在页面内唯一） */
let richFieldSeq = 0;

/**
 * 创建富文本字段：默认富文本模式（wangEditor，所见即所得），
 * 可切换源码模式，带图片上传与 Tailwind 预览。
 * @param {object} options
 * @param {string} [options.value=''] 初始 HTML
 * @param {string} [options.placeholder] 富文本编辑器占位文案
 * @param {number} [options.height=400] 编辑区高度（像素）
 * @param {() => void} [options.onChange] 内容变化回调（标记脏状态）
 * @returns {{ el: HTMLElement, getValue(): string, setValue(html: string): void }}
 */
function createRichTextField({
    value = '',
    placeholder = '请输入内容...',
    height = 400,
    onChange = null
} = {}) {
    richFieldSeq += 1;
    const toolbarId = 'rich-toolbar-' + richFieldSeq;
    const editorId = 'rich-editor-' + richFieldSeq;

    const root = document.createElement('div');
    root.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
            <button type="button" class="btn btn-sm" data-role="preview">预览</button>
            <button type="button" class="btn btn-sm" data-role="toggle">切换到源码</button>
            <span class="form-hint" data-role="mode-tip" style="margin:0;">当前模式：富文本（所见即所得编辑）。富文本模式可能会重排 HTML 结构</span>
        </div>
        <textarea class="form-textarea" data-role="source" spellcheck="false" hidden
                  style="font-family:ui-monospace,SFMono-Regular,Consolas,'Courier New',monospace;font-size:13px;min-height:${height}px;"></textarea>
        <div class="editor-wrap" data-role="wrap" style="height:${height}px;">
            <div class="editor-toolbar" id="${toolbarId}"></div>
            <div class="editor-container" id="${editorId}"></div>
        </div>`;

    const toggleBtn = root.querySelector('[data-role="toggle"]');
    const modeTip = root.querySelector('[data-role="mode-tip"]');
    const sourceArea = root.querySelector('[data-role="source"]');
    const wrap = root.querySelector('[data-role="wrap"]');
    const toolbarBox = root.querySelector('#' + toolbarId);
    const editorBox = root.querySelector('#' + editorId);

    sourceArea.value = value;

    /** wangEditor 编辑器实例（富文本模式时非空） */
    let editor = null;
    /** wangEditor 工具栏实例（富文本模式时非空） */
    let toolbar = null;

    // 源码模式输入 -> 脏状态
    sourceArea.addEventListener('input', () => {
        if (onChange) onChange();
    });

    /** 切换到富文本模式（直接切换，不弹确认）。
     *  初始化失败时自动降级为源码模式并提示，不阻断整个页面。 */
    function switchToRich() {
        if (editor) return;
        const html = sourceArea.value;

        // 先显示容器再创建实例（编辑器需在可见环境下计算高度）
        sourceArea.hidden = true;
        wrap.hidden = false;

        try {
            editor = createEditor({
                selector: '#' + editorId,
                html,
                config: {
                    placeholder,
                    MENU_CONF: {
                        uploadImage: {
                            // 自定义上传：presign 预签名后 PUT 直传 COS
                            async customUpload(file, insertFn) {
                                try {
                                    const url = await uploadImage(file);
                                    insertFn(url, '', '');
                                } catch (err) {
                                    toast(err.message || '图片上传失败', 'error');
                                }
                            }
                        }
                    },
                    onChange: () => {
                        if (onChange) onChange();
                    }
                }
            });
            toolbar = createToolbar({ editor, selector: '#' + toolbarId, config: {
                toolbarKeys: [
                    'headerSelect',
                    'bold', 'italic', 'underline', 'through',
                    'color', 'bgColor',
                    '|',
                    'list', 'orderedList',
                    'justifyLeft', 'justifyRight', 'justifyCenter',
                    '|',
                    'link', 'image', 'table',
                    '|',
                    'undo', 'redo'
                ]
            } });
        } catch (err) {
            // 富文本初始化失败：回退到源码模式，提示用户
            editor = null;
            toolbar = null;
            toolbarBox.innerHTML = '';
            editorBox.innerHTML = '';
            wrap.hidden = true;
            sourceArea.hidden = false;
            sourceArea.value = html;
            toggleBtn.textContent = '切换到富文本';
            modeTip.textContent = '当前模式：源码（富文本编辑器初始化失败，已自动降级）';
            toast('富文本编辑器初始化失败，已自动切换到源码模式：' + (err.message || err), 'error');
            return;
        }

        toggleBtn.textContent = '切换到源码';
        modeTip.textContent = '当前模式：富文本（所见即所得编辑）。富文本模式可能会重排 HTML 结构';
    }

    /** 切换回源码模式：取回编辑器内容并销毁实例 */
    function switchToSource() {
        if (!editor) return;
        sourceArea.value = editor.getHtml();
        editor.destroy();
        if (toolbar) toolbar.destroy();
        editor = null;
        toolbar = null;
        // 清空挂载点残留 DOM，保证可反复切换
        toolbarBox.innerHTML = '';
        editorBox.innerHTML = '';
        wrap.hidden = true;
        sourceArea.hidden = false;
        toggleBtn.textContent = '切换到富文本';
        modeTip.textContent = '当前模式：源码（原样保存，不重排 HTML）';
    }

    /** 打开预览模态框（iframe 引入 Tailwind CDN，正确预览 class 样式） */
    function openPreview() {
        const html = editor ? editor.getHtml() : sourceArea.value;
        const mask = document.createElement('div');
        mask.className = 'modal-mask';
        mask.innerHTML = `
            <div class="modal" style="width:860px;display:flex;flex-direction:column;">
                <div class="modal-title">内容预览</div>
                <iframe title="富文本内容预览" data-role="frame"
                        style="width:100%;height:60vh;border:1px solid #e5e7eb;border-radius:6px;background:#fff;"></iframe>
                <div class="modal-footer" style="margin-top:14px;margin-bottom:0;">
                    <button type="button" class="btn" data-role="close">关闭</button>
                </div>
            </div>`;

        const frame = mask.querySelector('[data-role="frame"]');
        frame.srcdoc =
            '<!DOCTYPE html><html><head><meta charset="utf-8">' +
            '<script src="https://cdn.tailwindcss.com"><\/script>' +
            '<style>' +
            ':root{--text-color:#111827;--card-bg:#ffffff;--border-color:#e5e7eb;--link-color:#3b82f6;' +
            '--gray-100:#f3f4f6;--gray-600:#4b5563;--gray-700:#374151;}' +
            'body{padding:20px;font-family:system-ui,sans-serif;color:#111827;line-height:1.7}' +
            '</style>' +
            '</head><body>' + html + '</body></html>';

        const close = () => mask.remove();
        mask.querySelector('[data-role="close"]').addEventListener('click', close);
        // 预览无数据丢失风险，点击遮罩空白处也可关闭
        mask.addEventListener('click', (event) => {
            if (event.target === mask) close();
        });
        document.body.appendChild(mask);
    }

    toggleBtn.addEventListener('click', () => {
        if (editor) {
            switchToSource();
        } else {
            switchToRich();
        }
    });
    root.querySelector('[data-role="preview"]').addEventListener('click', openPreview);

    // 注入编辑器内容区基础样式（接近前台效果）
    const styleId = 'rich-text-style-' + richFieldSeq;
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent =
        '#' + editorId + ' .w-e-text-container .w-e-text{' +
        'font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;' +
        'font-size:15px;' +
        'line-height:1.7;' +
        'color:#111827;' +
        '}';
    document.head.appendChild(styleEl);

    // 默认富文本模式：先把 DOM 挂到文档中再创建编辑器（wangEditor 通过 document.querySelector 查找元素）
    // 注意：调用方需先把 root 元素 append 到文档中，再调用 getValue/setValue
    // 这里延迟到下一帧初始化，确保容器已在 DOM 中且有尺寸
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => switchToRich());
    } else {
        setTimeout(() => switchToRich(), 0);
    }

    return {
        el: root,
        /** 取当前模式的 HTML（源码模式返回 textarea 内容，富文本模式返回编辑器内容） */
        getValue() {
            return editor ? editor.getHtml() : sourceArea.value;
        },
        /** 程序化赋值（配置回填用，不触发脏状态） */
        setValue(html) {
            const next = html || '';
            if (editor) {
                editor.setHtml(next);
            } else {
                sourceArea.value = next;
            }
        }
    };
}

/* ============================================================
 * 页面渲染
 * ============================================================ */

/** 渲染内容编辑页 @param {HTMLElement} container */
export function render(container) {
    // 未保存守卫：表单变化置脏，保存成功后复位
    const guard = createUnsavedGuard();
    registerGuard(guard);

    container.innerHTML = `
        <div class="page-header">
            <h2>内容编辑</h2>
            <span class="page-tip">个人信息、关于我、联系方式、音乐与留言板等内容编辑</span>
        </div>

        <!-- 页内 tab 切换（纯 JS 控制面板显隐） -->
        <div class="toolbar" data-role="tabs">
            <button type="button" class="btn btn-sm btn-primary" data-tab="profile">个人信息</button>
            <button type="button" class="btn btn-sm" data-tab="learnmore">关于我长文</button>
            <button type="button" class="btn btn-sm" data-tab="social">社交与联系</button>
            <button type="button" class="btn btn-sm" data-tab="music-comments">音乐与留言</button>
        </div>

        <!-- tab 1：个人信息 -->
        <div data-panel="profile">
            <div class="card" data-role="card">
                <div class="card-title">个人信息 <span class="card-tip">首页用户卡片展示的昵称、头衔与简介</span></div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">昵称</label>
                        <input type="text" class="form-input" data-field="name" placeholder="首页展示的昵称" />
                    </div>
                    <div class="form-group">
                        <label class="form-label">头衔</label>
                        <input type="text" class="form-input" data-field="title" placeholder="昵称下方的头衔文案" />
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">简介（支持 HTML）</label>
                    <div data-field-group="description"></div>
                </div>
                <div data-field-group="avatar"></div>
                <div class="form-group">
                    <label class="form-label">「了解更多」链接</label>
                    <input type="text" class="form-input" data-field="learnMoreLink"
                           placeholder="点击用户卡片「了解更多」按钮跳转的链接" />
                </div>
                <div class="form-footer">
                    <button type="button" class="btn btn-primary" data-save="profile">保存个人信息</button>
                    <span class="form-hint">保存模块：user（昵称、头衔、简介、头像、了解更多链接）</span>
                </div>
            </div>
        </div>

        <!-- tab 2：关于我长文 -->
        <div data-panel="learnmore" hidden>
            <div class="card">
                <div class="card-title">关于我长文 <span class="card-tip">「了解更多」弹窗中的完整介绍，支持 HTML 与 Tailwind class</span></div>
                <div data-field-group="learnMoreContent"></div>
                <div class="form-footer">
                    <button type="button" class="btn btn-primary" data-save="learnmore">保存长文</button>
                    <span class="form-hint">保存模块：user.learnMoreContent</span>
                </div>
            </div>
        </div>

        <!-- tab 3：社交与联系 -->
        <div data-panel="social" hidden>
            <div class="card">
                <div class="card-title">社交链接 <span class="card-tip">首页社交图标点击后跳转的地址</span></div>
                <div class="form-group">
                    <label class="form-label">哔哩哔哩主页</label>
                    <input type="text" class="form-input" data-field="bilibili" placeholder="https://space.bilibili.com/xxxx" />
                </div>
                <div class="form-group">
                    <label class="form-label">网易云音乐主页</label>
                    <input type="text" class="form-input" data-field="netease" placeholder="https://music.163.com/#/artist?id=xxxx" />
                </div>
                <div class="form-group">
                    <label class="form-label">新浪微博主页</label>
                    <input type="text" class="form-input" data-field="weibo" placeholder="https://weibo.com/xxxx" />
                </div>
                <div class="form-group">
                    <label class="form-label">QQ 群链接</label>
                    <input type="text" class="form-input" data-field="qqGroup" placeholder="https://qm.qq.com/xxxx" />
                </div>
                <div class="form-footer">
                    <button type="button" class="btn btn-primary" data-save="social">保存社交链接</button>
                    <span class="form-hint">保存模块：socialLinks</span>
                </div>
            </div>
            <div class="card">
                <div class="card-title">联系方式 <span class="card-tip">联系方式卡片的多行文本与按钮链接</span></div>
                <div class="form-group">
                    <label class="form-label">联系方式文本</label>
                    <textarea class="form-textarea" data-field="contactText" rows="6"
                              placeholder="每行一条联系方式，如：哔哩哔哩：@xxx"></textarea>
                    <div class="form-hint">每行一条，支持换行。保存为字符串模块（contactText），前台按行展示</div>
                </div>
                <div class="form-group">
                    <label class="form-label">联系按钮链接</label>
                    <input type="text" class="form-input" data-field="contactButtonLink"
                           placeholder="联系方式卡片「Read more」按钮跳转的链接" />
                    <div class="form-hint">保存为字符串模块（contactButtonLink）</div>
                </div>
                <div class="form-footer">
                    <button type="button" class="btn btn-primary" data-save="contact">保存联系方式</button>
                    <span class="form-hint">保存模块：contactText、contactButtonLink</span>
                </div>
            </div>
        </div>

        <!-- tab 4：音乐与留言 -->
        <div data-panel="music-comments" hidden>
            <div class="card">
                <div class="card-title">音乐播放器 <span class="card-tip">首页音乐卡片加载的网易云歌单</span></div>
                <div class="form-group">
                    <label class="form-label">歌单 ID</label>
                    <input type="text" class="form-input" data-field="playlistId" placeholder="网易云音乐歌单 ID，如：17479746916" />
                    <div class="form-hint">可在网易云音乐网页版歌单页地址中查看 ID 数字</div>
                </div>
            </div>
            <div class="card">
                <div class="card-title">轮播设置 <span class="card-tip">首页留言卡片自动轮播的速度</span></div>
                <div class="form-group">
                    <label class="form-label">轮播间隔（毫秒）</label>
                    <input type="number" class="form-input" data-field="carouselInterval" min="1000" step="500" value="5000" />
                    <div class="form-hint">默认 5000 毫秒（5 秒），最小 1000 毫秒</div>
                </div>
            </div>
            <div class="card">
                <div class="card-title">
                    留言条目
                    <span class="card-tip">首页留言卡片轮播展示的内容，按顺序循环播放</span>
                </div>
                <div data-role="comment-list" class="space-y-3"></div>
                <div class="form-footer">
                    <button type="button" class="btn" data-role="add-comment">+ 添加一条</button>
                    <button type="button" class="btn btn-primary" data-save="music-comments">保存音乐与留言</button>
                    <span class="form-hint">保存模块：musicPlayer、comments</span>
                </div>
            </div>
        </div>`;

    /** 按字段名取输入控件 */
    function field(name) {
        return container.querySelector('[data-field="' + name + '"]');
    }

    /** 表单变化 -> 标记脏状态 */
    function markDirty() {
        guard.setDirty(true);
    }
    watchFormChanges(container, markDirty);

    /* ---------- tab 切换（纯 JS 控制显隐与高亮） ---------- */
    const tabsBar = container.querySelector('[data-role="tabs"]');
    tabsBar.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-tab]');
        if (!btn) return;
        const tab = btn.dataset.tab;
        container.querySelectorAll('[data-panel]').forEach((panel) => {
            panel.hidden = panel.dataset.panel !== tab;
        });
        tabsBar.querySelectorAll('[data-tab]').forEach((item) => {
            item.classList.toggle('btn-primary', item === btn);
        });
    });

    /* ---------- 复合字段组件 ---------- */

    // 头像图片字段（tab 1）
    const avatarField = createImageField({
        label: '头像',
        placeholder: '头像图片 URL，或点击上传',
        onChange: markDirty
    });
    container.querySelector('[data-field-group="avatar"]').appendChild(avatarField.el);

    // 简介富文本（tab 1，内容较短，编辑区 280px）
    const descriptionField = createRichTextField({
        value: '',
        height: 280,
        placeholder: '请输入简介内容，支持 HTML...',
        onChange: markDirty
    });
    container.querySelector('[data-field-group="description"]').appendChild(descriptionField.el);

    // 关于我长文富文本（tab 2，内容较长，编辑区 520px）
    const learnMoreField = createRichTextField({
        value: '',
        height: 520,
        placeholder: '请输入「了解更多」弹窗的完整介绍...',
        onChange: markDirty
    });
    container.querySelector('[data-field-group="learnMoreContent"]').appendChild(learnMoreField.el);

    /** 收集留言条目 */
    function collectCommentsList() {
        const items = [];
        container.querySelectorAll('[data-comment-item]').forEach((item) => {
            const text = item.querySelector('[data-comment-text]').value.trim();
            const date = item.querySelector('[data-comment-date]').value.trim();
            if (text) items.push({ text, date });
        });
        return items;
    }

    /**
     * 按模块名收集对应的数据
     * @param {string} moduleKey 模块标识：profile | learnmore | social | contact | music-comments
     * @returns {object} 传给 saveConfigModules 的 modules 对象
     */
    function collectModule(moduleKey) {
        switch (moduleKey) {
            case 'profile':
                return {
                    user: {
                        name: field('name').value.trim(),
                        title: field('title').value.trim(),
                        description: descriptionField.getValue(),
                        avatar: avatarField.getValue(),
                        learnMoreLink: field('learnMoreLink').value.trim()
                    }
                };
            case 'learnmore':
                return {
                    user: { learnMoreContent: learnMoreField.getValue() }
                };
            case 'social':
                return {
                    socialLinks: {
                        bilibili: field('bilibili').value.trim(),
                        netease: field('netease').value.trim(),
                        weibo: field('weibo').value.trim(),
                        qqGroup: field('qqGroup').value.trim()
                    }
                };
            case 'contact':
                return {
                    contactText: field('contactText').value.trim(),
                    contactButtonLink: field('contactButtonLink').value.trim()
                };
            case 'music-comments': {
                const intervalVal = parseInt(field('carouselInterval').value, 10);
                const carouselInterval = isNaN(intervalVal) || intervalVal < 1000 ? 5000 : intervalVal;
                return {
                    musicPlayer: { playlistId: field('playlistId').value.trim() },
                    comments: { carouselInterval, list: collectCommentsList() }
                };
            }
            default:
                return {};
        }
    }

    /** 模块元信息：名称 + 说明（用于二次确认和 toast） */
    const MODULE_META = {
        profile: { label: '个人信息', modules: ['user'] },
        learnmore: { label: '关于我长文', modules: ['user.learnMoreContent'] },
        social: { label: '社交链接', modules: ['socialLinks'] },
        contact: { label: '联系方式', modules: ['contactText', 'contactButtonLink'] },
        'music-comments': { label: '音乐与留言', modules: ['musicPlayer', 'comments'] }
    };

    /** 独立保存某个模块 */
    async function handleSaveModule(moduleKey, btn) {
        const meta = MODULE_META[moduleKey];
        if (!meta) {
            toast('未知的保存模块：' + moduleKey, 'error');
            return;
        }

        const ok = await confirmDialog({
            title: `保存${meta.label}`,
            message: `即将保存模块：${meta.modules.join('、')}。确定保存吗？`
        });
        if (!ok) return;

        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '保存中…';
        try {
            await saveConfigModules(collectModule(moduleKey));
            toast(`${meta.label}已保存`, 'success');
            // 模块保存成功不清除全局守卫（其他 tab 可能还有未保存内容），
            // 但可以在这里做局部脏状态标记（当前实现为全局守卫，保持不变）
        } catch (err) {
            toast(err.message || '保存失败', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }

    // 保存按钮使用事件委托（绑定在 container 上），更稳健：
    // 即使局部 DOM 重建（如富文本编辑器初始化），也不会丢失事件绑定
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-save]');
        if (!btn) return;
        handleSaveModule(btn.dataset.save, btn);
    });

    /* ---------- 留言板：条目增删渲染 ---------- */
    const commentListEl = container.querySelector('[data-role="comment-list"]');

    function renderCommentItem(cfg = {}) {
        const item = document.createElement('div');
        item.className = 'comment-item';
        item.setAttribute('data-comment-item', '');
        item.style.cssText = 'display:flex;gap:10px;align-items:flex-start;padding:12px;border:1px solid var(--border-color);border-radius:12px;background:var(--gray-50);';
        item.innerHTML = `
            <div style="flex:1;display:flex;flex-direction:column;gap:8px;min-width:0;">
                <textarea data-comment-text rows="2" class="form-textarea" placeholder="留言内容..." style="min-height:60px;">${escapeHtml(cfg.text || '')}</textarea>
                <input type="text" data-comment-date class="form-input" placeholder="日期（如 2025/10/25）" value="${escapeHtml(cfg.date || '')}" style="max-width:240px;" />
            </div>
            <button type="button" class="btn btn-sm btn-danger" data-role="delete-comment" title="删除">
                ${icon('trash-2', { class: 'w-4 h-4' })}
            </button>
        `;
        item.querySelector('[data-role="delete-comment"]').addEventListener('click', () => {
            item.remove();
            markDirty();
        });
        item.querySelectorAll('textarea, input').forEach((el) => {
            el.addEventListener('input', markDirty);
        });
        return item;
    }

    container.querySelector('[data-role="add-comment"]').addEventListener('click', () => {
        commentListEl.appendChild(renderCommentItem());
        markDirty();
    });

    /* ---------- 加载当前配置并回填（程序化赋值不触发脏状态） ---------- */
    async function load() {
        showLoading(container);
        try {
            const config = await loadSiteConfig();
            const user = config.user || {};
            const socialLinks = config.socialLinks || {};
            const musicPlayer = config.musicPlayer || {};

            field('name').value = user.name || '';
            field('title').value = user.title || '';
            field('learnMoreLink').value = user.learnMoreLink || '';
            avatarField.setValue(user.avatar || '');
            descriptionField.setValue(user.description || '');
            learnMoreField.setValue(user.learnMoreContent || '');

            field('bilibili').value = socialLinks.bilibili || '';
            field('netease').value = socialLinks.netease || '';
            field('weibo').value = socialLinks.weibo || '';
            field('qqGroup').value = socialLinks.qqGroup || '';

            field('contactText').value = typeof config.contactText === 'string' ? config.contactText : '';
            field('contactButtonLink').value = typeof config.contactButtonLink === 'string' ? config.contactButtonLink : '';
            field('playlistId').value = musicPlayer.playlistId || '';

            // 留言板
            const comments = config.comments || {};
            field('carouselInterval').value = comments.carouselInterval || 5000;
            commentListEl.innerHTML = '';
            const list = (comments.list && comments.list.length) ? comments.list : [
                { text: '承接干声修对业务，原创曲/填词曲/合唱企划欢迎戳我~', date: '2025/9/13' },
                { text: 'Hello, Sekai', date: '2025/10/25' }
            ];
            list.forEach((item) => {
                commentListEl.appendChild(renderCommentItem(item));
            });
        } catch (err) {
            // 加载失败：以错误占位替换整个页面，避免在空表单上误存覆盖配置
            container.innerHTML = `
                <div class="card">
                    <div class="empty">
                        <div class="empty-icon">${icon('alert-circle', { class: 'w-12 h-12' })}</div>
                        <div class="empty-text">配置加载失败：${escapeHtml(err.message || '未知错误')}</div>
                    </div>
                </div>`;
            toast(err.message || '配置加载失败', 'error');
        } finally {
            hideLoading(container);
        }
    }

    load();
}