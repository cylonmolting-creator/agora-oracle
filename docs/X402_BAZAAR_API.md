# x402 Bazaar API Documentation

> **ARO Integration Research**
> **Date**: 2026-02-24
> **Status**: API research + mock data structure

---

## Executive Summary

**Finding**: x402 Bazaar public API documentation is limited. The protocol is open-source, but the Bazaar service directory is likely centralized with gated API access.

**ARO Approach**:
- **Phase 1** (Current): Use mock data structure based on x402 spec + ecosystem analysis
- **Phase 2** (Future): Direct API integration when Bazaar opens public endpoints or via partnership

---

## 1. x402 Bazaar Overview

### What is x402 Bazaar?

**Purpose**: Machine-readable API/service discovery directory for AI agents

**Key Features**:
- Service metadata (endpoint, category, pricing)
- Payment information (x402 format: amount, currency, recipient wallet)
- SLA data (uptime, latency) if available
- Agent identity (AgentCard integration)

**Target Users**: AI agents looking for services to consume

### x402 Bazaar vs ARO

| Component | x402 Bazaar | ARO |
|-----------|-------------|-----|
| **Service Discovery** | ✅ Lists services | ❌ Not our role |
| **Price Metadata** | ✅ Shows individual price | ❌ Not aggregated |
| **Market Intelligence** | ❌ No comparison | ✅ Median, range, trends |
| **Historical Data** | ❌ Current only | ✅ 30-day history |
| **Confidence Scoring** | ❌ No trust signal | ✅ Outlier detection |

**Conclusion**: x402 Bazaar = Yellow Pages, ARO = Consumer Reports

---

## 2. Expected x402 Bazaar API Format

### Hypothetical Endpoint

```
GET https://bazaar.x402.org/api/services
GET https://bazaar.x402.org/api/services/:serviceId
GET https://bazaar.x402.org/api/services?category=text-generation
```

### Expected Response Format

```json
{
  "services": [
    {
      "serviceId": "srv_abc123",
      "agentId": "agent_xyz789",
      "agentName": "DeepSeek Text Pro",
      "category": "text-generation",
      "skill": "chat",
      "endpoint": "https://api.deepseek.com/v1/chat",
      "x402": {
        "payment": {
          "amount": "0.01",
          "currency": "USDC",
          "unit": "per_1k_tokens",
          "recipient": "0x1234...5678",
          "chain": "solana"
        }
      },
      "sla": {
        "uptime": 0.998,
        "avgLatencyMs": 250,
        "rateLimit": "10000/hour"
      },
      "metadata": {
        "description": "Fast and cheap text generation",
        "maxTokens": 4096,
        "models": ["deepseek-chat", "deepseek-coder"],
        "verified": true
      },
      "agentCard": {
        "reputation": 4.8,
        "reviewsCount": 120,
        "uptime30d": 0.996
      },
      "bazaarUrl": "https://bazaar.x402.org/services/srv_abc123",
      "createdAt": "2026-01-15T10:00:00Z",
      "lastUpdated": "2026-02-24T08:30:00Z"
    }
  ],
  "meta": {
    "total": 1240,
    "page": 1,
    "limit": 50
  }
}
```

---

## 3. ARO Mapping Strategy

### x402 Bazaar → ARO Schema Mapping

| x402 Bazaar Field | ARO Field | Transformation |
|-------------------|-----------|----------------|
| `serviceId` | `agent_id` | Direct copy |
| `agentName` | `agent_name` | Direct copy |
| `category` + `skill` | `skill` | Concatenate: "text-generation/chat" |
| `x402.payment.amount` | `price` | Parse float |
| `x402.payment.unit` | `unit` | Direct copy or normalize |
| `sla.uptime` | `uptime` | Direct copy (0.0-1.0) |
| `sla.avgLatencyMs` | `avg_latency_ms` | Direct copy |
| `agentCard.reputation` | `rating` | Direct copy |
| `agentCard.reviewsCount` | `reviews_count` | Direct copy |
| `endpoint` | `x402_endpoint` | Direct copy |
| `bazaarUrl` | `bazaar_url` | Direct copy |
| `metadata` | `metadata` | JSON.stringify |

### ARO Category Normalization

x402 Bazaar may use different category names. ARO normalizes to standard categories:

| x402 Category | ARO Category | ARO Subcategory |
|---------------|--------------|-----------------|
| `text-generation` | `text-generation` | `chat`, `completion`, `code` |
| `image-generation` | `image-generation` | `standard`, `hd`, `edit` |
| `embeddings` | `embeddings` | `text`, `multimodal` |
| `audio-transcription` | `audio` | `transcription`, `translation` |
| `video-processing` | `video` | `analysis`, `generation` |
| `data-analysis` | `data` | `analysis`, `extraction` |
| `web-scraping` | `web` | `scraping`, `crawling` |

---

## 4. Mock Data Structure

### For Phase 1 Testing

Since x402 Bazaar public API is not yet confirmed, ARO will use **mock data** for initial development and testing.

**File**: `data/x402-agents.json`

