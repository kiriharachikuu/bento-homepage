// 下载列表数据
// 动态加载COS SDK和配置
async function loadCOSConfig() {
  return new Promise((resolve, reject) => {
    // 检查COS SDK是否已经加载
    if (window.COS) {
      // 加载COS配置
      const script = document.createElement('script');
      script.src = 'https://chikuu-1252656027.cos.ap-nanjing.myqcloud.com/config.js';
      script.onload = () => resolve(window.COS_CONFIG);
      script.onerror = () => reject(new Error('Failed to load COS config'));
      document.head.appendChild(script);
    } else {
      // 动态加载COS SDK
      const cosScript = document.createElement('script');
      cosScript.src = 'https://cdn.jsdelivr.net/npm/cos-js-sdk-v5@1.4.5/dist/cos-js-sdk-v5.min.js';
      cosScript.onload = () => {
        // 加载COS配置
        const configScript = document.createElement('script');
        configScript.src = 'https://chikuu-1252656027.cos.ap-nanjing.myqcloud.com/config.js';
        configScript.onload = () => resolve(window.COS_CONFIG);
        configScript.onerror = () => reject(new Error('Failed to load COS config'));
        document.head.appendChild(configScript);
      };
      cosScript.onerror = () => reject(new Error('Failed to load COS SDK'));
      document.head.appendChild(cosScript);
    }
  });
}

// 从COS获取下载文件列表
async function fetchDownloadDataFromCOS() {
  try {
    const COS_CONFIG = await loadCOSConfig();
    
    // 创建COS实例
    const cos = new window.COS({
      SecretId: COS_CONFIG.SecretId,
      SecretKey: COS_CONFIG.SecretKey,
      SessionToken: COS_CONFIG.SessionToken,
    });
    
    return new Promise((resolve, reject) => {
      cos.getBucket({
        Bucket: COS_CONFIG.Bucket,
        Region: COS_CONFIG.Region,
        Prefix: 'downloads/', // 假设下载文件都存放在downloads/目录下
      }, function(err, data) {
        if (err) {
          console.error('获取下载列表失败:', err);
          reject(err);
          return;
        }
        
        // 解析返回的数据，按文件夹分类
        const portfolio = [];
        const tools = [];
        
        if (data.Contents) {
          data.Contents.forEach(function(item) {
            const key = item.Key;
            // 提取目录名，如 downloads/portfolio/ 或 downloads/tools/
            const pathParts = key.split('/');
            if (pathParts.length >= 2 && pathParts[0] === 'downloads') {
              const category = pathParts[1]; // 'portfolio' 或 'tools'
              const fileName = key.split('/').pop();
              const fileSize = formatFileSize(item.Size);
              const lastModified = new Date(item.LastModified).toISOString().split('T')[0]; // 格式化为 YYYY-MM-DD
              
              const fileObj = {
                id: Date.now() + Math.random(),
                name: fileName,
                size: fileSize,
                updateTime: lastModified,
                url: `https://${COS_CONFIG.Bucket}.cos.${COS_CONFIG.Region}.myqcloud.com/${key}`
              };
              
              if (category === 'portfolio') {
                portfolio.push(fileObj);
              } else if (category === 'tools') {
                tools.push(fileObj);
              }
            }
          });
        }
        
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

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return '0B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + sizes[i];
}

// 异步获取下载数据
export const getDownloadData = async () => {
  try {
    return await fetchDownloadDataFromCOS();
  } catch (error) {
    console.error('获取下载数据失败，返回默认数据:', error);
    // 如果COS获取失败，返回默认数据
    return {
      portfolio: [
        {
          id: 1,
          name: "2025年度作品集.zip",
          size: "150MB",
          updateTime: "2025-12-20",
          url: "#"
        },
        {
          id: 2,
          name: "ChiliChill翻唱集.zip",
          size: "85MB",
          updateTime: "2025-11-15",
          url: "#"
        },
        {
          id: 3,
          name: "星瞳相关作品.zip",
          size: "60MB",
          updateTime: "2025-10-05",
          url: "#"
        }
      ],
      tools: [
        {
          id: 1,
          name: "音频处理工具包.zip",
          size: "45MB",
          updateTime: "2025-12-10",
          url: "#"
        },
        {
          id: 2,
          name: "歌词同步工具.exe",
          size: "12MB",
          updateTime: "2025-11-20",
          url: "#"
        },
        {
          id: 3,
          name: "视频剪辑预设.zip",
          size: "28MB",
          updateTime: "2025-10-15",
          url: "#"
        }
      ]
    };
  }
};

// 保持原有的同步导出作为备用
export const downloadData = {
  // 作品集下载列表
  portfolio: [
    {
      id: 1,
      name: "2025年度作品集.zip",
      size: "150MB",
      updateTime: "2025-12-20",
      url: "#"
    },
    {
      id: 2,
      name: "ChiliChill翻唱集.zip",
      size: "85MB",
      updateTime: "2025-11-15",
      url: "#"
    },
    {
      id: 3,
      name: "星瞳相关作品.zip",
      size: "60MB",
      updateTime: "2025-10-05",
      url: "#"
    }
  ],

  // 工具集下载列表
  tools: [
    {
      id: 1,
      name: "音频处理工具包.zip",
      size: "45MB",
      updateTime: "2025-12-10",
      url: "#"
    },
    {
      id: 2,
      name: "歌词同步工具.exe",
      size: "12MB",
      updateTime: "2025-11-20",
      url: "#"
    },
    {
      id: 3,
      name: "视频剪辑预设.zip",
      size: "28MB",
      updateTime: "2025-10-15",
      url: "#"
    }
  ]
};