import { selectProvider } from './decision.js';
import { executeWithFallback } from './fallback.js';
import { checkBudget, recordSpend } from './budget.js';
import { runQuery } from '../db/database.js';
import logger from '../logger.js';

/**
 * Smart Route: intelligently route requests to optimal provider
 * @param {Object} request - Request object
 * @param {string} request.prompt - Input prompt
 * @param {string} request.task - Task category (e.g., 'chat', 'text-generation')
 * @param {string} request.optimize - Optimization strategy: 'cost', 'speed', 'quality', 'balanced'
 * @param {Object} request.constraints - Constraints { maxCost, minConfidence }
 * @param {number} request.agentId - Agent ID (optional, for budget tracking)
 * @param {Map<string, Object>} adapterMap - Map of provider name → adapter instance
 * @returns {Promise<Object>} { provider, model, cost, latency, tokens, response, alternatives, savings }
 */
export const smartRoute = async (request, adapterMap) => {
  const {
    prompt,
    task = '',
    optimize = 'cost',
    constraints = {},
    agentId = null
  } = request;

  const startTime = Date.now();

  try {
    // Step 0: Check if any providers configured
    if (!adapterMap || Object.keys(adapterMap).length === 0) {
      throw new Error('No provider API keys configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or DEEPSEEK_API_KEY in .env');
    }

    // Step 1: Check budget if agentId provided
    if (agentId) {
      // Get estimated cost from first provider (rough estimate)
      const availableProviders = Object.keys(adapterMap);
      const tempProviders = selectProvider(task, optimize, constraints, availableProviders);

      if (tempProviders.length > 0) {
        const estimatedCost = tempProviders[0].estimatedCost;
        const budgetCheck = checkBudget(agentId, estimatedCost);

        if (!budgetCheck.allowed) {
          logger.warn('budget_exceeded', {
            agentId,
            estimatedCost,
            remaining: budgetCheck.remaining
          });

          throw {
            code: 402,
            message: 'Budget exceeded',
            details: {
              estimatedCost,
              remaining: budgetCheck.remaining,
              spent: budgetCheck.spent,
              limit: budgetCheck.limit
            }
          };
        }
      }
    }

    // Step 2: Get available adapters
    const availableProviders = Object.keys(adapterMap);

    if (availableProviders.length === 0) {
      throw {
        code: 503,
        message: 'No provider API keys configured',
        details: 'Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or DEEPSEEK_API_KEY in .env'
      };
    }

    // Step 3: Select providers using decision engine
    const rankedProviders = selectProvider(task, optimize, constraints, availableProviders);

    if (rankedProviders.length === 0) {
      throw {
        code: 503,
        message: 'No providers match criteria',
        details: { task, optimize, constraints }
      };
    }

    // Step 4: Execute with fallback
    const { result, provider, attempts, failedProviders } = await executeWithFallback(
      rankedProviders,
      adapterMap,
      prompt,
      { maxTokens: constraints.maxTokens || 1000 }
    );

    const totalLatency = Date.now() - startTime;

    // Step 5: Record spend if agentId provided
    if (agentId && result.cost) {
      recordSpend(agentId, result.cost);
    }

    // Step 6: Log to request_log
    if (agentId) {
      runQuery(
        `INSERT INTO request_log (agent_id, provider, category, cost, latency_ms, tokens_in, tokens_out, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          agentId,
          provider,
          task,
          result.cost || 0,
          totalLatency,
          result.tokens?.input || 0,
          result.tokens?.output || 0,
          'success'
        ]
      );
    }

    // Step 7: Calculate savings (vs most expensive option)
    const mostExpensive = rankedProviders[rankedProviders.length - 1];
    const savings = mostExpensive ? mostExpensive.estimatedCost - result.cost : 0;

    logger.info('smart_route_success', {
      provider,
      cost: result.cost,
      latency: totalLatency,
      attempts,
      savings
    });

    return {
      provider,
      model: result.model,
      cost: result.cost,
      latency: totalLatency,
      tokens: result.tokens,
      response: result.text,
      alternatives: rankedProviders.slice(0, 3).map(p => ({
        provider: p.providerName,
        estimatedCost: p.estimatedCost,
        confidence: p.confidence
      })),
      savings: Math.max(0, savings),
      attempts,
      failedProviders
    };
  } catch (error) {
    // Log failure
    if (agentId) {
      runQuery(
        `INSERT INTO request_log (agent_id, provider, category, cost, latency_ms, tokens_in, tokens_out, status)
         VALUES (?, ?, ?, 0, ?, 0, 0, ?)`,
        [agentId, 'unknown', task, Date.now() - startTime, 'failed']
      );
    }

    logger.error('smart_route_failed', {
      error: error.message || error,
      agentId,
      task
    });

    throw error;
  }
};

export default {
  smartRoute
};
