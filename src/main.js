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
      console.log('AMap API已经加载，直接返回');
      resolve(window.AMap);
      return;
    }

    // 创建script标签
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.crossOrigin = 'anonymous'; // 处理跨域问题
    script.defer = true; // 添加defer属性，确保脚本按照顺序执行
    script.src = 'https://webapi.amap.com/maps?v=2.0&key=f79674766531d46a40852dc77860ba25';
    
    // 监听地图API加载完成事件
    script.onload = () => {
      console.log('AMap API脚本加载完成');
      // 等待AMap完全初始化
      setTimeout(() => {
        if (window.AMap) {
          console.log('AMap API初始化成功');
          resolve(window.AMap);
        } else {
          console.error('AMap API加载完成但未初始化');
          reject(new Error('AMap API loaded but not initialized'));
        }
      }, 300); // 增加延迟时间，确保AMap完全初始化
    };
    
    // 监听错误事件
    script.onerror = (event) => {
      console.error('AMap API脚本加载失败:', event);
      // 提供降级方案：显示地图加载失败信息
      const mapContainer = document.getElementById('amap-container');
      if (mapContainer) {
        mapContainer.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666; font-size: 14px; padding: 20px; text-align: center;">地图加载失败，可能是网络问题或域名未授权</div>`;
      }
      reject(new Error('Failed to load AMap API'));
    };
    
    // 添加到页面中
    console.log('开始加载AMap API脚本');
    document.head.appendChild(script);
    
    // 设置超时机制
    setTimeout(() => {
      if (!window.AMap) {
        console.error('AMap API加载超时');
        // 提供降级方案
        const mapContainer = document.getElementById('amap-container');
        if (mapContainer) {
          mapContainer.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666; font-size: 14px; padding: 20px; text-align: center;">地图加载超时，可能是网络问题</div>`;
        }
        reject(new Error('AMap failed to initialize within timeout'));
      }
    }, 8000); // 增加超时时间到8秒
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
    let mapContainer = document.getElementById('amap-container');
    if (!mapContainer) {
      // 如果地图容器不存在，延迟重试
      await new Promise(resolve => {
        const checkContainer = () => {
          mapContainer = document.getElementById('amap-container');
          if (mapContainer) {
            resolve();
          } else {
            // 最多重试3次
            if (checkContainer.retryCount === undefined) {
              checkContainer.retryCount = 0;
            }
            checkContainer.retryCount++;
            if (checkContainer.retryCount < 3) {
              setTimeout(checkContainer, 200);
            } else {
              resolve(); // 即使失败也继续，让initMap处理
            }
          }
        };
        checkContainer();
      });
    }
    
    // 初始化地图
    mapCard.initMap();
  } catch (error) {
    console.error('地图加载或初始化失败:', error);
    // 提供降级方案：确保地图容器显示错误信息
    const mapContainer = document.getElementById('amap-container');
    if (mapContainer) {
      mapContainer.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666; font-size: 14px; padding: 20px; text-align: center;">地图加载失败: ${error.message}</div>`;
    }
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
  cardManager.renderTo('.grid-container')
  
  // 添加拖拽功能
  const container = document.querySelector('.grid-container')
  let draggables = document.querySelectorAll('.draggable-card')
  
  // 初始化网格管理器
  const gridManager = new GridManager(4, 100)
  // 初始计算所有卡片的位置
  gridManager.recalculateAllPositions()
  
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
      
      // 释放被拖拽卡片的位置
      gridManager.releasePosition(draggedItem)
      
      // 创建占位元素，考虑卡片尺寸
      const placeholder = document.createElement('div')
      placeholder.className = 'draggable-card placeholder'
      placeholder.style.width = draggedItem.offsetWidth + 'px'
      placeholder.style.height = draggedItem.offsetHeight + 'px'
      
      // 检查卡片尺寸类型
      const size = gridManager.getCardSize(draggedItem)
      if (size.height === 2) {
        // 1*2卡片（占据1列2行）
        placeholder.classList.add('md\:row-span-2')
      } else if (size.width === 2) {
        // 2*1卡片（占据2列1行）
        placeholder.classList.add('md\:col-span-2')
      }
      
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
      draggedItem._size = size
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
      
      // 重新计算所有卡片的位置
      gridManager.recalculateAllPositions()
      
      // 填充空位
      fillEmptySpaces(gridManager)
      
      // 更新draggables集合
      draggables = container.querySelectorAll('.draggable-card')
      
      // 清理自定义属性
      delete draggedItem._placeholder
      delete draggedItem._dragStartIndex
      delete draggedItem._size
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
      applyShiftEffect(target, insertAfter, columnGap, rowGap, gridManager)
      
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
      
      // 重新计算所有卡片的位置
      gridManager.recalculateAllPositions()
      
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
    
    // 填充空位
    fillEmptySpaces(gridManager)
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
function applyShiftEffect(target, insertAfter, columnGap, rowGap, gridManager) {
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
  
  // 检查目标卡片是否为1*2卡片
  const isTargetMultiRow = target.classList.contains('md\:row-span-2')
  
  // 查找网格中的空位，考虑卡片尺寸
  const occupiedPositions = new Set()
  allCards.forEach(card => {
    if (card === target || card.classList.contains('placeholder')) return
    
    const rect = card.getBoundingClientRect()
    const left = rect.left - containerRect.left
    const top = rect.top - containerRect.top
    const col = Math.round(left / columnWidth)
    const row = Math.round(top / rowHeight)
    
    // 标记当前卡片占据的位置
    occupiedPositions.add(`${col},${row}`)
    
    // 检查卡片尺寸类型，标记占据的额外位置
    if (card.classList.contains('md\:row-span-2')) {
      // 1*2卡片：占据1列2行
      occupiedPositions.add(`${col},${row + 1}`)
    } else if (card.classList.contains('md\:col-span-2')) {
      // 2*1卡片：占据2列1行
      occupiedPositions.add(`${col + 1},${row}`)
    }
  })
  
  // 为其他卡片应用挤压效果
  allCards.forEach(card => {
    if (card === target || card.classList.contains('placeholder')) return
    
    const cardRect = card.getBoundingClientRect()
    const relativeLeft = cardRect.left - containerRect.left
    const relativeTop = cardRect.top - containerRect.top
    const cardCol = Math.round(relativeLeft / columnWidth)
    const cardRow = Math.round(relativeTop / rowHeight)
    
    // 检查当前卡片尺寸类型
    const isCardMultiRow = card.classList.contains('md\:row-span-2')
    const isCardMultiCol = card.classList.contains('md\:col-span-2')
    
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
      let canMove = true
      
      // 根据卡片类型检查是否可以移动到目标位置
      if (isCardMultiRow) {
        // 1*2卡片：需要检查当前位置和下一行位置是否都为空
        const nextRowKey = `${pos.col},${pos.row + 1}`
        if (occupiedPositions.has(nextRowKey)) {
          canMove = false
        }
      } else if (isCardMultiCol) {
        // 2*1卡片：需要检查当前位置和下一列位置是否都为空
        const nextColKey = `${pos.col + 1},${pos.row}`
        if (occupiedPositions.has(nextColKey)) {
          canMove = false
        }
      }
      
      if (canMove && !occupiedPositions.has(positionKey)) {
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

// 网格管理器类，用于管理网格状态和卡片位置
class GridManager {
  constructor(columns = 4, rows = Infinity) {
    this.columns = columns;
    this.rows = rows;
    this.grid = new Map(); // 存储每个网格位置的占用状态
    this.cardPositions = new Map(); // 存储每个卡片的位置信息
  }

  // 计算卡片的尺寸类型
  getCardSize(card) {
    if (card.classList.contains('md:row-span-2')) {
      // 1*2卡片（占据1列2行）
      return { width: 1, height: 2 };
    } else if (card.classList.contains('md:col-span-2')) {
      // 2*1卡片（占据2列1行）
      return { width: 2, height: 1 };
    } else {
      // 1*1卡片（占据1列1行）
      return { width: 1, height: 1 };
    }
  }

  // 检查位置是否可用
  isPositionAvailable(col, row, width = 1, height = 1) {
    for (let i = 0; i < width; i++) {
      for (let j = 0; j < height; j++) {
        const key = `${col + i},${row + j}`;
        if (this.grid.has(key)) {
          return false;
        }
      }
    }
    return true;
  }

  // 占用位置
  occupyPosition(col, row, width = 1, height = 1, card) {
    const positions = [];
    for (let i = 0; i < width; i++) {
      for (let j = 0; j < height; j++) {
        const key = `${col + i},${row + j}`;
        this.grid.set(key, card);
        positions.push(key);
      }
    }
    this.cardPositions.set(card, { col, row, width, height, positions });
  }

  // 释放位置
  releasePosition(card) {
    const pos = this.cardPositions.get(card);
    if (pos) {
      pos.positions.forEach(key => {
        this.grid.delete(key);
      });
      this.cardPositions.delete(card);
    }
  }

  // 查找可用的空位
  findEmptySpace(width = 1, height = 1) {
    // 遍历网格查找可用位置
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col <= this.columns - width; col++) {
        if (this.isPositionAvailable(col, row, width, height)) {
          return { col, row };
        }
      }
    }
    return null;
  }

  // 查找所有空位
  findAllEmptySpaces() {
    const emptySpaces = [];
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.columns; col++) {
        if (this.isPositionAvailable(col, row)) {
          emptySpaces.push({ col, row });
        }
      }
    }
    return emptySpaces;
  }

  // 重新计算所有卡片的位置
  recalculateAllPositions() {
    // 清空网格
    this.grid.clear();
    this.cardPositions.clear();

    // 获取所有卡片
    const cards = document.querySelectorAll('.draggable-card');
    let currentRow = 0;
    let currentCol = 0;

    cards.forEach(card => {
      const size = this.getCardSize(card);
      
      // 检查当前位置是否可用，如果不可用或当前行剩余空间不够，寻找合适位置
      if (!this.isPositionAvailable(currentCol, currentRow, size.width, size.height) || 
          currentCol + size.width > this.columns) {
        // 寻找可用的空位
        const emptySpace = this.findEmptySpace(size.width, size.height);
        if (emptySpace) {
          currentCol = emptySpace.col;
          currentRow = emptySpace.row;
        } else {
          // 如果没有找到空位，移动到下一行开始位置
          currentRow++;
          currentCol = 0;
          // 确保新位置可用
          while (!this.isPositionAvailable(currentCol, currentRow, size.width, size.height)) {
            currentRow++;
          }
        }
      }

      // 占用位置
      this.occupyPosition(currentCol, currentRow, size.width, size.height, card);

      // 更新当前位置
      currentCol += size.width;
      if (currentCol >= this.columns) {
        currentCol = 0;
        currentRow++;
      }
    });
  }

  // 更新卡片位置
  updateCardPosition(card, newCol, newRow) {
    // 释放旧位置
    this.releasePosition(card);
    
    // 获取卡片尺寸
    const size = this.getCardSize(card);
    
    // 占用新位置
    this.occupyPosition(newCol, newRow, size.width, size.height, card);
  }
}

// 更新所有卡片的索引
function updateCardIndices() {
  const cards = document.querySelectorAll('.draggable-card')
  cards.forEach((card, index) => {
    card.setAttribute('data-index', index)
  })
}

// 查找所有空位（使用GridManager的方法）
function findEmptySpaces(gridManager) {
  return gridManager.findAllEmptySpaces();
}

// 填充空位，让1*1卡片自动填充
function fillEmptySpaces(gridManager) {
  const emptySpaces = gridManager.findAllEmptySpaces();
  if (emptySpaces.length === 0) {
    return; // 没有空位，不需要填充
  }

  // 获取所有卡片
  const allCards = Array.from(document.querySelectorAll('.draggable-card'));
  
  // 重新计算所有卡片的位置，让浏览器自动重新排列
  gridManager.recalculateAllPositions();
}