/**
 * 卡片管理页（#/cards）
 *
 * 完整功能：
 * - 卡片列表展示（含启用/禁用状态）
 * - HTML5 Drag & Drop 拖拽排序
 * - 添加卡片（9 种模板选择 + 配置表单）
 * - 编辑卡片（按模板 configFields 动态生成表单）
 * - 删除卡片（二次确认）
 * - 启用/禁用切换
 * - 保存全部修改（一次性提交 cards 模块）
 * - 未保存守卫
 */
import { icon } from '../icons.js';
import { toast, confirmDialog, createUnsavedGuard, registerGuard, clearGuard, showLoading, hideLoading, emptyState } from '../ui.js';
import { escapeHtml, loadSiteConfig, saveConfigModules, watchFormChanges } from './_shared.js';

/* ============================================================
 * 卡片模板定义（与前端 cardTemplates/index.js 保持一致，只保留配置字段）
 * ============================================================ */

const CARD_TEMPLATES = {
    userInfo: {
        name: '用户信息',
        description: '展示头像、昵称、头衔与简介',
        defaultConfig: { id: 'user-info-card', colSpan: 2 },
        configFields: [
            { key: 'id', label: '卡片ID', type: 'text', default: 'user-info-card', hint: '唯一标识，英文数字' }
        ]
    },
    map: {
        name: '地图卡片',
        description: '嵌入地图，展示地理位置',
        defaultConfig: { id: 'map-card' },
        configFields: [
            { key: 'id', label: '卡片ID', type: 'text', default: 'map-card', hint: '唯一标识，英文数字' }
        ]
    },
    comment: {
        name: '留言轮播',
        description: '轮播展示留言板内容',
        defaultConfig: { id: 'comment-card' },
        configFields: [
            { key: 'id', label: '卡片ID', type: 'text', default: 'comment-card', hint: '唯一标识，英文数字' }
        ]
    },
    follower: {
        name: '粉丝统计',
        description: '显示各平台粉丝数量',
        defaultConfig: {
            id: 'follower-card',
            platform: 'bilibili',
            title: '哔哩哔哩',
            color: 'pink',
            apiUrl: '',
            homepageUrl: '',
            icon: ''
        },
        configFields: [
            { key: 'id', label: '卡片ID', type: 'text', default: 'follower-card', hint: '唯一标识，英文数字' },
            { key: 'platform', label: '平台标识', type: 'text', default: 'bilibili', hint: '用于 DOM 元素 ID，英文' },
            { key: 'title', label: '平台名称', type: 'text', default: '哔哩哔哩', required: true },
            { key: 'color', label: '主题色', type: 'select', options: [
                { value: 'blue', label: '蓝色' },
                { value: 'red', label: '红色' },
                { value: 'yellow', label: '黄色' },
                { value: 'green', label: '绿色' },
                { value: 'purple', label: '紫色' },
                { value: 'pink', label: '粉色' }
            ]},
            { key: 'icon', label: '图标 SVG 代码', type: 'textarea', rows: 4, hint: '粘贴 SVG 代码，留空使用平台默认图标' },
            { key: 'apiUrl', label: '粉丝数 API 地址', type: 'url', required: true, hint: '返回 { count: 数字 } 格式' },
            { key: 'homepageUrl', label: '主页链接', type: 'url' }
        ]
    },
    musicPlayer: {
        name: '音乐播放器',
        description: '网易云音乐歌单播放器',
        defaultConfig: { id: 'music-player-card', rowSpan: 2 },
        configFields: [
            { key: 'id', label: '卡片ID', type: 'text', default: 'music-player-card', hint: '唯一标识，英文数字' },
            { key: 'playlistId', label: '网易云歌单 ID', type: 'text', default: '17479746916', hint: '歌单页面 URL 中的数字 ID' }
        ]
    },
    contact: {
        name: '联系方式',
        description: '展示多条联系方式',
        defaultConfig: { id: 'contact-card', colSpan: 2 },
        configFields: [
            { key: 'id', label: '卡片ID', type: 'text', default: 'contact-card', hint: '唯一标识，英文数字' }
        ]
    },
    xingtone: {
        name: 'XingTone 入口',
        description: 'XingTone 项目入口卡片',
        defaultConfig: { id: 'xingtone-card' },
        configFields: [
            { key: 'id', label: '卡片ID', type: 'text', default: 'xingtone-card', hint: '唯一标识，英文数字' }
        ]
    },
    video: {
        name: '视频卡片',
        description: '单个视频封面与播放',
        defaultConfig: { id: 'video-card-0', videoIndex: 0 },
        configFields: [
            { key: 'id', label: '卡片ID', type: 'text', default: 'video-card-0', hint: '唯一标识，英文数字' },
            { key: 'videoIndex', label: '视频索引', type: 'number', default: 0, min: 0, hint: '第几个视频（从 0 开始）' }
        ]
    },
    freeform: {
        name: '自由内容',
        description: '自定义内容的自由卡片',
        defaultConfig: {
            id: 'freeform-card',
            title: '自定义卡片',
            content: '<p>在这里输入你想展示的内容</p>',
            bgColor: '',
            colSpan: '1'
        },
        configFields: [
            { key: 'id', label: '卡片ID', type: 'text', default: 'freeform-card', hint: '唯一标识，英文数字' },
            { key: 'title', label: '卡片标题', type: 'text' },
            { key: 'content', label: '内容 HTML', type: 'textarea', rows: 8, hint: '支持 HTML 和 Tailwind class' },
            { key: 'bgColor', label: '背景色', type: 'select', options: [
                { value: '', label: '默认卡片背景' },
                { value: 'bg-gradient-to-br from-blue-50 to-blue-100', label: '蓝色渐变' },
                { value: 'bg-gradient-to-br from-purple-50 to-purple-100', label: '紫色渐变' },
                { value: 'bg-gradient-to-br from-green-50 to-green-100', label: '绿色渐变' },
                { value: 'bg-gradient-to-br from-pink-50 to-pink-100', label: '粉色渐变' },
                { value: 'bg-gradient-to-br from-yellow-50 to-yellow-100', label: '黄色渐变' }
            ]},
            { key: 'colSpan', label: '列跨度', type: 'select', options: [
                { value: '1', label: '1 列（默认）' },
                { value: '2', label: '2 列（宽卡）' }
            ]}
        ]
    }
};

