// 测试 B 站代理播放流程
import { isBiliHost, generateBuvid, BILI_DOMAINS, buildInjectScript, parseBuvidCookie } from './functions/api/bili-proxy.js';

const TEST_BVID = 'BV1q8jn6cEo8';

async function test1_newplayerPage() {
  console.log('\n=== 测试 1: 抓取 newplayer.html ===');
  const url = `https://www.bilibili.com/blackboard/newplayer.html?crossDomain=true&bvid=${TEST_BVID}&as_wide=1&page=0&autoplay=1&poster=1`;
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'referer': 'https://www.bilibili.com/',
    }
  });
  console.log('status:', res.status);
  console.log('x-frame-options:', res.headers.get('x-frame-options'));
  console.log('content-type:', res.headers.get('content-type'));
  const html = await res.text();
  console.log('长度:', html.length);
  console.log('包含 </head>:', html.includes('</head>'));
  console.log('包含 PlayerUtil:', html.includes('PlayerUtil'));
  console.log('包含 isCertifiedReferrer:', html.includes('isCertifiedReferrer'));
  console.log('包含 nano.createPlayer:', html.includes('nano.createPlayer'));
}

async function test2_generateBuvid() {
  console.log('\n=== 测试 2: 生成 buvid ===');
  const buvid = await generateBuvid();
  console.log('buvid3:', buvid?.buvid3 || 'null');
  console.log('buvid4:', buvid?.buvid4 || 'null');
}

async function test3_playurlNoLogin() {
  console.log('\n=== 测试 3: playurl 接口（无登录态，只有 buvid） ===');
  // 先拿 cid
  const cidRes = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${TEST_BVID}`, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'referer': 'https://www.bilibili.com/',
    }
  });
  const cidData = await cidRes.json();
  const cid = cidData.data?.cid;
  const aid = cidData.data?.aid;
  console.log('aid:', aid, 'cid:', cid);
  console.log('title:', cidData.data?.title);

  // 生成 buvid
  const buvid = await generateBuvid();
  const cookie = `buvid3=${buvid.buvid3}; buvid4=${buvid.buvid4}; CURRENT_QUALITY=116; CURRENT_FNVAL=4048`;

  const playurlRes = await fetch(
    `https://api.bilibili.com/x/player/wbi/v2?aid=${aid}&cid=${cid}&qn=116&fnval=4048&fnver=0&fourk=1`,
    {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'referer': 'https://www.bilibili.com/',
        'cookie': cookie,
      }
    }
  );
  const playData = await playurlRes.json();
  console.log('code:', playData.code, 'message:', playData.message);
  if (playData.data?.dash) {
    const videos = playData.data.dash.video || [];
    console.log('视频流数量:', videos.length);
    videos.forEach(v => {
      console.log(`  id=${v.id} (quality), width=${v.width}, height=${v.height}, codecs=${v.codecs}`);
    });
  } else {
    console.log('没有 dash 数据');
    console.log('data 字段:', Object.keys(playData.data || {}));
  }
}

async function test4_injectScript() {
  console.log('\n=== 测试 4: 注入脚本 ===');
  const script = buildInjectScript();
  console.log('脚本长度:', script.length, '字符');
  console.log('包含 isCertifiedReferrer 伪造:', script.includes('isCertifiedReferrer'));
  console.log('包含 fetch 劫持:', script.includes('window.fetch'));
  console.log('包含 Image.src 劫持:', script.includes('HTMLImageElement'));
  console.log('包含 script.src 劫持:', script.includes('createElement'));
}

async function run() {
  try {
    await test1_newplayerPage();
    await test2_generateBuvid();
    await test3_playurlNoLogin();
    await test4_injectScript();
  } catch (e) {
    console.error('ERROR:', e);
  }
}
run();
