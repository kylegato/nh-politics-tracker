// data-collector.js
// Scheduled Cloudflare Worker to fetch and store data from OpenStates API

/**
 * Configuration object for API endpoints and settings
 */
const CONFIG = {
  OPENSTATES_API_URL: 'https://v3.openstates.org/bills',
  OPENSTATES_API_KEY: '', // To be set as a Worker Secret
  STATES: ['ca', 'ny', 'tx'], // Example states to track
  MAX_BILLS_PER_REQUEST: 20,
  UPDATE_FREQUENCY: 'daily', // How often this worker runs
};

/**
 * Main handler for scheduled events
 * @param {Object} event - Cloudflare scheduled event
 * @param {Object} env - Environment variables
 * @param {Object} ctx - Execution context
 */
export default {
  async scheduled(event, env, ctx) {
    console.log(`Starting scheduled data collection: ${new Date().toISOString()}`);
    
    try {
      // Get the last update timestamp per state
      const lastUpdateTimestamps = await getLastUpdateTimestamps(env);
      
      // Process each state
      for (const state of CONFIG.STATES) {
        await processStateUpdates(state, lastUpdateTimestamps[state], env);
      }
      
      console.log(`Completed data collection: ${new Date().toISOString()}`);
    } catch (error) {
      console.error(`Error in scheduled job: ${error.message}`);
      // We could add additional error reporting here (e.g., send to a monitoring service)
    }
  }
};

/**
 * Get the last update timestamp for each state from KV
 * @param {Object} env - Environment variables with KV binding
 * @returns {Object} - Object with state codes as keys and timestamps as values
 */
async function getLastUpdateTimestamps(env) {
  const timestamps = {};
  
  try {
    // Try to get existing timestamps
    const storedTimestamps = await env.LEGISLATIVE_METADATA.get('last_update_timestamps', { type: 'json' });
    
    if (storedTimestamps) {
      return storedTimestamps;
    }
    
    // If none exist, initialize with default (30 days ago)
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() - 30);
    const defaultTimestamp = defaultDate.toISOString();
    
    for (const state of CONFIG.STATES) {
      timestamps[state] = defaultTimestamp;
    }
    
    // Store the default timestamps
    await env.LEGISLATIVE_METADATA.put('last_update_timestamps', JSON.stringify(timestamps));
    
    return timestamps;
  } catch (error) {
    console.error(`Error getting last update timestamps: ${error.message}`);
    
    // Fallback to default timestamps if there's an error
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() - 30);
    const defaultTimestamp = defaultDate.toISOString();
    
    for (const state of CONFIG.STATES) {
      timestamps[state] = defaultTimestamp;
    }
    
    return timestamps;
  }
}

/**
 * Process updates for a specific state
 * @param {string} state - State code (e.g., 'ca')
 * @param {string} lastUpdateTimestamp - ISO timestamp of last successful update
 * @param {Object} env - Environment variables with KV binding
 */
