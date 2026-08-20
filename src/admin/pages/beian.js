/**
 * 备案信息页（#/beian）
 *
 * 编辑 beian 模块（前台页脚备案展示）：
 * - enabled      是否启用备案展示（关闭则页脚整块不显示）
 * - icpNumber    ICP 备案号
 * - icpLink      ICP 备案链接（留空时前台用默认值 https://beian.miit.gov.cn）
 * - policeNumber 公安备案号（可选）
 * - policeLink   公安备案链接（可选）
 * - customText   自定义页脚文字（可选）
 *
 * 保存时整体提交 modules: { beian }。
 */
import { toast, confirmDialog, createUnsavedGuard, registerGuard, clearGuard, showLoading, hideLoading } from '../ui.js';
import { escapeHtml, loadSiteConfig, saveConfigModules, watchFormChanges } from './_shared.js';

/** 渲染备案信息页 @param {HTMLElement} container */
export function render(container) {
    // 未保存守卫：表单变化置脏，保存成功后复位
    const guard = createUnsavedGuard();
    registerGuard(guard);

    container.innerHTML = `
        <div class="page-header">
            <h2>备案信息</h2>
            <span class="page-tip">页脚 ICP / 公安备案展示设置，保存后前台即时生效</span>
        </div>
        <div class="card" data-role="card">
            <div class="card-title">备案展示</div>
            <div class="form-group">
                <label class="form-label">启用备案展示</label>
                <label class="toggle">
                    <input type="checkbox" data-field="enabled" />
                    <span class="toggle-track"></span>
                </label>
                <div class="form-hint">关闭后前台页脚整块备案信息（含自定义文字）都不显示</div>
            </div>
            <div class="form-group">
                <label class="form-label">ICP 备案号</label>
                <input type="text" class="form-input" data-field="icpNumber" placeholder="如：苏ICP备2026XXXXXX号" />
            </div>
            <div class="form-group">
                <label class="form-label">ICP 备案链接</label>
                <input type="text" class="form-input" data-field="icpLink" placeholder="https://beian.miit.gov.cn" />
                <div class="form-hint">留空时前台默认链接到 https://beian.miit.gov.cn</div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">公安备案号（可选）</label>
                    <input type="text" class="form-input" data-field="policeNumber" placeholder="如：苏公网安备32000002000000号" />
                </div>
                <div class="form-group">
                    <label class="form-label">公安备案链接（可选）</label>
                    <input type="text" class="form-input" data-field="policeLink" placeholder="http://www.beian.gov.cn" />
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">自定义页脚文字（可选）</label>
                <textarea class="form-textarea" data-field="customText"
                          placeholder="追加展示在备案信息之后的自定义文案，留空则不显示"></textarea>
            </div>
            <div class="form-footer">
                <button type="button" class="btn btn-primary" data-role="save">保存</button>
                <span class="form-hint">保存将提交 beian 模块，并自动生成版本快照</span>
            </div>
        </div>
        <div class="card">
            <div class="card-title">前台页脚渲染规则</div>
            <div class="form-hint" style="font-size:13px;line-height:2;margin-top:0;">
                1. 「启用备案展示」关闭时，页脚整块备案信息（含自定义文字）不显示；<br />
                2. ICP 备案号以链接形式展示，默认指向工信部备案系统（https://beian.miit.gov.cn），填写「ICP 备案链接」后优先使用自定义链接；<br />
                3. 公安备案号留空时不展示该项，填写后默认链接到公安机关备案系统，填写「公安备案链接」后优先使用自定义链接；<br />
                4. 自定义页脚文字追加在备案信息之后原样展示，支持多行文本。
            </div>
        </div>`;

    const card = container.querySelector('[data-role="card"]');
    const saveBtn = container.querySelector('[data-role="save"]');

    // 字段引用（beian 模块六个字段）
    const fields = {};
    ['enabled', 'icpNumber', 'icpLink', 'policeNumber', 'policeLink', 'customText'].forEach((name) => {
        fields[name] = container.querySelector('[data-field="' + name + '"]');
    });

    /** 表单变化 -> 标记脏状态（文本输入即时触发，开关勾选在 change 时触发） */
    function markDirty() {
        guard.setDirty(true);
    }
    watchFormChanges(container, markDirty);

    /** 收集表单为 beian 模块对象 */
    function collectBeian() {
        return {
            enabled: fields.enabled.checked,
            icpNumber: fields.icpNumber.value.trim(),
            icpLink: fields.icpLink.value.trim(),
            policeNumber: fields.policeNumber.value.trim(),
            policeLink: fields.policeLink.value.trim(),
            customText: fields.customText.value.trim()
        };
    }

    // 保存：二次确认后提交 beian 模块
    saveBtn.addEventListener('click', async () => {
        const ok = await confirmDialog({
            title: '确认保存',
            message: '即将保存模块：beian（备案展示开关、ICP / 公安备案号与链接、自定义页脚文字）。确定保存吗？'
        });
        if (!ok) return;

        saveBtn.disabled = true;
        saveBtn.textContent = '保存中…';
        try {
            await saveConfigModules({ beian: collectBeian() });
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
            const beian = (config && config.beian) || {};
            fields.enabled.checked = Boolean(beian.enabled);
            fields.icpNumber.value = beian.icpNumber || '';
            fields.icpLink.value = beian.icpLink || '';
            fields.policeNumber.value = beian.policeNumber || '';
            fields.policeLink.value = beian.policeLink || '';
            fields.customText.value = beian.customText || '';
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