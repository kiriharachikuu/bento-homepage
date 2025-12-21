import siteConfig from '../config.js';

/**
 * 视频列表弹窗组件
 */
export class VideoListModal {
  /**
   * 构造函数
   * @param {Object} config - 弹窗配置
   */
  constructor(config) {
    this.config = {
      id: 'video-list-modal',
      title: '更多视频',
      closeOnClickOutside: true,
      ...config
    };
    
    this.isOpen = false;
    this.modalElement = null;
    this.overlayElement = null;
    this.videos = siteConfig.videos;
    
    // 初始化弹窗
    this.init();
  }
  
  /**
   * 初始化弹窗
   */
  init() {
    // 创建弹窗元素
    this.createModal();
    
    // 添加事件监听
    this.addEventListeners();
  }
  
  /**
   * 创建弹窗元素
   */
  createModal() {
    // 创建遮罩层
    this.overlayElement = document.createElement('div');
    this.overlayElement.className = 'modal-overlay fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center opacity-0 pointer-events-none transition-opacity duration-300';
    
    // 创建弹窗容器
    this.modalElement = document.createElement('div');
    this.modalElement.className = 'modal-container bg-card rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto overflow-x-hidden transform scale-95 opacity-0 transition-all duration-300 z-50 px-4 sm:px-6';
    
    // 构建弹窗HTML结构
    this.modalElement.innerHTML = `
      <div class="modal-header py-4 border-b flex justify-between items-center">
        <h2 class="text-2xl font-bold" id="modal-title">${this.config.title}</h2>
        <button class="modal-close text-gray-500 hover:text-gray-700 focus:outline-none" id="modal-close">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <div class="modal-body py-6" id="modal-content">
        <div id="video-list-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <!-- 视频列表将通过JavaScript动态生成 -->
        </div>
      </div>
    `;
    
    // 将弹窗添加到页面
    this.overlayElement.appendChild(this.modalElement);
    document.body.appendChild(this.overlayElement);
  }
  
  /**
   * 生成视频卡片HTML
   * @param {Object} video - 视频信息
   * @param {number} index - 视频索引
   * @returns {string} 视频卡片HTML
   */
  generateVideoCard(video, index) {
    // 检查是否需要显示合作角标
    const hasCooperationBadge = video.cooperation || false;
    const badgeHTML = hasCooperationBadge ? `
      <div class="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full transform -rotate-12">
        合作
      </div>
    ` : '';
    
    return `
      <div class="bg-card rounded-2xl shadow-lg from-purple-50 to-indigo-100 p-4 fade-in" style="animation-delay: ${index * 0.1}s;">
        <div class="bg-gray-200 rounded-xl w-full h-48 mb-4 overflow-hidden relative">
          <img src="${video.cover}" class="w-full h-full object-cover transition-transform duration-500 hover:scale-105">
          ${badgeHTML}
        </div>
        <div class="flex justify-between items-center">
          <div>
            <h3 class="font-bold text-lg line-clamp-2">${video.title}</h3>
            <p class="text-gray-600 text-sm line-clamp-2">${video.description}</p>
          </div>
          <a href="${video.url}" target="_blank" rel="noopener noreferrer" class="p-2 bg-gray-900 text-white rounded-full hover:bg-gray-700 inline-flex items-center justify-center transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
        </div>
      </div>
    `;
  }
  
  /**
   * 渲染视频列表
   */
  renderVideoList() {
    const videoListContainer = this.modalElement.querySelector('#video-list-container');
    if (!videoListContainer) return;
    
    // 清空容器
    videoListContainer.innerHTML = '';
    
    // 创建文档片段，减少DOM重绘
    const fragment = document.createDocumentFragment();
    
    // 渲染所有视频卡片
    this.videos.forEach((video, index) => {
      const cardElement = document.createElement('div');
      cardElement.innerHTML = this.generateVideoCard(video, index);
      fragment.appendChild(cardElement.firstElementChild);
    });
    
    // 一次性添加到DOM
    videoListContainer.appendChild(fragment);
  }
  
  /**
   * 添加事件监听
   */
  addEventListeners() {
    // 关闭按钮点击事件
    const closeButton = this.modalElement.querySelector('#modal-close');
    closeButton.addEventListener('click', () => {
      this.close();
    });
    
    // 遮罩层点击事件（如果配置允许）
    if (this.config.closeOnClickOutside) {
      this.overlayElement.addEventListener('click', (e) => {
        if (e.target === this.overlayElement) {
          this.close();
        }
      });
    }
    
    // ESC键关闭事件
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }
  
  /**
   * 显示弹窗
   */
  show() {
    try {
      // 直接使用配置文件中的视频数据
      this.videos = siteConfig.videos;
      // 渲染视频列表
      this.renderVideoList();
      
      // 显示弹窗
      this.overlayElement.classList.remove('opacity-0', 'pointer-events-none');
      this.modalElement.classList.remove('scale-95', 'opacity-0');
      this.modalElement.classList.add('scale-100', 'opacity-100');
      this.isOpen = true;
      
      // 添加红色警告条
      const modalBody = this.modalElement.querySelector('.modal-body');
      if (modalBody) {
        // 检查是否已经存在警告条
        let warningBar = this.modalElement.querySelector('.warning-bar');
        // 如果已经存在，先移除
        if (warningBar) {
          warningBar.remove();
        }
        
        // 创建新的警告条
        warningBar = document.createElement('div');
        warningBar.className = 'warning-bar bg-red-100 border-l-4 border-red-500 text-red-700 p-3 rounded-md mt-1 mb-6';
        warningBar.innerHTML = '<p class="text-sm">由于哔哩哔哩开放平台暂不支持个人开发者，本模块功能暂未实现</p>';
        
        // 将警告条添加到modal-body的开头
        const videoListContainer = modalBody.querySelector('#video-list-container');
        if (videoListContainer) {
          modalBody.insertBefore(warningBar, videoListContainer);
        } else {
          modalBody.appendChild(warningBar);
        }
      }
      
      // 禁止页面滚动
      document.body.style.overflow = 'hidden';
    } catch (error) {
      console.error('显示视频列表失败:', error);
    }
  }
  

  
  /**
   * 关闭弹窗
   */
  close() {
    // 隐藏弹窗
    this.overlayElement.classList.add('opacity-0', 'pointer-events-none');
    this.modalElement.classList.add('scale-95', 'opacity-0');
    this.modalElement.classList.remove('scale-100', 'opacity-100');
    this.isOpen = false;
    
    // 恢复页面滚动
    document.body.style.overflow = 'auto';
  }
  
  /**
   * 切换弹窗显示状态
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.show();
    }
  }
}