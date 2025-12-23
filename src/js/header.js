import siteConfig from './config.js';
import { getDownloadData } from './downloadData.js';
import { themeConfig } from './themeConfig.js';

/**
 * 根据主题设置CSS变量
 * @param {string} theme - 主题名称 ('light' 或 'dark')
 */
function setThemeVariables(theme) {
  const colors = themeConfig[theme];
  const root = document.documentElement;
  
  // 设置CSS变量
  root.style.setProperty('--bg-color', colors.bgColor);
  root.style.setProperty('--text-color', colors.textColor);
  root.style.setProperty('--card-bg', colors.cardBg);
  root.style.setProperty('--card-selected', colors.cardSelected);
  root.style.setProperty('--card-hover', colors.cardHover);
  root.style.setProperty('--border-color', colors.borderColor);
  root.style.setProperty('--shadow-color', colors.shadowColor);
  root.style.setProperty('--link-color', colors.linkColor);
  root.style.setProperty('--link-hover', colors.linkHover);
  root.style.setProperty('--gray-100', colors.gray100);
  root.style.setProperty('--gray-200', colors.gray200);
  root.style.setProperty('--gray-600', colors.gray600);
  root.style.setProperty('--gray-700', colors.gray700);
  root.style.setProperty('--gray-800', colors.gray800);
  root.style.setProperty('--text-selected', colors.textSelected);
  root.style.setProperty('--text-normal', colors.textNormal);
  root.style.setProperty('--backdrop-blur', colors.backdropBlur);
  // 设置导航栏背景色
  root.style.setProperty('--nav-bg', colors.cardBg);
}

/**
 * 初始化下载页面内容
 */
function initDownloadPage() {
  const downloadPage = document.getElementById('download-page');
  if (!downloadPage) {
    return;
  }
  
  // 创建下载页面内容
  const downloadContent = `
    <div class="download-container bg-white rounded-2xl p-6 shadow-lg">
    <h2 class="download-title text-2xl font-bold mb-6">下载中心</h2>
    <div id="files-view" class="p-6">
                <div class="flex justify-between items-center mb-4">
                    <div class="relative w-1/2">
                        <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-text-color"></i>
                        <input id="file-search" type="text" placeholder="搜索文件..." class="w-full bg-gray-700 border border-gray-600 rounded-md py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-color">
                    </div>
                    <select id="file-filter" class="bg-gray-700 border border-gray-600 rounded-md py-2 px-4 focus:outline-none focus:ring-2 focus:ring-primary-color">
                        <option value="all">所有文件</option>
                        <option value="image">图片</option>
                        <option value="document">文档</option>
                        <option value="video">视频</option>
                        <option value="audio">音频</option>
                        <option value="other">其他</option>
                    </select>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="border-b border-gray-700">
                                <th class="p-3">文件名</th>
                                <th class="p-3">大小</th>
                                <th class="p-3">上传时间</th>
                                <th class="p-3">操作</th>
                            </tr>
                        </thead>
                        <tbody id="files-list">
                            <!-- 文件列表将通过 JavaScript 动态生成 -->
                        </tbody>
                    </table>
                </div>
            </div>
    <div id="toast" class="toast"></div>
    </div>
  `;
  
  // 注入内容
  downloadPage.innerHTML = downloadContent;
  
  // 添加事件监听
  addDownloadListEventListeners();
}

/**
 * 根据文件名获取文件类型图标
 * @param {string} fileName - 文件名
 * @returns {string} - 图标HTML
 */
