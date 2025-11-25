import { BaseCard } from './BaseCard.js';

/**
 * 视频作品卡片
 */
export class VideoCard extends BaseCard {
  /**
   * 构造函数
   * @param {Object} video - 视频信息
   * @param {number} index - 视频索引
   */
  constructor(video, index) {
    super({
      id: `video-card-${index}`,
      classes: 'bg-white from-purple-50 to-indigo-100'
    });
    this.video = video;
    this.index = index;
  }

  /**
   * 获取卡片内容
   * @returns {string} 卡片内容HTML
   */
  getContent() {
    return `
      <div class="bg-gray-200 border-2 border-dashed rounded-xl w-full h-48 mb-4 overflow-hidden">
        <img src="${this.video.cover}" class="w-full h-full object-cover" />
      </div>
      <div class="flex justify-between items-center">
        <div>
          <h3 class="font-bold text-lg">${this.video.title}</h3>
          <p class="text-gray-600 text-sm">${this.video.description}</p>
        </div>
        <a href="${this.video.url}" target="_blank" rel="noopener noreferrer" class="p-2 bg-gray-900 text-white rounded-full hover:bg-gray-700 inline-flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </a>
      </div>
    `;
  }
}