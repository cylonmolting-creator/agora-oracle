/**
 * Forecast Model - Simple Exponential Smoothing (SES)
 *
 * Implements time series forecasting for AI API pricing using Simple Exponential Smoothing.
 * Pure JavaScript implementation (zero dependencies) for fast, transparent predictions.
 *
 * Algorithm: S_t = α × Y_t + (1-α) × S_(t-1)
 * - S_t: Smoothed value at time t
 * - Y_t: Observed value at time t
 * - α: Smoothing factor (0.3 = balanced between reactive and stable)
 *
 * Use case: 7-day price forecasts with confidence scores for AGORA dashboard
 */

import { getAll } from '../db/database.js';
import logger from '../logger.js';

/**
 * Fetch historical prices for a skill from rate_history table
 * @param {string} skill - Target skill (e.g., 'text-generation/chat')
 * @param {number} days - Number of days to fetch (default 180 = 6 months)
 * @returns {Promise<Array<{date: string, price: number}>>} Historical price data
 */
export async function getHistoricalPrices(skill, days = 180) {
  try {
    // Join with services table to get category (skill)
    // If skill has slash (e.g., 'text-generation/chat'), match category + subcategory
    // If no slash, match just category
    const skillParts = skill.split('/');
    const category = skillParts[0];
    const subcategory = skillParts[1] || null;

    let query, params;

    if (subcategory) {
      // Match both category and subcategory
      query = `
        SELECT
          DATE(rh.recorded_at) as date,
          AVG(rh.price) as price
        FROM rate_history rh
        JOIN services s ON rh.service_id = s.id
        WHERE s.category = ?
          AND s.subcategory = ?
          AND rh.recorded_at >= DATE('now', '-${days} days')
        GROUP BY DATE(rh.recorded_at)
        ORDER BY date ASC
      `;
      params = [category, subcategory];
    } else {
      // Match just category
      query = `
        SELECT
          DATE(rh.recorded_at) as date,
          AVG(rh.price) as price
        FROM rate_history rh
        JOIN services s ON rh.service_id = s.id
        WHERE s.category = ?
          AND rh.recorded_at >= DATE('now', '-${days} days')
        GROUP BY DATE(rh.recorded_at)
        ORDER BY date ASC
      `;
      params = [category];
    }

    const rows = await getAll(query, params);

    // Convert to array of {date, price} objects
    const historicalData = rows.map(row => ({
      date: row.date,
      price: row.price
    }));

    logger.info('historical_prices_fetched', {
      skill,
      days,
      dataPoints: historicalData.length,
      dateRange: historicalData.length > 0
        ? `${historicalData[0].date} to ${historicalData[historicalData.length - 1].date}`
        : 'no data'
    });

    return historicalData;
  } catch (error) {
    logger.error('fetch_historical_prices_failed', {
      skill,
      days,
      error: error.message
    });
    throw error;
  }
}

/**
 * Simple Exponential Smoothing (SES) algorithm
 * @param {Array<{date: string, price: number}>} historicalData - Historical prices
 * @param {number} alpha - Smoothing factor (0.1-0.5, default 0.3)
 * @returns {number} Final smoothed price (used as forecast baseline)
 */
