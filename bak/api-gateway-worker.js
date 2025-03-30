// api-gateway.js
// Cloudflare Worker to serve as an API Gateway for the frontend

/**
 * Main handler for HTTP requests
 */
export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;
      
      // Basic CORS headers
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      };
      
      // Handle OPTIONS (preflight) requests
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: corsHeaders,
        });
      }
      
      // Only allow GET requests for this API
      if (request.method !== 'GET') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }
      
      // Route requests to appropriate handlers
      if (pathname.startsWith('/api/bills')) {
        return await handleBillsRequest(request, env, corsHeaders);
      } else if (pathname.startsWith('/api/states')) {
        return await handleStatesRequest(request, env, corsHeaders);
      } else if (pathname.startsWith('/api/sessions')) {
        return await handleSessionsRequest(request, env, corsHeaders);
      } else if (pathname === '/api/health') {
        return new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      } else {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }
    } catch (error) {
      console.error(`API Gateway error: ${error.message}`);
      
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  }
};

/**
 * Handle requests for bill data
 * @param {Request} request - The original request
 * @param {Object} env - Environment variables with KV binding
 * @param {Object} corsHeaders - CORS headers to include in response
 * @returns {Response} - JSON response with bill data
 */
async function handleBillsRequest(request, env, corsHeaders) {
  const url = new URL(request.url);
  const params = url.searchParams;
  
  // Get specific bill if ID is provided
  if (params.has('id')) {
    const billId = params.get('id');
    return await getBillById(billId, env, corsHeaders);
  }
  
  // Get bills by state and session
  if (params.has('state') && params.has('session')) {
    const state = params.get('state').toLowerCase();
    const session = params.get('session');
    const page = parseInt(params.get('page') || '1');
    const perPage = parseInt(params.get('perPage') || '20');
    
    return await getBillsByStateAndSession(state, session, page, perPage, env, corsHeaders);
  }
  
  // Get bills by search query
  if (params.has('query')) {
    const query = params.get('query');
    const state = params.get('state')?.toLowerCase();
    const page = parseInt(params.get('page') || '1');
    const perPage = parseInt(params.get('perPage') || '20');
    
    return await searchBills(query, state, page, perPage, env, corsHeaders);
  }
  
  // Default error for missing required parameters
  return new Response(JSON.stringify({
    error: 'Missing required parameters. Required: state and session, or id, or query'
  }), {
    status: 400,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

/**
 * Get a specific bill by ID
 * @param {string} billId - The bill ID in format "state:session:identifier"
 * @param {Object} env - Environment variables with KV binding
 * @param {Object} corsHeaders - CORS headers to include in response
 * @returns {Response} - JSON response with bill data
 */
async function getBillById(billId, env, corsHeaders) {
  try {
    // Format should be "state:session:identifier"
    const key = `bill:${billId}`;
    const bill = await env.LEGISLATIVE_DATA.get(key, { type: 'json' });
    
    if (!bill) {
      return new Response(JSON.stringify({ error: 'Bill not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }
    
    return new Response(JSON.stringify(bill), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error(`Error getting bill by ID: ${error.message}`);
    
    return new Response(JSON.stringify({ error: 'Failed to retrieve bill' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
}

/**
 * Get bills by state and session
 * @param {string} state - The state code (e.g., 'ca')
 * @param {string} session - The legislative session
 * @param {number} page - Page number for pagination
 * @param {number} perPage - Items per page
 * @param {Object} env - Environment variables with KV binding
 * @param {Object} corsHeaders - CORS headers to include in response
 * @returns {Response} - JSON response with bill data
 */
async function getBillsByStateAndSession(state, session, page, perPage, env, corsHeaders) {
  try {
    // Get index of bills for this state and session
    const indexKey = `index:${state}:${session}`;
    const billIdentifiers = await env.LEGISLATIVE_DATA.get(indexKey, { type: 'json' });
    
    if (!billIdentifiers || billIdentifiers.length === 0) {
      return new Response(JSON.stringify({ 
        results: [],
        pagination: {
          page,
          per_page: perPage,
          total_items: 0,
          total_pages: 0
        }
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }
    
    // Calculate pagination
    const start = (page - 1) * perPage;
    const end = Math.min(start + perPage, billIdentifiers.length);
    const paginatedIdentifiers = billIdentifiers.slice(start, end);
    
    // Fetch each bill
    const billPromises = paginatedIdentifiers.map(async (identifier) => {
      const billKey = `bill:${state}:${session}:${identifier}`;
      return await env.LEGISLATIVE_DATA.get(billKey, { type: 'json' });
    });
    
    const bills = await Promise.all(billPromises);
    const validBills = bills.filter(bill => bill !== null);
    
    return new Response(JSON.stringify({
      results: validBills,
      pagination: {
        page,
        per_page: perPage,
        total_items: billIdentifiers.length,
        total_pages: Math.ceil(billIdentifiers.length / perPage)
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error(`Error getting bills by state/session: ${error.message}`);
    
    return new Response(JSON.stringify({ error: 'Failed to retrieve bills' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
}

/**
 * Search bills by query string
 * @param {string} query - Search query
 * @param {string} state - Optional state filter
 * @param {number} page - Page number for pagination
 * @param {number} perPage - Items per page
 * @param {Object} env - Environment variables with KV binding
 * @param {Object} corsHeaders - CORS headers to include in response
 * @returns {Response} - JSON response with search results
 */
async function searchBills(query, state, page, perPage, env, corsHeaders) {
  try {
    // This is a simplified search implementation
    // For a production system, you would want to implement a proper search index
    
    // Get all the bill keys that match the state filter, if provided
    let allKeys;
    
    if (state) {
      // List keys with prefix to filter by state
      allKeys = await env.LEGISLATIVE_DATA.list({ prefix: `bill:${state}:` });
    } else {
      // List all bill keys
      allKeys = await env.LEGISLATIVE_DATA.list({ prefix: 'bill:' });
    }
    
    const keys = allKeys.keys.map(k => k.name);
    
    // Fetch bills in batches to avoid overwhelming KV
    const BATCH_SIZE = 100;
    let matchingBills = [];
    
    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
      const batchKeys = keys.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batchKeys.map(async (key) => {
        const bill = await env.LEGISLATIVE_DATA.get(key, { type: 'json' });
        
        if (!bill) return null;
        
        // Simple search implementation
        const normalizedQuery = query.toLowerCase();
        const titleMatch = bill.title?.toLowerCase().includes(normalizedQuery);
        const descriptionMatch = bill.description?.toLowerCase().includes(normalizedQuery);
        const identifierMatch = bill.identifier?.toLowerCase().includes(normalizedQuery);
        
        if (titleMatch || descriptionMatch || identifierMatch) {
          return bill;
        }
        
        return null;
      });
      
      const batchResults = await Promise.all(batchPromises);
      matchingBills = matchingBills.concat(batchResults.filter(bill => bill !== null));
    }
    
    // Apply pagination
    const start = (page - 1) * perPage;
    const end = Math.min(start + perPage, matchingBills.length);
    const paginatedResults = matchingBills.slice(start, end);
    
    return new Response(JSON.stringify({
      results: paginatedResults,
      pagination: {
        page,
        per_page: perPage,
        total_items: matchingBills.length,
        total_pages: Math.ceil(matchingBills.length / perPage)
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error(`Error searching bills: ${error.message}`);
    
    return new Response(JSON.stringify({ error: 'Failed to search bills' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
}

/**
 * Handle requests for state data
 * @param {Request} request - The original request
 * @param {Object} env - Environment variables with KV binding
 * @param {Object} corsHeaders - CORS headers to include in response
 * @returns {Response} - JSON response with state data
 */
async function handleStatesRequest(request, env, corsHeaders) {
  try {
    // Get list of states from metadata
    const states = await env.LEGISLATIVE_METADATA.get('tracked_states', { type: 'json' });
    
    if (!states) {
      // Fallback to configured states if not found in KV
      const configuredStates = [
        { code: 'ca', name: 'California' },
        { code: 'ny', name: 'New York' },
        { code: 'tx', name: 'Texas' },
        // Add more states as needed
      ];
      
      return new Response(JSON.stringify(configuredStates), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }
    
    return new Response(JSON.stringify(states), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error(`Error getting states: ${error.message}`);
    
    return new Response(JSON.stringify({ error: 'Failed to retrieve states' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
}

/**
 * Handle requests for session data
 * @param {Request} request - The original request
 * @param {Object} env - Environment variables with KV binding
 * @param {Object} corsHeaders - CORS headers to include in response
 * @returns {Response} - JSON response with session data
 */
async function handleSessionsRequest(request, env, corsHeaders) {
  const url = new URL(request.url);
  const params = url.searchParams;
  
  if (!params.has('state')) {
    return new Response(JSON.stringify({ error: 'State parameter is required' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
  
  const state = params.get('state').toLowerCase();
  
  try {
    // Get sessions for this state from metadata
    const sessionsKey = `sessions:${state}`;
    const sessions = await env.LEGISLATIVE_METADATA.get(sessionsKey, { type: 'json' });
    
    if (!sessions || sessions.length === 0) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }
    
    return new Response(JSON.stringify(sessions), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error(`Error getting sessions for ${state}: ${error.message}`);
    
    return new Response(JSON.stringify({ error: 'Failed to retrieve sessions' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
}