// src/utils/dataService.js (最终版：新浪财经 + Vercel代理)

import { STOCK_PROFILES } from './constants';

// --- 模拟数据生成 (保留作为兜底) ---
const seededRandom = (seed) => { let state = seed ? seed : 12345; return () => { state = (1103515245 * state + 12345) % 0x80000000; return state / 0x80000000; }; };
const stringToSeed = (str) => { let hash = 0; for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash) + str.charCodeAt(i); return Math.abs(hash); };

export const generateMockData = (tickerCode, startDateStr, endDateStr) => {
  // 简单的模拟数据逻辑，防止新浪接口挂了没东西看
  let price = 100;
  const data = [];
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const seed = stringToSeed(tickerCode);
  const random = seededRandom(seed);
  
  // 稍微多生成一点数据确保均线能计算
  const preStart = new Date(start);
  preStart.setDate(preStart.getDate() - 60);

  for (let d = preStart; d <= end; d.setDate(d.getDate() + 1)) {
     if(d.getDay()===0||d.getDay()===6) continue;
     const change = (random() - 0.5) * 0.04;
     price = price * (1 + change);
     if(price < 1) price = 1;
     
     const dateStr = d.toISOString().split('T')[0];
     // 只保留用户选择日期范围内的数据
     if (dateStr >= startDateStr) {
         data.push({ 
             date: dateStr, 
             close: parseFloat(price.toFixed(2)), 
             open: parseFloat((price * (1 + (random()-0.5)*0.01)).toFixed(2)), 
             high: parseFloat((price * 1.02).toFixed(2)), 
             low: parseFloat((price * 0.98).toFixed(2)), 
             volume: Math.floor(random() * 1000000) 
         });
     }
  }
  return data;
};

// --- 核心：通过 Vercel 代理获取新浪财经数据 ---
// 注意：函数名保持 fetchTushareData 不变，为了兼容 App.jsx 的调用
export const fetchTushareData = async (token, tsCode, startDate, endDate) => {
  
  // 1. 格式转换：把 600519.SH 转成 sh600519
  let sinaCode = tsCode.toLowerCase().replace('.', ''); 
  if (sinaCode.endsWith('sh')) sinaCode = 'sh' + sinaCode.replace('sh', ''); 
  else if (sinaCode.endsWith('sz')) sinaCode = 'sz' + sinaCode.replace('sz', ''); 

  try {
    // 2. 请求我们自己的 Vercel 后端代理
    // 路径是 /api/sina，带上 symbol 参数
    const response = await fetch(`/api/sina?symbol=${sinaCode}`);

    if (!response.ok) {
      throw new Error(`Proxy Error: ${response.status}`);
    }

    const rawData = await response.json();

    if (!Array.isArray(rawData) || rawData.length === 0) {
      // 如果新浪没返回数据，可能是代码错了或者停牌
      throw new Error("No data from Sina (Check Stock Code)");
    }

    // 3. 数据清洗
    // 新浪返回字段：day, open, high, low, close, volume
    const cleanData = rawData.map(item => ({
      date: item.day,
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close),
      volume: parseFloat(item.volume)
    })).filter(item => item.date >= startDate && item.date <= endDate);

    if (cleanData.length === 0) {
      throw new Error("No data in selected date range");
    }

    return cleanData;

  } catch (err) {
    console.error("Fetch Error:", err);
    // 抛出错误让前端显示
    throw new Error(err.message || "Data Fetch Failed");
  }
};

// --- 脚本生成 (新浪版不需要脚本了) ---
export const getPythonScript = () => {
  return "# Using Sina Finance Public API via Vercel Proxy.\n# No local script or token required!\n# Just click 'Run Backtest'.";
};