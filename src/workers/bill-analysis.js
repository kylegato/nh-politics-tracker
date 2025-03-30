// data-collector-with-analysis.js
// Integration of bill analysis into the NH data collection worker

import NH_CONFIG from './nh-config.js';

/**
 * Configuration for bill analysis
 */
export const ANALYSIS_CONFIG = {
  MAX_BILLS_PER_BATCH: 5,
  RATE_LIMIT_DELAY: 5000, // ms between batch processing
  DEFAULT_ANALYSIS_TTLS: 604800, // 7 days in seconds
};

/**
 * Analyze a bill using AI to determine various impacts
 * @param {Object} bill - The bill to analyze
 * @param {Object} env - Environment with bindings including AI if available
 * @returns {Promise<Object>} - Analysis results
 */
export async function analyzeBill(bill, env) {
  try {
    console.log(`Analyzing bill: ${bill.identifier} - ${bill.title}`);
    
    // Prepare bill content for analysis
    const billContent = prepareBillContent(bill);
    
    // Initialize with timestamps
    const analysisResult = {
      bill_id: bill.id,
      bill_identifier: bill.identifier,
      analysis_timestamp: new Date().toISOString(),
      analyses: {}
    };
    
    // Try to use AI if available
    if (env.AI) {
      console.log(`Using AI to analyze bill ${bill.identifier}`);
      try {
        // Add tax impact analysis
        analysisResult.analyses.tax_impact = await analyzeWithAI(
          env.AI, 
          billContent, 
          'tax_impact',
          'Analyze the potential tax impact of this bill. Identify if it increases taxes, decreases taxes, or is tax neutral. Estimate the magnitude of impact and affected groups.'
        );
        
        // Add budget impact analysis
        analysisResult.analyses.budget_impact = await analyzeWithAI(
          env.AI, 
          billContent, 
          'budget_impact',
          'Analyze the potential budget impact of this bill. Identify if it increases spending, decreases spending, or is budget neutral. Estimate the magnitude of impact.'
        );
        
        // Add societal impact analysis
        analysisResult.analyses.societal_impact = await analyzeWithAI(
          env.AI, 
          billContent, 
          'societal_impact',
          'Analyze the potential societal impact of this bill. Identify affected groups and estimate the nature and magnitude of impact.'
        );
        
        // Add institutional alignment analysis
        analysisResult.analyses.institutional_alignment = await analyzeWithAI(
          env.AI, 
          billContent, 
          'institutional_alignment',
          'Analyze how this bill aligns with various institutional interests such as political parties, industry groups, or advocacy organizations.'
        );
      } catch (aiError) {
        console.error(`AI analysis error for bill ${bill.identifier}: ${aiError.message}`);
        // Fall back to simplified analysis
        Object.assign(analysisResult.analyses, createSimplifiedAnalysis(bill));
      }
    } else {
      // Use simplified analysis if AI is not available
      console.log(`Using simplified analysis for bill ${bill.identifier} (AI not available)`);
      Object.assign(analysisResult.analyses, createSimplifiedAnalysis(bill));
    }
    
    return analysisResult;
  } catch (error) {
    console.error(`Error analyzing bill ${bill?.identifier}: ${error.message}`);
    
    // Return a basic error result rather than throwing
    return {
      bill_id: bill?.id,
      bill_identifier: bill?.identifier,
      analysis_timestamp: new Date().toISOString(),
      analysis_error: error.message,
      analyses: createSimplifiedAnalysis(bill) // Still provide basic analysis
    };
  }
}

/**
 * Use AI to analyze a specific aspect of a bill
 * @param {Object} ai - AI binding
 * @param {string} content - Bill content
 * @param {string} type - Type of analysis
 * @param {string} prompt - Analysis prompt
 * @returns {Promise<Object>} - Analysis result for this aspect
 */
