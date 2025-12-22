// 下载列表数据
// 动态加载COS SDK和配置
async function loadCOSConfig() {
  return new Promise((resolve, reject) => {
    // 检查COS SDK是否已经加载
    if (window.COS) {
      console.log('COS SDK 已存在，直接加载配置');
      // 加载COS配置
      const script = document.createElement('script');
      script.src = 'https://chikuu-1252656027.cos.ap-nanjing.myqcloud.com/config.js';
      script.onload = () => {
        console.log('COS配置加载成功');
        resolve(window.COS_CONFIG);
      };
      script.onerror = () => {
        console.error('加载COS配置失败');
        reject(new Error('Failed to load COS config'));
      };
      document.head.appendChild(script);
    } else {
      console.log('正在加载COS SDK...');
      // 动态加载COS SDK
      const cosScript = document.createElement('script');
      cosScript.src = 'https://cdn.jsdelivr.net/npm/cos-js-sdk-v5@1.4.5/dist/cos-js-sdk-v5.min.js';
      cosScript.onload = () => {
        console.log('COS SDK加载成功');
        // 加载COS配置
        const configScript = document.createElement('script');
        configScript.src = 'https://chikuu-1252656027.cos.ap-nanjing.myqcloud.com/config.js';
        configScript.onload = () => {
          console.log('COS配置加载成功');
          resolve(window.COS_CONFIG);
        };
        configScript.onerror = () => {
          console.error('加载COS配置失败');
          reject(new Error('Failed to load COS config'));
        };
        document.head.appendChild(configScript);
      };
      cosScript.onerror = () => {
        console.error('加载COS SDK失败');
        reject(new Error('Failed to load COS SDK'));
      };
      document.head.appendChild(cosScript);
    }
  });
}

// 从COS获取下载文件列表
async function fetchDownloadDataFromCOS() {
  try {
    console.log('开始从COS获取文件列表...');
    const COS_CONFIG = await loadCOSConfig();
    
    // 验证COS配置
    if (!COS_CONFIG || !COS_CONFIG.Bucket || !COS_CONFIG.Region) {
      throw new Error('无效的COS配置');
    }
    
    console.log('COS配置有效，创建COS实例...');
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
        Prefix: 'uploads/', // 下载文件存放在uploads/目录下
      }, function(err, data) {
        if (err) {
          console.error('获取下载列表失败:', err);
          console.error('错误详情:', JSON.stringify(err, null, 2));
          reject(new Error(`获取文件列表失败: ${err.message || '未知错误'}`));
          return;
        }
        
        console.log('成功获取COS文件列表，开始解析数据...');
        // 解析返回的数据，按文件夹分类
        const portfolio = [];
        const tools = [];
        
        if (!data.Contents || !Array.isArray(data.Contents)) {
          console.warn('COS返回的数据格式不符合预期，Contents字段不存在或不是数组');
          resolve({
            portfolio,
            tools
          });
          return;
        }
        
        console.log(`共获取到 ${data.Contents.length} 个文件`);
        data.Contents.forEach(function(item) {
          try {
            const key = item.Key;
            // 跳过目录项（以/结尾的键）
            if (key.endsWith('/')) {
              console.log(`跳过目录项: ${key}`);
              return;
            }
            
            // 提取目录名，如 uploads/portfolio/ 或 uploads/tools/
            const pathParts = key.split('/');
            if (pathParts.length >= 3 && pathParts[0] === 'uploads' && pathParts[1]) {
              const category = pathParts[1]; // 'portfolio' 或 'tools'
              const fileName = key.split('/').pop();
              
              // 跳过空文件名
              if (!fileName) {
                console.log(`跳过空文件名: ${key}`);
                return;
              }
              
              const fileSize = formatFileSize(item.Size);
              const lastModified = new Date(item.LastModified).toLocaleString(); // 使用本地化时间字符串
              
              // 推测文件类型
              const extension = fileName.split('.').pop()?.toLowerCase();
              let fileType = 'application/octet-stream';
              if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension)) {
                fileType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;
              } else if (['pdf', 'doc', 'docx', 'txt', 'md', 'ppt', 'pptx', 'xls', 'xlsx'].includes(extension)) {
                if (extension === 'pdf') fileType = 'application/pdf';
                else if (['doc', 'docx'].includes(extension)) fileType = 'application/msword';
                else if (['xls', 'xlsx'].includes(extension)) fileType = 'application/vnd.ms-excel';
                else if (['ppt', 'pptx'].includes(extension)) fileType = 'application/vnd.ms-powerpoint';
                else fileType = 'text/plain';
              } else if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(extension)) {
                fileType = 'video/mp4';
              } else if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'wma'].includes(extension)) {
                fileType = 'audio/mpeg';
              } else if (['zip', 'rar', '7z'].includes(extension)) {
                fileType = 'application/zip';
              }
              
              const fileObj = {
                id: Date.now() + Math.random(),
                name: fileName,
                size: fileSize,
                updateTime: lastModified,
                url: `https://${COS_CONFIG.Bucket}.cos.${COS_CONFIG.Region}.myqcloud.com/${key}`,
                type: fileType,
                cosKey: key
              };
              
              if (category === 'portfolio') {
                portfolio.push(fileObj);
              } else if (category === 'tools') {
                tools.push(fileObj);
              } else {
                console.log(`未知分类: ${category}，文件: ${key}`);
              }
            } else {
              console.log(`路径格式不符合预期: ${key}`);
            }
          } catch (itemError) {
            console.error(`处理文件项 ${item.Key} 时出错:`, itemError);
            // 跳过错误项，继续处理其他文件
          }
        });
        
        console.log(`解析完成: 作品集 ${portfolio.length} 个文件，工具集 ${tools.length} 个文件`);
        resolve({
          portfolio,
          tools
        });
      });
    });
  } catch (error) {
    console.error('加载COS数据失败:', error);
    console.error('错误详情:', JSON.stringify(error, null, 2));
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