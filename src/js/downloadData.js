// 下载列表数据
// 配置常量
const CONFIG = {
  COS_SDK_URL: 'https://cdn.jsdelivr.net/npm/cos-js-sdk-v5@1.4.5/dist/cos-js-sdk-v5.min.js',
  COS_CONFIG_URL: 'https://chikuu-1252656027.cos.ap-nanjing.myqcloud.com/config.js',
  COS_BUCKET: 'chikuu-1252656027',
  COS_REGION: 'ap-nanjing',
  COS_PREFIX: 'uploads/',
  LOAD_TIMEOUT: 5000, // 加载超时时间(ms)
  CACHE_EXPIRY: 5 * 60 * 1000 // 缓存有效期(5分钟)
};

// 避免重复加载的Promise缓存
let cosSdkPromise = null;
let cosConfigPromise = null;

// 生成唯一ID
function generateUniqueId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// 获取文件类型
function getFileType(extension) {
  const typeMap = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'svg': 'image/svg+xml',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'txt': 'text/plain',
    'md': 'text/plain',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'mp4': 'video/mp4',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'wmv': 'video/x-ms-wmv',
    'flv': 'video/x-flv',
    'webm': 'video/webm',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'flac': 'audio/flac',
    'm4a': 'audio/mp4',
    'wma': 'audio/x-ms-wma',
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed'
  };
  return typeMap[extension.toLowerCase()] || 'application/octet-stream';
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return '0B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + sizes[i];
}

// 动态加载脚本，带超时处理
function loadScript(url, timeout = CONFIG.LOAD_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
    
    // 添加超时处理
    const timeoutId = setTimeout(() => {
      script.onload = null;
      script.onerror = null;
      reject(new Error(`Script load timeout: ${url}`));
    }, timeout);
    
    script.onload = () => {
      clearTimeout(timeoutId);
      resolve();
    };
    
    script.onerror = () => {
      clearTimeout(timeoutId);
      reject(new Error(`Failed to load script: ${url}`));
    };
    
    document.head.appendChild(script);
  });
}

// 加载COS SDK
async function ensureCOSSDK() {
  if (cosSdkPromise) {
    return cosSdkPromise;
  }
  
  cosSdkPromise = new Promise(async (resolve, reject) => {
    try {
      // 检查COS SDK是否已加载
      if (window.COS && typeof window.COS === 'function') {
        resolve(window.COS);
        return;
      }
      
      // 动态加载COS SDK
      await loadScript(CONFIG.COS_SDK_URL);
      
      // 验证加载结果
      if (!window.COS || typeof window.COS !== 'function') {
        throw new Error('COS SDK loaded but not available');
      }
      
      resolve(window.COS);
    } catch (error) {
      reject(new Error(`Failed to load COS SDK: ${error.message}`));
    }
  });
  
  return cosSdkPromise;
}

// 加载COS配置
async function loadCOSConfig() {
  if (cosConfigPromise) {
    return cosConfigPromise;
  }
  
  cosConfigPromise = new Promise(async (resolve, reject) => {
    try {
      // 检查配置是否已加载
      if (window.COS_CONFIG && window.COS_CONFIG.Bucket && window.COS_CONFIG.Region) {
        resolve(window.COS_CONFIG);
        return;
      }
      
      // 加载配置文件
      await loadScript(CONFIG.COS_CONFIG_URL);
      
      // 验证配置
      if (!window.COS_CONFIG) {
        throw new Error('COS config not found after loading');
      }
      
      if (!window.COS_CONFIG.Bucket || !window.COS_CONFIG.Region) {
        throw new Error('Invalid COS config: missing Bucket or Region');
      }
      
      resolve(window.COS_CONFIG);
    } catch (error) {
      reject(new Error(`Failed to load COS config: ${error.message}`));
    }
  });
  
  return cosConfigPromise;
}

// 加载并初始化COS
async function initializeCOS() {
  try {
    const COS = await ensureCOSSDK();
    const config = await loadCOSConfig();
    
    // 创建COS实例
    return new COS({
      SecretId: config.SecretId,
      SecretKey: config.SecretKey,
      SessionToken: config.SessionToken,
    });
  } catch (error) {
    throw new Error(`Failed to initialize COS: ${error.message}`);
  }
}

// 从COS获取下载文件列表
async function fetchDownloadDataFromCOS() {
  try {
    // 初始化COS
    const cos = await initializeCOS();
    const COS_CONFIG = await loadCOSConfig();
    
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
        if (!data || typeof data !== 'object') {
          reject(new Error('COS返回的数据格式无效'));
          return;
        }
        
        // 解析返回的数据，按文件夹分类
        const portfolio = [];
        const tools = [];
        
        if (!data.Contents || !Array.isArray(data.Contents)) {
          console.warn('COS返回的数据中没有Contents字段或不是数组');
          resolve({
            portfolio,
            tools
          });
          return;
        }
        
        // 处理每个文件
        data.Contents.forEach(function(item) {
          try {
            // 验证文件项结构
            if (!item || typeof item !== 'object' || !item.Key) {
              console.warn('无效的文件项:', item);
              return;
            }
            
            const key = item.Key;
            // 跳过目录项（以/结尾的键）和空文件名
            if (key.endsWith('/')) {
              return;
            }
            
            const fileName = key.split('/').pop();
            if (!fileName) {
              return;
            }
            
            // 提取文件扩展名
            const extension = fileName.split('.').pop()?.toLowerCase();
            
            // 构建文件对象
            const fileObj = {
              id: generateUniqueId(),
              name: fileName,
              size: formatFileSize(item.Size || 0),
              updateTime: item.LastModified ? new Date(item.LastModified).toLocaleString() : '',
              url: `https://${COS_CONFIG.Bucket}.cos.${COS_CONFIG.Region}.myqcloud.com/${encodeURIComponent(key)}`,
              type: getFileType(extension),
              cosKey: key
            };
            
            // 分类处理
            const pathParts = key.split('/').filter(part => part); // 过滤空字符串
            if (pathParts.length >= 2 && pathParts[0] === 'uploads') {
              const category = pathParts[1];
              if (category === 'tools') {
                tools.push(fileObj);
              } else {
                portfolio.push(fileObj);
              }
            } else if (pathParts.length === 2 && pathParts[0] === 'uploads') {
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
        
        resolve({
          portfolio,
          tools
        });
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