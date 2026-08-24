import { BaseCard } from './BaseCard.js';
import { updateSingleFanCount } from '../fans.js';

const DEFAULT_ICON = `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
  <path d="M512 128c-212 0-384 172-384 384s172 384 384 384 384-172 384-384-172-384-384-384z m0 640c-141.4 0-256-114.6-256-256s114.6-256 256-256 256 114.6 256 256-114.6 256-256 256z m0-384c-70.7 0-128 57.3-128 128s57.3 128 128 128 128-57.3 128-128-57.3-128-128-128z" fill="#ffffff"/>
</svg>`;

/**
 * 粉丝数卡片基类
 */
export class FollowerCard extends BaseCard {
  /**
   * 构造函数
   * @param {Object} config - 卡片配置
   * @param {string} config.id - 卡片 ID
   * @param {string} config.platform - 平台标识（用于 DOM 元素 ID）
   * @param {string} config.title - 平台中文标题
   * @param {string} [config.icon] - 平台图标 SVG
   * @param {string} [config.color] - 平台颜色类（默认 pink）
   * @param {string} [config.homepageUrl] - 主页链接
   * @param {string} config.apiUrl - 粉丝数 API 地址
   */
  constructor(config = {}) {
    const color = config.color || 'pink';
    const bgClass = `bg-gradient-to-br from-${color}-50 to-${color}-100`;
    const classes = [bgClass, 'follower-card', config.classes || ''].filter(Boolean).join(' ');

    super({
      id: config.id || `${config.platform || 'follower'}-card`,
      classes,
      ...config
    });

    this.platform = config.platform || 'follower';
    this.title = config.title || config.platform || '粉丝';
    this.icon = config.icon || DEFAULT_ICON;
    this.color = color;
    this.homepageUrl = config.homepageUrl || '#';
    this.apiUrl = config.apiUrl || '';
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

  /**
   * 生命周期：挂载后获取粉丝数
   */
  onMount() {
    if (this.apiUrl) {
      updateSingleFanCount(this.platform, this.apiUrl);
    }
  }
}
