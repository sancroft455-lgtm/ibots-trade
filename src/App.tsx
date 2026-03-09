import React, { useEffect, useState, useCallback, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { 
  Activity, TrendingUp, TrendingDown, DollarSign, Clock, 
  Zap, Wallet, Coins, RefreshCw, Play, Square, 
  Banknote, Terminal as TerminalIcon, ChevronRight,
  Shield, Cpu, Globe, Settings, BarChart3, Layers,
  ArrowRightLeft, Database, Lock, User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import { ethers } from 'ethers';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

declare global {
  interface Window {
    ethereum?: any;
  }
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- TYPES ---
interface Asset {
  symbol: string;
  price: number;
  volatility: number;
}

interface TradeLog {
  id: string;
  time: string;
  asset: string;
  type: 'BUY' | 'SELL' | 'FLASH_LOAN' | 'SWAP';
  price: number;
  amount: number;
  profit?: number;
  status: 'SUCCESS' | 'FAILED';
}

interface BotState {
  status: string;
  activeAsset: Asset;
  wallet: {
    USD: number;
    assets: Record<string, number>;
    totalValue: number;
  };
  stats: {
    winRate: number;
    totalTrades: number;
    totalProfit: number;
    volatility: number;
  };
  logs: TradeLog[];
  marketData: any[];
  isBotRunning: boolean;
  currentAssetType: string;
  abi: string[];
}

// --- COMPONENTS ---

const StatBox = ({ title, value, icon: Icon, trend, color = "emerald" }: any) => (
  <div className="glass-card p-4 flex flex-col justify-between group relative overflow-hidden">
    <div className="flex items-center justify-between text-zinc-500 mb-2">
      <span className="text-[10px] font-bold uppercase tracking-widest group-hover:text-emerald-400 transition-colors">{title}</span>
      <Icon className="w-4 h-4 opacity-50" />
    </div>
    <div className="flex items-end justify-between">
      <span className="text-xl font-bold font-mono tracking-tighter">{value}</span>
      {trend && (
        <span className={cn(
          "text-[10px] font-bold px-1.5 py-0.5 rounded border",
          trend > 0 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"
        )}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <div className="absolute top-0 right-0 w-6 h-6 border-t border-r border-white/5 group-hover:border-emerald-500/20 transition-colors" />
  </div>
);

const WalletInterface = () => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>('0.00');
  const [network, setNetwork] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const connect = async () => {
    if (!window.ethereum) return alert("MetaMask not found");
    setIsConnecting(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const balance = await provider.getBalance(accounts[0]);
      const network = await provider.getNetwork();
      
      setWalletAddress(accounts[0]);
      setBalance(ethers.formatEther(balance));
      setNetwork(network.name);
    } catch (e) {
      console.error(e);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel p-8 flex flex-col items-center justify-center text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50" />
        
        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 relative">
          <Wallet className="w-10 h-10 text-emerald-400" />
          {walletAddress && <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border-4 border-zinc-950" />}
        </div>

        <h2 className="text-3xl font-bold tracking-tighter mb-2">
          {walletAddress ? "Wallet Connected" : "Connect Your Wallet"}
        </h2>
        <p className="text-zinc-500 max-w-md mb-8">
          Securely connect your crypto wallet to enable AI-driven automated trading, liquidity provisioning, and real-time portfolio tracking.
        </p>

        {!walletAddress ? (
          <button 
            onClick={connect}
            disabled={isConnecting}
            className="brutal-btn bg-emerald-500 text-black font-black px-12 py-4 rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.2)] hover:scale-105 transition-all disabled:opacity-50"
          >
            {isConnecting ? "AUTHORIZING..." : "CONNECT WALLET"}
          </button>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl">
            <div className="glass-card p-4 text-left">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Address</span>
              <span className="font-mono text-sm text-emerald-400">{walletAddress.slice(0, 10)}...{walletAddress.slice(-8)}</span>
            </div>
            <div className="glass-card p-4 text-left">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Balance</span>
              <span className="font-mono text-sm text-white">{parseFloat(balance).toFixed(4)} ETH</span>
            </div>
            <div className="glass-card p-4 text-left">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-1">Network</span>
              <span className="font-mono text-sm text-indigo-400 uppercase">{network || "Unknown"}</span>
            </div>
          </div>
        )}
      </div>

      {walletAddress && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-panel p-6">
            <h3 className="text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              Security Settings
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                <div>
                  <p className="text-xs font-bold">Auto-Approve Swaps</p>
                  <p className="text-[10px] text-zinc-500">Allow AI to execute swaps without confirmation</p>
                </div>
                <div className="w-10 h-5 bg-emerald-500/20 rounded-full relative">
                  <div className="absolute right-1 top-1 w-3 h-3 bg-emerald-500 rounded-full" />
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 opacity-50">
                <div>
                  <p className="text-xs font-bold">Flash Loan Permissions</p>
                  <p className="text-[10px] text-zinc-500">Enable high-leverage arbitrage calls</p>
                </div>
                <div className="w-10 h-5 bg-white/10 rounded-full relative">
                  <div className="absolute left-1 top-1 w-3 h-3 bg-zinc-500 rounded-full" />
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel p-6">
            <h3 className="text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              Wallet Activity
            </h3>
            <div className="flex flex-col items-center justify-center h-32 text-zinc-600">
              <Clock className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-[10px] font-bold uppercase tracking-widest">No recent on-chain activity</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [state, setState] = useState<BotState | null>(null);
  const [loading, setLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isEntered, setIsEntered] = useState(false);
  const [securityKey, setSecurityKey] = useState('');
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'ADMIN' | 'LOGS' | 'SECURE_BOT' | 'WALLET'>('DASHBOARD');
  const socketRef = useRef<Socket | null>(null);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/aura/state');
      const data = await res.json();
      setState(data);
      setLoading(false);
    } catch (e) {
      console.error('Fetch error:', e);
    }
  }, []);

  useEffect(() => {
    fetchState();
    const socket = io({
      reconnection: true,
      reconnectionAttempts: 5,
      timeout: 10000,
    });
    socketRef.current = socket;

    socket.on('connect_error', (err) => {
      console.warn('Socket connection error:', err.message);
    });

    socket.on('market_update', (data) => {
      setState(prev => prev ? {
        ...prev,
        wallet: data.wallet,
        marketData: data.marketData,
        activeAsset: { ...prev.activeAsset, price: data.price }
      } : null);
    });

    socketRef.current.on('trade_execution', (log) => {
      setState(prev => prev ? {
        ...prev,
        logs: [log, ...prev.logs].slice(0, 50)
      } : null);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [fetchState]);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        setWalletAddress(accounts[0]);
      } catch (e) {
        alert("Connection rejected");
      }
    } else {
      alert("Please install MetaMask");
    }
  };

  const toggleBot = async () => {
    const res = await fetch('/api/aura/toggle', { method: 'POST' });
    const data = await res.json();
    setState(prev => prev ? { ...prev, isBotRunning: data.isBotRunning, status: data.status } : null);
  };

  const switchAsset = async (type: string) => {
    setIsSyncing(true);
    const res = await fetch('/api/aura/switch-asset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type })
    });
    if (res.ok) fetchState();
    setTimeout(() => setIsSyncing(false), 800);
  };

  const executeFlashLoan = async () => {
    const amount = prompt("Enter Flash Loan amount (ETH):", "100");
    if (!amount) return;
    await fetch('/api/aura/flash-loan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: parseFloat(amount) })
    });
  };

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('BANK');

  const handleWithdraw = () => {
    setShowWithdrawModal(true);
  };

  const executeWithdraw = async () => {
    if (!withdrawAmount) return;
    const res = await fetch('/api/aura/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: parseFloat(withdrawAmount), method: withdrawMethod })
    });
    if (res.ok) {
      fetchState();
      setShowWithdrawModal(false);
      setWithdrawAmount('');
    }
  };

  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [swapAmount, setSwapAmount] = useState('');
  const [selectedContractFunc, setSelectedContractFunc] = useState<string | null>(null);

  const handleSwap = async () => {
    if (!swapAmount) return;
    // Simulated swap execution
    const log: TradeLog = {
      id: `SW-${Math.random().toString(36).substr(2, 5)}`,
      time: new Date().toISOString(),
      asset: state.activeAsset.symbol,
      type: 'SWAP',
      price: state.activeAsset.price,
      amount: parseFloat(swapAmount),
      status: 'SUCCESS'
    };
    // In a real app, we'd call the backend to update wallet
    // For now, we'll just emit locally or wait for socket
    alert(`Swap executed: ${swapAmount} ${state.activeAsset.symbol}`);
    setShowSwapModal(false);
    setSwapAmount('');
  };

  const handleContractCall = (func: string) => {
    setSelectedContractFunc(func);
    setShowContractModal(true);
  };

  const executeContractCall = () => {
    alert(`Executing ${selectedContractFunc} on Ethereum Mainnet...`);
    setShowContractModal(false);
  };

  if (loading || !state) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-emerald-500 font-mono">
      <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
        LOADING_AURA_TRADE_AI_CORE...
      </motion.div>
    </div>
  );

  if (!isEntered) {
    return (
      <div className="min-h-screen bg-zinc-950 text-emerald-500 font-mono flex items-center justify-center p-6 relative overflow-hidden">
        <div className="crt-overlay pointer-events-none" />
        <div className="scanline pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full glass-panel p-8 border-emerald-500/30 relative z-10"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tighter uppercase italic">Secure Access Gate</h1>
              <p className="text-[10px] text-emerald-500/60 uppercase tracking-widest">Aura Trade AI v2.4.0</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest block">System Security Key</label>
              <div className="relative">
                <input 
                  type="password"
                  value={securityKey}
                  onChange={(e) => setSecurityKey(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (securityKey === '0000') {
                        setIsEntered(true);
                      } else {
                        alert('INVALID_SECURITY_KEY');
                        setSecurityKey('');
                      }
                    }
                  }}
                  placeholder="••••••••••••"
                  className="w-full bg-black/40 border border-emerald-500/30 rounded-xl p-4 outline-none focus:border-emerald-500 transition-all text-emerald-400 placeholder:text-emerald-900"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <Shield className="w-4 h-4 opacity-30" />
                </div>
              </div>
            </div>

            <button 
              onClick={() => {
                if (securityKey === '0000') {
                  setIsEntered(true);
                } else {
                  alert('INVALID_SECURITY_KEY');
                  setSecurityKey('');
                }
              }}
              className="w-full h-14 bg-emerald-500 text-black font-bold uppercase tracking-widest rounded-xl hover:bg-emerald-400 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <TerminalIcon className="w-4 h-4" />
              Enter Secure System
            </button>

            <div className="pt-4 border-t border-emerald-500/10 text-[8px] text-emerald-500/40 uppercase tracking-widest leading-relaxed">
              Warning: Unauthorized access is strictly prohibited. All system activities are monitored and logged by the Aura Security Protocol.
            </div>
          </div>
        </motion.div>

        {/* Background elements */}
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
          <div className="grid grid-cols-12 h-full">
            {Array.from({ length: 144 }).map((_, i) => (
              <div key={i} className="border border-emerald-500/20" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30 relative overflow-hidden">
      <div className="crt-overlay" />
      <div className="scanline" />

      {/* TOP NAV */}
      <header className="h-16 border-b border-white/10 bg-black/40 backdrop-blur-xl sticky top-0 z-50 px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-emerald-500/10 border border-emerald-500/30 rounded flex items-center justify-center">
            <Cpu className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h1 className="font-black text-sm tracking-tighter uppercase italic">AURA TRADE AI</h1>
            <div className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[8px] font-mono text-emerald-500/60 uppercase tracking-widest">System Online</span>
            </div>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/5">
          {['DASHBOARD', 'WALLET', 'SECURE_BOT', 'ADMIN', 'LOGS'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={cn(
                "px-4 py-1.5 rounded-md text-[10px] font-bold tracking-widest transition-all",
                activeTab === tab ? "bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {tab.replace('_', ' ')}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <div className="hidden lg:flex flex-col items-end font-mono text-[10px]">
            <span className="text-zinc-500 uppercase">Latency</span>
            <span className="text-emerald-400">12ms</span>
          </div>
          <button 
            onClick={connectWallet}
            className="brutal-btn bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 flex items-center gap-2"
          >
            <Wallet className="w-3.5 h-3.5" />
            {walletAddress ? `${walletAddress.slice(0, 6)}...` : 'Connect'}
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        
        {activeTab === 'SECURE_BOT' ? (
          <div className="lg:col-span-12">
            <SecureBotInterface />
          </div>
        ) : activeTab === 'WALLET' ? (
          <div className="lg:col-span-12">
            <WalletInterface />
          </div>
        ) : (
          <>
            {/* LEFT: MARKET & CONTROLS */}
            <div className="lg:col-span-8 space-y-6">
          
          {!walletAddress && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel p-6 border-emerald-500/30 bg-emerald-500/5 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative"
            >
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-emerald-500/10 blur-3xl rounded-full" />
              <div className="relative z-10">
                <h3 className="text-xl font-bold tracking-tighter mb-1 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-400" />
                  Connect Crypto Wallet
                </h3>
                <p className="text-zinc-400 text-sm max-w-md">
                  Unlock full AI trading capabilities by connecting your Web3 wallet. Aura AI requires a secure connection to execute DEX swaps and flash loans.
                </p>
              </div>
              <button 
                onClick={connectWallet}
                className="brutal-btn bg-emerald-500 text-black font-black px-8 py-3 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:scale-105 transition-transform relative z-10"
              >
                CONNECT NOW
              </button>
            </motion.div>
          )}

          {/* STATS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatBox title="Win Rate" value={`${state.stats.winRate}%`} icon={TrendingUp} trend={2.4} />
            <StatBox title="Total Profit" value={`$${state.stats.totalProfit.toLocaleString()}`} icon={DollarSign} trend={12.1} />
            <StatBox title="Volatility" value={`${state.stats.volatility}%`} icon={Activity} trend={-1.2} />
            <StatBox title="Active Asset" value={state.activeAsset.symbol} icon={Globe} />
          </div>

          {/* CHART */}
          <div className="glass-panel p-6 h-[450px]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Market Execution Flow</h2>
                <p className="text-xl font-mono font-bold">${state.activeAsset.price.toFixed(4)}</p>
              </div>
              <div className="flex gap-2">
                {['CRYPTO', 'STOCKS', 'FOREX', 'FUTURES'].map((type) => (
                  <button
                    key={type}
                    onClick={() => switchAsset(type)}
                    className={cn(
                      "px-3 py-1 rounded border text-[9px] font-bold tracking-widest transition-all",
                      state.currentAssetType === type ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" : "bg-white/5 border-white/5 text-zinc-500"
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <AreaChart data={state.marketData}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis dataKey="time" stroke="#ffffff20" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis domain={['auto', 'auto']} stroke="#ffffff20" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `$${v.toFixed(2)}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#09090b', border: '1px solid #ffffff10', borderRadius: '8px', fontSize: '10px' }}
                  />
                  <Area type="monotone" dataKey="price" stroke="#10b981" fillOpacity={1} fill="url(#colorPrice)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button 
              onClick={toggleBot}
              className={cn(
                "h-16 rounded-2xl border-2 flex items-center justify-center gap-3 font-bold tracking-widest transition-all",
                state.isBotRunning ? "bg-rose-500/10 border-rose-500/30 text-rose-400" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              )}
            >
              {state.isBotRunning ? <Square className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              {state.isBotRunning ? 'HALT SYSTEM' : 'INITIATE BOT'}
            </button>
            <button 
              onClick={() => setShowSwapModal(true)}
              className="h-16 rounded-2xl border-2 bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-bold tracking-widest flex items-center justify-center gap-3"
            >
              <ArrowRightLeft className="w-5 h-5" />
              DEX SWAP CALL
            </button>
            <button 
              onClick={executeFlashLoan}
              className="h-16 rounded-2xl border-2 bg-indigo-500/10 border-indigo-500/30 text-indigo-400 font-bold tracking-widest flex items-center justify-center gap-3"
            >
              <Zap className="w-5 h-5" />
              FLASH LOAN CALL
            </button>
            <button 
              onClick={handleWithdraw}
              className="h-16 rounded-2xl border-2 bg-amber-500/5 border-amber-500/20 text-amber-500/80 font-bold tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-amber-500/10 hover:border-amber-500/40 hover:text-amber-400 transition-all active:scale-95 group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/5 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
              <Banknote className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              WITHDRAW_FUNDS
            </button>
          </div>
        </div>

        {/* RIGHT: LOGS & WALLET */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* WALLET */}
          <div className="glass-panel p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Portfolio Balance</h2>
              <RefreshCw className={cn("w-4 h-4 text-zinc-500", isSyncing && "animate-spin text-emerald-500")} />
            </div>
            <div className="text-3xl font-mono font-black tracking-tighter mb-6">
              ${state.wallet.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-emerald-500/10 flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest">USD Balance</span>
                </div>
                <span className="font-mono text-xs">${state.wallet.USD.toFixed(2)}</span>
              </div>
              {Object.entries(state.wallet.assets).map(([symbol, amount]) => (
                <div key={symbol} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-amber-500/10 flex items-center justify-center">
                      <Coins className="w-4 h-4 text-amber-400" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest">{symbol}</span>
                  </div>
                  <span className="font-mono text-xs">{(amount as number).toFixed(4)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* LOGS */}
          <div className="glass-panel h-[500px] flex flex-col">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Execution Logs</h2>
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/20" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              <AnimatePresence initial={false}>
                {state.logs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      "p-3 rounded-lg border text-[10px] font-mono relative overflow-hidden",
                      log.type === 'BUY' ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" :
                      log.type === 'SELL' ? "bg-rose-500/5 border-rose-500/20 text-rose-400" :
                      log.type === 'FLASH_LOAN' ? "bg-indigo-500/5 border-indigo-500/20 text-indigo-400" :
                      "bg-white/5 border-white/5 text-zinc-400"
                    )}
                  >
                    <div className="flex justify-between mb-1">
                      <span className="font-bold">{log.type} {log.asset}</span>
                      <span className="opacity-50">{log.time}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Amt: {(log.amount as number).toFixed(4)}</span>
                      <span>Px: ${(log.price as number).toFixed(2)}</span>
                    </div>
                    {log.profit && <div className="mt-1 font-bold">Profit: +${(log.profit as number).toFixed(2)}</div>}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </>
    )}
  </main>

      {/* TERMINAL / ADMIN PANEL */}
      <AnimatePresence>
        {activeTab === 'ADMIN' && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-0 left-0 right-0 h-[400px] bg-black/90 backdrop-blur-3xl border-t border-white/10 z-[60] p-8"
          >
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="space-y-6">
                <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-emerald-500">System Architecture</h3>
                <div className="space-y-4">
                  <AdminItem icon={Shield} label="Security Protocol" value="AES-256-GCM" />
                  <AdminItem icon={Database} label="Storage" value="SQLite_Sync" />
                  <AdminItem icon={Lock} label="Auth" value="Web3_Signature" />
                </div>
              </div>
              <div className="space-y-6">
                <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-emerald-500">Smart Contract ABI</h3>
                <div className="bg-black/40 p-4 rounded-xl border border-white/5 font-mono text-[9px] text-zinc-500 h-48 overflow-y-auto custom-scrollbar">
                  {state.abi.map((line, i) => (
                    <div 
                      key={i} 
                      onClick={() => handleContractCall(line)}
                      className="mb-2 hover:text-emerald-400 cursor-pointer transition-colors p-1 hover:bg-white/5 rounded"
                    >
                      {line}
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-6">
                <h3 className="text-xs font-bold uppercase tracking-[0.3em] text-emerald-500">Engineering Controls</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button className="p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-left">
                    <Settings className="w-4 h-4 text-zinc-400 mb-2" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">Config</p>
                  </button>
                  <button className="p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-left">
                    <User className="w-4 h-4 text-zinc-400 mb-2" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">Profile</p>
                  </button>
                  <button className="p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-left">
                    <BarChart3 className="w-4 h-4 text-zinc-400 mb-2" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">Reports</p>
                  </button>
                  <button className="p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-left">
                    <Layers className="w-4 h-4 text-zinc-400 mb-2" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">Nodes</p>
                  </button>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setActiveTab('DASHBOARD')}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/5 transition-all"
            >
              <Square className="w-4 h-4 text-zinc-500" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WITHDRAW MODAL */}
      <AnimatePresence>
        {showWithdrawModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowWithdrawModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel p-8 w-full max-w-md relative z-10 border-amber-500/20"
            >
              <h2 className="text-xl font-black italic uppercase mb-6 flex items-center gap-3">
                <Banknote className="w-6 h-6 text-amber-400" />
                SECURE WITHDRAWAL
              </h2>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Withdrawal Amount (USD)</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-4 font-mono text-amber-400 outline-none focus:border-amber-500/50 transition-all text-xl"
                      placeholder="0.00"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-600 uppercase">USD</div>
                  </div>
                  <div className="mt-2 flex justify-between text-[10px] font-mono text-zinc-500">
                    <span>Available:</span>
                    <span>${state.wallet.USD.toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block">Transfer Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['BANK', 'CRYPTO'].map((m) => (
                      <button
                        key={m}
                        onClick={() => setWithdrawMethod(m)}
                        className={cn(
                          "p-3 rounded-xl border text-[10px] font-bold tracking-widest transition-all",
                          withdrawMethod === m ? "bg-amber-500/20 border-amber-500/50 text-amber-400" : "bg-white/5 border-white/5 text-zinc-500"
                        )}
                      >
                        {m} TRANSFER
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 text-[9px] font-mono text-amber-500/60 leading-relaxed">
                  NOTICE: Withdrawals are processed through the Aura Liquidity Bridge. Estimated arrival: 2-4 minutes. Network fees may apply.
                </div>

                <button 
                  onClick={executeWithdraw}
                  disabled={!withdrawAmount || parseFloat(withdrawAmount) > state.wallet.USD}
                  className="w-full h-14 rounded-xl bg-amber-500 text-black font-bold uppercase tracking-widest hover:bg-amber-400 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Initiate Withdrawal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SWAP MODAL */}
      <AnimatePresence>
        {showSwapModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowSwapModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel p-8 w-full max-w-md relative z-10"
            >
              <h2 className="text-xl font-black italic uppercase mb-6 flex items-center gap-3">
                <ArrowRightLeft className="w-6 h-6 text-emerald-400" />
                DEX SWAP EXECUTION
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-2">Amount to Swap</label>
                  <input 
                    type="number" 
                    value={swapAmount}
                    onChange={(e) => setSwapAmount(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-4 font-mono text-emerald-400 outline-none focus:border-emerald-500/50 transition-all"
                    placeholder="0.00"
                  />
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-[10px] font-mono text-zinc-400">
                  <div className="flex justify-between mb-2">
                    <span>Asset:</span>
                    <span className="text-emerald-400">{state.activeAsset.symbol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Est. Output:</span>
                    <span className="text-emerald-400">~{(parseFloat(swapAmount || '0') * 0.99).toFixed(4)}</span>
                  </div>
                </div>
                <button 
                  onClick={handleSwap}
                  className="w-full h-14 rounded-xl bg-emerald-500 text-black font-bold uppercase tracking-widest hover:bg-emerald-400 transition-all active:scale-95"
                >
                  Confirm Swap
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONTRACT MODAL */}
      <AnimatePresence>
        {showContractModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowContractModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel p-8 w-full max-w-md relative z-10"
            >
              <h2 className="text-xl font-black italic uppercase mb-6 flex items-center gap-3">
                <Database className="w-6 h-6 text-indigo-400" />
                CONTRACT CALL
              </h2>
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-black/40 border border-white/10 font-mono text-xs text-indigo-400">
                  {selectedContractFunc}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block">Parameters</label>
                  <input className="w-full bg-black/40 border border-white/10 rounded-xl p-3 font-mono text-xs outline-none" placeholder="uint256 amountIn" />
                  <input className="w-full bg-black/40 border border-white/10 rounded-xl p-3 font-mono text-xs outline-none" placeholder="address[] path" />
                </div>
                <button 
                  onClick={executeContractCall}
                  className="w-full h-14 rounded-xl bg-indigo-500 text-white font-bold uppercase tracking-widest hover:bg-indigo-400 transition-all active:scale-95"
                >
                  Execute Call
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FOOTER STATUS */}
      <footer className="h-12 border-t border-white/5 bg-black/80 backdrop-blur-xl px-8 flex items-center justify-between text-[9px] font-mono text-zinc-500 uppercase tracking-[0.2em] relative z-20 mt-12">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
            <span className="text-emerald-500/80">Core_Sync: ACTIVE</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-emerald-500/80">Network: MAINNET_BETA</span>
          </div>
          <div className="hidden sm:flex items-center gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-emerald-500/80">Web3_Provider: CLOUD_NODE_01</span>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <div className="hidden md:flex items-center gap-4">
            <span className="opacity-50">Gas: 12 Gwei</span>
            <span className="opacity-50">Block: #19420512</span>
          </div>
          <div className="flex items-center gap-4 border-l border-white/10 pl-8">
            <span className="text-zinc-400">v2.4.0-STABLE</span>
            <span className="text-zinc-600">© 2026 AURA_LABS</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function AdminItem({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
      <div className="flex items-center gap-3">
        <Icon className="w-4 h-4 text-zinc-500" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{label}</span>
      </div>
      <span className="font-mono text-[10px] text-emerald-400">{value}</span>
    </div>
  );
}

function SecureBotInterface() {
  const [messages, setMessages] = useState([
    { role: 'bot', content: 'SECURE_CHANNEL_ESTABLISHED. I am AURA_SECURE_BOT. How can I assist with your high-frequency operations today?' }
  ]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // Simulated bot response
    setTimeout(() => {
      const botMsg = { role: 'bot', content: `ANALYZING: "${input}"... [ENCRYPTED_RESPONSE]: System parameters are within optimal range. Secure execution confirmed.` };
      setMessages(prev => [...prev, botMsg]);
    }, 1000);
  };

  return (
    <div className="glass-panel h-[700px] flex flex-col overflow-hidden border-emerald-500/20">
      <div className="p-6 border-b border-white/10 flex items-center justify-between bg-emerald-500/5">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/40">
            <Shield className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-black tracking-widest uppercase italic">Aura Secure Bot</h2>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-mono text-emerald-500/60 uppercase tracking-widest">End-to-End Encrypted</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="px-3 py-1 rounded bg-black/40 border border-white/10 text-[9px] font-mono text-zinc-500">
            SEC_LEVEL: 5
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-black/20">
        {messages.map((msg, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex flex-col max-w-[80%]",
              msg.role === 'user' ? "ml-auto items-end" : "items-start"
            )}
          >
            <div className={cn(
              "p-4 rounded-2xl text-xs font-mono leading-relaxed",
              msg.role === 'user' 
                ? "bg-emerald-500 text-black font-bold rounded-tr-none" 
                : "bg-white/5 border border-white/10 text-emerald-400 rounded-tl-none"
            )}>
              {msg.content}
            </div>
            <span className="text-[8px] mt-1 text-zinc-600 uppercase font-bold tracking-widest">
              {msg.role === 'user' ? 'Authorized_User' : 'Secure_Bot'} • {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </motion.div>
        ))}
      </div>

      <div className="p-6 bg-black/40 border-t border-white/10">
        <div className="relative">
          <input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Enter encrypted command..."
            className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 pr-16 outline-none focus:border-emerald-500/50 transition-all font-mono text-xs text-emerald-400"
          />
          <button 
            onClick={handleSend}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-emerald-500 text-black rounded-xl flex items-center justify-center hover:bg-emerald-400 transition-all active:scale-95"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
