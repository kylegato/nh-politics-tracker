// data-collector-with-improved-analysis.js
// Integration of bill analysis into the NH data collection worker with persistent storage

import NH_CONFIG from './nh-config';
import { analyzeBill, ANALYSIS_CONFIG } from './bill-analysis';
import { updateAnalysisIfNeeded, storeAnalysisResults } from './analysis-storage';

/**
 * Get the timestamp of the last successful update
 * @param {Object} env - Environment variables with KV binding
 * @returns {Promise<string>} - ISO timestamp of last update or default lookback
 */
async function getLastUpdateTimestamp(env) {
  try {
    // Try to get the last update timestamp from KV
    const timestamp = await env.NH_LEGISLATIVE_METADATA.get('last_update_timestamp');
    
    if (timestamp) {
      console.log(`Using last update timestamp: ${timestamp}`);
      return timestamp;
    }
    
    // If not found, use a default lookback period
    const lookbackDays = NH_CONFIG.LOOKBACK_DAYS || 30;
    const defaultTimestamp = new Date();
    defaultTimestamp.setDate(defaultTimestamp.getDate() - lookbackDays);
    
    const formattedTimestamp = defaultTimestamp.toISOString();
    console.log(`No previous timestamp found, using default lookback of ${lookbackDays} days: ${formattedTimestamp}`);
    
    return formattedTimestamp;
  } catch (error) {
    console.error(`Error getting last update timestamp: ${error.message}`);
    
    // Fallback to 30 days ago
    const defaultTimestamp = new Date();
    defaultTimestamp.setDate(defaultTimestamp.getDate() - 30);
    
    return defaultTimestamp.toISOString();
  }
}

/**
 * Fetch bills updated since the last update
 * @param {string} stateCode - State code (e.g., 'nh')
 * @param {string} lastUpdateTimestamp - ISO timestamp of last successful update
 * @param {number} page - Page number to fetch
 * @returns {Promise<Object>} - Response with bills and pagination info
 */
async function fetchBillUpdates(stateCode, lastUpdateTimestamp, page = 1, env) {
  try {
    console.log(`Fetching bills updated since ${lastUpdateTimestamp}, page ${page}`);
    
    // Calculate the date in YYYY-MM-DD format for the API
    const updatedSince = new Date(lastUpdateTimestamp).toISOString().split('T')[0];
    
    // Construct the API URL with proper parameters
    const apiUrl = new URL(`${NH_CONFIG.OPENSTATES_API_URL}/bills`);
    
    // Use just the state code for jurisdiction, not "state/stateCode"
    apiUrl.searchParams.append('jurisdiction', stateCode);
    apiUrl.searchParams.append('updated_since', updatedSince);
    apiUrl.searchParams.append('page', page.toString());
    apiUrl.searchParams.append('per_page', '20'); // Adjust as needed
    
    // Fix sort parameter - use updated_desc instead of updated_at
    apiUrl.searchParams.append('sort', 'updated_desc');
    
    // Add additional filters to reduce data size
    // Only include bills from the current session
    if (NH_CONFIG.CURRENT_SESSION) {
      apiUrl.searchParams.append('session', NH_CONFIG.CURRENT_SESSION);
    }
    
    // Fix include parameter - add each value separately as required by the API
    const includeFields = ['abstracts', 'sponsorships', 'actions', 'votes', 'documents', 'sources', 'versions'];
    for (const field of includeFields) {
      apiUrl.searchParams.append('include', field);
    }
    
    console.log(`API request URL: ${apiUrl.toString()}`);
    
    // Make the API request with the API key ONLY in the header, not in the URL
    const response = await fetch(apiUrl.toString(), {
      headers: {
        'X-API-Key': env.OPENSTATES_API_KEY,
        'Accept': 'application/json'
      }
    });
    
    // Check if the request was successful
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }
    
    // Parse the response
    const data = await response.json();
    
    // Log the number of bills found
    console.log(`Found ${data.results?.length || 0} bills on page ${page}, total pages: ${data.pagination?.total_pages || 0}`);
    
    return data;
  } catch (error) {
    console.error(`Error fetching bill updates: ${error.message}`);
    // Return empty response on error to prevent the entire process from failing
    return {
      results: [],
      pagination: {
        total_pages: 0,
        total_items: 0,
        page: page
      }
    };
  }
}

/**
 * Determine a bill's category based on title/subjects
 * @param {Object} bill - Bill data
 * @returns {string} - Category name
 */
function determineBillCategory(bill) {
  // This would contain logic to categorize bills based on content
  // For now, return a default category
  return 'uncategorized';
}

/**
 * Extract sponsor accountability information
 * @param {Object} bill - Bill data
 * @returns {Object} - Sponsor accountability info
 */
function extractSponsorAccountability(bill) {
  // This would extract sponsor information for accountability tracking
  return { sponsors: [] };
}

/**
 * Extract voting records for accountability tracking
 * @param {Object} bill - Bill data
 * @returns {Object} - Voting records
 */