async function analyzeWithAI(ai, content, type, prompt) {
  try {
    // Create the full prompt with instructions
    const fullPrompt = `
You are a legislative analyst specialized in impact assessment. 
Analyze the following bill:

${content}

${prompt}

Format your response as:
1. Summary: A one-sentence summary of the impact
2. Details: 2-3 paragraphs with detailed analysis
3. Score: From -5 (very negative) to +5 (very positive), with 0 being neutral impact
`;

    // Call the AI model with the prompt
    const response = await ai.run('@cf/meta/llama-3-8b-instruct', {
      prompt: fullPrompt,
      max_tokens: 500
    });
    
    // Process the response
    const analysisText = response.response;
    
    // Extract sections using regex
    const summaryMatch = analysisText.match(/Summary:(.*?)(?=Details:|$)/s);
    const detailsMatch = analysisText.match(/Details:(.*?)(?=Score:|$)/s);
    const scoreMatch = analysisText.match(/Score:.*?(-?\d+)/s);
    
    // Structure the response
    return {
      summary: summaryMatch ? summaryMatch[1].trim() : 'No summary available',
      details: detailsMatch ? detailsMatch[1].trim() : 'No details available',
      score: scoreMatch ? parseInt(scoreMatch[1], 10) : 0,
      raw_analysis: analysisText
    };
  } catch (error) {
    console.error(`AI analysis error for ${type}: ${error.message}`);
    throw error;
  }
}

/**
 * Create simplified analysis when AI is not available
 * @param {Object} bill - The bill to analyze
 * @returns {Object} - Basic analysis results
 */
function createSimplifiedAnalysis(bill) {
  // Keywords to watch for in bill content
  const taxKeywords = ['tax', 'revenue', 'levy', 'fiscal', 'income'];
  const budgetKeywords = ['budget', 'appropriation', 'fund', 'spend', 'cost'];
  const societalKeywords = ['education', 'health', 'environment', 'justice', 'rights', 'family'];
  
  // Combine bill text for keyword search
  const billText = [
    bill?.title || '',
    bill?.abstract || '',
    bill?.description || '',
    ...(bill?.subject || [])
  ].join(' ').toLowerCase();
  
  // Count keyword matches
  const taxMatches = taxKeywords.filter(kw => billText.includes(kw)).length;
  const budgetMatches = budgetKeywords.filter(kw => billText.includes(kw)).length;
  const societalMatches = societalKeywords.filter(kw => billText.includes(kw)).length;
  
  // Create analyses based on keyword matches
  return {
    tax_impact: taxMatches > 0 ? {
      summary: `Potential ${taxMatches > 2 ? 'significant' : 'minor'} tax implications based on keyword analysis.`,
      details: `This bill contains ${taxMatches} tax-related keywords, suggesting it may have tax implications.`,
      score: 0, // Neutral score for keyword-based analysis
    } : null,
    
    budget_impact: budgetMatches > 0 ? {
      summary: `Potential ${budgetMatches > 2 ? 'significant' : 'minor'} budget implications based on keyword analysis.`,
      details: `This bill contains ${budgetMatches} budget-related keywords, suggesting it may have budgetary implications.`,
      score: 0,
    } : null,
    
    societal_impact: societalMatches > 0 ? {
      summary: `Potential ${societalMatches > 2 ? 'significant' : 'minor'} societal implications based on keyword analysis.`,
      details: `This bill contains ${societalMatches} society-related keywords, suggesting it may have societal implications.`,
      score: 0,
    } : null,
    
    institutional_alignment: {
      summary: 'Insufficient data for institutional alignment analysis.',
      details: 'Simplified analysis cannot determine institutional alignments without AI processing.',
      score: 0,
    }
  };
}

/**
 * Prepare bill content for analysis
 * @param {Object} bill - The bill to analyze
 * @returns {string} - Formatted bill content for analysis
 */
function prepareBillContent(bill) {
  const sections = [
    `Bill ID: ${bill.identifier}`,
    `Title: ${bill.title || 'No title provided'}`,
    `Abstract: ${bill.abstract || 'No abstract provided'}`,
    `Description: ${bill.description || 'No description provided'}`,
    `Subjects: ${bill.subject ? bill.subject.join(', ') : 'No subjects provided'}`,
    `Sponsors: ${bill.sponsors ? bill.sponsors.map(s => s.name).join(', ') : 'No sponsors provided'}`,
    `Latest Action: ${bill.latest_action || 'No action recorded'}`,
    `Current Status: ${bill.status || 'Status unknown'}`
  ];
  
  return sections.join('\n\n');
}

