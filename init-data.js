// init-data.js
const { processNHUpdatesWithAnalysis } = require('./src/workers/data-collector');

// Set a far-back date to get historical data
const startDate = new Date();
startDate.setFullYear(startDate.getFullYear() - 1); // Go back 1 years
const lastUpdateTimestamp = startDate.toISOString();

// Run the initialization
async function initialize(env) {
  console.log(`Starting initialization from ${lastUpdateTimestamp}`);
  await processNHUpdatesWithAnalysis(lastUpdateTimestamp, env);
  console.log('Initialization complete');
}

// Export for wrangler
export default {
  async scheduled(event, env, ctx) {
    await initialize(env);
  }
};
