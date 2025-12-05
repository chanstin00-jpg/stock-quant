export default async function handler(request, response) {
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
    const sinaUrl = `https://quotes.sina.cn/cn/api/json_v2.php/CN_MarketData.getKLineData?symbol=${symbol}&scale=240&ma=no&datalen=3000`;

    // --- 关键修改点：添加 User-Agent 伪装成浏览器 ---
    const sinaResponse = await fetch(sinaUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://finance.sina.com.cn/'
      }
    });
    // ---------------------------------------------

    const data = await sinaResponse.json();

    // 检查新浪是否返回了空数组（有时候代码没错但新浪没数据）
    if (!Array.isArray(data)) {
        console.error("Sina returned invalid data:", data);
        return response.status(500).json({ error: 'Sina API invalid response' });
    }

    return response.status(200).json(data);

  } catch (error) {
    console.error('Sina Proxy Error:', error);
    return response.status(500).json({ error: 'Failed to fetch data from Sina' });
  }
}