function extractVotingRecords(bill) {
  // This would extract voting information for accountability tracking
  return { votes: [] };
}

/**
 * Update bill indexes for categorization and searching
 * @param {Object} bill - Bill data
 * @param {string} category - Bill category
 * @param {Object} env - Environment variables with KV binding
 */
async function updateBillIndexes(bill, category, env) {
  try {
    // This would update various indexes for the bill
    // For now, just update a category index
    const categoryKey = `index:category:${category}`;
    let categoryBills = await env.NH_LEGISLATIVE_DATA.get(categoryKey, { type: 'json' }) || [];
    
    if (!categoryBills.includes(bill.identifier)) {
      categoryBills.push(bill.identifier);
      await env.NH_LEGISLATIVE_DATA.put(categoryKey, JSON.stringify(categoryBills));
    }
  } catch (error) {
    console.error(`Error updating bill indexes: ${error.message}`);
  }
}

/**
 * Collect representative data for accountability metrics
 * @param {Object} env - Environment variables with KV binding
 */
async function collectRepresentativeData(env) {
  // This would collect data about representatives' activities
  console.log('Collecting representative data for accountability metrics');
}

/**
 * Update committee attendance records
 * @param {Object} env - Environment variables with KV binding
 */
async function updateCommitteeAttendance(env) {
  // This would update committee attendance records
  console.log('Updating committee attendance records');
}

/**
 * Enhanced processBill function that includes AI analysis with persistent storage
 * @param {Object} bill - Bill data from API
 * @param {Object} env - Environment variables with KV binding
 */
async function processBillWithPersistentAnalysis(bill, env) {
  try {
    // First perform the standard bill processing
    // Calculate bill's category based on title/subjects
    const category = determineBillCategory(bill);
    
    // Add additional bill metadata for NH specific tracking
    const enhancedBill = {
      ...bill,
      nh_category: category,
      nh_accountability: {
        sponsor_info: extractSponsorAccountability(bill),
        voting_records: extractVotingRecords(bill)
      }
    };
    
    // Now perform AI analysis only if needed (not previously analyzed or content changed)
    console.log(`Checking if analysis needed for bill ${bill.identifier}`);
    const analysis = await updateAnalysisIfNeeded(bill, env);
    
    // Add reference to the analysis
    const billType = bill.identifier.match(/^([A-Za-z]+)/)[1].toLowerCase();
    const chamber = bill.from_organization?.classification || 'unknown';
    const billNumber = bill.identifier.match(/\d+/)[0];
    const analysisKey = `nh-${billType}-${chamber}-${billNumber}-ai-analysis`;
    
    enhancedBill.nh_analysis_key = analysisKey;
    
    // Store the enhanced bill
    const billKey = `bill:${bill.identifier}`;
    await env.NH_LEGISLATIVE_DATA.put(billKey, JSON.stringify(enhancedBill));
    
    // Update bill indexes
    await updateBillIndexes(bill, category, env);
    
    // For bills with significant tax or budget impact, add to a special index
    if (shouldHighlightBill(analysis)) {
      await addBillToHighlightIndex(bill, env);
    }
    
    console.log(`Completed processing and analysis for bill ${bill.identifier}`);
    return { bill: enhancedBill, analysis };
  } catch (error) {
    console.error(`Error processing bill ${bill.identifier} with analysis: ${error.message}`);
    return { error: error.message };
  }
}

/**
 * Determine if a bill should be highlighted based on its analysis
 * @param {Object} analysis - The bill analysis
 * @returns {boolean} - Whether the bill should be highlighted
 */
function shouldHighlightBill(analysis) {
  if (!analysis || !analysis.analyses) return false;
  
  // Check for significant impacts in any category
  const impactTypes = ['tax_impact', 'budget_impact', 'societal_impact'];
  
  for (const type of impactTypes) {
    const impact = analysis.analyses[type];
    if (impact && impact.summary && 
        (impact.summary.toLowerCase().includes('significant') ||
         impact.summary.toLowerCase().includes('major') ||
         impact.summary.toLowerCase().includes('substantial'))) {
      return true;
    }
  }
  
  return false;
}

/**
 * Add a bill to the highlight index
 * @param {Object} bill - The bill to highlight
 * @param {Object} env - Environment variables with KV binding
 */
async function addBillToHighlightIndex(bill, env) {
  try {
    const highlightKey = `index:highlighted_bills`;
    let highlightedBills = await env.NH_LEGISLATIVE_DATA.get(highlightKey, { type: 'json' }) || [];
    
    if (!highlightedBills.includes(bill.identifier)) {
      highlightedBills.push(bill.identifier);
      await env.NH_LEGISLATIVE_DATA.put(highlightKey, JSON.stringify(highlightedBills));
      console.log(`Added bill ${bill.identifier} to highlighted bills index`);
    }
  } catch (error) {
    console.error(`Error adding bill ${bill.identifier} to highlight index: ${error.message}`);
  }
}

