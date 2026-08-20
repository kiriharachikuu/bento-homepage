/**
 * 账号设置页（#/account）
 *
 * 职责：修改管理员密码（旧密码校验 + 新密码强度要求 + 两次输入一致性校验），
 * 并展示系统安全机制说明。
 *
 * 可用 API（经 src/admin/api.js 调用）：
 * - POST /api/admin/password   修改密码，body：{ oldPassword, newPassword }，成功 { ok: true }
 *   失败错误码：WRONG_PASSWORD（旧密码不正确）/ WEAK_PASSWORD（新密码至少 8 位）
 */
import { post } from '../api.js';
import { toast, confirmDialog } from '../ui.js';

/** 修改密码后端错误码 -> 提示文案 */
const PASSWORD_ERROR_MESSAGES = {
    WRONG_PASSWORD: '旧密码不正确',
    WEAK_PASSWORD: '新密码至少8位'
};

/** 渲染账号设置页 @param {HTMLElement} container */
export function render(container) {
    container.innerHTML = `
        <div class="page-header">
            <h2>账号设置</h2>
            <span class="page-tip">修改管理员密码。修改后请妥善保管，所有写操作都需要登录。</span>
        </div>

        <!-- 修改密码 -->
        <div class="card" style="max-width: 460px">
            <div class="card-title">修改密码</div>
            <form id="password-form" novalidate>
                <div class="form-group">
                    <label class="form-label" for="pw-old">旧密码</label>
                    <input class="form-input" id="pw-old" type="password" autocomplete="current-password" placeholder="请输入当前使用的密码" />
                </div>
                <div class="form-group">
                    <label class="form-label" for="pw-new">新密码</label>
                    <input class="form-input" id="pw-new" type="password" autocomplete="new-password" placeholder="请输入新密码" />
                    <div class="form-hint">长度至少 8 位，建议混合字母、数字与符号</div>
                </div>
                <div class="form-group">
                    <label class="form-label" for="pw-confirm">确认新密码</label>
                    <input class="form-input" id="pw-confirm" type="password" autocomplete="new-password" placeholder="请再次输入新密码" />
                </div>
                <div class="form-footer">
                    <button type="submit" class="btn btn-primary" id="pw-submit">修改密码</button>
                </div>
            </form>
        </div>

        <!-- 安全机制说明（灰底） -->
        <div class="card" style="max-width: 460px">
            <div class="card-title">安全机制说明</div>
            <div style="background: var(--color-bg); border-radius: 6px; padding: 14px 18px">
                <ul style="margin: 0; padding-left: 20px; color: var(--color-text-secondary); font-size: 13px; line-height: 2">
                    <li>密码使用 PBKDF2 哈希加盐存储，系统不保存明文密码</li>
                    <li>同一 IP 连续登录失败 5 次将锁定 15 分钟</li>
                    <li>登录会话有效期 7 天，过期后需重新登录</li>
                    <li>登录、配置保存、回滚、视频同步、修改密码等操作全程记录日志</li>
                </ul>
            </div>
        </div>`;

    const form = container.querySelector('#password-form');
    const oldInput = container.querySelector('#pw-old');
    const newInput = container.querySelector('#pw-new');
    const confirmInput = container.querySelector('#pw-confirm');
    const submitBtn = container.querySelector('#pw-submit');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const oldPassword = oldInput.value;
        const newPassword = newInput.value;
        const confirmPassword = confirmInput.value;

        // 前端校验：必填、长度、两次一致（不一致直接拦截，不发请求）
        if (!oldPassword) {
            toast('请输入旧密码', 'error');
            oldInput.focus();
            return;
        }
        if (newPassword.length < 8) {
            toast('新密码至少需要 8 位', 'error');
            newInput.focus();
            return;
        }
        if (newPassword !== confirmPassword) {
            toast('两次输入的新密码不一致', 'error');
            confirmInput.focus();
            return;
        }

        // 二次确认
        const ok = await confirmDialog({
            title: '修改密码',
            message: '确定修改密码吗？修改后请用新密码登录。',
            confirmText: '确认修改'
        });
        if (!ok) return;

        submitBtn.disabled = true;
        try {
            await post('/api/admin/password', { oldPassword, newPassword });
            toast('密码已修改', 'success');
            form.reset();
        } catch (err) {
            // WRONG_PASSWORD / WEAK_PASSWORD 等业务错误按码映射文案，其余透传 message
            toast(
                PASSWORD_ERROR_MESSAGES[err.code] || err.message || '修改失败，请稍后重试',
                'error'
            );
        } finally {
            submitBtn.disabled = false;
        }
    });
}