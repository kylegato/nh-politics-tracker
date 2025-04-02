// analysis-storage.js
// Enhanced storage strategy for bill analysis to ensure persistence

import { StorageError, ValidationError, NotFoundError, validateData } from './error-handling.js';
import { analyzeBill } from './bill-analysis.js';

/**
 * Validation schema for bill data
 */
const BILL_SCHEMA = {
  id: { required: true, type: 'string' },
  identifier: { required: true, type: 'string' },
  title: { required: true, type: 'string' }
};

/**
 * Validation schema for analysis data
 */
const ANALYSIS_SCHEMA = {
  analyses: { 
    required: true, 
    type: 'object',
    validate: (analyses) => {
      if (!analyses || typeof analyses !== 'object') {
        throw new Error('analyses must be an object');
      }
      // Ensure at least one impact type exists
      const hasImpactType = ['tax_impact', 'budget_impact', 'societal_impact', 'institutional_alignment']
        .some(type => analyses[type]);
      
      if (!hasImpactType) {
        throw new Error('analysis must contain at least one impact type');
      }
    }
  }
};

/**
 * Store bill analysis results permanently in KV storage
 * @param {Object} bill - The bill data
 * @param {Object} analysis - The analysis results
 * @param {Object} env - Environment variables with KV binding
 * @returns {Promise<string>} - The analysis key
 * @throws {ValidationError} If data validation fails
 * @throws {StorageError} If storage operation fails
 */
export async function storeAnalysisResults(bill, analysis, env) {
  try {
    // Validate input data
    validateData(bill, BILL_SCHEMA);
    validateData(analysis, ANALYSIS_SCHEMA);
    
    // Format a consistent key for the analysis
    // Using bill type, chamber, and number for clear identification
    const billType = getBillType(bill.identifier); // e.g., "hb" from "HB 123"
    const chamber = bill.from_organization?.classification || 'unknown'; // e.g., "house"
    const billNumber = getBillNumber(bill.identifier); // e.g., "123" from "HB 123"
    
    // Create standardized key in format: `[state]-[billType]-[chamber]-[number]-ai-analysis`
    const analysisKey = `nh-${billType}-${chamber}-${billNumber}-ai-analysis`;
    
    // Store the analysis with the bill ID for reference
    const analysisData = {
      bill_id: bill.id,
      bill_identifier: bill.identifier,
      bill_title: bill.title,
      analysis_timestamp: new Date().toISOString(),
      analyses: {
        tax_impact: analysis.analyses?.tax_impact || null,
        budget_impact: analysis.analyses?.budget_impact || null,
        societal_impact: analysis.analyses?.societal_impact || null,
        institutional_alignment: analysis.analyses?.institutional_alignment || null
      }
    };
    
    // Calculate a content hash to track if bill text changes
    const contentHash = calculateContentHash(bill);
    analysisData.content_hash = contentHash;
    
    // Debug logging
    console.log(`Storing analysis with key: ${analysisKey}`);
    
    // Store permanently in KV (no expiration)
    try {
      await env.NH_LEGISLATIVE_DATA.put(analysisKey, JSON.stringify(analysisData));
      console.log(`Successfully stored analysis with key: ${analysisKey}`);
    } catch (error) {
      throw new StorageError(`Failed to store analysis: ${error.message}`, {
        analysisKey,
        billId: bill.id
      });
    }
    
    // Also create a mapping from bill ID to analysis key for easy lookup
    try {
      const billMappingKey = `bill:${bill.id}:analysis-key`;
      await env.NH_LEGISLATIVE_DATA.put(billMappingKey, analysisKey);
      console.log(`Successfully created bill-to-analysis mapping: ${billMappingKey} -> ${analysisKey}`);
    } catch (error) {
      throw new StorageError(`Failed to store bill-to-analysis mapping: ${error.message}`, {
        billId: bill.id,
        analysisKey
      });
    }
    
    // Verify the analysis was stored correctly by reading it back
    try {
      const verifyData = await env.NH_LEGISLATIVE_DATA.get(analysisKey, { type: 'json' });
      if (!verifyData) {
        throw new StorageError(`Failed to verify analysis storage - data not found after writing`, {
          analysisKey,
          billId: bill.id
        });
      }
      console.log(`Verified analysis storage for key: ${analysisKey}`);
    } catch (error) {
      throw new StorageError(`Failed to verify analysis was stored: ${error.message}`, {
        analysisKey,
        billId: bill.id
      });
    }
    
    return analysisKey;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof StorageError) {
      throw error;
    }
    throw new StorageError(`Error storing analysis results: ${error.message}`, {
      billId: bill?.id,
      error: error.stack
    });
  }
}