/* ============================================================
 * 默认卡片配置（13 张，粉丝卡 icon 留空由前端兜底）
 * ============================================================ */

const DEFAULT_CARDS = [
    { id: 'user-info',       type: 'userInfo',    order: 1,  enabled: true, config: { id: 'user-info-card', colSpan: 2 } },
    { id: 'map',             type: 'map',         order: 2,  enabled: true, config: { id: 'map-card' } },
    { id: 'comment',         type: 'comment',     order: 3,  enabled: true, config: { id: 'comment-card' } },
    {
        id: 'follower-bilibili',
        type: 'follower',
        order: 4,
        enabled: true,
        config: {
            id: 'follower-bilibili',
            platform: 'bilibili',
            title: '哔哩哔哩',
            color: 'pink',
            apiUrl: 'https://bili-count-api.chikuu.top/api/count?vmid=28826850',
            homepageUrl: 'https://space.bilibili.com/28826850',
            icon: ''
        }
    },
    {
        id: 'follower-netease',
        type: 'follower',
        order: 5,
        enabled: true,
        config: {
            id: 'follower-netease',
            platform: 'netease',
            title: '网易云音乐',
            color: 'red',
            apiUrl: 'https://api.swo.moe/stats/neteasemusic/379188047',
            homepageUrl: 'https://music.163.com/#/artist?id=34407615',
            icon: ''
        }
    },
    {
        id: 'follower-weibo',
        type: 'follower',
        order: 6,
        enabled: true,
        config: {
            id: 'follower-weibo',
            platform: 'weibo',
            title: '新浪微博',
            color: 'yellow',
            apiUrl: 'https://api.swo.moe/stats/weibo/5574382615',
            homepageUrl: 'https://weibo.com/5574382615',
            icon: ''
        }
    },
    { id: 'music-player',    type: 'musicPlayer', order: 7,  enabled: true, config: { id: 'music-player-card', rowSpan: 2 } },
    { id: 'contact',         type: 'contact',     order: 8,  enabled: true, config: { id: 'contact-card', colSpan: 2 } },
    { id: 'xingtone',        type: 'xingtone',    order: 9,  enabled: true, config: { id: 'xingtone-card' } },
    { id: 'video-0',         type: 'video',       order: 10, enabled: true, config: { id: 'video-card-0', videoIndex: 0 } },
    { id: 'video-1',         type: 'video',       order: 11, enabled: true, config: { id: 'video-card-1', videoIndex: 1 } },
    { id: 'video-2',         type: 'video',       order: 12, enabled: true, config: { id: 'video-card-2', videoIndex: 2 } },
    { id: 'video-3',         type: 'video',       order: 13, enabled: true, config: { id: 'video-card-3', videoIndex: 3 } }
];

