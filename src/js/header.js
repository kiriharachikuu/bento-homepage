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
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="download-category bg-gray-100 rounded-xl p-6">
          <h3 class="download-category-title text-lg font-semibold mb-2">作品集</h3>
          <p class="download-category-desc text-gray-600 mb-4">我的音乐作品集下载</p>
          <button class="inline-block px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors" data-category="portfolio">
            立即下载
          </button>
        </div>
        <div class="download-category bg-gray-100 rounded-xl p-6">
          <h3 class="download-category-title text-lg font-semibold mb-2">工具集</h3>
          <p class="download-category-desc text-gray-600 mb-4">常用工具和资源下载</p>
          <button class="inline-block px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors" data-category="tools">
            立即下载
          </button>
        </div>
      </div>
      <!-- 统一的下载列表区域 -->
      <div class="download-list-container mt-6 overflow-hidden transition-all duration-500 ease-in-out max-h-0">
        <div class="download-list bg-white rounded-lg shadow-md p-4">
          <h4 class="download-list-title font-medium mb-3" id="list-title">下载列表</h4>
          
          <!-- 添加搜索和筛选功能 -->
          <div class="download-filters mb-4">
            <div class="flex flex-col md:flex-row gap-3">
              <!-- 搜索框 -->
              <div class="flex-1">
                <input type="text" id="download-search" placeholder="搜索文件名..." class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              </div>
              <!-- 文件类型筛选 -->
              <div class="flex items-center gap-2">
                <label for="file-type-filter" class="text-sm text-gray-600">文件类型：</label>
                <select id="file-type-filter" class="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="all">所有类型</option>
                  <option value=".zip">ZIP</option>
                  <option value=".exe">EXE</option>
                  <option value=".pdf">PDF</option>
                  <option value=".mp3">MP3</option>
                  <option value=".mp4">MP4</option>
                  <option value=".jpg">JPG</option>
                  <option value=".png">PNG</option>
                </select>
              </div>
            </div>
          </div>
          
          <div class="space-y-3" id="download-list-content"></div>
        </div>
      </div>
    </div>
  `;
  
  // 注入内容
  downloadPage.innerHTML = downloadContent;
  
  // 添加事件监听
  addDownloadListEventListeners();
}

/**
 * 生成下载列表HTML
 * @param {Array} files - 文件列表数据
 */
function generateDownloadList(files) {
  if (!files || files.length === 0) {
    return '<div class="text-center text-gray-500 py-4">暂无文件</div>';
  }
  
  return files.map(item => `
    <div class="flex justify-between items-center p-2 rounded-md hover:bg-gray-100">
      <div class="flex-1">
        <div class="font-medium">${item.name}</div>
        <div class="text-sm text-gray-500">
          <span class="mr-4">大小：${item.size}</span>
          <span>更新时间：${item.updateTime}</span>
        </div>
      </div>
      <a href="${item.url}" class="ml-4 px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors text-sm">
        下载
      </a>
    </div>
  `).join('');
}

/**
 * 添加下载列表事件监听器
 */
function addDownloadListEventListeners() {
  // 获取所有下载按钮
  const downloadButtons = document.querySelectorAll('[data-category]');
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
  let currentCategory = null;
  let currentFiles = [];
  
  // 加载文件数据的函数
  async function loadFiles(category) {
    try {
      // 显示加载状态
      listContent.innerHTML = '<div class="text-center text-gray-500 py-4">加载中...</div>';
      
      // 从腾讯云COS获取文件列表数据
      const data = await getDownloadData();
      currentFiles = data[category] || [];
      
      // 应用搜索和筛选条件
      applyFilters();
    } catch (error) {
      console.error('加载文件失败:', error);
      listContent.innerHTML = '<div class="text-center text-red-500 py-4">加载文件失败，请稍后重试</div>';
    }
  }
  
  // 应用搜索和筛选条件
  function applyFilters() {
    let filteredFiles = [...currentFiles];
    
    // 应用搜索过滤
    const searchTerm = searchInput?.value.toLowerCase() || '';
    if (searchTerm) {
      filteredFiles = filteredFiles.filter(file => 
        file.name.toLowerCase().includes(searchTerm)
      );
    }
    
    // 应用文件类型过滤
    const selectedType = typeFilter?.value || 'all';
    if (selectedType !== 'all') {
      filteredFiles = filteredFiles.filter(file => 
        file.name.toLowerCase().endsWith(selectedType)
      );
    }
    
    // 重新渲染列表
    listContent.innerHTML = generateDownloadList(filteredFiles);
  }
  
  // 添加搜索和筛选事件监听
  searchInput?.addEventListener('input', applyFilters);
  typeFilter?.addEventListener('change', applyFilters);
  
  downloadButtons.forEach(button => {
    button.addEventListener('click', async () => {
      const category = button.getAttribute('data-category');
      
      if (currentCategory === category) {
        // 如果点击的是当前显示的分类，收起列表
        await closeDownloadList(listContainer);
        currentCategory = null;
        currentFiles = [];
        
        // 清空搜索和筛选
        if (searchInput) searchInput.value = '';
        if (typeFilter) typeFilter.value = 'all';
      } else {
        // 如果点击的是不同分类，先收起当前列表，再展开新列表
        if (currentCategory !== null) {
          await closeDownloadList(listContainer);
        }
        
        // 更新当前分类
        currentCategory = category;
        
        // 更新列表标题
        const categoryNames = {
          portfolio: '作品集下载列表',
          tools: '工具集下载列表'
        };
        listTitle.textContent = categoryNames[category] || '下载列表';
        
        // 加载文件数据
        await loadFiles(category);
        
        // 展开新列表
        openDownloadList(listContainer);
      }
    });
  });
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