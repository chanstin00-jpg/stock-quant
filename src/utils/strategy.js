// src/utils/strategy.js
import { TRANSLATIONS } from './constants';

// --- 辅助：计算移动平均线 (用于趋势过滤) ---
const calculateMA = (data, period) => {
  return data.map((item, index) => {
    if (index < period - 1) return { ...item, ma: null };
    const slice = data.slice(index - period + 1, index + 1);
    const sum = slice.reduce((acc, curr) => acc + curr.close, 0);
    return { ...item, ma: sum / period };
  });
};

// --- 指标计算：布林带 ---
export const calculateBollingerBands = (data, window = 20, multiplier = 2) => {
  return data.map((item, index) => {
    if (index < window - 1) return { ...item, mb: null, ub: null, lb: null };
    const slice = data.slice(index - window + 1, index + 1);
    const sum = slice.reduce((acc, curr) => acc + curr.close, 0);
    const mean = sum / window;
    const squaredDiffs = slice.map(curr => Math.pow(curr.close - mean, 2));
    const variance = squaredDiffs.reduce((acc, curr) => acc + curr, 0) / window;
    const stdDev = Math.sqrt(variance);
    return { ...item, mb: mean, ub: mean + (stdDev * multiplier), lb: mean - (stdDev * multiplier) };
  });
};

// --- 指标计算：MACD ---
export const calculateMACD = (data, short = 12, long = 26, mid = 9) => {
  let emaShort = 0;
  let emaLong = 0;
  let dea = 0;

  return data.map((item, index) => {
    const close = item.close;
    
    if (index === 0) {
      emaShort = close;
      emaLong = close;
      dea = 0;
      return { ...item, diff: 0, dea: 0, macd: 0 };
    }

    emaShort = (close * 2 / (short + 1)) + (emaShort * (short - 1) / (short + 1));
    emaLong = (close * 2 / (long + 1)) + (emaLong * (long - 1) / (long + 1));
    
    const diff = emaShort - emaLong;
    dea = (diff * 2 / (mid + 1)) + (dea * (mid - 1) / (mid + 1));
    const macd = (diff - dea) * 2;

    return { ...item, diff, dea, macd };
  });
};