/* ============================================================
 * 表单生成器
 * ============================================================ */

/**
 * 根据字段定义动态生成表单
 * @param {Array} fields 字段定义数组
 * @param {object} values 初始值
 * @param {object} options
 * @param {() => void} [options.onChange] 值变化回调
 * @returns {{ el: HTMLElement, getValues(): object, setValues(values: object): void }}
 */
function generateFormFields(fields, values = {}, { onChange = null } = {}) {
    const root = document.createElement('div');
    root.className = 'form-fields';
    root.style.cssText = 'display:flex;flex-direction:column;gap:14px;';

    fields.forEach((field) => {
        const group = document.createElement('div');
        group.className = 'form-group';

        const labelText = field.label + (field.required ? ' <span style="color:var(--color-danger)">*</span>' : '');
        let controlHtml = '';

        const val = values[field.key] != null ? values[field.key] : (field.default != null ? field.default : '');
        const escVal = escapeHtml(val);

        switch (field.type) {
            case 'text':
            case 'url':
            case 'number':
                controlHtml = `<input type="${field.type}" class="form-input" data-field="${field.key}" value="${escVal}"` +
                    (field.type === 'number' && field.min != null ? ` min="${field.min}"` : '') +
                    (field.type === 'number' && field.step != null ? ` step="${field.step}"` : '') +
                    (field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : '') +
                    ' />';
                break;
            case 'textarea':
                controlHtml = `<textarea class="form-textarea" data-field="${field.key}"` +
                    (field.rows ? ` rows="${field.rows}"` : ' rows="4"') +
                    (field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : '') +
                    `>${escVal}</textarea>`;
                break;
            case 'select':
                const options = (field.options || []).map((opt) => {
                    const selected = String(opt.value) === String(val) ? ' selected' : '';
                    return `<option value="${escapeHtml(opt.value)}"${selected}>${escapeHtml(opt.label)}</option>`;
                }).join('');
                controlHtml = `<select class="form-input" data-field="${field.key}">${options}</select>`;
                break;
            default:
                controlHtml = `<input type="text" class="form-input" data-field="${field.key}" value="${escVal}" />`;
        }

        group.innerHTML = `
            <label class="form-label">${labelText}</label>
            ${controlHtml}
            ${field.hint ? `<div class="form-hint">${escapeHtml(field.hint)}</div>` : ''}`;

        root.appendChild(group);
    });

    // 监听变化
    if (onChange) {
        watchFormChanges(root, onChange);
    }

    return {
        el: root,
        getValues() {
            const result = {};
            fields.forEach((field) => {
                const el = root.querySelector('[data-field="' + field.key + '"]');
                if (!el) {
                    result[field.key] = values[field.key];
                    return;
                }
                if (field.type === 'number') {
                    const num = parseFloat(el.value);
                    result[field.key] = isNaN(num) ? (el.value || '') : num;
                } else {
                    result[field.key] = el.value;
                }
            });
            return result;
        },
        setValues(vals) {
            fields.forEach((field) => {
                const el = root.querySelector('[data-field="' + field.key + '"]');
                if (!el) return;
                const v = vals[field.key] != null ? vals[field.key] : '';
                el.value = v;
            });
        }
    };
}