export function simpleExponentialSmoothing(historicalData, alpha = 0.3) {
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
 * Calculate confidence score for forecast
 * Based on: data variance (lower = more confident), data completeness, and time decay
 * @param {Array<{date: string, price: number}>} historicalData - Historical prices
 * @param {number} dayAhead - Days ahead to forecast (1-7)
 * @param {number} expectedDays - Expected number of data points (default 180)
 * @returns {number} Confidence score (0.0-1.0, where 1.0 = 100% confident)
 */
export function calculateConfidence(historicalData, dayAhead = 1, expectedDays = 180) {
  if (!historicalData || historicalData.length === 0) {
    return 0.0; // No data = no confidence
  }

  const prices = historicalData.map(d => d.price);

  // Calculate mean and variance
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((acc, p) => acc + (p - mean) ** 2, 0) / prices.length;
  const stddev = Math.sqrt(variance);

  // Coefficient of Variation (CV): normalized measure of dispersion
  // Lower CV = more stable prices = higher confidence
  const coefficientOfVariation = stddev / mean;

  // Data completeness: actual points / expected points
  const dataCompleteness = Math.min(historicalData.length / expectedDays, 1.0);

  // Time decay: confidence decreases as we forecast further ahead
  // 0.95^1 = 0.95 (day 1), 0.95^7 = 0.70 (day 7)
  const timeDecayFactor = Math.pow(0.95, dayAhead);

  // Combined confidence score
  const baseConfidence = 1 / (1 + coefficientOfVariation); // 0.0-1.0 range
  const confidence = baseConfidence * dataCompleteness * timeDecayFactor;

  return Math.min(confidence, 1.0); // Cap at 1.0
}

/**
 * Train forecast model and generate predictions
 * @param {string} skill - Target skill (e.g., 'text-generation/chat')
 * @param {number} days - Number of days to forecast (default 7)
 * @returns {Promise<Array<{date: string, predictedPrice: number, confidence: number}>>}
 */
export async function trainForecastModel(skill, days = 7) {
  try {
    logger.info('training_forecast_model', { skill, days });

    // Step 1: Fetch 180 days of historical data
    const historicalData = await getHistoricalPrices(skill, 180);

    if (historicalData.length === 0) {
      logger.warn('no_historical_data_for_forecast', { skill });
      return []; // Cannot forecast without data
    }

    // Step 2: Train SES model (get smoothed price)
    const smoothedPrice = simpleExponentialSmoothing(historicalData, 0.3);

    // Step 3: Generate forecasts for next N days
    const forecasts = [];
    const today = new Date();

    for (let i = 1; i <= days; i++) {
      const forecastDate = new Date(today);
      forecastDate.setDate(today.getDate() + i);

      // Calculate confidence for this day ahead
      const confidence = calculateConfidence(historicalData, i, 180);

      forecasts.push({
        date: forecastDate.toISOString().split('T')[0], // YYYY-MM-DD
        predictedPrice: smoothedPrice,
        confidence: parseFloat(confidence.toFixed(3)) // Round to 3 decimals
      });
    }

    logger.info('forecast_model_trained', {
      skill,
      days,
      smoothedPrice: smoothedPrice.toFixed(6),
      avgConfidence: (forecasts.reduce((acc, f) => acc + f.confidence, 0) / forecasts.length).toFixed(3),
      dataPoints: historicalData.length
    });

    return forecasts;
  } catch (error) {
    logger.error('train_forecast_model_failed', {
      skill,
      days,
      error: error.message
    });
    throw error;
  }
}

/**
 * Generate forecast with trend detection
 * Enhanced version that detects linear trends and adjusts forecast accordingly
 * @param {string} skill - Target skill
 * @param {number} days - Number of days to forecast (default 7)
 * @returns {Promise<{
 *   skill: string,
 *   forecasts: Array<{date: string, predictedPrice: number, confidence: number}>,
 *   trend: 'increasing'|'decreasing'|'stable',
 *   trendStrength: number
 * }>}
 */
export async function generateForecast(skill, days = 7) {
  try {
    logger.info('generating_forecast', { skill, days });

    // Step 1: Fetch historical data
    const historicalData = await getHistoricalPrices(skill, 180);

    if (historicalData.length === 0) {
      return {
        skill,
        forecasts: [],
        trend: 'stable',
        trendStrength: 0,
        error: 'No historical data available'
      };
    }

    // Step 2: Detect linear trend using least squares regression
    const n = historicalData.length;
    const xValues = historicalData.map((_, i) => i); // [0, 1, 2, ..., n-1]
    const yValues = historicalData.map(d => d.price);

    const xMean = xValues.reduce((a, b) => a + b, 0) / n;
    const yMean = yValues.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (xValues[i] - xMean) * (yValues[i] - yMean);
      denominator += (xValues[i] - xMean) ** 2;
    }

    const slope = denominator !== 0 ? numerator / denominator : 0; // Price change per day
    const intercept = yMean - slope * xMean;

    // Step 3: Determine trend direction and strength
    const avgPrice = yMean;
    const trendStrength = Math.abs(slope / avgPrice); // Normalized slope (% change per day)

    let trend = 'stable';
    if (slope > 0.0001 * avgPrice) trend = 'increasing'; // >0.01% per day
    else if (slope < -0.0001 * avgPrice) trend = 'decreasing'; // <-0.01% per day

    // Step 4: Train SES model
    const smoothedPrice = simpleExponentialSmoothing(historicalData, 0.3);

    // Step 5: Generate forecasts with trend adjustment
    const forecasts = [];
    const today = new Date();

    for (let i = 1; i <= days; i++) {
      const forecastDate = new Date(today);
      forecastDate.setDate(today.getDate() + i);

      // Apply trend: predicted price = smoothed price + (slope × days ahead)
      const trendAdjustment = slope * i;
      const predictedPrice = smoothedPrice + trendAdjustment;

      // Calculate confidence
      const confidence = calculateConfidence(historicalData, i, 180);

      forecasts.push({
        date: forecastDate.toISOString().split('T')[0],
        predictedPrice: Math.max(predictedPrice, 0.0001), // Prevent negative prices
        confidence: parseFloat(confidence.toFixed(3))
      });
    }

    logger.info('forecast_generated', {
      skill,
      days,
      trend,
      trendStrength: trendStrength.toFixed(6),
      slope: slope.toFixed(8),
      avgConfidence: (forecasts.reduce((acc, f) => acc + f.confidence, 0) / forecasts.length).toFixed(3)
    });

    return {
      skill,
      forecasts,
      trend,
      trendStrength: parseFloat(trendStrength.toFixed(6))
    };
  } catch (error) {
    logger.error('generate_forecast_failed', {
      skill,
      days,
      error: error.message
    });
    throw error;
  }
}