function getFileTypeIcon(fileName) {
  // 移除路径前缀，只保留文件名
  const actualFileName = fileName.split('/').pop();
  const extension = actualFileName.toLowerCase().split('.').pop();
  
  // 图片类型图标
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
  if (imageExtensions.includes(extension)) {
    return '<i class="fa-regular fa-file-image mr-2" style="color: #3b82f6;"></i>';
  }
  
  // 文档类型图标
  const docExtensions = ['pdf', 'doc', 'docx', 'txt', 'md', 'ppt', 'pptx', 'xls', 'xlsx'];
  if (docExtensions.includes(extension)) {
    if (extension === 'pdf') {
      return '<i class="fa-regular fa-file-pdf mr-2" style="color: #ef4444;"></i>';
    } else if (['doc', 'docx'].includes(extension)) {
      return '<i class="fa-regular fa-file-word mr-2" style="color: #3b82f6;"></i>';
    } else if (['xls', 'xlsx'].includes(extension)) {
      return '<i class="fa-regular fa-file-excel mr-2" style="color: #10b981;"></i>';
    } else if (['ppt', 'pptx'].includes(extension)) {
      return '<i class="fa-regular fa-file-powerpoint mr-2" style="color: #f59e0b;"></i>';
    } else {
      return '<i class="fa-regular fa-file-lines mr-2" style="color: #6b7280;"></i>';
    }
  }
  
  // 视频类型图标
  const videoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'];
  if (videoExtensions.includes(extension)) {
    return '<i class="fa-regular fa-file-video mr-2" style="color: #f59e0b;"></i>';
  }
  
  // 音频类型图标
  const audioExtensions = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'wma'];
  if (audioExtensions.includes(extension)) {
    return '<i class="fa-regular fa-file-audio mr-2" style="color: #8b5cf6;"></i>';
  }
  
  // 压缩文件类型图标
  const zipExtensions = ['zip', 'rar', '7z'];
  if (zipExtensions.includes(extension)) {
    return '<i class="fa-solid fa-file-zipper mr-2" style="color: #f59e0b;"></i>';
  }
  
  // 可执行文件类型图标
  const exeExtensions = ['exe', 'dmg', 'pkg', 'msi'];
  if (exeExtensions.includes(extension)) {
    return '<i class="fa-solid fa-file-code mr-2" style="color: #ef4444;"></i>';
  }
  
  // 默认图标
  return '<i class="fa-regular fa-file mr-2" style="color: #6b7280;"></i>';
}

/**
 * 生成下载列表HTML
 * @param {Array} files - 文件列表数据
 */
function generateDownloadList(files) {
  if (!files || files.length === 0) {
    return '<div class="text-center py-4" style="color: var(--gray-600);">暂无文件</div>';
  }
  
  return files.map(item => `
    <div class="flex justify-between items-center p-2 rounded-md" style="color: var(--text-color);">
      <div class="flex-1">
          <div class="font-medium">${getFileTypeIcon(item.name)}${item.name.replace('uploads/', '')}</div>
        <div class="text-sm" style="color: var(--gray-600);">
          <span class="mr-4">大小：${item.size}</span>
          <span>更新时间：${item.updateTime}</span>
        </div>
      </div>
      <a href="${item.url}" class="ml-4 px-3 py-1 rounded transition-colors text-sm" 
         style="background-color: var(--gray-200); color: var(--gray-800); hover:background-color: var(--gray-300);">
        下载
      </a>
    </div>
  `).join('');
}

/**
 * 添加下载列表事件监听器
 */