/* ============================================================
 * 编辑模态框
 * ============================================================ */

/**
 * 打开卡片编辑模态框
 * @param {object} cardItem 卡片数据（含 type、config 等）
 * @param {'add'|'edit'} mode
 * @returns {Promise<object|null>} 返回新的 config 对象，取消返回 null
 */
function openCardEditor(cardItem, mode = 'edit') {
    return new Promise((resolve) => {
        const template = CARD_TEMPLATES[cardItem.type];
        if (!template) {
            toast('未知的卡片模板类型', 'error');
            resolve(null);
            return;
        }

        const mask = document.createElement('div');
        mask.className = 'modal-mask';

        const form = generateFormFields(template.configFields, cardItem.config || {});

        mask.innerHTML = `
            <div class="modal" role="dialog" aria-modal="true" style="width:560px;max-height:90vh;display:flex;flex-direction:column;">
                <div class="modal-title">${mode === 'add' ? '配置新卡片 - ' : '编辑卡片 - '}${escapeHtml(template.name)}</div>
                <div data-role="form-container" style="overflow-y:auto;padding:0 4px;"></div>
                <div class="modal-footer" style="margin-top:14px;margin-bottom:0;">
                    <button type="button" class="btn" data-role="cancel">取消</button>
                    <button type="button" class="btn btn-primary" data-role="save">${mode === 'add' ? '添加' : '保存'}</button>
                </div>
            </div>`;

        mask.querySelector('[data-role="form-container"]').appendChild(form.el);

        const close = (result) => {
            mask.remove();
            resolve(result);
        };

        mask.querySelector('[data-role="cancel"]').addEventListener('click', () => close(null));
        mask.addEventListener('click', (e) => {
            if (e.target === mask) close(null);
        });

        mask.querySelector('[data-role="save"]').addEventListener('click', () => {
            const vals = form.getValues();
            // 简单必填校验
            for (const field of template.configFields) {
                if (field.required && !vals[field.key]) {
                    toast('请填写 ' + field.label, 'warning');
                    return;
                }
            }
            close(vals);
        });

        document.body.appendChild(mask);
        // 焦点到第一个输入框
        const firstInput = mask.querySelector('.form-input, .form-textarea');
        if (firstInput) firstInput.focus();
    });
}

/* ============================================================
 * 模板选择模态框
 * ============================================================ */

/**
 * 打开模板选择模态框
 * @returns {Promise<string|null>} 返回选中的模板 type，取消返回 null
 */
