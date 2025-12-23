// 下载列表数据 - 基于linksync重写

// 配置常量
const CONFIG = {
  COS_CONFIG_URL: 'https://chikuu-1252656027.cos.ap-nanjing.myqcloud.com/config.js',
  COS_PREFIX: 'uploads/',
  CACHE_EXPIRY: 5 * 60 * 1000 // 缓存有效期(5分钟)
};

// 生成唯一ID
function generateUniqueId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return '0B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + sizes[i];
}

// 获取文件类型
function getFileType(fileName) {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (!extension) return 'application/octet-stream';
  
  // 参考linksync的简洁分类方式，结合原有downloadData.js的全面性
  const typeMap = {
    // 图片
    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif',
    'webp': 'image/webp', 'bmp': 'image/bmp', 'svg': 'image/svg+xml',
    // 文档
    'pdf': 'application/pdf', 'doc': 'application/msword', 'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'txt': 'text/plain', 'md': 'text/plain', 'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'xls': 'application/vnd.ms-excel', 'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    // 视频
    'mp4': 'video/mp4', 'avi': 'video/x-msvideo', 'mov': 'video/quicktime',
    'wmv': 'video/x-ms-wmv', 'flv': 'video/x-flv', 'webm': 'video/webm',
    // 音频
    'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg', 'flac': 'audio/flac',
    'm4a': 'audio/mp4', 'wma': 'audio/x-ms-wma',
    // 压缩文件
    'zip': 'application/zip', 'rar': 'application/x-rar-compressed', '7z': 'application/x-7z-compressed'
  };
  
  return typeMap[extension] || 'application/octet-stream';
}

// 加载COS配置
async function loadCOSConfig() {
  return new Promise((resolve, reject) => {
    try {
      // 检查配置是否已加载
      if (window.COS_CONFIG && window.COS_CONFIG.Bucket && window.COS_CONFIG.Region) {
        resolve(window.COS_CONFIG);
        return;
      }
      
      // 动态加载配置文件
      const script = document.createElement('script');
      script.src = CONFIG.COS_CONFIG_URL;
      
      script.onload = () => {
        if (window.COS_CONFIG && window.COS_CONFIG.Bucket && window.COS_CONFIG.Region) {
          resolve(window.COS_CONFIG);
        } else {
          reject(new Error('COS配置加载失败或配置不完整'));
        }
      };
      
      script.onerror = () => {
        reject(new Error('COS配置文件加载失败'));
      };
      
      document.head.appendChild(script);
    } catch (error) {
      reject(new Error(`加载COS配置时出错: ${error.message}`));
    }
  });
}

