// data-collector-with-improved-analysis.js
// Integration of bill analysis into the NH data collection worker with persistent storage

const NH_CONFIG = require('./nh-config');
const { analyzeBill, ANALYSIS_CONFIG } = require('./bill-analysis');
const { updateAnalysisIfNeeded, storeAnalysisResults } = require('./analysis-storage');

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
      const response = await fetchBillUpdates(stateCode, lastUpdateTimestamp, page);
      
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