function openTemplatePicker() {
    return new Promise((resolve) => {
        const mask = document.createElement('div');
        mask.className = 'modal-mask';

        const templateTypes = Object.keys(CARD_TEMPLATES);

        mask.innerHTML = `
            <div class="modal" role="dialog" aria-modal="true" style="width:720px;max-height:90vh;display:flex;flex-direction:column;">
                <div class="modal-title">选择卡片模板</div>
                <div class="template-grid" data-role="grid"
                     style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;overflow-y:auto;">
                    ${templateTypes.map((type) => {
                        const t = CARD_TEMPLATES[type];
                        return `
                            <div class="template-item card" data-type="${type}"
                                 style="cursor:pointer;padding:16px;margin:0;transition:all 0.2s;border:2px solid transparent;">
                                <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                                    <div style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:var(--color-bg);border-radius:8px;color:var(--color-primary);">
                                        ${icon('layout-grid', { width: 20, height: 20 })}
                                    </div>
                                    <div style="font-weight:600;font-size:14px;color:var(--color-text);">${escapeHtml(t.name)}</div>
                                </div>
                                <div style="font-size:12px;color:var(--color-text-secondary);line-height:1.5;">${escapeHtml(t.description)}</div>
                            </div>`;
                    }).join('')}
                </div>
                <div class="modal-footer" style="margin-top:14px;margin-bottom:0;">
                    <button type="button" class="btn" data-role="cancel">取消</button>
                </div>
            </div>`;

        const close = (result) => {
            mask.remove();
            resolve(result);
        };

        mask.querySelector('[data-role="cancel"]').addEventListener('click', () => close(null));
        mask.addEventListener('click', (e) => {
            if (e.target === mask) close(null);
        });

        mask.querySelectorAll('.template-item').forEach((item) => {
            item.addEventListener('click', () => {
                close(item.dataset.type);
            });
            item.addEventListener('mouseenter', () => {
                item.style.borderColor = 'var(--color-primary)';
            });
            item.addEventListener('mouseleave', () => {
                item.style.borderColor = 'transparent';
            });
        });

        document.body.appendChild(mask);
    });
}

/* ============================================================
 * 页面渲染
 * ============================================================ */

/**
 * 渲染卡片管理页
 * @param {HTMLElement} container
 */
