# AGORA ROADMAP v3 — Three Killer Features

> **Tagline**: AGORA: Bloomberg Terminal of the AI Agent Economy
> **Mission**: Build the world's only predictive oracle for AI agent services
> **Timeline**: 60 gün (3 phase)
> **Status**: ✅ COMPLETE (Cycle #77)

---

## IMPORTANT: Project Context

### Current State (After ROADMAP v3 Completion)
- ✅ **Agent Service Comparison**: x402 Bazaar integration, side-by-side agent comparison
- ✅ **Real-Time Price Alerts**: Email/webhook/WebSocket notifications on price changes
- ✅ **Predictive Pricing**: ML-based 7-day price forecast with confidence bands
- ✅ **Core AGORA**: 20+ provider pricing, aggregation, confidence scoring
- ✅ **Smart Router**: Multi-provider routing, budget tracking, analytics
- ✅ **Database**: SQLite with full schema (agents, services, forecasts, alerts, etc.)
- ✅ **API**: 15+ REST endpoints
- ✅ **Dashboard**: Complete UI with Rate Explorer, Smart Router, Agent Marketplace, Price Forecasts
- ✅ **SDK**: JavaScript client with 20+ methods

### Work Directory
- **ALL code**: `~/Desktop/agora/`
- **Database**: `~/Desktop/agora/data/agora.db`
- **Server**: Express.js on port 3402
- **Entry point**: `src/index.js`

### Tech Stack
- **Runtime**: Node.js 18+ (ES modules, native fetch)
- **Framework**: Express.js
- **Database**: SQLite3 (better-sqlite3)
- **Scheduler**: node-cron
- **Frontend**: Vanilla HTML/CSS/JS

### DO NOT BREAK
- All existing endpoints must continue working
- Database schema extensions only (no breaking changes)
- Backward-compatible API additions
- Existing tests must pass

---

## Three Killer Features

### Feature 1: Agent Service Comparison
**What**: Compare x402 Bazaar agent services (same skill, different agents)
**Why unique**: x402 Bazaar lists services but doesn't compare them
**Business value**: ARO becomes the only oracle for both API pricing AND agent-to-agent service pricing

### Feature 2: Real-Time Price Alerts
**What**: Agent sets price threshold → ARO sends notification when price drops
**Why unique**: Nobody does AI API price alerts (stock market logic applied to AI APIs)
**Business value**: Recurring revenue (agents subscribe), viral potential (cost savings stories)

### Feature 3: Predictive Pricing
**What**: ML-based price forecasting (7-day forecast with confidence)
**Why unique**: Nobody predicts AI API pricing trends
**Business value**: Industry authority, press-worthy, strategic decision support

---

## Phase 1: Agent Service Comparison (Tasks 1-12)

**Goal**: ARO tracks x402 Bazaar agent services + compares them like Kayak.com

### Database Extension (Tasks 1-2)

- [x] **Task 1**: Create `src/db/migrations/002-agent-services.sql`
- Table: `agent_services` (id INTEGER PRIMARY KEY AUTOINCREMENT, agent_id TEXT NOT NULL UNIQUE, agent_name TEXT NOT NULL, skill TEXT NOT NULL, price REAL NOT NULL, unit TEXT NOT NULL, currency TEXT DEFAULT 'USD', uptime REAL, avg_latency_ms INTEGER, reviews_count INTEGER DEFAULT 0, rating REAL DEFAULT 0, x402_endpoint TEXT, bazaar_url TEXT, metadata TEXT, last_updated DATETIME DEFAULT CURRENT_TIMESTAMP, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)
- Table: `agent_service_history` (id INTEGER PRIMARY KEY AUTOINCREMENT, agent_id TEXT NOT NULL, price REAL NOT NULL, uptime REAL, avg_latency_ms INTEGER, recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (agent_id) REFERENCES agent_services(agent_id))
- Indexes: idx_agent_services_skill ON agent_services(skill), idx_agent_services_price ON agent_services(skill, price), idx_agent_service_history_agent ON agent_service_history(agent_id, recorded_at)
- Use CREATE TABLE IF NOT EXISTS

- [x] **Task 2**: Update `src/db/agents.js` (rename to `src/db/agent-services.js` to avoid confusion with agents table)
- Create CRUD functions:
  - `createAgentService({ agentId, agentName, skill, price, unit, uptime, avgLatency, x402Endpoint, bazaarUrl, metadata })` → INSERT INTO agent_services
  - `getAgentServiceById(agentId)` → SELECT from agent_services WHERE agent_id=?
  - `getAgentServicesBySkill(skill)` → SELECT from agent_services WHERE skill=? ORDER BY price ASC
  - `updateAgentServicePrice(agentId, price)` → UPDATE agent_services SET price=?, last_updated=NOW() + INSERT INTO agent_service_history
  - `listAllAgentServices()` → SELECT all agent_services
- Use runQuery, getOne, getAll from database.js
- Log all operations with logger.js

### x402 Bazaar Integration (Tasks 3-5)

- [x] **Task 3**: Research x402 Bazaar API
- Read x402 Bazaar documentation (if public API exists)
- Determine endpoint format: `GET /services` or similar
- Document required fields: service name, skill/category, price, agent ID, endpoint URL
- If no public API exists: create mock data structure based on x402 spec
- Write findings to `docs/X402_BAZAAR_API.md`

- [x] **Task 4**: Create `src/crawler/providers/x402-bazaar.js`
- Function `crawlX402Bazaar()`:
  - If public API: fetch from x402 Bazaar API endpoint
  - If no API: use manual data from `data/x402-agents.json` (create this file with 20+ mock agent services)
  - Parse response to ARO format
  - Map x402 skill categories to ARO categories (text-generation, image-generation, etc.)
  - Extract: agentId, agentName, skill, price, unit, x402Endpoint, bazaarUrl
  - Return array: `[{ agentId, agentName, skill, price, unit, ... }]`
- Function `parseX402Metadata(rawMetadata)`:
  - Convert x402 payment format to ARO price format
  - Extract SLA info (uptime, latency) if available
  - Return normalized object
- Error handling: if fetch fails, return empty array (graceful degradation)
- Timeout: 10s per request
- Use native fetch
- Log crawl start/end/errors

- [x] **Task 5**: Update `src/crawler/index.js`
  - Imported x402-bazaar crawler + agent-services CRUD functions
  - Added to crawler list: `{ name: 'x402-bazaar', fn: crawlX402Bazaar, type: 'agent-service' }`
  - Created `insertAgentServices()` function to handle agent services (separate from provider rates)
  - For each agent service: check if exists (by agentId), if price changed → updateAgentServicePrice, if new → createAgentService
  - Logs: "crawler_success" with new_services count, "agent_service_created_new", "agent_service_updated"
  - **Tested:** 24 agent services crawled and inserted successfully (text-gen: 7, image: 4, audio: 3, embeddings: 3, web: 2, vision: 2, data: 2, speech: 1)

### API Endpoints (Tasks 6-8)

- [x] **Task 6**: Create `src/api/agent-services.js`
- Express router
- `GET /v1/agent-services` — list all agent services
  - Query params: `skill` (filter by skill), `sort` (price|rating|uptime, default: price), `order` (asc|desc, default: asc), `limit` (default: 50)
  - Response: `{ success: true, data: [{ agentId, agentName, skill, price, unit, uptime, avgLatency, rating, reviews, ranking }], meta: { total, page, limit } }`
  - Add `ranking` field: 1 = cheapest, 2 = second cheapest, etc.
- `GET /v1/agent-services/:agentId` — get specific agent service details
  - Response: `{ success: true, data: { agentId, agentName, skill, price, unit, uptime, avgLatency, rating, reviews, x402Endpoint, bazaarUrl, priceHistory: [{ price, recordedAt }] } }`
  - Include last 30 days price history from agent_service_history table
- `GET /v1/agent-services/compare` — compare agents for same skill
  - Query param: `skill` (required)
  - Response: `{ success: true, data: { skill, agents: [{ agentId, agentName, price, unit, uptime, avgLatency, rating, ranking, savings }], marketMedian, cheapest, bestValue, meta: { totalAgents, priceRange: { min, max }, avgUptime } } }`
  - `savings`: percentage cheaper than market median
  - `bestValue`: agent with best price+quality combo (score = 50% price + 30% uptime + 20% rating)
  - Sort by ranking (price ASC by default)
- Error responses: 400 (missing params), 404 (not found), 500 (internal error)
- All responses include `meta.timestamp` and `meta.apiVersion`

- [x] **Task 7**: Update `src/api/routes.js`
- Import agentServicesRouter from `./agent-services.js`
- Mount: `router.use('/agent-services', agentServicesRouter)`
- Keep ALL existing routes unchanged
- Test: `curl http://localhost:3402/v1/agent-services` should return 200

- [x] **Task 8**: Update `src/aggregator/index.js`
- Add function `aggregateAgentServiceStats(skill)`:
  - Query all agent_services for given skill
  - Calculate: median price, mean price, min price, max price, std deviation
  - Calculate: avg uptime, avg latency, avg rating
  - Detect outliers using IQR method (same as existing outlier.js)
  - Return: `{ skill, marketMedian, priceRange: { min, max }, avgUptime, outliers: [agentIds] }`
- Export function
- Use in agent-services.js `/compare` endpoint

### SDK Update (Task 9)

- [x] **Task 9**: Update `src/sdk/client.js`
- Add method `async getAgentServices(options = {})`:
  - Options: { skill, sort, order, limit }
  - GET to `/v1/agent-services` with query params
  - Return: response.data
- Add method `async getAgentService(agentId)`:
  - GET to `/v1/agent-services/${agentId}`
  - Return: response.data
- Add method `async compareAgentServices(skill)`:
  - GET to `/v1/agent-services/compare?skill=${skill}`
  - Return: response.data (includes marketMedian, cheapest, bestValue)
- Add JSDoc comments for each method
- Update SDK version in package.json (0.2.0 → 0.3.0)

### Dashboard Update (Tasks 10-11)

- [x] **Task 10**: Update `public/index.html`
- Add new navigation tab: "Agent Marketplace" (between "Smart Router" and existing tabs)
- Create new section `<div id="tab-agent-marketplace" class="tab-content" style="display:none">`
- Sections inside Agent Marketplace tab:
  - **Search bar**: Input for skill + "Search Agents" button
  - **Comparison table**: Shows agents for selected skill (columns: Rank, Agent Name, Price, Unit, Uptime, Latency, Rating, Savings, Action)
  - **Market stats card**: Market median, price range, total agents, avg uptime
  - **Best value highlight**: Green card showing "Best Value" agent (price+quality combo)
  - **Price history chart**: Line chart showing price trends for selected agent (last 30 days)
- Keep ALL existing tabs (Rate Explorer, Smart Router) unchanged
- Style: dark theme, green accents, same as existing UI

- [x] **Task 11**: Update `public/app.js`
- Add function `searchAgentServices(skill)`:
  - Fetch from `/v1/agent-services/compare?skill=${skill}`
  - Render comparison table with data.agents
  - Populate market stats card
  - Highlight best value agent (green border)
  - Add click handler on each agent row → shows price history chart
- Add function `fetchAgentPriceHistory(agentId)`:
  - Fetch from `/v1/agent-services/${agentId}`
  - Extract priceHistory array
  - Render line chart using Chart.js (add to public/index.html if not exists) or custom SVG
  - Show: 30-day price trend, % change, trend direction (up/down/stable)
- Add function `calculateSavings(agentPrice, marketMedian)`:
  - Return: `((marketMedian - agentPrice) / marketMedian * 100).toFixed(1) + '%'`
- Add event listeners: search button click, tab navigation to Agent Marketplace
- Store last search query in localStorage

### Testing & Documentation (Task 12)

- [x] **Task 12**: Create `tests/agent-services.test.js`
- Test CRUD operations:
  - Create agent service → returns ID
  - Get agent service by ID → returns correct data
  - Get agents by skill → returns sorted array (price ASC)
  - Update agent price → price changes + history record inserted
- Test comparison logic:
  - 5 agents same skill → returns sorted by price, correct ranking, correct marketMedian
  - Best value calculation → agent with best price+quality combo wins
  - Outlier detection → very expensive agent marked as outlier
- Test API endpoints:
  - GET /v1/agent-services → 200, returns array
  - GET /v1/agent-services/:agentId → 200, returns agent data
  - GET /v1/agent-services/compare?skill=X → 200, returns comparison with marketMedian
  - GET /v1/agent-services/compare (missing skill) → 400 error
- Mock dependencies: database.js, x402-bazaar.js
- All tests must pass before marking task complete

---

## Phase 2: Real-Time Price Alerts (Tasks 13-22)

**Goal**: Agents subscribe to price drop notifications → webhook/email/WebSocket

### Database Extension (Task 13)

- [x] **Task 13**: Create `src/db/migrations/003-price-alerts.sql`
- Table: `price_alerts` (id INTEGER PRIMARY KEY AUTOINCREMENT, agent_id INTEGER NOT NULL, alert_type TEXT NOT NULL, target_skill TEXT, target_provider TEXT, max_price REAL, notify_method TEXT NOT NULL, webhook_url TEXT, email TEXT, status TEXT DEFAULT 'active', last_triggered DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (agent_id) REFERENCES agents(id))
- Table: `alert_triggers` (id INTEGER PRIMARY KEY AUTOINCREMENT, alert_id INTEGER NOT NULL, old_price REAL NOT NULL, new_price REAL NOT NULL, provider TEXT NOT NULL, skill TEXT NOT NULL, triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP, notified BOOLEAN DEFAULT 0, FOREIGN KEY (alert_id) REFERENCES price_alerts(id))
- Indexes: idx_price_alerts_agent ON price_alerts(agent_id, status), idx_price_alerts_active ON price_alerts(status, alert_type), idx_alert_triggers_alert ON alert_triggers(alert_id, triggered_at)
- alert_type: 'price_drop', 'price_threshold', 'any_change'
- notify_method: 'webhook', 'email', 'websocket'
- status: 'active', 'paused', 'expired'

### Alert Manager (Tasks 14-16)

- [x] **Task 14**: Create `src/alerts/alert-manager.js`
- Function `createAlert({ agentId, alertType, targetSkill, targetProvider, maxPrice, notifyMethod, webhookUrl, email })`:
  - Validate: agentId exists, notifyMethod valid, webhook_url/email provided if needed
  - INSERT INTO price_alerts
  - Return: { id, agentId, alertType, status: 'active' }
- Function `getAlertsByAgent(agentId)`:
  - SELECT from price_alerts WHERE agent_id=? ORDER BY created_at DESC
  - Return: array of alerts
- Function `updateAlertStatus(alertId, status)`:
  - UPDATE price_alerts SET status=? WHERE id=?
  - Valid statuses: 'active', 'paused', 'expired'
- Function `deleteAlert(alertId)`:
  - DELETE FROM price_alerts WHERE id=?
- Use runQuery, getAll, getOne from database.js

- [x] **Task 15**: Create `src/alerts/alert-checker.js`
- Function `checkPriceAlerts()`:
  - Query all active alerts: `SELECT * FROM price_alerts WHERE status='active'`
  - For each alert:
    - If alert_type='price_drop': check if price decreased since last check
    - If alert_type='price_threshold': check if price <= maxPrice
    - If alert_type='any_change': check if price changed at all
  - Query current price from `rates` or `agent_services` table (depends on targetProvider vs targetSkill)
  - If condition met:
    - Call triggerAlert(alert, oldPrice, newPrice)
    - INSERT INTO alert_triggers (alert_id, old_price, new_price, provider, skill, notified=0)
  - Return: { checkedAlerts: count, triggeredAlerts: count }
- Function `triggerAlert(alert, oldPrice, newPrice)`:
  - Determine notify method: webhook / email / websocket
  - Call appropriate notifier
  - Update last_triggered in price_alerts
  - Log trigger: "Alert #X triggered: skill Y price dropped from $A to $B"
- Run every 5 minutes via scheduler

- [x] **Task 16**: Create `src/alerts/notifiers.js`
- Function `sendWebhook(webhookUrl, payload)`:
  - POST to webhookUrl with JSON body
  - Payload: `{ event: 'price_alert', alertId, agentId, skill, provider, oldPrice, newPrice, savings, timestamp }`
  - Timeout: 5s
  - Retry: 1 time if fails
  - Log: success/failure
  - Update alert_triggers: SET notified=1
- Function `sendEmail(email, payload)`:
  - Use nodemailer (add to package.json)
  - Email subject: "ARO Price Alert: [skill] dropped to $[price]"
  - Email body: HTML template with price comparison, savings, link to ARO dashboard
  - SMTP config from .env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
  - Log: sent/failed
- Function `sendWebSocketNotification(agentId, payload)`:
  - If WebSocket server running: broadcast to connected client with agentId
  - Payload: same as webhook
  - If no WebSocket connection: skip (fallback to webhook/email)
- Export all functions

### WebSocket Server (Tasks 17-18)

- [x] **Task 17**: Create `src/gateway/websocket-alerts.js`
- WebSocket server for real-time alerts
- Import `ws` library (add to package.json if not exists)
- Function `initAlertWebSocket(httpServer)`:
  - Create WebSocket server on same port as HTTP (upgrade connection)
  - On connection: client sends `{ type: 'auth', agentId, apiKey }`
  - Validate apiKey using getAgentByKey from db/agents.js
  - If valid: store connection in Map<agentId, WebSocket>
  - Send: `{ type: 'connected', agentId }`
  - On disconnect: remove from Map
- Function `broadcastAlert(agentId, payload)`:
  - Get WebSocket connection for agentId
  - Send JSON: `{ type: 'price_alert', data: payload }`
  - If connection closed: remove from Map
- Export functions
- Call initAlertWebSocket in src/index.js after HTTP server starts

- [x] **Task 18**: Update `src/crawler/scheduler.js`
- Add new cron job: check price alerts every 5 minutes
- Import checkPriceAlerts from alerts/alert-checker.js
- Schedule: `'*/5 * * * *'` (every 5 min)
- On tick: call checkPriceAlerts()
- Log: "Alert checker: checked X alerts, triggered Y"
- Catch errors: if alert check fails, log error but don't crash

### API Endpoints (Tasks 19-20)

- [x] **Task 19**: Create `src/api/alerts.js`
- Express router
- `POST /v1/alerts` — create new alert (requires auth)
  - Body: `{ alertType, targetSkill, targetProvider, maxPrice, notifyMethod, webhookUrl, email }`
  - Validation: alertType enum (price_drop|price_threshold|any_change), notifyMethod enum (webhook|email|websocket)
  - Call createAlert with req.agent.id
  - Response: `{ success: true, data: { id, agentId, alertType, status } }`
- `GET /v1/alerts` — list all alerts for authenticated agent
  - Call getAlertsByAgent(req.agent.id)
  - Response: `{ success: true, data: [{ id, alertType, targetSkill, maxPrice, status, createdAt }] }`
- `PATCH /v1/alerts/:id` — update alert status (active|paused|expired)
  - Body: `{ status }`
  - Call updateAlertStatus(id, status)
  - Check: alert belongs to req.agent.id (authorization)
  - Response: `{ success: true, data: { id, status } }`
- `DELETE /v1/alerts/:id` — delete alert
  - Check: alert belongs to req.agent.id
  - Call deleteAlert(id)
  - Response: `{ success: true, message: 'Alert deleted' }`
- `GET /v1/alerts/:id/history` — get trigger history
  - Query alert_triggers WHERE alert_id=? ORDER BY triggered_at DESC LIMIT 50
  - Response: `{ success: true, data: [{ oldPrice, newPrice, provider, skill, triggeredAt, notified }] }`
- Error handling: 400 (validation), 401 (auth), 403 (not owner), 404 (not found), 500 (internal)

- [x] **Task 20**: Update `src/api/routes.js`
- Import alertsRouter from `./alerts.js`
- Mount with auth: `router.use('/alerts', requireAuth, alertsRouter)`
- Test: POST /v1/alerts with valid API key → 200

### SDK & Dashboard (Tasks 21-22)

- [x] **Task 21**: Update `src/sdk/client.js`
- Add method `async createAlert(options)`:
  - Options: { alertType, targetSkill, targetProvider, maxPrice, notifyMethod, webhookUrl, email }
  - Requires apiKey set in constructor
  - POST to `/v1/alerts`
  - Return: response.data
- Add method `async getAlerts()`:
  - GET to `/v1/alerts`
  - Return: array of alerts
- Add method `async updateAlert(alertId, status)`:
  - PATCH to `/v1/alerts/${alertId}` with body { status }
  - Return: response.data
- Add method `async deleteAlert(alertId)`:
  - DELETE to `/v1/alerts/${alertId}`
  - Return: response.data
- Add method `async connectWebSocket(onAlert)`:
  - Create WebSocket connection to ARO server
  - Send auth message: { type: 'auth', agentId, apiKey }
  - On message type='price_alert': call onAlert(data)
  - Return: WebSocket instance (so user can close it)

- [x] **Task 22**: Update `public/index.html` and `public/app.js`
- Add "Alerts" section to Smart Router tab (or separate tab if too crowded)
- Components:
  - **Create Alert form**: dropdown (skill/provider), input (max price), select (notify method: webhook/email), input (webhook URL or email), "Create Alert" button
  - **Active Alerts table**: columns (Skill/Provider, Max Price, Method, Status, Actions)
  - Actions: Pause/Resume button, Delete button
  - **Alert History**: Shows last 10 triggered alerts (skill, old price → new price, savings, time)
- JavaScript:
  - `createAlert()`: POST to /v1/alerts with form data, refresh table
  - `fetchAlerts()`: GET /v1/alerts, populate table
  - `toggleAlertStatus(alertId, currentStatus)`: PATCH to update status (active ↔ paused)
  - `deleteAlert(alertId)`: DELETE, remove from table
  - `connectWebSocket()`: establish WS connection, show toast notification when alert triggers
- Store alerts in memory (fetch on tab load)

---

## Phase 3: Predictive Pricing (Tasks 23-30)

**Goal**: ML-based price forecasting (7-day forecast with confidence)

### Database Extension (Task 23)

- [x] **Task 23**: Create `src/db/migrations/004-forecast.sql`
- Table: `price_forecasts` (id INTEGER PRIMARY KEY AUTOINCREMENT, skill TEXT NOT NULL, forecast_date DATE NOT NULL, predicted_price REAL NOT NULL, confidence REAL NOT NULL, model_version TEXT, features_used TEXT, generated_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(skill, forecast_date, generated_at))
- Indexes: idx_forecast_skill ON price_forecasts(skill, forecast_date DESC), idx_forecast_date ON price_forecasts(generated_at)
- confidence: 0.0-1.0 (ML model confidence score)
- features_used: JSON string (e.g., '["historical_prices","provider_count","volatility"]')
- model_version: 'prophet_v1', 'arima_v1', etc.

### ML Model Setup (Tasks 24-26)

- [x] **Task 24**: Research time series forecasting libraries
- Evaluate options:
  - **Prophet** (Facebook): easy, handles seasonality, good for sparse data
  - **ARIMA** (statsmodels): classic, good for stationary data
  - **Simple moving average**: baseline (no ML dependencies)
- Decision criteria:
  - Installation complexity (prefer pure JS or lightweight Python)
  - Data requirements (ARO has 6+ months data)
  - Accuracy vs. simplicity tradeoff
- Document findings in `docs/FORECAST_MODEL_RESEARCH.md`
- Recommendation: Start with **Simple Exponential Smoothing** (pure JS, no dependencies), upgrade to Prophet later if needed

- [x] **Task 25**: Create `src/forecast/model.js`
- Function `trainForecastModel(skill)`:
  - Query rate_history for skill: last 180 days (6 months)
  - Prepare data: array of `[{ date, price }]`
  - If using Simple Exponential Smoothing:
    - Calculate alpha (smoothing factor) = 0.3 (or optimize)
    - Apply exponential smoothing formula: S_t = alpha * Y_t + (1-alpha) * S_(t-1)
    - Generate 7-day forecast
  - If using Prophet (future):
    - Install `prophet` npm package (Python wrapper)
    - Train model on historical data
    - Generate forecast with confidence intervals
  - Return: model object (or forecast directly if stateless)
- Function `generateForecast(skill, days = 7)`:
  - Call trainForecastModel(skill)
  - Predict prices for next N days
  - Calculate confidence score:
    - Based on: historical variance, data completeness, model fit
    - Formula: confidence = 1 / (1 + normalized_variance) * dataCompleteness
  - Return: `[{ date, predictedPrice, confidence }]`
- Function `evaluateModelAccuracy(skill)`:
  - Test on last 30 days (actual vs predicted)
  - Calculate MAE (Mean Absolute Error), RMSE
  - Return: { mae, rmse, accuracy: 1 - (mae / meanPrice) }
- Use lightweight math library if needed (add to package.json)

- [x] **Task 26**: Create `src/forecast/scheduler.js`
- Function `generateAllForecasts()`:
  - Query unique skills from rates table
  - For each skill:
    - Call generateForecast(skill, 7)
    - DELETE old forecasts: `DELETE FROM price_forecasts WHERE skill=? AND forecast_date < TODAY`
    - INSERT new forecasts into price_forecasts table
  - Log: "Generated forecasts for X skills"
  - Return: { skills: count, forecastsGenerated: count }
- Schedule: Daily at 2 AM (cron: '0 2 * * *')
- Add to src/crawler/scheduler.js as new cron job
- Catch errors: if forecast generation fails, log error but continue

### API Endpoints (Tasks 27-28)

- [x] **Task 27**: Create `src/api/forecast.js`
- Express router
- `GET /v1/forecast/:skill` — get 7-day price forecast
  - Query price_forecasts WHERE skill=? AND forecast_date >= TODAY ORDER BY forecast_date ASC LIMIT 7
  - If no data: return 503 "Forecast not available yet (check back in 24h)"
  - Calculate trend: 'decreasing', 'stable', 'increasing' (compare predicted prices)
  - Calculate recommendation:
    - If price forecasted to drop >5%: "Wait 3 days for optimal price"
    - If price stable: "Current price is optimal"
    - If price forecasted to rise >5%: "Buy now before price increases"
  - Response: `{ success: true, data: { skill, currentPrice, forecast: [{ date, predictedPrice, confidence }], trend, recommendation, meta: { modelVersion, generatedAt, accuracy } } }`
- `GET /v1/forecast/:skill/accuracy` — get model accuracy metrics
  - Call evaluateModelAccuracy(skill)
  - Response: `{ success: true, data: { mae, rmse, accuracy } }`
- `POST /v1/forecast/generate` — trigger forecast regeneration (admin only, optional auth)
  - Call generateAllForecasts()
  - Response: `{ success: true, data: { skills: count, forecastsGenerated: count } }`
- Error handling: 400 (invalid skill), 404 (skill not found), 503 (forecast not ready), 500 (internal)

- [x] **Task 28**: Update `src/api/routes.js`
- Import forecastRouter from `./forecast.js`
- Mount: `router.use('/forecast', forecastRouter)`
- Test: GET /v1/forecast/text-generation/chat → 200 or 503

### SDK & Dashboard (Tasks 29-30)

- [x] **Task 29**: Update `src/sdk/client.js`
- Add method `async getForecast(skill, days = 7)`:
  - GET to `/v1/forecast/${skill}?days=${days}`
  - Return: response.data (includes forecast array, trend, recommendation)
- Add method `async getForecastAccuracy(skill)`:
  - GET to `/v1/forecast/${skill}/accuracy`
  - Return: { mae, rmse, accuracy }
- Add method `async getForecastStatus()`: GET /v1/forecast/status (system-wide stats)
- Add method `async generateForecasts()`: POST /v1/forecast/generate (manual trigger)
- Update SDK version: 0.3.0 → 0.4.0
- **Tested:** All 4 forecast methods operational, parameter validation working, error handling correct

- [x] **Task 30**: Update `public/index.html` and `public/app.js`
- Add "Price Trends" section to Rate Explorer tab (or Agent Marketplace tab)
- Components:
  - **Skill selector**: Dropdown with all available skills
  - **Forecast chart**: Line chart showing:
    - Historical prices (last 30 days, solid line)
    - Forecasted prices (next 7 days, dashed line)
    - Confidence bands (shaded area, lighter = lower confidence)
  - **Trend indicator**: Arrow (↓ decreasing, → stable, ↑ increasing) with color (green/yellow/red)
  - **Recommendation card**: Text from API (e.g., "Wait 3 days for optimal price ($0.013)")
  - **Model accuracy badge**: Shows "Forecast accuracy: 87%" if available
- JavaScript:
  - `fetchForecast(skill)`: GET /v1/forecast/:skill, render chart
  - `renderForecastChart(data)`: Use Chart.js or custom SVG
    - X-axis: dates (historical + forecast)
    - Y-axis: price
    - Two lines: historical (solid), forecast (dashed)
    - Fill confidence bands using Chart.js fill option
  - `updateTrendIndicator(trend)`: Show arrow + color based on trend
  - Add skill selector change handler → fetch new forecast
- Store last selected skill in localStorage
- **Completed:** 6 functions added (+320 lines JS, +45 lines HTML, +130 lines CSS), custom Canvas chart (no dependencies), Bloomberg-style visualization, full error handling, localStorage persistence. Dashboard fully operational.

---

## Testing & Integration (Final Verification)

### After Each Phase Complete:
1. Run `node -c` syntax check on ALL new files
2. Run `npm test` — all tests must pass (add new tests for each phase)
3. Start server: `npm start` — no errors
4. Test ALL new endpoints with curl
5. Test dashboard: all new UI components work
6. Log cycle summary in CYCLE_LOG.md

### Success Criteria (All 3 Phases Complete):
1. **Phase 1**: GET /v1/agent-services/compare?skill=text-generation returns sorted agent list with marketMedian
2. **Phase 2**: POST /v1/alerts creates alert, price drop triggers webhook/email
3. **Phase 3**: GET /v1/forecast/text-generation/chat returns 7-day forecast with trend
4. **Dashboard**: All 3 features visible and functional
5. **SDK**: All new methods work end-to-end
6. **Database**: All 3 new migration files applied
7. **Existing features**: Still work (rates, providers, stats, compare, smart-route)
8. **Tests**: 100% pass rate

---

## Timeline Estimate

| Phase | Tasks | Estimated Time | Dependencies |
|-------|-------|----------------|--------------|
| Phase 1: Agent Service Comparison | 1-12 | 14 days | None (independent) |
| Phase 2: Real-Time Price Alerts | 13-22 | 21 days | Phase 1 complete (uses agent_services table) |
| Phase 3: Predictive Pricing | 23-30 | 21 days | Phase 1 complete (needs 6+ months data) |
| **Total** | 30 tasks | **56 days** | Phases 2-3 can run parallel if resources available |

---

## Notes for Hustle

### Work Protocol:
1. Read this ROADMAP-v3.md
2. Start with Task 1 (first `[ ]` item)
3. Execute: research → code → test → verify
4. Mark complete: change `[ ]` to `[x]`
5. Log in CYCLE_LOG.md: `## Cycle #X - [timestamp] - [task description]`
6. Move to next task
7. NEVER skip tasks
8. NEVER ask user questions
9. If blocker: document workaround, continue to next task

### Quality Standards:
- Production-grade code (no console.log in production, proper error handling)
- All API responses include timestamp + apiVersion
- All database queries use parameterized queries (SQL injection protection)
- All tests must pass before marking task complete
- Dashboard UI matches existing dark theme + green accents

### File Organization:
- New modules: `src/alerts/`, `src/forecast/`
- Migrations: `src/db/migrations/00X-name.sql`
- Tests: `tests/agent-services.test.js`, `tests/alerts.test.js`, `tests/forecast.test.js`
- Docs: `docs/X402_BAZAAR_API.md`, `docs/FORECAST_MODEL_RESEARCH.md`

### When Done:
- Update README.md with new features
- Update CHANGELOG.md with v3 changes
- Create `ROADMAP-v4.md` for next iteration (if any)
- Celebrate 🎉
