import { BaseCard } from './BaseCard.js';

/**
 * 更多视频卡片组件
 */
export class MoreVideoCard extends BaseCard {
  /**
   * 构造函数
   * @param {Object} config - 卡片配置
   */
  constructor(config) {
    super({
      id: 'more-video-card',
      classes: 'bg-white from-purple-50 to-indigo-100 cursor-pointer hover:shadow-xl transition-all duration-300',
      ...config
    });
  }

  /**
   * 获取卡片内容
   * @returns {string} 卡片内容HTML
   */
  getContent() {
    return `
      <div class="bg-gray-200 border-2 border-dashed rounded-xl w-full h-48 mb-4 overflow-hidden">
        <img src="img/418e5134ae74f641796e6a8b8c4fc48328826850.png" class="w-full h-full object-cover">
      </div>
      <div class="flex justify-between items-center">
        <div>
          <h3 class="font-bold text-lg">更多视频</h3>
          <p class="text-gray-600 text-sm">查看更多B站视频更新</p>
        </div>
        <button class="p-2 bg-gray-900 text-white rounded-full hover:bg-gray-700 inline-flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>
    `;
  }
}