/**
 * Get existing analysis for a bill, if available
 * @param {Object} bill - The bill data
 * @param {Object} env - Environment variables with KV binding
 * @returns {Promise<Object|null>} - The analysis results or null if not found
 * @throws {ValidationError} If data validation fails
 * @throws {StorageError} If storage operation fails
 */
export async function getExistingAnalysis(bill, env) {
  try {
    // Validate bill data
    validateData(bill, BILL_SCHEMA);
    
    // First try to get the analysis key from the bill ID mapping
    const analysisKey = await env.NH_LEGISLATIVE_DATA.get(`bill:${bill.id}:analysis-key`)
      .catch(error => {
        throw new StorageError(`Failed to get analysis key: ${error.message}`, {
          billId: bill.id
        });
      });
    
    if (analysisKey) {
      // Get the analysis using the key
      const analysisData = await env.NH_LEGISLATIVE_DATA.get(analysisKey, { type: 'json' })
        .catch(error => {
          throw new StorageError(`Failed to get analysis data: ${error.message}`, {
            analysisKey,
            billId: bill.id
          });
        });
      
      if (analysisData) {
        // Calculate current content hash to check if bill has changed
        const currentContentHash = calculateContentHash(bill);
        
        // If content hash matches, return the existing analysis
        if (currentContentHash === analysisData.content_hash) {
          console.log(`Using existing analysis for bill ${bill.id} with key ${analysisKey}`);
          return analysisData;
        } else {
          console.log(`Bill content changed, will re-analyze bill ${bill.id}`);
          return null;
        }
      }
    }
    
    // If we don't have a mapping or the analysis isn't found, try to construct the key
    const billType = getBillType(bill.identifier);
    const chamber = bill.from_organization?.classification || 'unknown';
    const billNumber = getBillNumber(bill.identifier);
    const constructedKey = `nh-${billType}-${chamber}-${billNumber}-ai-analysis`;
    
    const analysisData = await env.NH_LEGISLATIVE_DATA.get(constructedKey, { type: 'json' })
      .catch(error => {
        throw new StorageError(`Failed to get analysis with constructed key: ${error.message}`, {
          constructedKey,
          billId: bill.id
        });
      });
    
    if (analysisData) {
      // Create the mapping for future lookups
      await env.NH_LEGISLATIVE_DATA.put(`bill:${bill.id}:analysis-key`, constructedKey)
        .catch(error => {
          console.error(`Warning: Failed to create mapping for bill ${bill.id}: ${error.message}`);
          // Don't throw here - we already have the analysis data
        });
      
      // Check content hash
      const currentContentHash = calculateContentHash(bill);
      if (currentContentHash === analysisData.content_hash) {
        console.log(`Using existing analysis for bill ${bill.id} with constructed key ${constructedKey}`);
        return analysisData;
      }
    }
    
    // No existing analysis found or content has changed
    return null;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof StorageError) {
      throw error;
    }
    throw new StorageError(`Error getting existing analysis: ${error.message}`, {
      billId: bill?.id,
      error: error.stack
    });
  }
}

/**
 * Extract bill type from identifier
 * @param {string} identifier - Bill identifier (e.g., "HB 123", "SB 45", "CR 7")
 * @returns {string} - The bill type in lowercase
 * @throws {ValidationError} If identifier format is invalid
 */
