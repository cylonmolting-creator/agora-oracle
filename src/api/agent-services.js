/**
 * agent-services.js — API endpoints for Agent Service Comparison
 *
 * Endpoints:
 * - GET /v1/agent-services — list all agent services (with filters)
 * - GET /v1/agent-services/:agentId — get specific agent service details + price history
 * - GET /v1/agent-services/compare — compare agents for same skill
 *
 * Part of ROADMAP v3 Phase 1: Agent Service Comparison (x402 Bazaar integration)
 */

import express from 'express';
import {
  listAllAgentServices,
  getAgentServiceById,
  getAgentServicesBySkill,
  getAgentServiceHistory
} from '../db/agent-services.js';
import { aggregateAgentServiceStats } from '../aggregator/index.js';
import logger from '../logger.js';

const router = express.Router();

/**
 * Helper: Calculate market stats for a skill
 */
function calculateMarketStats(services) {
  if (services.length === 0) {
    return {
      marketMedian: 0,
      priceRange: { min: 0, max: 0 },
      avgUptime: 0,
      totalAgents: 0
    };
  }

  const prices = services.map(s => s.price).sort((a, b) => a - b);
  const median = prices.length % 2 === 0
    ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
    : prices[Math.floor(prices.length / 2)];

  const uptimes = services.filter(s => s.uptime != null).map(s => s.uptime);
  const avgUptime = uptimes.length > 0
    ? uptimes.reduce((sum, u) => sum + u, 0) / uptimes.length
    : null;

  return {
    marketMedian: median,
    priceRange: {
      min: Math.min(...prices),
      max: Math.max(...prices)
    },
    avgUptime: avgUptime ? avgUptime.toFixed(2) : null,
    totalAgents: services.length
  };
}

/**
 * Helper: Calculate best value agent
 * Formula: 50% price score + 30% uptime score + 20% rating score
 */
function findBestValue(services, marketMedian) {
  if (services.length === 0) return null;

  const priceRange = Math.max(...services.map(s => s.price)) - Math.min(...services.map(s => s.price));

  const scored = services.map(s => {
    // Price score: lower is better (inverse normalized)
    const priceScore = priceRange > 0
      ? (1 - (s.price - Math.min(...services.map(x => x.price)) / priceRange)) * 100
      : 100;

    // Uptime score: higher is better
    const uptimeScore = s.uptime != null ? s.uptime : 50; // default to 50% if missing

    // Rating score: higher is better (normalize 0-5 to 0-100)
    const ratingScore = s.rating != null ? (s.rating / 5.0) * 100 : 50;

    // Weighted score
    const totalScore = (priceScore * 0.5) + (uptimeScore * 0.3) + (ratingScore * 0.2);

    return { ...s, score: totalScore };
  });

  // Return agent with highest score
  scored.sort((a, b) => b.score - a.score);
  return scored[0].agent_id;
}

/**
 * Helper: Add ranking to services (1 = cheapest)
 */
function addRanking(services) {
  const sorted = [...services].sort((a, b) => a.price - b.price);
  return services.map(service => {
    const ranking = sorted.findIndex(s => s.agent_id === service.agent_id) + 1;
    return { ...service, ranking };
  });
}

/**
 * Helper: Convert DB row to API format
 */
function formatService(service) {
  return {
    agentId: service.agent_id,
    agentName: service.agent_name,
    skill: service.skill,
    price: service.price,
    unit: service.unit,
    currency: service.currency || 'USD',
    uptime: service.uptime,
    avgLatency: service.avg_latency_ms,
    rating: service.rating,
    reviews: service.reviews_count,
    x402Endpoint: service.x402_endpoint,
    bazaarUrl: service.bazaar_url,
    metadata: service.metadata
  };
}

/**
 * GET /v1/agent-services
 * List all agent services (with optional filters)
 */
router.get('/', (req, res) => {
  try {
    const { skill, sort = 'price', order = 'asc', limit = 50 } = req.query;

    // Get services
    let services = skill
      ? getAgentServicesBySkill(skill)
      : listAllAgentServices();

    // Validate sort field
    const validSorts = ['price', 'rating', 'uptime'];
    const sortField = validSorts.includes(sort) ? sort : 'price';

    // Sort services
    const sortMap = {
      price: (a, b) => a.price - b.price,
      rating: (a, b) => (b.rating || 0) - (a.rating || 0),
      uptime: (a, b) => (b.uptime || 0) - (a.uptime || 0)
    };

    services.sort(sortMap[sortField]);

    // Reverse if desc
    if (order === 'desc') {
      services.reverse();
    }

    // Add ranking (based on price ASC)
    services = addRanking(services);

    // Apply limit
    const limitNum = Math.min(parseInt(limit) || 50, 200); // max 200
    services = services.slice(0, limitNum);

    // Format response
    const data = services.map(formatService);

    logger.info('agent_services_list', {
      skill: skill || 'all',
      count: data.length,
      sort: sortField,
      order
    });

    res.json({
      success: true,
      data,
      meta: {
        total: data.length,
        limit: limitNum,
        sort: sortField,
        order,
        timestamp: new Date().toISOString(),
        apiVersion: '0.3.0'
      }
    });
  } catch (error) {
    logger.error('agent_services_list_failed', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve agent services',
      message: error.message,
      meta: {
        timestamp: new Date().toISOString(),
        apiVersion: '0.3.0'
      }
    });
  }
});

