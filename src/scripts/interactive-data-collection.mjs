#!/usr/bin/env node
// interactive-data-collection.js
// CLI tool for interactive data collection and analysis with confirmation prompts

import readline from 'readline';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Import configuration and core functionality
import NH_CONFIG from '../workers/nh-config.js';
import { analyzeBill, ANALYSIS_CONFIG } from '../workers/bill-analysis.js';
import { updateAnalysisIfNeeded, storeAnalysisResults } from '../workers/analysis-storage.js';

// Initialize readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Mock environment for local testing
const mockEnv = {
  // KV namespaces
  NH_LEGISLATIVE_DATA: createMockKV('nh_legislative_data'),
  NH_LEGISLATIVE_METADATA: createMockKV('nh_legislative_metadata'),
  // API keys - these will be loaded from .env file
  OPENSTATES_API_KEY: process.env.OPENSTATES_API_KEY || 'MISSING_API_KEY',
  API_KEY: process.env.API_KEY || 'MISSING_API_KEY',
  // Mock AI binding - will be conditionally enabled
  AI: null
};

// Config for the run
const config = {
  verbose: process.env.VERBOSE !== 'false',
  skipAI: process.env.SKIP_AI === 'true',
  maxBills: parseInt(process.env.MAX_BILLS || '5', 10),
  mockData: process.env.USE_MOCK_DATA === 'true'
};

// Stats tracking
const stats = {
  billsProcessed: 0,
  billsAnalyzed: 0,
  kvReads: 0,
  kvWrites: 0,
  aiCalls: 0,
  startTime: null,
  endTime: null
};

/**
 * Create required directories for data storage
 */
async function setupDataDirectories() {
  try {
    const baseDataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../data');
    console.log(`Setting up data directory: ${baseDataDir}`);
    
    // Create base data directory
    await fs.mkdir(baseDataDir, { recursive: true });
    
    // Create KV namespace directories
    await fs.mkdir(path.join(baseDataDir, 'nh_legislative_data'), { recursive: true });
    await fs.mkdir(path.join(baseDataDir, 'nh_legislative_metadata'), { recursive: true });
    
    console.log('Data directories created successfully');
  } catch (error) {
    console.error(`Error creating data directories: ${error.message}`);
  }
}

/**
 * Main async function to run the collection process
 */
async function main() {
  console.log('='.repeat(80));
  console.log('INTERACTIVE DATA COLLECTION - NH POLITICS TRACKER');
  console.log('='.repeat(80));
  console.log('\nThis script will walk through the data collection process step by step.');
  console.log('You will be prompted before each significant operation.\n');
  
  // Set up data directories
  await setupDataDirectories();
  
  // Configure the run
  await configureRun();
  
  // Set up AI if not skipping
  if (!config.skipAI) {
    try {
      console.log('Setting up AI binding...');
      // This is a simplified mock for local testing
      mockEnv.AI = {
        run: async (model, options) => {
          stats.aiCalls++;
          console.log(`[AI] Called model: ${model}`);
          console.log(`[AI] Prompt length: ${options.prompt ? options.prompt.length : 'N/A'}`);
          
          // Return a mock response
          return {
            response: `
Summary: This is a mock AI response for testing purposes.
Details: This response simulates what would be returned by the actual Cloudflare AI binding.
The prompt would be analyzed and a thoughtful analysis would be provided for the bill.
Score: 0
            `.trim()
          };
        }
      };
      console.log('AI binding set up successfully.');
    } catch (error) {
      console.error('Failed to set up AI binding:', error);
      await confirmPrompt('Continue without AI analysis?');
      config.skipAI = true;
    }
  }
  
  // Start the process
  stats.startTime = new Date();
  console.log(`\nStarting data collection at ${stats.startTime.toISOString()}`);
  
  // Get last update timestamp
  const lastUpdateTimestamp = await getLastUpdateTimestamp();
  await confirmPrompt(`Using last update timestamp: ${lastUpdateTimestamp}. Continue?`);
  
  // Process all bills
  await processBills(lastUpdateTimestamp);
  
  // Generate summaries
  await confirmPrompt('Generate analysis summaries for the dashboard?');
  await generateAnalysisSummaries();
  
  // Show stats
  stats.endTime = new Date();
  const duration = (stats.endTime - stats.startTime) / 1000;
  
  console.log('\n='.repeat(80));
  console.log('EXECUTION COMPLETE');
  console.log('='.repeat(80));
  console.log(`\nDuration: ${duration.toFixed(2)} seconds`);
  console.log(`Bills processed: ${stats.billsProcessed}`);
  console.log(`Bills analyzed: ${stats.billsAnalyzed}`);
  console.log(`KV reads: ${stats.kvReads}`);
  console.log(`KV writes: ${stats.kvWrites}`);
  console.log(`AI calls: ${stats.aiCalls}`);
  
  // Close readline interface
  rl.close();
}