function addDownloadListEventListeners() {
  // 获取下载列表容器
  const listContainer = document.querySelector('.download-list-container');
  const listTitle = document.getElementById('list-title');
  const listContent = document.getElementById('download-list-content');
  
  // 获取搜索和筛选元素
  const searchInput = document.getElementById('download-search');
  const typeFilter = document.getElementById('file-type-filter');
  
  if (!listContainer || !listTitle || !listContent) {
    return;
  }
  
  // 记录当前显示的分类和原始文件数据
  let currentFiles = [];
  const defaultCategory = 'portfolio'; // 默认显示作品集
  
  // 加载文件数据的函数
  async function loadFiles(category) {
    try {
      // 显示加载状态
      listContent.innerHTML = '<div class="text-center py-4" style="color: var(--gray-600);">加载中...</div>';
      
      // 从腾讯云COS获取文件列表数据
      const data = await getDownloadData();
      currentFiles = data[category] || [];
      
      // 应用搜索和筛选条件
      applyFilters();
    } catch (error) {
      console.error('加载文件失败:', error);
      listContent.innerHTML = '<div class="text-center py-4" style="color: #ef4444;">加载文件失败，请稍后重试</div>';
    }
  }
  
  // 应用搜索和筛选条件
  function applyFilters() {
    let filteredFiles = [...currentFiles];
    
    // 应用搜索过滤
    const searchTerm = searchInput?.value.toLowerCase() || '';
    if (searchTerm) {
      filteredFiles = filteredFiles.filter(file => {
        // 只在实际文件名部分搜索（移除路径前缀）
        const actualFileName = file.name.split('/').pop();
        return actualFileName.toLowerCase().includes(searchTerm);
      });
    }
    
    // 应用文件类型过滤
    const selectedType = typeFilter?.value || 'all';
    if (selectedType !== 'all') {
      // 定义文件类型分类
      const fileTypeMap = {
        image: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'],
        document: ['.pdf', '.doc', '.docx', '.txt', '.md', '.ppt', '.pptx', '.xls', '.xlsx'],
        video: ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm'],
        audio: ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.wma'],
        other: ['.zip', '.rar', '.7z', '.exe', '.dmg', '.pkg', '.msi']
      };
      
      // 获取当前分类对应的扩展名列表
      const extensions = fileTypeMap[selectedType] || [];
      
      // 过滤文件
      filteredFiles = filteredFiles.filter(file => {
        const fileName = file.name.toLowerCase();
        return extensions.some(ext => fileName.endsWith(ext));
      });
    }
    
    // 重新渲染列表
    listContent.innerHTML = generateDownloadList(filteredFiles);
  }
  
  // 添加搜索和筛选事件监听
  searchInput?.addEventListener('input', applyFilters);
  typeFilter?.addEventListener('change', applyFilters);
  
  // 直接加载作品集数据
  loadFiles(defaultCategory);
}

/**
 * 添加夜间模式切换事件监听器
 */
function addNightModeEventListener() {
  const toggleButton = document.getElementById('night-mode-toggle');
  if (!toggleButton) {
    return;
  }
  
  // 初始化主题
  initNightMode();
  
  // 添加点击事件
  toggleButton.addEventListener('click', () => {
    toggleNightMode();
  });
}

/**
 * 初始化夜间模式
 */
function initNightMode() {
  // 检查localStorage中的主题偏好
  const savedTheme = localStorage.getItem('isNightMode');
  
  // 检测系统主题偏好
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // 决定使用哪种主题：优先使用保存的主题，否则使用系统主题
  const isNightMode = savedTheme !== null ? (savedTheme === 'true') : prefersDark;
  
  // 应用主题
  if (isNightMode) {
    document.body.classList.add('night-mode');
    setThemeVariables('dark');
  } else {
    document.body.classList.remove('night-mode');
    setThemeVariables('light');
  }
  
  // 更新按钮图标
  updateNightModeButton(isNightMode);
  
  // 监听系统主题变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    // 只有在用户没有手动选择主题时，才根据系统主题变化
    if (localStorage.getItem('isNightMode') === null) {
      const newIsNightMode = e.matches;
      if (newIsNightMode) {
        document.body.classList.add('night-mode');
        setThemeVariables('dark');
      } else {
        document.body.classList.remove('night-mode');
        setThemeVariables('light');
      }
      updateNightModeButton(newIsNightMode);
    }
  });
}

/**
 * 切换夜间模式
 */
function toggleNightMode() {
  // 切换body类
  document.body.classList.toggle('night-mode');
  
  // 保存到localStorage
  const isNightMode = document.body.classList.contains('night-mode');
  localStorage.setItem('isNightMode', isNightMode);
  
  // 设置主题变量
  setThemeVariables(isNightMode ? 'dark' : 'light');
  
  // 更新按钮图标
  updateNightModeButton(isNightMode);
}

/**
 * 更新夜间模式按钮图标
 * @param {boolean} isNightMode - 是否为夜间模式
 */
