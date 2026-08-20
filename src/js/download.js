/**
 * 下载页前端逻辑（替代旧的 public/config-v1.js）
 *
 * 安全重构：不再依赖 COS SDK，也不再在前端暴露密钥：
 *   - 文件列表：GET /api/downloads（由服务端签名请求 COS 并解析）
 *   - 下载链接：GET /api/downloads/url?key=xxx（服务端生成 10 分钟有效的预签名 URL）
 */
'use strict';

/** 文件列表数据（来自 /api/downloads） */
let files = [];

/** DOM 元素引用 */
let fileSearchEl = null;
let fileFilterEl = null;
let filesListEl = null;
let toastEl = null;

/** toast 显示定时器（重复提示前先清除旧定时器） */
let toastTimer = null;

/** 扩展名 -> 文件类型分类映射 */
const TYPE_CATEGORIES = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'],
  document: ['pdf', 'doc', 'docx', 'txt', 'md', 'log', 'csv', 'ppt', 'pptx', 'xls', 'xlsx'],
  video: ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm', 'm4v'],
  audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'mid', 'midi']
};

/**
 * 获取文件名扩展名（小写；无扩展名返回空串）
 * @param {string} name 文件名
 * @returns {string}
 */
function getExtension(name) {
  const idx = name.lastIndexOf('.');
  if (idx === -1 || idx === name.length - 1) return '';
  return name.slice(idx + 1).toLowerCase();
}

/**
 * 根据文件名判断类型分类（image/document/video/audio/other）
 * @param {string} name 文件名
 * @returns {string}
 */
function getFileTypeCategory(name) {
  const ext = getExtension(name);
  for (const [category, extensions] of Object.entries(TYPE_CATEGORIES)) {
    if (extensions.includes(ext)) return category;
  }
  return 'other';
}

/**
 * 文件大小格式化
 * @param {number} bytes 字节数
 * @returns {string}
 */
function formatFileSize(bytes) {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 更新时间格式化（ISO 字符串 -> 本地可读时间）
 * @param {string} iso ISO 8601 时间字符串
 * @returns {string}
 */
function formatDate(iso) {
  const date = new Date(iso);
  return isNaN(date.getTime()) ? String(iso) : date.toLocaleString();
}

/**
 * HTML 转义（文件名与对象键来自 COS，可能包含特殊字符，防止注入）
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 根据扩展名返回文件图标（index.html 已加载 FontAwesome CDN，沿用 fa 图标）
 * @param {string} name 文件名
 * @returns {string} 图标的 HTML
 */
function getFileIcon(name) {
  const ext = getExtension(name);
  if (TYPE_CATEGORIES.image.includes(ext)) {
    return '<i class="fa-regular fa-file-image mr-2" style="color: #3b82f6;"></i>';
  }
  if (ext === 'pdf') {
    return '<i class="fa-regular fa-file-pdf mr-2" style="color: #ef4444;"></i>';
  }
  if (['doc', 'docx'].includes(ext)) {
    return '<i class="fa-regular fa-file-word mr-2" style="color: #3b82f6;"></i>';
  }
  if (['xls', 'xlsx'].includes(ext)) {
    return '<i class="fa-regular fa-file-excel mr-2" style="color: #10b981;"></i>';
  }
  if (['ppt', 'pptx'].includes(ext)) {
    return '<i class="fa-regular fa-file-powerpoint mr-2" style="color: #f59e0b;"></i>';
  }
  if (TYPE_CATEGORIES.document.includes(ext)) {
    return '<i class="fa-regular fa-file-lines mr-2" style="color: #6b7280;"></i>';
  }
  if (TYPE_CATEGORIES.video.includes(ext)) {
    return '<i class="fa-regular fa-file-video mr-2" style="color: #f59e0b;"></i>';
  }
  if (TYPE_CATEGORIES.audio.includes(ext)) {
    return '<i class="fa-regular fa-file-audio mr-2" style="color: #8b5cf6;"></i>';
  }
  if (['zip', 'rar', '7z'].includes(ext)) {
    return '<i class="fa-solid fa-file-zipper mr-2" style="color: #f59e0b;"></i>';
  }
  if (['exe', 'dmg', 'pkg', 'msi'].includes(ext)) {
    return '<i class="fa-solid fa-file-code mr-2" style="color: #ef4444;"></i>';
  }
  return '<i class="fa-regular fa-file mr-2" style="color: #6b7280;"></i>';
}

/**
 * 底部提示浮层（对齐旧版：gsap 动画 + 3 秒后消失；gsap 未加载时降级为 class 切换）
 * @param {string} message 提示文本
 */
function showToast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  clearTimeout(toastTimer);
  if (window.gsap) {
    window.gsap.killTweensOf(toastEl);
    window.gsap.fromTo(toastEl,
      { y: 50, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: 'back.out(1.2)' }
    );
    toastTimer = setTimeout(() => {
      window.gsap.to(toastEl, { y: 50, opacity: 0, duration: 0.5, ease: 'power2.in' });
    }, 3000);
  } else {
    // 降级方案：index.html 中 .toast 已定义 opacity 过渡与 .show 样式
    toastEl.classList.add('show');
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3000);
  }
}

/**
 * 从 /api/downloads 拉取文件列表并渲染
 */
