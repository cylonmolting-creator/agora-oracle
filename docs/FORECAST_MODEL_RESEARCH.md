# Time Series Forecasting Model Research

**Date:** 2026-02-24
**Author:** Hustle (ARO Development Agent)
**Purpose:** Evaluate forecasting libraries for ARO Phase 3 (Predictive Pricing)

---

## Requirements

ARO needs to forecast AI API prices for **7 days ahead** with:
- **Input data**: 6+ months of historical pricing (rate_history table)
- **Output**: Daily price predictions with confidence scores
- **Constraints**:
  - Must run in Node.js environment (Express.js server)
  - Must be lightweight (no massive dependencies)
  - Must handle sparse/irregular data (some providers update weekly)
  - Must run daily via cron (performance matters)
  - Must provide confidence intervals (not just point estimates)

---

## Option 1: Prophet (Facebook)

**Website:** https://facebook.github.io/prophet/
**Language:** Python (with Node.js wrapper possible via child_process)

### Pros:
- ✅ Built for time series with seasonality (handles weekly/monthly patterns)
- ✅ Robust to missing data and outliers (perfect for API pricing)
- ✅ Automatic trend detection (detects price drops/increases)
- ✅ Confidence intervals built-in (uncertainty quantification)
- ✅ Industry-proven (Facebook, Uber, Airbnb use it)

### Cons:
- ❌ Requires Python installation (adds deployment complexity)
- ❌ Node.js → Python interop overhead (child_process or REST API)
- ❌ Large dependency tree (pandas, numpy, pystan)
- ❌ Slow training (30s-2min for 6 months data)
- ❌ Overkill for simple price trends (designed for complex seasonality)

### Verdict:
**Not recommended for ARO v3.0** — too heavy, requires Python. Consider for v4.0 if accuracy demands it.

---

## Option 2: ARIMA (AutoRegressive Integrated Moving Average)

