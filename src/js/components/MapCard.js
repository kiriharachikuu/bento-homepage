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
      <div class="relative w-full h-64 mb-4">
        <!-- 地图容器 -->
        <div id="amap-container" class="absolute inset-0 rounded-xl overflow-hidden"></div>
        
        <!-- 加载指示器 -->
        <div id="map-loading" class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 rounded-xl z-10">
          <div class="flex flex-col items-center">
            <div class="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-2"></div>
            <span class="text-sm text-gray-600">加载地图中...</span>
          </div>
        </div>
        
        <!-- 错误提示容器 -->
        <div id="map-error" class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 rounded-xl z-10 hidden"></div>
      </div>
      <div class="flex justify-between items-center">
        <div class="flex items-center">
          <div class="bg-gray-500 rounded-xl w-8 h-8 mr-2 flex items-center justify-center p-1">
            <i class="fa-solid fa-map-pin text-white" style="font-size: 100%;"></i>
          </div>
          <span>我现在所在</span>
        </div>
        <button id="map-refresh" class="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors duration-200">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    const loadingEl = document.getElementById('map-loading');
    if (loadingEl) {
      loadingEl.classList.remove('hidden');
    }
    
    const errorEl = document.getElementById('map-error');
    if (errorEl) {
      errorEl.classList.add('hidden');
    }
  }

  /**
   * 隐藏加载状态
   */
  hideLoading() {
    const loadingEl = document.getElementById('map-loading');
    if (loadingEl) {
      loadingEl.classList.add('hidden');
    }
  }

  /**
   * 显示错误信息
   * @param {string} message - 错误信息
   */
  showError(message) {
    const errorEl = document.getElementById('map-error');
    if (errorEl) {
      errorEl.innerHTML = `<div class="flex flex-col items-center p-4 text-center">
        <i class="fa-solid fa-exclamation-circle text-red-500 text-xl mb-2"></i>
        <span class="text-sm text-gray-700 mb-2">${message}</span>
        <button id="map-retry" class="px-3 py-1 bg-blue-500 text-white text-xs rounded-full hover:bg-blue-600 transition-colors">
          重试
        </button>
      </div>`;
      errorEl.classList.remove('hidden');
      
      // 添加重试按钮事件
      const retryBtn = errorEl.querySelector('#map-retry');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          this.initMap();
        });
      }
    }
    
    this.hideLoading();
  }

  /**
   * 初始化地图
   */
  initMap() {
    console.log('MapCard.initMap() 被调用');
    
    // 显示加载状态
    this.showLoading();
    
    // 确保地图容器已渲染
    const mapContainer = document.getElementById('amap-container');
    if (!mapContainer) {
      console.error('地图容器未找到');
      this.showError('地图容器未找到');
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

    // 检查AMap是否已加载
    if (!window.AMap) {
      console.error('地图API未加载，尝试重新加载');
      this.showError('地图API未加载，正在尝试重新加载...');
      
      // 尝试重新加载地图API
      this.loadAMapAPI().then(() => {
        this.initMap();
      }).catch((error) => {
        console.error('重新加载地图API失败:', error);
        this.showError('地图API加载失败，请检查网络连接');
      });
      
      return;
    }

    console.log('AMap API已加载，开始初始化地图');

    try {
      // 地图配置，添加隐藏logo选项
      this.map = new AMap.Map('amap-container', {
        zoom: 15,
        center: [120.198803, 30.182417],
        resizeEnable: true,
        viewMode: '2D',
        // 隐藏地图自带的控件和logo
        layers: [new AMap.TileLayer()],
        showLabel: true,
        showIndoorMap: false
      });

      console.log('地图实例创建成功');

      // 添加事件监听
      this.map.on('complete', () => {
        console.log('地图加载完成');
        this.hideLoading();
        
        // 地图加载完成后隐藏logo
        this.hideAMapLogo();
      });

      this.map.on('error', (error) => {
        console.error('地图加载失败:', error);
        this.showError('地图加载失败，请重试');
      });

      // 添加自定义标记点
      this.marker = new AMap.Marker({
        position: [120.197074, 30.182509],
        title: '浙江杭州',
        // 使用自定义图标
        icon: new AMap.Icon({
          size: new AMap.Size(50, 50), // 图标尺寸
          image: '/img/map.png', // 图标地址
          imageSize: new AMap.Size(50, 50) // 图标大小
        }),
        offset: new AMap.Pixel(-16, -16) // 图标偏移，使图标中心与定位点重合
      });

      this.map.add(this.marker);
      console.log('地图标记添加成功');
      
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
      console.error('地图初始化过程中发生错误:', error);
      this.showError('地图初始化失败: ' + error.message);
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