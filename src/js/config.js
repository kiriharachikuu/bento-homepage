// 网站配置文件 - 存放所有可配置的内容
import { videoData } from './videoData.js';

const siteConfig = {
  // 网站基本信息
  site: {
    title: "知空空的空想世界",
    favicon: "/img/favicon.png",
    titleIcon: "/img/title-icon.png"
  },

  // 用户信息
  user: {
    name: "桐原知空",
    title: "唱见 & 啥都会一点的工具人",
    description: "我是<span class=\"font-bold text-xl\">知空</span>，臭唱歌的，超级懒的_(:з」∠)_<br />主坑：VOCALOID/ChiliChill/星瞳/J-POP<br />这里有我的各种作品，联系我请移步此页底，Have fun~",
    avatar: "/img/84007943719010668e3e16e8196f029858bf7b12.jpg",
    learnMoreLink: "#",
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
    bilibili: "https://space.bilibili.com/28826850",
    netease: "https://music.163.com/#/artist?id=34407615",
    weibo: "https://weibo.com/5574382615",
    qqGroup: "https://qm.qq.com/q/DI0y3MAbJK"
  },

  // 粉丝数 API 配置
  fanApis: {
    bilibili: "https://bili-count-api.chikuu.top/api/count?vmid=28826850",
    netease: "https://api.swo.moe/stats/neteasemusic/379188047",
    weibo: "https://api.swo.moe/stats/weibo/5574382615"
  },

  // 视频作品列表
  videos: videoData,

  // 联系方式
  contactText: `哔哩哔哩：@知空空睡大觉
网易云音乐：@桐原知空
新浪微博：@知空今天睡醒了吗`,
  // 联系方式卡片"Read more"按钮链接
  contactButtonLink: "#",

  // 音乐播放器配置
  musicPlayer: {
    playlistId: "17479746916"
  },

  // 备案信息
  beian: {
    enabled: false,
    icpNumber: "",
    icpLink: "https://beian.miit.gov.cn",
    policeNumber: "",
    policeLink: "",
    customText: ""
  }
};

export default siteConfig;
