/**
 * POST /api/admin/cos/presign
 * 管理端接口（需登录会话）：为图片上传生成 COS PUT 预签名链接
 * 请求体：{ filename, contentType? }
 */
import { json, error, runHandler } from '../../../lib/response.js';
import { requireAuth } from '../../../lib/session.js';
import { randomHex } from '../../../lib/crypto.js';
import { getCosConfig, presignUrl, publicUrl } from '../../../lib/cos.js';

/** 允许上传的图片扩展名白名单 */
const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico'];

export async function onRequestPost(context) {
  return runHandler(async () => {
    // 登录校验（POST 同时要求 x-requested-with: fetch 请求头）
    const auth = await requireAuth(context);
    if (!auth.ok) return auth.response;

    const config = getCosConfig(context.env);
    if (!config) {
      return error(500, 'COS_NOT_CONFIGURED', '未配置 COS_SECRET_ID / COS_SECRET_KEY 环境变量');
    }

    // 解析请求体
    let body = {};
    try {
      body = await context.request.json();
    } catch {
      return error(400, 'INVALID_BODY', '请求体必须是合法的 JSON');
    }
    const filename = typeof body?.filename === 'string' ? body.filename.trim() : '';
    if (!filename) {
      return error(400, 'INVALID_FILENAME', '缺少 filename 参数');
    }

    // 扩展名白名单校验
    const ext = filename.includes('.') ? filename.split('.').pop().toLowerCase() : '';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return error(400, 'INVALID_TYPE', '仅支持图片格式：png/jpg/jpeg/gif/webp/svg/ico');
    }

    // 对象键由服务端生成（不含用户输入，避免路径注入）：cms/yyyymmdd_随机hex.扩展名
    const now = new Date();
    const yyyymmdd =
      String(now.getFullYear()) +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');
    const objectKey = `cms/${yyyymmdd}_${randomHex(8)}.${ext}`;

    const uploadUrl = await presignUrl({ method: 'PUT', key: objectKey, expiresSeconds: 600, config });
    return json({
      uploadUrl,
      objectKey,
      publicUrl: publicUrl(objectKey, config),
      expiresIn: 600
    });
  });
}