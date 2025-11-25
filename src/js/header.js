import siteConfig from './config.js';

/**
 * 更新页面头部内容
 */
export function updateHeader() {
  // 更新网站标题
  const titleElement = document.querySelector('title');
  if (titleElement) {
    titleElement.textContent = siteConfig.site.title;
  }

  // 更新页面头部内容
  const headerElement = document.getElementById('page-header');
  if (headerElement) {
    headerElement.innerHTML = `
      <div class="mb-6 md:mb-0">
        <div class="bg-gray-200 border-2 border-dashed rounded-xl w-16 h-16">
          <img src="${siteConfig.site.titleIcon}" max-height="100%">
        </div>
      </div>
      <div class="mb-6 md:mb-0">
        <span class="font-bold text-xl">${siteConfig.site.title}</span>
      </div>
    `;
  }

  // 更新 favicon
  const faviconElement = document.querySelector('link[rel="icon"]');
  if (faviconElement) {
    faviconElement.href = siteConfig.site.favicon;
  }
}

/**
 * 更新页脚内容
 */
export function updateFooter() {
  // 更新第一行文本（制作者）
  const madeByElement = document.getElementById('made-by');
  if (madeByElement) {
    madeByElement.innerHTML = 'Made by <a href="https://github.com/KiriharaChikuu" target="_blank" rel="noopener noreferrer" class="text-gray-600 hover:text-gray-900">KiriharaChikuu</a>';
  }
  
  // 更新第二行文本（技术支持）
  const poweredByElement = document.getElementById('powered-by');
  if (poweredByElement) {
    poweredByElement.innerHTML = `
      <span class="inline-flex items-center justify-center">
        Powered by 
        <a href="https://tailwindcss.com" target="_blank" rel="noopener noreferrer" class="inline-flex items-center ml-1 text-gray-600 hover:text-gray-900">
          <img src="/tw.svg" alt="Tailwind CSS Logo" class="h-4 w-4 mr-1">Tailwind CSS
        </a>
        <span class="mx-1">&</span>
        <a href="https://vitejs.dev" target="_blank" rel="noopener noreferrer" class="inline-flex items-center text-gray-600 hover:text-gray-900">
          <img src="/vite.svg" alt="Vite Logo" class="h-4 w-4 mr-1">Vite
        </a>
      </span>
    `;
  }
  
  // 更新第三行文本（灵感来源）
  const inspiredByElement = document.getElementById('inspired-by');
  if (inspiredByElement) {
    inspiredByElement.innerHTML = 'Inspired by <a href="https://bento.me" target="_blank" rel="noopener noreferrer" class="text-gray-600 hover:text-gray-900">bento.me</a>';
  }
  
  // 更新版权信息
  const copyrightElement = document.getElementById('copyright-info');
  if (copyrightElement) {
    const currentYear = new Date().getFullYear();
    copyrightElement.textContent = `© ${currentYear} ${siteConfig.user.name}. All rights reserved.`;
  }
}