async function processStateUpdates(state, lastUpdateTimestamp, env) {
  console.log(`Processing updates for ${state} since ${lastUpdateTimestamp}`);
  
  let page = 1;
  let hasMorePages = true;
  let newestUpdateTimestamp = lastUpdateTimestamp;
  
  while (hasMorePages) {
    try {
      // Fetch bills updated since the last update
      const response = await fetchBillUpdates(state, lastUpdateTimestamp, page);
      
      if (!response.results || response.results.length === 0) {
        hasMorePages = false;
        continue;
      }
      
      // Update the newest timestamp if we have newer bills
      if (response.results.length > 0) {
        const newestBillUpdate = response.results.reduce((newest, bill) => {
          return new Date(bill.updated_at) > new Date(newest.updated_at) ? bill : newest;
        });
        
        if (new Date(newestBillUpdate.updated_at) > new Date(newestUpdateTimestamp)) {
          newestUpdateTimestamp = newestBillUpdate.updated_at;
        }
      }
      
      // Store the bills
      await storeBills(response.results, env);
      
      // Check if there are more pages
      hasMorePages = response.pagination.total_pages > page;
      page++;
      
      // Respect rate limits by adding a small delay between pages
      if (hasMorePages) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Error processing ${state} updates, page ${page}: ${error.message}`);
      hasMorePages = false; // Stop on error
    }
  }
  
  // Update the last update timestamp for this state
  await updateLastTimestamp(state, newestUpdateTimestamp, env);
  console.log(`Completed updates for ${state}, new timestamp: ${newestUpdateTimestamp}`);
}

/**
 * Fetch bill updates from the OpenStates API
 * @param {string} state - State code
 * @param {string} updatedSince - ISO timestamp to filter bills by
 * @param {number} page - Page number for pagination
 * @returns {Object} - API response with results and pagination info
 */
async function fetchBillUpdates(state, updatedSince, page = 1) {
  const url = new URL(CONFIG.OPENSTATES_API_URL);
  
  // Add query parameters
  url.searchParams.append('jurisdiction', state);
  url.searchParams.append('updated_since', updatedSince);
  url.searchParams.append('per_page', CONFIG.MAX_BILLS_PER_REQUEST.toString());
  url.searchParams.append('page', page.toString());
  
  const response = await fetch(url.toString(), {
    headers: {
      'X-API-Key': CONFIG.OPENSTATES_API_KEY,
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed with status ${response.status}: ${errorText}`);
  }
  
  return await response.json();
}

/**
 * Store bills in Cloudflare KV and/or D1
 * @param {Array} bills - Array of bill objects from API
 * @param {Object} env - Environment variables with KV binding
 */
async function storeBills(bills, env) {
  if (!bills || bills.length === 0) {
    return;
  }
  
  console.log(`Storing ${bills.length} bills`);
  
  // Process bills in batches to avoid exceeding KV limits
  const BATCH_SIZE = 10;
  for (let i = 0; i < bills.length; i += BATCH_SIZE) {
    const batch = bills.slice(i, i + BATCH_SIZE);
    
    try {
      // Store each bill with its ID as the key
      const promises = batch.map(async (bill) => {
        const key = `bill:${bill.jurisdiction}:${bill.session}:${bill.identifier}`;
        await env.LEGISLATIVE_DATA.put(key, JSON.stringify(bill));
        
        // Optionally, update indexes for efficient querying
        await updateBillIndexes(bill, env);
      });
      
      await Promise.all(promises);
    } catch (error) {
      console.error(`Error storing batch of bills: ${error.message}`);
    }
  }
}

/**
 * Update indexes for efficient bill querying
 * @param {Object} bill - Bill object from API
 * @param {Object} env - Environment variables with KV binding
 */
async function updateBillIndexes(bill, env) {
  try {
    // Create indexes by state and session
    const stateSessionKey = `index:${bill.jurisdiction}:${bill.session}`;
    
    // Get existing index or create new one
    const existingIndex = await env.LEGISLATIVE_DATA.get(stateSessionKey, { type: 'json' }) || [];
    
    // Check if bill already exists in index
    if (!existingIndex.includes(bill.identifier)) {
      existingIndex.push(bill.identifier);
      await env.LEGISLATIVE_DATA.put(stateSessionKey, JSON.stringify(existingIndex));
    }
    
    // You could create additional indexes here (e.g., by subject, sponsor, status)
  } catch (error) {
    console.error(`Error updating indexes for bill ${bill.identifier}: ${error.message}`);
  }
}

/**
 * Update the last update timestamp for a state
 * @param {string} state - State code
 * @param {string} timestamp - New timestamp to store
 * @param {Object} env - Environment variables with KV binding
 */
async function updateLastTimestamp(state, timestamp, env) {
  try {
    const timestamps = await env.LEGISLATIVE_METADATA.get('last_update_timestamps', { type: 'json' }) || {};
    timestamps[state] = timestamp;
    await env.LEGISLATIVE_METADATA.put('last_update_timestamps', JSON.stringify(timestamps));
  } catch (error) {
    console.error(`Error updating timestamp for ${state}: ${error.message}`);
  }
}
