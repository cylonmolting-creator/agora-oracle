import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import NodeCache from 'node-cache';
import logger from './logger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Cache setup (5 min TTL for rate endpoints)
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Rate limiter (100 req/min per IP)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: {
    success: false,
    error: {
      message: 'Too many requests, please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(limiter);

// x402 Payment Middleware (AGORA monetization)
// Wallet address loaded from .env at runtime
import { x402Middleware } from './middleware/x402-payment.js';
app.use(x402Middleware());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration
    });
  });
  next();
});

// Serve static files from public directory
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// Root - serve landing page (index.html)
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Dashboard route - serve dashboard.html
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(publicPath, 'dashboard.html'));
});

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '0.1.1',
    uptime: process.uptime()
  });
});

// API routes (all /v1/* routes)
import apiRoutes from './api/routes.js';

app.use('/v1', apiRoutes);

// Error handler middleware
app.use((err, req, res, next) => {
  logger.error('request_error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  res.status(err.status || 500).json({
    success: false,
    error: {
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
      path: req.path
    }
  });
});

// Export cache and logger for use in routes
export { cache, logger };
export default app;
