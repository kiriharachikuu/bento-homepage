/**
 * 默认配置与默认视频数据
 * 内容转录自 src/js/config.js 与 src/js/videoData.js，
 * 作为 KV 中无配置时的兜底值，以及新字段的默认值来源
 */

/** 站点默认配置（结构与 src/js/config.js 的 siteConfig 对齐，并补充 CMS 新增字段） */
export const DEFAULT_SITE_CONFIG = {
  // 网站基本信息
  site: {
    title: '知空空的空想世界',
    // 新增的 meta 描述字段
    description: '知空空的空想世界 - 桐原知空的个人主页',
    favicon: '/img/favicon.png',
    titleIcon: '/img/title-icon.png'
  },

  // 用户信息
  user: {
    name: '桐原知空',
    title: '唱见 & 啥都会一点的工具人',
    description: '我是<span class="font-bold text-xl">知空</span>，臭唱歌的，超级懒的_(:з」∠)_<br />主坑：VOCALOID/ChiliChill/星瞳/J-POP<br />这里有我的各种作品，联系我请移步此页底，Have fun~',
    avatar: '/img/84007943719010668e3e16e8196f029858bf7b12.jpg',
    learnMoreLink: '#',
    learnMoreContent: `
      <div class="space-y-6" style="color: var(--text-color);">
        <p class="text-lg leading-relaxed">一个底边小小唱见_(:з」∠)_出生广州，江西长大，江苏毕业，目前在浙江杭州苟且偷生（</p>
        
        <p class="leading-relaxed">最喜欢的乐队是 <strong style="color: var(--link-color);">ChiliChill</strong>，但是是杂食党，基本上什么风格都愿意听～尤其喜欢 <strong style="color: var(--link-color);">R&amp;B</strong> 和 <strong style="color: var(--link-color);">J-pop</strong>，欧美流行或者是乡村音乐也是喜欢的(¯▽¯)/♫</p>
        
        <p class="leading-relaxed">喜欢的主播是 <strong style="color: var(--link-color);">星瞳</strong>，三年小星星报道！到杭州后跑线下的频率指数上升，在线上也会偶尔发发星家。</p>

        <div class="p-4 rounded-lg" style="background-color: var(--gray-100);">
          <p class="font-medium mb-2" style="color: var(--text-color);">关于翻唱：</p>
          <p class="leading-relaxed">最开始应该是从20年初疫情，关在家闲得没事录了几首。到年中开始花钱买了设备，开启了卧室唱见的路。23年开始上大二后有了更多的时间录歌，甚至直接把设备不远万里搬来了学校（感谢舍友不杀之恩），24年开始接触了更多的朋友，也开始参与更多的企划～</p>
        </div>
        
        <div class="p-4 rounded-lg" style="background-color: var(--gray-100);">
          <p class="font-medium mb-2" style="color: var(--text-color);">关于技能：</p>
          <p class="leading-relaxed">会做修对，会扒点和声，会做点 AE 小动画，会做点曲绘拆分，会写点小代码，总之就是啥都会一点就是不精通(~_~💧)<br><span style="color: var(--link-color);">【今年疑似解锁作词作曲】</span></p>
        </div>
        
        <div class="p-4 rounded-lg" style="background-color: var(--gray-100);">
          <p class="font-medium mb-3" style="color: var(--text-color);">关于我的设备：</p>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y" style="border-color: var(--border-color);">
              <tbody class="divide-y" style="background-color: var(--card-bg); border-color: var(--border-color);">
                <tr>
                  <td class="px-4 py-3 text-sm font-medium w-24" style="color: var(--text-color);">电脑</td>
                  <td class="px-4 py-3 text-sm" style="color: var(--gray-600);">一台破破的游戏本</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 text-sm font-medium" style="color: var(--text-color);">声卡</td>
                  <td class="px-4 py-3 text-sm" style="color: var(--gray-600);">Focusrite Scarlett Solo3</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 text-sm font-medium" style="color: var(--text-color);">麦克风</td>
                  <td class="px-4 py-3 text-sm" style="color: var(--gray-600);">Focusrite CM25 MkⅡ（已吃灰） / Shure SM58</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 text-sm font-medium" style="color: var(--text-color);">宿主</td>
                  <td class="px-4 py-3 text-sm" style="color: var(--gray-600);">Studio One 7</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <div class="p-4 rounded-lg text-center" style="background-color: var(--gray-100);">
          <p class="leading-relaxed" style="color: var(--link-color);">想听我唱什么可以直接私信我呀☺️，想找我约歌也欢迎戳我～</p>
        </div>
        
        <p class="text-center italic" style="color: var(--gray-600);">祝你早安午安晚安～</p>
      </div>
    `
  },

  // 社交媒体链接
  socialLinks: {
    bilibili: 'https://space.bilibili.com/28826850',
    netease: 'https://music.163.com/#/artist?id=34407615',
    weibo: 'https://weibo.com/5574382615',
    qqGroup: 'https://qm.qq.com/q/DI0y3MAbJK'
  },

  // 联系方式
  contactText: `哔哩哔哩：@知空空睡大觉
网易云音乐：@桐原知空
新浪微博：@知空今天睡醒了吗`,
  // 联系方式卡片"Read more"按钮链接
  contactButtonLink: '#',

  // 音乐播放器配置
  musicPlayer: {
    playlistId: '17479746916'
  },

  // 备案信息配置
  beian: {
    enabled: false,
    icpNumber: '',
    icpLink: 'https://beian.miit.gov.cn',
    policeNumber: '',
    policeLink: '',
    customText: ''
  },

  // 视频同步配置（B 站用户 mid 与同步数量上限）
  videoSync: {
    mid: '28826850',
    maxCount: 30
  },

  // 卡片配置（与前端 getDefaultCardsConfig() 结构一致）
  cards: [
    {
      id: 'user-info',
      type: 'userInfo',
      order: 1,
      enabled: true,
      config: { id: 'user-info-card', colSpan: 2 }
    },
    {
      id: 'map',
      type: 'map',
      order: 2,
      enabled: true,
      config: { id: 'map-card' }
    },
    {
      id: 'comment',
      type: 'comment',
      order: 3,
      enabled: true,
      config: { id: 'comment-card' }
    },
    {
      id: 'follower-bilibili',
      type: 'follower',
      order: 4,
      enabled: true,
      config: {
        id: 'follower-bilibili',
        platform: 'bilibili',
        title: '哔哩哔哩',
        color: 'pink',
        apiUrl: 'https://bili-count-api.chikuu.top/api/count?vmid=28826850',
        homepageUrl: 'https://space.bilibili.com/28826850',
        icon: `<svg class="icon" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
          <path d="M278.8864 148.1728c14.336-8.192 32.6144-9.3696 47.8208-2.6624 11.3664 4.6592 19.968 13.824 29.184 21.6064 38.144 32.9216 75.9808 66.304 114.2784 99.0208h80.4352c38.2976-32.768 76.0832-66.048 114.2272-98.9696 9.2672-7.7824 17.8688-16.896 29.2864-21.6576 14.7456-6.5024 32.4608-5.632 46.592 2.048 16.5888 8.5504 28.1088 26.2656 28.8256 44.9536 1.024 13.568-3.84 27.2896-12.3392 37.7856-7.5264 8.3456-16.5376 15.2064-24.8832 22.6816-5.3248 4.4032-10.1376 9.5232-16.0256 13.2096 23.6544 0 47.2576-0.256 70.912 0.1536 31.1296 0.8192 61.44 14.592 82.8928 37.1712 22.6304 22.2208 35.5328 53.5552 35.4816 85.1968 0.1024 108.4416 0 216.9344 0.0512 325.376-0.1024 16.384 0.8192 33.024-2.816 49.152-6.656 32.9728-28.8256 61.5936-56.9856 79.36a121.344 121.344 0 0 1-64.7168 17.7664H263.2704c-16.9984-0.1024-34.2528 0.8704-50.9952-2.8672-32.1024-6.4512-60.0064-27.648-77.824-54.6304a121.088 121.088 0 0 1-19.2512-66.9696v-321.536c0.1024-16.5376-0.9216-33.1776 2.4576-49.408 10.24-52.9408 58.9312-96.1024 112.9984-98.4576 24.6272-0.768 49.3056-0.2048 73.9328-0.3072-11.6224-8.3968-21.8112-18.5344-32.768-27.7504a55.04 55.04 0 0 1-20.5312-45.9264c0.7168-18.2272 11.6736-35.584 27.648-44.3392m-13.056 221.7984c-20.992 3.7376-38.912 20.3264-44.7488 40.7552a76.4928 76.4928 0 0 0-2.3552 21.7088c0.1024 89.0368-0.0512 178.0736 0.0512 267.1616-0.4096 24.2176 16.3328 47.1552 39.1168 54.8864 8.1408 2.9696 16.896 3.0208 25.3952 3.072 153.1904-0.1024 306.432 0.0512 459.6224-0.0512 22.4768 0.8704 44.0832-13.1072 53.5552-33.28 5.7856-11.5712 5.6832-24.7296 5.4784-37.376v-248.832c0-9.1136 0.3072-18.4832-2.304-27.2896a58.7776 58.7776 0 0 0-36.864-38.656c-9.7792-3.584-20.4288-3.0208-30.6688-3.072H292.5056c-8.8576 0-17.8176-0.3072-26.624 0.9728z" fill="#ffffff"/>
          <path d="M358.7072 455.5264c14.6432-1.4848 29.8496 3.2768 41.0112 12.8 12.4416 10.24 19.5584 26.112 19.7632 42.1376 0.3584 19.4048 0.1024 38.8608 0.1024 58.2656 0 12.8-3.3792 25.8048-11.3152 35.9424a54.9888 54.9888 0 0 1-48.4864 21.76 54.9376 54.9376 0 0 1-44.032-28.2624c-6.8096-11.6736-7.3728-25.4976-7.168-38.6048 0.4096-18.8416-1.024-37.7856 0.8704-56.576a55.296 55.296 0 0 1 49.2544-47.4624z m292.4544 0a55.2448 55.2448 0 0 1 60.7232 53.0432c0.8192 18.2272 0.1024 36.4544 0.4096 54.6816 0.1024 12.8-1.4336 26.112-8.4992 37.12-10.24 17.0496-30.3104 27.5456-50.176 26.112a55.04 55.04 0 0 1-43.3664-24.9856c-7.936-11.776-9.472-26.2656-9.1136-40.0896 0.3584-18.7392-0.6656-37.4784 0.6144-56.1664 1.8432-25.6 23.9104-47.5136 49.408-49.664z" fill="#ffffff"/>
        </svg>`
      }
    },
    {
      id: 'follower-netease',
      type: 'follower',
      order: 5,
      enabled: true,
      config: {
        id: 'follower-netease',
        platform: 'netease',
        title: '网易云音乐',
        color: 'red',
        apiUrl: 'https://api.swo.moe/stats/neteasemusic/379188047',
        homepageUrl: 'https://music.163.com/#/artist?id=34407615',
        icon: `<svg class="icon" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
          <path d="M603.97 105.21c22.1-6.37 45.78-6.05 68.1-0.92 25.63 6.09 49.88 17.86 70.75 33.9 7.62 5.79 14.5 12.99 18 22.05 5.42 13.4 3.97 29.42-4.03 41.49-6.98 10.84-18.85 18.39-31.64 20.01-10.22 1.4-20.93-0.77-29.71-6.2-4.95-2.91-8.72-7.4-13.69-10.28-13.33-8.46-28.68-15.12-44.73-14.74-11.3 0.13-21.24 6.75-28.9 14.53-7.17 7.4-10.82 18.31-8.45 28.46 5.51 20.74 10.99 41.48 16.49 62.22 39.54 2.03 79.06 12.49 113.05 33.13 33.04 20.44 62.89 46.36 86.56 77.25 20.09 26.18 35.32 56.08 44.64 87.74 10.09 34.12 13.36 70.1 10.73 105.54-2.19 29.24-7.94 58.31-17.86 85.94-25.65 67.28-73.16 126.27-134.31 164.5-44.85 28.33-96.36 45.42-148.89 51.94-36.26 4.53-73.21 4.55-109.29-1.63-74.14-12.25-143.62-49.2-196.35-102.57-52.4-52.5-88.87-120.64-103.62-193.33-10.88-53.01-10.39-108.36 1.68-161.13 14.75-65.07 47.35-125.94 93.18-174.41 37.38-39.8 83.55-71.29 134.23-91.62 5.22-1.99 10.36-4.35 15.92-5.23 11.87-2.08 24.55 0.73 34.27 7.89 13.16 9.29 20.4 26.14 18.21 42.08-1.81 16.27-13.36 30.94-28.75 36.51-51.2 19.14-96.6 53.34-129.28 97.13-29.21 38.86-48.27 85.28-54.66 133.49-6.45 47.72-0.71 97 16.39 142 24.7 65.79 73.81 122.4 136.42 154.62 37.7 19.53 80.14 29.73 122.59 29.44 34.92-0.45 69.95-6.06 102.77-18.2 28.86-10.72 55.91-26.55 78.91-47.07 21.44-19 39.28-41.96 52.89-67.15 6.82-12.85 13.12-26.08 16.97-40.15 11.36-40.22 13.33-83.81 1.18-124.09-10.05-33.78-30.73-63.89-57.14-87.02-11.68-10.22-24.16-19.59-37.54-27.47-11.82-6.64-24.73-11.16-37.9-14.25 9.18 35.9 19 71.65 28.31 107.52 1.58 8.6 3.16 17.2 4.64 25.82 1.36 37.01-11.62 74.29-35.49 102.6-22.24 26.68-53.82 45.45-87.98 51.9-36.82 7.34-76.41 0.41-108.03-20-30.19-19.14-52.49-49.45-64.25-83-6.66-18.77-9.98-38.62-10.64-58.5-2.02-43.25 9.29-87.44 34.03-123.21 29.07-42.69 74.9-72.04 124.04-86.36-3.62-13.84-7.32-27.66-10.98-41.5-9.49-29.87-7.47-63.41 6.69-91.49 7.64-15.67 19-29.32 32.14-40.67 14.63-12.51 31.71-22.39 50.33-27.51M486.64 430.56c-13.18 13.84-22.42 31.34-26.4 50.02-3.58 16.96-3.6 34.64-0.38 51.65 3.93 18.79 13.63 37.17 29.71 48.26 12.48 8.86 28.73 11.55 43.62 8.64 27.55-4.84 50.03-30.19 50.8-58.24-1.05-6.95-2.2-13.9-4.16-20.66-10.29-38.92-20.67-77.81-30.9-116.75-23.28 7.18-45.44 19.28-62.29 37.08z" fill="#ffffff"/>
        </svg>`
      }
    },
    {
      id: 'follower-weibo',
      type: 'follower',
      order: 6,
      enabled: true,
      config: {
        id: 'follower-weibo',
        platform: 'weibo',
        title: '新浪微博',
        color: 'yellow',
        apiUrl: 'https://api.swo.moe/stats/weibo/5574382615',
        homepageUrl: 'https://weibo.com/5574382615',
        icon: `<svg class="icon" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
          <path d="M757.142721 501.400594c-39.591717-7.653307-20.312628-28.559453-20.312628-28.559453s38.734186-63.074547-7.748475-108.983133c-57.487296-56.781214-197.431581 7.147794-197.431581 7.147794-53.370535 16.314571-39.249933-7.482415-31.680537-47.948035 0-47.772027-16.524348-128.522142-158.877497-80.923054C198.914864 290.249547 76.868203 458.387965 76.868203 458.387965-7.990486 570.08286 3.20039 656.447856 3.20039 656.447856c21.168112 190.756555 226.526223 243.119133 386.265344 255.530814 168.005388 12.925381 394.875442-57.126069 463.552591-201.294562C921.87353 566.341652 796.904307 509.221724 757.142721 501.400594zM401.854902 858.254072c-166.79891 7.649214-301.746392-74.803683-301.746392-184.631044 0-110.0003 134.947482-198.066031 301.746392-205.720362 166.972872-7.648191 302.098409 60.3546 302.098409 170.011068C703.952288 747.57532 568.827775 850.77268 401.854902 858.254072zM368.636337 540.16548C200.803887 559.543829 220.253868 714.597231 220.253868 714.597231s-1.718131 49.133024 44.930305 74.125231c98.114598 52.534494 199.326744 20.739347 250.279207-44.37465C566.587758 679.404708 536.642748 520.948813 368.636337 540.16548zM326.291926 757.948575c-31.329543 3.568269-56.631812-14.286378-56.631812-40.127929 0-25.669636 22.372543-52.702316 53.702086-55.930847 35.980469-3.400446 59.387575 17.003256 59.387575 43.012629C382.923738 730.578204 357.447507 754.379283 326.291926 757.948575zM425.268148 674.813133c-10.673084 7.816013-23.750937 6.79987-29.265534-2.716878-5.847172-9.188266-3.613294-23.810289 7.059789-31.456433 12.394285-9.184173 25.303292-6.459109 30.981618 2.717901C439.558619 652.538827 435.596378 666.647149 425.268148 674.813133zM838.903863 434.247148c13.596669 0 24.959461-9.862625 27.027563-22.780843 0.171915-1.023306 0.336668-1.871627 0.336668-2.894933 20.48966-181.740204-150.95506-150.455687-150.95506-150.455687-15.146978 0-27.370371 12.06785-27.370371 27.370371 0 14.963807 12.223393 27.031657 27.370371 27.031657 123.07406-26.864858 96.051613 94.691639 96.051613 94.691639C811.194778 422.173159 823.585993 434.247148 838.903863 434.247148zM818.939159 117.002784c-59.214636-13.769608-120.323413-1.868557-137.364531 1.354857-1.379417 0.172939-2.579755 1.36816-3.78521 1.533936-0.51677 0.172939-1.033539 0.677429-1.033539 0.677429-16.865109 4.764514-29.089525 20.060895-29.089525 38.255279 0 21.589714 17.724687 39.438221 39.932478 39.438221 0 0 21.516036-2.888793 36.152385-8.498558 14.452153-5.77554 137.355321-4.246721 198.287065 96.737228 33.232892 73.785493 14.637372 123.091456 12.229532 131.079384 0 0-7.92039 19.215644-7.92039 38.08234 0 21.762653 17.73185 35.536354 39.932478 35.536354 18.421558 0 33.913391-2.550079 38.388309-33.32192l0.171915 0C1070.594713 242.472404 924.969031 141.315516 818.939159 117.002784z" fill="#ffffff"/>
        </svg>`
      }
    },
    {
      id: 'music-player',
      type: 'musicPlayer',
      order: 7,
      enabled: true,
      config: { id: 'music-player-card', rowSpan: 2 }
    },
    {
      id: 'contact',
      type: 'contact',
      order: 8,
      enabled: true,
      config: { id: 'contact-card', colSpan: 2 }
    },
    {
      id: 'xingtone',
      type: 'xingtone',
      order: 9,
      enabled: true,
      config: { id: 'xingtone-card' }
    },
    {
      id: 'video-0',
      type: 'video',
      order: 10,
      enabled: true,
      config: { id: 'video-card-0', videoIndex: 0 }
    },
    {
      id: 'video-1',
      type: 'video',
      order: 11,
      enabled: true,
      config: { id: 'video-card-1', videoIndex: 1 }
    },
    {
      id: 'video-2',
      type: 'video',
      order: 12,
      enabled: true,
      config: { id: 'video-card-2', videoIndex: 2 }
    },
    {
      id: 'video-3',
      type: 'video',
      order: 13,
      enabled: true,
      config: { id: 'video-card-3', videoIndex: 3 }
    }
  ]
};

