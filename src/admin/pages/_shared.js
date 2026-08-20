/**
 * 内容编辑页共用辅助（site / beian / content 三页使用）
 *
 * 提供：
 * - escapeHtml()          HTML 转义（拼接模板时防止破坏结构）
 * - loadSiteConfig()      加载当前站点配置（GET /api/config，公开接口）
 * - saveConfigModules()   保存配置模块（POST /api/admin/save-config）
 * - uploadImage(file)     图片上传：前端校验 -> presign 预签名 -> PUT 直传 COS
 * - createImageField()    图片字段组件：URL 输入 + 上传按钮 + 即时预览缩略图
 * - watchFormChanges()    监听容器内表单控件变化（用于标记未保存脏状态）
 *
 * 注意：本文件是三个页面私有的辅助模块，不要在页面以外的模块中引用。
 */
import { get, post } from '../api.js';
import { toast } from '../ui.js';

/* ------------------------------------------------------------
 * 常量
 * ------------------------------------------------------------ */

/** 允许上传的图片扩展名白名单（与后端 presign 接口校验保持一致） */
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico'];

/** 图片大小上限：5MB */
const IMAGE_MAX_SIZE = 5 * 1024 * 1024;

/* ------------------------------------------------------------
 * 基础工具
 * ------------------------------------------------------------ */

/** HTML 转义，防止文案插入时破坏结构 */
export function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/* ------------------------------------------------------------
 * 配置读写
 * ------------------------------------------------------------ */

/**
 * 加载当前站点配置（公开接口）
 * @returns {Promise<object>} 完整配置对象（site / user / socialLinks / beian 等）
 * @throws {ApiError} 网络异常或非 2xx 响应
 */
export async function loadSiteConfig() {
    const config = await get('/api/config');
    return config && typeof config === 'object' ? config : {};
}

/**
 * 保存配置模块（管理接口，自动生成版本快照与操作日志）
 * @param {object} modules 形如 { site: {...}, contactText: '字符串' }
 * @param {string} [note] 可选备注（缺省时后端按变更模块生成）
 * @returns {Promise<{ok: boolean, config: object}>}
 */
export function saveConfigModules(modules, note) {
    const body = { modules };
    if (note) body.note = note;
    return post('/api/admin/save-config', body);
}

/* ------------------------------------------------------------
 * 图片上传（图片字段与富文本编辑器共用）
 * ------------------------------------------------------------ */

/**
 * 上传图片到 COS：前端校验 -> presign 预签名 -> PUT 直传
 * @param {File} file 用户选择的图片文件
 * @returns {Promise<string>} 上传成功后的公网访问地址（publicUrl）
 * @throws {Error|ApiError} 校验不通过 / 预签名失败 / 直传失败
 */
export async function uploadImage(file) {
    // 扩展名白名单校验（文件名仅用于取扩展名，对象键由服务端生成）
    const filename = file && file.name ? file.name : '';
    const ext = filename.includes('.') ? filename.split('.').pop().toLowerCase() : '';
    if (!IMAGE_EXTENSIONS.includes(ext)) {
        throw new Error('不支持的图片格式' + (ext ? '（' + ext + '）' : '') + '，仅支持：' + IMAGE_EXTENSIONS.join(' / '));
    }
    // 大小校验
    if (file.size > IMAGE_MAX_SIZE) {
        throw new Error('图片大小不能超过 5MB');
    }

    // 1. 获取 COS 预签名直传地址（后端校验扩展名，非法格式返回 INVALID_TYPE）
    const presign = await post('/api/admin/cos/presign', { filename });
    if (!presign || !presign.uploadUrl || !presign.publicUrl) {
        throw new Error('预签名响应异常，请稍后重试');
    }

    // 2. PUT 直传 COS（不能携带任何自定义请求头，否则签名校验失败）
    let response;
    try {
        response = await fetch(presign.uploadUrl, { method: 'PUT', body: file });
    } catch (err) {
        throw new Error('图片直传网络异常，请检查网络后重试');
    }
    if (!response.ok) {
        throw new Error('图片直传失败（HTTP ' + response.status + '）');
    }
    return presign.publicUrl;
}

/* ------------------------------------------------------------
 * 图片字段组件
 * ------------------------------------------------------------ */

