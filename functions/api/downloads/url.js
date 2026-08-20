/**
 * GET /api/downloads/url?key=xxx
 * 公开接口：为 uploads/ 目录下的文件生成 10 分钟有效的预签名下载链接
 */
import { json, error, runHandler } from '../../lib/response.js';
import { getCosConfig, presignUrl } from '../../lib/cos.js';

export async function onRequestGet(context) {
  return runHandler(async () => {
    const key = new URL(context.request.url).searchParams.get('key');
    if (!key) {
      return error(400, 'MISSING_KEY', '缺少 key 参数');
    }
    // 安全校验：只允许下载 uploads/ 目录下的文件，禁止路径穿越
    if (!key.startsWith('uploads/') || key.includes('..') || key.includes('\\')) {
      return error(403, 'FORBIDDEN', '仅允许下载 uploads/ 目录的文件');
    }
    const config = getCosConfig(context.env);
    if (!config) {
      return error(500, 'COS_NOT_CONFIGURED', '未配置 COS 环境变量，请先在 EdgeOne Pages 设置 COS_SECRET_ID / COS_SECRET_KEY');
    }
    const url = await presignUrl({ method: 'GET', key, expiresSeconds: 600, config });
    return json({ url, expiresIn: 600 });
  });
}