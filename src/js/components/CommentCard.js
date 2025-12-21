import { BaseCard } from './BaseCard.js';
import siteConfig from '../config.js';

/**
 * 评论卡片
 */
export class CommentCard extends BaseCard {
  /**
   * 构造函数
   * @param {Object} config - 卡片配置
   */
  constructor(config) {
    super({
      id: 'comment-card',
      classes: 'bg-gradient-to-br from-blue-50 to-cyan-100',
      ...config
    });
  }

  /**
   * 获取卡片内容
   * @returns {string} 卡片内容HTML
   */
  getContent() {
    return `
      <div class="flex justify-between items-start mb-4">
        <div class="bg-gray-500 rounded-xl w-10 h-10 mr-3 flex items-center justify-center p-1">
          <i class="fa-solid fa-comment text-white" style="font-size: 100%;"></i>
        </div>
        <a href="${siteConfig.socialLinks.qqGroup}" target="_blank" rel="noopener noreferrer" class="p-2 bg-gray-900 text-white rounded-full hover:bg-gray-700 inline-flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </a>
      </div>
      <p class="comment-text italic">承接干声修对业务，原创曲/填词曲/合唱企划欢迎戳我~</p>
      <div class="comment-date text-sm">2025/9/13</div>
      <br />
      <p class="comment-text italic">Hello, Sekai</p>
      <div class="comment-date text-sm">2025/10/25</div>
    `;
  }
}