function updateNightModeButton(isNightMode) {
  const toggleButton = document.getElementById('night-mode-toggle');
  if (!toggleButton) {
    return;
  }
  
  const icon = toggleButton.querySelector('i');
  if (icon) {
    if (isNightMode) {
      icon.className = 'fa-solid fa-sun';
    } else {
      icon.className = 'fa-solid fa-moon';
    }
  }
}

/**
 * 展开下载列表
 * @param {HTMLElement} listContainer - 列表容器
 */
function openDownloadList(listContainer) {
  // 计算列表内容的高度
  const contentHeight = listContainer.firstElementChild.scrollHeight;
  // 设置最大高度，触发下拉动画
  listContainer.style.maxHeight = `${contentHeight + 20}px`; // 20px为内边距
}

/**
 * 收起下载列表
 * @param {HTMLElement} listContainer - 列表容器
 * @returns {Promise} - 动画完成的Promise
 */
function closeDownloadList(listContainer) {
  return new Promise(resolve => {
    // 设置最大高度为0，触发上拉动画
    listContainer.style.maxHeight = '0';
    
    // 监听动画结束
    const handleTransitionEnd = () => {
      listContainer.removeEventListener('transitionend', handleTransitionEnd);
      resolve();
    };
    
    listContainer.addEventListener('transitionend', handleTransitionEnd);
  });
}

/**
 * 更新页面头部内容
 */
export function updateHeader() {
  // 验证siteConfig.site是否存在
  if (!siteConfig || !siteConfig.site) {
    console.error('配置缺失：siteConfig.site');
    return;
  }

  // 更新网站标题
  const titleElement = document.querySelector('title');
  if (titleElement && siteConfig.site.title) {
    titleElement.textContent = siteConfig.site.title;
  }

  // 更新页面头部内容
  const headerElement = document.getElementById('page-header');
  if (headerElement) {
    // 使用空值合并运算符提供默认值
    const titleIcon = siteConfig.site.titleIcon || '';
    const title = siteConfig.site.title || '';
    
    headerElement.innerHTML = `
      <div class="mb-6 md:mb-0">
        <div class="bg-card rounded-xl w-16 h-16">
          ${titleIcon ? `<img src="${titleIcon}" max-height="100%">` : ''}
        </div>
      </div>
      <div class="flex items-center space-x-4 mb-6 md:mb-0">
        <!-- 液态玻璃效果导航 -->
        <div class="bg-nav backdrop-blur-md rounded-full shadow-lg p-1 flex items-center space-x-1">
          <a href="javascript:void(0)" id="home-btn" class="px-6 py-2 rounded-full bg-selected text-selected font-medium hover:bg-opacity-90 transition-all duration-300 shadow-sm">
            首页
          </a>
          <a href="javascript:void(0)" id="download-btn" class="px-6 py-2 rounded-full bg-transparent text-normal font-medium hover:bg-white/50 transition-all duration-300">
            下载
          </a>
        </div>
        <!-- 独立的圆形夜间模式切换按钮 -->
        <button id="night-mode-toggle" class="w-12 h-12 rounded-full bg-nav backdrop-blur-md shadow-lg flex items-center justify-center text-gray-700 hover:bg-white/50 transition-all duration-300">
          <i class="fa-solid fa-moon"></i>
        </button>
      </div>
    `;
    
    // 添加导航按钮点击事件
    addNavigationEventListeners();
    
    // 添加夜间模式切换事件
    addNightModeEventListener();
  }

  // 更新 favicon
  const faviconElement = document.querySelector('link[rel="icon"]');
  if (faviconElement && siteConfig.site.favicon) {
    faviconElement.href = siteConfig.site.favicon;
  }
  
  // 初始化下载页面内容
  initDownloadPage();
}

/**
 * 添加导航按钮事件监听器
 */
