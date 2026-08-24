import { BaseCard } from './BaseCard.js';
import siteConfig from '../config.js';

/**
 * 联系方式卡片
 */
export class ContactCard extends BaseCard {
  /**
   * 构造函数
   * @param {Object} config - 卡片配置
   */
  constructor(config = {}) {
    const colSpan = config.colSpan === 2 || config.colSpan === '2' ? 'md:col-span-2' : '';
    const classes = [colSpan, config.classes || ''].filter(Boolean).join(' ');

    super({
      id: config.id || 'contact-card',
      classes,
      ...config
    });
  }

  /**
   * 获取卡片内容
   * @returns {string} 卡片内容HTML
   */
  getContent() {
    return `
      <h2 class="font-bold text-xl flex-shrink-0">如何联系到我？</h2>
      <p class="flex-1 min-h-0 leading-relaxed overflow-hidden line-clamp-4" style="color: var(--gray-700)">
        ${siteConfig.contactText}
      </p>
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 flex-shrink-0">
        <a href="${siteConfig.contactButtonLink}" class="flex items-center text-sm font-medium bg-gray-900 text-white rounded-full px-4 py-2 hover:bg-gray-700 transition">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
          Read more
        </a>
        <span class="text-gray-500 text-sm">Nov 25, 2025</span>
      </div>
    `;
  }
}
