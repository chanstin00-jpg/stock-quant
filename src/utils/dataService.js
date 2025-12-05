// src/utils/dataService.js
import { STOCK_PROFILES } from './constants';

// --- 辅助函数：确定性随机数 (为了让模拟数据每次刷新都不变) ---
const seededRandom = (seed) => {
  const m = 0x80000000;
  const a = 1103515245;
  const c = 12345;
  let state = seed ? seed : Math.floor(Math.random() * (m - 1));
  return () => {
    state = (a * state + c) % m;
    return state / (m - 1);
  };
};

const stringToSeed = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

// --- 核心功能：生成模拟数据 ---
export const generateMockData = (tickerCode, startDateStr, endDateStr) => {
  // 尝试从配置中找到对应的股票配置，如果找不到（比如自定义代码）就用默认逻辑
  let profile = STOCK_PROFILES[Object.keys(STOCK_PROFILES).find(k => STOCK_PROFILES[k].ts_code === tickerCode)];
  
  const seed = stringToSeed(tickerCode + "2024"); 
  const random = seededRandom(seed);

  if (!profile) {
    profile = {
      startPrice: 10 + (random() * 200),
      volatility: 0.015 + (random() * 0.03),
      trend: (random() - 0.5) * 0.002
    };
  }

  let price = profile.startPrice;
  const data = [];
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const diffTime = Math.abs(end - start);
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // 向前多生成50天，确保第一天就有均线数据
  const preRollDays = 50; 
  let currentDate = new Date(start);
  currentDate.setDate(currentDate.getDate() - preRollDays);
  const totalDays = days + preRollDays;

  for (let i = 0; i <= totalDays; i++) {
    const r1 = random();
    const r2 = random();
    const r3 = random();
    // 模拟布朗运动 + 趋势项
    const change = (r1 - 0.48) * profile.volatility + profile.trend; 
    price = price * (1 + change);
    if (price < 0.01) price = 0.01;
    
    const dateStr = currentDate.toISOString().split('T')[0];
    
    // 模拟 High/Low
    const high = price * (1 + r2 * 0.015);
    const low = price * (1 - r3 * 0.015);
    
    data.push({
      date: dateStr,
      open: parseFloat(price.toFixed(2)),
      close: parseFloat(price.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      volume: Math.floor(random() * 1000000)
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return data;
};

// --- 核心功能：Tushare API 请求 ---
export const fetchTushareData = async (token, tsCode, startDate, endDate) => {
  if (!tsCode) throw new Error("Code Invalid");

  try {
    // 注意：这里假设你本地有个代理后端运行在 3001 端口
    // 如果没有后端，浏览器会报 CORS 跨域错误，这是 Tushare 官方限制的
    const response = await fetch('http://localhost:3001/api/stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ts_code: tsCode }) 
    });

    if (!response.ok) throw new Error(`Backend Error: ${response.status}`);
    
    const allData = await response.json();
    
    if (!Array.isArray(allData) || allData.length === 0) {
      throw new Error("No data found for this stock");
    }

    const filteredData = allData.filter(item => 
      item.date >= startDate && item.date <= endDate
    );

    if (filteredData.length === 0) throw new Error("No data in selected range");

    return filteredData;
  } catch (error) {
    console.error("Fetch error:", error);
    // 抛出特定错误供前端捕获，提示用户使用脚本模式
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        throw new Error('CORS_BLOCK');
    }
    throw error;
  }
};

// --- 辅助功能：生成 Python 脚本 ---
// 将原来 App.jsx 里那两大段字符串移到这里，参数动态传入
export const getPythonScript = (type, { token, tsCode, startDate, endDate }) => {
  if (type === 'tushare') {
    return `import tushare as ts
import json

token = '${token}'
pro = ts.pro_api(token)
df = pro.daily(ts_code='${tsCode}', start_date='${startDate.replace(/-/g,'')}', end_date='${endDate.replace(/-/g,'')}')
data = []
for index, row in df.iterrows():
    data.append({
        "date": row['trade_date'][:4] + '-' + row['trade_date'][4:6] + '-' + row['trade_date'][6:],
        "open": row['open'], "close": row['close'],
        "high": row['high'], "low": row['low'], "volume": row['vol']
    })
data.reverse()
print(json.dumps(data))`;
  } 
  
  if (type === 'baostock') {
    // 简单的转换：600519.SH -> sh.600519
    const parts = tsCode.split('.');
    const bsCode = parts.length === 2 ? parts[1].toLowerCase() + '.' + parts[0] : tsCode;

    return `import baostock as bs
import pandas as pd
import json
lg = bs.login()
rs = bs.query_history_k_data_plus("${bsCode}", "date,open,high,low,close,volume", start_date='${startDate}', end_date='${endDate}', frequency="d", adjustflag="3")
data_list = []
while (rs.error_code == '0') & rs.next():
    row = rs.get_row_data()
    data_list.append({ "date": row[0], "open": float(row[1]), "high": float(row[2]), "low": float(row[3]), "close": float(row[4]), "volume": float(row[5]) })
bs.logout()
print(json.dumps(data_list))`;
  }

  return '';
};