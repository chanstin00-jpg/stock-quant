import React, { useState, useEffect } from 'react';
import { LineChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Area, Scatter, Brush } from 'recharts';
import { Play, Activity, Settings, Search, BookOpen, X, Loader2, AlertCircle, Clipboard, FileJson, Database, TrendingUp, TrendingDown, Layers, SidebarClose, SidebarOpen, Languages, ShieldCheck, ChevronDown, ChevronRight, HelpCircle } from 'lucide-react';

import { TRANSLATIONS, STOCK_PROFILES } from './utils/constants';
import { runBacktest } from './utils/strategy';
import { generateMockData, fetchTushareData, getPythonScript } from './utils/dataService';
import { copyToClipboard } from './utils/formatters';

const SidebarSection = ({ title, icon: Icon, isOpen, onToggle, children }) => (
  <div className="border border-slate-700/50 rounded-xl overflow-hidden bg-slate-800/30 transition-all duration-300">
    <button 
      onClick={onToggle}
      className={`w-full flex items-center justify-between p-3 text-sm font-medium transition-colors ${isOpen ? 'bg-slate-800 text-blue-400' : 'hover:bg-slate-800/50 text-slate-300'}`}
    >
      <div className="flex items-center gap-2">
        <Icon size={16} className={isOpen ? 'text-blue-400' : 'text-slate-500'} />
        {title}
      </div>
      {isOpen ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
    </button>
    
    {isOpen && (
      <div className="p-4 border-t border-slate-700/50 bg-slate-900/20 space-y-4 animate-in slide-in-from-top-1 duration-200">
        {children}
      </div>
    )}
  </div>
);

const BuyMarker = ({ cx, cy }) => Number.isFinite(cx) && Number.isFinite(cy) ? <g transform={`translate(${cx},${cy})`}><polygon points="0,-8 -6,4 6,4" fill="#ef4444" /><text x="0" y="14" textAnchor="middle" fill="#ef4444" fontSize="10" fontWeight="bold">B</text></g> : null;
const SellMarker = ({ cx, cy }) => Number.isFinite(cx) && Number.isFinite(cy) ? <g transform={`translate(${cx},${cy})`}><polygon points="0,8 -6,-4 6,-4" fill="#22c55e" /><text x="0" y="-10" textAnchor="middle" fill="#22c55e" fontSize="10" fontWeight="bold">S</text></g> : null;

export default function QuantBacktestPlatform() {
  const [lang, setLang] = useState('zh'); 
  const T = TRANSLATIONS[lang]; 

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [openSections, setOpenSections] = useState({
    data: false,
    stock: false,
    plan: true,
    strategy: true
  });

  const toggleSection = (key) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  const [selectedStock, setSelectedStock] = useState('600519');
  const [customCode, setCustomCode] = useState('600000.SH');
  const [startDate, setStartDate] = useState('2022-01-01');
  const [endDate, setEndDate] = useState('2023-12-31');
  const [initialCapital, setInitialCapital] = useState(500000);
  
  const [strategyType, setStrategyType] = useState('BOLL'); 
  const [bollingerPeriod, setBollingerPeriod] = useState(20);
  const [bollingerMultiplier, setBollingerMultiplier] = useState(2);
  const [macdShort, setMacdShort] = useState(12);
  const [macdLong, setMacdLong] = useState(26);
  const [macdSignal, setMacdSignal] = useState(9);

  const [positionSize, setPositionSize] = useState(100); 
  const [stopLoss, setStopLoss] = useState(0);         
  const [takeProfit, setTakeProfit] = useState(0);     
  const [useTrendFilter, setUseTrendFilter] = useState(false); 

  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState('chart');
  const [showStrategyInfo, setShowStrategyInfo] = useState(false);
  const [showPlanGuide, setShowPlanGuide] = useState(false);
  
  const [apiToken, setApiToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [dataMode, setDataMode] = useState('tushare'); 
  const [showDataHelper, setShowDataHelper] = useState(false); 
  const [manualJson, setManualJson] = useState(''); 
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => { if(results) runSimulation(); }, [lang]); 
  useEffect(() => { runSimulation(); }, []);

  const getCurrentTsCode = () => {
    if (selectedStock === 'custom') return customCode.toUpperCase();
    return STOCK_PROFILES[selectedStock].ts_code;
  };

  const getStockDisplayName = (code) => {
      if (code === 'custom') return customCode;
      const profile = STOCK_PROFILES[code];
      return lang === 'zh' ? profile.name : profile.nameEn;
  }

  const handleCopy = () => {
      const tsCode = getCurrentTsCode();
      const script = getPythonScript(dataMode, { token: apiToken, tsCode, startDate, endDate });
      copyToClipboard(script);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
  };

  const runSimulation = async () => {
    setIsLoading(true);
    setErrorMsg('');
    let marketData = [];
    const targetCode = getCurrentTsCode();

    try {
      if (dataMode === 'manual') {
        if (!manualJson) throw new Error("Json Empty");
        try { marketData = JSON.parse(manualJson); } catch (e) { throw new Error("JSON Error"); }
      } 
      else if (dataMode === 'tushare') {
        try { marketData = await fetchTushareData(apiToken, targetCode, startDate, endDate); } 
        catch (err) {
          if (err.message === 'CORS_BLOCK') { setShowDataHelper(true); setErrorMsg("CORS Error"); } 
          else { setErrorMsg(err.message); }
          setIsLoading(false); return;
        }
      } 
      else if (dataMode === 'baostock') { setShowDataHelper(true); setErrorMsg("Local Script Required"); setIsLoading(false); return; }
      else { marketData = generateMockData(targetCode, startDate, endDate); }

      if (!marketData || marketData.length === 0) throw new Error("Data Empty");
      
      const strategyConfig = {
        type: strategyType,
        period: bollingerPeriod,
        multiplier: bollingerMultiplier,
        short: macdShort, long: macdLong, signal: macdSignal,
        positionSize, stopLoss, takeProfit, useTrendFilter
      };

      const res = runBacktest(marketData, initialCapital, strategyConfig, startDate, lang);
      setResults(res);
    } catch (err) { setErrorMsg(err.message); } finally { setIsLoading(false); }
  };

  const toggleLanguage = () => setLang(prev => prev === 'zh' ? 'en' : 'zh');

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col relative overflow-hidden">
      
      {showDataHelper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-800 rounded-xl border border-slate-600 w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Database className={dataMode === 'baostock' ? "text-purple-400" : "text-red-400"} />
                {dataMode === 'baostock' ? "Baostock Helper" : "Tushare Helper"}
              </h2>
              <button onClick={() => setShowDataHelper(false)}><X className="text-slate-400 hover:text-white"/></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
               <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                <h3 className="text-green-400 font-bold mb-2 flex items-center gap-2">{T.step1}</h3>
                <div className="bg-black p-3 rounded text-xs font-mono text-slate-300 overflow-x-auto relative group">
                  <pre>{getPythonScript(dataMode, { token: apiToken, tsCode: getCurrentTsCode(), startDate, endDate })}</pre>
                  <button onClick={handleCopy} className="absolute top-2 right-2 bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded flex items-center gap-1">
                    <Clipboard size={12}/> {copySuccess ? T.copySuccess : T.copyScript}
                  </button>
                </div>
              </div>
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                <h3 className="text-blue-400 font-bold mb-2 flex items-center gap-2">{T.step2}</h3>
                <textarea 
                  value={manualJson}
                  onChange={(e) => { setManualJson(e.target.value); if(e.target.value) setDataMode('manual'); }}
                  placeholder={T.pastePlaceholder}
                  className="w-full h-24 bg-slate-950 border border-slate-700 rounded p-2 text-xs font-mono text-green-300 focus:ring-1 focus:ring-blue-500 outline-none"
                />
                <button 
                  onClick={() => { if (manualJson) { setDataMode('manual'); setShowDataHelper(false); runSimulation(); } }}
                  disabled={!manualJson}
                  className="mt-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed w-full"
                >
                  {T.loadAndRun}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="flex flex-col md:flex-row justify-between items-center border-b border-slate-800 bg-slate-900/50 backdrop-blur-md px-6 py-3 z-10 shrink-0">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-slate-400 hover:text-white transition p-1 hover:bg-slate-800 rounded" title={T.sidebarToggle}>
            {isSidebarOpen ? <SidebarClose size={20} /> : <SidebarOpen size={20} />}
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2 text-blue-400 tracking-tight">
            <Activity className="h-5 w-5" /> {T.title}
          </h1>
        </div>
        <div className="flex gap-3 w-full md:w-auto mt-3 md:mt-0 items-center">
           <button onClick={toggleLanguage} className="flex items-center gap-1 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 rounded border border-slate-700 text-xs text-slate-300 transition">
              <Languages size={14} /> {lang === 'zh' ? 'EN' : '中文'}
           </button>
           <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 rounded border border-slate-700 text-xs text-slate-400">
             <span>{T.currentStock}:</span>
             <span className="text-blue-300 font-mono">{getStockDisplayName(selectedStock)}</span>
           </div>
          <button onClick={runSimulation} disabled={isLoading} className="flex-1 md:flex-none flex justify-center items-center gap-2 px-5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 rounded-md font-bold text-sm transition shadow-lg shadow-blue-900/20 active:scale-95">
            {isLoading ? <Loader2 className="animate-spin" size={16}/> : <Play size={16} fill="currentColor" />} 
            {isLoading ? T.running : T.runBacktest}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <div className={`flex-shrink-0 bg-slate-900 border-r border-slate-800 overflow-y-auto custom-scrollbar transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-[320px] translate-x-0' : 'w-0 -translate-x-full opacity-0'}`}>
          <div className="p-4 space-y-3 w-[320px]">
            
            <SidebarSection title={T.sectionData} icon={Database} isOpen={openSections.data} onToggle={() => toggleSection('data')}>
               <div className="flex gap-2">
                  <button onClick={() => {setDataMode('tushare'); setErrorMsg('');}} className={`flex-1 py-1.5 text-[10px] rounded border transition ${dataMode === 'tushare' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}>{T.dataSourceTushare}</button>
                  <button onClick={() => {setDataMode('baostock'); setShowDataHelper(true);}} className={`flex-1 py-1.5 text-[10px] rounded border transition ${dataMode === 'baostock' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}>{T.dataSourceBaostock}</button>
                  <button onClick={() => {setDataMode('mock'); setErrorMsg('');}} className={`flex-1 py-1.5 text-[10px] rounded border transition ${dataMode === 'mock' ? 'bg-orange-600 border-orange-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}>{T.dataSourceMock}</button>
                </div>
                {dataMode === 'tushare' && (
                  <input type="text" value={apiToken} onChange={(e) => setApiToken(e.target.value)} placeholder={T.inputToken} className="w-full bg-slate-900 border border-slate-600 rounded py-1.5 px-2 text-xs text-slate-300 focus:ring-1 focus:ring-blue-500 outline-none truncate"/>
                )}
                <button onClick={() => setShowDataHelper(true)} className={`w-full py-1.5 text-[10px] rounded border flex items-center justify-center gap-2 ${dataMode === 'manual' ? 'bg-green-600 border-green-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'}`}>
                  <FileJson size={12} /> {dataMode === 'manual' ? T.imported : T.manualImport}
                </button>
            </SidebarSection>

            <SidebarSection title={T.sectionStock} icon={Search} isOpen={openSections.stock} onToggle={() => toggleSection('stock')}>
                <select value={selectedStock} onChange={(e) => setSelectedStock(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded py-2 px-3 text-xs focus:ring-1 focus:ring-blue-500 outline-none mb-3">
                  {Object.entries(STOCK_PROFILES).map(([code, info]) => (
                    <option key={code} value={code}>{code} - {lang === 'zh' ? info.name : info.nameEn}</option>
                  ))}
                  <option value="custom">{T.customCode}</option>
                </select>
                {selectedStock === 'custom' && (
                   <input type="text" value={customCode} onChange={(e) => setCustomCode(e.target.value)} placeholder="000001.SZ" className="w-full bg-slate-900 border border-blue-500/50 rounded py-2 px-3 text-xs text-white focus:ring-1 focus:ring-blue-500 outline-none mb-3"/>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="block text-slate-500 text-[10px] mb-1">{T.startDate}</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded py-1.5 px-2 text-[10px] text-slate-300"/></div>
                  <div><label className="block text-slate-500 text-[10px] mb-1">{T.endDate}</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded py-1.5 px-2 text-[10px] text-slate-300"/></div>
                </div>
            </SidebarSection>

            <SidebarSection title={T.sectionPlan} icon={ShieldCheck} isOpen={openSections.plan} onToggle={() => toggleSection('plan')}>
               <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1"><label className="text-slate-400 text-[10px]">{T.positionSize} ({positionSize}%)</label></div>
                    <input type="range" min="10" max="100" step="10" value={positionSize} onChange={(e) => setPositionSize(Number(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-green-500" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1"><label className="text-slate-400 text-[10px]">{T.stopLoss} ({stopLoss === 0 ? T.riskOff : stopLoss + '%'})</label></div>
                    <input type="range" min="0" max="20" step="1" value={stopLoss} onChange={(e) => setStopLoss(Number(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1"><label className="text-slate-400 text-[10px]">{T.takeProfit} ({takeProfit === 0 ? T.riskOff : takeProfit + '%'})</label></div>
                    <input type="range" min="0" max="50" step="5" value={takeProfit} onChange={(e) => setTakeProfit(Number(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500" />
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-700/30">
                      <label className="text-slate-400 text-[10px]">{T.trendFilter}</label>
                      <button 
                        onClick={() => setUseTrendFilter(!useTrendFilter)}
                        className={`text-[10px] px-2 py-1 rounded transition ${useTrendFilter ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}
                      >
                        {useTrendFilter ? T.trendFilterOn : T.trendFilterOff}
                      </button>
                  </div>
                  <button onClick={() => setShowPlanGuide(true)} className="w-full flex justify-center items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-blue-300 text-[10px] rounded transition border border-slate-700/50 mt-2">
                    <HelpCircle size={12} /> {T.viewPlanGuide}
                  </button>
               </div>
            </SidebarSection>

            <SidebarSection title={T.sectionStrategy} icon={Layers} isOpen={openSections.strategy} onToggle={() => toggleSection('strategy')}>
              <div className="space-y-4">
                <div className="flex bg-slate-900 p-1 rounded">
                  <button onClick={() => setStrategyType('BOLL')} className={`flex-1 py-1.5 text-[10px] font-medium rounded transition ${strategyType === 'BOLL' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>{T.strategyBoll}</button>
                  <button onClick={() => setStrategyType('MACD')} className={`flex-1 py-1.5 text-[10px] font-medium rounded transition ${strategyType === 'MACD' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>{T.strategyMacd}</button>
                </div>
                {strategyType === 'BOLL' ? (
                  <div className="space-y-3 animate-in fade-in duration-300">
                    <div><div className="flex justify-between mb-1"><label className="text-slate-400 text-[10px]">{T.paramPeriod} ({bollingerPeriod})</label></div><input type="range" min="5" max="60" step="1" value={bollingerPeriod} onChange={(e) => setBollingerPeriod(Number(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500" /></div>
                    <div><div className="flex justify-between mb-1"><label className="text-slate-400 text-[10px]">{T.paramMultiplier} ({bollingerMultiplier})</label></div><input type="range" min="1" max="4" step="0.1" value={bollingerMultiplier} onChange={(e) => setBollingerMultiplier(Number(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500" /></div>
                  </div>
                ) : (
                  <div className="space-y-3 animate-in fade-in duration-300">
                    <div><div className="flex justify-between mb-1"><label className="text-slate-400 text-[10px]">{T.paramShort} ({macdShort})</label></div><input type="range" min="5" max="20" step="1" value={macdShort} onChange={(e) => setMacdShort(Number(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500" /></div>
                    <div><div className="flex justify-between mb-1"><label className="text-slate-400 text-[10px]">{T.paramLong} ({macdLong})</label></div><input type="range" min="20" max="60" step="1" value={macdLong} onChange={(e) => setMacdLong(Number(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500" /></div>
                    <div><div className="flex justify-between mb-1"><label className="text-slate-400 text-[10px]">{T.paramSignal} ({macdSignal})</label></div><input type="range" min="5" max="20" step="1" value={macdSignal} onChange={(e) => setMacdSignal(Number(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500" /></div>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-700/30">
                  <label className="block text-slate-500 text-[10px] mb-1">{T.initialCapital}</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1.5 text-slate-500 text-xs">¥</span>
                    <input type="number" value={initialCapital} onChange={(e) => setInitialCapital(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded py-1 pl-6 pr-2 text-xs focus:outline-none focus:border-blue-500" />
                  </div>
                </div>
              </div>
            </SidebarSection>
            
            <button onClick={() => setShowStrategyInfo(true)} className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs rounded transition border border-slate-700/50 mt-4">
              <BookOpen size={14} /> {T.viewStrategy}
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 p-4 md:p-6 gap-6">
          {errorMsg && !showDataHelper && (
            <div className="bg-red-500/10 border border-red-500/40 text-red-200 px-4 py-2 rounded-lg text-sm flex justify-between items-center">
              <div className="flex items-center gap-3"><AlertCircle size={16} /><span>{errorMsg}</span></div>
              {(errorMsg.includes('CORS') || errorMsg.includes('Baostock')) && (
                <button onClick={() => setShowDataHelper(true)} className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded">Script</button>
              )}
            </div>
          )}

          {results && (
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 relative overflow-hidden group hover:border-slate-700 transition">
                  <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition"><TrendingUp size={60}/></div>
                  <div className="text-slate-500 text-xs mb-1">{T.totalReturn}</div>
                  <div className={`text-2xl font-bold tracking-tight ${Number(results.metrics.totalReturn) >= 0 ? 'text-red-400' : 'text-green-400'}`}>{Number(results.metrics.totalReturn) > 0 ? '+' : ''}{results.metrics.totalReturn}%</div>
                </div>
                <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 relative overflow-hidden group hover:border-slate-700 transition">
                   <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition"><TrendingDown size={60}/></div>
                  <div className="text-slate-500 text-xs mb-1">{T.maxDrawdown}</div>
                  <div className="text-xl font-bold text-slate-200">{results.metrics.maxDrawdown}%</div>
                </div>
                <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition">
                  <div className="text-slate-500 text-xs mb-1">{T.winRate}</div>
                  <div className="text-xl font-bold text-slate-200">{results.metrics.winRate}%</div>
                </div>
                <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition">
                  <div className="text-slate-500 text-xs mb-1">{T.finalEquity}</div>
                  <div className="text-xl font-bold text-blue-400">¥{(results.metrics.finalEquity / 10000).toFixed(1)}w</div>
                </div>
             </div>
          )}

          <div className="h-[600px] bg-slate-900/50 rounded-xl border border-slate-800 shadow-2xl flex flex-col overflow-hidden relative">
             <div className="flex gap-2 p-3 border-b border-slate-800 justify-between items-center shrink-0">
              <div className="flex gap-2">
                <button onClick={() => setActiveTab('chart')} className={`px-3 py-1 rounded text-xs font-medium transition ${activeTab === 'chart' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{T.tabChart}</button>
                <button onClick={() => setActiveTab('equity')} className={`px-3 py-1 rounded text-xs font-medium transition ${activeTab === 'equity' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{T.tabEquity}</button>
                <button onClick={() => setActiveTab('trades')} className={`px-3 py-1 rounded text-xs font-medium transition ${activeTab === 'trades' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{T.tabTrades}</button>
              </div>
              <div className="text-[10px] text-slate-600 flex items-center gap-2">
                {dataMode === 'mock' && <span className="text-orange-900 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">{T.dataSourceMock}</span>}
                {dataMode === 'tushare' && <span className="text-blue-900 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">{T.dataSourceTushare}</span>}
              </div>
            </div>

            <div className="flex-1 w-full min-h-0 relative">
            {isLoading ? (
               <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-4"><Loader2 className="animate-spin text-blue-500" size={32} /><p className="text-sm">{T.loadingData}</p></div>
            ) : results ? (
              <>
              {activeTab === 'chart' && (
                <div className="h-full w-full p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={results.equityCurve} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="date" tick={{fill: '#64748b', fontSize: 10}} minTickGap={50} tickLine={false} axisLine={false} />
                      <YAxis domain={['auto', 'auto']} tick={{fill: '#64748b', fontSize: 10}} width={40} tickLine={false} axisLine={false} />
                      
                      {/* 改动2: 增加了成交量 Y 轴 */}
                      <YAxis yAxisId="vol" hide domain={['0', 'dataMax * 5']} />

                      <Tooltip contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', fontSize: '12px'}} />
                      <Legend iconType="plainline" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}/>
                      <Brush dataKey="date" height={30} stroke="#475569" fill="#0f172a" tickFormatter={() => ''} travellerWidth={10}/>
                      
                      {/* 改动3: 增加了成交量 Bar */}
                      <Bar yAxisId="vol" dataKey="volume" fill="#94a3b8" opacity={0.25} barSize={4} name={T.chartVolume} />
                      
                      <Line type="monotone" dataKey="close" stroke="#f8fafc" dot={false} strokeWidth={1.5} name={T.tablePrice} />
                      {useTrendFilter && <Line type="monotone" dataKey="ma" stroke="#8b5cf6" strokeWidth={1.5} dot={false} name="MA60 (Trend)" />}
                      {strategyType === 'BOLL' && (
                        <>
                          <Line type="monotone" dataKey="ub" stroke="#ef4444" strokeDasharray="3 3" dot={false} strokeWidth={1} name="Upper" />
                          <Line type="monotone" dataKey="lb" stroke="#22c55e" strokeDasharray="3 3" dot={false} strokeWidth={1} name="Lower" />
                          <Line type="monotone" dataKey="mb" stroke="#fbbf24" dot={false} strokeWidth={1} name="Mid" />
                        </>
                      )}
                      <Scatter name={T.typeBuy} dataKey="buySignal" shape={<BuyMarker />} legendType="triangle" fill="#ef4444" />
                      <Scatter name={T.typeSell} dataKey="sellSignal" shape={<SellMarker />} legendType="triangle" fill="#22c55e" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
              {activeTab === 'equity' && (
                 <div className="h-full w-full p-2">
                 <ResponsiveContainer width="100%" height="100%">
                   <ComposedChart data={results.equityCurve}>
                     <defs><linearGradient id="colorEq" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                     <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                     <XAxis dataKey="date" tick={{fill: '#64748b', fontSize: 10}} minTickGap={50} tickLine={false} axisLine={false}/>
                     <YAxis domain={['auto', 'auto']} tick={{fill: '#64748b', fontSize: 10}} width={50} tickFormatter={(val) => `¥${(val/10000).toFixed(0)}w`} tickLine={false} axisLine={false}/>
                     <Tooltip contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc'}} />
                     <Brush dataKey="date" height={30} stroke="#475569" fill="#0f172a" tickFormatter={() => ''} />
                     <Area type="monotone" dataKey="equity" stroke="#3b82f6" fill="url(#colorEq)" strokeWidth={2} name={T.finalEquity} />
                   </ComposedChart>
                 </ResponsiveContainer>
               </div>
              )}
              {activeTab === 'trades' && (
                <div className="h-full overflow-y-auto custom-scrollbar p-2">
                   <table className="w-full text-xs text-left">
                    <thead className="bg-slate-800/50 text-slate-400 sticky top-0 backdrop-blur-md z-10">
                      <tr><th className="p-3 font-medium">{T.tableDate}</th><th className="p-3 font-medium">{T.tableType}</th><th className="p-3 text-right font-medium">{T.tablePrice}</th><th className="p-3 text-right font-medium">{T.tableShares}</th><th className="p-3 font-medium">{T.tableReason}</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {results.trades.map((trade, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30 transition">
                          <td className="p-3 text-slate-400 font-mono">{trade.date}</td>
                          <td className="p-3"><span className={`px-2 py-0.5 rounded border ${trade.type === T.typeBuy ? 'border-red-500/20 text-red-400 bg-red-500/5' : (trade.type === T.typeStopLoss ? 'border-blue-500/20 text-blue-400 bg-blue-500/5' : 'border-green-500/20 text-green-400 bg-green-500/5')}`}>{trade.type}</span></td>
                          <td className="p-3 text-right text-slate-200">¥{trade.price.toFixed(2)}</td>
                          <td className="p-3 text-right text-slate-200">{trade.shares}</td>
                          <td className="p-3 text-slate-500">{trade.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                   </table>
                   {results.trades.length === 0 && <div className="h-40 flex items-center justify-center text-slate-600 text-sm">{T.noTrades}</div>}
                </div>
              )}
              </>
            ) : <div className="h-full flex items-center justify-center text-slate-600 text-sm">{T.startPrompt}</div>}
            </div>
          </div>
        </div>
      </div>
      
      {showStrategyInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg shadow-2xl p-6">
            <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold text-white">{T.strategyLogic}</h2><button onClick={() => setShowStrategyInfo(false)}><X className="text-slate-400 hover:text-white"/></button></div>
            <div className="text-slate-300 text-sm space-y-4">
              {strategyType === 'BOLL' ? (
                <>
                  <p><strong>{T.bollTitle}</strong>: {T.bollDesc}</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-400 text-xs">
                    <li><span className="text-red-400">{T.bollBuy}</span></li>
                    <li><span className="text-green-400">{T.bollSell}</span></li>
                    <li><strong>{T.bollScene}</strong></li>
                  </ul>
                </>
              ) : (
                <>
                  <p><strong>{T.macdTitle}</strong>: {T.macdDesc}</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-400 text-xs">
                    <li><span className="text-red-400">{T.macdBuy}</span></li>
                    <li><span className="text-green-400">{T.macdSell}</span></li>
                    <li><strong>{T.macdScene}</strong></li>
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showPlanGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg shadow-2xl p-6">
            <div className="flex justify-between items-center mb-4">
               <h2 className="text-lg font-bold text-white flex items-center gap-2"><ShieldCheck className="text-green-400" size={20}/> {T.planGuideTitle}</h2>
               <button onClick={() => setShowPlanGuide(false)}><X className="text-slate-400 hover:text-white"/></button>
            </div>
            <div className="text-slate-300 text-sm space-y-4">
               <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                  <h3 className="font-bold text-blue-300 mb-1">{T.planPosTitle}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{T.planPosDesc}</p>
               </div>
               <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                  <h3 className="font-bold text-red-300 mb-1">{T.planStopTitle}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{T.planStopDesc}</p>
               </div>
               <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                  <h3 className="font-bold text-green-300 mb-1">{T.planTakeTitle}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{T.planTakeDesc}</p>
               </div>
               <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                  <h3 className="font-bold text-purple-300 mb-1">{T.planTrendTitle}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{T.planTrendDesc}</p>
               </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}