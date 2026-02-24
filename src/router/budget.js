import { runQuery, getOne } from '../db/database.js';
import logger from '../logger.js';

/**
 * Get current period (YYYY-MM format)
 * @returns {string} Current period
 */
const getCurrentPeriod = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

/**
 * Get days left in current month
 * @returns {number} Days remaining
 */
const getDaysLeftInMonth = () => {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return lastDay - now.getDate();
};

/**
 * Set or update monthly budget for an agent
 * @param {number} agentId - Agent ID
 * @param {number} monthlyLimit - Monthly spending limit in USD
 * @returns {Object} { id, agentId, monthlyLimit, period }
 */
export const setBudget = (agentId, monthlyLimit) => {
  try {
    const period = getCurrentPeriod();

    // Check if budget already exists for this period
    const existing = getOne(
      'SELECT * FROM budgets WHERE agent_id = ? AND period = ?',
      [agentId, period]
    );

    if (existing) {
      // Update existing budget
      runQuery(
        'UPDATE budgets SET monthly_limit = ? WHERE agent_id = ? AND period = ?',
        [monthlyLimit, agentId, period]
      );

      logger.info('budget_updated', { agentId, period, monthlyLimit });

      return {
        id: existing.id,
        agentId,
        monthlyLimit,
        period
      };
    } else {
      // Insert new budget
      const result = runQuery(
        'INSERT INTO budgets (agent_id, monthly_limit, spent, period) VALUES (?, ?, 0, ?)',
        [agentId, monthlyLimit, period]
      );

      logger.info('budget_created', { agentId, period, monthlyLimit });

      return {
        id: result.lastInsertRowid,
        agentId,
        monthlyLimit,
        period
      };
    }
  } catch (error) {
    logger.error('set_budget_failed', { error: error.message });
    throw error;
  }
};

/**
 * Check if agent can afford the estimated cost
 * @param {number} agentId - Agent ID
 * @param {number} estimatedCost - Estimated cost in USD
 * @returns {Object} { allowed: boolean, remaining: number, spent: number, limit: number }
 */
export const checkBudget = (agentId, estimatedCost) => {
  try {
    const period = getCurrentPeriod();

    // Get or create budget for current period
    let budget = getOne(
      'SELECT * FROM budgets WHERE agent_id = ? AND period = ?',
      [agentId, period]
    );

    if (!budget) {
      // Auto-create budget with $0 limit if not exists
      const result = runQuery(
        'INSERT INTO budgets (agent_id, monthly_limit, spent, period) VALUES (?, 0, 0, ?)',
        [agentId, period]
      );

      budget = {
        id: result.lastInsertRowid,
        agent_id: agentId,
        monthly_limit: 0,
        spent: 0,
        period
      };

      logger.warn('budget_auto_created_zero', { agentId, period });
    }

    const remaining = budget.monthly_limit - budget.spent;
    const allowed = (budget.spent + estimatedCost) <= budget.monthly_limit;

    logger.info('budget_check', {
      agentId,
      estimatedCost,
      allowed,
      remaining,
      spent: budget.spent,
      limit: budget.monthly_limit
    });

    return {
      allowed,
      remaining,
      spent: budget.spent,
      limit: budget.monthly_limit
    };
  } catch (error) {
    logger.error('check_budget_failed', { error: error.message });
    throw error;
  }
};

/**
 * Record actual spend for an agent
 * @param {number} agentId - Agent ID
 * @param {number} cost - Actual cost in USD
 * @returns {Object} { spent: number, remaining: number }
 */
export const recordSpend = (agentId, cost) => {
  try {
    const period = getCurrentPeriod();

    // Update spent amount
    runQuery(
      'UPDATE budgets SET spent = spent + ? WHERE agent_id = ? AND period = ?',
      [cost, agentId, period]
    );

    // Get updated budget
    const budget = getOne(
      'SELECT * FROM budgets WHERE agent_id = ? AND period = ?',
      [agentId, period]
    );

    logger.info('spend_recorded', {
      agentId,
      cost,
      spent: budget.spent,
      remaining: budget.monthly_limit - budget.spent
    });

    return {
      spent: budget.spent,
      remaining: budget.monthly_limit - budget.spent
    };
  } catch (error) {
    logger.error('record_spend_failed', { error: error.message });
    throw error;
  }
};

/**
 * Get full budget status for an agent
 * @param {number} agentId - Agent ID
 * @returns {Object} { period, spent, limit, remaining, daysLeft, projectedMonthEnd }
 */
export const getBudgetStatus = (agentId) => {
  try {
    const period = getCurrentPeriod();

    let budget = getOne(
      'SELECT * FROM budgets WHERE agent_id = ? AND period = ?',
      [agentId, period]
    );

    if (!budget) {
      // Auto-create budget with $0 limit
      const result = runQuery(
        'INSERT INTO budgets (agent_id, monthly_limit, spent, period) VALUES (?, 0, 0, ?)',
        [agentId, period]
      );

      budget = {
        id: result.lastInsertRowid,
        agent_id: agentId,
        monthly_limit: 0,
        spent: 0,
        period
      };
    }

    const daysLeft = getDaysLeftInMonth();
    const remaining = budget.monthly_limit - budget.spent;

    // Project spending to month end
    const now = new Date();
    const currentDay = now.getDate();
    const dailyRate = budget.spent / currentDay;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projectedMonthEnd = dailyRate * lastDay;

    return {
      period,
      spent: budget.spent,
      limit: budget.monthly_limit,
      remaining,
      daysLeft,
      projectedMonthEnd: Math.round(projectedMonthEnd * 100) / 100
    };
  } catch (error) {
    logger.error('get_budget_status_failed', { error: error.message });
    throw error;
  }
};
