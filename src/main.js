import './style.css'
import { CardManager } from './js/components/CardManager.js'
import { VideoListModal } from './js/components/VideoListModal.js'
import { updateAllFanCounts } from './js/site.js'
import { updateHeader, updateFooter } from './js/header.js'

// 动态加载高德地图API
function loadAMapAPI() {
  return new Promise((resolve, reject) => {
    // 检查是否已经加载过
    if (window.AMap) {
      resolve(window.AMap);
      return;
    }

    // 创建script标签
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.crossOrigin = 'anonymous'; // 处理跨域问题
    script.src = 'https://webapi.amap.com/maps?v=2.0&key=f79674766531d46a40852dc77860ba25';
    
    // 检查AMap是否已经在全局存在
    const checkAMap = () => {
      if (window.AMap) {
        resolve(window.AMap);
      }
    };
    
    // 监听地图API加载完成事件
    script.onload = () => {
      // 地图API加载完成后立即检查
      checkAMap();
      // 为了确保AMap完全初始化，再延迟100ms检查一次
      setTimeout(checkAMap, 100);
    };
    
    // 监听错误事件
    script.onerror = () => {
      reject(new Error('Failed to load AMap API'));
    };
    
    // 添加到页面中
    document.head.appendChild(script);
    
    // 设置超时机制
    setTimeout(() => {
      if (!window.AMap) {
        reject(new Error('AMap failed to initialize within timeout'));
      }
    }, 5000); // 5秒超时
  });
}

