import { BaseCard } from './BaseCard.js';

/**
 * XingTone 星瞳音乐入口卡片
 * 品牌风格：星瞳紫渐变 + 音符Logo + 产品特色标签
 */
export class XingToneCard extends BaseCard {
  constructor(config = {}) {
    super({
      id: config.id || 'xingtone-card',
      classes: 'card-xingtone',
      ...config
    });
  }

  getContent() {
    return `
      <a href="https://xingtone.chikuu.top/" target="_blank" rel="noopener noreferrer" class="w-full flex-1 min-h-0 rounded-2xl overflow-hidden relative bg-gradient-to-br from-purple-700 via-violet-600 to-fuchsia-500 p-5 flex flex-col justify-between text-white group">
        <!-- 装饰光晕 -->
        <div class="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/10 blur-2xl"></div>
        <div class="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/20 to-transparent"></div>

        <!-- 顶部：Logo + 标题 -->
        <div class="relative z-10 flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ring-white/30 overflow-hidden" style="background: rgba(255,255,255,0.15);">
            <img src="/img/xingtone-logo.png" alt="XingTone" class="w-full h-full object-cover">
          </div>
          <div class="min-w-0">
            <div class="text-lg font-bold leading-tight">XingTone</div>
            <div class="text-xs text-white/70 leading-tight">瞳瞳音乐</div>
          </div>
        </div>

        <!-- 中部：slogan -->
        <div class="relative z-10">
          <div class="text-base font-medium leading-snug mb-3">多端一致的<br>沉浸听歌体验</div>
          <div class="flex flex-wrap gap-1.5">
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm">全屏歌词</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm">多端同步</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm">亮暗模式</span>
          </div>
        </div>

        <!-- 底部：进入按钮 -->
        <div class="relative z-10 flex items-center justify-between">
          <div class="text-xs text-white/60">xingtone.site</div>
          <div class="flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-full group-hover:scale-105 transition" style="background: #fff; color: #7c3aed;">
            进入站点
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </div>
        </div>
      </a>
    `;
  }
}
