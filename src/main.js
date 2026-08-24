import './style.css'
import { CardManager } from './js/components/CardManager.js'
import { VideoListModal } from './js/components/VideoListModal.js'
import { updateAllFanCounts } from './js/site.js'
import { updateHeader, updateFooter } from './js/header.js'
import { initRemoteConfig } from './js/remoteConfig.js'
import { initGridSizing } from './js/gridSizing.js'

// 模块级状态：保证 renderApp 可重复调用（单例与一次性事件只初始化一次）
let gridManager = null
let columnGap = 0
let rowGap = 0
let draggables = []
let videoListModal = null
let containerDragEventsBound = false
let moreVideoObserver = null

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

/**
 * 渲染整个前台应用（可重复调用：远程配置后台刷新后会再次触发）
 */
function renderApp() {
  // 更新页面头部和页脚（含备案区块）
  updateHeader();
  updateFooter();
  
  // 初始化卡片管理器
  const cardManager = new CardManager()

  // 创建所有卡片
  cardManager.createAllCards()

  // 渲染所有卡片到网格容器（renderTo 内部会清空容器，重复调用安全）
  cardManager.renderTo('.grid-container')
  
  // 添加拖拽功能（Pointer Events 实现丝滑拖拽）
  const container = document.querySelector('.grid-container')
  draggables = document.querySelectorAll('.draggable-card')

  // 初始化网格管理器
  gridManager = new GridManager(4, 100)
  // 初始计算所有卡片的位置
  gridManager.recalculateAllPositions()

  // 缓存容器样式信息
  const containerComputed = getComputedStyle(container)
  columnGap = parseFloat(containerComputed.columnGap) || 0
  rowGap = parseFloat(containerComputed.rowGap) || 0

  // ===== 丝滑拖拽系统 =====
  let dragState = null

  function onPointerDown(e) {
    // 已有拖拽进行中，忽略
    if (dragState) return
    // 左键或触摸
    if (e.button !== undefined && e.button !== 0) return
    // 忽略来自链接/按钮/输入框/iframe 的拖拽
    if (e.target.closest('a, button, input, textarea, iframe, [data-no-drag]')) return

    const card = e.currentTarget
    const rect = card.getBoundingClientRect()

    // 计算光标在卡片内的偏移
    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top

    // 创建占位卡（留在 Grid 原位，保持布局流动）
    const placeholder = document.createElement('div')
    placeholder.className = 'drag-placeholder'
    placeholder.style.width = rect.width + 'px'
    placeholder.style.height = rect.height + 'px'

    // 同步尺寸类（跨列/跨行）
    if (card.classList.contains('md:col-span-2')) {
      placeholder.classList.add('md:col-span-2')
    }
    if (card.classList.contains('md:row-span-2') || card.id === 'music-player-card') {
      placeholder.classList.add('md:row-span-2')
      placeholder.style.aspectRatio = 'auto'
    }

    // 插入占位卡到原位
    card.parentNode.insertBefore(placeholder, card)

    // 将卡片移到 body 末尾，彻底脱离 Grid 容器，避免影响布局
    document.body.appendChild(card)

    // 将卡片转为 fixed 定位，脱离文档流
    card.style.width = rect.width + 'px'
    card.style.height = rect.height + 'px'
    card.style.left = '0px'
    card.style.top = '0px'
    card.style.transform = `translate(${rect.left}px, ${rect.top}px) scale(1.05) rotate(2deg)`
    card.classList.add('is-dragging')

    // 全局事件监听（一次拖拽一套，结束后清理）
    dragState = {
      card,
      placeholder,
      offsetX,
      offsetY,
      pointerId: e.pointerId,
      targetX: rect.left,
      targetY: rect.top,
      currentX: rect.left,
      currentY: rect.top,
      animating: false,
      lastHitCard: null,
      lastHitTime: 0
    }

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('pointercancel', onPointerUp)

    // 启动 rAF 渲染循环
    startDragLoop()
  }

  function startDragLoop() {
    if (!dragState || dragState.animating) return
    dragState.animating = true

    function tick() {
      if (!dragState) return
      // 带阻尼的跟随：越接近目标越慢，视觉更丝滑
      dragState.currentX += (dragState.targetX - dragState.currentX) * 0.2
      dragState.currentY += (dragState.targetY - dragState.currentY) * 0.2

      const dx = dragState.targetX - dragState.currentX
      const dy = dragState.targetY - dragState.currentY
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance > 0.3) {
        dragState.card.style.transform =
          `translate(${dragState.currentX}px, ${dragState.currentY}px) scale(1.05) rotate(2deg)`
        requestAnimationFrame(tick)
      } else {
        dragState.card.style.transform =
          `translate(${dragState.targetX}px, ${dragState.targetY}px) scale(1.05) rotate(2deg)`
        dragState.animating = false
      }
    }
    requestAnimationFrame(tick)
  }

  function onPointerMove(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return

    // 更新目标位置
    dragState.targetX = e.clientX - dragState.offsetX
    dragState.targetY = e.clientY - dragState.offsetY

    // 重新启动动画循环
    if (!dragState.animating) {
      startDragLoop()
    }

    // 碰撞检测：找到光标下的卡片（节流，每 50ms 最多一次）
    const now = performance.now()
    if (now - dragState.lastHitTime < 40) return
    dragState.lastHitTime = now

    // 先隐藏被拖拽卡，让 elementFromPoint 能取到下面的元素
    dragState.card.style.visibility = 'hidden'
    const below = document.elementFromPoint(e.clientX, e.clientY)
    dragState.card.style.visibility = ''

    if (!below) return
    const targetCard = below.closest('.draggable-card:not(.is-dragging)')

    if (!targetCard) return

    // 计算插入方向
    const rect = targetCard.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const insertAfter = x > rect.width / 2 || y > rect.height / 2

    // 判断占位卡是否已经在正确位置
    const placeholder = dragState.placeholder
    const nextCorrect = insertAfter
      ? placeholder.nextSibling === targetCard.nextSibling
      : placeholder.previousSibling === targetCard

    if (!nextCorrect) {
      // 碰撞反馈（只在换卡片时触发）
      if (targetCard !== dragState.lastHitCard) {
        dragState.lastHitCard = targetCard
        targetCard.classList.remove('is-hit')
        void targetCard.offsetWidth // 触发重绘，重播动画
        targetCard.classList.add('is-hit')
      }

      // 挪动占位卡到新位置（Grid 自身流动带动其他卡片丝滑避让）
      if (insertAfter) {
        targetCard.parentNode.insertBefore(placeholder, targetCard.nextSibling)
      } else {
        targetCard.parentNode.insertBefore(placeholder, targetCard)
      }
    }
  }

  function onPointerUp(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return

    const { card, placeholder } = dragState

    // 移除全局事件
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)
    document.removeEventListener('pointercancel', onPointerUp)

    // 停止动画循环
    dragState.animating = false

    // 缓动落回：卡片动画飞到占位卡位置
    const finalRect = placeholder.getBoundingClientRect()
    const startX = dragState.currentX
    const startY = dragState.currentY
    const endX = finalRect.left
    const endY = finalRect.top
    const duration = 280
    const startTime = performance.now()

    function easeOutBack(t) {
      const c1 = 1.70158
      const c3 = c1 + 1
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
    }

    function landTick(now) {
      if (!dragState) return
      const elapsed = now - startTime
      const t = Math.min(elapsed / duration, 1)
      const eased = easeOutBack(t)

      const x = startX + (endX - startX) * eased
      const y = startY + (endY - startY) * eased
      const scale = 1.05 - 0.05 * eased
      const rotate = 2 * (1 - eased)

      card.style.transform = `translate(${x}px, ${y}px) scale(${scale}) rotate(${rotate}deg)`

      if (t < 1) {
        requestAnimationFrame(landTick)
      } else {
        finishDrag()
      }
    }

    requestAnimationFrame(landTick)

    function finishDrag() {
      if (!dragState) return
      // 把卡片放回占位卡的位置
      placeholder.parentNode.insertBefore(card, placeholder)
      placeholder.remove()

      // 清理拖拽样式
      card.classList.remove('is-dragging')
      card.style.transform = ''
      card.style.left = ''
      card.style.top = ''
      card.style.width = ''
      card.style.height = ''
      card.style.visibility = ''

      // 清除所有碰撞反馈
      document.querySelectorAll('.is-hit').forEach(c => c.classList.remove('is-hit'))

      // 更新索引和网格
      updateCardIndices()
      gridManager.recalculateAllPositions()
      fillEmptySpaces(gridManager)
      draggables = container.querySelectorAll('.draggable-card')

      dragState = null
    }
  }

  // 为每个可拖拽元素添加索引属性和拖拽事件
  draggables.forEach((draggable, index) => {
    draggable.setAttribute('data-index', index)

    // 添加淡入动画延迟
    draggable.style.animationDelay = `${index * 0.1}s`
    draggable.classList.add('fade-in')

    // pointerdown 绑定在卡片上，move/up/cancel 全局绑定
    draggable.addEventListener('pointerdown', onPointerDown)
  })

  // 初始化粉丝数更新
  updateAllFanCounts()
  
  // 初始化地图
  initMapCard(cardManager);
  
  // 初始化视频列表弹窗（单例：重复渲染时复用，避免向 body 堆积弹窗 DOM 与全局键盘事件）
  if (!videoListModal) {
    videoListModal = new VideoListModal();
  }
  
  // 添加"更多视频"卡片点击事件监听
  function addMoreVideoCardListener() {
    const moreVideoCard = document.getElementById('more-video-card');
    // 重渲染后为新元素正常绑定；同一元素上防止 MutationObserver 触发导致的重复绑定
    if (moreVideoCard && !moreVideoCard._listenerBound) {
      moreVideoCard._listenerBound = true;
      moreVideoCard.addEventListener('click', () => {
        videoListModal.show();
      });
    }
  }
  
  // 初始添加事件监听
  addMoreVideoCardListener();
  
  // 监听DOM变化，确保动态添加的卡片也能触发事件（观察器只创建一次）
  if (!moreVideoObserver) {
    moreVideoObserver = new MutationObserver(() => {
      addMoreVideoCardListener();
    });
    
    moreVideoObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

// 启动流程：先加载远程配置（有缓存同步应用 / 无缓存等待远程接口，失败则静态兜底），再渲染页面
document.addEventListener('DOMContentLoaded', async function () {
  // 缓存后台刷新发现配置变化时，通过回调触发页面重渲染
  await initRemoteConfig(() => renderApp());
  renderApp();
  initGridSizing();
});

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