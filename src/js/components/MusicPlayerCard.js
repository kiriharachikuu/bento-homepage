import { BaseCard } from './BaseCard.js';
import siteConfig from '../config.js';

/**
 * 网易云音乐播放器卡片
 */
export class MusicPlayerCard extends BaseCard {
  constructor(config = {}) {
    const rowSpan = config.rowSpan === 2 || config.rowSpan === '2' ? 'row-span-2' : '';
    const classes = [rowSpan, 'card-music-player', config.classes || ''].filter(Boolean).join(' ');

    super({
      id: config.id || 'music-player-card',
      classes,
      ...config
    });

    this.playlistId = config.playlistId || siteConfig.musicPlayer?.playlistId || '17479746916';
  }

  /**
   * 获取卡片内容
   * 播放器铺满整个卡片
   */
  getContent() {
    return `
      <iframe 
        frameborder="no" 
        border="0" 
        marginwidth="0" 
        marginheight="0" 
        class="w-full flex-1 min-h-0"
        src="//music.163.com/outchain/player?type=0&id=${this.playlistId}&auto=0&height=430">
      </iframe>
    `;
  }
}
