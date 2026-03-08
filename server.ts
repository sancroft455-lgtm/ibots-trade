import express from 'express';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

// --- BOT CONFIGURATION ---
const SYMBOL = 'EUR_USD';
const BUDGET = 1000.0;
const FAST_EMA_PERIOD = 9;
const SLOW_EMA_PERIOD = 21;

// Oanda Config
const OANDA_API_KEY = process.env.OANDA_API_KEY || '';
const OANDA_ACCOUNT_ID = process.env.OANDA_ACCOUNT_ID || '';
const OANDA_BASE_URL = 'https://api-fxpractice.oanda.com/v3';

// State to hold the latest bot data
let isBotRunning = true;
let botState = {
  status: 'Initializing',
  symbol: SYMBOL,
  budget: BUDGET,
  currentPrice: 0,
  fastEma: 0,
  slowEma: 0,
  trend: 'UNKNOWN',
  inPosition: false,
  lastAction: 'None',
  wallet: {
    USD: BUDGET,
    EUR: 0,
    totalUSD: BUDGET,
  },
  logs: [] as { time: string; message: string; type: string }[],
  chartData: [] as any[],
};

function addLog(message: string, type: 'info' | 'buy' | 'sell' | 'error' = 'info') {
  const time = new Date().toLocaleTimeString();
  botState.logs.unshift({ time, message, type });
  if (botState.logs.length > 50) botState.logs.pop();
  console.log(`[${time}] ${message}`);
}

// EMA Calculation
function calculateEMA(data: number[], period: number): number[] {
  if (!data || data.length === 0) return [];
  const k = 2 / (period + 1);
  const ema = [data[0]];
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

// Simulated Data Fallback
let simulatedCandles: any[] = [];
function getSimulatedCandles() {
  if (simulatedCandles.length === 0) {
    let price = 1.0850;
    let time = Date.now() - 50 * 3600 * 1000;
    for (let i = 0; i < 50; i++) {
      price = price + (Math.random() - 0.5) * 0.0020;
      simulatedCandles.push({
        timestamp: time + i * 3600 * 1000,
        open: price,
        high: price + 0.0010,
        low: price - 0.0010,
        close: price + (Math.random() - 0.5) * 0.0010,
        volume: Math.floor(Math.random() * 1000)
      });
    }
  } else {
    const last = simulatedCandles[simulatedCandles.length - 1];
    const newPrice = last.close + (Math.random() - 0.5) * 0.0020;
    simulatedCandles.shift();
    simulatedCandles.push({
      timestamp: Date.now(),
      open: last.close,
      high: Math.max(last.close, newPrice) + 0.0005,
      low: Math.min(last.close, newPrice) - 0.0005,
      close: newPrice,
      volume: Math.floor(Math.random() * 1000)
    });
  }
  return simulatedCandles;
}

async function fetchOandaCandles() {
  if (!OANDA_API_KEY) {
    return getSimulatedCandles();
  }

  try {
    const response = await fetch(`${OANDA_BASE_URL}/instruments/${SYMBOL}/candles?count=50&price=M&granularity=H1`, {
      headers: {
        'Authorization': `Bearer ${OANDA_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Oanda API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.candles.map((c: any) => ({
      timestamp: new Date(c.time).getTime(),
      open: parseFloat(c.mid.o),
      high: parseFloat(c.mid.h),
      low: parseFloat(c.mid.l),
      close: parseFloat(c.mid.c),
      volume: c.volume
    }));
  } catch (error: any) {
    addLog(`⚠️ Oanda API failed (${error.message}). Falling back to simulated data.`, 'error');
    return getSimulatedCandles();
  }
}

async function runBot() {
  addLog(`💎 Lucy Bot Initialized. Target: ${SYMBOL} | Budget: $${BUDGET}`);
  if (!OANDA_API_KEY) {
    addLog(`⚠️ OANDA_API_KEY not found. Using simulated market data.`, 'error');
  } else {
    addLog(`🔗 Connected to Oanda Broker (Practice)`, 'info');
  }
  
  botState.status = 'Running';

  while (true) {
    if (!isBotRunning) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      continue;
    }

    try {
      addLog('Scanning market...', 'info');

      const bars = await fetchOandaCandles();
      
      const closes = bars.map((b: any) => b.close);
      const timestamps = bars.map((b: any) => b.timestamp);
      
      const fastEma = calculateEMA(closes, FAST_EMA_PERIOD);
      const slowEma = calculateEMA(closes, SLOW_EMA_PERIOD);

      const lastClose = closes[closes.length - 1] || 0;
      const prevClose = closes[closes.length - 2] || 0;
      
      const lastFastEma = fastEma[fastEma.length - 1] || 0;
      const prevFastEma = fastEma[fastEma.length - 2] || 0;
      
      const lastSlowEma = slowEma[slowEma.length - 1] || 0;
      const prevSlowEma = slowEma[slowEma.length - 2] || 0;

      botState.currentPrice = lastClose;
      botState.fastEma = lastFastEma;
      botState.slowEma = lastSlowEma;
      botState.trend = lastFastEma > lastSlowEma ? 'UP' : 'DOWN';

      // Update live wallet total USD value
      botState.wallet.totalUSD = botState.wallet.USD + (botState.wallet.EUR * lastClose);

      // Update chart data for frontend
      botState.chartData = bars.map((b: any, i: number) => ({
        timestamp: new Date(b.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        price: b.close,
        fastEma: fastEma[i],
        slowEma: slowEma[i]
      })).slice(-20); // Keep last 20 for chart

      // Check Signals
      const buySignal = prevFastEma < prevSlowEma && lastFastEma > lastSlowEma;
      const sellSignal = prevFastEma > prevSlowEma && lastFastEma < lastSlowEma;

      if (buySignal && !botState.inPosition) {
        // Execute Simulated Buy
        const eurBought = botState.wallet.USD / lastClose;
        botState.wallet.EUR += eurBought;
        botState.wallet.USD = 0;
        
        addLog(`🚀 BUY SIGNAL at $${lastClose.toFixed(4)}. Bought ${eurBought.toFixed(2)} EUR`, 'buy');
        botState.inPosition = true;
        botState.lastAction = 'BUY';
      } else if (sellSignal && botState.inPosition) {
        // Execute Simulated Sell
        const usdGained = botState.wallet.EUR * lastClose;
        botState.wallet.USD += usdGained;
        botState.wallet.EUR = 0;
        
        addLog(`📉 SELL SIGNAL at $${lastClose.toFixed(4)}. Secured $${usdGained.toFixed(2)} USD`, 'sell');
        botState.inPosition = false;
        botState.lastAction = 'SELL';
      } else {
        addLog(`💤 No action. Price: $${lastClose.toFixed(4)} | Trend: ${botState.trend}`, 'info');
      }

    } catch (error: any) {
      addLog(`⚠️ Error: ${error.message}`, 'error');
    }

    // Wait 5 seconds for simulation, or 1 minute for real
    await new Promise(resolve => setTimeout(resolve, OANDA_API_KEY ? 60000 : 5000));
  }
}

// Start bot in background
runBot();

// --- API ROUTES ---
app.get('/api/bot-state', (req, res) => {
  res.json(botState);
});

app.post('/api/bot/toggle', (req, res) => {
  isBotRunning = !isBotRunning;
  botState.status = isBotRunning ? 'Running' : 'Paused';
  addLog(`Bot ${isBotRunning ? 'started' : 'paused'} by user.`, 'info');
  res.json({ status: botState.status });
});

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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