/**
 * Process a batch of bills
 * @param {Array} bills - Array of bills to process
 * @param {Object} env - Environment with bindings
 * @returns {Promise<Array>} - Array of analysis results
 */
export async function processBillBatch(bills, env) {
  const results = [];
  
  for (const bill of bills) {
    try {
      const analysis = await analyzeBill(bill, env);
      results.push({
        bill_id: bill.id,
        bill_identifier: bill.identifier,
        analysis
      });
      
      // Add a small delay between bills to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Error processing bill ${bill.identifier} in batch: ${error.message}`);
      results.push({
        bill_id: bill.id,
        bill_identifier: bill.identifier,
        error: error.message
      });
    }
  }
  
  return results;
}

/**
 * Enhanced processBill function that includes AI analysis
 * @param {Object} bill - Bill data from API
 * @param {Object} env - Environment variables with KV binding
 */
async function processBillWithAnalysis(bill, env) {
  try {
    // Import needed functions from data-collector to avoid circular dependencies
    // These would normally be imported properly in a well-structured codebase
    const determineBillCategory = (bill) => 'uncategorized';
    const extractSponsorAccountability = (bill) => ({ sponsors: [] });
    const extractVotingRecords = (bill) => ({ votes: [] });
    const updateBillIndexes = async (bill, category, env) => {
      console.log(`Would update bill indexes for ${bill.identifier} in category ${category}`);
    };
    const addBillToHighlightIndex = async (bill, env) => {
      console.log(`Would add bill ${bill.identifier} to highlight index`);
    };
    
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
    
    // Now perform AI analysis
    console.log(`Running AI analysis for bill ${bill.identifier}`);
    const analysis = await analyzeBill(bill, env);
    
    // Add analysis to the enhanced bill
    enhancedBill.nh_analysis = {
      timestamp: analysis.analysis_timestamp,
      tax_impact: analysis.analyses?.tax_impact || null,
      societal_impact: analysis.analyses?.societal_impact || null,
      budget_impact: analysis.analyses?.budget_impact || null,
      institutional_alignment: analysis.analyses?.institutional_alignment || null,
      error: analysis.analysis_error || null
    };
    
    // Store the enhanced bill with analysis
    const billKey = `bill:${bill.identifier}`;
    await env.NH_LEGISLATIVE_DATA.put(billKey, JSON.stringify(enhancedBill));
    
    // Update bill indexes
    await updateBillIndexes(bill, category, env);
    
    // For bills with significant tax or budget impact, add to a special index
    const shouldHighlightBill = (bill) => {
      if (!bill.nh_analysis) return false;
      return bill.nh_analysis.tax_impact?.summary?.toLowerCase().includes('significant') ||
             bill.nh_analysis.budget_impact?.summary?.toLowerCase().includes('significant') ||
             bill.nh_analysis.societal_impact?.summary?.toLowerCase().includes('significant');
    };
    
    if (shouldHighlightBill(enhancedBill)) {
      await addBillToHighlightIndex(bill, env);
    }
    
    console.log(`Completed processing and analysis for bill ${bill.identifier}`);
  } catch (error) {
    console.error(`Error processing bill ${bill.identifier} with analysis: ${error.message}`);
  }
}

/**
 * Enhanced updateBills function that processes bills in batches for analysis
 * @param {string} lastUpdateTimestamp - ISO timestamp of last successful update
 * @param {Object} env - Environment variables with KV binding
 */
