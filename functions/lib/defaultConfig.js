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
  }
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
