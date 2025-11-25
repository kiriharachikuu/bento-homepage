import { BaseCard } from './BaseCard.js';
import siteConfig from '../config.js';

/**
 * 网易云音乐播放器卡片
 */
export class MusicPlayerCard extends BaseCard {
  /**
   * 构造函数
   * @param {Object} config - 卡片配置
   */
  constructor(config) {
    super({
      id: 'music-player-card',
      classes: 'md:row-span-2',
      ...config
    });
  }

  /**
   * 获取卡片内容
   * @returns {string} 卡片内容HTML
   */
  getContent() {
    const playlistId = siteConfig.musicPlayer.playlistId;
    return `
      <div class="flex flex-col h-full">
        
        <div class="flex-grow">
          <iframe 
            frameborder="no" 
            border="0" 
            marginwidth="0" 
            marginheight="0" 
            width="100%" 
            height="650" 
            src="//music.163.com/outchain/player?type=0&id=${playlistId}&auto=1&height=430">
          </iframe>
        </div>
        
        <div class="mt-4 text-center text-sm text-gray-600">
          精选音乐播放列表
        </div>
      </div>
    `;
  }
}