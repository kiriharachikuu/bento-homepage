import { BaseCard } from './BaseCard.js';

/**
 * 自由内容卡片
 * 支持自定义标题、HTML 内容、背景色、列跨度
 */
export class FreeformCard extends BaseCard {
  constructor(config = {}) {
    const colSpan = config.colSpan === 2 || config.colSpan === '2' ? 'md:col-span-2' : '';
    const bgColor = config.bgColor || '';
    const classes = [colSpan, bgColor, config.classes || ''].filter(Boolean).join(' ');

    super({
      id: config.id || 'freeform-card',
      classes,
      ...config
    });

    this.title = config.title || '';
    this.content = config.content || '';
  }

  getContent() {
    const titleHtml = this.title
      ? `<h2 class="font-bold text-xl flex-shrink-0">${this.title}</h2>`
      : '';

    return `
      ${titleHtml}
      <div class="flex-1 min-h-0 leading-relaxed overflow-auto" style="color: var(--gray-700)">
        ${this.content}
      </div>
    `;
  }
}