export function render(container) {
    // 未保存守卫
    const guard = createUnsavedGuard();
    registerGuard(guard);

    /** 当前卡片列表（内存中操作，保存时提交） */
    let cards = [];
    /** 拖拽状态 */
    let dragIndex = -1;

    container.innerHTML = `
        <div class="page-header" style="align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;">
                <h2>卡片管理</h2>
                <span class="page-tip">管理首页展示的卡片，可自由增删、排序和配置</span>
            </div>
            <div class="toolbar-right" style="margin-left:0;">
                <button class="btn btn-primary" data-role="add-card">
                    ${icon('plus', { width: 16, height: 16 })}
                    添加卡片
                </button>
            </div>
        </div>

        <!-- 卡片列表 -->
        <div class="card">
            <div class="card-title" style="display:flex;align-items:center;justify-content:space-between;">
                <span>卡片列表 <span class="card-tip" data-role="count-tip">共 0 张</span></span>
            </div>
            <div data-role="card-list" style="display:flex;flex-direction:column;gap:8px;"></div>
        </div>

        <!-- 保存栏 -->
        <div class="card" style="margin-top:16px;">
            <div class="form-footer" style="margin-top:0;">
                <button type="button" class="btn btn-primary" data-role="save-all">保存全部修改</button>
                <span class="form-hint">所有修改在点击保存后才会生效</span>
            </div>
        </div>`;

    const listEl = container.querySelector('[data-role="card-list"]');
    const countTipEl = container.querySelector('[data-role="count-tip"]');

    /** 标记脏状态 */
    function markDirty() {
        guard.setDirty(true);
    }

    /* ---------- 渲染列表 ---------- */

    function renderList() {
        listEl.innerHTML = '';

        if (!cards.length) {
            listEl.innerHTML = emptyState('暂无卡片，点击右上角「添加卡片」开始创建');
            countTipEl.textContent = '共 0 张';
            return;
        }

        countTipEl.textContent = `共 ${cards.length} 张`;

        cards.forEach((cardItem, index) => {
            const template = CARD_TEMPLATES[cardItem.type];
            const tplName = template ? template.name : '未知模板';
            const cardId = cardItem.config?.id || cardItem.id;
            const isDisabled = cardItem.enabled === false;

            const row = document.createElement('div');
            row.className = 'card-row';
            row.draggable = true;
            row.dataset.index = index;
            row.style.cssText =
                'display:flex;align-items:center;gap:12px;padding:12px 14px;' +
                'border:1px solid var(--border-color);border-radius:10px;' +
                'background:var(--card-bg);transition:all 0.15s;' +
                (isDisabled ? 'opacity:0.5;background:var(--color-bg);' : '');

            row.innerHTML = `
                <div class="drag-handle" data-role="drag-handle"
                     style="cursor:grab;color:var(--color-text-secondary);padding:4px;user-select:none;flex-shrink:0;"
                     title="拖拽排序">
                    ${icon('drag-handle', { width: 16, height: 16 })}
                </div>
                <div style="flex:1;min-width:0;display:flex;align-items:center;gap:12px;">
                    <div style="flex-shrink:0;width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:var(--color-bg);border-radius:8px;color:var(--color-primary);">
                        ${icon('layout-grid', { width: 18, height: 18 })}
                    </div>
                    <div style="min-width:0;">
                        <div style="font-size:14px;font-weight:500;color:var(--color-text);">
                            ${escapeHtml(tplName)}
                            <span style="color:var(--color-text-secondary);font-weight:400;margin-left:6px;font-size:13px;">
                                ${escapeHtml(cardId)}
                            </span>
                        </div>
                        <div style="font-size:12px;color:var(--color-text-secondary);margin-top:2px;">
                            类型：${escapeHtml(cardItem.type)} · 排序：${index + 1}
                        </div>
                    </div>
                </div>
                <div style="flex-shrink:0;">
                    <span class="badge ${isDisabled ? 'badge-gray' : 'badge-success'}">
                        ${isDisabled ? '已禁用' : '已启用'}
                    </span>
                </div>
                <div style="flex-shrink:0;display:flex;gap:6px;">
                    <button type="button" class="btn btn-sm" data-role="edit" title="编辑">
                        ${icon('edit-3', { width: 14, height: 14 })}
                    </button>
                    <button type="button" class="btn btn-sm" data-role="toggle" title="${isDisabled ? '启用' : '禁用'}">
                        ${icon('eye', { width: 14, height: 14 })}
                    </button>
                    <button type="button" class="btn btn-sm btn-danger" data-role="delete" title="删除">
                        ${icon('trash-2', { width: 14, height: 14 })}
                    </button>
                </div>`;

            // 拖拽事件
            row.addEventListener('dragstart', (e) => {
                dragIndex = index;
                row.style.opacity = '0.5';
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(index));
            });

            row.addEventListener('dragend', () => {
                row.style.opacity = '';
                dragIndex = -1;
                // 清除所有拖拽指示器
                listEl.querySelectorAll('.card-row').forEach((r) => {
                    r.style.borderTopColor = '';
                    r.style.borderBottomColor = '';
                    r.style.borderLeftColor = '';
                    r.style.borderRightColor = '';
                });
            });

            row.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragIndex === index) return;
                const rect = row.getBoundingClientRect();
                const isAbove = e.clientY < rect.top + rect.height / 2;
                // 视觉指示：上/下边框高亮
                listEl.querySelectorAll('.card-row').forEach((r) => {
                    r.style.borderTopColor = '';
                    r.style.borderBottomColor = '';
                });
                if (isAbove) {
                    row.style.borderTopColor = 'var(--color-primary)';
                } else {
                    row.style.borderBottomColor = 'var(--color-primary)';
                }
            });

            row.addEventListener('dragleave', () => {
                row.style.borderTopColor = '';
                row.style.borderBottomColor = '';
            });

            row.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                row.style.borderTopColor = '';
                row.style.borderBottomColor = '';

                if (dragIndex === -1 || dragIndex === index) return;

                const rect = row.getBoundingClientRect();
                const isAbove = e.clientY < rect.top + rect.height / 2;

                // 计算插入位置：原索引删除后，目标位置可能偏移
                const moved = cards.splice(dragIndex, 1)[0];
                const insertIndex = isAbove
                    ? (dragIndex < index ? index - 1 : index)
                    : (dragIndex < index ? index : index + 1);

                cards.splice(insertIndex, 0, moved);

                // 更新 order
                cards.forEach((c, i) => { c.order = i + 1; });

                markDirty();
                renderList();
            });

            // 编辑
            row.querySelector('[data-role="edit"]').addEventListener('click', async () => {
                const newConfig = await openCardEditor(cardItem, 'edit');
                if (newConfig) {
                    cardItem.config = newConfig;
                    markDirty();
                    renderList();
                    toast('配置已更新，记得保存');
                }
            });

            // 启用/禁用
            row.querySelector('[data-role="toggle"]').addEventListener('click', () => {
                cardItem.enabled = cardItem.enabled === false ? true : false;
                markDirty();
                renderList();
            });

            // 删除
            row.querySelector('[data-role="delete"]').addEventListener('click', async () => {
                const ok = await confirmDialog({
                    title: '确认删除',
                    message: `确定要删除卡片「${tplName}（${cardId}）」吗？此操作不可撤销。`,
                    danger: true,
                    confirmText: '删除'
                });
                if (!ok) return;
                cards.splice(index, 1);
                cards.forEach((c, i) => { c.order = i + 1; });
                markDirty();
                renderList();
                toast('已删除');
            });

            listEl.appendChild(row);
        });
    }

    /* ---------- 添加卡片 ---------- */

    container.querySelector('[data-role="add-card"]').addEventListener('click', async () => {
        const type = await openTemplatePicker();
        if (!type) return;

        const template = CARD_TEMPLATES[type];
        // 构造默认卡片
        const newCard = {
            id: type + '-' + Date.now(),
            type,
            order: cards.length + 1,
            enabled: true,
            config: { ...template.defaultConfig, id: type + '-card-' + (cards.length + 1) }
        };

        const newConfig = await openCardEditor(newCard, 'add');
        if (!newConfig) return;

        newCard.config = newConfig;
        // 如果用户填了 id，同步到外层 id
        if (newConfig.id) {
            newCard.id = newConfig.id;
        }
        cards.push(newCard);
        cards.forEach((c, i) => { c.order = i + 1; });
        markDirty();
        renderList();
        toast('已添加新卡片，记得保存');
    });

    /* ---------- 保存全部 ---------- */

    const saveBtn = container.querySelector('[data-role="save-all"]');
    saveBtn.addEventListener('click', async () => {
        if (!cards.length) {
            const ok = await confirmDialog({
                title: '确认保存',
                message: '当前卡片列表为空，保存后首页将不展示任何卡片。确定继续吗？',
                danger: true,
                confirmText: '保存'
            });
            if (!ok) return;
        } else {
            const ok = await confirmDialog({
                title: '确认保存',
                message: `共 ${cards.length} 张卡片，将一次性保存所有增删改与排序变更。确定保存吗？`
            });
            if (!ok) return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = '保存中…';
        try {
            // 最终数组：确保 order 正确
            const finalCards = cards.map((c, i) => ({ ...c, order: i + 1 }));
            await saveConfigModules({ cards: finalCards });
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

    /* ---------- 加载数据 ---------- */

    async function load() {
        showLoading(container);
        try {
            const config = await loadSiteConfig();
            const rawCards = config.cards;

            if (Array.isArray(rawCards) && rawCards.length > 0) {
                // 按 order 排序后赋值
                cards = rawCards
                    .slice()
                    .sort((a, b) => (a.order || 0) - (b.order || 0))
                    .map((c, i) => ({ ...c, order: i + 1 }));
            } else {
                // 使用默认配置
                cards = DEFAULT_CARDS.map((c) => ({ ...c, config: { ...c.config } }));
            }

            renderList();
        } catch (err) {
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
