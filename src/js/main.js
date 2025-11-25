import { CardManager } from './components/CardManager.js';
import { updateAllFanCounts } from './site.js';

// 初始化卡片管理器
const cardManager = new CardManager();

// 创建所有卡片
cardManager.createAllCards();

// 渲染所有卡片到网格容器
cardManager.renderTo('.grid-container');

// 初始化网站功能
document.addEventListener('DOMContentLoaded', function() {
  // 添加拖拽功能
  const draggables = document.querySelectorAll('.draggable-card');
  draggables.forEach((draggable, index) => {
    // 添加淡入动画延迟
    draggable.style.animationDelay = `${index * 0.1}s`;
    draggable.classList.add('fade-in');
    
    // 添加拖拽事件
    draggable.addEventListener('dragstart', () => {
      draggable.classList.add('opacity-50');
      setTimeout(() => draggable.classList.add('scale-95'), 0);
    });

    draggable.addEventListener('dragend', () => {
      draggable.classList.remove('opacity-50', 'scale-95');
    });
  });
  
  // 初始化粉丝数更新
  updateAllFanCounts();
});