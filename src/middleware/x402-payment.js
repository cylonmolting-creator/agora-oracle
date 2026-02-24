/**
 * x402 Payment Middleware for AGORA
 *
 * Implements HTTP 402 Payment Required for premium endpoints.
 * Uses Coinbase x402 protocol with Base network USDC.
 *
 * Features:
 * - 7 premium endpoints (Smart Router, Agent Services, Alerts, Forecast)
 * - 8 free endpoints (discovery + hook)
 * - Auto-listing on x402 Bazaar (discoverable: true)
 */

import { paymentMiddleware as createX402Middleware } from 'x402-express';

// Real Base wallet address from Coinbase CDP
// Set AGORA_WALLET_ADDRESS in .env (production)
const getWalletAddress = () => {
  return process.env.AGORA_WALLET_ADDRESS || '0x0000000000000000000000000000000000000000';
};

// Premium endpoints configuration
const premiumEndpoints = {
  // Feature 1: Smart Router (v2)
  'POST /v1/smart-route': {
    price: '0.001',  // $0.001 USDC
    currency: 'USDC',
    network: 'base',
    description: 'AGORA Smart Router — AI provider routing with cost optimization. Save 50-80% on AI API costs.',
    discoverable: true
  },
  'GET /v1/analytics/*': {
    price: '0.0005',
    currency: 'USDC',
    network: 'base',
    description: 'AGORA Analytics — Spending breakdown and savings report for AI agents',
    discoverable: true
  },

  // Feature 2: Agent Service Comparison (v3 Phase 1)
  'GET /v1/agent-services/compare': {
    price: '0.0005',
    currency: 'USDC',
    network: 'base',
    description: 'AGORA Agent Marketplace — Compare x402 Bazaar agent services (Kayak.com for AI agents)',
    discoverable: true
  },
  'GET /v1/agent-services/*': {
    price: '0.0003',
    currency: 'USDC',
    network: 'base',
    description: 'AGORA Agent Details — Agent service details + 30-day price history',
    discoverable: true
  },

  // Feature 3: Real-Time Price Alerts (v3 Phase 2)
  'POST /v1/alerts': {
    price: '0.0002',
    currency: 'USDC',
    network: 'base',
    description: 'AGORA Price Alerts — Real-time notifications when AI API prices drop',
    discoverable: true
  },

  // Feature 4: Predictive Pricing (v3 Phase 3)
  'GET /v1/forecast/*': {
    price: '0.001',
    currency: 'USDC',
    network: 'base',
    description: 'AGORA Forecast — 7-day AI API price prediction with trend analysis (ML-powered)',
    discoverable: true
  }
};

// Free endpoints (no x402 payment required)
// These are for discovery, testing, and hooks:
// - GET /v1/rates, /v1/rates/:cat, /v1/rates/:cat/:sub
// - GET /v1/providers, /v1/providers/:id
// - GET /v1/stats, /v1/stats/volatility
// - GET /v1/compare
// - GET /v1/agent-services (list only)
// - GET /v1/budget/:id, POST /v1/budget
// - GET /v1/alerts/:id (status check)
// - GET /health
// - POST /v1/agents (registration)

/**
 * x402 middleware factory
 * Returns Express middleware that checks for x402 payment on premium endpoints
 *
 * Usage: app.use(x402Middleware())
 */
export function x402Middleware() {
  const walletAddress = getWalletAddress();
  return createX402Middleware(
    walletAddress,      // payTo address (Base network)
    premiumEndpoints,   // routes configuration
    process.env.CDP_API_KEY ? {  // facilitator config (optional)
      apiKey: process.env.CDP_API_KEY
    } : undefined
  );
}

/**
 * Health check for x402 setup
 * Call this on startup to verify configuration
 */
export function validateX402Config() {
  const walletAddress = getWalletAddress();
  const isTestWallet = walletAddress === '0x0000000000000000000000000000000000000000';

  if (isTestWallet) {
    console.warn('⚠️  [x402] Using test wallet address (development mode)');
  } else {
    console.log('✅ [x402] Production wallet configured');
  }

  if (!process.env.CDP_API_KEY) {
    console.warn('⚠️  [x402] CDP_API_KEY not set (required for production)');
  } else {
    console.log('✅ [x402] CDP API Key configured');
  }

  if (!process.env.CDP_API_SECRET) {
    console.warn('⚠️  [x402] CDP_API_SECRET not set (required for production)');
  }

  console.log('✓ [x402] Payment middleware configured');
  console.log(`✓ [x402] Wallet: ${walletAddress}`);
  console.log(`✓ [x402] Premium endpoints: ${Object.keys(premiumEndpoints).length}`);

  return !isTestWallet;
}
