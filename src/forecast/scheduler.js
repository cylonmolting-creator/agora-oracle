/**
 * Forecast Scheduler
 *
 * Generates daily price forecasts for all skills and stores them in the database.
 * Runs as a cron job (daily at 2 AM UTC).
 */

import { generateForecast } from './model.js';
import { getAll, runQuery } from '../db/database.js';
import logger from '../logger.js';

/**
 * Generate forecasts for all skills in the database
 * Deletes old forecasts and inserts new 7-day predictions
 * @returns {Promise<{skills: number, forecastsGenerated: number, errors: Array}>}
 */
export async function generateAllForecasts() {
  const startTime = Date.now();
  logger.info('forecast_generation_started', { timestamp: new Date().toISOString() });

  let skillsProcessed = 0;
  let totalForecasts = 0;
  const errors = [];

  try {
    // Get all unique skills (categories) from services table
    const skillsQuery = `
      SELECT DISTINCT category as skill
      FROM services
      WHERE category IS NOT NULL
      ORDER BY category ASC
    `;

    const skills = await getAll(skillsQuery, []);

    if (!skills || skills.length === 0) {
      logger.warn('forecast_no_skills_found', { message: 'No skills found in database' });
      return { skills: 0, forecastsGenerated: 0, errors: [] };
    }

    logger.info('forecast_skills_discovered', { count: skills.length, skills: skills.map(s => s.skill) });

    // Process each skill
    for (const { skill } of skills) {
      try {
        // Generate 7-day forecast (returns object with forecasts array + trend info)
        const result = await generateForecast(skill, 7);

        if (!result || !result.forecasts || result.forecasts.length === 0) {
          logger.warn('forecast_generation_empty', { skill, message: 'No forecast data generated' });
          continue;
        }

        const forecasts = result.forecasts; // Extract forecasts array

        // Delete old forecasts for this skill (keep only current forecasts)
        // Delete forecasts with forecast_date < today OR very old generated_at
        const deleteQuery = `
          DELETE FROM price_forecasts
          WHERE skill = ?
            AND (
              forecast_date < DATE('now')
              OR generated_at < DATETIME('now', '-7 days')
            )
        `;
        await runQuery(deleteQuery, [skill]);

        // Insert new forecasts
        const insertQuery = `
          INSERT INTO price_forecasts (
            skill,
            forecast_date,
            predicted_price,
            confidence,
            model_version,
            features_used,
            generated_at
          ) VALUES (?, ?, ?, ?, ?, ?, DATETIME('now'))
        `;

        let insertedCount = 0;
        for (const forecast of forecasts) {
          try {
            await runQuery(insertQuery, [
              skill,
              forecast.date, // Format: YYYY-MM-DD
              forecast.predictedPrice,
              forecast.confidence,
              'ses_v1', // Simple Exponential Smoothing v1
              JSON.stringify(['historical_prices', 'exponential_smoothing', 'trend_adjustment'])
            ]);
            insertedCount++;
          } catch (insertError) {
            // Handle unique constraint violation (duplicate forecast for same skill+date)
            if (insertError.message.includes('UNIQUE constraint failed')) {
              logger.debug('forecast_duplicate_skipped', { skill, date: forecast.date });
            } else {
              throw insertError;
            }
          }
        }

        totalForecasts += insertedCount;
        skillsProcessed++;

        logger.info('forecast_skill_complete', {
          skill,
          forecastsInserted: insertedCount,
          trend: result.trend || 'unknown',
          trendStrength: result.trendStrength || 0
        });

      } catch (skillError) {
        logger.error(`forecast_skill_failed: ${skillError.message}`, { skill });
        errors.push({ skill, error: skillError.message });
        // Continue to next skill (don't stop entire batch)
      }
    }

    const duration = Date.now() - startTime;
    logger.info('forecast_generation_complete', {
      duration: `${duration}ms`,
      skillsProcessed,
      totalForecasts,
      errorCount: errors.length
    });

    return {
      skills: skillsProcessed,
      forecastsGenerated: totalForecasts,
      errors
    };

  } catch (error) {
    logger.error(`forecast_generation_failed: ${error.message}`);
    throw error;
  }
}

/**
 * Get forecast generation status
 * @returns {Promise<Object>} Status information
 */
export async function getForecastStatus() {
  try {
    // Get count of forecasts by skill
    const query = `
      SELECT
        skill,
        COUNT(*) as forecast_count,
        MIN(forecast_date) as earliest_date,
        MAX(forecast_date) as latest_date,
        MAX(generated_at) as last_generated
      FROM price_forecasts
      WHERE forecast_date >= DATE('now')
      GROUP BY skill
      ORDER BY last_generated DESC
    `;

    const forecasts = await getAll(query, []);

    return {
      totalSkills: forecasts.length,
      totalForecasts: forecasts.reduce((sum, f) => sum + f.forecast_count, 0),
      skills: forecasts
    };

  } catch (error) {
    logger.error(`forecast_status_failed: ${error.message}`);
    return {
      totalSkills: 0,
      totalForecasts: 0,
      skills: []
    };
  }
}
