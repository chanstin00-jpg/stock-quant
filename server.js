import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// 辅助函数：转换代码格式
const convertToSinaCode = (inputCode) => {
  // 安全检查
  if (!inputCode || typeof inputCode !== 'string') {
    throw new Error(`无效的股票代码格式: ${inputCode}`);
  }
  
  if (inputCode.includes('.')) {
    const [code, market] = inputCode.split('.');
    return `${market.toLowerCase()}${code}`;
  } else {
    // 简单容错
    if (inputCode.startsWith('6')) return `sh${inputCode}`;
    if (inputCode.startsWith('0') || inputCode.startsWith('3')) return `sz${inputCode}`;
    return `sh${inputCode}`;
  }
};

app.post('/api/stock', async (req, res) => {
  try {
    // !!! 修正点在这里 !!!
    // 1. 从前端拿到的参数名是 ts_code (带下划线)
    const { ts_code } = req.body; 
    
    console.log("------------------------------------------------");
    console.log(`1. 收到前端请求，参数:`, req.body);

    // 2. 调用函数时，必须使用上面定义好的 ts_code (带下划线)
    // 之前这里写成了 tsCode 导致报错，现在改好了
    const sinaCode = convertToSinaCode(ts_code); 
    
    console.log(`2. 转换后的新浪代码: ${sinaCode}`);

    const url = `https://quotes.sina.cn/cn/api/json_v2.php/CN_MarketDataService.getKLineData?symbol=${sinaCode}&scale=240&ma=no&datalen=1023`;
    
    console.log(`3. 正在请求新浪API...`);
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1'
      }
    });

    const rawData = response.data;
    console.log(`4. 新浪返回数据类型: ${Array.isArray(rawData) ? '数组 (正常)' : typeof rawData}`);

    if (!Array.isArray(rawData)) {
      console.error("异常数据内容:", rawData);
      throw new Error("新浪接口未返回有效数据（可能是股票代码不支持或停牌）");
    }

    const formattedData = rawData.map(item => ({
      date: item.day,
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close),
      volume: parseFloat(item.volume)
    }));

    console.log(`5. 处理成功，返回 ${formattedData.length} 条数据`);
    res.json(formattedData);

  } catch (error) {
    console.error("!!! 后端报错 !!!");
    console.error("错误信息:", error.message);
    res.status(500).json({ msg: error.message });
  }
});

app.listen(3001, () => {
  console.log('后端服务器(新浪最终修正版)已启动: http://localhost:3001');
});