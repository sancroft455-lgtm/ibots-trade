import express from 'express';
import { createServer as createHttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';

const db = new Database('aura_trade.db');

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    time TEXT,
    asset TEXT,
    type TEXT,
    price REAL,
    amount REAL,
    profit REAL,
    status TEXT
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

const app = express();
const httpServer = createHttpServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*' }
});

const PORT = 3000;

// --- AURA TRADE AI CONFIGURATION ---
const ASSETS = {
  CRYPTO: { symbol: 'ETH/USD', price: 2500, volatility: 40 },
  TRON: { symbol: 'TRX/USD', price: 0.14, volatility: 0.002 },
  STOCKS: { symbol: 'NVDA', price: 120, volatility: 2 },
  FOREX: { symbol: 'EUR/USD', price: 1.08, volatility: 0.005 },
  FUTURES: { symbol: 'ES1!', price: 5100, volatility: 15 }
};

let isBotRunning = false;
let currentAssetType: keyof typeof ASSETS = 'CRYPTO';

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

let botState = {
  status: 'Paused',
  activeAsset: ASSETS.CRYPTO,
  wallet: {
    USD: 10000.0,
    assets: {} as Record<string, number>,
    totalValue: 10000.0
  },
  stats: {
    winRate: 68.5,
    totalTrades: 142,
    totalProfit: 2450.50,
    volatility: 12.4,
    balance: 10000.0
  },
  logs: [] as TradeLog[],
  marketData: [] as any[]
};

// Load logs from DB
const savedLogs = db.prepare('SELECT * FROM logs ORDER BY time DESC LIMIT 50').all() as TradeLog[];
botState.logs = savedLogs;

