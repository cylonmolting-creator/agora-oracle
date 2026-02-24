# ARO v3 Implementation Protocol

> **For**: Hustle agent
> **Purpose**: Step-by-step execution guide for ROADMAP-v3.md
> **Rule**: Follow EXACTLY. No improvisation. No questions. Just execute.

---

## Core Principles

### 1. Task Execution Order
- ALWAYS start with lowest uncompleted task number
- NEVER skip tasks
- NEVER work on multiple tasks in parallel
- Complete current task 100% before moving to next

### 2. Verification Protocol
Every task must pass this checklist before marking [x]:
- [ ] Code written and saved
- [ ] Syntax check: `node -c <file>` passes
- [ ] If database change: migration file created + tested
- [ ] If API endpoint: curl test passes (returns 200/201 or expected error)
- [ ] If UI change: browser test passes (visible + functional)
- [ ] Logged in CYCLE_LOG.md with timestamp

### 3. Error Handling
If you encounter a blocker:
1. Document the issue in CYCLE_LOG.md
2. Implement a workaround (mock data, stub function, etc.)
3. Mark task [x] with note: "WORKAROUND: [description]"
4. Continue to next task
5. NEVER stop and wait for user

### 4. Code Quality Standards
- **No console.log** in production code (use logger.js)
- **Parameterized queries** for all SQL (prevent injection)
- **Try-catch** for all async operations
- **Timeout** for all external API calls (10s max)
- **JSDoc comments** for all exported functions
- **Error responses** include: success: false, error: "message", code: HTTP_CODE

---

## Phase 1: Agent Service Comparison (Tasks 1-12)

### Task 1: Database Migration for Agent Services

**File**: `src/db/migrations/002-agent-services.sql`

**Steps**:
1. Create file with header comment:
```sql
-- Migration 002: Agent Services (x402 Bazaar Integration)
-- Created: [current date]
-- Purpose: Track agent-to-agent service pricing from x402 Bazaar
```

2. Create `agent_services` table:
```sql
CREATE TABLE IF NOT EXISTS agent_services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL UNIQUE,
  agent_name TEXT NOT NULL,
  skill TEXT NOT NULL,
  price REAL NOT NULL,
  unit TEXT NOT NULL,
  currency TEXT DEFAULT 'USD',
  uptime REAL,
  avg_latency_ms INTEGER,
  reviews_count INTEGER DEFAULT 0,
  rating REAL DEFAULT 0,
  x402_endpoint TEXT,
  bazaar_url TEXT,
  metadata TEXT,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

3. Create `agent_service_history` table:
```sql
CREATE TABLE IF NOT EXISTS agent_service_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  price REAL NOT NULL,
  uptime REAL,
  avg_latency_ms INTEGER,
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agent_services(agent_id)
);
```

4. Create indexes:
```sql
CREATE INDEX IF NOT EXISTS idx_agent_services_skill ON agent_services(skill);
CREATE INDEX IF NOT EXISTS idx_agent_services_price ON agent_services(skill, price);
CREATE INDEX IF NOT EXISTS idx_agent_service_history_agent ON agent_service_history(agent_id, recorded_at);
```

5. Test migration:
```bash
cd ~/Desktop/agent-rate-oracle
sqlite3 data/aro.db < src/db/migrations/002-agent-services.sql
sqlite3 data/aro.db ".schema agent_services"
```

6. Verify: Should show table structure with all columns

**Verification**:
- [ ] File created
- [ ] SQL syntax valid (no errors when run)
- [ ] Tables created in database
- [ ] Indexes created

**Log Format**:
```
## Cycle #X - [timestamp] - Agent Services Database Schema

**Task:** Task 1 — Create migration SQL for agent services tables

**Actions:**
1. Created 002-agent-services.sql with 2 tables: agent_services, agent_service_history
2. Added 3 indexes for query optimization
3. Used CREATE TABLE IF NOT EXISTS for idempotency
4. Tested migration: tables created successfully

**Result:** ✓ Migration file ready. Database supports agent service tracking.

