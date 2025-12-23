// 下载列表数据 - 基于腾讯云COS API重写

// 直接导入安装好的COS SDK
import COS from 'cos-js-sdk-v5';

// 配置常量
const CONFIG = {
  // 腾讯云 COS 配置
  Bucket: 'chikuu-1252656027', // 存储桶名称
  Region: 'ap-nanjing',               // 存储桶所在地域
  SecretId: 'AKIDTIyQehaGj05za6Tpytb6PVO4byBByay8', // 临时密钥 SecretId
  SecretKey: '1rUu64rQnxtU4ScbN1Sr8EAD3iAPXS9c',    // 临时密钥 SecretKey
  SessionToken: '',                   // 临时密钥 SessionToken，非必须
  COS_PREFIX: 'uploads/',
  CACHE_EXPIRY: 5 * 60 * 1000, // 缓存有效期(5分钟)
  MAX_RETRIES: 3, // 最大重试次数
  RETRY_DELAY: 1000 // 重试延迟(毫秒)
};

// 生成唯一ID
function generateUniqueId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return '0B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)}${sizes[i]}`;
}

// 获取文件类型
function getFileType(fileName) {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (!extension) return 'application/octet-stream';
  
  // 基于文件扩展名映射MIME类型
  const typeMap = {
    // 图片
    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif',
    'webp': 'image/webp', 'bmp': 'image/bmp', 'svg': 'image/svg+xml', 'tif': 'image/tiff',
    // 文档
    'pdf': 'application/pdf', 'doc': 'application/msword', 'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'txt': 'text/plain', 'md': 'text/plain', 'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'xls': 'application/vnd.ms-excel', 'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'csv': 'text/csv', 'rtf': 'application/rtf',
    // 视频
    'mp4': 'video/mp4', 'avi': 'video/x-msvideo', 'mov': 'video/quicktime',
    'wmv': 'video/x-ms-wmv', 'flv': 'video/x-flv', 'webm': 'video/webm', 'mkv': 'video/x-matroska',
    // 音频
    'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg', 'flac': 'audio/flac',
    'm4a': 'audio/mp4', 'wma': 'audio/x-ms-wma', 'aac': 'audio/aac',
    // 压缩文件
    'zip': 'application/zip', 'rar': 'application/x-rar-compressed', '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar', 'gz': 'application/gzip',
    // 代码文件
    'js': 'application/javascript', 'css': 'text/css', 'html': 'text/html',
    'json': 'application/json', 'xml': 'text/xml', 'py': 'text/x-python',
    'java': 'application/java', 'c': 'text/x-c', 'cpp': 'text/x-c++', 'h': 'text/x-c-header',
    'php': 'application/x-httpd-php', 'go': 'text/x-go',
    // 可执行文件
    'exe': 'application/x-msdownload', 'dmg': 'application/x-apple-diskimage',
    'pkg': 'application/x-newton-compatible-pkg', 'msi': 'application/x-msi'
  };
  
  return typeMap[extension] || 'application/octet-stream';
}

// 默认COS配置（作为备选方案）
const DEFAULT_COS_CONFIG = {
  Bucket: 'chikuu-1252656027',
  Region: 'ap-nanjing',
  SecretId: 'AKIDTIyQehaGj05za6Tpytb6PVO4byBByay8',
  SecretKey: '1rUu64rQnxtU4ScbN1Sr8EAD3iAPXS9c',
  SessionToken: ''
};

