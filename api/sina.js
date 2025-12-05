// api/sina.js
// 这是一个运行在 Vercel 服务器端的“新浪财经”代理

export default async function handler(request, response) {
  // 1. 设置 CORS 允许跨域（允许你的网页访问这个接口）
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // 处理预检请求
  if (request.method === 'OPTIONS') {
    response.status(200).end();
    return;
  }

  // 2. 获取前端传来的股票代码 (symbol)，例如 sh600519
  const { symbol } = request.query;

  if (!symbol) {
    return response.status(400).json({ error: 'Missing symbol parameter' });
  }

  try {
    // 3. 构造新浪财经 API 地址
    // scale=240 代表日线, datalen=3000 获取最近3000天数据
    const sinaUrl = `https://quotes.sina.cn/cn/api/json_v2.php/CN_MarketData.getKLineData?symbol=${symbol}&scale=240&ma=no&datalen=3000`;

    // 4. 服务器代为请求新浪
    const sinaResponse = await fetch(sinaUrl);
    const data = await sinaResponse.json();

    // 5. 返回数据给前端
    return response.status(200).json(data);

  } catch (error) {
    console.error('Sina Proxy Error:', error);
    return response.status(500).json({ error: 'Failed to fetch data from Sina' });
  }
}