/** 默认视频数据（转录自 src/js/videoData.js，补充 id / bvid / source 等字段） */
export const DEFAULT_VIDEOS = [
  {
    id: 'm_0',
    bvid: 'BV151SxBHEcx',
    title: '送你一朵小红花',
    description: '6P各唱各挑战，冬日暖心特供！！',
    cover: '/img/video/40c1c0f94f7cae263a9dd9e77c1ce07a2900c430.jpg',
    url: 'https://www.bilibili.com/video/BV151SxBHEcx/',
    cooperation: true,
    source: 'manual',
    pubdate: null,
    createdAt: null
  },
  {
    id: 'm_1',
    bvid: 'BV1SbkRBgETf',
    title: '三万天',
    description: '三万天荒唐，我跪佛前求一醉',
    cover: '/img/video/0a9ebb32a385d3ebbc281e62b96d12bb4bcca3ef.jpg',
    url: 'https://www.bilibili.com/video/BV1SbkRBgETf/',
    cooperation: true,
    source: 'manual',
    pubdate: null,
    createdAt: null
  },
  {
    id: 'm_2',
    bvid: 'BV1Fa2TBBExb',
    title: '依然爱你',
    description: '星瞳2025生贺',
    cover: '/img/video/336595a299a8501e89301abc89a1642ded495ed9.jpg',
    url: 'https://www.bilibili.com/video/BV1Fa2TBBExb/',
    cooperation: true,
    source: 'manual',
    pubdate: null,
    createdAt: null
  },
  {
    id: 'm_3',
    bvid: 'BV159sEzxEPW',
    title: '向着深空和群星',
    description: '超可爱滴4P翻唱',
    cover: '/img/video/a6c9a4f39879538523c7422c0d631d0c54d0fe53.jpg',
    url: 'https://www.bilibili.com/video/BV159sEzxEPW/',
    cooperation: true,
    source: 'manual',
    pubdate: null,
    createdAt: null
  },
  {
    id: 'm_4',
    bvid: 'BV1Ze4VzDE8D',
    title: '啊！美丽卡洛',
    description: '没必要时刻清醒的活着',
    cover: '/img/video/0063def5f9f82131ef67e0b11172b675324f055c.jpg',
    url: 'https://www.bilibili.com/video/BV1Ze4VzDE8D/',
    cooperation: false,
    source: 'manual',
    pubdate: null,
    createdAt: null
  },
  {
    id: 'm_5',
    bvid: 'BV1mQpTzgE6H',
    title: '僕らはそれを愛と呼んだ',
    description: '茜色天空下，我们称其为爱...',
    cover: '/img/video/b3934a7d31adc67fffb1924fb1d5118409bdac12.jpg',
    url: 'https://www.bilibili.com/video/BV1mQpTzgE6H/',
    cooperation: false,
    source: 'manual',
    pubdate: null,
    createdAt: null
  },
  {
    id: 'm_6',
    bvid: 'BV1hSpFzbEcQ',
    title: '新春游园',
    description: '少年音碰撞出的火花',
    cover: '/img/video/26566174c3803e1756ccf0e7e50a5cd481b7ce31.jpg',
    url: 'https://www.bilibili.com/video/BV1hSpFzbEcQ/',
    cooperation: true,
    source: 'manual',
    pubdate: null,
    createdAt: null
  },
  {
    id: 'm_7',
    bvid: 'BV1diaYzUEkm',
    title: 'Supernova',
    description: '拖了一年的超级大转盘',
    cover: '/img/video/311431844d27e04c30aa8dc50b8b95f4e91406b5.jpg',
    url: 'https://www.bilibili.com/video/BV1diaYzUEkm/',
    cooperation: true,
    source: 'manual',
    pubdate: null,
    createdAt: null
  },
  {
    id: 'm_8',
    bvid: 'BV14FQJYKEDv',
    title: '衡山路宛平路',
    description: '地球很好，但我想去厚嘴唇星转转',
    cover: '/img/video/c969568beda576611815c116338d8025f1122252.jpg',
    url: 'https://www.bilibili.com/video/BV14FQJYKEDv/',
    cooperation: false,
    source: 'manual',
    pubdate: null,
    createdAt: null
  },
  {
    id: 'm_9',
    bvid: 'BV1eLXkY7ERQ',
    title: '春を待つ',
    description: '那一定是春风携走了你',
    cover: '/img/video/0acb0043dedbbca47fe34c8596c5e726cf26a11f.jpg',
    url: 'https://www.bilibili.com/video/BV1eLXkY7ERQ/',
    cooperation: false,
    source: 'manual',
    pubdate: null,
    createdAt: null
  },
  {
    id: 'm_10',
    bvid: 'BV1v6XpYbEM2',
    title: '明月天涯',
    description: '宗门七侠翻唱燃爆江湖',
    cover: '/img/video/8498895ca87fe2d6789ae154ba7105a291fd97cd.jpg',
    url: 'https://www.bilibili.com/video/BV1v6XpYbEM2/',
    cooperation: true,
    source: 'manual',
    pubdate: null,
    createdAt: null
  },
  {
    id: 'm_11',
    bvid: 'BV1TF9pYDELQ',
    title: '回信Retter',
    description: 'ChiliChill五周年生贺曲',
    cover: '/img/video/946ca84f5e2937210f40e08cb98274e744bf2f34.jpg',
    url: 'https://www.bilibili.com/video/BV1TF9pYDELQ/',
    cooperation: true,
    source: 'manual',
    pubdate: null,
    createdAt: null
  },
  {
    id: 'm_12',
    bvid: 'BV1Tk9FYXEnY',
    title: '混入人类计划',
    description: '谢谢你，我也爱你',
    cover: '/img/video/d1cefdcf4f2e6f50e5aa54e334057f9854272480.jpg',
    url: 'https://www.bilibili.com/video/BV1Tk9FYXEnY/',
    cooperation: false,
    source: 'manual',
    pubdate: null,
    createdAt: null
  },
  {
    id: 'm_13',
    bvid: 'BV19FXoY9Ewo',
    title: '屑屑',
    description: '别卷啦！来听12p多人翻唱！',
    cover: '/img/video/42a6c91398da9e05391e19e4d320f8e221f2e506.jpg',
    url: 'https://www.bilibili.com/video/BV19FXoY9Ewo/',
    cooperation: true,
    source: 'manual',
    pubdate: null,
    createdAt: null
  },
  {
    id: 'm_14',
    bvid: 'BV1FafDYcEj5',
    title: '与你共舞半生梦',
    description: '33P新年原创曲',
    cover: '/img/video/7b2cb42a108f355d9499cb592b75be275a93d453.jpg',
    url: 'https://www.bilibili.com/video/BV1FafDYcEj5/',
    cooperation: true,
    source: 'manual',
    pubdate: null,
    createdAt: null
  },
  {
    id: 'm_15',
    bvid: 'BV1aW421c7Gw',
    title: '玻璃弹珠',
    description: 'ChiliChill四周年生贺曲',
    cover: '/img/video/40cb87af46a9627941d628917202429943dd1a30.jpg',
    url: 'https://www.bilibili.com/video/BV1aW421c7Gw/',
    cooperation: true,
    source: 'manual',
    pubdate: null,
    createdAt: null
  },
  {
    id: 'm_16',
    bvid: 'BV1kc411d7Sm',
    title: '迈向光的我',
    description: '2023纳西妲生日会',
    cover: '/img/video/ae8bebc8548a8ce6c5a7f46b4a5e7b08579a733e.jpg',
    url: 'https://www.bilibili.com/video/BV1kc411d7Sm/',
    cooperation: true,
    source: 'manual',
    pubdate: null,
    createdAt: null
  }
];

/**
 * 深度合并两个配置对象（override 优先）
 * 用于 KV 配置与默认配置合并，保证新增字段有默认值
 * - 普通对象递归合并；数组与其他类型的值直接用 override 覆盖
 * - override 中值为 undefined 的字段忽略
 * @param {object} base 基础配置（默认值）
 * @param {object} override 覆盖配置（KV 存储值）
 * @returns {object} 合并后的新对象（不修改入参）
 */
export function deepMergeConfig(base, override) {
  const isPlainObject = (v) =>
    v !== null && typeof v === 'object' && !Array.isArray(v);

  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override === undefined ? base : override;
  }

  const result = { ...base };
  for (const key of Object.keys(override)) {
    const overrideValue = override[key];
    if (overrideValue === undefined) continue;
    if (isPlainObject(base[key]) && isPlainObject(overrideValue)) {
      result[key] = deepMergeConfig(base[key], overrideValue);
    } else {
      result[key] = overrideValue;
    }
  }
  return result;
}