async function loadFiles() {
  showToast('正在从腾讯云 COS 加载文件列表...');
  try {
    const response = await fetch('/api/downloads');
    const data = await response.json();
    if (!response.ok || !Array.isArray(data.files)) {
      const err = (data && data.error) || {};
      const error = new Error(err.message || ('HTTP ' + response.status));
      error.code = err.code;
      throw error;
    }
    files = data.files;
    renderFiles();
    showToast('成功加载 ' + files.length + ' 个文件。');
  } catch (err) {
    console.error('获取文件列表失败:', err);
    if (err && err.code === 'COS_NOT_CONFIGURED') {
      // 服务端未配置密钥，提示管理员去后台配置
      filesListEl.innerHTML =
        '<div class="p-4 text-center text-red-500">' +
        '<i class="fas fa-exclamation-circle inline-block w-5 h-5 mr-2"></i>' +
        'COS 未配置：请管理员在 EdgeOne Pages 环境变量中设置 COS_SECRET_ID / COS_SECRET_KEY。' +
        '</div>';
      showToast('COS 未配置，请联系管理员。');
    } else {
      filesListEl.innerHTML =
        '<div class="p-4 text-center text-red-500">' +
        '<i class="fas fa-exclamation-circle inline-block w-5 h-5 mr-2"></i>' +
        '获取文件列表失败，请检查网络连接或稍后再试。' +
        '</div>';
      showToast('获取文件列表失败，请稍后再试。');
    }
  }
}

/**
 * 按搜索词与类型筛选并渲染文件列表（结构对齐旧版）
 */
function renderFiles() {
  if (!filesListEl) return;
  const searchTerm = (fileSearchEl ? fileSearchEl.value : '').toLowerCase().trim();
  const filter = fileFilterEl ? fileFilterEl.value : 'all';

  const filteredFiles = files.filter((file) => {
    const matchesSearch = !searchTerm || (file.name || '').toLowerCase().includes(searchTerm);
    const matchesFilter = filter === 'all' || getFileTypeCategory(file.name || '') === filter;
    return matchesSearch && matchesFilter;
  });

  if (filteredFiles.length === 0) {
    filesListEl.innerHTML =
      '<div class="p-4 text-center text-muted-text-color">' +
      '<i class="fas fa-search inline-block w-5 h-5 mr-2"></i>' +
      '未找到匹配的文件。' +
      '</div>';
  } else {
    filesListEl.innerHTML = filteredFiles.map((file) =>
      '<div class="flex justify-between items-center p-2 rounded-md mb-2" ' +
      'style="color: var(--text-color); border: 1px solid var(--border-color); background-color: var(--gray-100);">' +
      '<div class="flex-1">' +
      '<div class="font-medium">' + getFileIcon(file.name || '') + escapeHtml(file.name || '') + '</div>' +
      '<div class="text-sm" style="color: var(--gray-600);">' +
      '<span class="mr-4">大小：' + formatFileSize(file.size) + '</span>' +
      '<span>更新时间：' + formatDate(file.lastModified) + '</span>' +
      '</div>' +
      '</div>' +
      '<button class="ml-4 px-3 py-1 rounded transition-colors text-sm download-btn" ' +
      'data-cos-key="' + escapeHtml(file.key || '') + '" ' +
      'data-file-name="' + escapeHtml(file.name || '') + '" ' +
      'style="background-color: var(--gray-200); color: var(--gray-800);">下载</button>' +
      '</div>'
    ).join('');
  }

  // 入场动画（gsap 未加载时跳过）
  if (window.gsap) {
    window.gsap.fromTo('#files-list > div',
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.3, stagger: 0.05, ease: 'power1.out', force3D: true }
    );
  }
}

/**
 * 搜索 / 筛选变化：淡出过渡后重新渲染（gsap 未加载时直接渲染）
 */
function handleFilterChange() {
  if (window.gsap) {
    window.gsap.killTweensOf('#files-list > div');
    window.gsap.to('#files-list', {
      opacity: 0.7,
      duration: 0.15,
      onComplete: () => {
        renderFiles();
        // 渲染完成后恢复容器透明度
        window.gsap.set('#files-list', { opacity: 1 });
      }
    });
  } else {
    renderFiles();
  }
}

/**
 * 下载文件：先请求预签名链接，再用临时 <a> 标签触发下载
 * @param {string} cosKey 对象键（如 uploads/xxx.png）
 * @param {string} fileName 下载保存的文件名
 */
async function handleDownload(cosKey, fileName) {
  if (!cosKey) return;
  showToast('正在准备下载文件 "' + fileName + '"...');
  try {
    const response = await fetch('/api/downloads/url?key=' + encodeURIComponent(cosKey));
    const data = await response.json();
    if (!response.ok || !data.url) {
      throw new Error((data && data.error && data.error.message) || ('HTTP ' + response.status));
    }
    // 创建临时 <a> 标签触发下载
    const link = document.createElement('a');
    link.href = data.url;
    link.download = fileName || '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('文件 "' + fileName + '" 下载中...');
  } catch (err) {
    console.error('获取下载链接失败:', err);
    showToast('获取下载链接失败，请稍后再试。');
  }
}

/**
 * 初始化下载页：绑定搜索 / 筛选 / 下载事件，并加载文件列表
 */
export function initDownloadPage() {
  fileSearchEl = document.getElementById('file-search');
  fileFilterEl = document.getElementById('file-filter');
  filesListEl = document.getElementById('files-list');
  toastEl = document.getElementById('toast');

  // 页面上不存在下载板块 DOM 时静默退出
  if (!filesListEl) return;

  // 搜索输入与类型筛选
  if (fileSearchEl) fileSearchEl.addEventListener('input', handleFilterChange);
  if (fileFilterEl) fileFilterEl.addEventListener('change', handleFilterChange);

  // 事件委托：统一处理列表内所有下载按钮的点击
  filesListEl.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('.download-btn') : null;
    if (button) {
      handleDownload(button.dataset.cosKey || '', button.dataset.fileName || '');
    }
  });

  // 初始加载文件列表
  loadFiles();
}

// 模块入口：模块脚本默认延迟执行（DOM 已就绪），兼容其他加载时机
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDownloadPage);
} else {
  initDownloadPage();
}