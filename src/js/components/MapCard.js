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
        <div id="amap-container" class="absolute inset-0 rounded-xl overflow-hidden" style="width: 100%; height: 100%;">
          <!-- 加载指示器 -->
          <div id="map-loading" class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70">
            <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
          <!-- 错误提示 -->
          <div id="map-error" class="absolute inset-0 flex flex-col items-center justify-center bg-white bg-opacity-90 hidden">
            <i class="fa-solid fa-map-pin text-red-500 text-4xl mb-4"></i>
            <p class="text-gray-600 mb-4">地图加载失败</p>
            <button id="map-retry" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">重试</button>
          </div>
        </div>
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
    `;
  }

  /**
   * 显示加载状态
   */
  showLoading() {
    const loadingElement = document.getElementById('map-loading');
    const errorElement = document.getElementById('map-error');
    if (loadingElement) loadingElement.classList.remove('hidden');
    if (errorElement) errorElement.classList.add('hidden');
  }

  /**
   * 隐藏加载状态
   */
  hideLoading() {
    const loadingElement = document.getElementById('map-loading');
    if (loadingElement) loadingElement.classList.add('hidden');
  }

  /**
   * 显示错误信息
   * @param {string} message - 错误信息
   */
  showError(message) {
    console.error('Map error:', message);
    this.hideLoading();
    const errorElement = document.getElementById('map-error');
    if (errorElement) errorElement.classList.remove('hidden');
    
    // 添加重试按钮事件监听
    const retryButton = document.getElementById('map-retry');
    if (retryButton) {
      retryButton.onclick = () => this.refreshMap();
    }
  }

  /**
   * 初始化地图
   */
  async initMap() {
    console.log('MapCard.initMap() 被调用');
    this.showLoading();
    
    // 确保地图容器已渲染并具有正确尺寸
    const mapContainer = document.getElementById('amap-container');
    if (!mapContainer) {
      console.error('地图容器不存在');
      this.showError('地图容器不存在');
      return;
    }
    
    // 添加刷新按钮事件监听
    const refreshButton = document.getElementById('map-refresh');
    if (refreshButton) {
      refreshButton.onclick = () => this.refreshMap();
    }
    
    // 确保地图容器有正确的尺寸
    const containerRect = mapContainer.getBoundingClientRect();
    console.log('地图容器尺寸:', containerRect.width, 'x', containerRect.height);
    
    if (containerRect.height === 0) {
      mapContainer.style.height = '256px';
      console.log('地图容器高度为0，已设置为256px');
    }
    
    try {
      // 检查是否已经加载过地图API
      if (!window.AMap) {
        console.log('AMap API未加载，尝试重新加载');
        await this.loadAMapAPI();
      }
      
      if (window.AMap) {
        console.log('开始初始化高德地图');
        
        // 创建地图实例
        this.map = new AMap.Map('amap-container', {
          zoom: 12,
          center: [120.198803, 30.182417], // 坐标
          resizeEnable: true,
          mapStyle: 'amap://styles/light',
          features: ['road', 'point', 'building']
        });
        
        // 监听地图加载完成事件
        this.map.on('complete', () => {
          console.log('地图加载完成');
          this.hideLoading();
          this.hideAMapLogo();
        });
        
        // 监听地图错误事件
        this.map.on('error', (error) => {
          console.error('地图加载错误:', error);
          this.showError('地图加载失败，请检查网络连接');
        });
        
        // 添加标记点
        this.marker = new AMap.Marker({
          position: [120.197074, 30.182509],
          title: '浙江杭州',
          map: this.map
        });
        
        // 添加信息窗口
        const infoWindow = new AMap.InfoWindow({
          content: '<div style="padding: 10px;">浙江杭州</div>',
          offset: new AMap.Pixel(0, -30)
        });
        
        this.marker.on('click', () => {
          infoWindow.open(this.map, this.marker.getPosition());
        });
        
      } else {
        console.error('AMap API加载失败');
        this.showError('地图API加载失败');
      }
    } catch (error) {
      console.error('地图初始化异常:', error);
      this.showError('地图初始化失败');
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
      
      /* 刷新按钮旋转动画 */
      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(-360deg);
        }
      }
      
      .spin-animation {
        animation: spin 0.6s ease-in-out;
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