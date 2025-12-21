import { BaseCard } from './BaseCard.js';

/**
 * 粉丝数卡片基类
 */
export class FollowerCard extends BaseCard {
  /**
   * 构造函数
   * @param {Object} config - 卡片配置
   * @param {string} config.platform - 平台名称
   * @param {string} config.title - 平台中文标题
   * @param {string} config.icon - 平台图标SVG
   * @param {string} config.color - 平台颜色类
   * @param {string} config.homepageUrl - 主页链接
   */
  constructor(config) {
    super({
      id: `${config.platform}-follower-card`,
      classes: `bg-gradient-to-br from-${config.color}-50 to-${config.color}-100 follower-card`,
      ...config
    });
    this.platform = config.platform;
    this.title = config.title || config.platform;
    this.icon = config.icon;
    this.color = config.color;
    this.homepageUrl = config.homepageUrl;
  }

  /**
   * 获取卡片内容
   * @returns {string} 卡片内容HTML
   */
  getContent() {
    return `
      <div class="flex flex-col h-full">
        <div>
          <div class="flex items-center mb-4">
            <div class="bg-${this.color}-500 rounded-xl w-10 h-10 mr-3 flex items-center justify-center p-1">
              ${this.icon}
            </div>
            <h3 class="font-bold text-lg">${this.title}</h3>
          </div>
          <div id="${this.platform}" class="text-3xl font-bold mb-2">获取中...</div>
          <div class="follower-label text-sm">粉丝数</div>
        </div>
        <div class="flex justify-between items-center mt-auto">
          <div>
            <h3 class="font-bold text-lg">进入主页</h3>
          </div>
          <a href="${this.homepageUrl}" target="_blank" rel="noopener noreferrer" class="p-2 bg-gray-900 text-white rounded-full hover:bg-gray-700 inline-flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
        </div>
      </div>
    `;
  }
}