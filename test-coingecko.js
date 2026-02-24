import dotenv from 'dotenv';
import db from './src/db/database.js';
import CoinGeckoCollector from './src/collectors/coingecko.js';
import aggregator from './src/aggregators/price-aggregator.js';
import logger from './src/utils/logger.js';

dotenv.config();

(async () => {
  try {
    logger.info('=== ARO CoinGecko Test ===');

    await db.initialize();
    logger.info('Database ready');

    const collector = new CoinGeckoCollector(process.env.COINGECKO_API_KEY);

    logger.info('Fetching prices...');
    const prices = await collector.fetchPrices(['bitcoin', 'ethereum', 'solana']);

    if (prices.length === 0) {
      logger.error('No prices fetched!');
      process.exit(1);
    }

    logger.info(`Fetched ${prices.length} prices`);

    logger.info('Running aggregation...');
    const aggregated = aggregator.aggregateAll(['BITCOIN', 'ETHEREUM', 'SOLANA']);

    logger.info(`Aggregated ${aggregated.length} symbols`);

    for (const agg of aggregated) {
      console.log(`\n${agg.symbol}:`);
      console.log(`  Avg: $${agg.avgPrice.toFixed(2)}`);
      console.log(`  Median: $${agg.medianPrice.toFixed(2)}`);
      console.log(`  Range: $${agg.minPrice.toFixed(2)} - $${agg.maxPrice.toFixed(2)}`);
      console.log(`  Sources: ${agg.sourceCount}`);
    }

    logger.info('✅ Test passed!');
    db.close();
    process.exit(0);
  } catch (error) {
    logger.error('Test failed', { error: error.message });
    process.exit(1);
  }
})();
