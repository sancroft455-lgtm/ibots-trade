import React, { useEffect, useState, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, TrendingUp, TrendingDown, DollarSign, Clock, AlertCircle, CheckCircle2, Zap, Wallet, Euro, Coins, RefreshCw, Play, Square, Banknote, Terminal as TerminalIcon, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
  const [cliInput, setCliInput] = useState('');
  const [cliHistory, setCliHistory] = useState<{ cmd: string; output: string }[]>([]);

  // Enhanced sound system
  const playSound = useCallback((freq: number = 800, type: OscillatorType = 'sine', duration: number = 0.05, volume: number = 0.05) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  }, []);

  useEffect(() => {
    const handleGlobalClick = () => playSound(600, 'sine', 0.04, 0.03);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [playSound]);

  const handleCliSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliInput.trim()) return;
    
    playSound(400, 'square', 0.1, 0.02);
    const cmd = cliInput.toLowerCase().trim();
    let output = '';

    switch (cmd) {
      case 'help':
        output = 'Available commands: help, status, wallet, toggle, clear, monetize';
        break;
      case 'status':
        output = `System Status: ${botState?.status} | Symbol: ${botState?.symbol} | Price: $${botState?.currentPrice}`;
        break;
      case 'wallet':
        output = `USD: $${botState?.wallet.USD.toFixed(2)} | EUR: ${botState?.wallet.EUR.toFixed(2)} | Total: $${botState?.wallet.totalUSD.toFixed(2)}`;
        break;
      case 'toggle':
        toggleBot();
        output = 'Toggling bot state...';
        break;
      case 'monetize':
        handleMonetize();
        output = 'Initiating monetization sequence...';
        break;
      case 'clear':
        setCliHistory([]);
        setCliInput('');
        return;
      default:
        output = `Command not recognized: ${cmd}. Type 'help' for options.`;
    }

    setCliHistory(prev => [...prev, { cmd: cliInput, output }].slice(-5));
    setCliInput('');
  };

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
        
        // Tech Auth: Request cryptographic signature to verify ownership
        const message = `Welcome to Lucy Bot!\n\nPlease sign this message to authenticate your wallet and enable monetization.\n\nWallet: ${address}`;
        await window.ethereum.request({
          method: 'personal_sign',
          params: [message, address],
        });

        setEthAddress(address);
        await syncMetaMask(address);
      } catch (error) {
        console.error('User rejected request or auth failed', error);
        alert('Authentication failed. Please sign the message to connect.');
      }
    } else {
      const isIframe = window !== window.parent;
      if (isIframe) {
        const useSimulated = window.confirm(
          'MetaMask is not accessible inside this preview window.\n\nWould you like to use a simulated test wallet for now?\n\n(To use your real MetaMask wallet, please open this app in a new tab using the button in the top right)'
        );
        if (useSimulated) {
          const mockAddress = '0x71C...976F';
          setEthAddress(mockAddress);
          await syncMetaMask(mockAddress);
        }
      } else {
        alert('MetaMask is not installed! Please install the MetaMask browser extension to connect your wallet.');
      }
    }
  };

  const handleMonetize = async () => {
    if (!ethAddress) {
      alert('Please connect and authenticate your MetaMask wallet first!');
      return;
    }
    try {
      const res = await fetch('/api/bot/monetize', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(`🎉 Successfully monetized $${data.amount.toFixed(2)} to your wallet!`);
        fetchState();
      } else {
        alert(data.message || 'Could not monetize at this time.');
      }
    } catch (error) {
      console.error('Monetize failed:', error);
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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400 font-mono relative overflow-hidden">
        <div className="crt-overlay" />
        <div className="scanline" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.05)_0%,transparent_70%)]" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6 relative z-10"
        >
          <div className="relative">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="w-20 h-20 rounded-2xl border-2 border-emerald-500/20 flex items-center justify-center"
            >
              <Zap className="w-10 h-10 text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]" />
            </motion.div>
            <div className="absolute -inset-4 border border-emerald-500/10 rounded-3xl animate-pulse" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold uppercase tracking-[0.3em] text-emerald-500 mb-2">Lucy.OS</h2>
            <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">Initializing Neural Trading Core...</p>
          </div>
          <div className="w-48 h-1 bg-zinc-900 rounded-full overflow-hidden border border-white/5">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 2, ease: "easeInOut" }}
              className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
            />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30 relative overflow-hidden">
      {/* CRT & Scanline Effects */}
      <div className="crt-overlay" />
      <div className="scanline" />

      {/* Atmospheric Background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-900/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[120px]" />
      </div>

      {/* Marquee Status Bar */}
      <div className="h-8 bg-emerald-500/5 border-b border-emerald-500/20 flex items-center overflow-hidden relative z-20">
        <div className="marquee-track whitespace-nowrap flex items-center gap-8 px-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-emerald-500/60">
              <Zap className="w-3 h-3" />
              System Status: {botState.status} • Symbol: {botState.symbol} • Price: ${botState.currentPrice.toFixed(4)} • Trend: {botState.trend}
            </div>
          ))}
        </div>
      </div>

      {/* Header */}
      <header className="border-b-2 border-white/10 bg-white/[0.02] backdrop-blur-3xl sticky top-0 z-30 shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border-2 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight uppercase italic">Lucy.OS <span className="text-zinc-500 font-normal not-italic ml-1">v2.4.0</span></h1>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-[10px] font-mono text-emerald-500/80 uppercase tracking-tighter">Terminal Active</span>
              </div>
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-8"
          >
            <WorldClock />
            <div className="hidden md:flex items-center gap-4 border-l-2 border-white/5 pl-8">
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Network</p>
                <p className="text-xs font-mono text-emerald-400">OANDA_PROD_SIM</p>
              </div>
              <div className="w-10 h-10 rounded-full border-2 border-white/10 flex items-center justify-center bg-white/5">
                <Zap className="w-4 h-4 text-zinc-400" />
              </div>
            </div>
          </motion.div>
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

            {/* CLI / Terminal Section */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="glass-panel p-4 font-mono border-2 border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.05)]"
            >
              <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                <div className="flex items-center gap-2">
                  <TerminalIcon className="w-3 h-3 text-emerald-500" />
                  <span className="text-[10px] uppercase tracking-widest text-emerald-500/80 font-bold">Lucy_CLI v1.0</span>
                </div>
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-rose-500/20" />
                  <div className="w-2 h-2 rounded-full bg-amber-500/20" />
                  <div className="w-2 h-2 rounded-full bg-emerald-500/20" />
                </div>
              </div>
              <div className="space-y-1 mb-3 max-h-32 overflow-y-auto custom-scrollbar">
                {cliHistory.map((item, i) => (
                  <div key={i} className="text-[10px]">
                    <div className="flex items-center gap-2 text-zinc-500">
                      <ChevronRight className="w-2 h-2" />
                      <span>{item.cmd}</span>
                    </div>
                    <div className="text-emerald-500/60 ml-4">{item.output}</div>
                  </div>
                ))}
                {cliHistory.length === 0 && <div className="text-[10px] text-zinc-600 italic">System ready. Type 'help' to begin.</div>}
              </div>
              <form onSubmit={handleCliSubmit} className="flex items-center gap-2 bg-black/20 p-2 rounded-lg border border-white/5">
                <span className="text-emerald-500 text-xs font-bold">lucy@os:~$</span>
                <input 
                  type="text" 
                  value={cliInput}
                  onChange={(e) => setCliInput(e.target.value)}
                  className="terminal-input"
                  placeholder="Enter command..."
                  autoFocus
                />
              </form>
            </motion.div>

            {/* Live Wallet Section */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-panel p-6"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-lg font-bold uppercase tracking-tight flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-emerald-400" />
                    Capital Allocation
                  </h2>
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Real-time asset distribution</p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => { toggleBot(); playSound(500, 'square', 0.1, 0.05); }}
                    className={`brutal-btn flex items-center gap-2 ${
                      botState.status === 'Running' 
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20' 
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                    }`}
                  >
                    {botState.status === 'Running' ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    {botState.status === 'Running' ? 'Halt System' : 'Initiate Bot'}
                  </button>
                  <button 
                    onClick={() => { syncAll(); playSound(900, 'sine', 0.05, 0.03); }}
                    className="brutal-btn bg-zinc-800/50 border-white/10 text-zinc-300 hover:bg-zinc-800 flex items-center gap-2"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
                    Sync
                  </button>
                  {!ethAddress ? (
                    <button 
                      onClick={() => { connectMetaMask(); playSound(1200, 'sine', 0.1, 0.05); }}
                      className="brutal-btn bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20 flex items-center gap-2"
                    >
                      <Coins className="w-3.5 h-3.5" />
                      Auth
                    </button>
                  ) : (
                    <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border-2 border-emerald-500/20 text-[10px] font-bold text-emerald-400 font-mono">
                      {ethAddress.slice(0, 6)}...{ethAddress.slice(-4)}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <AssetCard 
                  label="US Dollar" 
                  amount={botState.wallet.USD} 
                  icon={<DollarSign className="w-5 h-5 text-emerald-400" />} 
                  color="emerald"
                />
                <AssetCard 
                  label="Euro" 
                  amount={botState.wallet.EUR} 
                  icon={<Euro className="w-5 h-5 text-amber-400" />} 
                  color="amber"
                  subValue={`$${(botState.wallet.EUR * botState.currentPrice).toFixed(2)}`}
                />
                <div className="glass-card p-5 flex flex-col justify-between relative group">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-orange-500/20 transition-all" />
                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center border-2 border-orange-500/20">
                        <Coins className="w-6 h-6 text-orange-400" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Ethereum</p>
                        <p className="text-2xl font-bold font-mono tracking-tighter">
                          {ethBalance !== null ? ethBalance.toFixed(4) : '0.0000'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-end justify-between relative z-10">
                    <button
                      onClick={() => { handleMonetize(); playSound(1500, 'sine', 0.1, 0.05); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border-2 border-emerald-500/20 text-[10px] font-bold uppercase tracking-widest text-emerald-400 transition-all active:scale-95"
                    >
                      <Banknote className="w-4 h-4" />
                      Withdraw
                    </button>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Network</p>
                      <p className="font-mono text-xs text-orange-400 font-bold">ETH_MAIN</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Chart Section */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-panel p-6"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-lg font-bold uppercase tracking-tight">Market Analytics</h2>
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mt-1">1H Timeframe • EMA_9 / EMA_21</p>
                </div>
                <div className="flex gap-6 text-[10px] font-mono font-bold uppercase tracking-widest">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-1 bg-emerald-400 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.5)]"></div>
                    <span className="text-emerald-400">Fast: {botState.fastEma.toFixed(4)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-1 bg-rose-400 rounded-full shadow-[0_0_10px_rgba(251,113,133,0.5)]"></div>
                    <span className="text-rose-400">Slow: {botState.slowEma.toFixed(4)}</span>
                  </div>
                </div>
              </div>
              
              <div className="h-[450px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={botState.chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.5} />
                    <XAxis 
                      dataKey="timestamp" 
                      stroke="#52525b" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                      dy={10}
                      fontFamily="JetBrains Mono"
                    />
                    <YAxis 
                      domain={['auto', 'auto']} 
                      stroke="#52525b" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false} 
                      dx={-10}
                      tickFormatter={(value) => `$${Number(value).toFixed(4)}`}
                      fontFamily="JetBrains Mono"
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#09090b', border: '2px solid #27272a', borderRadius: '12px', fontFamily: 'JetBrains Mono', fontSize: '12px' }}
                      itemStyle={{ color: '#e4e4e7' }}
                    />
                    <Line type="monotone" dataKey="price" stroke="#e4e4e7" strokeWidth={3} dot={false} name="Price" animationDuration={1000} />
                    <Line type="monotone" dataKey="fastEma" stroke="#34d399" strokeWidth={2} dot={false} name="Fast EMA" animationDuration={1500} />
                    <Line type="monotone" dataKey="slowEma" stroke="#fb7185" strokeWidth={2} dot={false} name="Slow EMA" animationDuration={2000} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Logs */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-panel flex flex-col h-[750px]"
          >
            <div className="p-5 border-b-2 border-white/10 flex items-center justify-between bg-zinc-950/40">
              <h2 className="font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                System Logs
              </h2>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Live Feed</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-[11px]">
              {botState.logs.map((log, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={i} 
                  className={`p-4 rounded-xl border-2 backdrop-blur-md relative overflow-hidden group ${
                    log.type === 'buy' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' :
                    log.type === 'sell' ? 'bg-rose-500/5 border-rose-500/20 text-rose-400' :
                    log.type === 'error' ? 'bg-red-500/5 border-red-500/20 text-red-400' :
                    'bg-white/5 border-white/5 text-zinc-400'
                  }`}
                >
                  <div className="flex items-start gap-3 relative z-10">
                    <span className="text-zinc-600 font-bold shrink-0">[{log.time}]</span>
                    <span className="leading-relaxed">{log.message}</span>
                  </div>
                  {/* Decorative log background */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                </motion.div>
              ))}
              {botState.logs.length === 0 && (
                <div className="text-zinc-600 text-center py-12 uppercase tracking-widest font-bold text-[10px]">No System Activity Detected</div>
              )}
            </div>
            <div className="p-4 bg-zinc-950/40 border-t-2 border-white/10">
              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                <span>Buffer: 100%</span>
                <span>Encrypted: AES-256</span>
              </div>
            </div>
          </motion.div>

        </div>
      </main>
    </div>
  );
}

function AssetCard({ label, amount, icon, color, subValue }: { label: string, amount: number, icon: React.ReactNode, color: string, subValue?: string }) {
  const colorClasses: Record<string, string> = {
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.1)]',
    orange: 'bg-orange-500/10 border-orange-500/20 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.1)]',
  };

  return (
    <motion.div 
      whileHover={{ scale: 1.02, y: -2 }}
      className="glass-card p-5 flex flex-col justify-between group transition-all shadow-lg"
    >
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center border-2 ${colorClasses[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 group-hover:text-zinc-300 transition-colors">{label}</p>
          <p className="text-2xl font-bold font-mono tracking-tighter">{amount.toFixed(2)}</p>
        </div>
      </div>
      <div className="text-right border-t border-white/5 pt-3 mt-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Market Value</p>
        <p className={`font-mono text-xs font-bold ${color === 'emerald' ? 'text-emerald-400' : color === 'amber' ? 'text-amber-400' : 'text-orange-400'}`}>
          {subValue || `$${amount.toFixed(2)}`}
        </p>
      </div>
    </motion.div>
  );
}

function StatCard({ title, value, icon, trend, valueColor = "text-zinc-100" }: { title: string, value: string, icon: React.ReactNode, trend?: string, valueColor?: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className="glass-card p-5 flex flex-col justify-between group relative overflow-hidden"
    >
      <div className="flex items-center justify-between text-zinc-400 mb-4">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 group-hover:text-emerald-400 transition-colors">{title}</span>
        <div className="p-2 rounded-lg bg-white/5 border border-white/5 group-hover:border-emerald-500/30 transition-colors">
          {icon}
        </div>
      </div>
      <div className="flex items-end justify-between">
        <span className={`text-2xl font-bold tracking-tighter font-mono ${valueColor}`}>{value}</span>
        {trend && (
          <div className={`flex items-center px-2 py-1 rounded-md text-[10px] font-bold border ${trend === 'UP' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
            {trend === 'UP' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
            {trend}
          </div>
        )}
      </div>
      {/* Decorative Corner */}
      <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white/5 group-hover:border-emerald-500/20 transition-colors pointer-events-none" />
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
