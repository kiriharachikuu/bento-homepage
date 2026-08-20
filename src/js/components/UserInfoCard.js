import { BaseCard } from './BaseCard.js';
import siteConfig from '../config.js';

/**
 * 用户信息卡片
 */
export class UserInfoCard extends BaseCard {
  /**
   * 构造函数
   * @param {Object} config - 卡片配置
   */
  constructor(config) {
    super({
      id: 'user-info-card',
      classes: 'md:col-span-2 fade-in',
      ...config
    });
  }

  /**
   * 获取卡片内容
   * @returns {string} 卡片内容HTML
   */
  getContent() {
    return `
      <div class="flex items-center gap-4 flex-shrink-0">
        <div class="relative w-14 h-14">
          <div class="absolute inset-0 rounded-xl bg-green-400 opacity-70 pulse-animation"></div>
          <img src="${siteConfig.user.avatar}" class="relative w-full h-full rounded-xl object-cover" loading="lazy" />
        </div>
        <div class="min-w-0 flex-1">
          <h1 class="text-2xl font-bold truncate">${siteConfig.user.name}</h1>
          <p class="truncate" style="color: var(--gray-600)">${siteConfig.user.title}</p>
        </div>
      </div>
      <p class="flex-1 min-h-0 leading-relaxed overflow-hidden line-clamp-3" style="color: var(--gray-700)">
        ${siteConfig.user.description}
      </p>
      <div class="flex-shrink-0">
        <a href="${siteConfig.user.learnMoreLink}" class="btn-23">
          <span class="text">了解更多</span>
          <span class="marquee" aria-hidden>More</span>
        </a>
      </div>
    `;
  }
}