// --- 回测核心引擎 ---
export const runBacktest = (data, initialCapital, strategyConfig, startDateStr, lang) => {
  let processedData = [];
  
  // 1. 根据策略类型计算指标
  if (strategyConfig.type === 'BOLL') {
    processedData = calculateBollingerBands(data, strategyConfig.period, strategyConfig.multiplier);
  } else if (strategyConfig.type === 'MACD') {
    processedData = calculateMACD(data, strategyConfig.short, strategyConfig.long, strategyConfig.signal);
  }

  // 1.1 如果开启了趋势过滤，额外计算 MA60
  if (strategyConfig.useTrendFilter) {
    processedData = calculateMA(processedData, 60);
  }

  // 2. 过滤日期范围
  const validData = processedData.filter(d => d.date >= startDateStr);
  
  let cash = initialCapital;
  let shares = 0;
  let lastBuyPrice = 0; // 记录上次买入价格，用于计算止损
  
  const trades = [];
  const equityCurve = [];
  let winCount = 0;
  let totalTrades = 0;

  const COMMISSION_RATE = 0.0003; 
  const TAX_RATE = 0.001;         
  const MIN_COMMISSION = 5;       
  
  const T = TRANSLATIONS[lang]; 

  // 3. 逐日循环模拟交易
  for (let i = 1; i < validData.length; i++) {
    const today = validData[i];
    const prev = validData[i - 1];
    const price = today.close;
    
    // 风控参数
    const positionRatio = (strategyConfig.positionSize || 100) / 100; // 仓位比例
    const stopLossPct = (strategyConfig.stopLoss || 0) / 100;         // 止损比例
    const takeProfitPct = (strategyConfig.takeProfit || 0) / 100;     // 止盈比例

    let action = null;
    let reason = '';
    
    // --- 优先判断：持仓状态下的止盈止损 (Priority 1) ---
    if (shares > 0) {
      // 检查止损 (Stop Loss)
      if (stopLossPct > 0 && price <= lastBuyPrice * (1 - stopLossPct)) {
         action = 'stop_sell';
         reason = T.reasonStopLoss(price);
      }
      // 检查止盈 (Take Profit)
      else if (takeProfitPct > 0 && price >= lastBuyPrice * (1 + takeProfitPct)) {
         action = 'take_sell';
         reason = T.reasonTakeProfit(price);
      }
    }

    // 如果没有触发止盈止损，再看正常的策略信号
    if (!action) {
      let isBuySignal = false;
      let isSellSignal = false;

      // 策略逻辑
      if (strategyConfig.type === 'BOLL') {
        if (today.lb && today.ub) {
          if (price <= today.lb) { isBuySignal = true; reason = T.reasonBollBuy(price); }
          else if (price >= today.ub) { isSellSignal = true; reason = T.reasonBollSell(price); }
        }
      } else if (strategyConfig.type === 'MACD') {
        const isGoldenCross = prev.diff <= prev.dea && today.diff > today.dea;
        const isDeathCross = prev.diff >= prev.dea && today.diff < today.dea;
        if (isGoldenCross) { isBuySignal = true; reason = T.reasonMacdGold; }
        else if (isDeathCross) { isSellSignal = true; reason = T.reasonMacdDeath; }
      }

      if (isSellSignal) action = 'sell';
      if (isBuySignal) action = 'buy';
    }

    // --- 执行交易逻辑 ---
    
    // 1. 卖出 (策略卖出 或 止盈止损卖出)
    if ((action === 'sell' || action === 'stop_sell' || action === 'take_sell') && shares > 0) {
      const sellAmount = shares;
      // 统计胜率
      if (price > lastBuyPrice) winCount++;
      
      const tradeValue = sellAmount * price;
      let commission = tradeValue * COMMISSION_RATE;
      if (commission < MIN_COMMISSION) commission = MIN_COMMISSION; 
      const tax = tradeValue * TAX_RATE; 
      
      const totalRevenue = tradeValue - commission - tax; 

      totalTrades++;
      cash += totalRevenue;
      shares = 0;
      
      // 记录交易类型用于UI显示
      const typeDisplay = action === 'stop_sell' ? T.typeStopLoss : (action === 'take_sell' ? T.typeTakeProfit : T.typeSell);

      trades.push({ 
          date: today.date, 
          type: typeDisplay, 
          price: price, 
          shares: sellAmount, 
          reason: reason,
          fee: (commission + tax).toFixed(2) 
      });
      action = 'sell'; // 统一为 sell 方便画图
    }
    
    // 2. 买入
    else if (action === 'buy' && shares === 0) {
      // --- 趋势过滤 (Trend Filter) 检查 ---
      // 如果开启了过滤器，且股价在均线下方，则“拒绝买入”
      if (strategyConfig.useTrendFilter && today.ma && price < today.ma) {
         // console.log('Trend Blocked'); // 调试用
         action = null; // 取消动作
      } else {
        // 计算可用资金：总资产 * 仓位比例
        // 如果 cash 很多，我们只用一部分；如果 cash 不够，就用全部 cash
        const totalAsset = cash; 
        const targetInvest = totalAsset * positionRatio;
        const investableCash = Math.min(cash, targetInvest);

        if (investableCash > price * 100) {
          let buyAmount = Math.floor(investableCash / (price * 100 * (1 + COMMISSION_RATE))) * 100;
          
          if (buyAmount > 0) {
            const tradeValue = buyAmount * price;
            let commission = tradeValue * COMMISSION_RATE;
            if (commission < MIN_COMMISSION) commission = MIN_COMMISSION;
            
            const totalCost = tradeValue + commission;

            if (cash >= totalCost) {
                shares += buyAmount;
                cash -= totalCost;
                lastBuyPrice = price; // 记录成本价
                trades.push({ 
                    date: today.date, 
                    type: T.typeBuy, 
                    price: price, 
                    shares: buyAmount, 
                    reason: reason,
                    fee: commission.toFixed(2) 
                });
            }
          } else {
            action = null; // 钱不够一手，取消动作
          }
        } else {
          action = null;
        }
      }
    } else {
      action = null; // 没有触发任何操作
    }

    // 每日结算净值
    const totalEquity = cash + (shares * price);
    
    const point = { ...today, equity: totalEquity, action: action };
    if (action === 'buy') point.buySignal = price;
    if (action === 'sell') point.sellSignal = price;
    
    equityCurve.push(point);
  }

  // 4. 计算最终统计指标
  const finalEquity = equityCurve[equityCurve.length - 1]?.equity || initialCapital;
  const totalReturn = ((finalEquity - initialCapital) / initialCapital) * 100;
  const maxEquity = Math.max(...equityCurve.map(e => e.equity));
  const minEquityAfterMax = Math.min(...equityCurve.map(e => e.equity));
  const maxDrawdown = maxEquity > 0 ? ((maxEquity - minEquityAfterMax) / maxEquity) * 100 : 0;

  return {
    equityCurve, trades,
    metrics: { 
        totalReturn: totalReturn.toFixed(2), 
        finalEquity: finalEquity.toFixed(2), 
        maxDrawdown: Math.abs(maxDrawdown).toFixed(2), 
        winRate: totalTrades > 0 ? ((winCount / totalTrades) * 100).toFixed(2) : 0, 
        totalTrades 
    }
  };
};