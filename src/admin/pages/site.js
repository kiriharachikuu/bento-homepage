/**
 * 网站信息页（#/site）
 *
 * 编辑 site 模块：
 * - title       网站标题（浏览器标签页与页头）
 * - description Meta 描述（SEO）
 * - favicon     浏览器标签页图标（图片字段，支持 COS 上传）
 * - titleIcon   页头 logo 图标（图片字段，支持 COS 上传）
 *
 * 保存时整体提交 modules: { site }。
 */
import { toast, confirmDialog, createUnsavedGuard, registerGuard, clearGuard, showLoading, hideLoading } from '../ui.js';
import { escapeHtml, loadSiteConfig, saveConfigModules, createImageField, watchFormChanges } from './_shared.js';

/** 渲染网站信息页 @param {HTMLElement} container */
export function render(container) {
    // 未保存守卫：表单变化置脏，保存成功后复位
    const guard = createUnsavedGuard();
    registerGuard(guard);

    container.innerHTML = `
        <div class="page-header">
            <h2>网站信息</h2>
            <span class="page-tip">站点标题、Meta 描述与图标设置，保存后前台即时生效</span>
        </div>
        <div class="card" data-role="card">
            <div class="card-title">基础信息</div>
            <div class="form-group">
                <label class="form-label">网站标题</label>
                <input type="text" class="form-input" data-field="title"
                       placeholder="浏览器标签页与站点页头展示的标题" />
            </div>
            <div class="form-group">
                <label class="form-label">Meta 描述</label>
                <textarea class="form-textarea" data-field="description"
                          placeholder="SEO 站点描述（meta description）"></textarea>
            </div>
            <div data-field-group="favicon"></div>
            <div data-field-group="titleIcon"></div>
            <div class="form-footer">
                <button type="button" class="btn btn-primary" data-role="save">保存</button>
                <span class="form-hint">保存将提交 site 模块，并自动生成版本快照</span>
            </div>
        </div>`;

    const card = container.querySelector('[data-role="card"]');
    const titleInput = container.querySelector('[data-field="title"]');
    const descInput = container.querySelector('[data-field="description"]');
    const saveBtn = container.querySelector('[data-role="save"]');

    /** 表单变化 -> 标记脏状态 */
    function markDirty() {
        guard.setDirty(true);
    }
    watchFormChanges(container, markDirty);

    // 图片字段：favicon 与页头 logo（titleIcon）
    const faviconField = createImageField({
        label: 'favicon 图标',
        placeholder: '浏览器标签页图标 URL，或点击上传',
        onChange: markDirty
    });
    const titleIconField = createImageField({
        label: '头部 logo 图标',
        placeholder: '站点页头 logo 图标 URL，或点击上传',
        onChange: markDirty
    });
    container.querySelector('[data-field-group="favicon"]').appendChild(faviconField.el);
    container.querySelector('[data-field-group="titleIcon"]').appendChild(titleIconField.el);

    /** 收集表单为 site 模块对象 */
    function collectSite() {
        return {
            title: titleInput.value.trim(),
            description: descInput.value.trim(),
            favicon: faviconField.getValue(),
            titleIcon: titleIconField.getValue()
        };
    }

    // 保存：二次确认后提交 site 模块
    saveBtn.addEventListener('click', async () => {
        const ok = await confirmDialog({
            title: '确认保存',
            message: '即将保存模块：site（网站标题、Meta 描述、favicon 图标与头部 logo 图标）。确定保存吗？'
        });
        if (!ok) return;

        saveBtn.disabled = true;
        saveBtn.textContent = '保存中…';
        try {
            await saveConfigModules({ site: collectSite() });
            toast('保存成功');
            guard.setDirty(false);
            clearGuard();
        } catch (err) {
            toast(err.message || '保存失败', 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = '保存';
        }
    });

    /** 加载当前配置并回填表单（程序化赋值不触发脏状态） */
    async function load() {
        showLoading(card);
        try {
            const config = await loadSiteConfig();
            const site = (config && config.site) || {};
            titleInput.value = site.title || '';
            descInput.value = site.description || '';
            faviconField.setValue(site.favicon || '');
            titleIconField.setValue(site.titleIcon || '');
        } catch (err) {
            // 加载失败：以错误占位替换表单，避免在空表单上误存覆盖配置
            card.innerHTML = `
                <div class="empty">
                    <div class="empty-icon">⚠️</div>
                    <div class="empty-text">配置加载失败：${escapeHtml(err.message || '未知错误')}</div>
                </div>`;
            toast(err.message || '配置加载失败', 'error');
        } finally {
            hideLoading(card);
        }
    }

    load();
}