export function getBillType(identifier) {
  if (!identifier) {
    throw new ValidationError('Bill identifier is required');
  }
  
  // Extract letters from the beginning of the identifier
  const match = identifier.match(/^([A-Za-z]+)/);
  if (!match) {
    throw new ValidationError(`Invalid bill identifier format: ${identifier}`);
  }
  
  return match[1].toLowerCase();
}

/**
 * Extract bill number from identifier
 * @param {string} identifier - Bill identifier (e.g., "HB 123")
 * @returns {string} - The bill number
 * @throws {ValidationError} If identifier format is invalid
 */
export function getBillNumber(identifier) {
  if (!identifier) {
    throw new ValidationError('Bill identifier is required');
  }
  
  // Extract numbers from the identifier
  const match = identifier.match(/\d+/);
  if (!match) {
    throw new ValidationError(`Invalid bill identifier format: ${identifier}`);
  }
  
  return match[0];
}

/**
 * Calculate a hash of the bill content to detect changes
 * @param {Object} bill - The bill data
 * @returns {string} - A hash string representing the bill content
 */
export function calculateContentHash(bill) {
  // Create a string of the relevant bill content
  const contentString = [
    bill.title || '',
    bill.abstract || '',
    bill.description || '',
    JSON.stringify(bill.subject || []),
    bill.latest_action || ''
  ].join('|');
  
  // Simple hash function for content comparison
  // In a production environment, consider using a more robust hashing algorithm
  let hash = 0;
  for (let i = 0; i < contentString.length; i++) {
    const char = contentString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return hash.toString();
}

/**
 * Update the bill analysis if the bill has changed
 * @param {Object} bill - The bill data
 * @param {Object} env - Environment variables with KV binding
 * @returns {Promise<Object>} - The analysis results or null if not needed
 * @throws {ValidationError} If data validation fails
 * @throws {StorageError} If storage operation fails
 */
export async function updateAnalysisIfNeeded(bill, env) {
  try {
    // Validate bill data
    validateData(bill, BILL_SCHEMA);
    
    // First check if we already have analysis for this bill
    const existingAnalysis = await getExistingAnalysis(bill, env);
    
    // If we have analysis and the content hasn't changed, return it
    if (existingAnalysis) {
      return existingAnalysis;
    }
    
    // If we don't have analysis or the content has changed, analyze the bill
    console.log(`Analyzing bill ${bill.id}: ${bill.title}`);
    
    // This would call your existing analyzeBill function
    // We'll add a try-catch here to handle potential AI analysis errors
    let analysis;
    try {
      analysis = await analyzeBill(bill, env);
    } catch (error) {
      throw new StorageError(`Failed to analyze bill: ${error.message}`, {
        billId: bill.id,
        error: error.stack
      });
    }
    
    // Validate the analysis data
    validateData(analysis, ANALYSIS_SCHEMA);
    
    // Store the analysis permanently
    await storeAnalysisResults(bill, analysis, env);
    
    return analysis;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof StorageError) {
      throw error;
    }
    throw new StorageError(`Error updating analysis: ${error.message}`, {
      billId: bill?.id,
      error: error.stack
    });
  }
}

/**
 * Get bill analysis by direct key
 * @param {string} analysisKey - The analysis key
 * @param {Object} env - Environment variables with KV binding
 * @returns {Promise<Object>} - The analysis data
 * @throws {NotFoundError} If analysis is not found
 * @throws {StorageError} If storage operation fails
 */
export async function getAnalysisByKey(analysisKey, env) {
  try {
    if (!analysisKey) {
      throw new ValidationError('Analysis key is required');
    }
    
    const analysisData = await env.NH_LEGISLATIVE_DATA.get(analysisKey, { type: 'json' })
      .catch(error => {
        throw new StorageError(`Failed to get analysis data: ${error.message}`, {
          analysisKey
        });
      });
    
    if (!analysisData) {
      throw new NotFoundError(`Analysis not found for key: ${analysisKey}`);
    }
    
    return analysisData;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof StorageError) {
      throw error;
    }
    throw new StorageError(`Error retrieving analysis: ${error.message}`, {
      analysisKey,
      error: error.stack
    });
  }
}