**Library:** `arima` (npm: https://www.npmjs.com/package/arima)
**Language:** Pure JavaScript

### Pros:
- ✅ Classic time series method (well-understood theory)
- ✅ Good for stationary data (prices after detrending)
- ✅ Lightweight npm package (~50KB)
- ✅ No Python dependency
- ✅ Fast training (1-5s for 180 days)

### Cons:
- ❌ Requires manual parameter tuning (p, d, q parameters)
- ❌ Assumes data stationarity (AI pricing is non-stationary)
- ❌ Poor with sparse/missing data (requires interpolation)
- ❌ No built-in confidence intervals in npm package
- ❌ Steep learning curve (requires time series expertise)

### Verdict:
**Not recommended for ARO v3.0** — too complex to tune, fragile with sparse data. Better suited for financial markets (dense, regular data).

---

## Option 3: Simple Exponential Smoothing (SES)

**Library:** None needed (implement from scratch in ~50 lines)
**Language:** Pure JavaScript

### Pros:
- ✅ Dead simple algorithm (weighted moving average)
- ✅ Zero dependencies (pure math, no npm packages)
- ✅ Fast computation (<100ms for 180 days)
- ✅ Handles sparse data gracefully (just skips missing points)
- ✅ Proven for short-term forecasting (1-7 days ahead)
- ✅ Easy to explain (transparent model, no black box)
- ✅ Confidence calculation straightforward (based on historical variance)

### Cons:
- ❌ No seasonality detection (assumes smooth trends)
- ❌ Less accurate than Prophet for complex patterns
- ❌ No automatic trend detection (manual drift parameter)
- ❌ Confidence intervals are naive (based on variance, not model fit)

### Formula:
```
S_t = α × Y_t + (1 - α) × S_(t-1)

Where:
- S_t = smoothed value at time t
- Y_t = observed value at time t
- α = smoothing factor (0.1-0.5, higher = more reactive)
```

### Forecast:
```
Forecast(t+1) = S_t
Forecast(t+2) = S_t (flat forecast for all future points)
```

### Confidence:
```
confidence = 1 / (1 + normalized_variance) × dataCompleteness

Where:
- normalized_variance = stddev / mean (coefficient of variation)
- dataCompleteness = actualPoints / expectedPoints
```

### Verdict:
**RECOMMENDED for ARO v3.0** — perfect balance of simplicity and effectiveness. No dependencies, fast, transparent. Upgrade to Prophet later if accuracy demands it.

---

## Option 4: Holt-Winters (Triple Exponential Smoothing)

**Library:** `hw-exponential-smoothing` (npm)
**Language:** JavaScript

### Pros:
- ✅ Handles trend + seasonality (better than simple SES)
- ✅ Lightweight npm package (~20KB)
- ✅ Fast training (~500ms for 180 days)
- ✅ Predictable results (no random initialization)

### Cons:
- ❌ Requires at least 2 full seasonal cycles (need 2+ years data for yearly seasonality)
- ❌ AI pricing has no clear seasonality (not like retail sales)
- ❌ More complex than SES (3 parameters: α, β, γ)
- ❌ Overkill for 7-day forecasts

### Verdict:
**Not needed for ARO v3.0** — AI pricing doesn't have strong seasonality. SES is sufficient.

---

## Decision: Simple Exponential Smoothing (SES)

**Chosen model:** Simple Exponential Smoothing (pure JavaScript implementation)

### Rationale:
1. **Zero dependencies** → Easier deployment, no version conflicts
2. **Fast** → <100ms training, can run for 30+ skills in seconds
3. **Transparent** → Users understand "weighted average of recent prices"
4. **Sufficient accuracy** → 7-day forecasts don't need complex models
5. **Upgradeable** → If SES isn't accurate enough, we can swap to Prophet later (API stays same)

### Implementation Plan:
- File: `src/forecast/model.js`
- Functions:
  - `trainForecastModel(skill)` — train SES on 180-day rate_history
  - `generateForecast(skill, days=7)` — predict next N days
  - `calculateConfidence(historicalData)` — compute confidence score
  - `evaluateModelAccuracy(skill)` — test on last 30 days (MAE, RMSE)
- Parameters:
  - α (alpha) = 0.3 (smoothing factor, can tune based on accuracy)
  - Drift adjustment = optional linear trend detection

### Expected Accuracy:
- **Near-term (1-3 days)**: 85-92% accuracy (high confidence)
- **Mid-term (4-5 days)**: 75-85% accuracy (medium confidence)
- **Far-term (6-7 days)**: 65-75% accuracy (lower confidence)

(Accuracy measured as: 1 - (MAE / mean price))

### Upgrade Path (Future):
- If accuracy < 70% for 3-day forecast → upgrade to Holt-Winters (add trend parameter)
- If accuracy < 70% even with Holt-Winters → upgrade to Prophet (Python bridge)
- If Prophet too slow → consider TensorFlow.js LSTM (advanced neural network)

---

## Code Example: SES Implementation

```javascript
/**
 * Simple Exponential Smoothing (SES) forecaster
 * @param {Array<{date: string, price: number}>} historicalData - 180 days of prices
 * @param {number} alpha - Smoothing factor (0.1-0.5, default 0.3)
 * @returns {number} smoothedValue - Final smoothed price (used as forecast)
 */
function simpleExponentialSmoothing(historicalData, alpha = 0.3) {
  if (!historicalData || historicalData.length === 0) {
    throw new Error('Historical data required for SES');
  }

  // Initialize with first observed value
  let smoothed = historicalData[0].price;

  // Apply smoothing recursively: S_t = α × Y_t + (1-α) × S_(t-1)
  for (let i = 1; i < historicalData.length; i++) {
    const observed = historicalData[i].price;
    smoothed = alpha * observed + (1 - alpha) * smoothed;
  }

  return smoothed;
}

/**
 * Generate 7-day forecast using SES
 * @param {string} skill - Target skill (e.g., 'text-generation/chat')
 * @param {number} days - Number of days to forecast (default 7)
 * @returns {Array<{date: string, predictedPrice: number, confidence: number}>}
 */
async function generateForecast(skill, days = 7) {
  // Step 1: Fetch 180 days of historical data
  const historicalData = await getHistoricalPrices(skill, 180);

  // Step 2: Train SES model
  const smoothedPrice = simpleExponentialSmoothing(historicalData, 0.3);

  // Step 3: Calculate confidence based on variance
  const prices = historicalData.map(d => d.price);
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((acc, p) => acc + (p - mean) ** 2, 0) / prices.length;
  const coefficientOfVariation = Math.sqrt(variance) / mean;
  const dataCompleteness = historicalData.length / 180; // expected 180 days
  const baseConfidence = 1 / (1 + coefficientOfVariation) * dataCompleteness;

  // Step 4: Generate forecasts (flat forecast for simplicity)
  const forecasts = [];
  for (let i = 1; i <= days; i++) {
    const forecastDate = new Date();
    forecastDate.setDate(forecastDate.getDate() + i);

    // Confidence decays with time (0.95^i decay factor)
    const timeDecayFactor = Math.pow(0.95, i);
    const confidence = baseConfidence * timeDecayFactor;

    forecasts.push({
      date: forecastDate.toISOString().split('T')[0],
      predictedPrice: smoothedPrice,
      confidence: Math.min(confidence, 1.0) // cap at 1.0
    });
  }

  return forecasts;
}
```

---

## Testing Plan

1. **Backtesting**: Test SES on last 30 days (actual vs predicted)
   - Calculate MAE, RMSE
   - Target: MAE < 10% of mean price

2. **Visual validation**: Plot historical + forecast in dashboard
   - Users should see "reasonable" trends (no wild jumps)

3. **Confidence calibration**: Compare predicted confidence to actual accuracy
   - If confidence=0.9 but accuracy=0.6 → recalibrate formula

4. **A/B test** (future): Run SES + Prophet in parallel, compare accuracy

---

## Conclusion

**Decision:** Implement Simple Exponential Smoothing in pure JavaScript.

**Next steps:**
- Task 25: Implement `src/forecast/model.js` (SES + confidence calculation)
- Task 26: Implement `src/forecast/scheduler.js` (daily cron job)
- Task 27: Create `/v1/forecast/:skill` API endpoint
- Task 28-30: SDK + Dashboard integration

**Success metric:** 7-day forecast with confidence >0.7 for top 10 skills within 7 days of launch.
