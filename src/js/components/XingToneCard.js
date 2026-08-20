import { BaseCard } from './BaseCard.js';

/**
 * XingTone 入口卡片
 */
export class XingToneCard extends BaseCard {
  constructor() {
    super({
      id: 'xingtone-card',
      classes: 'from-purple-50 to-indigo-100'
    });
  }

  getContent() {
    return `
      <div class="flex-1 min-h-0 rounded-xl overflow-hidden relative bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
        <div class="text-center text-white">
          <div class="text-4xl font-bold mb-2">XingTone</div>
          <div class="text-sm opacity-90">AI 音色创作平台</div>
        </div>
      </div>
      <div class="flex justify-between items-center gap-3 flex-shrink-0">
        <div class="min-w-0">
          <h3 class="font-bold text-base truncate">XingTone</h3>
          <p class="text-sm truncate" style="color: var(--gray-600)">AI 驱动的音色创作工具</p>
        </div>
        <a href="https://xingtone.site/" target="_blank" rel="noopener noreferrer" class="p-2 bg-gray-900 text-white rounded-full hover:bg-gray-700 inline-flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    `;
  }
}
