// 网站配置文件 - 存放所有可配置的内容
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
    learnMoreLink: "#"
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
  videos: [
    {
      title: "玻璃弹珠",
      description: "ChiliChill四周年生贺曲",
      cover: "/img/video/40cb87af46a9627941d628917202429943dd1a30.jpg",
      url: "https://www.bilibili.com/video/BV1aW421c7Gw/"
    },
    {
      title: "回信Retter",
      description: "ChiliChill五周年生贺曲",
      cover: "/img/video/946ca84f5e2937210f40e08cb98274e744bf2f34.jpg",
      url: "https://www.bilibili.com/video/BV1TF9pYDELQ/"
    },
    {
      title: "与你共舞半生梦",
      description: "33P新年原创曲",
      cover: "/img/video/7b2cb42a108f355d9499cb592b75be275a93d453.jpg",
      url: "https://www.bilibili.com/video/BV1FafDYcEj5/"
    },
    {
      title: "迈向光的我",
      description: "2023纳西妲生日会",
      cover: "/img/video/ae8bebc8548a8ce6c5a7f46b4a5e7b08579a733e.jpg",
      url: "https://www.bilibili.com/video/BV1kc411d7Sm/"
    }
  ],

  // 联系方式
  contactText: `哔哩哔哩：@知空空睡大觉
网易云音乐：@桐原知空
新浪微博：@知空今天睡醒了吗`,
  // 联系方式卡片"Read more"按钮链接
  contactButtonLink: "#",

  // 音乐播放器配置
  musicPlayer: {
    playlistId: "17479746916"
  }
};

export default siteConfig;