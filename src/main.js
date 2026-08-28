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
  
  // ===== 卡片拖拽系统 =====
  const container = document.querySelector('.grid-container')
  draggables = document.querySelectorAll('.draggable-card')

  let drag = null

  function getCardSizeClasses(card) {
    const classes = []
    if (card.classList.contains('col-span-2')) classes.push('col-span-2')
    if (card.classList.contains('row-span-2')) classes.push('row-span-2')
    return classes
  }

  function onPointerDown(e) {
    if (drag) return
    if (e.button !== undefined && e.button !== 0) return
    // 忽略交互元素上的拖拽
    if (e.target.closest('a, button, input, textarea, iframe, select, video, [data-no-drag]')) return

    const card = e.currentTarget
    const rect = card.getBoundingClientRect()

    // 占位卡：留在 grid 原位撑住空间
    const placeholder = document.createElement('div')
    placeholder.className = 'drag-placeholder ' + getCardSizeClasses(card).join(' ')
    placeholder.style.width = rect.width + 'px'
    placeholder.style.height = rect.height + 'px'

    // 插入占位卡，把卡片移出 grid
    card.parentNode.insertBefore(placeholder, card)
    document.body.appendChild(card)

    // fixed 定位 + 初始变换
    card.style.width = rect.width + 'px'
    card.style.height = rect.height + 'px'
    card.style.left = '0px'
    card.style.top = '0px'
    card.style.transform = `translate(${rect.left}px, ${rect.top}px) scale(1.03) rotate(1deg)`
    card.style.zIndex = '1000'
    card.style.pointerEvents = 'none'
    card.classList.add('is-dragging')

    drag = {
      card, placeholder,
      pointerId: e.pointerId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      targetX: rect.left, targetY: rect.top,
      currentX: rect.left, currentY: rect.top,
      animating: false,
      lastHitTime: 0,
    }

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('pointercancel', onPointerUp)

    startDragAnim()
  }

  function startDragAnim() {
    if (!drag || drag.animating) return
    drag.animating = true
    ;(function tick() {
      if (!drag) return
      drag.currentX += (drag.targetX - drag.currentX) * 0.2
      drag.currentY += (drag.targetY - drag.currentY) * 0.2
      const dx = drag.targetX - drag.currentX
      const dy = drag.targetY - drag.currentY
      if (Math.sqrt(dx * dx + dy * dy) > 0.3) {
        drag.card.style.transform = `translate(${drag.currentX}px, ${drag.currentY}px) scale(1.03) rotate(1deg)`
        requestAnimationFrame(tick)
      } else {
        drag.animating = false
      }
    })()
  }

  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return

    drag.targetX = e.clientX - drag.offsetX
    drag.targetY = e.clientY - drag.offsetY
    if (!drag.animating) startDragAnim()

    // 碰撞检测节流
    const now = performance.now()
    if (now - drag.lastHitTime < 50) return
    drag.lastHitTime = now

    // 隐藏拖拽卡，获取下方元素
    drag.card.style.visibility = 'hidden'
    const below = document.elementFromPoint(e.clientX, e.clientY)
    drag.card.style.visibility = ''

    if (!below) return
    const targetCard = below.closest('.draggable-card:not(.is-dragging)')
    if (!targetCard) return

    const ph = drag.placeholder
    const parent = targetCard.parentNode
    if (parent !== ph.parentNode) return

    // 判断插入方向：鼠标在目标卡片右半部分则插到后面
    const tRect = targetCard.getBoundingClientRect()
    const insertAfter = (e.clientX - tRect.left) > tRect.width / 2

    const correct = insertAfter
      ? ph.nextElementSibling === targetCard
      : ph.previousElementSibling === targetCard

    if (!correct) {
      if (insertAfter) {
        parent.insertBefore(ph, targetCard.nextSibling)
      } else {
        parent.insertBefore(ph, targetCard)
      }
    }
  }

  function onPointerUp(e) {
    if (!drag || e.pointerId !== drag.pointerId) return

    const { card, placeholder } = drag

    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerUp)
    document.removeEventListener('pointercancel', onPointerUp)

    // 落位动画
    const finalRect = placeholder.getBoundingClientRect()
    const startX = drag.currentX
    const startY = drag.currentY
    const endX = finalRect.left
    const endY = finalRect.top
    const duration = 220
    const startTime = performance.now()

    function land(now) {
      if (!drag) return
      const t = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      const x = startX + (endX - startX) * eased
      const y = startY + (endY - startY) * eased
      const scale = 1.03 - 0.03 * eased
      const rotate = 1 * (1 - eased)
      card.style.transform = `translate(${x}px, ${y}px) scale(${scale}) rotate(${rotate}deg)`
      if (t < 1) {
        requestAnimationFrame(land)
      } else {
        finishDrag()
      }
    }
    requestAnimationFrame(land)

    function finishDrag() {
      if (!drag) return
      // 把卡片放回 grid
      placeholder.parentNode.insertBefore(card, placeholder)
      placeholder.remove()

      // 清理所有拖拽样式
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
  initGridSizing();
});