function addNavigationEventListeners() {
  // 获取DOM元素
  const homePage = document.getElementById('home-page');
  const downloadPage = document.getElementById('download-page');
  const homeBtn = document.getElementById('home-btn');
  const downloadBtn = document.getElementById('download-btn');
  
  if (!homePage || !downloadPage || !homeBtn || !downloadBtn) {
    return;
  }
  
  // 优化过渡动画，使用硬件加速
  homePage.style.willChange = 'transform, opacity';
  downloadPage.style.willChange = 'transform, opacity';
  
  // 首页按钮点击事件 - 优化动画顺序
  homeBtn.addEventListener('click', () => {
    // 先开始下载页退出动画
    downloadPage.style.transform = 'translate3d(100%, 0, 0)';
    downloadPage.style.opacity = '0';
    
    // 立即开始主页进入动画
    homePage.style.transform = 'translate3d(0, 0, 0)';
    homePage.style.opacity = '1';
    
    // 更新按钮样式
    homeBtn.classList.add('bg-selected', 'text-selected', 'shadow-sm');
    homeBtn.classList.remove('bg-transparent', 'text-normal');
    downloadBtn.classList.add('bg-transparent', 'text-normal');
    downloadBtn.classList.remove('bg-selected', 'text-selected', 'shadow-sm');
  });
  
  // 下载按钮点击事件 - 优化动画顺序
  downloadBtn.addEventListener('click', () => {
    // 先开始主页退出动画
    homePage.style.transform = 'translate3d(-100%, 0, 0)';
    homePage.style.opacity = '0';
    
    // 立即开始下载页进入动画
    downloadPage.style.transform = 'translate3d(0, 0, 0)';
    downloadPage.style.opacity = '1';
    
    // 更新按钮样式
    downloadBtn.classList.add('bg-selected', 'text-selected', 'shadow-sm');
    downloadBtn.classList.remove('bg-transparent', 'text-normal');
    homeBtn.classList.add('bg-transparent', 'text-normal');
    homeBtn.classList.remove('bg-selected', 'text-selected', 'shadow-sm');
  });
}

/**
 * 更新页脚内容
 */
export function updateFooter() {
  // 更新第一行文本（制作者）
  const madeByElement = document.getElementById('made-by');
  if (madeByElement) {
    madeByElement.innerHTML = 'Made by <a href="https://github.com/KiriharaChikuu" target="_blank" rel="noopener noreferrer" class="hover:text-link-hover" style="color: var(--gray-600);">KiriharaChikuu</a>';
  }
  
  // 更新第二行文本（技术支持）
  const poweredByElement = document.getElementById('powered-by');
  if (poweredByElement) {
    poweredByElement.innerHTML = `
      <span class="inline-flex items-center justify-center">
        Powered by 
        <a href="https://tailwindcss.com" target="_blank" rel="noopener noreferrer" class="inline-flex items-center ml-1 hover:text-link-hover" style="color: var(--gray-600);">
          <img src="/tw.svg" alt="Tailwind CSS Logo" class="h-4 w-4 mr-1">Tailwind CSS
        </a>
        <span class="mx-1">&</span>
        <a href="https://vitejs.dev" target="_blank" rel="noopener noreferrer" class="inline-flex items-center hover:text-link-hover" style="color: var(--gray-600);">
          <img src="/vite.svg" alt="Vite Logo" class="h-4 w-4 mr-1">Vite
        </a>
      </span>
    `;
  }
  
  // 更新第三行文本（灵感来源）
  const inspiredByElement = document.getElementById('inspired-by');
  if (inspiredByElement) {
    inspiredByElement.innerHTML = 'Inspired by <a href="https://bento.me" target="_blank" rel="noopener noreferrer" class="hover:text-link-hover" style="color: var(--gray-600);">bento.me</a>';
  }
  
  // 更新版权信息
  const copyrightElement = document.getElementById('copyright');
  if (copyrightElement) {
    const currentYear = new Date().getFullYear();
    // 使用空值合并运算符提供默认值
    const userName = siteConfig?.user?.name || 'Unknown';
    copyrightElement.textContent = `© ${currentYear} ${userName}. All rights reserved.`;
  }
}