// --- SIMULATION ENGINE ---
function generateMarketData(asset: any) {
  const data = [];
  let price = asset.price;
  for (let i = 0; i < 30; i++) {
    price = price + (Math.random() - 0.5) * asset.volatility;
    data.push({
      time: new Date(Date.now() - (30 - i) * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      price: price
    });
  }
  return data;
}

botState.marketData = generateMarketData(ASSETS.CRYPTO);

function updateMarket() {
  const asset = ASSETS[currentAssetType];
  const lastPrice = botState.marketData[botState.marketData.length - 1].price;
  const newPrice = lastPrice + (Math.random() - 0.5) * asset.volatility;
  
  botState.marketData.shift();
  botState.marketData.push({
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    price: newPrice
  });

  // Update wallet value
  let assetValue = 0;
  Object.entries(botState.wallet.assets).forEach(([symbol, amount]) => {
    if (symbol === asset.symbol) {
      assetValue += amount * newPrice;
    }
  });
  botState.wallet.totalValue = botState.wallet.USD + assetValue;

  // Emit to all clients
  io.emit('market_update', {
    price: newPrice,
    asset: asset.symbol,
    marketData: botState.marketData,
    wallet: botState.wallet
  });

  if (isBotRunning) {
    autoTrade(newPrice);
  }
}

function autoTrade(price: number) {
  const asset = ASSETS[currentAssetType];
  const chance = Math.random();
  
  if (chance > 0.95 && !botState.wallet.assets[asset.symbol]) {
    executeTrade('BUY', price);
  } else if (chance < 0.05 && botState.wallet.assets[asset.symbol]) {
    executeTrade('SELL', price);
  }
}

function executeTrade(type: 'BUY' | 'SELL', price: number) {
  const asset = ASSETS[currentAssetType];
  const amount = type === 'BUY' ? (botState.wallet.USD * 0.2) / price : botState.wallet.assets[asset.symbol];
  
  if (type === 'BUY') {
    botState.wallet.USD -= amount * price;
    botState.wallet.assets[asset.symbol] = (botState.wallet.assets[asset.symbol] || 0) + amount;
  } else {
    botState.wallet.USD += amount * price;
    delete botState.wallet.assets[asset.symbol];
  }

  const log: TradeLog = {
    id: Math.random().toString(36).substr(2, 9),
    time: new Date().toISOString(),
    asset: asset.symbol,
    type,
    price,
    amount,
    status: 'SUCCESS'
  };

  saveLog(log);
  
  io.emit('trade_execution', log);
}

function saveLog(log: TradeLog) {
  botState.logs.unshift(log);
  if (botState.logs.length > 50) botState.logs.pop();

  const stmt = db.prepare('INSERT INTO logs (id, time, asset, type, price, amount, profit, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  stmt.run(log.id, log.time, log.asset, log.type, log.price, log.amount, log.profit || 0, log.status);
}

// --- SMART CONTRACT SIMULATION ---
const MOCK_ABI = [
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline)",
  "function flashLoan(address receiver, address[] assets, uint[] amounts, uint[] modes, address onBehalfOf, bytes params, uint16 referralCode)"
];

app.use(express.json());

app.get('/api/aura/state', (req, res) => {
  res.json({
    ...botState,
    isBotRunning,
    currentAssetType,
    abi: MOCK_ABI
  });
});

app.post('/api/aura/toggle', (req, res) => {
  isBotRunning = !isBotRunning;
  botState.status = isBotRunning ? 'Active' : 'Paused';
  res.json({ isBotRunning, status: botState.status });
});

app.post('/api/aura/switch-asset', (req, res) => {
  const { type } = req.body;
  if (ASSETS[type as keyof typeof ASSETS]) {
    currentAssetType = type as keyof typeof ASSETS;
    botState.activeAsset = ASSETS[currentAssetType];
    botState.marketData = generateMarketData(botState.activeAsset);
    res.json({ success: true, asset: botState.activeAsset });
  } else {
    res.status(400).json({ error: 'Invalid asset type' });
  }
});

app.post('/api/aura/flash-loan', (req, res) => {
  const { amount } = req.body;
  const log: TradeLog = {
    id: `FL-${Math.random().toString(36).substr(2, 5)}`,
    time: new Date().toISOString(),
    asset: 'ETH',
    type: 'FLASH_LOAN',
    price: ASSETS.CRYPTO.price,
    amount,
    profit: amount * 0.02, // 2% arb profit
    status: 'SUCCESS'
  };
  botState.wallet.USD += log.profit!;
  botState.stats.totalProfit += log.profit!;
  saveLog(log);
  io.emit('trade_execution', log);
  res.json(log);
});

app.post('/api/aura/withdraw', (req, res) => {
  const { amount, method } = req.body;
  if (amount > botState.wallet.USD) {
    return res.status(400).json({ error: 'Insufficient funds' });
  }
  botState.wallet.USD -= amount;
  const log: TradeLog = {
    id: `WD-${Math.random().toString(36).substr(2, 5)}`,
    time: new Date().toISOString(),
    asset: 'USD',
    type: 'SELL', 
    price: 1,
    amount,
    status: 'SUCCESS'
  };
  saveLog(log);
  io.emit('trade_execution', log);
  res.json({ success: true, amount, method });
});

app.post('/api/aura/sync-wallet', (req, res) => {
  const { balanceUSD } = req.body;
  if (typeof balanceUSD === 'number') {
    botState.wallet.USD = balanceUSD;
    botState.wallet.totalValue = balanceUSD + Object.entries(botState.wallet.assets).reduce((acc, [symbol, amount]) => {
      const asset = Object.values(ASSETS).find(a => a.symbol === symbol);
      return acc + (amount * (asset?.price || 0));
    }, 0);
    botState.stats.balance = botState.wallet.totalValue;
    
    io.emit('market_update', {
      price: ASSETS[currentAssetType].price,
      asset: ASSETS[currentAssetType].symbol,
      marketData: botState.marketData,
      wallet: botState.wallet
    });
    
    res.json({ success: true, wallet: botState.wallet });
  } else {
    res.status(400).json({ error: 'Invalid balance' });
  }
});

// --- SERVER STARTUP ---
setInterval(updateMarket, 2000);

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Aura Trade AI Server running on http://localhost:${PORT}`);
  });
}

startServer();