/**
 * 创建图片字段组件：文本输入（手填 URL）+ 上传按钮 + 即时预览缩略图
 *
 * 上传流程：前端校验扩展名与大小 -> presign -> PUT 直传（按钮禁用显示「上传中…」）
 * -> 成功后回填 publicUrl 并刷新预览、触发 onChange（标记脏状态）
 *
 * @param {object} options
 * @param {string} [options.label] 字段标签（留空则不渲染标签行）
 * @param {string} [options.value=''] 初始图片 URL
 * @param {string} [options.placeholder] 输入框占位文案
 * @param {string} [options.hint] 字段下方灰色说明文案
 * @param {() => void} [options.onChange] 值变化回调（手动输入 / 上传成功时触发）
 * @returns {{ el: HTMLElement, getValue(): string, setValue(url: string): void }}
 */
export function createImageField({
    label = '',
    value = '',
    placeholder = '输入图片 URL，或点击「上传图片」',
    hint = '支持 png / jpg / jpeg / gif / webp / svg / ico，大小不超过 5MB',
    onChange = null
} = {}) {
    const root = document.createElement('div');
    root.className = 'form-group';
    root.innerHTML = `
        ${label ? '<label class="form-label">' + escapeHtml(label) + '</label>' : ''}
        <div class="upload-group">
            <div class="img-preview" data-role="preview"></div>
            <div class="upload-btns" style="flex:1;min-width:240px;">
                <input type="text" class="form-input" data-role="url"
                       placeholder="${escapeHtml(placeholder)}" />
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <button type="button" class="btn btn-sm" data-role="upload">上传图片</button>
                    <input type="file" data-role="file" hidden
                           accept=".png,.jpg,.jpeg,.gif,.webp,.svg,.ico,image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/x-icon" />
                </div>
                ${hint ? '<div class="form-hint">' + escapeHtml(hint) + '</div>' : ''}
            </div>
        </div>`;

    const previewBox = root.querySelector('[data-role="preview"]');
    const urlInput = root.querySelector('[data-role="url"]');
    const uploadBtn = root.querySelector('[data-role="upload"]');
    const fileInput = root.querySelector('[data-role="file"]');

    /** 渲染预览缩略图：URL 为空显示占位文字，图片加载失败显示错误占位 */
    function renderPreview() {
        const url = urlInput.value.trim();
        previewBox.innerHTML = '';
        if (!url) {
            previewBox.textContent = '暂无图片';
            return;
        }
        const img = document.createElement('img');
        img.alt = '图片预览';
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
        img.addEventListener('error', () => {
            previewBox.innerHTML = '';
            previewBox.textContent = '加载失败';
        });
        img.src = url;
        previewBox.appendChild(img);
    }

    // 手动输入 URL：即时刷新预览并标记脏状态
    urlInput.addEventListener('input', () => {
        renderPreview();
        if (onChange) onChange();
    });

    // 点击上传按钮：触发隐藏的文件选择框
    uploadBtn.addEventListener('click', () => fileInput.click());

    // 选择文件：校验 -> 预签名 -> 直传 -> 回填 publicUrl
    fileInput.addEventListener('change', async () => {
        const file = fileInput.files && fileInput.files[0];
        // 清空 value，保证再次选择同一文件时仍能触发 change
        fileInput.value = '';
        if (!file) return;

        const originalText = uploadBtn.textContent;
        uploadBtn.disabled = true;
        uploadBtn.textContent = '上传中…';
        try {
            const publicUrl = await uploadImage(file);
            urlInput.value = publicUrl;
            renderPreview();
            if (onChange) onChange();
            toast('图片上传成功');
        } catch (err) {
            toast(err.message || '图片上传失败', 'error');
        } finally {
            uploadBtn.disabled = false;
            uploadBtn.textContent = originalText;
        }
    });

    // 初始值与预览
    urlInput.value = value || '';
    renderPreview();

    return {
        el: root,
        /** 取当前图片 URL（去除首尾空白） */
        getValue() {
            return urlInput.value.trim();
        },
        /** 程序化赋值（配置回填用，不触发脏状态），并刷新预览 */
        setValue(url) {
            urlInput.value = url || '';
            renderPreview();
        }
    };
}

/* ------------------------------------------------------------
 * 表单脏状态监听
 * ------------------------------------------------------------ */

/**
 * 监听容器内所有表单控件的 input / change 事件并回调（用于标记未保存脏状态）。
 * 文本类控件即时触发（input），开关 / 下拉在 change 时触发；
 * 不监听 type="file"（上传成功后由字段组件自身回调标记）。
 * @param {HTMLElement} container 页面容器
 * @param {() => void} onChange 变化回调
 */
export function watchFormChanges(container, onChange) {
    const selector = 'input:not([type="file"]), textarea, select';
    const handler = (event) => {
        if (event.target.matches(selector)) onChange();
    };
    container.addEventListener('input', handler);
    container.addEventListener('change', handler);
}