/**
 * Configure the run based on user input
 */
async function configureRun() {
  // Verbose logging
  const verboseResponse = await prompt('Enable verbose logging? (Y/n): ', 'Y');
  config.verbose = verboseResponse.toLowerCase() !== 'n';
  
  // AI analysis
  const skipAIResponse = await prompt('Skip AI analysis to save costs? (y/N): ', 'N');
  config.skipAI = skipAIResponse.toLowerCase() === 'y';
  
  // Max bills
  const maxBillsResponse = await prompt(`Maximum number of bills to process (currently ${config.maxBills}): `, config.maxBills.toString());
  config.maxBills = parseInt(maxBillsResponse, 10) || config.maxBills;
  
  // Mock data
  const mockDataResponse = await prompt('Use mock data instead of real API calls? (y/N): ', 'N');
  config.mockData = mockDataResponse.toLowerCase() === 'y';
  
  console.log('\nConfiguration:');
  console.log(JSON.stringify(config, null, 2));
  
  const confirmResponse = await prompt('\nProceed with this configuration? (Y/n): ', 'Y');
  if (confirmResponse.toLowerCase() === 'n') {
    console.log('Exiting...');
    process.exit(0);
  }
}

/**
 * Get the timestamp of the last successful update
 */
async function getLastUpdateTimestamp() {
  console.log('Getting last update timestamp...');
  
  try {
    // Try to get the last update timestamp from KV
    stats.kvReads++;
    
    let timestamp;
    if (config.mockData) {
      console.log('[MOCK] Using mock timestamp');
      timestamp = null;
    } else {
      timestamp = await mockEnv.NH_LEGISLATIVE_METADATA.get('last_update_timestamp');
    }
    
    if (timestamp) {
      console.log(`Found last update timestamp: ${timestamp}`);
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
    
    // Fallback to 7 days ago to limit data
    const defaultTimestamp = new Date();
    defaultTimestamp.setDate(defaultTimestamp.getDate() - 7);
    
    return defaultTimestamp.toISOString();
  }
}

/**
 * Process bills since the last update timestamp
 */
async function processBills(lastUpdateTimestamp) {
  let page = 1;
  let hasMorePages = true;
  let newestUpdateTimestamp = lastUpdateTimestamp;
  const stateCode = NH_CONFIG.STATE_CODE;
  const totalProcessedBills = [];
  
  while (hasMorePages && stats.billsProcessed < config.maxBills) {
    try {
      // Fetch bills updated since the last update
      await confirmPrompt(`Fetch bills from page ${page}?`);
      
      const response = await fetchBillUpdates(stateCode, lastUpdateTimestamp, page);
      
      if (!response.results || response.results.length === 0) {
        console.log('No bills found on this page.');
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
          console.log(`Updated newest timestamp to: ${newestUpdateTimestamp}`);
        }
      }
      
      const billsToProcess = response.results.slice(0, config.maxBills - stats.billsProcessed);
      console.log(`Processing ${billsToProcess.length} bills from page ${page}`);
      
      // Process bills in smaller batches
      const batchSize = ANALYSIS_CONFIG.MAX_BILLS_PER_BATCH;
      for (let i = 0; i < billsToProcess.length; i += batchSize) {
        const batch = billsToProcess.slice(i, Math.min(i + batchSize, billsToProcess.length));
        
        await confirmPrompt(`Process batch of ${batch.length} bills?`);
        
        // Process each bill in the batch
        for (const bill of batch) {
          await confirmPrompt(`Process bill ${bill.identifier} (${stats.billsProcessed + 1}/${config.maxBills})?`);
          
          const result = await processBillWithAnalysis(bill);
          stats.billsProcessed++;
          
          if (!result.error) {
            totalProcessedBills.push(bill.identifier);
            console.log(`Successfully processed bill ${bill.identifier}`);
          } else {
            console.error(`Error processing bill ${bill.identifier}: ${result.error}`);
          }
          
          if (stats.billsProcessed >= config.maxBills) {
            console.log(`Reached maximum bills limit (${config.maxBills})`);
            break;
          }
          
          // Add a small delay between bills
          await delay(500);
        }
        
        // Add delay between batches
        await delay(1000);
      }
      
      // Check if we need to fetch more pages
      hasMorePages = response.pagination.total_pages > page && stats.billsProcessed < config.maxBills;
      page++;
      
      if (hasMorePages) {
        await delay(1000);
      }
    } catch (error) {
      console.error(`Error processing bill updates, page ${page}: ${error.message}`);
      hasMorePages = false; // Stop on error
    }
  }
  
  console.log(`\nProcessed ${totalProcessedBills.length} bills`);
  
  // Update the last update timestamp
  if (totalProcessedBills.length > 0) {
    await confirmPrompt(`Update the last update timestamp to ${newestUpdateTimestamp}?`);
    
    try {
      stats.kvWrites++;
      await mockEnv.NH_LEGISLATIVE_METADATA.put('last_update_timestamp', newestUpdateTimestamp);
      console.log(`Updated last update timestamp to: ${newestUpdateTimestamp}`);
    } catch (error) {
      console.error(`Error updating last update timestamp: ${error.message}`);
    }
  }
  
  return { newestUpdateTimestamp, totalProcessedBills };
}