```json
{
  "version": "1.0",
  "lastUpdated": "2026-02-24T10:00:00Z",
  "source": "x402-bazaar-mock",
  "agents": [
    {
      "agentId": "agent_deepseek_chat",
      "agentName": "DeepSeek Chat Pro",
      "skill": "text-generation/chat",
      "price": 0.01,
      "unit": "per_1k_tokens",
      "currency": "USDC",
      "uptime": 0.998,
      "avgLatency": 250,
      "rating": 4.8,
      "reviews": 120,
      "x402Endpoint": "https://api.deepseek.com/v1/chat",
      "bazaarUrl": "https://bazaar.x402.org/agents/deepseek_chat",
      "metadata": {
        "chain": "solana",
        "verified": true
      }
    },
    {
      "agentId": "agent_anthropic_haiku",
      "agentName": "Claude Haiku Service",
      "skill": "text-generation/chat",
      "price": 0.015,
      "unit": "per_1k_tokens",
      "currency": "USDC",
      "uptime": 0.999,
      "avgLatency": 180,
      "rating": 4.9,
      "reviews": 340,
      "x402Endpoint": "https://api.anthropic.com/v1/messages",
      "bazaarUrl": "https://bazaar.x402.org/agents/anthropic_haiku",
      "metadata": {
        "chain": "ethereum",
        "verified": true
      }
    },
    {
      "agentId": "agent_openai_gpt4o_mini",
      "agentName": "OpenAI GPT-4o-mini Service",
      "skill": "text-generation/chat",
      "price": 0.025,
      "unit": "per_1k_tokens",
      "currency": "USDC",
      "uptime": 0.997,
      "avgLatency": 220,
      "rating": 4.7,
      "reviews": 890,
      "x402Endpoint": "https://api.openai.com/v1/chat/completions",
      "bazaarUrl": "https://bazaar.x402.org/agents/openai_gpt4o_mini",
      "metadata": {
        "chain": "base",
        "verified": true
      }
    },
    {
      "agentId": "agent_stable_diffusion",
      "agentName": "Stable Diffusion XL",
      "skill": "image-generation/standard",
      "price": 0.02,
      "unit": "per_image",
      "currency": "USDC",
      "uptime": 0.995,
      "avgLatency": 3500,
      "rating": 4.6,
      "reviews": 450,
      "x402Endpoint": "https://api.stability.ai/v1/generation",
      "bazaarUrl": "https://bazaar.x402.org/agents/stable_diffusion_xl",
      "metadata": {
        "chain": "solana",
        "verified": true
      }
    },
    {
      "agentId": "agent_whisper_transcribe",
      "agentName": "Whisper Transcription",
      "skill": "audio/transcription",
      "price": 0.006,
      "unit": "per_minute",
      "currency": "USDC",
      "uptime": 0.996,
      "avgLatency": 1200,
      "rating": 4.5,
      "reviews": 230,
      "x402Endpoint": "https://api.openai.com/v1/audio/transcriptions",
      "bazaarUrl": "https://bazaar.x402.org/agents/whisper",
      "metadata": {
        "chain": "ethereum",
        "verified": true
      }
    }
  ]
}
```

**Notes**:
- 20+ agents across multiple skills (text, image, audio, embeddings)
- Prices vary to enable comparison testing
- Realistic SLA data (uptime 99.5-99.9%, latency 100-3500ms)
- Reviews + ratings for quality scoring

---

## 5. ARO Crawler Implementation Plan

### File: `src/crawler/providers/x402-bazaar.js`

**Strategy**:
1. **Check for live API**: Try fetching from `https://bazaar.x402.org/api/services`
2. **Fallback to mock data**: If API unavailable, read from `data/x402-agents.json`
3. **Parse response**: Normalize to ARO format
4. **Return array**: `[{ agentId, agentName, skill, price, ... }]`

### Implementation Phases

**Phase 1: Mock Data** (Current)
- Read `data/x402-agents.json`
- Parse to ARO format
- Insert into `agent_services` table
- Enable testing without API dependency

**Phase 2: Live API** (When available)
- Fetch from x402 Bazaar API
- Handle pagination (50 per page)
- Map categories to ARO format
- Rate limit: 10 req/min (respectful crawling)

**Phase 3: Partnership** (If x402 Foundation partnership succeeds)
- Direct database sync (no HTTP crawling)
- Real-time webhook updates
- ARO metadata injection into Bazaar

---

## 6. Data Refresh Strategy

### Crawl Frequency

| Data Type | Frequency | Reason |
|-----------|-----------|--------|
| **Agent list** | 1 hour | New agents added infrequently |
| **Price updates** | 5 minutes | Prices can change, need real-time |
| **SLA metrics** | 15 minutes | Uptime/latency change gradually |
| **Reviews/ratings** | 1 hour | Social signals update slowly |

### Database Operations

**On crawl**:
1. Fetch x402 Bazaar data (API or mock)
2. For each agent:
   - Check if `agent_id` exists in `agent_services`
   - If **NEW**: `createAgentService()` → INSERT
   - If **EXISTS** and price changed: `updateAgentServicePrice()` → UPDATE + history
   - If **EXISTS** and no change: Skip
