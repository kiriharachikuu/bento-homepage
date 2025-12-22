import { BaseCard } from './BaseCard.js';

/**
 * 地图卡片
 */
export class MapCard extends BaseCard {
  /**
   * 构造函数
   * @param {Object} config - 卡片配置
   */
  constructor(config) {
    super({
      id: 'map-card',
      classes: 'fade-in',
      ...config
    });
    
    this.map = null;
    this.marker = null;
  }

  /**
   * 获取卡片内容
   * @returns {string} 卡片内容HTML
   */
  getContent() {
    return `
      <div class="relative w-full h-64 mb-4" style="min-height: 256px;">
        <!-- 地图容器 -->
        <div id="amap-container" class="absolute inset-0 rounded-xl overflow-hidden" style="width: 100%; height: 100%; background-color: #f0f0f0;"></div>
        <!-- 添加静态地图图片作为备选 -->
        <img id="static-map" src="https://restapi.amap.com/v3/staticmap?location=120.198803,30.182417&zoom=15&size=400*256&markers=mid,,A:120.197074,30.182509&key=f79674766531d46a40852dc77860ba25" 
             class="absolute inset-0 w-full h-full object-cover rounded-xl" 
             alt="浙江杭州地图" 
             style="display: none;">
      </div>
      <div class="flex justify-between items-center">
        <div class="flex items-center">
          <div class="bg-gray-500 rounded-xl w-8 h-8 mr-2 flex items-center justify-center p-1">
            <i class="fa-solid fa-map-pin text-white" style="font-size: 100%;"></i>
          </div>
          <span>我现在所在</span>
        </div>
        <button id="map-refresh" class="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors duration-200">
          <svg id="refresh-icon" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
      <style>
        /* 旋转动画 */
        @keyframes rotate360 {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        
        .spin-animation {
          animation: rotate360 0.5s ease-in-out;
        }
      </style>
    `;
  }

  /**
   * 显示加载状态（已移除加载指示器，此方法保留以兼容现有代码）
   */
  showLoading() {
    console.log('showLoading called, but loading indicator has been removed');
  }

  /**
   * 隐藏加载状态（已移除加载指示器，此方法保留以兼容现有代码）
   */
  hideLoading() {
    console.log('hideLoading called, but loading indicator has been removed');
  }

  /**
   * 显示错误信息（已移除错误提示，此方法保留以兼容现有代码）
   * @param {string} message - 错误信息
   */
  showError(message) {
    console.error('Map error:', message);
    this.hideLoading();
  }

  /**
   * 初始化地图
   */
  async initMap() {
    console.log('MapCard.initMap() 被调用');
    
    // 获取静态地图元素
    const staticMap = document.getElementById('static-map');
    
    // 确保地图容器已渲染
    const mapContainer = document.getElementById('amap-container');
    if (!mapContainer) {
      console.error('地图容器未找到，显示静态地图');
      if (staticMap) {
        staticMap.style.display = 'block';
      }
      return;
    }
    
    console.log('地图容器找到:', mapContainer);
    
    // 确保地图容器有正确的尺寸
    const containerRect = mapContainer.getBoundingClientRect();
    console.log('地图容器尺寸:', containerRect.width, 'x', containerRect.height);
    
    if (containerRect.height === 0) {
      mapContainer.style.height = '256px';
      console.log('地图容器高度为0，已设置为256px');
    }

    // 添加超时机制，如果动态地图加载超过3秒，就显示静态地图
    const timeoutId = setTimeout(() => {
      console.error('动态地图加载超时，显示静态地图');
      if (staticMap) {
        staticMap.style.display = 'block';
      }
    }, 3000);

    // 确保地图API已加载
    try {
      if (!window.AMap) {
        console.error('地图API未加载，尝试加载');
        await this.loadAMapAPI();
        console.log('地图API加载成功');
      } else {
        console.log('地图API已加载');
      }
    } catch (error) {
      console.error('加载地图API失败:', error);
      // API加载失败，显示静态地图
      if (staticMap) {
        staticMap.style.display = 'block';
      }
      clearTimeout(timeoutId);
      return;
    }

    console.log('开始初始化地图实例');
    
    // 确保AMap对象可用
    if (!window.AMap) {
      console.error('地图API加载失败，AMap对象未定义，显示静态地图');
      if (staticMap) {
        staticMap.style.display = 'block';
      }
      clearTimeout(timeoutId);
      return;
    }

    try {
      // 最简化的地图配置，只保留必要的参数
      this.map = new AMap.Map('amap-container', {
        zoom: 15,
        center: [120.198803, 30.182417],
        resizeEnable: true,
        viewMode: '2D'
      });

      console.log('地图实例创建成功');
      
      // 地图加载成功，隐藏静态地图
      if (staticMap) {
        staticMap.style.display = 'none';
      }
      clearTimeout(timeoutId);

      // 地图加载完成后隐藏logo
      this.hideAMapLogo();

      // 添加自定义标记点（使用默认图标，避免路径问题）
      try {
        this.marker = new AMap.Marker({
          position: [120.197074, 30.182509],
          title: '浙江杭州'
        });

        this.map.add(this.marker);
        console.log('地图标记添加成功');
      } catch (markerError) {
        console.error('地图标记添加失败:', markerError);
        // 标记添加失败不影响地图显示
      }
      
      // 添加刷新按钮事件
      const refreshBtn = document.getElementById('map-refresh');
      if (refreshBtn) {
        console.log('找到刷新按钮，添加事件监听');
        // 先移除可能存在的旧事件监听，避免重复添加
        refreshBtn.removeEventListener('click', this.refreshMap.bind(this));
        refreshBtn.addEventListener('click', this.refreshMap.bind(this));
      } else {
        console.warn('未找到刷新按钮');
      }
    } catch (error) {
      console.error('地图初始化过程中发生错误，显示静态地图:', error);
      // 初始化失败，显示静态地图
      if (staticMap) {
        staticMap.style.display = 'block';
      }
      clearTimeout(timeoutId);
    }
  }
  
