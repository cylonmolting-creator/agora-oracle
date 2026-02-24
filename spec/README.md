# Agent Pricing Specification (agent-pricing.json)

**Version:** 1.0.0
**Status:** Draft Standard
**Last Updated:** 2026-02-24

---

## Table of Contents

1. [Overview](#overview)
2. [Why This Standard?](#why-this-standard)
3. [Specification Format](#specification-format)
4. [Field Reference](#field-reference)
5. [Pricing Types](#pricing-types)
6. [Dynamic Pricing Factors](#dynamic-pricing-factors)
7. [Payment Protocols](#payment-protocols)
8. [Examples](#examples)
9. [Validation](#validation)
10. [Integration Guide](#integration-guide)

---

## Overview

The **Agent Pricing Specification** is a standardized JSON format for publishing AI agent service pricing, SLAs, payment methods, and reputation data. It enables:

- **Price Discovery:** Agents and orchestrators can automatically find and compare service costs
- **Payment Routing:** Smart routing based on accepted payment protocols and networks
- **SLA Enforcement:** Machine-readable uptime and latency guarantees
- **Dynamic Pricing:** Context-aware pricing based on volume, complexity, or custom factors

This specification is designed to be:
- **Machine-readable:** Parseable by agents and marketplaces
- **Human-readable:** Clear structure for manual inspection
- **Extensible:** Custom fields via `dynamicFactors` and `metadata`
- **Crypto-native:** First-class support for blockchain payments (Ethereum, Polygon, Solana, Base, etc.)

---

## Why This Standard?

The agent economy has **5 critical gaps** that prevent seamless A2A (Agent-to-Agent) commerce:

### The 5 Gaps

1. **No Standard Pricing Format**
   - **Problem:** Every provider uses different pricing pages, APIs, and formats
   - **Impact:** Agents can't automatically discover or compare costs
   - **Solution:** `agent-pricing.json` provides uniform structure

2. **A2A AgentCard Has No Pricing**
   - **Problem:** AgentCard spec (credentials, capabilities) doesn't include pricing
   - **Impact:** Discovery works but agents can't decide if they can afford a service
   - **Solution:** This spec extends AgentCard with pricing data

3. **x402 Has No Discovery**
   - **Problem:** x402 payment protocol handles transactions but not price discovery
   - **Impact:** Agents know *how* to pay but not *what* to pay
   - **Solution:** `agent-pricing.json` + x402 = complete commerce stack

4. **No Machine-Readable SLAs**
   - **Problem:** Uptime guarantees and latency limits are in legal PDFs
   - **Impact:** Agents can't programmatically choose providers based on performance needs
   - **Solution:** `sla` object with uptime, latency_p95_ms, rate_limit

5. **No Dynamic Pricing Standards**
   - **Problem:** Pricing varies by language, volume, quality — but no standard format
   - **Impact:** Agents can't predict actual costs or optimize for budget
   - **Solution:** `dynamicFactors` and `volumeDiscounts` arrays

### What This Enables

With `agent-pricing.json`:
- **Agent Marketplaces** can aggregate pricing from 1000s of providers
- **Orchestrators** can auto-select cheapest/fastest providers
- **Payment Routers** can match providers with user payment methods
- **Analytics Tools** can track pricing trends and anomalies
- **SLA Monitors** can verify providers meet their guarantees

---

## Specification Format

An `agent-pricing.json` file is a JSON document with this top-level structure:

```json
{
  "version": "1.0.0",
  "agentId": "unique-agent-identifier",
  "provider": { ... },
  "updated": "2026-02-24T00:00:00Z",
  "currency": "USD",
  "services": [ ... ],
  "metadata": { ... }
}
```

### File Location

Providers should host this file at:
- **Root domain:** `https://example.com/agent-pricing.json`
- **Well-known URI:** `https://example.com/.well-known/agent-pricing.json`
- **Via AgentCard:** Link in `pricingUrl` field of A2A AgentCard

---

## Field Reference

### Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | ✅ | Spec version (semver, e.g., "1.0.0") |
| `agentId` | string | ✅ | Unique identifier for this agent/service |
| `provider` | object | ✅ | Provider information (see below) |
| `updated` | string | ✅ | ISO 8601 timestamp of last pricing update |
| `currency` | string | ✅ | Default currency (ISO 4217 or crypto symbol) |
| `services` | array | ✅ | List of offered services (see below) |
| `metadata` | object | ❌ | Custom metadata (tags, regions, etc.) |

### Provider Object

```json
{
  "provider": {
    "name": "Company Name",
    "type": "llm",
    "url": "https://example.com",
    "contact": {
      "email": "api@example.com",
      "support": "https://example.com/support"
    }
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Provider name |
| `type` | enum | ✅ | `llm`, `agent`, `tool`, `service` |
| `url` | string | ✅ | Provider homepage URL |
| `contact` | object | ❌ | Contact info (email, support URL, etc.) |

### Service Object

Each service in the `services[]` array represents a distinct capability:

```json
{
  "skill": "text-translation",
  "pricing": { ... },
  "sla": { ... },
  "payment": { ... },
  "reputation": { ... },
  "dynamicFactors": { ... }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `skill` | string | ✅ | Capability identifier (e.g., "text-translation", "code-review") |
| `pricing` | object | ✅ | Pricing details (see [Pricing Types](#pricing-types)) |
| `sla` | object | ❌ | SLA guarantees (uptime, latency, rate limits) |
| `payment` | object | ❌ | Accepted payment methods and networks |
| `reputation` | object | ❌ | Trust signals (score, reviews, success rate) |
| `dynamicFactors` | object | ❌ | Custom pricing modifiers (see [Dynamic Pricing](#dynamic-pricing-factors)) |

---

## Pricing Types

The `pricing.type` field determines how costs are calculated. Supported types:

### 1. **per-request**
Fixed price per API call or transaction.

```json
{
  "type": "per-request",
  "base": 0.02,
  "unit": "request",
  "currency": "USD"
}
```

**Use cases:** Translation APIs, simple API calls, single-shot tasks

### 2. **per-token**
Price per input/output token (common for LLMs).

```json
{
  "type": "per-token",
  "inputPrice": 0.000003,
  "outputPrice": 0.000015,
  "unit": "token",
  "currency": "USD"
}
```

**Use cases:** GPT-4, Claude, LLaMA APIs

### 3. **per-minute**
Price per minute of compute/usage.

```json
{
  "type": "per-minute",
  "base": 0.10,
  "unit": "minute",
  "currency": "USD"
}
```

**Use cases:** Voice calls, video processing, long-running agents

### 4. **per-second**
Price per second (more granular than per-minute).

```json
{
  "type": "per-second",
  "base": 0.0016,
  "unit": "second",
  "currency": "USD"
}
```

**Use cases:** Real-time voice/video, GPU compute

### 5. **per-hour**
Price per hour of usage.

```json
{
  "type": "per-hour",
  "base": 5.00,
  "unit": "hour",
  "currency": "USD"
}
```

**Use cases:** Dedicated agents, long-running tasks, consulting

### 6. **per-image**
Fixed price per generated/processed image.

```json
{
  "type": "per-image",
  "base": 0.05,
  "unit": "image",
  "currency": "USD"
}
```

**Use cases:** DALL-E, Midjourney, Stable Diffusion APIs

### 7. **per-mb**
Price per megabyte of data processed/transferred.

```json
{
  "type": "per-mb",
  "base": 0.0001,
  "unit": "mb",
  "currency": "USD"
}
```

**Use cases:** File processing, video transcoding, data pipelines

### 8. **flat-rate**
Single fixed price for unlimited usage within a time window.

```json
{
  "type": "flat-rate",
  "base": 99.00,
  "unit": "month",
  "currency": "USD"
}
```

**Use cases:** Monthly subscriptions, unlimited plans

### 9. **subscription**
Recurring payment with included quota.

```json
{
  "type": "subscription",
  "base": 49.00,
  "unit": "month",
  "currency": "USD",
  "includedQuota": 10000,
  "overageRate": 0.005
}
```

**Use cases:** SaaS plans, tiered subscriptions

---

## Dynamic Pricing Factors

The `dynamicFactors` object allows custom pricing modifiers based on request parameters.

### Structure

```json
{
  "dynamicFactors": {
    "factorName": {
      "options": {
        "value1": 1.0,
        "value2": 1.5,
        "value3": 2.0
      },
      "description": "Human-readable description"
    }
  }
}
```

### Example: Language Pair Pricing

```json
{
  "dynamicFactors": {
    "languagePair": {
      "options": {
        "en-es": 1.0,
        "en-fr": 1.0,
        "en-ja": 1.5,
        "en-ar": 2.0,
        "ja-ar": 2.5
      },
      "description": "Multiplier based on source-target language pair complexity"
    }
  }
}
```

**Calculation:** Final price = `base × languagePair multiplier × volumeDiscount`

### Common Dynamic Factors

- **Language pairs:** Translation complexity (1.0x - 2.5x)
- **Quality tiers:** Standard vs. premium output (0.7x - 2.5x)
- **Urgency:** Standard vs. rush delivery (1.0x - 3.0x)
- **Depth:** Shallow vs. deep analysis (1.0x - 2.5x)
- **Resolution:** Image/video resolution (1.0x - 8.0x)
- **Framework:** Code framework analysis (1.0x - 1.5x)

---

## Payment Protocols

The `payment` object specifies how the provider accepts payment.

### Structure

```json
{
  "payment": {
    "protocols": ["stripe", "x402", "crypto", "invoice"],
    "networks": ["ethereum", "polygon", "base", "arbitrum", "solana"],
    "tokens": ["USDC", "USDT", "ETH", "SOL"],
    "invoicing": {
      "terms": "net-30",
      "minimum": 1000
    }
  }
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `protocols` | array | Accepted payment methods (stripe, x402, crypto, invoice, etc.) |
| `networks` | array | Supported blockchain networks |
| `tokens` | array | Accepted cryptocurrency tokens |
| `invoicing` | object | Invoice terms (net-30, net-60, minimum amounts) |

### Common Protocols

- **stripe:** Credit card via Stripe
- **x402:** HTTP 402 payment protocol (crypto-native)
- **crypto:** Direct blockchain payments
- **invoice:** Traditional invoicing (net-30, net-60)
- **paypal:** PayPal payments
- **wire:** Bank wire transfers

---

## Examples

### Example 1: Text Translation Service

```json
{
  "version": "1.0.0",
  "agentId": "lingua-flow-ai-translation",
  "provider": {
    "name": "LinguaFlow AI",
    "type": "agent",
    "url": "https://linguaflow.example"
  },
  "updated": "2026-02-24T00:00:00Z",
  "currency": "USD",
  "services": [
    {
      "skill": "text-translation",
      "pricing": {
        "type": "per-request",
        "base": 0.02,
        "unit": "request",
        "currency": "USD",
        "volumeDiscounts": [
          {"minVolume": 1000, "price": 0.018},
          {"minVolume": 10000, "price": 0.015}
        ]
      },
      "dynamicFactors": {
        "languagePair": {
          "options": {
            "en-es": 1.0,
            "en-ja": 1.5,
            "en-ar": 2.0
          }
        }
      },
      "sla": {
        "latency_p95_ms": 250,
        "uptime": 0.9995
      },
      "payment": {
        "protocols": ["stripe", "crypto"],
        "networks": ["ethereum", "polygon"],
        "tokens": ["USDC", "USDT"]
      }
    }
  ]
}
```

### Example 2: Code Review Service

```json
{
  "version": "1.0.0",
  "agentId": "codeguardian-review",
  "provider": {
    "name": "CodeGuardian AI",
    "type": "agent",
    "url": "https://codeguardian.example"
  },
  "updated": "2026-02-24T00:00:00Z",
  "currency": "USD",
  "services": [
    {
      "skill": "code-review",
      "pricing": {
        "type": "per-token",
        "inputPrice": 0.000008,
        "outputPrice": 0.000015,
        "unit": "token",
        "currency": "USD"
      },
      "dynamicFactors": {
        "depth": {
          "options": {
            "basic": 1.0,
            "standard": 1.5,
            "comprehensive": 2.5
          }
        }
      },
      "sla": {
        "latency_p95_ms": 3000,
        "uptime": 0.999
      },
      "payment": {
        "protocols": ["x402", "stripe"],
        "networks": ["base", "polygon"],
        "tokens": ["USDC"]
      }
    }
  ]
}
```

### Example 3: Image Generation Service

```json
{
  "version": "1.0.0",
  "agentId": "pixelforge-studio",
  "provider": {
    "name": "PixelForge Studio",
    "type": "tool",
    "url": "https://pixelforge.example"
  },
  "updated": "2026-02-24T00:00:00Z",
  "currency": "USD",
  "services": [
    {
      "skill": "image-generation",
      "pricing": {
        "type": "per-image",
        "base": 0.05,
        "unit": "image",
        "currency": "USD"
      },
      "dynamicFactors": {
        "resolution": {
          "options": {
            "512x512": 1.0,
            "1024x1024": 2.0,
            "2048x2048": 4.0
          }
        },
        "quality": {
          "options": {
            "draft": 0.7,
            "standard": 1.0,
            "hd": 1.5,
            "ultra": 2.5
          }
        }
      },
      "sla": {
        "latency_p95_ms": 8000,
        "uptime": 0.998
      },
      "payment": {
        "protocols": ["stripe", "crypto"],
        "networks": ["ethereum", "solana"],
        "tokens": ["USDC", "ETH", "SOL"]
      }
    }
  ]
}
```

---

## Validation

Use the JSON Schema at `spec/agent-pricing.schema.json` to validate your pricing files.

### Using Ajv (Node.js)

```javascript
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'fs';

const ajv = new Ajv();
addFormats(ajv);

const schema = JSON.parse(fs.readFileSync('./spec/agent-pricing.schema.json', 'utf8'));
const data = JSON.parse(fs.readFileSync('./agent-pricing.json', 'utf8'));

const validate = ajv.compile(schema);
const valid = validate(data);

if (!valid) {
  console.error('Validation errors:', validate.errors);
} else {
  console.log('✅ Valid agent-pricing.json');
}
```

### Online Validator

Use any JSON Schema validator (e.g., [jsonschemavalidator.net](https://www.jsonschemavalidator.net/)) with the draft-07 schema.

---

## Integration Guide

### For Service Providers

1. **Create your agent-pricing.json file** using this spec
2. **Host it at** `https://yourdomain.com/agent-pricing.json`
3. **Validate it** against the JSON Schema
4. **Update regularly** (set `updated` timestamp)
5. **Link it in your AgentCard** (`pricingUrl` field)

### For Agent Marketplaces

1. **Crawl agent-pricing.json files** from known providers
2. **Validate** against schema
3. **Store in database** for search/comparison
4. **Refresh periodically** (check `updated` field)
5. **Aggregate and display** pricing data

### For Agent Orchestrators

1. **Fetch agent-pricing.json** for each candidate service
2. **Calculate total cost** using `pricing` + `dynamicFactors` + `volumeDiscounts`
3. **Check payment compatibility** (`payment.protocols` and `networks`)
4. **Verify SLA requirements** (`sla.uptime`, `sla.latency_p95_ms`)
5. **Select optimal provider** based on cost + SLA + payment match

### For Payment Routers

1. **Parse `payment` object** to get supported protocols/networks
2. **Match user's payment method** with provider's accepted methods
3. **Route payment** through compatible network (Ethereum, Polygon, etc.)
4. **Handle x402 402-Payment-Required** responses with pricing data

---

## Versioning

This specification follows semantic versioning:
- **Major version** (1.x.x): Breaking changes to required fields or structure
- **Minor version** (x.1.x): New optional fields or pricing types
- **Patch version** (x.x.1): Clarifications or examples

Current version: **1.0.0** (Draft Standard)

---

## Contributing

Feedback and proposals for this spec are welcome:
- **GitHub Issues:** [agent-rate-oracle/issues](https://github.com/yourorg/agent-rate-oracle/issues)
- **Email:** spec@agent-rate-oracle.org

---

## License

This specification is released under **CC0 1.0 Universal** (Public Domain).

Providers and implementers are free to adopt and extend this format without restrictions.

---

## Related Standards

- **A2A AgentCard:** Agent capability discovery (no pricing)
- **x402 Payment Protocol:** HTTP 402-based payment flows (no price discovery)
- **OpenAPI/Swagger:** API documentation (no standardized pricing format)
- **JSON Schema:** Validation framework (draft-07)

This spec bridges the gap between discovery (AgentCard) and payment (x402).

---

**End of Specification**
