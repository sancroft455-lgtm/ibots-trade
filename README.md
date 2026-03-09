# Aura Trade AI 🚀

Aura Trade AI is a high-performance, multi-asset trading bot platform with deep Web3 integration. It supports Crypto, Stocks, Forex, and Futures trading with real-time market data and automated execution.

## 💎 Key Features

-   **Multi-Asset Engine**: Real-time simulation for Crypto (ETH), Stocks (NVDA), Forex (EUR/USD), and Futures (ES1!).
-   **Web3 Integration**: MetaMask wallet connection, cryptographic authentication, and smart contract ABI interaction.
-   **DeFi Capabilities**: Simulated Flash Loans, DEX Swaps, and Smart Contract calls.
-   **Real-Time Data**: WebSocket-powered market updates and trade execution logs.
-   **Persistence**: SQLite database for persistent trade logs and system settings.
-   **Advanced UI**: Futuristic "glassmorphism" design with CRT effects, scanlines, and fluid animations.
-   **Administration**: Engineering-grade admin panel for system architecture monitoring and ABI management.
-   **Monetization**: Secure withdrawal system to bank or Web3 wallet.

## 🛠 Tech Stack

-   **Frontend**: React 19, Vite, Tailwind CSS 4, Framer Motion, Lucide Icons, Recharts.
-   **Backend**: Node.js, Express, Socket.io, Better-SQLite3, Ethers.js.
-   **Web3**: MetaMask, Ethereum Mainnet simulation.

## 🚀 Getting Started

1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Run Development Server**:
    ```bash
    npm run dev
    ```
3.  **Connect Wallet**: Click the "Auth" button in the top right to connect your MetaMask wallet.

## 📦 Deployment

### GitHub & Netlify
1.  Push the code to a GitHub repository.
2.  Connect the repository to Netlify.
3.  Set the build command to `npm run build` and the publish directory to `dist`.
4.  (Note: For full-stack features, use a platform like Heroku, Railway, Render, or Cloud Run that supports Node.js and Socket.io).

## 🛡 Security

-   **Authentication**: Uses `personal_sign` for wallet verification.
-   **Data Integrity**: AES-256 encryption simulation for logs.
-   **Persistence**: Local SQLite storage for reliability.

---
© 2026 AURA_TRADE_AI_LABS
