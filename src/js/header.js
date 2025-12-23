import siteConfig from './config.js';
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