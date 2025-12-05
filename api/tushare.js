// api/tushare.js
// 这是一个运行在 Vercel 服务器端的“中间人”脚本

export default async function handler(request, response) {
  // 1. 设置允许跨域 (CORS)，这样你的网页才能访问这个接口
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // 如果是预检请求 (OPTIONS)，直接返回 OK
  if (request.method === 'OPTIONS') {
    response.status(200).end();
    return;
  }

  // 只处理 POST 请求
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 2. 这里的 request.body 就是你前端传过来的 { token, ts_code, start_date ... }
    const tushareBody = request.body;

    // 3. 由 Vercel 服务器代替浏览器，向 Tushare 发起请求
    // 注意：Tushare 的官方 API 地址是 http://api.tushare.pro
    const tushareResponse = await fetch('http://api.tushare.pro', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tushareBody),
    });

    const data = await tushareResponse.json();

    // 4. 把 Tushare 返回的数据，原封不动地返回给你的前端
    return response.status(200).json(data);

  } catch (error) {
    console.error('Proxy Error:', error);
    return response.status(500).json({ error: 'Failed to fetch data from Tushare' });
  }
}