/**
 * Evaluate model accuracy using backtesting
 * Tests forecast on last 30 days (actual vs predicted)
 * @param {string} skill - Target skill
 * @returns {Promise<{mae: number, rmse: number, accuracy: number, testDays: number}>}
 */
export async function evaluateModelAccuracy(skill) {
  try {
    logger.info('evaluating_model_accuracy', { skill });

    // Fetch last 210 days (180 for training + 30 for testing)
    const allData = await getHistoricalPrices(skill, 210);

    if (allData.length < 60) {
      // Need at least 60 days to do meaningful backtest
      return {
        mae: null,
        rmse: null,
        accuracy: null,
        testDays: allData.length,
        error: 'Insufficient data for backtesting (need 60+ days)'
      };
    }

    // Split: first 80% for training, last 20% for testing
    const splitIndex = Math.floor(allData.length * 0.8);
    const trainData = allData.slice(0, splitIndex);
    const testData = allData.slice(splitIndex);

    // Train model on training data
    const smoothedPrice = simpleExponentialSmoothing(trainData, 0.3);

    // Calculate errors
    let sumAbsoluteError = 0;
    let sumSquaredError = 0;

    for (const testPoint of testData) {
      const actualPrice = testPoint.price;
      const predictedPrice = smoothedPrice; // SES produces flat forecast
      const error = actualPrice - predictedPrice;

      sumAbsoluteError += Math.abs(error);
      sumSquaredError += error ** 2;
    }

    const mae = sumAbsoluteError / testData.length; // Mean Absolute Error
    const rmse = Math.sqrt(sumSquaredError / testData.length); // Root Mean Squared Error

    // Accuracy: 1 - (MAE / mean price)
    const meanPrice = testData.reduce((acc, d) => acc + d.price, 0) / testData.length;
    const accuracy = Math.max(0, 1 - (mae / meanPrice)); // 0.0-1.0 range

    logger.info('model_accuracy_evaluated', {
      skill,
      mae: mae.toFixed(6),
      rmse: rmse.toFixed(6),
      accuracy: (accuracy * 100).toFixed(2) + '%',
      testDays: testData.length,
      trainDays: trainData.length
    });

    return {
      mae: parseFloat(mae.toFixed(6)),
      rmse: parseFloat(rmse.toFixed(6)),
      accuracy: parseFloat(accuracy.toFixed(3)),
      testDays: testData.length
    };
  } catch (error) {
    logger.error('evaluate_model_accuracy_failed', {
      skill,
      error: error.message
    });
    throw error;
  }
}
