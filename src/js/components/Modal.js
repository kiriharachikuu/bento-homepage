/**
 * 弹窗组件
 */
export class Modal {
  /**
   * 构造函数
   * @param {Object} config - 弹窗配置
   */
  constructor(config) {
    this.config = {
      id: 'custom-modal',
      title: '详情',
      content: '',
      closeOnClickOutside: true,
      ...config
    };
    
    this.isOpen = false;
    this.modalElement = null;
    this.overlayElement = null;
    
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
    this.modalElement.className = 'modal-container bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto transform scale-95 opacity-0 transition-all duration-300 z-50';
    
    // 构建弹窗HTML结构
    this.modalElement.innerHTML = `
      <div class="modal-header px-6 py-4 border-b flex justify-between items-center">
        <h2 class="text-xl font-bold" id="modal-title">${this.config.title}</h2>
        <button class="modal-close text-gray-500 hover:text-gray-700 focus:outline-none" id="modal-close">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="modal-body px-6 py-4" id="modal-content">
        ${this.config.content}
      </div>
    `;
    
    // 将弹窗添加到页面
    this.overlayElement.appendChild(this.modalElement);
    document.body.appendChild(this.overlayElement);
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
   * @param {Object} options - 可选配置
   */
  show(options = {}) {
    // 更新配置
    if (options.title) {
      this.config.title = options.title;
      const titleElement = this.modalElement.querySelector('#modal-title');
      if (titleElement) {
        titleElement.textContent = options.title;
      }
    }
    
    if (options.content) {
      this.config.content = options.content;
      const contentElement = this.modalElement.querySelector('#modal-content');
      if (contentElement) {
        contentElement.innerHTML = options.content;
      }
    }
    
    // 显示弹窗
    this.overlayElement.classList.remove('opacity-0', 'pointer-events-none');
    this.modalElement.classList.remove('scale-95', 'opacity-0');
    this.modalElement.classList.add('scale-100', 'opacity-100');
    this.isOpen = true;
    
    // 禁止页面滚动
    document.body.style.overflow = 'hidden';
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
   * @param {Object} options - 可选配置
   */
  toggle(options = {}) {
    if (this.isOpen) {
      this.close();
    } else {
      this.show(options);
    }
  }
}