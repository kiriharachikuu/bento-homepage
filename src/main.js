import './style.css'
import { CardManager } from './js/components/CardManager.js'
import { updateAllFanCounts } from './js/site.js'
import { updateHeader, updateFooter } from './js/header.js'

// 初始化网站功能
document.addEventListener('DOMContentLoaded', function () {
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
  const draggables = document.querySelectorAll('.draggable-card')
  const container = document.querySelector('.grid-container')
  
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
      document.querySelectorAll('.placeholder').forEach(ph => ph.remove())
      
      // 移除所有挤压效果
      document.querySelectorAll('.draggable-card').forEach(card => {
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
    const draggedItem = document.querySelector('.draggable-card.dragging')
    
    if (target && draggedItem && draggedItem._placeholder) {
      // 移除现有的占位符
      document.querySelectorAll('.placeholder').forEach(ph => ph.remove())
      
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
      applyShiftEffect(target, insertAfter)
      
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
    
    const draggedItem = document.querySelector('.draggable-card.dragging')
    if (draggedItem && draggedItem._placeholder && draggedItem._placeholder.parentNode) {
      // 交换元素位置
      draggedItem._placeholder.parentNode.insertBefore(draggedItem, draggedItem._placeholder)
      
      // 更新所有卡片的索引
      updateCardIndices()
    }
    
    // 移除占位符
    document.querySelectorAll('.placeholder').forEach(ph => ph.remove())
    
    // 移除挤压效果
    document.querySelectorAll('.draggable-card').forEach(card => {
      card.classList.remove('shift-left', 'shift-right', 'shift-up', 'shift-down')
      card.style.removeProperty('transition')
    })
  })

  // 初始化粉丝数更新
  updateAllFanCounts()
  
  // 初始化地图
  setTimeout(() => {
    const mapCard = cardManager.cards.find(card => card.constructor.name === 'MapCard');
    if (mapCard && mapCard.initMap) {
      mapCard.initMap();
    }
  }, 100);
})

// 应用挤压效果到其他卡片
function applyShiftEffect(target, insertAfter) {
  const allCards = Array.from(document.querySelectorAll('.draggable-card:not(.dragging)'))
  const targetIndex = Array.from(target.parentNode.children).indexOf(target)
  
  // 移除之前的挤压效果
  document.querySelectorAll('.draggable-card').forEach(card => {
    card.classList.remove('shift-left', 'shift-right', 'shift-up', 'shift-down')
  })
  
  // 根据网格布局计算行和列
  const container = document.querySelector('.grid-container')
  const containerRect = container.getBoundingClientRect()
  const containerComputed = getComputedStyle(container)
  const columnGap = parseFloat(containerComputed.columnGap) || 0
  const rowGap = parseFloat(containerComputed.rowGap) || 0
  
  // 计算每列的宽度
  const cardRect = target.getBoundingClientRect()
  const cardWidth = cardRect.width
  const cardHeight = cardRect.height
  const columnWidth = cardWidth + columnGap
  const rowHeight = cardHeight + rowGap
  
  // 计算目标卡片所在的行列
  const targetRect = target.getBoundingClientRect()
  const relativeLeft = targetRect.left - containerRect.left
  const relativeTop = targetRect.top - containerRect.top
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