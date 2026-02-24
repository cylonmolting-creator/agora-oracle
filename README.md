# AGORA Oracle

**Bloomberg Terminal of the AI Agent Economy**

Real-time AI API pricing, smart routing, and cost optimization platform with x402 micropayment integration.

🔗 **Production**: [agora-oracle.onrender.com](https://agora-oracle.onrender.com)
📦 **x402 Bazaar**: [Auto-listed on discovery](https://x402scan.com)

---

## Why AGORA?

AI agents waste **millions daily** on suboptimal API choices. AGORA is the **first x402-powered pricing oracle** that:

- 🎯 Tracks **31 AI providers** in real-time (OpenAI, Anthropic, DeepSeek, x402 Bazaar agents)
- 💰 **Smart Router** saves 50-80% by auto-selecting cheapest provider
- 📊 **Predictive pricing** with ML-powered 7-day forecasts
- ⚡ **Instant alerts** when prices drop (WebSocket + x402 micropayments)

Think **Bloomberg Terminal** for the AI agent economy.

---

## Features

### 🆓 Free Tier
- **GET /v1/rates** — Real-time AI API pricing (OpenAI, Anthropic, DeepSeek)
- **GET /v1/providers** — 31 providers + metadata
- **GET /v1/compare** — Side-by-side provider comparison
- **GET /v1/stats** — Market statistics & volatility index

### 💎 Premium (x402 USDC on Base)
| Feature | Endpoint | Price | Description |
|---------|----------|-------|-------------|
| **Smart Router** | `POST /v1/smart-route` | $0.001 | AI provider routing with 50-80% cost savings |
| **Analytics** | `GET /v1/analytics/*` | $0.0005 | Spending breakdown & savings reports |
| **Agent Marketplace** | `GET /v1/agent-services/compare` | $0.0005 | Compare x402 Bazaar services (Kayak.com for AI) |
| **Agent Details** | `GET /v1/agent-services/*` | $0.0003 | Service details + 30-day price history |
| **Price Alerts** | `POST /v1/alerts` | $0.0002 | Real-time WebSocket notifications |
| **Forecast** | `GET /v1/forecast/*` | $0.001 | 7-day ML-powered price predictions |

---

## Quick Start

### 1. Installation

\`\`\`bash
npm install
\`\`\`

### 2. Environment Setup

\`\`\`bash
# Copy example env file
cp .env.example .env

# Add your provider API keys (optional - for Smart Router)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=sk-...

# Add Coinbase CDP credentials (required for x402 payments)
CDP_API_KEY=your-cdp-api-key
CDP_API_SECRET=your-cdp-secret
AGORA_WALLET_ADDRESS=0x...
\`\`\`

### 3. Run

\`\`\`bash
npm start
\`\`\`

Server runs on `http://localhost:3402`

---

## x402 Integration Guide

AGORA uses [x402 protocol](https://x402.org) for micropayments. Here's how to use premium endpoints:

### Using x402-enabled client

\`\`\`javascript
import { X402Client } from '@coinbase/x402';

const client = new X402Client({
  walletPrivateKey: process.env.WALLET_PRIVATE_KEY,
  network: 'base'
});

// Smart Router example ($0.001 USDC)
const response = await client.post('https://agora-oracle.onrender.com/v1/smart-route', {
  prompt: "Explain quantum computing",
  budget: 0.01,  // Max $0.01
  options: {
    quality: 'highest',
    speed: 'balanced'
  }
});

console.log(response.data);
// {
//   provider: "deepseek",
//   model: "deepseek-chat",
//   estimated_cost: 0.0024,
//   savings: "76% vs GPT-4",
//   reasoning: "DeepSeek offers 10x lower cost with comparable quality"
// }
\`\`\`

### Manual x402 headers (advanced)

\`\`\`bash
# Get payment challenge
curl -X POST https://agora-oracle.onrender.com/v1/smart-route \\
  -H "Content-Type: application/json"

# Response: 402 Payment Required
# {
#   "payment": {
#     "amount": "0.001",
#     "currency": "USDC",
#     "network": "base",
#     "payTo": "0x4505Fe601B17D9F91744d35844B07Cec440e05aa",
#     "challenge": "..."
#   }
# }

# Submit payment proof
curl -X POST https://agora-oracle.onrender.com/v1/smart-route \\
  -H "Content-Type: application/json" \\
  -H "X-Payment-Proof: <transaction-hash>" \\
  -d '{"prompt": "...", "budget": 0.01}'
\`\`\`

### WebSocket Price Alerts (x402)

\`\`\`javascript
import WebSocket from 'ws';

const ws = new WebSocket('wss://agora-oracle.onrender.com/ws/alerts');

// Authenticate with API key
ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'auth',
    agentId: '123',
    apiKey: 'your-api-key'
  }));
});

// Receive real-time alerts
ws.on('message', (data) => {
  const alert = JSON.parse(data);
  console.log(alert);
  // {
  //   type: 'price_drop',
  //   provider: 'anthropic',
  //   model: 'claude-3-5-sonnet',
  //   old_price: 0.003,
  //   new_price: 0.0015,
  //   drop_percent: 50,
  //   timestamp: '2026-02-24T10:30:00Z'
  // }
});
\`\`\`

---

## Tech Stack

- **Backend:** Node.js + Express
- **Database:** SQLite (better-sqlite3)
- **Payments:** x402 protocol (Coinbase CDP + Base USDC)
- **WebSocket:** Real-time price alerts (ws)
- **Crawler:** Axios + node-cron (hourly updates)
- **Deployment:** Render (auto-deploy from GitHub)

---

## API Reference

### Free Endpoints

#### GET /v1/rates
Get all current AI API rates
\`\`\`bash
curl https://agora-oracle.onrender.com/v1/rates
\`\`\`

#### GET /v1/rates/:category
Get rates by category (chat, embedding, vision)
\`\`\`bash
curl https://agora-oracle.onrender.com/v1/rates/chat
\`\`\`

#### GET /v1/providers
List all AI providers
\`\`\`bash
curl https://agora-oracle.onrender.com/v1/providers
\`\`\`

#### GET /v1/compare
Compare providers side-by-side
\`\`\`bash
curl https://agora-oracle.onrender.com/v1/compare?models=gpt-4,claude-3-5-sonnet
\`\`\`

### Premium Endpoints (x402)

See **x402 Integration Guide** above for authentication.

---

## Development

\`\`\`bash
# Install dependencies
npm install

# Run in dev mode (auto-reload)
npm run dev

# Run tests
npm test
\`\`\`

---

## Deployment

### Render (recommended)

1. Fork this repo
2. Create new Web Service on [Render](https://render.com)
3. Connect GitHub repo
4. Add environment variables:
   - `CDP_API_KEY`
   - `CDP_API_SECRET`
   - `AGORA_WALLET_ADDRESS`
   - `NODE_ENV=production`
5. Deploy (auto-deploy on push to main)

### Docker

\`\`\`bash
docker build -t agora-oracle .
docker run -p 3402:3402 --env-file .env agora-oracle
\`\`\`

---

## Roadmap

- [x] **v0.1** — Basic rate oracle (31 providers)
- [x] **v0.2** — Smart Router + x402 payments
- [x] **v0.3** — Price Alerts + WebSocket
- [x] **v0.4** — Production deployment (Render + x402 Bazaar)
- [ ] **v0.5** — Agent SDK (npm package)
- [ ] **v0.6** — Historical data API
- [ ] **v0.7** — Cost forecasting ML model
- [ ] **v1.0** — Multi-chain support (Optimism, Arbitrum)

---

## Contributing

PRs welcome! See [CONTRIBUTING.md](CONTRIBUTING.md)

---

## License

MIT © 2026 AGORA Oracle

---

## Links

- 🌐 Production: [agora-oracle.onrender.com](https://agora-oracle.onrender.com)
- 📦 x402 Bazaar: [x402scan.com](https://x402scan.com)
- 🐦 Twitter: [@agoraoracle](https://twitter.com/agoraoracle)
- 💬 Discord: [Join community](https://discord.gg/agora)

---

**Built with ❤️ for the AI agent economy**