// 从COS获取下载文件列表
async function fetchDownloadDataFromCOS() {
  try {
    // 确保COS SDK已加载（基于linksync的实现方式）
    if (!window.COS) {
      // 动态加载COS SDK
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/cos-js-sdk-v5@1.4.5/dist/cos-js-sdk-v5.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('COS SDK加载失败'));
        document.head.appendChild(script);
      });
    }
    
    // 加载配置
    const COS_CONFIG = await loadCOSConfig();
    
    // 初始化COS实例（参考linksync的简洁方式）
    const cos = new window.COS({
      SecretId: COS_CONFIG.SecretId,
      SecretKey: COS_CONFIG.SecretKey,
      SessionToken: COS_CONFIG.SessionToken,
    });
    
    // 获取文件列表（参考linksync的实现方式）
    return new Promise((resolve, reject) => {
      cos.getBucket({
        Bucket: COS_CONFIG.Bucket,
        Region: COS_CONFIG.Region,
        Prefix: CONFIG.COS_PREFIX,
        Delimiter: '/',
      }, function(err, data) {
        if (err) {
          const errorMsg = err.message || '未知错误';
          console.error(`获取文件列表失败: ${errorMsg}`, err);
          reject(new Error(`获取文件列表失败: ${errorMsg}`));
          return;
        }
        
        // 验证返回数据结构
        if (!data || typeof data !== 'object' || !data.Contents || !Array.isArray(data.Contents)) {
          resolve({ portfolio: [], tools: [] });
          return;
        }
        
        // 解析返回的数据，按文件夹分类
        const portfolio = [];
        const tools = [];
        
        // 处理每个文件（参考linksync的简洁处理方式）
        data.Contents.forEach(function(item) {
          try {
            if (!item || typeof item !== 'object' || !item.Key || item.Key.endsWith('/')) {
              return;
            }
            
            const key = item.Key;
            const fileName = key.split('/').pop();
            if (!fileName) return;
            
            // 构建文件对象
            const fileObj = {
              id: generateUniqueId(),
              name: fileName,
              size: formatFileSize(item.Size || 0),
              updateTime: item.LastModified ? new Date(item.LastModified).toLocaleString() : '',
              url: `https://${COS_CONFIG.Bucket}.cos.${COS_CONFIG.Region}.myqcloud.com/${encodeURIComponent(key)}`,
              type: getFileType(fileName),
              cosKey: key
            };
            
            // 分类处理
            const pathParts = key.split('/').filter(part => part);
            if (pathParts.length >= 2 && pathParts[0] === 'uploads') {
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
            console.error(`处理文件项时出错:`, itemError);
            // 跳过错误项，继续处理其他文件
          }
        });
        
        // 按修改时间降序排序
        portfolio.sort((a, b) => new Date(b.updateTime) - new Date(a.updateTime));
        tools.sort((a, b) => new Date(b.updateTime) - new Date(a.updateTime));
        
        resolve({ portfolio, tools });
      });
    });
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
      size: "150MB",
      updateTime: "2025-12-20",
      url: "#",
      type: "application/zip"
    },
    {
      id: generateUniqueId(),
      name: "ChiliChill翻唱集.zip",
      size: "85MB",
      updateTime: "2025-11-15",
      url: "#",
      type: "application/zip"
    },
    {
      id: generateUniqueId(),
      name: "星瞳相关作品.zip",
      size: "60MB",
      updateTime: "2025-10-05",
      url: "#",
      type: "application/zip"
    }
  ],
  tools: [
    {
      id: generateUniqueId(),
      name: "音频处理工具包.zip",
      size: "45MB",
      updateTime: "2025-12-10",
      url: "#",
      type: "application/zip"
    },
    {
      id: generateUniqueId(),
      name: "歌词同步工具.exe",
      size: "12MB",
      updateTime: "2025-11-20",
      url: "#",
      type: "application/x-msdownload"
    },
    {
      id: generateUniqueId(),
      name: "视频剪辑预设.zip",
      size: "28MB",
      updateTime: "2025-10-15",
      url: "#",
      type: "application/zip"
    }
  ]
};

// 异步获取下载数据，支持缓存和强制刷新
export const getDownloadData = async (forceRefresh = false) => {
  const now = Date.now();
  
  // 检查缓存是否有效
  if (cachedDownloadData && !forceRefresh && (now - lastFetchTime) < CONFIG.CACHE_EXPIRY) {
    return cachedDownloadData;
  }
  
  try {
    const data = await fetchDownloadDataFromCOS();
    
    // 更新缓存
    cachedDownloadData = data;
    lastFetchTime = now;
    
    return data;
  } catch (error) {
    console.error('获取下载数据失败:', error);
    
    // 如果有缓存，优先使用缓存
    if (cachedDownloadData) {
      console.log('使用缓存的下载数据');
      return cachedDownloadData;
    }
    
    // 否则返回默认数据
    console.log('使用默认下载数据');
    return DEFAULT_DOWNLOAD_DATA;
  }
};

// 保持原有的同步导出作为备用（为了向后兼容）
export const downloadData = DEFAULT_DOWNLOAD_DATA;