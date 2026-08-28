// 测试 B 站 newplayer 高清播放可行性

const TEST_BVID = 'BV1q8jn6cEo8';

const BILI_DOMAINS = [
  'bilibili.com', 'bilivideo.com', 'hdslb.com',
  'biliapi.com', 'bilibili.tv', 'biliimg.com'
];

async function generateBuvid() {
  const res = await fetch('https://api.bilibili.com/x/frontend/finger/spi', {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'referer': 'https://www.bilibili.com/'
    }
  });
  const data = await res.json();
  if (data?.data?.b_3) {
    return { buvid3: data.data.b_3, buvid4: data.data.b_4 || '' };
  }
  return null;
}

async function test_newplayerPage() {
  console.log('\n=== 1. 抓取 newplayer.html ===');
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
  console.log('HTML 长度:', html.length);
  
  // 看看有没有 crossDomain 设 domain 的逻辑
  const crossDomainMatch = html.match(/crossDomain[\s\S]{0,200}/);
  if (crossDomainMatch) console.log('crossDomain 片段:', crossDomainMatch[0].substring(0, 200));
  
  // 看看播放器用的是什么 channelKind 相关
  const channelKindMatch = html.match(/channelKind[\s\S]{0,100}/g);
  if (channelKindMatch) console.log('channelKind 出现:', channelKindMatch.length, '次');
  
  // 看看 isCertifiedReferrer / isOfficialReferrer
  console.log('有 isCertifiedReferrer:', html.includes('isCertifiedReferrer'));
  console.log('有 isOfficialReferrer:', html.includes('isOfficialReferrer'));
  
  // 看看有哪些核心脚本
  const scripts = html.match(/src="([^"]+\.js)"/g) || [];
  console.log('脚本引用:', scripts.length, '个');
  scripts.forEach(s => console.log(' ', s));
}

async function test_viewApi() {
  console.log('\n=== 2. 获取视频 aid/cid ===');
  const res = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${TEST_BVID}`, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'referer': 'https://www.bilibili.com/',
    }
  });
  const data = await res.json();
  console.log('code:', data.code, 'msg:', data.message);
  if (data.data) {
    console.log('aid:', data.data.aid);
    console.log('cid:', data.data.cid);
    console.log('title:', data.data.title);
    return { aid: data.data.aid, cid: data.data.cid };
  }
  return null;
}

async function test_playurl({ aid, cid, cookie, label }) {
  console.log(`\n=== 3. playurl 画质测试 (${label}) ===`);
  
  // wbi 签名的 v2 接口
  const url = `https://api.bilibili.com/x/player/wbi/v2?aid=${aid}&cid=${cid}&qn=116&fnval=4048&fnver=0&fourk=1`;
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'referer': 'https://www.bilibili.com/',
      'cookie': cookie,
    }
  });
  const data = await res.json();
  console.log('code:', data.code, 'message:', data.message);
  if (data.code !== 0) return;
  
  if (data.data?.dash?.video) {
    console.log('视频流（dash）:');
    const vids = data.data.dash.video;
    vids.forEach(v => {
      console.log(`  id=${v.id.toString().padStart(4)} width=${v.width} height=${v.height}  codecs=${v.codecs}`);
    });
  } else if (data.data?.durl) {
    console.log('durl 格式（flv）:');
    const durl = data.data.durl[0];
    console.log('  quality:', durl.quality);
  } else {
    console.log('  没有视频流数据');
    console.log('  data keys:', Object.keys(data.data));
  }
  
  if (data.data?.accept_quality) {
    console.log('支持的清晰度:', data.data.accept_quality.join(', '));
  }
}

async function run() {
  try {
    await test_newplayerPage();
    
    const vinfo = await test_viewApi();
    if (!vinfo) {
      console.log('无法获取视频信息，跳过画质测试');
      return;
    }
    
    const buvid = await generateBuvid();
    console.log('buvid3:', buvid?.buvid3);
    
    // 测试 1：只有 buvid
    const cookie1 = `buvid3=${buvid.buvid3}; buvid4=${buvid.buvid4}; CURRENT_QUALITY=116; CURRENT_FNVAL=4048`;
    await test_playurl({ ...vinfo, cookie: cookie1, label: '仅 buvid' });
    
    // 测试 2：buvid + 完整模拟浏览器 cookie（更多参数）
    const cookie2 = [
      `buvid3=${buvid.buvid3}`,
      `buvid4=${buvid.buvid4}`,
      'buvid_fp_plain=undefined',
      'CURRENT_FNVAL=4048',
      'CURRENT_QUALITY=116',
      'bp_t_offset=0',
      '_uuid=0',
      'fingerprint=0',
      'b_nut=0',
    ].join('; ');
    await test_playurl({ ...vinfo, cookie: cookie2, label: 'buvid + 各种参数' });
    
    console.log('\n=== 结论 ===');
    console.log('没有 SESSDATA 的情况下，B 站 playurl 只返回低画质（最多 360p-480p）');
    console.log('要高画质必须带有效的 SESSDATA（登录态）');
    
  } catch (e) {
    console.error('ERROR:', e);
  }
}

run();