  /**
   * 隐藏高德地图logo
   */
  hideAMapLogo() {
    console.log('尝试隐藏高德地图logo');
    
    // 使用CSS隐藏logo和版权信息
    const style = document.createElement('style');
    style.textContent = `
      /* 隐藏高德地图logo和版权信息 */
      .amap-logo {
        display: none !important;
      }
      .amap-copyright {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
    
    // 同时尝试通过DOM操作隐藏
    setTimeout(() => {
      const logo = document.querySelector('.amap-logo');
      const copyright = document.querySelector('.amap-copyright');
      
      if (logo) {
        logo.style.display = 'none';
        console.log('成功隐藏高德地图logo');
      }
      
      if (copyright) {
        copyright.style.display = 'none';
        console.log('成功隐藏高德地图版权信息');
      }
    }, 500);
  }
  
  /**
   * 刷新地图
   */
  refreshMap() {
    console.log('刷新地图按钮被点击');
    
    // 添加旋转动画
    const refreshIcon = document.getElementById('refresh-icon');
    if (refreshIcon) {
      refreshIcon.classList.add('spin-animation');
      
      // 动画结束后移除动画类，以便下次点击时可以再次触发
      refreshIcon.addEventListener('animationend', () => {
        refreshIcon.classList.remove('spin-animation');
      }, { once: true });
    }
    
    // 显示加载状态
    this.showLoading();
    
    // 如果已有地图实例，先销毁
    if (this.map) {
      console.log('销毁现有地图实例');
      // 移除地图事件监听
      this.map.off('complete');
      this.map.off('error');
      // 清空地图容器
      const mapContainer = document.getElementById('amap-container');
      if (mapContainer) {
        mapContainer.innerHTML = '';
      }
      // 销毁地图实例
      this.map.destroy();
      this.map = null;
      this.marker = null;
    }
    
    // 重新初始化地图
    setTimeout(() => {
      console.log('重新初始化地图');
      this.initMap();
    }, 300);
  }
  
  /**
   * 加载地图API
   * @returns {Promise} 加载Promise
   */
  loadAMapAPI() {
    console.log('MapCard.loadAMapAPI() 被调用');
    
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
      script.crossOrigin = 'anonymous';
      script.defer = true;
      script.src = 'https://webapi.amap.com/maps?v=2.0&key=f79674766531d46a40852dc77860ba25';
      
      console.log('开始加载AMap API脚本');
      
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
        }, 300);
      };
      
      // 监听错误事件
      script.onerror = (event) => {
        console.error('AMap API脚本加载失败:', event);
        reject(new Error('Failed to load AMap API'));
      };
      
      // 添加到页面中
      document.head.appendChild(script);
    });
  }
}