// 初始化地图卡片
async function initMapCard(cardManager) {
  try {
    // 查找地图卡片
    const mapCard = cardManager.cards.find(card => card.constructor.name === 'MapCard');
    if (!mapCard || typeof mapCard.initMap !== 'function') {
      return;
    }
    
    // 确保DOM完全渲染完成
    await new Promise(resolve => {
      if (document.readyState === 'complete') {
        resolve();
      } else {
        window.addEventListener('load', resolve);
      }
    });
    
    // 等待地图API加载完成
    await loadAMapAPI();
    
    // 确保地图容器已经存在于DOM中
    const mapContainer = document.getElementById('amap-container');
    if (!mapContainer) {
      // 如果地图容器不存在，延迟500ms再尝试
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // 初始化地图
    mapCard.initMap();
  } catch (error) {
    console.error('地图加载或初始化失败:', error);
  }
}

// 初始化网站功能
document.addEventListener('DOMContentLoaded', async function () {
  // 更新页面头部和页脚
  updateHeader();
  updateFooter();
  
  // 初始化卡片管理器
  const cardManager = new CardManager()

  // 创建所有卡片
  cardManager.createAllCards()

  // 渲染所有卡片到网格容器
  await cardManager.renderTo('.grid-container')
  
  // 添加拖拽功能
  const container = document.querySelector('.grid-container')
  let draggables = document.querySelectorAll('.draggable-card')
  
  // 缓存容器样式信息
  const containerComputed = getComputedStyle(container)
  const columnGap = parseFloat(containerComputed.columnGap) || 0
  const rowGap = parseFloat(containerComputed.rowGap) || 0
  
  // 为每个可拖拽元素添加索引属性
  draggables.forEach((draggable, index) => {
    draggable.setAttribute('data-index', index)
    
    // 添加淡入动画延迟
    draggable.style.animationDelay = `${index * 0.1}s`
    draggable.classList.add('fade-in')

    // 添加拖拽事件
    draggable.addEventListener('dragstart', (e) => {
      const draggedItem = draggable
      const dragStartIndex = parseInt(draggedItem.getAttribute('data-index'))
      draggedItem.classList.add('dragging')
      
      // 创建占位元素
      const placeholder = document.createElement('div')
      placeholder.className = 'draggable-card placeholder'
      placeholder.style.width = draggedItem.offsetWidth + 'px'
      placeholder.style.height = draggedItem.offsetHeight + 'px'
      
      // 添加缩放动画
      setTimeout(() => {
        draggedItem.classList.add('dragging-active')
      }, 0)
      
      // 设置拖拽数据
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/html', draggedItem.innerHTML)
      
      // 保存拖拽相关信息到元素上
      draggedItem._placeholder = placeholder
      draggedItem._dragStartIndex = dragStartIndex
    })

    draggable.addEventListener('dragend', (e) => {
      const draggedItem = e.target
      // 移除所有拖拽相关的类
      draggedItem.classList.remove('dragging', 'dragging-active')
      
      // 移除所有占位符
      container.querySelectorAll('.placeholder').forEach(ph => ph.remove())
      
      // 移除所有挤压效果
      draggables.forEach(card => {
        card.classList.remove('shift-left', 'shift-right', 'shift-up', 'shift-down')
        card.style.removeProperty('transition')
      })
      
      // 清理自定义属性
      delete draggedItem._placeholder
      delete draggedItem._dragStartIndex
    })
  })
  
  // 容器事件处理
  container.addEventListener('dragover', (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    
    const target = e.target.closest('.draggable-card:not(.dragging)')
    const draggedItem = container.querySelector('.draggable-card.dragging')
    
    if (target && draggedItem && draggedItem._placeholder) {
      // 移除现有的占位符
      container.querySelectorAll('.placeholder').forEach(ph => ph.remove())
      
      // 计算放置位置
      const rect = target.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const horizontalMidpoint = rect.width / 2
      const verticalMidpoint = rect.height / 2
      
      // 根据鼠标位置决定插入方向
      const insertAfter = (x > horizontalMidpoint && y > verticalMidpoint) || 
                          (x > horizontalMidpoint && y <= verticalMidpoint) ||
                          (x <= horizontalMidpoint && y > verticalMidpoint)
      
      // 应用挤压效果到其他卡片
      applyShiftEffect(target, insertAfter, columnGap, rowGap)
      
      // 插入占位符
      if (insertAfter) {
        target.parentNode.insertBefore(draggedItem._placeholder, target.nextSibling)
      } else {
        target.parentNode.insertBefore(draggedItem._placeholder, target)
      }
    }
  })
  
  container.addEventListener('dragenter', (e) => {
    e.preventDefault()
  })
  
  container.addEventListener('drop', (e) => {
    e.preventDefault()
    
    const draggedItem = container.querySelector('.draggable-card.dragging')
    if (draggedItem && draggedItem._placeholder && draggedItem._placeholder.parentNode) {
      // 交换元素位置
      draggedItem._placeholder.parentNode.insertBefore(draggedItem, draggedItem._placeholder)
      
      // 更新所有卡片的索引
      updateCardIndices()
      
      // 更新draggables集合
      draggables = container.querySelectorAll('.draggable-card')
    }
    
    // 移除占位符
    container.querySelectorAll('.placeholder').forEach(ph => ph.remove())
    
    // 移除挤压效果
    draggables.forEach(card => {
      card.classList.remove('shift-left', 'shift-right', 'shift-up', 'shift-down')
      card.style.removeProperty('transition')
    })
  })

  // 初始化粉丝数更新
  updateAllFanCounts()
  
  // 初始化地图
  initMapCard(cardManager);
  
  // 初始化视频列表弹窗
  const videoListModal = new VideoListModal();
  
  // 添加"更多视频"卡片点击事件监听
  function addMoreVideoCardListener() {
    const moreVideoCard = document.getElementById('more-video-card');
    if (moreVideoCard) {
      moreVideoCard.addEventListener('click', () => {
        videoListModal.show();
      });
    }
  }
  
  // 初始添加事件监听
  addMoreVideoCardListener();
  
  // 监听DOM变化，确保动态添加的卡片也能触发事件
  const observer = new MutationObserver(() => {
    addMoreVideoCardListener();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
})

// 应用挤压效果到其他卡片
function applyShiftEffect(target, insertAfter, columnGap, rowGap) {
  const container = document.querySelector('.grid-container')
  const containerRect = container.getBoundingClientRect()
  const allCards = Array.from(document.querySelectorAll('.draggable-card:not(.dragging)'))
  const targetIndex = Array.from(target.parentNode.children).indexOf(target)
  
  // 移除之前的挤压效果
  allCards.forEach(card => {
    card.classList.remove('shift-left', 'shift-right', 'shift-up', 'shift-down')
  })
  
  // 计算每列的宽度 (使用缓存的间隙值)
  const cardRect = target.getBoundingClientRect()
  const cardWidth = cardRect.width
  const cardHeight = cardRect.height
  const columnWidth = cardWidth + columnGap
  const rowHeight = cardHeight + rowGap
  
  // 计算目标卡片所在的行列
  const relativeLeft = cardRect.left - containerRect.left
  const relativeTop = cardRect.top - containerRect.top
  const targetCol = Math.round(relativeLeft / columnWidth)
  const targetRow = Math.round(relativeTop / rowHeight)
  
  // 查找网格中的空位
  const occupiedPositions = new Set()
  allCards.forEach(card => {
    if (card === target || card.classList.contains('placeholder')) return
    
    const rect = card.getBoundingClientRect()
    const left = rect.left - containerRect.left
    const top = rect.top - containerRect.top
    const col = Math.round(left / columnWidth)
    const row = Math.round(top / rowHeight)
    occupiedPositions.add(`${col},${row}`)
  })
  
  // 为其他卡片应用挤压效果
  allCards.forEach(card => {
    if (card === target || card.classList.contains('placeholder')) return
    
    const cardRect = card.getBoundingClientRect()
    const relativeLeft = cardRect.left - containerRect.left
    const relativeTop = cardRect.top - containerRect.top
    const cardCol = Math.round(relativeLeft / columnWidth)
    const cardRow = Math.round(relativeTop / rowHeight)
    
    // 添加过渡效果
    card.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    
    // 检查周围是否有空位可以移动
    const adjacentPositions = [
      { col: cardCol - 1, row: cardRow, class: 'shift-left' },   // 左
      { col: cardCol + 1, row: cardRow, class: 'shift-right' },  // 右
      { col: cardCol, row: cardRow - 1, class: 'shift-up' },     // 上
      { col: cardCol, row: cardRow + 1, class: 'shift-down' }    // 下
    ]
    
    // 查找可以移动到的空位
    let moved = false
    for (const pos of adjacentPositions) {
      const positionKey = `${pos.col},${pos.row}`
      if (!occupiedPositions.has(positionKey)) {
        card.classList.add(pos.class)
        moved = true
        break
      }
    }
    
    // 如果周围没有空位，则根据相对位置应用挤压效果
    if (!moved) {
      if (cardRow === targetRow) {
        // 同一行
        if (cardCol > targetCol) {
          // 右侧卡片向右移动
          card.classList.add('shift-right')
        } else if (cardCol < targetCol) {
          // 左侧卡片向左移动
          card.classList.add('shift-left')
        }
      } else if (cardRow > targetRow) {
        // 下方行
        if (Math.abs(cardCol - targetCol) <= 1) {
          // 下方相邻列的卡片向下移动
          card.classList.add('shift-down')
        }
      } else if (cardRow < targetRow) {
        // 上方行
        if (Math.abs(cardCol - targetCol) <= 1) {
          // 上方相邻列的卡片向上移动
          card.classList.add('shift-up')
        }
      }
    }
  })
}

// 更新所有卡片的索引
function updateCardIndices() {
  const cards = document.querySelectorAll('.draggable-card')
  cards.forEach((card, index) => {
    card.setAttribute('data-index', index)
  })
}