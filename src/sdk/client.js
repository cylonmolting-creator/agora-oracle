/**
 * AGORA SDK Client
 *
 * Client for querying AGORA (AI agent marketplace oracle) API
 */

export class Agora {
  constructor({ baseUrl = 'http://localhost:3402', apiKey = null, agentId = null } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
    this.agentId = agentId;
  }

  /**
   * Internal fetch wrapper with error handling
   * @private
   */
  async _fetch(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    try {
      const response = await fetch(url, { ...options, headers });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AGORA API Error (${response.status}): ${errorText}`);
      }

      const data = await response.json();

      if (data.success === false) {
        throw new Error(`AGORA API returned error: ${data.error || 'Unknown error'}`);
      }

      return data;
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`Cannot connect to AGORA at ${this.baseUrl}. Is the server running?`);
      }
      throw error;
    }
  }

  /**
   * Get rate for specific category and subcategory
   * @param {string} category - Service category (e.g., "text-generation")
   * @param {string} subcategory - Service subcategory (e.g., "chat")
   * @returns {Promise<Object>} Rate data with price, confidence, sourceCount
   */
  async getRate(category, subcategory) {
    if (!category) {
      throw new Error('category is required');
    }
    if (!subcategory) {
      throw new Error('subcategory is required');
    }

    const response = await this._fetch(`/v1/rates/${category}/${subcategory}`);
    return response.data;
  }

  /**
   * Find the best (lowest) rate for a category with optional filters
   * @param {string} category - Service category
   * @param {Object} options - Filter options
   * @param {number} options.minConfidence - Minimum confidence score (0.0-1.0)
   * @param {number} options.minSourceCount - Minimum number of sources
   * @param {string[]} options.providers - Filter by specific providers
   * @returns {Promise<Object>} Best rate with provider info
   */
  async findBestRate(category, options = {}) {
    if (!category) {
      throw new Error('category is required');
    }

    const response = await this._fetch(`/v1/rates/${category}`);
    let rates = response.data.subcategories || [];

    // Apply filters
    if (options.minConfidence !== undefined) {
      rates = rates.filter(r => r.confidence >= options.minConfidence);
    }

    if (options.minSourceCount !== undefined) {
      rates = rates.filter(r => r.sourceCount >= options.minSourceCount);
    }

    if (options.providers && options.providers.length > 0) {
      // Would need provider info in rates — for now just return best
    }

    // Sort by price ascending
    rates.sort((a, b) => a.price - b.price);

    return rates[0] || null;
  }

  /**
   * Get all available rates across all categories
   * @returns {Promise<Object[]>} Array of all rates
   */
  async getRates() {
    const response = await this._fetch('/v1/rates');
    return response.data;
  }

  /**
   * Get all providers with their services
   * @param {Object} options - Query options
   * @param {string} options.category - Filter by category
   * @param {string} options.sortBy - Sort by 'price' or 'name'
   * @returns {Promise<Object[]>} Array of providers
   */
  async getProviders(options = {}) {
    let endpoint = '/v1/providers';
    const params = new URLSearchParams();

    if (options.category) {
      params.append('category', options.category);
    }
    if (options.sortBy) {
      params.append('sortBy', options.sortBy);
    }

    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    const response = await this._fetch(endpoint);
    return response.data;
  }

  /**
   * Get system statistics
   * @returns {Promise<Object>} Stats object
   */
  async getStats() {
    const response = await this._fetch('/v1/stats');
    return response.data;
  }

  /**
   * Compare rates across multiple providers for a category
   * @param {string} category - Service category
   * @param {string[]} providers - Array of provider names to compare
   * @returns {Promise<Object[]>} Comparison results
   */
  async compareRates(category, providers = []) {
    if (!category) {
      throw new Error('category is required');
    }

    let endpoint = `/v1/compare?category=${encodeURIComponent(category)}`;

    if (providers.length > 0) {
      endpoint += `&providers=${providers.map(p => encodeURIComponent(p)).join(',')}`;
    }

    const response = await this._fetch(endpoint);
    return response.data;
  }

  /**
   * Get volatility stats for categories
   * @returns {Promise<Object[]>} Volatility data
   */
  async getVolatility() {
    const response = await this._fetch('/v1/stats/volatility');
    return response.data;
  }

  /**
   * Check if AGORA server is healthy
   * @returns {Promise<Object>} Health status
   */
  async health() {
    // Health endpoint doesn't use standard {success: true} format
    const url = `${this.baseUrl}/health`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Health check failed (${response.status})`);
      }
      return await response.json();
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`Cannot connect to AGORA at ${this.baseUrl}. Is the server running?`);
      }
      throw error;
    }
  }

  // ===== SMART ROUTER METHODS =====

  /**
   * Smart route a request to optimal provider
   * @param {Object} options - Smart route options
   * @param {string} options.prompt - Input prompt (required)
   * @param {string} options.task - Task category (required)
   * @param {string} options.optimize - Optimization strategy: 'cost', 'speed', 'quality', 'balanced' (default: 'cost')
   * @param {Object} options.constraints - Constraints { maxCost, minConfidence, maxTokens }
   * @returns {Promise<Object>} { provider, model, cost, latency, tokens, response, alternatives, savings }
   */
  async smartRoute(options) {
    if (!options.prompt) {
      throw new Error('prompt is required');
    }
    if (!options.task) {
      throw new Error('task is required');
    }

    const body = {
      prompt: options.prompt,
      task: options.task,
      optimize: options.optimize || 'cost',
      constraints: options.constraints || {},
      agentId: this.agentId || null
    };

    const response = await this._fetch('/v1/smart-route', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    return response.data;
  }

  /**
   * Set monthly budget for authenticated agent
   * @param {number} monthlyLimit - Monthly spending limit in USD
   * @returns {Promise<Object>} { id, agentId, monthlyLimit, period }
   */
  async setBudget(monthlyLimit) {
    if (!this.apiKey) {
      throw new Error('API key required for setBudget. Set apiKey in constructor.');
    }

    if (typeof monthlyLimit !== 'number' || monthlyLimit < 0) {
      throw new Error('monthlyLimit must be a positive number');
    }

    const response = await this._fetch('/v1/budget', {
      method: 'POST',
      body: JSON.stringify({ monthlyLimit })
    });

    return response.data;
  }

  /**
   * Get budget status for authenticated agent
   * @returns {Promise<Object>} { period, spent, limit, remaining, daysLeft, projectedMonthEnd }
   */
  async getBudget() {
    if (!this.agentId) {
      throw new Error('agentId required for getBudget. Set agentId in constructor.');
    }

    const response = await this._fetch(`/v1/budget/${this.agentId}`);
    return response.data;
  }

  /**
   * Get analytics summary for authenticated agent
   * @param {Object} options - Optional filters
   * @returns {Promise<Object>} { period, totalSpent, totalRequests, avgCostPerRequest, byProvider, byTask, daily }
   */
  async getAnalytics(options = {}) {
    if (!this.agentId) {
      throw new Error('agentId required for getAnalytics. Set agentId in constructor.');
    }

    const response = await this._fetch(`/v1/analytics/${this.agentId}`);
    return response.data;
  }

  /**
   * Get savings summary vs. most expensive provider
   * @returns {Promise<Object>} { totalSavings, savingsPercent, comparedTo }
   */
  async getSavings() {
    if (!this.agentId) {
      throw new Error('agentId required for getSavings. Set agentId in constructor.');
    }

    const response = await this._fetch(`/v1/analytics/${this.agentId}/savings`);
    return response.data;
  }

  // ===== AGENT SERVICE METHODS (ROADMAP v3 Phase 1) =====

  /**
   * Get all agent services with optional filtering and sorting
   * @param {Object} options - Query options
   * @param {string} options.skill - Filter by skill (e.g., "text-generation/chat")
   * @param {string} options.sort - Sort by field: 'price', 'rating', 'uptime' (default: 'price')
   * @param {string} options.order - Sort order: 'asc' or 'desc' (default: 'asc')
   * @param {number} options.limit - Max results (default: 50, max: 200)
   * @returns {Promise<Object[]>} Array of agent services with ranking
   */
  async getAgentServices(options = {}) {
    let endpoint = '/v1/agent-services';
    const params = new URLSearchParams();

    if (options.skill) {
      params.append('skill', options.skill);
    }
    if (options.sort) {
      params.append('sort', options.sort);
    }
    if (options.order) {
      params.append('order', options.order);
    }
    if (options.limit) {
      params.append('limit', options.limit.toString());
    }

    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    const response = await this._fetch(endpoint);
    return response.data;
  }

  /**
   * Get specific agent service details with price history
   * @param {string} agentId - Agent ID (e.g., "agent-001")
   * @returns {Promise<Object>} Agent service details with 30-day price history
   */
  async getAgentService(agentId) {
    if (!agentId) {
      throw new Error('agentId is required');
    }

    const response = await this._fetch(`/v1/agent-services/${encodeURIComponent(agentId)}`);
    return response.data;
  }

  /**
   * Compare agent services for a specific skill (Kayak-style comparison)
   * @param {string} skill - Skill to compare (e.g., "text-generation/chat")
   * @returns {Promise<Object>} Comparison data with marketMedian, cheapest, bestValue
   */
  async compareAgentServices(skill) {
    if (!skill) {
      throw new Error('skill is required');
    }

    const response = await this._fetch(`/v1/agent-services/compare?skill=${encodeURIComponent(skill)}`);
    return response.data;
  }

  // ===== PRICE ALERTS METHODS (ROADMAP v3 Phase 2) =====

  /**
   * Create a new price alert (requires authentication)
   * @param {Object} options - Alert configuration
   * @param {string} options.alertType - Alert type: 'price_drop', 'price_threshold', 'any_change'
   * @param {string} [options.targetSkill] - Target skill (e.g., "text-generation/chat") - one of targetSkill or targetProvider required
   * @param {string} [options.targetProvider] - Target provider (e.g., "openai") - one of targetSkill or targetProvider required
   * @param {number} [options.maxPrice] - Max price threshold (required for 'price_threshold' alerts)
   * @param {string} options.notifyMethod - Notification method: 'webhook', 'email', 'websocket'
   * @param {string} [options.webhookUrl] - Webhook URL (required if notifyMethod='webhook')
   * @param {string} [options.email] - Email address (required if notifyMethod='email')
   * @returns {Promise<Object>} { id, agentId, alertType, status }
   */
  async createAlert(options) {
    if (!this.apiKey) {
      throw new Error('API key required for createAlert. Set apiKey in constructor.');
    }

    if (!options.alertType) {
      throw new Error('alertType is required');
    }

    if (!options.notifyMethod) {
      throw new Error('notifyMethod is required');
    }

    if (!options.targetSkill && !options.targetProvider) {
      throw new Error('Either targetSkill or targetProvider is required');
    }

    const body = {
      alertType: options.alertType,
      targetSkill: options.targetSkill || null,
      targetProvider: options.targetProvider || null,
      maxPrice: options.maxPrice || null,
      notifyMethod: options.notifyMethod,
      webhookUrl: options.webhookUrl || null,
      email: options.email || null
    };

    const response = await this._fetch('/v1/alerts', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    return response.data;
  }

  /**
   * Get all alerts for the authenticated agent
   * @returns {Promise<Object[]>} Array of alerts
   */
  async getAlerts() {
    if (!this.apiKey) {
      throw new Error('API key required for getAlerts. Set apiKey in constructor.');
    }

    const response = await this._fetch('/v1/alerts');
    return response.data;
  }

  /**
   * Update alert status
   * @param {number} alertId - Alert ID
   * @param {string} status - New status: 'active', 'paused', 'expired'
   * @returns {Promise<Object>} { id, status }
   */
  async updateAlert(alertId, status) {
    if (!this.apiKey) {
      throw new Error('API key required for updateAlert. Set apiKey in constructor.');
    }

    if (!alertId) {
      throw new Error('alertId is required');
    }

    if (!status) {
      throw new Error('status is required');
    }

    const validStatuses = ['active', 'paused', 'expired'];
    if (!validStatuses.includes(status)) {
      throw new Error(`status must be one of: ${validStatuses.join(', ')}`);
    }

    const response = await this._fetch(`/v1/alerts/${alertId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });

    return response.data;
  }

  /**
   * Delete an alert
   * @param {number} alertId - Alert ID
   * @returns {Promise<Object>} { success: true, message }
   */
  async deleteAlert(alertId) {
    if (!this.apiKey) {
      throw new Error('API key required for deleteAlert. Set apiKey in constructor.');
    }

    if (!alertId) {
      throw new Error('alertId is required');
    }

    const response = await this._fetch(`/v1/alerts/${alertId}`, {
      method: 'DELETE'
    });

    return response;
  }

  /**
   * Get trigger history for a specific alert
   * @param {number} alertId - Alert ID
   * @returns {Promise<Object[]>} Array of trigger events
   */
  async getAlertHistory(alertId) {
    if (!this.apiKey) {
      throw new Error('API key required for getAlertHistory. Set apiKey in constructor.');
    }

    if (!alertId) {
      throw new Error('alertId is required');
    }

    const response = await this._fetch(`/v1/alerts/${alertId}/history`);
    return response.data;
  }

  /**
   * Connect to AGORA WebSocket for real-time price alerts (requires authentication)
   * @param {Function} onAlert - Callback function called when alert is triggered: (alertData) => void
   * @returns {Promise<WebSocket>} WebSocket instance (call .close() to disconnect)
   */
  async connectWebSocket(onAlert) {
    if (!this.apiKey) {
      throw new Error('API key required for connectWebSocket. Set apiKey in constructor.');
    }

    if (!this.agentId) {
      throw new Error('agentId required for connectWebSocket. Set agentId in constructor.');
    }

    if (typeof onAlert !== 'function') {
      throw new Error('onAlert callback function is required');
    }

    // Convert http(s):// to ws(s)://
    const wsUrl = this.baseUrl.replace(/^http/, 'ws');

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);

      ws.addEventListener('open', () => {
        // Send authentication message
        ws.send(JSON.stringify({
          type: 'auth',
          agentId: this.agentId,
          apiKey: this.apiKey
        }));
      });

      ws.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'connected') {
            // Successfully authenticated
            resolve(ws);
          } else if (message.type === 'price_alert') {
            // Alert triggered - call user callback
            onAlert(message.data);
          } else if (message.type === 'error') {
            reject(new Error(`WebSocket error: ${message.error}`));
          }
        } catch (error) {
          // Invalid JSON or callback error - log but don't close connection
          console.error('WebSocket message error:', error);
        }
      });

      ws.addEventListener('error', (event) => {
        reject(new Error('WebSocket connection failed'));
      });

      ws.addEventListener('close', () => {
        // Connection closed - user can handle reconnection if needed
      });
    });
  }

  // ===== PREDICTIVE PRICING METHODS (ROADMAP v3 Phase 3) =====

  /**
   * Get 7-day price forecast for a specific skill
   * @param {string} skill - Skill to forecast (e.g., "text-generation")
   * @param {number} [days=7] - Number of forecast days (default: 7, max: 30)
   * @returns {Promise<Object>} Forecast data with trend and recommendation
   */
  async getForecast(skill, days = 7) {
    if (!skill) {
      throw new Error('skill is required');
    }

    if (typeof days !== 'number' || days < 1 || days > 30) {
      throw new Error('days must be between 1 and 30');
    }

    const response = await this._fetch(`/v1/forecast/${encodeURIComponent(skill)}?days=${days}`);
    return response.data;
  }

  /**
   * Get forecast accuracy metrics for a specific skill
   * @param {string} skill - Skill to check accuracy for
   * @returns {Promise<Object>} { mae, rmse, accuracy, testDays }
   */
  async getForecastAccuracy(skill) {
    if (!skill) {
      throw new Error('skill is required');
    }

    const response = await this._fetch(`/v1/forecast/${encodeURIComponent(skill)}/accuracy`);
    return response.data;
  }

  /**
   * Get forecast system status (all skills)
   * @returns {Promise<Object>} { totalSkills, totalForecasts, lastGenerated, recentForecasts }
   */
  async getForecastStatus() {
    const response = await this._fetch('/v1/forecast/status');
    return response.data;
  }

  /**
   * Manually trigger forecast generation for all skills (admin/debugging)
   * @returns {Promise<Object>} { skillsProcessed, forecastsGenerated }
   */
  async generateForecasts() {
    const response = await this._fetch('/v1/forecast/generate', {
      method: 'POST'
    });
    return response.data;
  }
}
