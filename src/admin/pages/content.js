/**
 * 文字内容页（#/content）
 *
 * 页内 tab 分四组编辑：
 * 1. 个人信息：user.name / user.title / user.description（富文本）/ user.avatar / user.learnMoreLink
 * 2. 了解更多长文：user.learnMoreContent（富文本，内容较长单独成 tab）
 * 3. 社交与联系：socialLinks 四项 / contactText / contactButtonLink
 * 4. 音乐播放器：musicPlayer.playlistId
 *
 * 保存时一次提交 modules: { user, socialLinks, contactText, contactButtonLink, musicPlayer }。
 *
 * 富文本字段组件（createRichTextField）说明：
 * - 默认源码模式：等宽字体 textarea 显示原始 HTML，原样保存不重排
 * - 「切换到富文本」：内容非空时先确认（wangEditor 会重排 HTML），确认后挂载
 *   wangEditor（createToolbar + createEditor）并载入当前内容
 * - 「切换回源码」：把 editor.getHtml() 写回 textarea 并销毁编辑器实例
 * - 「预览」：模态框内 iframe（srcdoc 引入 Tailwind CDN）正确预览含 class 的内容
 * - 编辑器内图片上传复用 presign 直传流程（customUpload）
 */
import { createEditor, createToolbar } from '@wangeditor/editor';
import '@wangeditor/editor/dist/css/style.css';
import { toast, confirmDialog, createUnsavedGuard, registerGuard, clearGuard, showLoading, hideLoading } from '../ui.js';
import { escapeHtml, loadSiteConfig, saveConfigModules, uploadImage, createImageField, watchFormChanges } from './_shared.js';

/* ============================================================
 * 富文本字段组件（「简介」与「了解更多长文」共用）
 * ============================================================ */

/** 字段实例序号（保证 wangEditor 挂载点 id 在页面内唯一） */
let richFieldSeq = 0;