/**
 * Enhanced updateBills function that processes bills in batches for analysis with persistent storage
 * @param {string} lastUpdateTimestamp - ISO timestamp of last successful update
 * @param {Object} env - Environment variables with KV binding
 */
async function updateBillsWithPersistentAnalysis(lastUpdateTimestamp, env) {
  let page = 1;
  let hasMorePages = true;
  let newestUpdateTimestamp = lastUpdateTimestamp;
  const stateCode = NH_CONFIG.STATE_CODE;
  const totalProcessedBills = [];
  
  while (hasMorePages) {
    try {
      // Fetch bills updated since the last update
      const response = await fetchBillUpdates(stateCode, lastUpdateTimestamp, page, env);
      
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
      
      console.log(`Processing ${response.results.length} bills from page ${page}`);
      
      // Process bills in smaller batches to manage AI resource usage
      for (let i = 0; i < response.results.length; i += ANALYSIS_CONFIG.MAX_BILLS_PER_BATCH) {
        const batch = response.results.slice(i, i + ANALYSIS_CONFIG.MAX_BILLS_PER_BATCH);
        
        // Process each bill in the batch with AI analysis
        for (const bill of batch) {
          const result = await processBillWithPersistentAnalysis(bill, env);
          if (!result.error) {
            totalProcessedBills.push(bill.identifier);
          }
          
          // Add a small delay between bills to manage rate limits
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Add delay between batches
        await new Promise(resolve => setTimeout(resolve, ANALYSIS_CONFIG.RATE_LIMIT_DELAY));
      }
      
      // Check if there are more pages
      hasMorePages = response.pagination.total_pages > page;
      page++;
      
      // Respect rate limits by adding a delay between pages
      if (hasMorePages) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`Error processing NH bill updates, page ${page}: ${error.message}`);
      hasMorePages = false; // Stop on error
    }
  }
  
  console.log(`Completed bill updates with analysis for ${totalProcessedBills.length} bills`);
  return { newestUpdateTimestamp, totalProcessedBills };
}

/**
 * Generate summaries of bill analyses for dashboard use
 * @param {Object} env - Environment variables with KV binding
 */
async function generateAnalysisSummaries(env) {
  try {
    // Get highlighted bills
    const highlightKey = `index:highlighted_bills`;
    const highlightedBills = await env.NH_LEGISLATIVE_DATA.get(highlightKey, { type: 'json' }) || [];
    
    if (highlightedBills.length === 0) {
      console.log('No highlighted bills to summarize');
      return;
    }
    
    // Collect analysis data for highlighted bills
    const analysisSummaries = {
      tax_impact: [],
      budget_impact: [],
      societal_impact: [],
      institutional_alignment: []
    };
    
    for (const billId of highlightedBills) {
      const billKey = `bill:${billId}`;
      const bill = await env.NH_LEGISLATIVE_DATA.get(billKey, { type: 'json' });
      
      if (!bill || !bill.nh_analysis_key) continue;
      
      // Get the analysis using the stored key
      const analysis = await env.NH_LEGISLATIVE_DATA.get(bill.nh_analysis_key, { type: 'json' });
      
      if (!analysis || !analysis.analyses) continue;
      
      // Add summaries for each analysis type
      for (const type of Object.keys(analysisSummaries)) {
        if (analysis.analyses[type] && analysis.analyses[type].summary) {
          analysisSummaries[type].push({
            bill_id: billId,
            bill_title: bill.title,
            summary: analysis.analyses[type].summary
          });
        }
      }
    }
    
    // Store the analysis summaries
    await env.NH_LEGISLATIVE_METADATA.put('analysis_summaries', JSON.stringify(analysisSummaries));
    console.log('Generated analysis summaries for dashboard');
  } catch (error) {
    console.error(`Error generating analysis summaries: ${error.message}`);
  }
}

/**
 * Main handler for scheduled events with persistent analysis
 * @param {Object} event - Cloudflare scheduled event
 * @param {Object} env - Environment variables
 * @param {Object} ctx - Execution context
 */
export default {
  async scheduled(event, env, ctx) {
    console.log(`Starting NH legislative data collection with persistent AI analysis: ${new Date().toISOString()}`);
    
    try {
      // Get the last update timestamp
      const lastUpdateTimestamp = await getLastUpdateTimestamp(env);
      
      // Process all NH legislative updates with AI analysis
      await updateBillsWithPersistentAnalysis(lastUpdateTimestamp, env);
      
      // Collect representative data for accountability metrics
      await collectRepresentativeData(env);
      
      // Update committee attendance records
      await updateCommitteeAttendance(env);
      
      // Generate analysis summaries for the dashboard
      await generateAnalysisSummaries(env);
      
      console.log(`Completed NH data collection with analysis: ${new Date().toISOString()}`);
    } catch (error) {
      console.error(`Error in scheduled job: ${error.message}`);
      // We could add additional error reporting here (e.g., send to a monitoring service)
    }
  }
};