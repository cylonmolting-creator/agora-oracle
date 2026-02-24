/**
 * routes.js — Central API router configuration
 *
 * Imports and mounts all API routers:
 * - /v1/rates — Rate aggregation endpoints
 * - /v1/providers — Provider listings and details
 * - /v1/stats — System statistics and analytics
 * - /v1/compare — Price comparison across providers
 * - /v1/smart-route — Smart routing endpoint (NEW)
 * - /v1/budget — Budget management endpoints (NEW)
 * - /v1/analytics — Analytics endpoints (NEW)
 * - /v1/agents — Agent registration endpoint (NEW)
 * - /v1/agent-services — Agent service comparison (NEW - ROADMAP v3)
 * - /v1/alerts — Price alerts management (NEW - ROADMAP v3 Phase 2)
 * - /v1/forecast — ML-based price forecasting (NEW - ROADMAP v3 Phase 3)
 */

import express from 'express';
import ratesRouter from './rates.js';
import providersRouter from './providers.js';
import statsRouter from './stats.js';
import compareRouter from './compare.js';
import smartRouteRouter from './smart-route.js';
import budgetRouter from './budget.js';
import analyticsRouter from './analytics.js';
import agentsRouter from './agents.js';
import agentServicesRouter from './agent-services.js';
import alertsRouter from './alerts.js';
import forecastRouter from './forecast.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Request logging middleware
router.use((req, res, next) => {
  const start = Date.now();
  
  // Log on response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const timestamp = new Date().toISOString();
    
    // Only log in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${timestamp}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    }
  });
  
  next();
});

// Mount API routers (existing)
router.use('/rates', ratesRouter);
router.use('/providers', providersRouter);
router.use('/stats', statsRouter);
router.use('/compare', compareRouter);

// Mount new Smart Router API routers
router.use('/smart-route', smartRouteRouter);
router.use('/budget', budgetRouter);
router.use('/analytics', analyticsRouter);
router.use('/agents', agentsRouter);

// Mount Agent Service Comparison API (ROADMAP v3)
router.use('/agent-services', agentServicesRouter);

// Mount Price Alerts API (ROADMAP v3 Phase 2)
// Note: Uses x402 payment for access (no additional auth needed)
router.use('/alerts', alertsRouter);

// Mount Forecast API (ROADMAP v3 Phase 3)
router.use('/forecast', forecastRouter);

// 404 handler for unknown API routes
router.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'API route not found',
    message: `The endpoint ${req.method} ${req.originalUrl} does not exist`,
    meta: {
      timestamp: new Date().toISOString(),
      apiVersion: '0.1.0'
    }
  });
});

export default router;
