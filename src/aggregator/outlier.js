/**
 * Outlier Detection using Interquartile Range (IQR) method
 *
 * Detects and removes price outliers from rate data.
 * Uses the standard IQR method: values beyond Q1 - 1.5*IQR or Q3 + 1.5*IQR are outliers.
 */

/**
 * Calculate quartiles (Q1, Q2/median, Q3) from sorted array
 * @param {number[]} sorted - Sorted array of numbers
 * @returns {{q1: number, median: number, q3: number}}
 */
function calculateQuartiles(sorted) {
  const n = sorted.length;

  if (n === 0) {
    return { q1: 0, median: 0, q3: 0 };
  }

  if (n === 1) {
    return { q1: sorted[0], median: sorted[0], q3: sorted[0] };
  }

  // Median (Q2)
  const medianIndex = Math.floor(n / 2);
  const median = n % 2 === 0
    ? (sorted[medianIndex - 1] + sorted[medianIndex]) / 2
    : sorted[medianIndex];

  // Q1 (median of lower half)
  const lowerHalf = n % 2 === 0
    ? sorted.slice(0, medianIndex)
    : sorted.slice(0, medianIndex);
  const q1Index = Math.floor(lowerHalf.length / 2);
  const q1 = lowerHalf.length % 2 === 0 && lowerHalf.length > 1
    ? (lowerHalf[q1Index - 1] + lowerHalf[q1Index]) / 2
    : lowerHalf[q1Index] || sorted[0];

  // Q3 (median of upper half)
  const upperHalf = n % 2 === 0
    ? sorted.slice(medianIndex)
    : sorted.slice(medianIndex + 1);
  const q3Index = Math.floor(upperHalf.length / 2);
  const q3 = upperHalf.length % 2 === 0 && upperHalf.length > 1
    ? (upperHalf[q3Index - 1] + upperHalf[q3Index]) / 2
    : upperHalf[q3Index] || sorted[n - 1];

  return { q1, median, q3 };
}

/**
 * Detect outliers using IQR method
 *
 * @param {Array<{price: number, source: string}>} rates - Array of rate objects
 * @returns {{filtered: Array, removed: Array, method: string, stats: Object}}
 */
export function detectOutliers(rates) {
  // Input validation
  if (!Array.isArray(rates) || rates.length === 0) {
    return {
      filtered: [],
      removed: [],
      method: 'iqr',
      stats: {
        total: 0,
        kept: 0,
        removed: 0,
        q1: 0,
        median: 0,
        q3: 0,
        iqr: 0,
        lowerBound: 0,
        upperBound: 0
      }
    };
  }

  // If only 1 or 2 rates, no outliers possible
  if (rates.length <= 2) {
    return {
      filtered: [...rates],
      removed: [],
      method: 'iqr',
      stats: {
        total: rates.length,
        kept: rates.length,
        removed: 0,
        q1: rates[0]?.price || 0,
        median: rates[0]?.price || 0,
        q3: rates[rates.length - 1]?.price || 0,
        iqr: 0,
        lowerBound: 0,
        upperBound: Infinity
      }
    };
  }

  // Extract and sort prices
  const prices = rates.map(r => r.price);
  const sortedPrices = [...prices].sort((a, b) => a - b);

  // Calculate quartiles
  const { q1, median, q3 } = calculateQuartiles(sortedPrices);

  // Calculate IQR and bounds
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  // Separate filtered and outliers
  const filtered = [];
  const removed = [];

  rates.forEach(rate => {
    if (rate.price >= lowerBound && rate.price <= upperBound) {
      filtered.push(rate);
    } else {
      removed.push(rate);
    }
  });

  return {
    filtered,
    removed,
    method: 'iqr',
    stats: {
      total: rates.length,
      kept: filtered.length,
      removed: removed.length,
      q1,
      median,
      q3,
      iqr,
      lowerBound,
      upperBound
    }
  };
}

export default detectOutliers;
