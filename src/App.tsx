import React, { useEffect, useState, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, TrendingUp, TrendingDown, DollarSign, Clock, AlertCircle, CheckCircle2, Zap, Wallet, Euro, Coins, RefreshCw, Play, Square } from 'lucide-react';
import { motion } from 'motion/react';

declare global {
  interface Window {
    ethereum?: any;
  }
}

interface BotState {
  status: string;
  symbol: string;
  budget: number;
  currentPrice: number;
  fastEma: number;
  slowEma: number;
  trend: string;
  inPosition: boolean;
  lastAction: string;
  wallet: {
    USD: number;
    EUR: number;
    totalUSD: number;
  };
  logs: { time: string; message: string; type: string }[];
  chartData: any[];
}

export default function App() {
  const [botState, setBotState] = useState<BotState | null>(null);
  const [loading, setLoading] = useState(true);
  const [ethAddress, setEthAddress] = useState<string | null>(null);
  const [ethBalance, setEthBalance] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/bot-state');
      const data = await res.json();
      setBotState(data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch bot state:', error);
    }
  }, []);

  const syncMetaMask = useCallback(async (address: string) => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const balanceHex = await window.ethereum.request({ method: 'eth_getBalance', params: [address, 'latest'] });
        const balanceEth = parseInt(balanceHex, 16) / 1e18;
        setEthBalance(balanceEth);
      } catch (error) {
        console.error('Failed to fetch balance', error);
      }
    }
  }, []);

  const connectMetaMask = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const address = accounts[0];
        setEthAddress(address);
        await syncMetaMask(address);
      } catch (error) {
        console.error('User rejected request', error);
      }
    } else {
      alert('MetaMask is not installed! Please install it to connect your wallet.');
    }
  };

  const syncAll = async () => {
    setIsSyncing(true);
    await fetchState();
    if (ethAddress) {
      await syncMetaMask(ethAddress);
    }
    setTimeout(() => setIsSyncing(false), 500);
  };

  const toggleBot = async () => {
    try {
      await fetch('/api/bot/toggle', { method: 'POST' });
      fetchState();
    } catch (error) {
      console.error('Failed to toggle bot:', error);
    }
  };

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [fetchState]);

  useEffect(() => {
    if (ethAddress) {
      const interval = setInterval(() => syncMetaMask(ethAddress), 10000);
      return () => clearInterval(interval);
    }
  }, [ethAddress, syncMetaMask]);

  if (loading || !botState) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400 font-mono">
        <div className="flex flex-col items-center gap-4">
          <Zap className="w-8 h-8 animate-pulse text-emerald-500" />
          <p>Initializing Lucy Bot...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30 relative overflow-hidden">
      {/* Atmospheric Background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-900/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[120px]" />
        <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] rounded-full bg-rose-900/10 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="border-b border-white/5 bg-zinc-950/40 backdrop-blur-2xl sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <h1 className="font-semibold tracking-tight">Lucy Bot Dashboard</h1>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20 ml-2">
              {botState.status}
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm font-mono text-zinc-400">
            <WorldClock />
            <div className="h-6 w-px bg-white/10 hidden sm:block"></div>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${botState.status === 'Running' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              Live
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Stats & Chart */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard 
                title="Target Pair" 
                value={botState.symbol} 
                icon={<Activity className="w-4 h-4" />} 
              />
              <StatCard 
                title="Current Price" 
                value={`$${botState.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`} 
                icon={<DollarSign className="w-4 h-4" />} 
                trend={botState.trend}
              />
              <StatCard 
                title="Position" 
                value={botState.inPosition ? 'IN MARKET' : 'WAITING'} 
                icon={botState.inPosition ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Clock className="w-4 h-4 text-amber-400" />} 
                valueColor={botState.inPosition ? 'text-emerald-400' : 'text-amber-400'}
              />
              <StatCard 
                title="Total Portfolio" 
                value={`$${botState.wallet.totalUSD.toFixed(2)}`} 
                icon={<Wallet className="w-4 h-4" />} 
                trend={botState.wallet.totalUSD >= botState.budget ? 'UP' : 'DOWN'}
              />
            </div>

            {/* Live Wallet Section */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-zinc-900/30 backdrop-blur-md border border-white/5 shadow-xl shadow-black/20 rounded-3xl p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-zinc-400" />
                  Live Wallet
                </h2>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={toggleBot}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      botState.status === 'Running' 
                        ? 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/20 text-rose-400' 
                        : 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20 text-emerald-400'
                    }`}
                  >
                    {botState.status === 'Running' ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    {botState.status === 'Running' ? 'Stop Bot' : 'Start Bot'}
                  </button>
                  <button 
                    onClick={syncAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 border border-white/5 text-xs font-medium text-zinc-300 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
                    Sync All
                  </button>
                  {!ethAddress ? (
                    <button 
                      onClick={connectMetaMask}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-xs font-medium text-orange-400 transition-colors"
                    >
                      <Coins className="w-3.5 h-3.5" />
                      Connect MetaMask
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {ethAddress.slice(0, 6)}...{ethAddress.slice(-4)}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-zinc-950/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                      <DollarSign className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm text-zinc-400">US Dollar</p>
                      <p className="text-xl font-semibold">{botState.wallet.USD.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-zinc-500">Value</p>
                    <p className="font-mono text-emerald-400">${botState.wallet.USD.toFixed(2)}</p>
                  </div>
                </div>

                <div className="bg-zinc-950/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                      <Euro className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm text-zinc-400">Euro</p>
                      <p className="text-xl font-semibold">{botState.wallet.EUR.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-zinc-500">Value</p>
                    <p className="font-mono text-amber-400">${(botState.wallet.EUR * botState.currentPrice).toFixed(2)}</p>
                  </div>
                </div>

                <div className="bg-zinc-950/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden">
                  {/* MetaMask Background Glow */}
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-orange-500/5 rounded-full blur-xl pointer-events-none" />
                  
                  <div className="flex items-center gap-3 mb-4 relative z-10">
                    <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                      <Coins className="w-5 h-5 text-orange-400" />
                    </div>
                    <div>
                      <p className="text-sm text-zinc-400">Ethereum</p>
                      <p className="text-xl font-semibold">
                        {ethBalance !== null ? ethBalance.toFixed(4) : '0.0000'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right relative z-10">
                    <p className="text-sm text-zinc-500">Network</p>
                    <p className="font-mono text-orange-400">Mainnet</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Chart Section */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-zinc-900/30 backdrop-blur-md border border-white/5 shadow-2xl shadow-black/50 rounded-3xl p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-medium">Price Action & EMA</h2>
                  <p className="text-sm text-zinc-400">1H Timeframe • Fast (9) / Slow (21)</p>
                </div>
                <div className="flex gap-4 text-sm font-mono">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-0.5 bg-emerald-400"></div>
                    <span className="text-zinc-400">Fast EMA: {botState.fastEma.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-0.5 bg-rose-400"></div>
                    <span className="text-zinc-400">Slow EMA: {botState.slowEma.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={botState.chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis 
                      dataKey="timestamp" 
                      stroke="#52525b" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                      dy={10}
                    />
                    <YAxis 
                      domain={['auto', 'auto']} 
                      stroke="#52525b" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                      dx={-10}
                      tickFormatter={(value) => `$${Number(value).toFixed(4)}`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                      itemStyle={{ color: '#e4e4e7' }}
                    />
                    <Line type="monotone" dataKey="price" stroke="#e4e4e7" strokeWidth={2} dot={false} name="Price" />
                    <Line type="monotone" dataKey="fastEma" stroke="#34d399" strokeWidth={2} dot={false} name="Fast EMA (9)" />
                    <Line type="monotone" dataKey="slowEma" stroke="#fb7185" strokeWidth={2} dot={false} name="Slow EMA (21)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Logs */}
          <div className="bg-zinc-900/30 backdrop-blur-md border border-white/5 shadow-2xl shadow-black/50 rounded-3xl flex flex-col h-[600px] overflow-hidden">
            <div className="p-5 border-b border-white/5 flex items-center justify-between bg-zinc-950/20">
              <h2 className="font-medium flex items-center gap-2">
                <Activity className="w-4 h-4 text-zinc-400" />
                Activity Log
              </h2>
              <span className="text-xs font-mono text-zinc-500">Live Updates</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-sm">
              {botState.logs.map((log, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={i} 
                  className={`p-4 rounded-2xl border backdrop-blur-sm ${
                    log.type === 'buy' ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]' :
                    log.type === 'sell' ? 'bg-rose-500/5 border-rose-500/10 text-rose-400 shadow-[inset_0_0_20px_rgba(244,63,94,0.05)]' :
                    log.type === 'error' ? 'bg-red-500/5 border-red-500/10 text-red-400 shadow-[inset_0_0_20px_rgba(239,68,68,0.05)]' :
                    'bg-white/5 border-white/5 text-zinc-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-zinc-500 shrink-0">[{log.time}]</span>
                    <span className="break-words">{log.message}</span>
                  </div>
                </motion.div>
              ))}
              {botState.logs.length === 0 && (
                <div className="text-zinc-500 text-center py-8">Waiting for activity...</div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

function StatCard({ title, value, icon, trend, valueColor = "text-zinc-100" }: { title: string, value: string, icon: React.ReactNode, trend?: string, valueColor?: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-zinc-900/30 backdrop-blur-md border border-white/5 shadow-xl shadow-black/20 rounded-3xl p-5 flex flex-col justify-between"
    >
      <div className="flex items-center justify-between text-zinc-400 mb-4">
        <span className="text-sm font-medium">{title}</span>
        {icon}
      </div>
      <div className="flex items-end justify-between">
        <span className={`text-2xl font-semibold tracking-tight ${valueColor}`}>{value}</span>
        {trend && (
          <span className={`flex items-center text-xs font-medium ${trend === 'UP' ? 'text-emerald-400' : 'text-rose-400'}`}>
            {trend === 'UP' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
            {trend}
          </span>
        )}
      </div>
    </motion.div>
  );
}

function WorldClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date, timeZone: string) => {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
  };

  return (
    <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs font-mono">
      <div className="flex flex-col items-end">
        <span className="text-zinc-500 text-[8px] sm:text-[10px] uppercase tracking-wider">Los Angeles</span>
        <span className="text-zinc-300">{formatTime(time, 'America/Los_Angeles')}</span>
      </div>
      <div className="flex flex-col items-end bg-emerald-500/10 border border-emerald-500/20 px-2 sm:px-3 py-1 rounded-lg shadow-[inset_0_0_15px_rgba(16,185,129,0.05)]">
        <span className="text-emerald-500/70 text-[8px] sm:text-[10px] uppercase tracking-wider">New York</span>
        <span className="text-emerald-400 font-bold">{formatTime(time, 'America/New_York')}</span>
      </div>
      <div className="flex flex-col items-end hidden sm:flex">
        <span className="text-zinc-500 text-[8px] sm:text-[10px] uppercase tracking-wider">London</span>
        <span className="text-zinc-300">{formatTime(time, 'Europe/London')}</span>
      </div>
    </div>
  );
}