// 加载COS配置 - 支持重试和默认配置
async function loadCOSConfig() {
  // 检查配置是否已加载
  if (window.COS_CONFIG && window.COS_CONFIG.Bucket && window.COS_CONFIG.Region) {
    console.log('使用已加载的COS配置');
    return window.COS_CONFIG;
  }
  
  let retryCount = 0;
  const maxRetries = 2;
  
  while (retryCount <= maxRetries) {
    try {
      console.log(`尝试加载COS配置，重试 ${retryCount}/${maxRetries}: ${CONFIG.COS_CONFIG_URL}`);
      
      // 使用fetch代替script标签加载配置，这样可以更好地控制超时和错误处理
      const response = await fetch(CONFIG.COS_CONFIG_URL, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/javascript'
        },
        credentials: 'omit',
        timeout: 5000 // 5秒超时
      });
      
      if (!response.ok) {
        throw new Error(`HTTP错误! 状态: ${response.status}`);
      }
      
      // 解析配置内容
      const configText = await response.text();
      
      // 执行配置代码
      eval(configText);
      
      // 验证配置
      if (window.COS_CONFIG && window.COS_CONFIG.Bucket && window.COS_CONFIG.Region) {
        console.log('成功加载COS配置');
        return window.COS_CONFIG;
      } else {
        throw new Error('COS配置加载失败或配置不完整');
      }
    } catch (error) {
      retryCount++;
      console.warn(`COS配置加载失败，${retryCount}次重试:`, error.message);
      
      if (retryCount > maxRetries) {
        // 所有重试都失败，返回默认配置
        console.log('所有重试都失败，使用默认COS配置');
        return DEFAULT_COS_CONFIG;
      }
      
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
    }
  }
  
  // 理论上不会到达这里，但为了安全返回默认配置
  return DEFAULT_COS_CONFIG;
}

// COS SDK已通过npm安装并直接导入，不再需要动态加载函数

// 重试函数
async function retryWithDelay(fn, retries = CONFIG.MAX_RETRIES, delay = CONFIG.RETRY_DELAY) {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }
    await new Promise(resolve => setTimeout(resolve, delay));
    return retryWithDelay(fn, retries - 1, delay * 2); // 指数退避
  }
}

// 从COS获取下载文件列表
async function fetchDownloadDataFromCOS() {
  try {
    // 加载配置
    const cosConfig = await loadCOSConfig();
    
    // 初始化COS实例
    const cos = new COS({
      SecretId: cosConfig.SecretId,
      SecretKey: cosConfig.SecretKey,
      SessionToken: cosConfig.SessionToken, // 临时密钥时需要
      Protocol: 'https:',
      Timeout: 30000 // 请求超时时间(毫秒)
    });
    
    // 获取文件列表 - 使用最新的Promise API
    const data = await retryWithDelay(() => cos.getBucket({
      Bucket: cosConfig.Bucket,
      Region: cosConfig.Region,
      Prefix: CONFIG.COS_PREFIX,
      Delimiter: '/',
      EncodingType: 'url'
    }));
    
    // 验证返回数据结构
    if (!data || !Array.isArray(data.Contents)) {
      return { portfolio: [], tools: [] };
    }
    
    // 解析返回的数据，按文件夹分类
    const portfolio = [];
    const tools = [];
    
    // 处理每个文件
    data.Contents.forEach(item => {
      try {
        if (!item.Key || item.Key.endsWith('/')) {
          return; // 跳过目录
        }
        
        const key = decodeURIComponent(item.Key);
        const fileName = key.split('/').pop();
        if (!fileName) return;
        
        // 构建文件对象
        const fileObj = {
          id: generateUniqueId(),
          name: fileName,
          size: formatFileSize(item.Size || 0),
          updateTime: item.LastModified ? new Date(item.LastModified).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          }) : '',
          url: `https://${cosConfig.Bucket}.cos.${cosConfig.Region}.myqcloud.com/${encodeURIComponent(key)}`,
          type: getFileType(fileName),
          cosKey: key,
          etag: item.ETag?.replace(/"/g, ''), // 移除引号
          storageClass: item.StorageClass || 'STANDARD'
        };
        
        // 按目录结构分类
        const pathParts = key.split('/').filter(Boolean);
        if (pathParts.length >= 2 && pathParts[0] === CONFIG.COS_PREFIX.replace(/\/$/, '')) {
          const category = pathParts[1];
          if (category === 'tools') {
            tools.push(fileObj);
          } else {
            portfolio.push(fileObj);
          }
        } else {
          // 直接存放在uploads/目录下的文件
          portfolio.push(fileObj);
        }
      } catch (itemError) {
        console.error(`处理文件项时出错: ${itemError.message}`, item);
        // 跳过错误项，继续处理其他文件
      }
    });
    
    // 按修改时间降序排序
    portfolio.sort((a, b) => new Date(b.updateTime) - new Date(a.updateTime));
    tools.sort((a, b) => new Date(b.updateTime) - new Date(a.updateTime));
    
    return { portfolio, tools };
  } catch (error) {
    console.error('加载COS数据失败:', error);
    throw error;
  }
}

