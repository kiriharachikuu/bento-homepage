import { BaseCard } from './BaseCard.js';
import siteConfig from '../config.js';

/**
 * 视频作品卡片
 */
export class VideoCard extends BaseCard {
  /**
   * 构造函数
   * - 新方式：new VideoCard(config)，config.videoIndex 决定用第几个视频
   * - 旧方式（兼容）：new VideoCard(video, index)
   * @param {Object} configOrVideo - 配置对象或视频对象
   * @param {number} [index] - 视频索引（旧方式第二参数）
   */
  constructor(configOrVideo, index) {
    const isLegacyCall = index !== undefined || (configOrVideo && configOrVideo.title !== undefined && configOrVideo.cover !== undefined && configOrVideo.url !== undefined);

    let videoData;
    let videoIndex;
    let cardConfig = {};

    if (isLegacyCall) {
      // 旧调用方式：new VideoCard(video, index)
      videoData = configOrVideo;
      videoIndex = index;
      cardConfig = {
        id: `video-card-${videoIndex}`,
        classes: 'from-purple-50 to-indigo-100'
      };
    } else {
      // 新调用方式：new VideoCard(config)
      cardConfig = configOrVideo || {};
      videoIndex = cardConfig.videoIndex != null ? cardConfig.videoIndex : 0;
      videoData = (siteConfig.videos && siteConfig.videos[videoIndex]) || null;
    }

    const colSpan = cardConfig.colSpan === 2 || cardConfig.colSpan === '2' ? 'md:col-span-2' : '';
    const classes = [colSpan, cardConfig.classes || 'from-purple-50 to-indigo-100'].filter(Boolean).join(' ');

    super({
      id: cardConfig.id || `video-card-${videoIndex}`,
      classes,
      ...cardConfig
    });

    this.video = videoData;
    this.index = videoIndex;
  }

  /**
   * 获取卡片内容
   * @returns {string} 卡片内容HTML
   */
  getContent() {
    // 视频不存在，显示占位
    if (!this.video) {
      return `
        <div class="flex-1 min-h-0 rounded-xl overflow-hidden relative bg-gray-200 flex items-center justify-center">
          <span class="text-gray-500 text-sm">视频不存在</span>
        </div>
        <div class="flex justify-between items-end gap-3 flex-shrink-0">
          <div class="min-w-0">
            <h3 class="font-bold text-base truncate">—</h3>
            <p class="text-sm truncate" style="color: var(--gray-600)"></p>
          </div>
        </div>
      `;
    }

    const hasCooperationBadge = this.video.cooperation || false;
    const badgeHTML = hasCooperationBadge ? `
      <div class="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full transform -rotate-12 z-10">
        合作
      </div>
    ` : '';
    
    return `
      <div class="flex-1 min-h-0 rounded-xl overflow-hidden relative bg-gray-200">
        <img src="${this.video.cover}" class="w-full h-full object-cover" loading="lazy" alt="${this.video.title}" />
        ${badgeHTML}
      </div>
      <div class="flex justify-between items-end gap-3 flex-shrink-0">
        <div class="min-w-0">
          <h3 class="font-bold text-base truncate">${this.video.title}</h3>
          <p class="text-sm truncate" style="color: var(--gray-600)">${this.video.description || ''}</p>
        </div>
        <a href="${this.video.url}" target="_blank" rel="noopener noreferrer" class="p-2 bg-gray-900 text-white rounded-full hover:bg-gray-700 inline-flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </a>
      </div>
    `;
  }
}