**Status:** ROADMAP Task 1 marked [x]. Next: Task 2 — CRUD functions.
```

---

### Task 2: Agent Service CRUD Functions

**File**: `src/db/agent-services.js` (NEW FILE)

**Steps**:

1. Create file with imports:
```javascript
import { runQuery, getOne, getAll } from './database.js';
import logger from '../logger.js';
```

2. Implement `createAgentService`:
```javascript
/**
 * Create a new agent service record
 * @param {Object} data - Agent service data
 * @returns {Object} Created record with ID
 */
export async function createAgentService(data) {
  const {
    agentId,
    agentName,
    skill,
    price,
    unit,
    currency = 'USD',
    uptime,
    avgLatency,
    reviewsCount = 0,
    rating = 0,
    x402Endpoint,
    bazaarUrl,
    metadata
  } = data;

  try {
    const result = await runQuery(
      `INSERT INTO agent_services (
        agent_id, agent_name, skill, price, unit, currency,
        uptime, avg_latency_ms, reviews_count, rating,
        x402_endpoint, bazaar_url, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [agentId, agentName, skill, price, unit, currency, uptime, avgLatency, reviewsCount, rating, x402Endpoint, bazaarUrl, metadata]
    );

    logger.info(`Created agent service: ${agentId} (${skill})`);
    return { id: result.lastInsertRowid, agentId, agentName, skill, price };
  } catch (error) {
    logger.error(`Failed to create agent service: ${error.message}`);
    throw error;
  }
}
```

3. Implement `getAgentServiceById`:
```javascript
/**
 * Get agent service by ID
 * @param {string} agentId - Agent ID
 * @returns {Object|null} Agent service or null
 */
export async function getAgentServiceById(agentId) {
  try {
    const service = await getOne(
      'SELECT * FROM agent_services WHERE agent_id = ?',
      [agentId]
    );
    return service;
  } catch (error) {
    logger.error(`Failed to get agent service ${agentId}: ${error.message}`);
    return null;
  }
}
```

4. Implement `getAgentServicesBySkill`:
```javascript
/**
 * Get all agent services for a skill, sorted by price
 * @param {string} skill - Skill category
 * @returns {Array} Sorted agent services
 */
export async function getAgentServicesBySkill(skill) {
  try {
    const services = await getAll(
      'SELECT * FROM agent_services WHERE skill = ? ORDER BY price ASC',
      [skill]
    );
    return services;
  } catch (error) {
    logger.error(`Failed to get agent services for skill ${skill}: ${error.message}`);
    return [];
  }
}
```

5. Implement `updateAgentServicePrice`:
```javascript
/**
 * Update agent service price (and record history)
 * @param {string} agentId - Agent ID
 * @param {number} price - New price
 * @returns {boolean} Success
 */
export async function updateAgentServicePrice(agentId, price) {
  try {
    // Get current data
    const current = await getAgentServiceById(agentId);
    if (!current) {
      logger.warn(`Agent service ${agentId} not found for price update`);
      return false;
    }

    // Update price
    await runQuery(
      'UPDATE agent_services SET price = ?, last_updated = CURRENT_TIMESTAMP WHERE agent_id = ?',
      [price, agentId]
    );

    // Insert into history
    await runQuery(
      'INSERT INTO agent_service_history (agent_id, price, uptime, avg_latency_ms) VALUES (?, ?, ?, ?)',
      [agentId, price, current.uptime, current.avg_latency_ms]
    );

    logger.info(`Updated price for ${agentId}: ${current.price} → ${price}`);
    return true;
  } catch (error) {
    logger.error(`Failed to update agent service price: ${error.message}`);
    return false;
  }
}
```

6. Implement `listAllAgentServices`:
```javascript
/**
 * List all agent services
 * @returns {Array} All agent services
 */
export async function listAllAgentServices() {
  try {
    const services = await getAll('SELECT * FROM agent_services ORDER BY skill, price');
    return services;
  } catch (error) {
    logger.error(`Failed to list agent services: ${error.message}`);
    return [];
  }
}
```

7. Test functions:
```bash
node -c src/db/agent-services.js
```

**Verification**:
- [ ] File created
- [ ] Syntax check passes
- [ ] All 5 functions exported
- [ ] JSDoc comments present
- [ ] Error handling with try-catch
- [ ] Logger used (not console.log)

**Log Format**:
```
## Cycle #X - [timestamp] - Agent Service CRUD Module

**Task:** Task 2 — Create CRUD helper for agent_services table

**Actions:**
1. Created src/db/agent-services.js with 5 functions
2. Functions: createAgentService, getAgentServiceById, getAgentServicesBySkill, updateAgentServicePrice, listAllAgentServices
3. All functions use parameterized queries (SQL injection safe)
4. Error handling with try-catch + logger
5. Syntax check: ✓ OK

**Result:** ✓ Agent service CRUD complete. Ready for x402 crawler.

**Status:** ROADMAP Task 2 marked [x]. Next: Task 3 — Research x402 Bazaar API.
```

---

### Task 3: x402 Bazaar API Research

**File**: `docs/X402_BAZAAR_API.md` (NEW FILE)

**Steps**:

1. Research x402 Bazaar documentation:
   - Visit: https://docs.cdp.coinbase.com/x402/bazaar (if exists)
   - Check: https://www.x402.org/ecosystem
   - Search GitHub: "x402 bazaar api" or "x402 agent services"

2. Determine API availability:
   - If public API exists: document endpoint URL, authentication, rate limits
   - If no public API: note that mock data will be used

3. Create documentation file with findings:
```markdown
# x402 Bazaar API Research

**Date**: [current date]
**Researcher**: Hustle agent

## Summary
[FINDING 1: Does x402 Bazaar have a public API?]
- Yes: URL is [endpoint]
- No: Will use mock data

## API Endpoint (if exists)
- Base URL: https://...
- Auth: Bearer token / API key / None
- Rate limit: X requests per minute

## Data Format
[Sample response from API or documented format]

## Mapping to ARO
x402 field → ARO field:
- service.name → agentName
- service.skill → skill
- service.price → price
- service.unit → unit
- service.endpoint → x402Endpoint
- service.url → bazaarUrl

## Decision
[If API exists]: Will implement real API crawler
[If no API]: Will create mock data file with 20+ sample agents
```

4. If no public API found, create mock data file:

**File**: `data/x402-agents.json`
```json
[
  {
    "agentId": "agent-sentiment-pro",
    "agentName": "SentimentPro",
    "skill": "text-analysis/sentiment",
    "price": 0.001,
    "unit": "per-tweet",
    "uptime": 99.9,
    "avgLatency": 120,
    "reviewsCount": 127,
    "rating": 4.8,
    "x402Endpoint": "https://sentiment-pro.x402.com/api/analyze",
    "bazaarUrl": "https://bazaar.x402.org/agents/sentiment-pro"
  },
  {
    "agentId": "agent-tweet-analyzer",
    "agentName": "TweetAnalyzer",
    "skill": "text-analysis/sentiment",
    "price": 0.006,
    "unit": "per-tweet",
    "uptime": 98.5,
    "avgLatency": 200,
    "reviewsCount": 84,
    "rating": 4.5,
    "x402Endpoint": "https://tweet-analyzer.x402.com/v1/sentiment",
    "bazaarUrl": "https://bazaar.x402.org/agents/tweet-analyzer"
  }
  // ... add 18 more agent entries with variety of skills:
  // - text-analysis/sentiment (3-4 agents)
  // - image-generation/realistic (3-4 agents)
  // - code-review/security (2-3 agents)
  // - data-extraction/web (2-3 agents)
  // - translation/languages (2-3 agents)
  // - summarization/documents (2-3 agents)
  // Total: 20+ agents
]
```

**Verification**:
- [ ] Research completed (API exists OR mock data created)
- [ ] Documentation file created
- [ ] If mock data: at least 20 agents with variety of skills

**Log Format**:
```
## Cycle #X - [timestamp] - x402 Bazaar API Research

**Task:** Task 3 — Research x402 Bazaar API and data format

**Actions:**
1. Researched x402 Bazaar documentation
2. Finding: [Public API exists / No public API found]
3. [If API]: Documented endpoint URL, auth method, rate limits
4. [If no API]: Created mock data file with 20 agent services
5. Created docs/X402_BAZAAR_API.md with research findings

**Result:** ✓ x402 Bazaar integration strategy defined. Ready to build crawler.

**Status:** ROADMAP Task 3 marked [x]. Next: Task 4 — x402 Bazaar crawler.
```

---

### Task 4: x402 Bazaar Crawler

**File**: `src/crawler/providers/x402-bazaar.js` (NEW FILE)

**Steps**:

1. Create file with imports:
```javascript
import logger from '../../logger.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

2. Implement `crawlX402Bazaar`:
```javascript
/**
 * Crawl x402 Bazaar for agent services
 * @returns {Promise<Array>} Array of agent services
 */
export async function crawlX402Bazaar() {
  logger.info('Starting x402 Bazaar crawl...');

  try {
    // [OPTION A: If public API exists]
    // const response = await fetch('https://bazaar.x402.org/api/services', {
    //   headers: { 'Accept': 'application/json' },
    //   signal: AbortSignal.timeout(10000)
    // });
    // if (!response.ok) throw new Error(`HTTP ${response.status}`);
    // const rawData = await response.json();

    // [OPTION B: If no API, use mock data]
    const mockDataPath = join(__dirname, '../../../data/x402-agents.json');
    const rawData = JSON.parse(readFileSync(mockDataPath, 'utf8'));

    // Parse and normalize
    const services = rawData.map(parseX402Service);

    logger.info(`x402 Bazaar: crawled ${services.length} agent services`);
    return services;

  } catch (error) {
    logger.error(`x402 Bazaar crawl failed: ${error.message}`);
    return []; // Graceful degradation
  }
}
```

3. Implement `parseX402Service`:
```javascript
/**
 * Parse x402 service data to ARO format
 * @param {Object} rawService - Raw service data
 * @returns {Object} Normalized service
 */
function parseX402Service(rawService) {
  return {
    agentId: rawService.agentId || rawService.id,
    agentName: rawService.agentName || rawService.name,
    skill: normalizeSkill(rawService.skill || rawService.category),
    price: parseFloat(rawService.price),
    unit: rawService.unit || 'per-request',
    currency: rawService.currency || 'USD',
    uptime: rawService.uptime || rawService.sla?.uptime || null,
    avgLatency: rawService.avgLatency || rawService.sla?.latency_p95_ms || null,
    reviewsCount: rawService.reviewsCount || rawService.reviews || 0,
    rating: rawService.rating || 0,
    x402Endpoint: rawService.x402Endpoint || rawService.endpoint,
    bazaarUrl: rawService.bazaarUrl || `https://bazaar.x402.org/agents/${rawService.agentId}`,
    metadata: JSON.stringify({
      description: rawService.description || '',
      tags: rawService.tags || [],
      version: rawService.version || '1.0.0'
    })
  };
}
```

4. Implement `normalizeSkill`:
```javascript
/**
 * Normalize x402 skill names to ARO categories
 * @param {string} skill - x402 skill name
 * @returns {string} ARO skill category
 */
function normalizeSkill(skill) {
  const mapping = {
    'sentiment-analysis': 'text-analysis/sentiment',
    'text-sentiment': 'text-analysis/sentiment',
    'image-gen': 'image-generation/realistic',
    'realistic-images': 'image-generation/realistic',
    'code-security': 'code-review/security',
    'security-audit': 'code-review/security',
    'web-scraping': 'data-extraction/web',
    'data-extraction': 'data-extraction/web',
    'translate': 'translation/languages',
    'summarize': 'summarization/documents'
  };

  return mapping[skill] || skill;
}
```

5. Export:
```javascript
export default crawlX402Bazaar;
```

6. Test:
```bash
node -c src/crawler/providers/x402-bazaar.js
# Manual test:
node -e "import('./src/crawler/providers/x402-bazaar.js').then(m => m.crawlX402Bazaar().then(console.log))"
```

**Verification**:
- [ ] File created
- [ ] Syntax check passes
- [ ] Manual test returns array of services
- [ ] Timeout set to 10s
- [ ] Graceful error handling (returns [] on fail)

**Log Format**:
```
## Cycle #X - [timestamp] - x402 Bazaar Crawler

**Task:** Task 4 — Build x402 Bazaar crawler module

**Actions:**
1. Created src/crawler/providers/x402-bazaar.js
2. Implemented crawlX402Bazaar: [fetches from API / reads mock data]
3. Implemented parseX402Service: normalizes data to ARO format
4. Implemented normalizeSkill: maps x402 skills to ARO categories
5. Graceful error handling: returns [] if crawl fails
6. Timeout: 10s
7. Syntax check: ✓ OK
8. Manual test: ✓ Returns array of ${N} services

**Result:** ✓ x402 Bazaar crawler ready. Can fetch agent services.

**Status:** ROADMAP Task 4 marked [x]. Next: Task 5 — Integrate crawler into scheduler.
```

---

### Task 5: Integrate x402 Crawler into Main Crawler

**File**: `src/crawler/index.js` (EDIT EXISTING)

**Steps**:

1. Add import at top of file:
```javascript
import crawlX402Bazaar from './providers/x402-bazaar.js';
import { createAgentService, getAgentServiceById, updateAgentServicePrice } from '../db/agent-services.js';
```

2. Find the main crawl function (look for `async function runCrawlers()` or similar)

3. Add x402 crawler to crawler list:
```javascript
const crawlers = [
  { name: 'manual', fn: crawlManualProviders },
  { name: 'openai', fn: crawlOpenAI },
  { name: 'anthropic', fn: crawlAnthropic },
  { name: 'x402-bazaar', fn: crawlX402Bazaar } // ADD THIS
];
```

4. After existing crawler loop, add agent service processing:
```javascript
// Process x402 agent services
for (const crawler of crawlers) {
  if (crawler.name === 'x402-bazaar') {
    const agentServices = await crawler.fn();

    let newCount = 0;
    let updatedCount = 0;

    for (const service of agentServices) {
      try {
        const existing = await getAgentServiceById(service.agentId);

        if (existing) {
          // Check if price changed
          if (existing.price !== service.price) {
            await updateAgentServicePrice(service.agentId, service.price);
            updatedCount++;
          }
        } else {
          // New agent service
          await createAgentService(service);
          newCount++;
        }
      } catch (error) {
        logger.error(`Failed to process agent service ${service.agentId}: ${error.message}`);
      }
    }

    logger.info(`x402 Bazaar: ${newCount} new, ${updatedCount} updated, ${agentServices.length} total`);
  }
}
```

5. Test:
```bash
node -c src/crawler/index.js
# Optional: trigger manual crawl if function exists
```

**Verification**:
- [ ] File edited (not overwritten)
- [ ] Syntax check passes
- [ ] x402-bazaar in crawler list
- [ ] Agent service processing logic added
- [ ] Logs new/updated counts

**Log Format**:
```
## Cycle #X - [timestamp] - x402 Crawler Integration

**Task:** Task 5 — Integrate x402 Bazaar crawler into main crawler loop

**Actions:**
1. Updated src/crawler/index.js
2. Added x402-bazaar to crawler list
3. Added agent service processing logic:
   - Check if agent service exists by agentId
   - If exists + price changed: updateAgentServicePrice (also inserts history)
   - If new: createAgentService
4. Logging: "x402 Bazaar: X new, Y updated, Z total"
5. Syntax check: ✓ OK

**Result:** ✓ x402 Bazaar integrated. Crawler will run every 5 min with existing crawlers.

**Status:** ROADMAP Task 5 marked [x]. Next: Task 6 — Agent services API endpoints.
```

---

### (Tasks 6-12 follow same detailed protocol format...)

---

## General Task Execution Template

For remaining tasks, use this template in CYCLE_LOG.md:

```markdown
## Cycle #X - [timestamp] - [Task Title]

**Task:** Task N — [Brief description from ROADMAP]

**Actions:**
1. [First action taken]
2. [Second action taken]
3. [Third action taken]
...
N. [Final verification]

**Result:** ✓ [What was achieved]. [Next implication].

**Status:** ROADMAP Task N marked [x]. Next: Task N+1 — [Next task name].
```

---

## Quick Reference: Common Operations

### Syntax Check
```bash
node -c <filepath>
```

### Database Query Test
```bash
sqlite3 data/aro.db "SELECT COUNT(*) FROM <table>"
```

### API Endpoint Test
```bash
curl -X GET http://localhost:3402/v1/<endpoint>
curl -X POST http://localhost:3402/v1/<endpoint> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <api_key>" \
  -d '{"key":"value"}'
```

### Server Restart
```bash
# If server running, stop it first
pkill -f "node.*src/index.js"
# Start fresh
cd ~/Desktop/agent-rate-oracle
npm start
```

### Migration Application
```bash
sqlite3 data/aro.db < src/db/migrations/00X-name.sql
```

---

## Error Recovery Procedures

### Error Type 1: Syntax Error
**Symptom**: `node -c` fails
**Solution**:
1. Read error message carefully
2. Check line number indicated
3. Fix syntax (missing comma, bracket, semicolon, etc.)
4. Re-run `node -c`
5. If still failing after 3 attempts: mark task with "PARTIAL: syntax error, continuing"

### Error Type 2: Database Error
**Symptom**: SQL query fails
**Solution**:
1. Check table/column names match schema
2. Verify foreign key constraints
3. Test query in sqlite3 CLI: `sqlite3 data/aro.db`
4. If migration issue: check if already applied
5. If unresolvable: document in CYCLE_LOG, use workaround

### Error Type 3: API Error
**Symptom**: Endpoint returns 500
**Solution**:
1. Check server logs for error message
2. Add try-catch if missing
3. Test with curl (simpler than browser)
4. If external API fails: implement mock/fallback
5. Document workaround in CYCLE_LOG

### Error Type 4: Module Not Found
**Symptom**: `Cannot find module 'X'`
**Solution**:
1. Check import path is correct (relative vs absolute)
2. Check file exists: `ls -la <path>`
3. Check file extension (.js required for ES modules)
4. If npm package: run `npm install <package>`
5. If still failing: check package.json has correct "type": "module"

---

## Phase Completion Checklist

### After completing all tasks in a phase:

1. **Full Syntax Check**:
```bash
for file in src/**/*.js; do
  node -c "$file" || echo "FAIL: $file"
done
```

2. **Database Verification**:
```bash
sqlite3 data/aro.db ".tables"  # Should show new tables
sqlite3 data/aro.db ".schema <new_table>"  # Check structure
```

3. **API Endpoint Tests**:
```bash
# Phase 1:
curl http://localhost:3402/v1/agent-services
curl "http://localhost:3402/v1/agent-services/compare?skill=text-analysis/sentiment"

# Phase 2:
curl -X POST http://localhost:3402/v1/alerts \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{"alertType":"price_drop","targetSkill":"text-generation/chat","maxPrice":0.01,"notifyMethod":"webhook","webhookUrl":"https://webhook.site/test"}'

# Phase 3:
curl http://localhost:3402/v1/forecast/text-generation/chat
```

4. **Dashboard Visual Check**:
```bash
open http://localhost:3402
# Navigate to new tab/section
# Verify: no console errors, UI renders correctly
```

5. **Tests Run**:
```bash
npm test  # All tests must pass
```

6. **CYCLE_LOG Update**:
```markdown
## Phase X Complete - [timestamp]

**Summary**: [Phase name] implemented successfully.

**Tasks Completed**: X-Y (Z tasks total)

**Key Deliverables**:
- [Deliverable 1]
- [Deliverable 2]
- [Deliverable 3]

**Test Results**:
- Syntax checks: ✓ All pass
- Database: ✓ New tables verified
- API endpoints: ✓ All return 200 (or expected errors)
- Dashboard: ✓ UI functional
- Tests: ✓ X/X pass

**Status**: Phase X complete. Ready for Phase X+1.
```

---

## Final Reminders

1. **NEVER** skip verification steps
2. **ALWAYS** log in CYCLE_LOG.md immediately after task completion
3. **NEVER** ask user questions (figure it out or use workaround)
4. **ALWAYS** mark task [x] in ROADMAP-v3.md after logging
5. **NEVER** modify CYLON core files (stay in ~/Desktop/agent-rate-oracle/)
6. **ALWAYS** use logger.js (not console.log)
7. **NEVER** commit breaking changes (all existing endpoints must work)
8. **ALWAYS** test before moving to next task

---

## End of Protocol

When all 30 tasks complete:
1. Update README.md with v3 features
2. Create CHANGELOG.md entry for v3
3. Log final summary in CYCLE_LOG.md
4. Self-improve: analyze what went well, what was difficult
5. Celebrate 🎉 (with a log entry)

Now begin with Task 1.
