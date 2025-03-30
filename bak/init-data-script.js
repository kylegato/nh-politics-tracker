// init-data.js
// Script to initialize the data store with historical legislative data

/**
 * Configuration object for API endpoints and settings
 */
const CONFIG = {
  OPENSTATES_API_URL: 'https://v3.openstates.org',
  OPENSTATES_API_KEY: process.env.OPENSTATES_API_KEY,
  STATES: ['nh'], // Example states to track
  LOOKBACK_DAYS: 120, // How far back to fetch data
  MAX_BILLS_PER_REQUEST: 20,
  RATE_LIMIT_DELAY: 1000, // 1 second delay between requests
};

/**
 * Main function to run the initialization script
 */
async function main() {
  console.log('Starting initial data population');
  
  try {
    // Initialize state metadata
    await initializeStateMetadata();
    
    // Initialize session data for each state
    for (const state of CONFIG.STATES) {
      await initializeStateSessions(state);
    }
    
    // Initialize bill data for each state and session
    for (const state of CONFIG.STATES) {
      const sessions = await fetchStateSessions(state);
      
      for (const session of sessions) {
        await initializeSessionBills(state, session.identifier);
      }
    }
    
    console.log('Initial data population completed successfully');
  } catch (error) {
    console.error(`Error in initialization: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Initialize metadata about tracked states
 */
async function initializeStateMetadata() {
  console.log('Initializing state metadata');
  
  try {
    // Fetch all jurisdictions from OpenStates
    const response = await fetch(`${CONFIG.OPENSTATES_API_URL}/jurisdictions`, {
      headers: {
        'X-API-Key': CONFIG.OPENSTATES_API_KEY,
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch jurisdictions: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Filter to only include our tracked states
    const trackedStates = data.results
      .filter(state => CONFIG.STATES.includes(state.id))
      .map(state => ({
        code: state.id,
        name: state.name,
        classification: state.classification,
        division_id: state.division_id,
      }));
    
    // Use Wrangler CLI to write to KV namespace
    // In a real implementation, this would be:
    // await env.LEGISLATIVE_METADATA.put('tracked_states', JSON.stringify(trackedStates));
    console.log(`Storing tracked states: ${JSON.stringify(trackedStates, null, 2)}`);
    
    return trackedStates;
  } catch (error) {
    console.error(`Error initializing state metadata: ${error.message}`);
    throw error;
  }
}

/**
 * Fetch and initialize session data for a state
 * @param {string} state - State code (e.g., 'ca')
 */
async function initializeStateSessions(state) {
  console.log(`Initializing sessions for ${state}`);
  
  try {
    const sessions = await fetchStateSessions(state);
    
    if (!sessions || sessions.length === 0) {
      console.warn(`No sessions found for ${state}`);
      return;
    }
    
    // Use Wrangler CLI to write to KV namespace
    // In a real implementation, this would be:
    // await env.LEGISLATIVE_METADATA.put(`sessions:${state}`, JSON.stringify(sessions));
    console.log(`Storing ${sessions.length} sessions for ${state}`);
    
    return sessions;
  } catch (error) {
    console.error(`Error initializing sessions for ${state}: ${error.message}`);
    throw error;
  }
}

/**
 * Fetch sessions for a state from OpenStates API
 * @param {string} state - State code (e.g., 'ca')
 * @returns {Array} - Array of session objects
 */
async function fetchStateSessions(state) {
  try {
    const response = await fetch(`${CONFIG.OPENSTATES_API_URL}/jurisdictions/${state}`, {
      headers: {
        'X-API-Key': CONFIG.OPENSTATES_API_KEY,
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch sessions for ${state}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Extract and format session data
    return data.sessions.map(session => ({
      identifier: session.identifier,
      name: session.name,
      start_date: session.start_date,
      end_date: session.end_date,
      classification: session.classification,
    }));
  } catch (error) {
    console.error(`Error fetching sessions for ${state}: ${error.message}`);
    throw error;
  }
}

/**
 * Initialize bill data for a state and session
 * @param {string} state - State code (e.g., 'ca')
 * @param {string} session - Session identifier
 */
async function initializeSessionBills(state, session) {
  console.log(`Initializing bills for ${state}, session ${session}`);
  
  try {
    let page = 1;
    let hasMorePages = true;
    const billIdentifiers = [];
    
    // Calculate date range for initial fetch
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - CONFIG.LOOKBACK_DAYS);
    
    while (hasMorePages) {
      console.log(`Fetching page ${page} for ${state}, session ${session}`);
      
      // Fetch bills for this state and session
      const response = await fetchBills(state, session, page, startDate, endDate);
      
      if (!response.results || response.results.length === 0) {
        hasMorePages = false;
        continue;
      }
      
      // Process each bill
      for (const bill of response.results) {
        billIdentifiers.push(bill.identifier);
        
        // Store the bill
        // In a real implementation, this would use wrangler:
        // await env.LEGISLATIVE_DATA.put(
        //   `bill:${state}:${session}:${bill.identifier}`,
        //   JSON.stringify(bill)
        // );
      }
      
      console.log(`Processed ${response.results.length} bills from page ${page}`);
      
      // Check if there are more pages
      hasMorePages = response.pagination.total_pages > page;
      page++;
      
      // Respect rate limits
      await new Promise(resolve => setTimeout(resolve, CONFIG.RATE_LIMIT_DELAY));
    }
    
    // Store the index of bill identifiers
    // In a real implementation, this would use wrangler:
    // await env.LEGISLATIVE_DATA.put(
    //   `index:${state}:${session}`,
    //   JSON.stringify(billIdentifiers)
    // );
    
    console.log(`Completed initialization for ${state}, session ${session}. Total bills: ${billIdentifiers.length}`);
  } catch (error) {
    console.error(`Error initializing bills for ${state}, session ${session}: ${error.message}`);
    throw error;
  }
}

/**
 * Fetch bills from the OpenStates API
 * @param {string} state - State code
 * @param {string} session - Session identifier
 * @param {number} page - Page number for pagination
 * @param {Date} startDate - Start date for updated_since filter
 * @param {Date} endDate - End date for updated_since filter
 * @returns {Object} - API response with results and pagination info
 */
async function fetchBills(state, session, page = 1, startDate, endDate) {
  const url = new URL(`${CONFIG.OPENSTATES_API_URL}/bills`);
  
  // Add query parameters
  url.searchParams.append('jurisdiction', state);
  url.searchParams.append('session', session);
  url.searchParams.append('per_page', CONFIG.MAX_BILLS_PER_REQUEST.toString());
  url.searchParams.append('page', page.toString());
  
  // Add date range if provided
  if (startDate) {
    url.searchParams.append('updated_since', startDate.toISOString().split('T')[0]);
  }
  
  if (endDate) {
    url.searchParams.append('updated_before', endDate.toISOString().split('T')[0]);
  }
  
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

// Run the script if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = {
  main,
  initializeStateMetadata,
  initializeStateSessions,
  initializeSessionBills,
};
