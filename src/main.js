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

// ============================================================
// GridManager：显式二维网格管理（grid-column / grid-row 精确定位）
// ============================================================
class GridManager {
  constructor(containerSelector = '.grid-container') {
    this.container = document.querySelector(containerSelector)
    this.columns = this.detectColumns()
    this.cells = new Map() // key: "col,row" → card
    this.cardInfo = new Map() // card → { col, row, w, h }
  }

  detectColumns() {
    if (!this.container) return 4
    const t = getComputedStyle(this.container).gridTemplateColumns
    if (!t || t === 'none') return 4
    return t.split(/\s+/).filter(s => s && s !== 'none').length || 4
  }

  // 重新计算列数（响应式断点切换时）
  relayout() {
    const newCols = this.detectColumns()
    if (newCols === this.columns) return
    this.columns = newCols
    this.reflow()
  }

  // 读取卡片尺寸（从 class 判断）
  getCardSize(card) {
    const w = card.classList.contains('col-span-2') ? 2 : 1
    const h = card.classList.contains('row-span-2') ? 2 : 1
    return { w, h }
  }

  // 检查位置是否能放下尺寸为 w × h 的卡片
  canPlace(col, row, w, h, skipCard = null) {
    if (col < 0 || row < 0) return false
    if (col + w > this.columns) return false
    for (let dc = 0; dc < w; dc++) {
      for (let dr = 0; dr < h; dr++) {
        const key = `${col + dc},${row + dr}`
        const occupant = this.cells.get(key)
        if (occupant && occupant !== skipCard) return false
      }
    }
    return true
  }

  // 放置卡片（自动寻找可用位置，从左上角开始）
  place(card, preferredCol = 0, preferredRow = 0) {
    const { w, h } = this.getCardSize(card)
    // 先尝试首选位置
    if (this.canPlace(preferredCol, preferredRow, w, h, card)) {
      this._setPosition(card, preferredCol, preferredRow, w, h)
      return { col: preferredCol, row: preferredRow }
    }
    // 否则按行扫描找第一个空位
    for (let row = 0; row < 200; row++) {
      for (let col = 0; col <= this.columns - w; col++) {
        if (this.canPlace(col, row, w, h, card)) {
          this._setPosition(card, col, row, w, h)
          return { col, row }
        }
      }
    }
    return null
  }

  _setPosition(card, col, row, w, h) {
    // 清除旧位置
    const old = this.cardInfo.get(card)
    if (old) {
      for (let dc = 0; dc < old.w; dc++) {
        for (let dr = 0; dr < old.h; dr++) {
          this.cells.delete(`${old.col + dc},${old.row + dr}`)
        }
      }
    }
    // 设置新位置
    for (let dc = 0; dc < w; dc++) {
      for (let dr = 0; dr < h; dr++) {
        this.cells.set(`${col + dc},${row + dr}`, card)
      }
    }
    this.cardInfo.set(card, { col, row, w, h })
    // 应用到 DOM
    card.style.gridColumn = `${col + 1} / span ${w}`
    card.style.gridRow = `${row + 1} / span ${h}`
  }

  // 移除卡片
  remove(card) {
    const info = this.cardInfo.get(card)
    if (!info) return
    for (let dc = 0; dc < info.w; dc++) {
      for (let dr = 0; dr < info.h; dr++) {
        this.cells.delete(`${info.col + dc},${info.row + dr}`)
      }
    }
    this.cardInfo.delete(card)
    card.style.gridColumn = ''
    card.style.gridRow = ''
  }

  // 获取卡片的网格信息
  getInfo(card) {
    return this.cardInfo.get(card) || null
  }

  // 根据像素坐标找到对应的网格格子
  pixelToGrid(x, y) {
    const rect = this.container.getBoundingClientRect()
    const style = getComputedStyle(this.container)
    const gapX = parseFloat(style.columnGap) || 0
    const gapY = parseFloat(style.rowGap) || 0

    // cell 实际尺寸 = (总宽 - (列数-1)*gap) / 列数
    const cellW = (rect.width - (this.columns - 1) * gapX) / this.columns
    const cellH = cellW // 正方形网格

    const relX = x - rect.left
    const relY = y - rect.top

    // 每列的步长 = cellW + gapX
    const stepX = cellW + gapX
    const stepY = cellH + gapY

    const col = Math.max(0, Math.min(this.columns - 1, Math.floor(relX / stepX)))
    const row = Math.max(0, Math.floor(relY / stepY))
    return { col, row, cellW, cellH }
  }

  // 从 DOM 重新初始化所有卡片位置
  initFromDOM() {
    this.cells.clear()
    this.cardInfo.clear()
    const cards = this.container.querySelectorAll('.draggable-card')
    cards.forEach(card => {
      this.place(card)
    })
  }

