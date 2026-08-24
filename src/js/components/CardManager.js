import { cardTemplates, getDefaultCardsConfig } from './cardTemplates/index.js';
import { Modal } from './Modal.js';
import siteConfig from '../config.js';

/**
 * 卡片管理器
 */
export class CardManager {
  /**
   * 构造函数
   */
  constructor() {
    this.cards = [];
  }

  /**
   * 创建所有卡片（配置驱动）
   */
  createAllCards() {
    const cardsConfig = (siteConfig.cards && siteConfig.cards.length > 0)
      ? siteConfig.cards
      : getDefaultCardsConfig();

    // 过滤启用的卡片，按 order 排序
    const sortedConfigs = cardsConfig
      .filter(item => item.enabled !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    // 遍历创建卡片
    sortedConfigs.forEach((cardItem, index) => {
      const template = cardTemplates[cardItem.type];
      if (!template) {
        console.warn(`未找到卡片模板: ${cardItem.type}`);
        return;
      }
      try {
        const card = template.create(cardItem.config || {}, index);
        this.cards.push(card);
      } catch (e) {
        console.error(`创建卡片失败: ${cardItem.id || cardItem.type}`, e);
      }
    });
  }

  /**
   * 渲染所有卡片到指定容器
   * @param {string} containerSelector - 容器选择器
   */
  renderTo(containerSelector) {
    // 优先使用home-page容器
    const container = document.querySelector('#home-page') || document.querySelector(containerSelector);
    if (!container) {
      console.error(`未找到容器: ${containerSelector}`);
      return;
    }

    // 清空容器
    container.innerHTML = '';
    
    // 创建文档片段，减少DOM重绘和回流
    const fragment = document.createDocumentFragment();

    // 渲染所有卡片
    this.cards.forEach(card => {
      if (card.render) {
        const cardElement = document.createElement('div');
        cardElement.innerHTML = card.render();
        // 将卡片内容添加到文档片段
        while (cardElement.firstChild) {
          fragment.appendChild(cardElement.firstChild);
        }
      }
    });

    // 一次性将所有卡片添加到DOM
    container.appendChild(fragment);
    
    // 调用所有卡片的 onMount 生命周期
    this.cards.forEach(card => {
      if (typeof card.onMount === 'function') {
        card.onMount();
      }
    });
    
    // 添加事件监听器
    this.addEventListeners();
  }
  
  /**
   * 添加事件监听器
   */
  addEventListeners() {
    // 初始化弹窗
    const modal = new Modal();
    
    // 为"了解更多"按钮添加点击事件
    const learnMoreButton = document.querySelector('.btn-23');
    if (learnMoreButton) {
      learnMoreButton.addEventListener('click', (e) => {
        e.preventDefault();
        
        // 从配置文件中获取弹窗内容
        const customContent = siteConfig.user.learnMoreContent;
        
        // 显示弹窗
        modal.show({
          title: '了解更多',
          content: customContent
        });
      });
    }
  }
}