/**
 * Fetch bills updated since the last update
 */
async function fetchBillUpdates(stateCode, lastUpdateTimestamp, page = 1) {
  console.log(`Fetching bills updated since ${lastUpdateTimestamp}, page ${page}`);
  
  // Use mock data if configured
  if (config.mockData) {
    console.log('[MOCK] Using mock bill data');
    return getMockBillsResponse(page);
  }
  
  try {
    // Calculate the date in YYYY-MM-DD format for the API
    const updatedSince = new Date(lastUpdateTimestamp).toISOString().split('T')[0];
    
    // Construct the API URL with proper parameters
    const apiUrl = new URL(`${NH_CONFIG.OPENSTATES_API_URL}/bills`);
    
    // Use just the state code for jurisdiction
    apiUrl.searchParams.append('jurisdiction', stateCode);
    apiUrl.searchParams.append('updated_since', updatedSince);
    apiUrl.searchParams.append('page', page.toString());
    apiUrl.searchParams.append('per_page', '20'); // Adjust as needed
    apiUrl.searchParams.append('sort', 'updated_desc');
    
    // Add additional filters to reduce data size
    if (NH_CONFIG.CURRENT_SESSION) {
      apiUrl.searchParams.append('session', NH_CONFIG.CURRENT_SESSION);
    }
    
    // Add include fields separately as required by the API
    const includeFields = ['abstracts', 'sponsorships', 'actions', 'votes', 'documents', 'sources', 'versions'];
    for (const field of includeFields) {
      apiUrl.searchParams.append('include', field);
    }
    
    console.log(`API request URL: ${apiUrl.toString()}`);
    
    // Make the API request with the API key in the header
    const response = await fetch(apiUrl.toString(), {
      headers: {
        'X-API-Key': mockEnv.OPENSTATES_API_KEY,
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
    
    // Return empty response on error
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
 * Process a bill with analysis
 */
async function processBillWithAnalysis(bill) {
  try {
    console.log(`\nProcessing bill ${bill.identifier}: ${bill.title}`);
    
    // Calculate bill's category
    const category = 'uncategorized'; // Simplified for demo
    
    // Add bill metadata
    const enhancedBill = {
      ...bill,
      nh_category: category,
      nh_accountability: {
        sponsor_info: { sponsors: [] },
        voting_records: { votes: [] }
      }
    };
    
    // Check if analysis is needed
    console.log(`Checking if analysis needed for bill ${bill.identifier}`);
    
    // Get existing analysis
    stats.kvReads++;
    const billType = bill.identifier.match(/^([A-Za-z]+)/)[1].toLowerCase();
    const chamber = bill.from_organization?.classification || 'unknown';
    const billNumber = bill.identifier.match(/\d+/)[0];
    const analysisKey = `nh-${billType}-${chamber}-${billNumber}-ai-analysis`;
    
    let existingAnalysis = null;
    try {
      existingAnalysis = await mockEnv.NH_LEGISLATIVE_DATA.get(analysisKey, { type: 'json' });
    } catch (error) {
      console.log(`No existing analysis found: ${error.message}`);
    }
    
    let analysis;
    if (existingAnalysis) {
      console.log(`Found existing analysis for bill ${bill.identifier}`);
      analysis = existingAnalysis;
    } else {
      // Need to perform analysis
      await confirmPrompt(`Perform ${config.skipAI ? 'simplified' : 'AI'} analysis for bill ${bill.identifier}?`);
      
      try {
        if (config.skipAI) {
          // Create simplified analysis without AI
          analysis = {
            bill_id: bill.id,
            bill_identifier: bill.identifier,
            analysis_timestamp: new Date().toISOString(),
            analyses: {
              tax_impact: {
                summary: "Simplified analysis - no tax impact detected",
                details: "This is a simplified analysis performed without AI.",
                score: 0
              },
              budget_impact: {
                summary: "Simplified analysis - minimal budget impact",
                details: "This is a simplified analysis performed without AI.",
                score: 0
              },
              societal_impact: {
                summary: "Simplified analysis - possible societal impact",
                details: "This is a simplified analysis performed without AI.",
                score: 0
              },
              institutional_alignment: {
                summary: "Simplified analysis - neutral alignment",
                details: "This is a simplified analysis performed without AI.",
                score: 0
              }
            },
            content_hash: "simplified"
          };
        } else {
          // Perform AI analysis
          analysis = await analyzeBill(bill, mockEnv);
          stats.billsAnalyzed++;
        }
        
        // Store the analysis
        stats.kvWrites++;
        await mockEnv.NH_LEGISLATIVE_DATA.put(analysisKey, JSON.stringify(analysis));
        
        console.log(`Stored analysis for bill ${bill.identifier}`);
        
        // Also store a mapping from bill ID to analysis key
        stats.kvWrites++;
        await mockEnv.NH_LEGISLATIVE_DATA.put(`bill:${bill.id}:analysis-key`, analysisKey);
      } catch (error) {
        console.error(`Error analyzing bill ${bill.identifier}: ${error.message}`);
        return { error: error.message };
      }
    }
    
    // Add reference to the analysis
    enhancedBill.nh_analysis_key = analysisKey;
    
    // Store the enhanced bill
    const billKey = `bill:${bill.identifier}`;
    await confirmPrompt(`Store enhanced bill data for ${bill.identifier}?`);
    stats.kvWrites++;
    await mockEnv.NH_LEGISLATIVE_DATA.put(billKey, JSON.stringify(enhancedBill));
    
    // Update bill indexes
    const categoryKey = `index:category:${category}`;
    stats.kvReads++;
    let categoryBills = await mockEnv.NH_LEGISLATIVE_DATA.get(categoryKey, { type: 'json' }) || [];
    
    if (!categoryBills.includes(bill.identifier)) {
      categoryBills.push(bill.identifier);
      stats.kvWrites++;
      await mockEnv.NH_LEGISLATIVE_DATA.put(categoryKey, JSON.stringify(categoryBills));
    }
    
    // Check if the bill should be highlighted
    const shouldHighlight = checkIfShouldHighlight(analysis);
    if (shouldHighlight) {
      await confirmPrompt(`Add bill ${bill.identifier} to highlighted bills index?`);
      await addBillToHighlightIndex(bill);
    }
    
    console.log(`Completed processing and analysis for bill ${bill.identifier}`);
    return { bill: enhancedBill, analysis };
  } catch (error) {
    console.error(`Error processing bill ${bill.identifier}: ${error.message}`);
    return { error: error.message };
  }
}

/**
 * Check if a bill should be highlighted based on its analysis
 */
function checkIfShouldHighlight(analysis) {
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
 */
async function addBillToHighlightIndex(bill) {
  try {
    const highlightKey = `index:highlighted_bills`;
    stats.kvReads++;
    let highlightedBills = await mockEnv.NH_LEGISLATIVE_DATA.get(highlightKey, { type: 'json' }) || [];
    
    if (!highlightedBills.includes(bill.identifier)) {
      highlightedBills.push(bill.identifier);
      stats.kvWrites++;
      await mockEnv.NH_LEGISLATIVE_DATA.put(highlightKey, JSON.stringify(highlightedBills));
      console.log(`Added bill ${bill.identifier} to highlighted bills index`);
    }
  } catch (error) {
    console.error(`Error adding bill ${bill.identifier} to highlight index: ${error.message}`);
  }
}

/**
 * Generate summaries of bill analyses for dashboard use
 */
async function generateAnalysisSummaries() {
  try {
    console.log('\nGenerating analysis summaries for dashboard...');
    
    // Get highlighted bills
    const highlightKey = `index:highlighted_bills`;
    stats.kvReads++;
    const highlightedBills = await mockEnv.NH_LEGISLATIVE_DATA.get(highlightKey, { type: 'json' }) || [];
    
    if (highlightedBills.length === 0) {
      console.log('No highlighted bills to summarize');
      return;
    }
    
    console.log(`Found ${highlightedBills.length} highlighted bills`);
    
    // Collect analysis data for highlighted bills
    const analysisSummaries = {
      tax_impact: [],
      budget_impact: [],
      societal_impact: [],
      institutional_alignment: []
    };
    
    for (const billId of highlightedBills) {
      const billKey = `bill:${billId}`;
      stats.kvReads++;
      const bill = await mockEnv.NH_LEGISLATIVE_DATA.get(billKey, { type: 'json' });
      
      if (!bill || !bill.nh_analysis_key) {
        console.log(`Bill ${billId} has no analysis key - skipping`);
        continue;
      }
      
      // Get the analysis using the stored key
      stats.kvReads++;
      const analysis = await mockEnv.NH_LEGISLATIVE_DATA.get(bill.nh_analysis_key, { type: 'json' });
      
      if (!analysis || !analysis.analyses) {
        console.log(`No valid analysis found for bill ${billId} - skipping`);
        continue;
      }
      
      console.log(`Processing analysis for bill ${billId}`);
      
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
    await confirmPrompt('Store analysis summaries in KV storage?');
    stats.kvWrites++;
    await mockEnv.NH_LEGISLATIVE_METADATA.put('analysis_summaries', JSON.stringify(analysisSummaries));
    
    console.log('Generated analysis summaries for dashboard');
    
    // Print summary counts
    console.log('Summary counts:');
    for (const [type, items] of Object.entries(analysisSummaries)) {
      console.log(`- ${type}: ${items.length} items`);
    }
  } catch (error) {
    console.error(`Error generating analysis summaries: ${error.message}`);
  }
}

/**
 * Create a mock KV namespace for local testing
 */
function createMockKV(namespace) {
  const storage = {};
  const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../data', namespace);
  
  // Create directory if it doesn't exist
  fs.mkdir(dataDir, { recursive: true }).catch(console.error);
  
  return {
    get: async (key, options = {}) => {
      if (config.verbose) console.log(`[KV:${namespace}] GET ${key}`);
      
      try {
        // Try to read from file first
        const filePath = path.join(dataDir, `${key.replace(/:/g, '_')}.json`);
        const data = await fs.readFile(filePath, 'utf8').catch(() => null);
        
        if (data) {
          return options.type === 'json' ? JSON.parse(data) : data;
        }
        
        // Fall back to in-memory storage
        const value = storage[key];
        if (!value) return null;
        
        return options.type === 'json' ? JSON.parse(value) : value;
      } catch (error) {
        console.error(`[KV:${namespace}] Error reading ${key}: ${error.message}`);
        return null;
      }
    },
    
    put: async (key, value, options = {}) => {
      if (config.verbose) console.log(`[KV:${namespace}] PUT ${key}`);
      
      // Store in memory
      storage[key] = typeof value === 'object' ? JSON.stringify(value) : value;
      
      // Also write to file for persistence
      try {
        const filePath = path.join(dataDir, `${key.replace(/:/g, '_')}.json`);
        const data = typeof value === 'object' ? JSON.stringify(value) : value;
        
        // Create directory (including parent directories) before writing file
        const dirPath = path.dirname(filePath);
        await fs.mkdir(dirPath, { recursive: true });
        
        await fs.writeFile(filePath, data);
      } catch (error) {
        console.error(`[KV:${namespace}] Error writing ${key}: ${error.message}`);
      }
      
      return true;
    }
  };
}

/**
 * Get mock bill data for testing
 */
function getMockBillsResponse(page) {
  // Create mock bills for testing
  const bills = [];
  
  // Only return bills on the first page
  if (page === 1) {
    bills.push({
      id: 'ocd-bill/mock-1',
      identifier: 'HB 123',
      title: 'An Act establishing a committee to study property tax relief',
      abstract: 'This bill establishes a committee to study property tax relief options.',
      from_organization: { classification: 'house' },
      subject: ['Taxation', 'Housing'],
      updated_at: new Date().toISOString()
    });
    
    bills.push({
      id: 'ocd-bill/mock-2',
      identifier: 'SB 456',
      title: 'An Act relative to public education funding',
      abstract: 'This bill modifies the formula for public education funding.',
      from_organization: { classification: 'senate' },
      subject: ['Education', 'Budget'],
      updated_at: new Date().toISOString()
    });
    
    bills.push({
      id: 'ocd-bill/mock-3',
      identifier: 'HB 789',
      title: 'An Act concerning health insurance coverage for telehealth services',
      abstract: 'This bill requires health insurers to cover telehealth services.',
      from_organization: { classification: 'house' },
      subject: ['Health', 'Insurance'],
      updated_at: new Date().toISOString()
    });
  }
  
  return {
    results: bills,
    pagination: {
      total_pages: 1,
      total_items: bills.length,
      page: page
    }
  };
}

/**
 * Helper to prompt for user input
 */
function prompt(question, defaultValue = '') {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer || defaultValue);
    });
  });
}

/**
 * Confirm prompt with Y as default
 */
async function confirmPrompt(question) {
  if (process.argv.includes('--auto')) {
    // Automatic mode - no prompts
    console.log(`[AUTO] ${question} (Y)`);
    return true;
  }
  
  const response = await prompt(`${question} (Y/n): `, 'Y');
  if (response.toLowerCase() === 'n') {
    console.log('Cancelled by user.');
    return false;
  }
  return true;
}

/**
 * Helper for delays
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Start the script if run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// Export functions for testing
export {
  main,
  getLastUpdateTimestamp,
  fetchBillUpdates,
  processBillWithAnalysis,
  generateAnalysisSummaries
}; 