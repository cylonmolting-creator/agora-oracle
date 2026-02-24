// Agent Rate Oracle — Frontend JavaScript
// Phase 0F (ROADMAP 0.23)

// ==============================
// Configuration
// ==============================

const API_BASE = '';  // Empty because we're on same origin
const REFRESH_INTERVAL = 60000;  // 60 seconds

// ==============================
// State Management
// ==============================

let currentFilter = 'all';
let currentSortColumn = 'price';
let currentSortDirection = 'asc';
let allRates = [];
let allProviders = [];
let currentTab = 'rates';
let currentAgentId = null;
let currentApiKey = null;
let alertWebSocket = null;
let activeAlerts = [];

// ==============================
// Fetch Functions
// ==============================

/**
 * Fetch system statistics from /v1/stats
 */
async function fetchStats() {
  try {
    const response = await fetch(`${API_BASE}/v1/stats`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    return result.success ? result.data : null;
  } catch (error) {
    console.error('fetchStats error:', error);
    updateConnectionStatus(false);
    return null;
  }
}

/**
 * Fetch all aggregated rates from /v1/rates
 */
async function fetchRates() {
  try {
    const response = await fetch(`${API_BASE}/v1/rates`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    return result.success ? result.data : [];
  } catch (error) {
    console.error('fetchRates error:', error);
    updateConnectionStatus(false);
    return [];
  }
}

/**
 * Fetch all providers from /v1/providers
 */
async function fetchProviders() {
  try {
    const response = await fetch(`${API_BASE}/v1/providers`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    return result.success ? result.data : [];
  } catch (error) {
    console.error('fetchProviders error:', error);
    updateConnectionStatus(false);
    return [];
  }
}

// ==============================
// Render Functions
// ==============================

/**
 * Update stats bar with current numbers
 */
function renderStats(stats) {
  if (!stats) return;

  document.getElementById('stat-providers').textContent = formatNumber(stats.totalProviders);
  document.getElementById('stat-services').textContent = formatNumber(stats.totalServices);
  document.getElementById('stat-datapoints').textContent = formatNumber(stats.totalRates || stats.totalDataPoints);
  document.getElementById('stat-confidence').textContent = (stats.averageConfidence * 100).toFixed(1) + '%';

  updateLastUpdateTime();
  updateConnectionStatus(true);
}

/**
 * Render price comparison table
 */
function renderTable(rates) {
  const tbody = document.getElementById('price-table-body');
  const emptyState = document.getElementById('table-empty');

  // Filter rates by current category
  const filteredRates = filterByCategory(rates);

  // Sort rates
  const sortedRates = sortRates(filteredRates);

  if (sortedRates.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  // Generate table rows
  tbody.innerHTML = sortedRates.map(rate => {
    const confidenceBadge = getConfidenceBadge(rate.confidence);
    const trendBadge = getTrendBadge(rate.trend);

    return `
      <tr>
        <td>${formatCategoryName(rate.category)}</td>
        <td>${formatSubcategoryName(rate.subcategory)}</td>
        <td class="text-mono text-accent">${formatPrice(rate.price)}</td>
        <td class="text-mono">${rate.unit}</td>
        <td class="text-center">${rate.sourceCount || 1}</td>
        <td>${confidenceBadge}</td>
        <td>${trendBadge}</td>
      </tr>
    `;
  }).join('');
}

/**
 * Render provider cards
 */
function renderProviderCards(providers) {
  const container = document.getElementById('provider-cards');

  // Sort providers by service count (descending), take top 12
  const topProviders = providers
    .sort((a, b) => b.serviceCount - a.serviceCount)
    .slice(0, 12);

  container.innerHTML = topProviders.map(provider => {
    const avgPrice = provider.avgPrice !== null ? formatPrice(provider.avgPrice) : 'N/A';
    const categories = provider.categories ? provider.categories.slice(0, 3).map(c => formatCategoryName(c)).join(', ') : '';

    return `
      <div class="provider-card">
        <div class="provider-header">
          <span class="provider-name">${provider.name}</span>
          <span class="provider-type">${provider.type.toUpperCase()}</span>
        </div>
        <div class="provider-stats">
          <div class="provider-stat">
            <span class="stat-label">Services</span>
            <span class="stat-value text-mono">${provider.serviceCount}</span>
          </div>
          <div class="provider-stat">
            <span class="stat-label">Avg Price</span>
            <span class="stat-value text-mono text-accent">${avgPrice}</span>
          </div>
        </div>
        <div class="provider-categories">
          <span class="text-muted">${categories}</span>
        </div>
        <div class="sparkline-container">
          ${renderSparkline([1, 1.2, 0.9, 1.1, 1.0])}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Render sparkline SVG (mini trend chart)
 */
function renderSparkline(history) {
  if (!history || history.length < 2) {
    return '<svg class="sparkline" width="100%" height="40"></svg>';
  }

  const width = 100;
  const height = 40;
  const padding = 5;

  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;

  // Normalize data points to SVG coordinates
  const points = history.map((value, index) => {
    const x = (index / (history.length - 1)) * (width - 2 * padding) + padding;
    const y = height - padding - ((value - min) / range) * (height - 2 * padding);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return `
    <svg class="sparkline" width="100%" height="${height}" viewBox="0 0 ${width} ${height}">
      <polyline
        points="${points}"
        fill="none"
        stroke="#00ff41"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `;
}

// ==============================
// Filter & Sort Functions
// ==============================

/**
 * Filter rates by category
 */
function filterByCategory(rates) {
  if (currentFilter === 'all') {
    return rates;
  }
  return rates.filter(rate => rate.category === currentFilter);
}

/**
 * Sort rates by column
 */
function sortRates(rates) {
  const sorted = [...rates];

  sorted.sort((a, b) => {
    let aVal = a[currentSortColumn];
    let bVal = b[currentSortColumn];

    // Handle null/undefined
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    // Special handling for different column types
    if (currentSortColumn === 'category' || currentSortColumn === 'subcategory' || currentSortColumn === 'unit' || currentSortColumn === 'trend') {
      aVal = String(aVal).toLowerCase();
      bVal = String(bVal).toLowerCase();
    } else if (currentSortColumn === 'price' || currentSortColumn === 'confidence' || currentSortColumn === 'sourceCount') {
      aVal = Number(aVal);
      bVal = Number(bVal);
    }

    // Sort
    if (aVal < bVal) return currentSortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return currentSortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  return sorted;
}

// ==============================
// Smart Router Functions
// ==============================

/**
 * Register a new agent and get API key
 */
async function registerAgent(name) {
  if (!name || name.trim() === '') {
    alert('Please enter an agent name');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/v1/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();

    if (result.success) {
      const { id, name: agentName, apiKey } = result.data;

      // Store in localStorage
      localStorage.setItem('agora_agent_id', id);
      localStorage.setItem('agora_api_key', apiKey);
      localStorage.setItem('agora_agent_name', agentName);

      currentAgentId = id;
      currentApiKey = apiKey;

      // Display agent info
      document.getElementById('agent-id').textContent = id;
      document.getElementById('agent-api-key').textContent = apiKey;
      document.getElementById('agent-info').style.display = 'block';

      // Load analytics and budget
      await Promise.all([
        fetchAnalytics(id),
        fetchBudget(id)
      ]);

      alert('Agent registered successfully! API key saved to localStorage.');
    } else {
      alert('Failed to register agent: ' + (result.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('registerAgent error:', error);
    alert('Failed to register agent. Check console for details.');
  }
}

/**
 * Fetch analytics for an agent
 */
async function fetchAnalytics(agentId) {
  if (!currentApiKey) return;

  try {
    const response = await fetch(`${API_BASE}/v1/analytics/${agentId}`, {
      headers: { 'Authorization': `Bearer ${currentApiKey}` }
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.warn('Invalid API key');
        return;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      const analytics = result.data;
      renderAnalytics(analytics);

      // Also fetch savings
      await fetchSavings(agentId);
    }
  } catch (error) {
    console.error('fetchAnalytics error:', error);
  }
}

/**
 * Fetch budget status for an agent
 */
async function fetchBudget(agentId) {
  if (!currentApiKey) return;

  try {
    const response = await fetch(`${API_BASE}/v1/budget/${agentId}`, {
      headers: { 'Authorization': `Bearer ${currentApiKey}` }
    });

    if (!response.ok) {
      if (response.status === 401) return;
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      const budget = result.data;
      renderBudget(budget);
    }
  } catch (error) {
    console.error('fetchBudget error:', error);
  }
}

/**
 * Fetch savings summary
 */
async function fetchSavings(agentId) {
  if (!currentApiKey) return;

  try {
    const response = await fetch(`${API_BASE}/v1/analytics/${agentId}/savings`, {
      headers: { 'Authorization': `Bearer ${currentApiKey}` }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();

    if (result.success) {
      const savings = result.data;
      renderSavings(savings);
    }
  } catch (error) {
    console.error('fetchSavings error:', error);
  }
}

/**
 * Render analytics data
 */
function renderAnalytics(analytics) {
  // Render recent requests table (last 10)
  const tbody = document.getElementById('requests-table-body');

  if (!analytics.daily || analytics.daily.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No requests yet</td></tr>';
    return;
  }

  // Get recent requests (mock data from daily summary for now)
  // In production, you'd fetch actual request_log entries
  const recentRequests = analytics.daily.slice(-10).reverse();

  tbody.innerHTML = recentRequests.map(day => {
    return `
      <tr>
        <td class="text-mono">${day.date}</td>
        <td>${day.topProvider || 'N/A'}</td>
        <td>${formatCategoryName(day.category || 'mixed')}</td>
        <td class="text-accent text-mono">${formatPrice(day.spent)}</td>
        <td class="text-mono">${day.avgLatency ? day.avgLatency + 'ms' : 'N/A'}</td>
        <td class="status-success">success</td>
      </tr>
    `;
  }).join('');
}

/**
 * Render budget status
 */
function renderBudget(budget) {
  const spent = budget.spent || 0;
  const limit = budget.limit || 0;
  const percent = limit > 0 ? (spent / limit * 100) : 0;

  document.getElementById('budget-spent').textContent = formatPrice(spent);
  document.getElementById('budget-limit').textContent = formatPrice(limit);
  document.getElementById('budget-percent').textContent = `(${percent.toFixed(0)}%)`;

  const progressBar = document.getElementById('budget-progress');
  progressBar.style.width = `${Math.min(percent, 100)}%`;

  // Color coding
  if (percent >= 90) {
    progressBar.style.background = '#ff4444'; // red
  } else if (percent >= 70) {
    progressBar.style.background = '#ffbb33'; // yellow
  } else {
    progressBar.style.background = '#00cc66'; // green
  }
}

/**
 * Render savings summary
 */
function renderSavings(savings) {
  const totalSavings = savings.totalSavings || 0;
  const savingsPercent = savings.savingsPercent || 0;

  document.getElementById('total-savings').textContent = totalSavings.toFixed(2);
  document.getElementById('savings-percent').textContent = savingsPercent.toFixed(0);
}

/**
 * Calculate potential savings
 */
async function calculateSavings() {
  const spend = parseFloat(document.getElementById('calc-spend').value);
  const providerName = document.getElementById('calc-provider').value;

  if (!spend || spend <= 0) {
    alert('Please enter a valid monthly spend amount');
    return;
  }

  if (!providerName) {
    alert('Please select a provider');
    return;
  }

  try {
    // Find provider's average rate
    const provider = allProviders.find(p => p.name === providerName);
    if (!provider) {
      alert('Provider not found');
      return;
    }

    const providerAvgRate = provider.avgPrice || 0;

    // Find cheapest rate across all rates
    const cheapestRate = allRates.reduce((min, rate) => {
      return (rate.price < min.price) ? rate : min;
    }, allRates[0]);

    if (!cheapestRate || providerAvgRate === 0) {
      alert('Insufficient rate data to calculate savings');
      return;
    }

    // Calculate savings
    const savingsPercent = ((providerAvgRate - cheapestRate.price) / providerAvgRate) * 100;
    const savingsAmount = spend * (savingsPercent / 100);

    // Display result
    document.getElementById('calc-best').textContent = cheapestRate.providerName || 'ARO Smart Router';
    document.getElementById('calc-savings').textContent = savingsAmount.toFixed(2);
    document.getElementById('calc-percent').textContent = savingsPercent.toFixed(0);
    document.getElementById('calc-result').style.display = 'block';

  } catch (error) {
    console.error('calculateSavings error:', error);
    alert('Failed to calculate savings');
  }
}

/**
 * Copy API key to clipboard
 */
function copyApiKey() {
  const apiKey = document.getElementById('agent-api-key').textContent;
  navigator.clipboard.writeText(apiKey).then(() => {
    const btn = document.getElementById('copy-key-btn');
    const originalText = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => {
      btn.textContent = originalText;
    }, 2000);
  }).catch(err => {
    console.error('Copy failed:', err);
    alert('Failed to copy. Please copy manually.');
  });
}

/**
 * Switch between tabs
 */
function switchTab(tabName) {
  // Update nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.toggle('active', tab.id === `tab-${tabName}`);
  });

  currentTab = tabName;

  // Load Smart Router data if switching to that tab
  if (tabName === 'smart-router') {
    loadSmartRouterData();
  }

  // Load Agent Marketplace data if switching to that tab
  if (tabName === 'agent-marketplace') {
    loadAgentMarketplaceData();
  }
}

/**
 * Load Smart Router tab data
 */
async function loadSmartRouterData() {
  // Check localStorage for saved agent
  const savedAgentId = localStorage.getItem('agora_agent_id');
  const savedApiKey = localStorage.getItem('agora_api_key');

  if (savedAgentId && savedApiKey) {
    currentAgentId = parseInt(savedAgentId);
    currentApiKey = savedApiKey;

    document.getElementById('agent-id').textContent = currentAgentId;
    document.getElementById('agent-api-key').textContent = currentApiKey;
    document.getElementById('agent-info').style.display = 'block';

    // Fetch analytics and budget
    await Promise.all([
      fetchAnalytics(currentAgentId),
      fetchBudget(currentAgentId)
    ]);
  }

  // Populate provider dropdown for calculator
  const providerSelect = document.getElementById('calc-provider');
  providerSelect.innerHTML = '<option value="">-- Select Provider --</option>' +
    allProviders.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
}

/**
 * Load Agent Marketplace tab data
 */
async function loadAgentMarketplaceData() {
  // Check localStorage for last search
  const lastSearch = localStorage.getItem('agora_last_agent_search');
  if (lastSearch) {
    document.getElementById('marketplace-skill-input').value = lastSearch;
    // Auto-load last search results
    await searchAgentServices(lastSearch);
  }
}

// ==============================
// Event Handlers
// ==============================

/**
 * Handle category filter button click
 */
function handleFilterClick(event) {
  const btn = event.target.closest('.filter-btn');
  if (!btn) return;

  // Update active state
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  // Update filter and re-render
  currentFilter = btn.dataset.category;
  renderTable(allRates);
}

/**
 * Handle table column header click (sort)
 */
function handleSortClick(event) {
  const th = event.target.closest('.sortable');
  if (!th) return;

  const column = th.dataset.sort;

  // Toggle direction if same column, else reset to asc
  if (currentSortColumn === column) {
    currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    currentSortColumn = column;
    currentSortDirection = 'asc';
  }

  // Update sort icons
  document.querySelectorAll('.sortable').forEach(header => {
    const icon = header.querySelector('.sort-icon');
    if (header === th) {
      icon.textContent = currentSortDirection === 'asc' ? '▲' : '▼';
    } else {
      icon.textContent = '▼';
    }
  });

  // Re-render table
  renderTable(allRates);
}

// ==============================
// Utility Functions
// ==============================

/**
 * Format price with proper precision
 */
function formatPrice(price) {
  if (price === null || price === undefined) return 'N/A';
  const num = Number(price);
  if (num === 0) return '$0';
  if (num >= 1) return '$' + num.toFixed(2);
  if (num >= 0.01) return '$' + num.toFixed(4);
  if (num >= 0.0001) return '$' + num.toFixed(6);
  return '$' + num.toExponential(2);
}

/**
 * Format number with commas
 */
function formatNumber(num) {
  if (num === null || num === undefined) return '--';
  return Number(num).toLocaleString('en-US');
}

/**
 * Format category name (kebab-case to Title Case)
 */
function formatCategoryName(category) {
  if (!category) return 'N/A';
  return category
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format subcategory name
 */
function formatSubcategoryName(subcategory) {
  if (!subcategory || subcategory === 'all') return 'All';
  return formatCategoryName(subcategory);
}

/**
 * Get confidence badge HTML
 */
function getConfidenceBadge(confidence) {
  if (confidence === null || confidence === undefined) return '<span class="confidence-badge confidence-low">N/A</span>';

  const percent = (confidence * 100).toFixed(0);
  let className = 'confidence-low';

  if (confidence >= 0.8) {
    className = 'confidence-high';
  } else if (confidence >= 0.5) {
    className = 'confidence-medium';
  }

  return `<span class="confidence-badge ${className}">${percent}%</span>`;
}

/**
 * Get trend badge HTML
 */
function getTrendBadge(trend) {
  if (!trend || trend === 'stable') {
    return '<span class="trend-stable">→</span>';
  } else if (trend === 'up') {
    return '<span class="trend-up">↑</span>';
  } else if (trend === 'down') {
    return '<span class="trend-down">↓</span>';
  }
  return '<span class="text-muted">—</span>';
}

/**
 * Update last update timestamp
 */
function updateLastUpdateTime() {
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  document.getElementById('last-update').textContent = `Last updated: ${timeString}`;
}

/**
 * Update connection status indicator
 */
function updateConnectionStatus(connected) {
  const indicator = document.getElementById('connection-status');
  if (connected) {
    indicator.style.color = '#00cc66';
    indicator.title = 'Connected';
  } else {
    indicator.style.color = '#ff4444';
    indicator.title = 'Connection error';
  }
}

// ==============================
// Initialization
// ==============================

/**
 * Load all data and render dashboard
 */
async function loadData() {
  const [stats, rates, providers] = await Promise.all([
    fetchStats(),
    fetchRates(),
    fetchProviders()
  ]);

  // Store in global state
  allRates = rates;
  allProviders = providers;

  // Render all sections
  renderStats(stats);
  renderTable(rates);
  renderProviderCards(providers);

  // Populate forecast skill selector
  populateForecastSkillSelector();
}

/**
 * Initialize dashboard
 */
function init() {
  // Initial load
  loadData();

  // Set up auto-refresh
  setInterval(loadData, REFRESH_INTERVAL);

  // Set up event listeners for Rates tab
  document.querySelector('.filter-section').addEventListener('click', handleFilterClick);
  document.querySelector('.price-table thead').addEventListener('click', handleSortClick);

  // Set up event listeners for navigation
  document.querySelector('.nav-section').addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-btn');
    if (btn) {
      switchTab(btn.dataset.tab);
    }
  });

  // Set up Smart Router event listeners
  document.getElementById('generate-key-btn')?.addEventListener('click', () => {
    const name = document.getElementById('agent-name').value;
    registerAgent(name);
  });

  document.getElementById('copy-key-btn')?.addEventListener('click', copyApiKey);

  document.getElementById('calculate-savings-btn')?.addEventListener('click', calculateSavings);

  // Set up Agent Marketplace event listeners
  document.getElementById('search-agents-btn')?.addEventListener('click', () => {
    const skill = document.getElementById('marketplace-skill-input').value.trim();
    // Skill is now optional - empty means show all agents
    searchAgentServices(skill);
  });

  // Set up Price Alert event listeners
  document.getElementById('alert-type')?.addEventListener('change', handleAlertTypeChange);
  document.getElementById('alert-notify-method')?.addEventListener('change', handleNotifyMethodChange);
  document.getElementById('create-alert-btn')?.addEventListener('click', createAlert);
  document.getElementById('ws-toggle-btn')?.addEventListener('click', toggleWebSocket);

  // Load alerts if agent is already registered
  if (currentApiKey) {
    fetchAlerts();
    showWebSocketStatus();
  }

  // Set up Price Forecast event listeners
  document.getElementById('fetch-forecast-btn')?.addEventListener('click', () => {
    const skill = document.getElementById('forecast-skill-select').value;
    fetchForecast(skill);
  });

  console.log('Agent Rate Oracle dashboard initialized');
}

// ==============================
// Agent Marketplace Functions (ROADMAP v3 Phase 1)
// ==============================

/**
 * Search and compare agent services by skill
 */
async function searchAgentServices(skill) {
  try {
    // Use free endpoint and filter client-side
    const response = await fetch(`${API_BASE}/v1/agent-services`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      let agents = result.data;

      // Filter by skill if provided
      if (skill && skill.trim()) {
        const skillLower = skill.trim().toLowerCase();
        agents = agents.filter(agent =>
          agent.skill && agent.skill.toLowerCase().includes(skillLower)
        );

        if (agents.length === 0) {
          alert(`No agents found for skill: ${skill}\n\nTry a broader search like "text-generation" or "embeddings"`);
          return;
        }
      }

      // Calculate market stats client-side
      const prices = agents.map(a => a.price).filter(p => p > 0);
      const marketMedian = prices.length > 0
        ? prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)]
        : 0;

      const priceRange = {
        min: Math.min(...prices),
        max: Math.max(...prices)
      };

      const avgUptime = agents.reduce((sum, a) => sum + (a.uptime || 0), 0) / agents.length;

      // Calculate savings and ranking
      agents = agents.map((agent, index) => ({
        ...agent,
        ranking: index + 1,
        savings: marketMedian > 0 ? ((marketMedian - agent.price) / marketMedian * 100) : 0,
        isBestValue: false
      }));

      // Sort by price (cheapest first)
      agents.sort((a, b) => a.price - b.price);

      // Mark cheapest as best value
      if (agents.length > 0) {
        agents[0].isBestValue = true;
      }

      // Re-rank after sorting
      agents.forEach((agent, index) => {
        agent.ranking = index + 1;
      });

      const data = {
        skill: skill || 'all',
        agents,
        marketMedian,
        cheapest: agents[0],
        bestValue: agents[0],
        meta: {
          totalAgents: agents.length,
          avgUptime,
          priceRange
        }
      };

      renderAgentComparison(data);

      // Store last search in localStorage
      if (skill) {
        localStorage.setItem('agora_last_agent_search', skill);
      }
    } else {
      alert('Failed to search agents: ' + (result.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('searchAgentServices error:', error);
    alert('Failed to search agent services. Check console for details.');
  }
}

/**
 * Render agent comparison table and market stats
 */
function renderAgentComparison(data) {
  const { skill, agents, marketMedian, cheapest, bestValue, meta } = data;

  // Show market stats card
  document.getElementById('market-median').textContent = formatPrice(marketMedian);
  document.getElementById('market-range').textContent = `${formatPrice(meta.priceRange.min)} - ${formatPrice(meta.priceRange.max)}`;
  document.getElementById('market-total').textContent = meta.totalAgents;
  document.getElementById('market-uptime').textContent = meta.avgUptime ? (meta.avgUptime * 100).toFixed(1) + '%' : 'N/A';
  document.getElementById('market-stats-card').style.display = 'block';

  // Show best value card
  if (bestValue) {
    document.getElementById('best-value-name').textContent = bestValue.agentName;
    document.getElementById('best-value-price').textContent = formatPrice(bestValue.price);
    document.getElementById('best-value-card').style.display = 'block';
  }

  // Render comparison table
  const tbody = document.getElementById('comparison-table-body');

  if (agents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No agents found for this skill</td></tr>';
    return;
  }

  tbody.innerHTML = agents.map(agent => {
    const savingsText = agent.savings
      ? (agent.savings > 0 ? `${agent.savings.toFixed(0)}% cheaper` : `${Math.abs(agent.savings).toFixed(0)}% more expensive`)
      : 'Median price';

    const savingsClass = agent.savings > 0 ? 'text-accent' : (agent.savings < 0 ? 'text-muted' : '');

    const uptimeText = agent.uptime ? (agent.uptime * 100).toFixed(1) + '%' : 'N/A';
    const latencyText = agent.avgLatency ? agent.avgLatency + 'ms' : 'N/A';
    const ratingText = agent.rating ? agent.rating.toFixed(1) + ' ⭐' : 'N/A';

    const isBestValue = agent.isBestValue;
    const rowClass = isBestValue ? 'style="background: rgba(0, 255, 65, 0.05);"' : '';

    return `
      <tr ${rowClass} data-agent-id="${agent.agentId}">
        <td class="text-center">${agent.ranking}</td>
        <td>
          ${agent.agentName}
          ${isBestValue ? '<span class="best-value-badge">⭐ Best Value</span>' : ''}
        </td>
        <td class="text-accent text-mono">${formatPrice(agent.price)}</td>
        <td class="text-mono">${agent.unit}</td>
        <td class="text-center">${uptimeText}</td>
        <td class="text-center">${latencyText}</td>
        <td class="text-center">${ratingText}</td>
        <td class="text-center ${savingsClass}">${savingsText}</td>
        <td class="text-center">
          <button class="view-history-btn" data-agent-id="${agent.agentId}">View History</button>
        </td>
      </tr>
    `;
  }).join('');

  // Add click handlers to "View History" buttons
  document.querySelectorAll('.view-history-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const agentId = e.target.dataset.agentId;
      fetchAgentPriceHistory(agentId);
    });
  });
}

/**
 * Fetch agent price history and render chart
 */
async function fetchAgentPriceHistory(agentId) {
  try {
    const response = await fetch(`${API_BASE}/v1/agent-services/${encodeURIComponent(agentId)}`);

    if (!response.ok) {
      if (response.status === 404) {
        alert('Agent service not found');
        return;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      const agent = result.data;
      renderPriceHistory(agent);
    } else {
      alert('Failed to fetch agent details: ' + (result.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('fetchAgentPriceHistory error:', error);
    alert('Failed to fetch price history. Check console for details.');
  }
}

/**
 * Render price history chart
 */
function renderPriceHistory(agent) {
  const { agentId, agentName, skill, price, priceHistory } = agent;

  // Show price history section
  document.getElementById('price-history-section').style.display = 'block';

  // Calculate trend
  if (!priceHistory || priceHistory.length === 0) {
    document.getElementById('chart-stats').innerHTML = `
      <p>No price history available for <strong>${agentName}</strong></p>
    `;
    document.getElementById('price-history-canvas').style.display = 'none';
    return;
  }

  // Calculate 30-day change
  const oldestPrice = priceHistory[0].price;
  const currentPrice = price;
  const priceChange = ((currentPrice - oldestPrice) / oldestPrice) * 100;
  const trend = priceChange > 1 ? 'up' : (priceChange < -1 ? 'down' : 'stable');
  const trendSymbol = trend === 'up' ? '↑' : (trend === 'down' ? '↓' : '→');
  const trendColor = trend === 'up' ? '#ff4444' : (trend === 'down' ? '#00cc66' : '#ffbb33');

  // Update chart stats
  document.getElementById('chart-stats').innerHTML = `
    <p>
      <strong>${agentName}</strong> (${skill}) — Current: ${formatPrice(currentPrice)}
      <span style="color: ${trendColor};">${trendSymbol} ${priceChange.toFixed(1)}%</span> over 30 days
    </p>
  `;

  // Render simple line chart (custom SVG implementation)
  renderPriceChart(priceHistory, currentPrice);
}

/**
 * Render price chart using SVG
 */
function renderPriceChart(history, currentPrice) {
  const canvas = document.getElementById('price-history-canvas');
  canvas.style.display = 'block';

  const width = canvas.offsetWidth || 800;
  const height = 300;
  const padding = { top: 20, right: 40, bottom: 30, left: 60 };

  // Add current price to history for chart
  const allPrices = [...history, { price: currentPrice, recordedAt: new Date().toISOString() }];

  // Find min/max for Y-axis
  const prices = allPrices.map(d => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 0.01; // avoid division by zero

  // Create SVG
  let svg = `<svg width="${width}" height="${height}" style="background: #0a0a0a;">`;

  // Draw Y-axis grid lines and labels
  const ySteps = 5;
  for (let i = 0; i <= ySteps; i++) {
    const priceValue = minPrice + (priceRange / ySteps) * i;
    const y = height - padding.bottom - ((priceValue - minPrice) / priceRange) * (height - padding.top - padding.bottom);

    // Grid line
    svg += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#333" stroke-width="1" />`;

    // Label
    svg += `<text x="${padding.left - 10}" y="${y + 5}" fill="#666" text-anchor="end" font-size="12">${formatPrice(priceValue)}</text>`;
  }

  // Draw line chart
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const points = allPrices.map((d, index) => {
    const x = padding.left + (index / (allPrices.length - 1)) * chartWidth;
    const y = height - padding.bottom - ((d.price - minPrice) / priceRange) * chartHeight;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  svg += `<polyline points="${points}" fill="none" stroke="#00ff41" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`;

  // Draw data points
  allPrices.forEach((d, index) => {
    const x = padding.left + (index / (allPrices.length - 1)) * chartWidth;
    const y = height - padding.bottom - ((d.price - minPrice) / priceRange) * chartHeight;
    svg += `<circle cx="${x}" cy="${y}" r="4" fill="#00ff41" />`;
  });

  // X-axis label (start and end dates)
  const startDate = new Date(history[0].recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endDate = new Date(allPrices[allPrices.length - 1].recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  svg += `<text x="${padding.left}" y="${height - 5}" fill="#666" font-size="12">${startDate}</text>`;
  svg += `<text x="${width - padding.right}" y="${height - 5}" fill="#666" text-anchor="end" font-size="12">${endDate}</text>`;

  svg += `</svg>`;

  canvas.innerHTML = svg;
}

// ==============================
// Price Alerts Functions (ROADMAP v3 Phase 2)
// ==============================

/**
 * Handle alert type change (show/hide max price input)
 */
function handleAlertTypeChange() {
  const alertType = document.getElementById('alert-type').value;
  const maxPriceRow = document.getElementById('max-price-row');

  if (alertType === 'price_threshold') {
    maxPriceRow.style.display = 'block';
  } else {
    maxPriceRow.style.display = 'none';
  }
}

/**
 * Handle notify method change (show/hide webhook/email inputs)
 */
function handleNotifyMethodChange() {
  const notifyMethod = document.getElementById('alert-notify-method').value;
  const webhookRow = document.getElementById('webhook-url-row');
  const emailRow = document.getElementById('email-row');

  if (notifyMethod === 'webhook') {
    webhookRow.style.display = 'block';
    emailRow.style.display = 'none';
  } else if (notifyMethod === 'email') {
    webhookRow.style.display = 'none';
    emailRow.style.display = 'block';
  } else {
    webhookRow.style.display = 'none';
    emailRow.style.display = 'none';
  }
}

/**
 * Create new price alert
 */
async function createAlert() {
  if (!currentApiKey) {
    alert('Please register an agent first to create alerts');
    return;
  }

  const alertType = document.getElementById('alert-type').value;
  const targetSkill = document.getElementById('alert-skill').value.trim();
  const maxPrice = parseFloat(document.getElementById('alert-max-price').value);
  const notifyMethod = document.getElementById('alert-notify-method').value;
  const webhookUrl = document.getElementById('alert-webhook-url').value.trim();
  const email = document.getElementById('alert-email').value.trim();

  // Validation
  if (!targetSkill) {
    alert('Please enter a target skill');
    return;
  }

  if (alertType === 'price_threshold' && (!maxPrice || maxPrice <= 0)) {
    alert('Please enter a valid max price for threshold alerts');
    return;
  }

  if (notifyMethod === 'webhook' && !webhookUrl) {
    alert('Please enter a webhook URL');
    return;
  }

  if (notifyMethod === 'email' && !email) {
    alert('Please enter an email address');
    return;
  }

  try {
    const payload = {
      alertType,
      targetSkill,
      notifyMethod
    };

    if (alertType === 'price_threshold') {
      payload.maxPrice = maxPrice;
    }

    if (notifyMethod === 'webhook') {
      payload.webhookUrl = webhookUrl;
    } else if (notifyMethod === 'email') {
      payload.email = email;
    }

    const response = await fetch(`${API_BASE}/v1/alerts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentApiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      alert('Alert created successfully!');
      // Clear form
      document.getElementById('alert-skill').value = '';
      document.getElementById('alert-max-price').value = '';
      document.getElementById('alert-webhook-url').value = '';
      document.getElementById('alert-email').value = '';
      // Refresh alerts table
      fetchAlerts();
    }
  } catch (error) {
    console.error('createAlert error:', error);
    alert(`Failed to create alert: ${error.message}`);
  }
}

/**
 * Fetch all alerts for current agent
 */
async function fetchAlerts() {
  if (!currentApiKey) return;

  try {
    const response = await fetch(`${API_BASE}/v1/alerts`, {
      headers: {
        'Authorization': `Bearer ${currentApiKey}`
      }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();

    if (result.success) {
      activeAlerts = result.data;
      renderAlertsTable(activeAlerts);
    }
  } catch (error) {
    console.error('fetchAlerts error:', error);
  }
}

/**
 * Render alerts table
 */
function renderAlertsTable(alerts) {
  const tbody = document.getElementById('alerts-table-body');

  if (!alerts || alerts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No alerts configured. Create one above.</td></tr>';
    return;
  }

  tbody.innerHTML = alerts.map(alert => {
    const target = alert.targetSkill || alert.targetProvider || '--';
    const maxPrice = alert.maxPrice ? `$${alert.maxPrice.toFixed(4)}` : '--';
    const statusClass = alert.status === 'active' ? 'status-active' : 'status-paused';

    return `
      <tr>
        <td>${alert.alertType}</td>
        <td>${target}</td>
        <td>${maxPrice}</td>
        <td>${alert.notifyMethod}</td>
        <td><span class="${statusClass}">${alert.status}</span></td>
        <td>
          <button class="action-btn" onclick="toggleAlertStatus(${alert.id}, '${alert.status}')">
            ${alert.status === 'active' ? 'Pause' : 'Resume'}
          </button>
          <button class="action-btn delete-btn" onclick="deleteAlert(${alert.id})">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Toggle alert status (active ↔ paused)
 */
async function toggleAlertStatus(alertId, currentStatus) {
  if (!currentApiKey) return;

  const newStatus = currentStatus === 'active' ? 'paused' : 'active';

  try {
    const response = await fetch(`${API_BASE}/v1/alerts/${alertId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentApiKey}`
      },
      body: JSON.stringify({ status: newStatus })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();

    if (result.success) {
      fetchAlerts(); // Refresh table
    }
  } catch (error) {
    console.error('toggleAlertStatus error:', error);
    alert(`Failed to update alert: ${error.message}`);
  }
}

/**
 * Delete alert
 */
async function deleteAlert(alertId) {
  if (!currentApiKey) return;

  if (!confirm('Are you sure you want to delete this alert?')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/v1/alerts/${alertId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${currentApiKey}`
      }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();

    if (result.success) {
      alert('Alert deleted successfully');
      fetchAlerts(); // Refresh table
    }
  } catch (error) {
    console.error('deleteAlert error:', error);
    alert(`Failed to delete alert: ${error.message}`);
  }
}

/**
 * Show WebSocket status section
 */
function showWebSocketStatus() {
  const wsStatus = document.getElementById('websocket-status');
  if (wsStatus) {
    wsStatus.style.display = 'flex';
  }
}

/**
 * Toggle WebSocket connection
 */
function toggleWebSocket() {
  if (alertWebSocket && alertWebSocket.readyState === WebSocket.OPEN) {
    disconnectWebSocket();
  } else {
    connectWebSocket();
  }
}

/**
 * Connect to WebSocket for real-time alerts
 */
function connectWebSocket() {
  if (!currentApiKey || !currentAgentId) {
    alert('Please register an agent first');
    return;
  }

  try {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}`;

    alertWebSocket = new WebSocket(wsUrl);

    alertWebSocket.onopen = () => {
      // Send auth message
      alertWebSocket.send(JSON.stringify({
        type: 'auth',
        agentId: currentAgentId,
        apiKey: currentApiKey
      }));
    };

    alertWebSocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'connected') {
          updateWebSocketStatus('connected');
          console.log('WebSocket connected:', message);
        } else if (message.type === 'price_alert') {
          handleAlertNotification(message.data);
        } else if (message.type === 'error') {
          console.error('WebSocket error:', message.message);
          updateWebSocketStatus('error');
        }
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };

    alertWebSocket.onerror = (error) => {
      console.error('WebSocket connection error:', error);
      updateWebSocketStatus('error');
    };

    alertWebSocket.onclose = () => {
      updateWebSocketStatus('disconnected');
      alertWebSocket = null;
    };

    updateWebSocketStatus('connecting');
  } catch (error) {
    console.error('connectWebSocket error:', error);
    alert(`Failed to connect WebSocket: ${error.message}`);
  }
}

/**
 * Disconnect WebSocket
 */
function disconnectWebSocket() {
  if (alertWebSocket) {
    alertWebSocket.close();
    alertWebSocket = null;
    updateWebSocketStatus('disconnected');
  }
}

/**
 * Update WebSocket status UI
 */
function updateWebSocketStatus(status) {
  const statusText = document.getElementById('ws-status-text');
  const toggleBtn = document.getElementById('ws-toggle-btn');
  const indicator = document.querySelector('.ws-indicator');

  if (statusText) {
    statusText.textContent = status.charAt(0).toUpperCase() + status.slice(1);
  }

  if (indicator) {
    indicator.className = 'ws-indicator';
    if (status === 'connected') {
      indicator.classList.add('ws-connected');
      indicator.style.color = '#00ff41';
    } else if (status === 'connecting') {
      indicator.style.color = '#ffaa00';
    } else if (status === 'error') {
      indicator.style.color = '#ff4444';
    } else {
      indicator.style.color = '#666';
    }
  }

  if (toggleBtn) {
    toggleBtn.textContent = (status === 'connected') ? 'Disconnect' : 'Connect';
  }
}

/**
 * Handle incoming alert notification
 */
function handleAlertNotification(alertData) {
  console.log('Price alert received:', alertData);

  // Show browser notification if supported
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('ARO Price Alert', {
      body: `${alertData.skill}: Price dropped from $${alertData.oldPrice} to $${alertData.newPrice}`,
      icon: '/favicon.ico'
    });
  }

  // Show toast notification
  showToast(`🔔 Price Alert: ${alertData.skill} dropped to $${alertData.newPrice} (${alertData.savings}% savings)`, 'success');

  // Refresh alert history
  fetchAlertHistory();
}

/**
 * Fetch alert trigger history
 */
async function fetchAlertHistory() {
  if (!currentApiKey || activeAlerts.length === 0) return;

  try {
    // Get history for all alerts (simplified: just fetch first alert's history)
    // In production, you'd fetch all alerts' history and merge
    const firstAlertId = activeAlerts[0].id;

    const response = await fetch(`${API_BASE}/v1/alerts/${firstAlertId}/history`, {
      headers: {
        'Authorization': `Bearer ${currentApiKey}`
      }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();

    if (result.success) {
      renderAlertHistory(result.data);
    }
  } catch (error) {
    console.error('fetchAlertHistory error:', error);
  }
}

/**
 * Render alert trigger history table
 */
function renderAlertHistory(history) {
  const tbody = document.getElementById('alert-history-body');

  if (!history || history.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No alerts triggered yet.</td></tr>';
    return;
  }

  tbody.innerHTML = history.slice(0, 10).map(trigger => {
    const time = new Date(trigger.triggeredAt).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    const savings = ((trigger.oldPrice - trigger.newPrice) / trigger.oldPrice * 100).toFixed(1);
    const notified = trigger.notified ? '✓' : '✗';

    return `
      <tr>
        <td>${time}</td>
        <td>${trigger.skill}</td>
        <td>$${trigger.oldPrice.toFixed(4)}</td>
        <td class="price-down">$${trigger.newPrice.toFixed(4)}</td>
        <td class="savings-highlight">${savings}%</td>
        <td>${notified}</td>
      </tr>
    `;
  }).join('');
}

/**
 * Show toast notification (helper function)
 */
function showToast(message, type = 'info') {
  // Simple toast implementation (you can enhance with CSS animations)
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#00ff41' : '#ffaa00'};
    color: #000;
    padding: 15px 20px;
    border-radius: 5px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    z-index: 10000;
    font-weight: bold;
    max-width: 400px;
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 5000);
}

// ==============================
// Price Forecast Functions (ROADMAP v3 Phase 3)
// ==============================

/**
 * Populate forecast skill selector dropdown
 */
function populateForecastSkillSelector() {
  const select = document.getElementById('forecast-skill-select');
  if (!select || !allRates || allRates.length === 0) return;

  // Get unique skills from all rates
  const skills = [...new Set(allRates.map(rate => {
    return rate.subcategory ? `${rate.category}/${rate.subcategory}` : rate.category;
  }))].sort();

  select.innerHTML = '<option value="">-- Select a skill --</option>' +
    skills.map(skill => `<option value="${skill}">${skill}</option>`).join('');
}

/**
 * Fetch and display price forecast for given skill
 */
async function fetchForecast(skill) {
  if (!skill) {
    alert('Please select a skill first');
    return;
  }

  try {
    // Show loading state
    document.getElementById('forecast-container').style.display = 'none';
    document.getElementById('forecast-empty').innerHTML = '<p>Loading forecast data...</p>';
    document.getElementById('forecast-empty').style.display = 'block';

    const response = await fetch(`${API_BASE}/v1/forecast/${encodeURIComponent(skill)}`);

    if (!response.ok) {
      if (response.status === 503) {
        document.getElementById('forecast-empty').innerHTML = '<p class="warning-text">⏳ Forecast not available yet. Check back in 24 hours.</p>';
        return;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      renderForecast(skill, result.data);

      // Try to fetch accuracy metrics
      fetchForecastAccuracy(skill);

      // Store last selected skill
      localStorage.setItem('agora_last_forecast_skill', skill);
    } else {
      document.getElementById('forecast-empty').innerHTML = '<p class="error-text">Failed to load forecast.</p>';
    }
  } catch (error) {
    console.error('fetchForecast error:', error);
    document.getElementById('forecast-empty').innerHTML = '<p class="error-text">Error loading forecast. Check console.</p>';
  }
}

/**
 * Fetch forecast accuracy metrics
 */
async function fetchForecastAccuracy(skill) {
  try {
    const response = await fetch(`${API_BASE}/v1/forecast/${encodeURIComponent(skill)}/accuracy`);

    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data.accuracy) {
        const accuracyPercent = (result.data.accuracy * 100).toFixed(1);
        document.getElementById('forecast-accuracy-value').textContent = `${accuracyPercent}%`;
        document.getElementById('forecast-accuracy-badge').style.display = 'block';
      }
    }
  } catch (error) {
    // Silently fail - accuracy is optional
    console.warn('Could not fetch forecast accuracy:', error);
  }
}

/**
 * Render forecast chart and UI components
 */
function renderForecast(skill, data) {
  // Hide empty state, show forecast container
  document.getElementById('forecast-empty').style.display = 'none';
  document.getElementById('forecast-container').style.display = 'block';

  // Update trend indicator
  updateTrendIndicator(data.trend);

  // Update recommendation card
  document.getElementById('forecast-recommendation-text').textContent = data.recommendation || 'No recommendation available';

  // Render chart
  renderForecastChart(skill, data);
}

/**
 * Update trend indicator (arrow + text + color)
 */
function updateTrendIndicator(trend) {
  const arrow = document.getElementById('forecast-trend-arrow');
  const text = document.getElementById('forecast-trend-text');

  if (trend === 'decreasing') {
    arrow.textContent = '↓';
    arrow.style.color = '#00ff41';  // Green (good for buyer)
    text.textContent = 'Price Decreasing';
    text.style.color = '#00ff41';
  } else if (trend === 'increasing') {
    arrow.textContent = '↑';
    arrow.style.color = '#ff4444';  // Red (bad for buyer)
    text.textContent = 'Price Increasing';
    text.style.color = '#ff4444';
  } else {
    arrow.textContent = '→';
    arrow.style.color = '#ffaa00';  // Yellow (stable)
    text.textContent = 'Price Stable';
    text.style.color = '#ffaa00';
  }
}

/**
 * Render forecast chart (historical + predicted prices)
 */
function renderForecastChart(skill, data) {
  const canvas = document.getElementById('forecast-chart');
  const ctx = canvas.getContext('2d');

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Chart dimensions
  const width = canvas.width;
  const height = canvas.height;
  const padding = { top: 30, right: 40, bottom: 50, left: 70 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Prepare data
  const currentPrice = data.currentPrice || 0;
  const forecast = data.forecast || [];

  // Create historical data points (mock last 30 days with current price)
  const historicalDays = 7; // Show last 7 days for simplicity
  const historicalData = Array.from({ length: historicalDays }, (_, i) => ({
    date: new Date(Date.now() - (historicalDays - i) * 24 * 60 * 60 * 1000),
    price: currentPrice * (1 + (Math.random() - 0.5) * 0.1),  // ±5% variation
    isHistorical: true
  }));

  // Format forecast data
  const forecastData = forecast.map(f => ({
    date: new Date(f.date),
    price: f.predictedPrice,
    confidence: f.confidence,
    isHistorical: false
  }));

  // Combine all data
  const allData = [...historicalData, ...forecastData];

  // Find min/max price for Y-axis
  const prices = allData.map(d => d.price);
  const minPrice = Math.min(...prices) * 0.95;
  const maxPrice = Math.max(...prices) * 1.05;

  // Helper: map price to Y coordinate
  const priceToY = (price) => {
    return padding.top + chartHeight - ((price - minPrice) / (maxPrice - minPrice)) * chartHeight;
  };

  // Helper: map index to X coordinate
  const indexToX = (index) => {
    return padding.left + (index / (allData.length - 1)) * chartWidth;
  };

  // Draw axes
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;

  // Y-axis
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.stroke();

  // X-axis
  ctx.beginPath();
  ctx.moveTo(padding.left, height - padding.bottom);
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.stroke();

  // Draw Y-axis labels (price)
  ctx.fillStyle = '#aaa';
  ctx.font = '12px monospace';
  ctx.textAlign = 'right';

  for (let i = 0; i <= 5; i++) {
    const price = minPrice + (maxPrice - minPrice) * (i / 5);
    const y = priceToY(price);
    ctx.fillText(`$${price.toFixed(4)}`, padding.left - 10, y + 4);

    // Draw horizontal grid line
    ctx.strokeStyle = '#333';
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  // Draw X-axis labels (dates)
  ctx.textAlign = 'center';
  allData.forEach((d, i) => {
    if (i % 3 === 0 || i === allData.length - 1) {  // Show every 3rd label
      const x = indexToX(i);
      const dateStr = `${d.date.getMonth() + 1}/${d.date.getDate()}`;
      ctx.fillText(dateStr, x, height - padding.bottom + 20);
    }
  });

  // Draw confidence band for forecast (shaded area)
  if (forecastData.length > 0) {
    const forecastStartIndex = historicalData.length;

    ctx.fillStyle = 'rgba(0, 255, 65, 0.1)';
    ctx.beginPath();

    // Top of confidence band
    for (let i = 0; i < forecastData.length; i++) {
      const index = forecastStartIndex + i;
      const x = indexToX(index);
      const price = forecastData[i].price;
      const confidence = forecastData[i].confidence || 0.7;
      const margin = price * (1 - confidence) * 0.5;
      const y = priceToY(price + margin);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    // Bottom of confidence band (reverse direction)
    for (let i = forecastData.length - 1; i >= 0; i--) {
      const index = forecastStartIndex + i;
      const x = indexToX(index);
      const price = forecastData[i].price;
      const confidence = forecastData[i].confidence || 0.7;
      const margin = price * (1 - confidence) * 0.5;
      const y = priceToY(price - margin);
      ctx.lineTo(x, y);
    }

    ctx.closePath();
    ctx.fill();
  }

  // Draw historical line (solid)
  ctx.strokeStyle = '#00ff41';
  ctx.lineWidth = 2;
  ctx.beginPath();

  historicalData.forEach((d, i) => {
    const x = indexToX(i);
    const y = priceToY(d.price);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();

  // Draw forecast line (dashed)
  if (forecastData.length > 0) {
    ctx.strokeStyle = '#00ff41';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();

    // Start from last historical point
    const lastHistoricalX = indexToX(historicalData.length - 1);
    const lastHistoricalY = priceToY(historicalData[historicalData.length - 1].price);
    ctx.moveTo(lastHistoricalX, lastHistoricalY);

    forecastData.forEach((d, i) => {
      const index = historicalData.length + i;
      const x = indexToX(index);
      const y = priceToY(d.price);
      ctx.lineTo(x, y);
    });

    ctx.stroke();
    ctx.setLineDash([]);  // Reset dash
  }

  // Draw vertical line separating historical and forecast
  if (forecastData.length > 0) {
    const separatorX = indexToX(historicalData.length - 1);
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(separatorX, padding.top);
    ctx.lineTo(separatorX, height - padding.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label "Today"
    ctx.fillStyle = '#aaa';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Today', separatorX, padding.top - 10);
  }

  // Draw chart title
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`${skill} — Price Forecast`, padding.left, 20);

  // Draw legend
  ctx.font = '12px monospace';
  const legendX = width - padding.right - 150;
  const legendY = padding.top + 10;

  // Historical line legend
  ctx.strokeStyle = '#00ff41';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(legendX, legendY);
  ctx.lineTo(legendX + 30, legendY);
  ctx.stroke();
  ctx.fillStyle = '#aaa';
  ctx.textAlign = 'left';
  ctx.fillText('Historical', legendX + 35, legendY + 4);

  // Forecast line legend
  ctx.strokeStyle = '#00ff41';
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(legendX, legendY + 20);
  ctx.lineTo(legendX + 30, legendY + 20);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillText('Forecast', legendX + 35, legendY + 24);
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