async function updateBillsWithAnalysis(lastUpdateTimestamp, env) {
  // Import needed functions to avoid circular dependencies
  const fetchBillUpdates = async (stateCode, lastUpdateTimestamp, page = 1, env) => {
    console.log(`Would fetch bills updated since ${lastUpdateTimestamp}, page ${page}`);
    // Mock implementation to avoid circular dependency
    return {
      results: [],
      pagination: {
        total_pages: 0,
        total_items: 0,
        page: page
      }
    };
  };
  
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
          await processBillWithAnalysis(bill, env);
          totalProcessedBills.push(bill.identifier);
          
          // Add a small delay between bills to manage rate limits
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Add delay between batches
        await new Promise(resolve => setTimeout(resolve, ANALYSIS_CONFIG.RATE_LIMIT_DELAY));
      }
      
      // Check if there are more pages
      hasMorePages = response.pagination.total_pages > page;
      page++;
      
      // Respect rate limits by adding a small delay between pages
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
 * Enhanced process updates function that includes AI analysis
 * @param {string} lastUpdateTimestamp - ISO timestamp of last successful update
 * @param {Object} env - Environment variables with KV binding
 */
async function processNHUpdatesWithAnalysis(lastUpdateTimestamp, env) {
  console.log(`Processing NH updates with AI analysis since ${lastUpdateTimestamp}`);
  
  try {
    // Mock function implementations to avoid circular dependencies 
    const updateLegislators = async (env) => {
      console.log('Would update legislators');
    };
    
    const updateCommittees = async (env) => {
      console.log('Would update committees');
    };
    
    const generateAnalysisSummaries = async (env) => {
      console.log('Would generate analysis summaries');
    };
    
    // 1. Fetch and update bills with AI analysis
    const { newestUpdateTimestamp, totalProcessedBills } = await updateBillsWithAnalysis(lastUpdateTimestamp, env);
    
    // 2. Fetch and update legislators
    await updateLegislators(env);
    
    // 3. Fetch and update committees
    await updateCommittees(env);
    
    // 4. Update the last update timestamp
    await env.NH_LEGISLATIVE_METADATA.put('last_update_timestamp', newestUpdateTimestamp);
    
    // 5. Generate analysis summaries for the dashboard
    if (totalProcessedBills.length > 0) {
      await generateAnalysisSummaries(env);
    }
    
    console.log(`Completed NH updates with analysis, new timestamp: ${newestUpdateTimestamp}`);
  } catch (error) {
    console.error(`Error processing NH updates with analysis: ${error.message}`);
    throw error;
  }
}

/**
 * Generate summaries of bill analyses for dashboard use - simplified version
 * @param {Object} env - Environment variables with KV binding
 */
async function generateAnalysisSummaries(env) {
  console.log('Simplified analysis summary generation to avoid circular dependencies');
}

/**
 * Main handler for scheduled events with analysis
 * @param {Object} event - Cloudflare scheduled event
 * @param {Object} env - Environment variables
 * @param {Object} ctx - Execution context
 */
export default {
  async scheduled(event, env, ctx) {
    console.log(`Starting NH legislative data collection with AI analysis: ${new Date().toISOString()}`);
    
    try {
      // Mock the getLastUpdateTimestamp function to avoid circular dependencies
      const getLastUpdateTimestamp = async (env) => {
        const lookbackDays = 30;
        const defaultTimestamp = new Date();
        defaultTimestamp.setDate(defaultTimestamp.getDate() - lookbackDays);
        
        const formattedTimestamp = defaultTimestamp.toISOString();
        console.log(`Mock implementation using default lookback of ${lookbackDays} days: ${formattedTimestamp}`);
        
        return formattedTimestamp;
      };
      
      // Mock the collectRepresentativeData function
      const collectRepresentativeData = async (env) => {
        console.log('Mock implementation to collect representative data');
      };
      
      // Mock the updateCommitteeAttendance function
      const updateCommitteeAttendance = async (env) => {
        console.log('Mock implementation to update committee attendance');
      };
      
      // Get the last update timestamp
      const lastUpdateTimestamp = await getLastUpdateTimestamp(env);
      
      // Process all NH legislative updates with AI analysis
      await processNHUpdatesWithAnalysis(lastUpdateTimestamp, env);
      
      // Collect representative data for accountability metrics
      await collectRepresentativeData(env);
      
      // Update committee attendance records
      await updateCommitteeAttendance(env);
      
      console.log(`Completed NH data collection with analysis: ${new Date().toISOString()}`);
    } catch (error) {
      console.error(`Error in scheduled job: ${error.message}`);
      // We could add additional error reporting here (e.g., send to a monitoring service)
    }
  }
};