/**
 * GET /v1/agent-services/compare
 * Compare agents for a specific skill (like Kayak.com)
 */
router.get('/compare', (req, res) => {
  try {
    const { skill } = req.query;

    // Validate required param
    if (!skill) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter',
        message: 'Query parameter "skill" is required',
        meta: {
          timestamp: new Date().toISOString(),
          apiVersion: '0.3.0'
        }
      });
    }

    // Get services for skill
    let services = getAgentServicesBySkill(skill);

    if (services.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No agents found',
        message: `No agent services found for skill: ${skill}`,
        meta: {
          timestamp: new Date().toISOString(),
          apiVersion: '0.3.0'
        }
      });
    }

    // Calculate market stats using aggregator (includes outlier detection)
    const stats = aggregateAgentServiceStats(skill);

    if (!stats) {
      return res.status(404).json({
        success: false,
        error: 'No stats available',
        message: `Unable to calculate stats for skill: ${skill}`,
        meta: {
          timestamp: new Date().toISOString(),
          apiVersion: '0.3.0'
        }
      });
    }

    // Add ranking
    services = addRanking(services);

    // Calculate savings (vs market median)
    services = services.map(s => ({
      ...s,
      savings: stats.marketMedian > 0
        ? (((stats.marketMedian - s.price) / stats.marketMedian) * 100).toFixed(1)
        : 0
    }));

    // Find best value
    const bestValueId = findBestValue(services, stats.marketMedian);

    // Find cheapest
    const cheapest = services.reduce((min, s) => s.price < min.price ? s : min, services[0]);

    // Format agents
    const agents = services.map(s => ({
      agentId: s.agent_id,
      agentName: s.agent_name,
      price: s.price,
      unit: s.unit,
      currency: s.currency || 'USD',
      uptime: s.uptime,
      avgLatency: s.avg_latency_ms,
      rating: s.rating,
      reviews: s.reviews_count,
      ranking: s.ranking,
      savings: s.savings,
      isBestValue: s.agent_id === bestValueId,
      isCheapest: s.agent_id === cheapest.agent_id
    }));

    logger.info('agent_services_compare', {
      skill,
      totalAgents: agents.length,
      marketMedian: stats.marketMedian,
      cheapest: cheapest.agent_id
    });

    res.json({
      success: true,
      data: {
        skill,
        agents,
        marketMedian: stats.marketMedian,
        cheapest: cheapest.agent_id,
        bestValue: bestValueId,
        meta: {
          totalAgents: stats.totalAgents,
          priceRange: stats.priceRange,
          avgPrice: stats.avgPrice,
          stdDeviation: stats.stdDeviation,
          avgUptime: stats.avgUptime,
          avgLatency: stats.avgLatency,
          avgRating: stats.avgRating,
          outliers: stats.outliers
        }
      },
      meta: {
        timestamp: new Date().toISOString(),
        apiVersion: '0.3.0'
      }
    });
  } catch (error) {
    logger.error('agent_services_compare_failed', {
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Failed to compare agent services',
      message: error.message,
      meta: {
        timestamp: new Date().toISOString(),
        apiVersion: '0.3.0'
      }
    });
  }
});

/**
 * GET /v1/agent-services/:agentId
 * Get specific agent service details + price history
 */
router.get('/:agentId', (req, res) => {
  try {
    const { agentId } = req.params;

    // Get service
    const service = getAgentServiceById(agentId);

    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Agent service not found',
        message: `No agent service found with ID: ${agentId}`,
        meta: {
          timestamp: new Date().toISOString(),
          apiVersion: '0.3.0'
        }
      });
    }

    // Get price history (last 30 days)
    const history = getAgentServiceHistory(agentId, 30);
    const priceHistory = history.map(h => ({
      price: h.price,
      uptime: h.uptime,
      avgLatency: h.avg_latency_ms,
      recordedAt: h.recorded_at
    }));

    // Format response
    const data = {
      ...formatService(service),
      priceHistory,
      lastUpdated: service.last_updated,
      createdAt: service.created_at
    };

    logger.info('agent_service_detail', {
      agentId,
      skill: service.skill,
      historyRecords: priceHistory.length
    });

    res.json({
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        apiVersion: '0.3.0'
      }
    });
  } catch (error) {
    logger.error('agent_service_detail_failed', {
      agentId: req.params.agentId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve agent service details',
      message: error.message,
      meta: {
        timestamp: new Date().toISOString(),
        apiVersion: '0.3.0'
      }
    });
  }
});

export default router;