// 缓存相关变量
let cachedDownloadData = null;
let lastFetchTime = 0;

// 默认下载数据
const DEFAULT_DOWNLOAD_DATA = {
  portfolio: [
    {
      id: generateUniqueId(),
      name: "2025年度作品集.zip",
      size: "150.00MB",
      updateTime: "2025-12-20 00:00:00",
      url: "#",
      type: "application/zip",
      cosKey: "uploads/2025年度作品集.zip",
      storageClass: "STANDARD"
    },
    {
      id: generateUniqueId(),
      name: "ChiliChill翻唱集.zip",
      size: "85.00MB",
      updateTime: "2025-11-15 00:00:00",
      url: "#",
      type: "application/zip",
      cosKey: "uploads/ChiliChill翻唱集.zip",
      storageClass: "STANDARD"
    },
    {
      id: generateUniqueId(),
      name: "星瞳相关作品.zip",
      size: "60.00MB",
      updateTime: "2025-10-05 00:00:00",
      url: "#",
      type: "application/zip",
      cosKey: "uploads/星瞳相关作品.zip",
      storageClass: "STANDARD"
    }
  ],
  tools: [
    {
      id: generateUniqueId(),
      name: "音频处理工具包.zip",
      size: "45.00MB",
      updateTime: "2025-12-10 00:00:00",
      url: "#",
      type: "application/zip",
      cosKey: "uploads/tools/音频处理工具包.zip",
      storageClass: "STANDARD"
    },
    {
      id: generateUniqueId(),
      name: "歌词同步工具.exe",
      size: "12.00MB",
      updateTime: "2025-11-20 00:00:00",
      url: "#",
      type: "application/x-msdownload",
      cosKey: "uploads/tools/歌词同步工具.exe",
      storageClass: "STANDARD"
    },
    {
      id: generateUniqueId(),
      name: "视频剪辑预设.zip",
      size: "28.00MB",
      updateTime: "2025-10-15 00:00:00",
      url: "#",
      type: "application/zip",
      cosKey: "uploads/tools/视频剪辑预设.zip",
      storageClass: "STANDARD"
    }
  ]
};

// 异步获取下载数据，支持缓存和强制刷新
export const getDownloadData = async (forceRefresh = false) => {
  const now = Date.now();
  
  // 检查缓存是否有效
  if (cachedDownloadData && !forceRefresh && (now - lastFetchTime) < CONFIG.CACHE_EXPIRY) {
    console.log('使用缓存的下载数据');
    return cachedDownloadData;
  }
  
  try {
    console.log('开始从COS获取下载数据');
    const data = await fetchDownloadDataFromCOS();
    
    // 验证数据完整性
    if (!data || (!data.portfolio && !data.tools)) {
      throw new Error('获取的数据格式不正确');
    }
    
    // 更新缓存
    cachedDownloadData = data;
    lastFetchTime = now;
    
    console.log('成功获取下载数据并更新缓存');
    return data;
  } catch (error) {
    console.error('获取下载数据失败:', error);
    
    // 如果有缓存，优先使用缓存
    if (cachedDownloadData) {
      console.log('获取失败，使用缓存的下载数据');
      return cachedDownloadData;
    }
    
    // 否则返回默认数据
    console.log('获取失败，使用默认下载数据');
    return DEFAULT_DOWNLOAD_DATA;
  }
};

// 保持原有的同步导出作为备用（为了向后兼容）
export const downloadData = DEFAULT_DOWNLOAD_DATA;

// 清除缓存的方法（新增）
export const clearDownloadDataCache = () => {
  cachedDownloadData = null;
  lastFetchTime = 0;
  console.log('下载数据缓存已清除');
};

// 强制刷新数据的方法（新增）
export const refreshDownloadData = () => {
  return getDownloadData(true);
};