import { BaseCard } from './BaseCard.js';
import siteConfig from '../config.js';

/**
 * 评论卡片 - 轮播模式
 * 多条留言自动轮播切换，1x1 卡片内完整显示
 */
export class CommentCard extends BaseCard {
  constructor(config = {}) {
    super({
      id: config.id || 'comment-card',
      classes: 'bg-gradient-to-br from-blue-50 to-cyan-100',
      ...config
    });

    // 从全局配置读取留言列表和轮播间隔
    const cfg = siteConfig.comments || {};
    this.comments = (cfg.list && cfg.list.length) ? cfg.list : [
      { text: '承接干声修对业务，原创曲/填词曲/合唱企划欢迎戳我~', date: '2025/9/13' },
      { text: 'Hello, Sekai', date: '2025/10/25' }
    ];
    this.currentIndex = 0;
    this.timer = null;
    this.interval = cfg.carouselInterval || 5000; // 默认 5 秒
  }

  getContent() {
    const comment = this.comments[0] || { text: '', date: '' };
    return `
      <div class="flex justify-between items-start flex-shrink-0">
        <div class="bg-gray-500 rounded-xl w-10 h-10 mr-3 flex items-center justify-center p-1">
          <i class="fa-solid fa-comment text-white" style="font-size: 100%;"></i>
        </div>
        <a href="${siteConfig.socialLinks.qqGroup}" target="_blank" rel="noopener noreferrer" class="p-2 bg-gray-900 text-white rounded-full hover:bg-gray-700 inline-flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </a>
      </div>
      <div class="flex-1 min-h-0 flex flex-col justify-center relative overflow-hidden">
        <div id="comment-slide-container" class="comment-slide-container w-full">
          <div class="comment-slide" data-index="0">
            <p class="comment-text italic text-base leading-relaxed">${comment.text}</p>
            <div class="comment-date text-sm mt-2 opacity-70">${comment.date}</div>
          </div>
        </div>
      </div>
      <div class="flex justify-center gap-1.5 flex-shrink-0">
        ${this.comments.map((_, i) => `
          <span class="comment-dot w-1.5 h-1.5 rounded-full transition-all ${i === 0 ? 'bg-gray-800 w-4' : 'bg-gray-400'}" data-index="${i}"></span>
        `).join('')}
      </div>
    `;
  }

  /**
   * 启动轮播
   */
  startCarousel() {
    if (this.comments.length <= 1) return;
    this.stopCarousel();
    this.timer = setInterval(() => {
      this.nextSlide();
    }, this.interval);
  }

  /**
   * 停止轮播
   */
  stopCarousel() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * 切换到下一条
   */
  nextSlide() {
    const nextIndex = (this.currentIndex + 1) % this.comments.length;
    this.goToSlide(nextIndex);
  }

  /**
   * 切换到指定位置
   */
  goToSlide(index) {
    if (index === this.currentIndex) return;

    const container = document.getElementById('comment-slide-container');
    const dots = document.querySelectorAll('.comment-dot');
    if (!container) return;

    const nextComment = this.comments[index];

    // 创建新 slide，从下方滑入
    const newSlide = document.createElement('div');
    newSlide.className = 'comment-slide absolute w-full left-0 transition-all duration-500 ease-out';
    newSlide.style.top = '100%';
    newSlide.style.opacity = '0';
    newSlide.innerHTML = `
      <p class="comment-text italic text-base leading-relaxed">${nextComment.text}</p>
      <div class="comment-date text-sm mt-2 opacity-70">${nextComment.date}</div>
    `;
    container.appendChild(newSlide);

    // 强制 reflow
    // eslint-disable-next-line no-unused-expressions
    newSlide.offsetHeight;

    // 当前 slide 向上滑出
    const currentSlide = container.querySelector('.comment-slide:not([style*="top"])');
    if (currentSlide) {
      currentSlide.style.position = 'absolute';
      currentSlide.style.top = '0';
      currentSlide.style.left = '0';
      currentSlide.style.width = '100%';
      requestAnimationFrame(() => {
        currentSlide.style.top = '-100%';
        currentSlide.style.opacity = '0';
        currentSlide.style.transition = 'all 0.5s ease-out';
      });
    }

    // 新 slide 滑入
    requestAnimationFrame(() => {
      newSlide.style.top = '0';
      newSlide.style.opacity = '1';
    });

    // 清理旧 slide
    setTimeout(() => {
      if (currentSlide && currentSlide.parentNode) {
        currentSlide.parentNode.removeChild(currentSlide);
      }
      newSlide.style.position = '';
      newSlide.style.top = '';
      newSlide.style.left = '';
      newSlide.style.width = '';
      newSlide.style.opacity = '';
      newSlide.style.transition = '';
    }, 550);

    // 更新指示点
    dots.forEach((dot, i) => {
      if (i === index) {
        dot.classList.add('bg-gray-800', 'w-4');
        dot.classList.remove('bg-gray-400');
      } else {
        dot.classList.remove('bg-gray-800', 'w-4');
        dot.classList.add('bg-gray-400');
      }
    });

    this.currentIndex = index;
  }

  /**
   * 生命周期：挂载后启动轮播
   */
  onMount() {
    this.startCarousel();
  }

  /**
   * 生命周期：卸载时停止
   */
  onUnmount() {
    this.stopCarousel();
  }
}