  // 全部重排（列数变化后调用）
  reflow() {
    const cards = Array.from(this.container.querySelectorAll('.draggable-card'))
    this.cells.clear()
    this.cardInfo.clear()
    cards.forEach(card => this.place(card))
  }

  // 获取所有卡片的当前位置快照（FLIP 动画用）
  snapshot() {
    const map = new Map()
    this.cardInfo.forEach((info, card) => {
      const r = card.getBoundingClientRect()
      map.set(card, { left: r.left, top: r.top })
    })
    return map
  }
}

// ============================================================
// FLIP 动画：给一组元素做位置过渡
// ============================================================
function flipAnimate(cards, oldPositions, duration = 250) {
  cards.forEach(card => {
    const old = oldPositions.get(card)
    if (!old) return
    const r = card.getBoundingClientRect()
    const dx = old.left - r.left
    const dy = old.top - r.top
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return

    // 先 transform 回旧位置
    card.style.transition = 'none'
    card.style.transform = `translate(${dx}px, ${dy}px)`
    // 强制重绘
    void card.offsetWidth
    // 过渡到新位置
    requestAnimationFrame(() => {
      card.style.transition = `transform ${duration}ms cubic-bezier(0.2, 0, 0, 1)`
      card.style.transform = ''
      // 结束后清理
      const cleanup = () => {
        card.style.transition = ''
        card.style.transform = ''
        card.removeEventListener('transitionend', cleanup)
      }
      card.addEventListener('transitionend', cleanup)
      // 兜底：transitionend 可能不触发
      setTimeout(cleanup, duration + 50)
    })
  })
}

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
  
  // ===== 卡片拖拽系统（显式网格 + FLIP 过渡） =====
  const container = document.querySelector('.grid-container')
  draggables = container.querySelectorAll('.draggable-card')

  // 初始化网格管理器
  gridManager = new GridManager('.grid-container')
  gridManager.initFromDOM()

  // 响应式：窗口尺寸变化后重新排列
  let resizeTimer = null
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      if (gridManager) {
        const oldPos = gridManager.snapshot()
        gridManager.relayout()
        flipAnimate(draggables, oldPos, 300)
      }
    }, 150)
  })

  let drag = null

  function onPointerDown(e) {
    if (drag) return
    if (e.pointerType === 'touch') return // 移动端禁用
    if (e.button !== undefined && e.button !== 0) return
    if (e.target.closest('a, button, input, textarea, iframe, select, video, [data-no-drag]')) return

    const card = e.currentTarget
    const rect = card.getBoundingClientRect()
    const info = gridManager.getInfo(card)
    if (!info) return

    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top

    // 初始状态：卡片还在 grid 里，等待移动阈值确认后再脱离
    drag = {
      card, info,
      pointerId: e.pointerId,
      offsetX, offsetY,
      x: rect.left, y: rect.top,
      startX: e.clientX, startY: e.clientY,
      lastCol: -1, lastRow: -1,
      hasMoved: false,
      lifted: false, // 是否已从 grid 中脱离
    }

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('pointercancel', onPointerUp)
  }

  function liftCard() {
    // 从 grid 中脱离，开始拖拽
    const { card, info } = drag
    const rect = card.getBoundingClientRect()

    // 记录其他卡片的旧位置
    const otherCards = Array.from(draggables).filter(c => c !== card)
    const oldPositions = new Map()
    otherCards.forEach(c => {
      const r = c.getBoundingClientRect()
      oldPositions.set(c, { left: r.left, top: r.top })
    })

    // 从网格中移除
    gridManager.remove(card)

    // 转为 fixed 定位
    document.body.appendChild(card)
    card.style.width = rect.width + 'px'
    card.style.height = rect.height + 'px'
    card.style.left = '0px'
    card.style.top = '0px'
    card.style.transform = `translate(${rect.left}px, ${rect.top}px) scale(1.04)`
    card.style.zIndex = '1000'
    card.style.pointerEvents = 'none'
    card.classList.add('is-dragging')

    // 其他卡片重排动画
    requestAnimationFrame(() => {
      gridManager.reflow()
      flipAnimate(otherCards, oldPositions, 250)
    })

    drag.lifted = true
  }

  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return

    const x = e.clientX - drag.offsetX
    const y = e.clientY - drag.offsetY
    drag.x = x
    drag.y = y

    // 还没脱离 grid 时，检查是否达到拖动阈值
    if (!drag.lifted) {
      const dx = e.clientX - drag.startX
      const dy = e.clientY - drag.startY
      if (Math.sqrt(dx*dx + dy*dy) < 5) return
      // 达到阈值，脱离 grid
      liftCard()
      drag.hasMoved = true
    }

    // 直接跟随，不做阻尼
    drag.card.style.transform = `translate(${x}px, ${y}px) scale(1.04)`

    // 计算当前鼠标所在的网格位置
    const g = gridManager.pixelToGrid(e.clientX, e.clientY)
    const col = g.col
    const row = g.row

    // 位置没变化就跳过
    if (col === drag.lastCol && row === drag.lastRow) return
    drag.lastCol = col
    drag.lastRow = row

    const { w, h } = drag.info
    const others = Array.from(draggables).filter(c => c !== drag.card)

    // FLIP: 先记录旧位置
    const oldPos = new Map()
    others.forEach(c => {
      const r = c.getBoundingClientRect()
      oldPos.set(c, { left: r.left, top: r.top })
    })

    // 重新布局：被拖拽卡占目标位置，其余按序重排
    gridManager.cells.clear()
    gridManager.cardInfo.clear()

    // 先尝试放在目标位置（鼠标指向格子作为卡片左上角）
    let placed = false
    if (gridManager.canPlace(col, row, w, h)) {
      gridManager._setPosition(drag.card, col, row, w, h)
      placed = true
    }

    // 放其他卡片
    others.forEach(c => {
      gridManager.place(c)
    })

    // 如果目标位置放不下，找最近的可用位置
    if (!placed) {
      gridManager.place(drag.card, col, row)
    }

    // FLIP 动画
    flipAnimate(others, oldPos, 200)
  }

  function onPointerUp(e) {
    if (!drag || e.pointerId !== drag.pointerId) return

    const { card, info, hasMoved } = drag

    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)
    document.removeEventListener('pointercancel', onPointerUp)

    // 没怎么移动，当点击处理
    if (!hasMoved) {
      cancelDrag(card, info)
      return
    }

    const rect = card.getBoundingClientRect()
    const startLeft = rect.left
    const startTop = rect.top

    // 把卡片放回容器，让 grid 布局生效，获取最终位置
    container.appendChild(card)

    // 获取最终位置
    const finalRect = card.getBoundingClientRect()
    const endLeft = finalRect.left
    const endTop = finalRect.top

    // 再拿到 body 做落位动画
    document.body.appendChild(card)
    card.style.left = '0px'
    card.style.top = '0px'
    card.style.transform = `translate(${startLeft}px, ${startTop}px) scale(1.04)`

    const duration = 240
    const startTime = performance.now()

    function landTick(now) {
      const t = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      const nx = startLeft + (endLeft - startLeft) * eased
      const ny = startTop + (endTop - startTop) * eased
      const scale = 1.04 - 0.04 * eased
      card.style.transform = `translate(${nx}px, ${ny}px) scale(${scale})`
      if (t < 1) {
        requestAnimationFrame(landTick)
      } else {
        finishDrag(card)
      }
    }
    requestAnimationFrame(landTick)

    function finishDrag(card) {
      container.appendChild(card)
      card.classList.remove('is-dragging')
      card.style.transform = ''
      card.style.left = ''
      card.style.top = ''
      card.style.width = ''
      card.style.height = ''
      card.style.zIndex = ''
      card.style.pointerEvents = ''
      card.style.visibility = ''

      draggables = container.querySelectorAll('.draggable-card')
      drag = null
    }
  }

  function cancelDrag(card, info) {
    // 还没脱离 grid，直接清理
    if (!drag.lifted) {
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
      document.removeEventListener('pointercancel', onPointerUp)
      drag = null
      return
    }

    const others = Array.from(draggables).filter(c => c !== card)
    const oldPos = new Map()
    others.forEach(c => {
      const r = c.getBoundingClientRect()
      oldPos.set(c, { left: r.left, top: r.top })
    })

    // 放回容器
    container.appendChild(card)
    card.classList.remove('is-dragging')

    // 恢复卡片到原始位置
    gridManager._setPosition(card, info.col, info.row, info.w, info.h)

    // 其他卡片动画回原位
    flipAnimate(others, oldPos, 200)

    // 清理样式
    card.style.transform = ''
    card.style.left = ''
    card.style.top = ''
    card.style.width = ''
    card.style.height = ''
    card.style.zIndex = ''
    card.style.pointerEvents = ''
    card.style.visibility = ''

    drag = null
  }

  // 绑定拖拽 + 淡入动画
  draggables.forEach((draggable, index) => {
    draggable.addEventListener('pointerdown', onPointerDown)
    draggable.style.animationDelay = `${index * 0.08}s`
    draggable.classList.add('fade-in')
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
  // 响应式 Grid 尺寸计算，布局模式切换时触发 GridManager 重排
  initGridSizing(() => {
    if (gridManager) {
      const oldPos = gridManager.snapshot();
      gridManager.reflow();
      try { flipAnimate(draggables, oldPos, 300); } catch (e) {}
    }
  });
});