3. Log: "x402 Bazaar: 120 agents, 5 new, 12 price updates"

**Price history tracking**:
- Every price change → INSERT into `agent_service_history`
- Keep 30 days history (auto-delete older via cron)
- Enable 30-day price trend charts

---

## 7. API Endpoint Design

### GET /v1/agent-services

**Purpose**: List all agent services (x402 Bazaar data)

**Query Params**:
- `skill` (optional): Filter by skill (e.g., `text-generation/chat`)
- `sort` (optional): `price`, `rating`, `uptime` (default: `price`)
- `order` (optional): `asc`, `desc` (default: `asc`)
- `limit` (optional): Max results (default: 50, max: 200)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "agentId": "agent_deepseek_chat",
      "agentName": "DeepSeek Chat Pro",
      "skill": "text-generation/chat",
      "price": 0.01,
      "unit": "per_1k_tokens",
      "uptime": 0.998,
      "avgLatency": 250,
      "rating": 4.8,
      "reviews": 120,
      "ranking": 1
    }
  ],
  "meta": {
    "total": 120,
    "limit": 50,
    "timestamp": "2026-02-24T10:09:20Z",
    "apiVersion": "1.0"
  }
}
```

### GET /v1/agent-services/:agentId

**Purpose**: Get specific agent details + price history

**Response**:
```json
{
  "success": true,
  "data": {
    "agentId": "agent_deepseek_chat",
    "agentName": "DeepSeek Chat Pro",
    "skill": "text-generation/chat",
    "price": 0.01,
    "unit": "per_1k_tokens",
    "uptime": 0.998,
    "avgLatency": 250,
    "rating": 4.8,
    "reviews": 120,
    "x402Endpoint": "https://api.deepseek.com/v1/chat",
    "bazaarUrl": "https://bazaar.x402.org/agents/deepseek_chat",
    "priceHistory": [
      { "price": 0.01, "recordedAt": "2026-02-24T08:00:00Z" },
      { "price": 0.012, "recordedAt": "2026-02-20T10:00:00Z" },
      { "price": 0.015, "recordedAt": "2026-02-15T09:00:00Z" }
    ]
  },
  "meta": {
    "timestamp": "2026-02-24T10:09:20Z"
  }
}
```

### GET /v1/agent-services/compare?skill=text-generation/chat

**Purpose**: Compare all agents for same skill (like Kayak.com)

**Response**:
```json
{
  "success": true,
  "data": {
    "skill": "text-generation/chat",
    "agents": [
      {
        "agentId": "agent_deepseek_chat",
        "agentName": "DeepSeek Chat Pro",
        "price": 0.01,
        "unit": "per_1k_tokens",
        "uptime": 0.998,
        "avgLatency": 250,
        "rating": 4.8,
        "ranking": 1,
        "savings": "60%"
      },
      {
        "agentId": "agent_anthropic_haiku",
        "agentName": "Claude Haiku Service",
        "price": 0.015,
        "ranking": 2,
        "savings": "40%"
      },
      {
        "agentId": "agent_openai_gpt4o_mini",
        "agentName": "OpenAI GPT-4o-mini",
        "price": 0.025,
        "ranking": 3,
        "savings": "0%"
      }
    ],
    "marketMedian": 0.015,
    "cheapest": {
      "agentId": "agent_deepseek_chat",
      "price": 0.01
    },
    "bestValue": {
      "agentId": "agent_anthropic_haiku",
      "score": 0.92,
      "reason": "Best price+quality combo"
    },
    "meta": {
      "totalAgents": 3,
      "priceRange": { "min": 0.01, "max": 0.025 },
      "avgUptime": 0.998
    }
  }
}
```

---

## 8. Next Steps

### Immediate (Task 3 - Current)
- ✅ Document x402 Bazaar API format (this file)
- ⏭️ Create `data/x402-agents.json` with 20+ mock agents (Task 4)
- ⏭️ Create `src/crawler/providers/x402-bazaar.js` (Task 4)

### Short-term (Phase 1)
- Implement API endpoints (Tasks 6-7)
- Update dashboard with Agent Marketplace tab (Tasks 10-11)
- Test full comparison flow

### Long-term (Phase 2)
- x402 Foundation partnership outreach
- Live x402 Bazaar API integration (when available)
- Real-time webhook sync

---

## 9. References

**x402 Protocol**:
- [x402.org Official](https://www.x402.org)
- [x402 Bazaar Launch](https://www.mexc.com/news/92906)
- [Building x402 APIs](https://dev.to/chadbot0x/building-x402-apis-from-scratch-how-i-made-ai-agents-pay-for-data-48jp)

**ARO Strategy**:
- `X402-INTEGRATION.md` (this repo)
- ROADMAP-v3.md Phase 1

---

**Status**: Task 3 COMPLETE ✅
**Next**: Task 4 — Create x402-bazaar.js crawler
