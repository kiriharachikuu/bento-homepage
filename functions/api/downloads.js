/**
 * GET /api/downloads
 * 公开接口：列出 COS 桶 uploads/ 目录下的文件（服务端签名请求，密钥不暴露给前端）
 */
import { json, error, runHandler } from '../lib/response.js';
import { getCosConfig, listUploadFiles } from '../lib/cos.js';

export async function onRequestGet(context) {
  return runHandler(async () => {
    const config = getCosConfig(context.env);
    if (!config) {
      return error(500, 'COS_NOT_CONFIGURED', '未配置 COS 环境变量，请先在 EdgeOne Pages 设置 COS_SECRET_ID / COS_SECRET_KEY');
    }
    const files = await listUploadFiles(config);
    return json({ files }, { headers: { 'cache-control': 'public, max-age=60' } });
  });
}