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
      <div class="flex items-start mb-20">
        <div class="relative mr-4">
          <div class="bg-card rounded-xl w-16 h-16"></div>
          <div class="absolute inset-0 rounded-xl bg-green-400 opacity-70 pulse-animation">
            <img src="/img/84007943719010668e3e16e8196f029858bf7b12.jpg" class="w-full h-full rounded-xl object-cover" />
          </div>
        </div>
        <div>
          <h1 class="text-3xl font-bold">${siteConfig.user.name}</h1>
          <p style="color: var(--gray-600)">${siteConfig.user.title}</p>
        </div>
      </div>
      <p class="mb-6 leading-relaxed" style="color: var(--gray-700)">
        ${siteConfig.user.description}
      </p>
      <a href="${siteConfig.user.learnMoreLink}" class="btn-23">
        <span class="text">了解更多</span>
        <span class="marquee" aria-hidden>More</span>
      </a>
    `;
  }
}