/**
 * 创建富文本字段：默认源码模式（等宽 textarea，原样保存 HTML），
 * 可切换 wangEditor 富文本模式，带图片上传与 Tailwind 预览。
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
            <button type="button" class="btn btn-sm" data-role="toggle">切换到富文本</button>
            <button type="button" class="btn btn-sm" data-role="preview">预览</button>
            <span class="form-hint" data-role="mode-tip" style="margin:0;">当前模式：源码（原样保存，不重排 HTML）</span>
        </div>
        <textarea class="form-textarea" data-role="source" spellcheck="false"
                  style="font-family:ui-monospace,SFMono-Regular,Consolas,'Courier New',monospace;font-size:13px;min-height:${height}px;"></textarea>
        <div class="editor-wrap" data-role="wrap" hidden style="height:${height}px;">
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
    /** 是否正在切换模式（防止确认弹窗期间重复触发） */
    let switching = false;

    // 源码模式输入 -> 脏状态
    sourceArea.addEventListener('input', () => {
        if (onChange) onChange();
    });

    /** 切换到富文本模式（内容非空时先确认，防止重排丢结构） */
    async function switchToRich() {
        if (editor || switching) return;
        const html = sourceArea.value;
        if (html.trim()) {
            switching = true;
            const ok = await confirmDialog({
                title: '切换编辑模式',
                message: '富文本编辑器可能会重排现有 HTML 结构（如移除自定义 class、合并标签）。确定切换吗？'
            });
            switching = false;
            if (!ok) return;
        }

        // 先显示容器再创建实例（编辑器需在可见环境下计算高度）
        sourceArea.hidden = true;
        wrap.hidden = false;

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
        toolbar = createToolbar({ editor, selector: '#' + toolbarId, config: {} });

        toggleBtn.textContent = '切换回源码';
        modeTip.textContent = '当前模式：富文本（wangEditor，保存时取编辑器内容）';
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

/** 渲染文字内容页 @param {HTMLElement} container */
export function render(container) {
    // 未保存守卫：表单变化置脏，保存成功后复位
    const guard = createUnsavedGuard();
    registerGuard(guard);

    container.innerHTML = `
        <div class="page-header">
            <h2>文字内容</h2>
            <span class="page-tip">个人信息、社交链接、联系方式与音乐播放器等文字内容编辑</span>
        </div>

        <!-- 页内 tab 切换（纯 JS 控制面板显隐） -->
        <div class="toolbar" data-role="tabs">
            <button type="button" class="btn btn-sm btn-primary" data-tab="profile">个人信息</button>
            <button type="button" class="btn btn-sm" data-tab="learnmore">了解更多长文</button>
            <button type="button" class="btn btn-sm" data-tab="social">社交与联系</button>
            <button type="button" class="btn btn-sm" data-tab="music">音乐播放器</button>
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
            </div>
        </div>

        <!-- tab 2：了解更多长文 -->
        <div data-panel="learnmore" hidden>
            <div class="card">
                <div class="card-title">了解更多长文 <span class="card-tip">「了解更多」弹窗中的完整介绍，支持 HTML 与 Tailwind class</span></div>
                <div data-field-group="learnMoreContent"></div>
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
            </div>
            <div class="card">
                <div class="card-title">联系方式 <span class="card-tip">联系方式卡片的多行文本与按钮链接</span></div>
                <div class="form-group">
                    <label class="form-label">联系方式文本</label>
                    <textarea class="form-textarea" data-field="contactText"
                              placeholder="每行一条联系方式，如：哔哩哔哩：@xxx"></textarea>
                    <div class="form-hint">保存为字符串模块（contactText），前台按行展示</div>
                </div>
                <div class="form-group">
                    <label class="form-label">联系按钮链接</label>
                    <input type="text" class="form-input" data-field="contactButtonLink"
                           placeholder="联系方式卡片「Read more」按钮跳转的链接" />
                    <div class="form-hint">保存为字符串模块（contactButtonLink）</div>
                </div>
            </div>
        </div>

        <!-- tab 4：音乐播放器 -->
        <div data-panel="music" hidden>
            <div class="card">
                <div class="card-title">音乐播放器 <span class="card-tip">首页音乐卡片加载的网易云歌单</span></div>
                <div class="form-group">
                    <label class="form-label">歌单 ID</label>
                    <input type="text" class="form-input" data-field="playlistId" placeholder="网易云音乐歌单 ID，如：17479746916" />
                    <div class="form-hint">可在网易云音乐网页版歌单页地址中查看 ID 数字</div>
                </div>
            </div>
        </div>

        <!-- 保存（跨 tab 全量提交） -->
        <div class="card">
            <div class="form-footer" style="margin-top:0;">
                <button type="button" class="btn btn-primary" data-role="save">保存全部修改</button>
                <span class="form-hint">一次性提交 user、socialLinks、contactText、contactButtonLink、musicPlayer 五个模块</span>
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

    // 简介富文本（tab 1，内容较短，编辑区 260px）
    const descriptionField = createRichTextField({
        value: '',
        height: 260,
        placeholder: '请输入简介内容，支持 HTML...',
        onChange: markDirty
    });
    container.querySelector('[data-field-group="description"]').appendChild(descriptionField.el);

    // 了解更多长文富文本（tab 2，内容较长，编辑区 480px）
    const learnMoreField = createRichTextField({
        value: '',
        height: 480,
        placeholder: '请输入「了解更多」弹窗的完整介绍...',
        onChange: markDirty
    });
    container.querySelector('[data-field-group="learnMoreContent"]').appendChild(learnMoreField.el);

    /** 收集全部模块（跨 tab 全量提交；富文本字段原样取值不重排） */
    function collectModules() {
        return {
            user: {
                name: field('name').value.trim(),
                title: field('title').value.trim(),
                description: descriptionField.getValue(),
                avatar: avatarField.getValue(),
                learnMoreLink: field('learnMoreLink').value.trim(),
                learnMoreContent: learnMoreField.getValue()
            },
            socialLinks: {
                bilibili: field('bilibili').value.trim(),
                netease: field('netease').value.trim(),
                weibo: field('weibo').value.trim(),
                qqGroup: field('qqGroup').value.trim()
            },
            contactText: field('contactText').value.trim(),
            contactButtonLink: field('contactButtonLink').value.trim(),
            musicPlayer: {
                playlistId: field('playlistId').value.trim()
            }
        };
    }

    /* ---------- 保存：二次确认后一次提交五个模块 ---------- */
    const saveBtn = container.querySelector('[data-role="save"]');
    saveBtn.addEventListener('click', async () => {
        const ok = await confirmDialog({
            title: '确认保存',
            message: '即将保存模块：user、socialLinks、contactText、contactButtonLink、musicPlayer（个人信息、了解更多长文、社交与联系、音乐播放器）。确定保存吗？'
        });
        if (!ok) return;

        saveBtn.disabled = true;
        saveBtn.textContent = '保存中…';
        try {
            await saveConfigModules(collectModules());
            toast('保存成功');
            guard.setDirty(false);
            clearGuard();
        } catch (err) {
            toast(err.message || '保存失败', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = '保存全部修改';
        }
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
        } catch (err) {
            // 加载失败：以错误占位替换整个页面，避免在空表单上误存覆盖配置
            container.innerHTML = `
                <div class="card">
                    <div class="empty">
                        <div class="empty-icon">⚠️</div>
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