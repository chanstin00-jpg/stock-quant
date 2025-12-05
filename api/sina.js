// api/sina.js
// 修复版：使用更稳定的 PC 端接口，并增强伪装

export default async function handler(request, response) {
  // 1. 设置跨域头
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (request.method === 'OPTIONS') {
    response.status(200).end();
    return;
  }

  const { symbol } = request.query;

  if (!symbol) {
    return response.status(400).json({ error: 'Missing symbol parameter' });
  }

  try {
    // 2. 更换接口地址：使用 money.finance.sina.com.cn (PC端接口，通常反爬较松)
    // 这里的 symbol 格式应该是 sh600519
    const sinaUrl = `https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=${symbol}&scale=240&ma=no&datalen=3000`;

    // 3. 增强伪装：添加 Referer 和 Host
    const sinaResponse = await fetch(sinaUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://finance.sina.com.cn/',
        'Accept': '*/*',
        'Host': 'money.finance.sina.com.cn'
      }
    });

    // 4. 错误处理增强：先尝试按文本读取，防止新浪返回 HTML 报错导致 JSON 解析失败
    const rawText = await sinaResponse.text();
    
    // 尝试解析 JSON
    let data;
    try {
        data = JSON.parse(rawText);
    } catch (e) {
        // 如果解析失败，说明新浪返回的可能不是数据，而是报错页面
        console.error("Sina Response is not JSON:", rawText.slice(0, 100)); // 只打印前100字
        return response.status(500).json({ error: 'Sina blocked the request or returned invalid data.' });
    }

    // 5. 检查数据有效性
    if (!Array.isArray(data)) {
        // 有时候新浪会返回 null
        return response.status(200).json([]); // 返回空数组防止前端报错
    }

    return response.status(200).json(data);

  } catch (error) {
    console.error('Sina Proxy Error:', error);
    return response.status(500).json({ error: error.message });
  }
}