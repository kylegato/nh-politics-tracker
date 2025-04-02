// api-gateway-improved.js
// Enhanced API Gateway for NH Legislative Accountability System

// Import error handling
import { withErrorHandling, ValidationError, NotFoundError } from './error-handling';

// Import caching middleware
import { applyCacheToRoutes, getCacheVersion, createCacheBustUrl, clearCache } from './caching-middleware';

// Import monitoring
import { 
  createLogger, 
  createRequestLogger, 
  createMetricsCollector,
  createHealthCheckHandler
} from './monitoring';

// Import analysis storage
import { getAnalysisByKey } from './analysis-storage';

// Import data collection functionality
import dataCollector from './data-collector';

// Import rate limiting (disabled by default)
import { createRateLimiters } from './rate-limiting';

// Initialize core components
const logger = createLogger();
const metricsCollector = createMetricsCollector();
const rateLimiters = createRateLimiters();

// Define route handlers
const routes = {
  // Analysis API
  '/api/analysis': async (request, env) => {
    const url = new URL(request.url);
    const billId = url.searchParams.get('bill_id');
    const analysisKey = url.searchParams.get('analysis_key');
    const highlighted = url.searchParams.get('highlighted');
    const impactType = url.searchParams.get('impact_type');
    
    // Track API operation
    metricsCollector.recordRequest();
    
    // Handle retrieving a specific bill analysis
    if (billId) {
      try {
        // Get the analysis key from bill ID
        metricsCollector.recordKvRead();
        const key = await env.NH_LEGISLATIVE_DATA.get(`bill:${billId}:analysis-key`);
        
        if (!key) {
          throw new NotFoundError(`No analysis found for bill ID: ${billId}`);
        }
        
        // Get the analysis using the key
        metricsCollector.recordKvRead();
        const analysis = await getAnalysisByKey(key, env);
        
        return new Response(JSON.stringify(analysis), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        if (error instanceof NotFoundError) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        
        logger.error(`Error retrieving analysis for bill ${billId}`, { error, env });
        
        return new Response(JSON.stringify({ error: 'Failed to retrieve analysis' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    
    // Handle retrieving analysis by direct key
    if (analysisKey) {
      try {
        metricsCollector.recordKvRead();
        const analysis = await getAnalysisByKey(analysisKey, env);
        
        return new Response(JSON.stringify(analysis), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        if (error instanceof NotFoundError) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        
        logger.error(`Error retrieving analysis for key ${analysisKey}`, { error, env });
        
        return new Response(JSON.stringify({ error: 'Failed to retrieve analysis' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    
    // Handle retrieving highlighted bills
    if (highlighted === 'true') {
      try {
        metricsCollector.recordKvRead();
        const highlightedBills = await env.NH_LEGISLATIVE_DATA.get('index:highlighted_bills', { type: 'json' }) || [];
        
        // Get analysis for each highlighted bill
        const analysisPromises = highlightedBills.map(async (billId) => {
          try {
            // Get the bill data
            metricsCollector.recordKvRead();
            const bill = await env.NH_LEGISLATIVE_DATA.get(`bill:${billId}`, { type: 'json' });
            
            if (!bill || !bill.nh_analysis_key) {
              return null;
            }
            
            // Get the analysis
            metricsCollector.recordKvRead();
            const analysis = await getAnalysisByKey(bill.nh_analysis_key, env);
            
            // Return bill data with analysis summary
            return {
              id: bill.id,
              identifier: bill.identifier,
              title: bill.title,
              analysis_key: bill.nh_analysis_key,
              summaries: {
                tax_impact: analysis.analyses?.tax_impact?.summary || null,
                budget_impact: analysis.analyses?.budget_impact?.summary || null,
                societal_impact: analysis.analyses?.societal_impact?.summary || null,
                institutional_alignment: analysis.analyses?.institutional_alignment?.summary || null,
              }
            };
          } catch (error) {
            logger.warn(`Error getting analysis for highlighted bill ${billId}`, { error, env });
            return null;
          }
        });
        
        // Wait for all analysis promises to resolve
        const analysisResults = (await Promise.all(analysisPromises)).filter(Boolean);
        
        return new Response(JSON.stringify({ 
          highlighted_bills: analysisResults,
          count: analysisResults.length
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        logger.error('Error retrieving highlighted bills', { error, env });
        
        return new Response(JSON.stringify({ error: 'Failed to retrieve highlighted bills' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    
    // Handle retrieving bills by impact type
    if (impactType) {
      try {
        // Validate impact type
        const validImpactTypes = ['tax_impact', 'budget_impact', 'societal_impact', 'institutional_alignment'];
        
        if (!validImpactTypes.includes(impactType)) {
          throw new ValidationError(`Invalid impact type. Must be one of: ${validImpactTypes.join(', ')}`);
        }
        
        // Get analysis summaries
        metricsCollector.recordKvRead();
        const summaries = await env.NH_LEGISLATIVE_METADATA.get('analysis_summaries', { type: 'json' }) || {};
        
        // Get summaries for the requested impact type
        const impactSummaries = summaries[impactType] || [];
        
        return new Response(JSON.stringify({ 
          impact_type: impactType,
          bills: impactSummaries,
          count: impactSummaries.length
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        if (error instanceof ValidationError) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        
        logger.error(`Error retrieving bills for impact type ${impactType}`, { error, env });
        
        return new Response(JSON.stringify({ error: 'Failed to retrieve impact analysis' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    
    // If no specific parameters, return summary of all analyses
    try {
      metricsCollector.recordKvRead();
      const summaries = await env.NH_LEGISLATIVE_METADATA.get('analysis_summaries', { type: 'json' }) || {};
      
      // Count analyses by type
      const counts = {
        tax_impact: summaries.tax_impact?.length || 0,
        budget_impact: summaries.budget_impact?.length || 0,
        societal_impact: summaries.societal_impact?.length || 0,
        institutional_alignment: summaries.institutional_alignment?.length || 0,
      };
      
      // Get highlighted bills count
      metricsCollector.recordKvRead();
      const highlightedBills = await env.NH_LEGISLATIVE_DATA.get('index:highlighted_bills', { type: 'json' }) || [];
      
      return new Response(JSON.stringify({ 
        summary: {
          highlighted_bills: highlightedBills.length,
          impact_counts: counts,
          total_analyses: Object.values(counts).reduce((sum, count) => sum + count, 0),
        }
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      logger.error('Error retrieving analysis summary', { error, env });
      
      return new Response(JSON.stringify({ error: 'Failed to retrieve analysis summary' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
  
  // Health check endpoint
  '/api/health': createHealthCheckHandler(metricsCollector),
  
  // Metrics endpoint (protected)
  '/api/metrics': async (request, env, ctx) => {
    // Simple API key check - in a real system, use a more robust auth mechanism
    const authHeader = request.headers.get('Authorization');
    const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    // Check if the provided API key matches the expected value
    if (!apiKey || apiKey !== env.API_KEY) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Get current metrics
    const metrics = metricsCollector.getMetrics();
    
    // Save metrics to KV for historical tracking - using waitUntil to ensure it completes
    // even after the response is returned
    const savePromise = metricsCollector.saveMetrics(env);
    ctx.waitUntil(savePromise);
    
    return new Response(JSON.stringify(metrics, null, 2), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  },
  
  // Cache control endpoint (protected)
  '/api/cache/purge': async (request, env) => {
    // Only allow POST method
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 
          'Content-Type': 'application/json',
          'Allow': 'POST',
        },
      });
    }
    
    // Simple API key check
    const authHeader = request.headers.get('Authorization');
    const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    // Check if the provided API key matches the expected value
    if (!apiKey || apiKey !== env.API_KEY) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    try {
      // Parse patterns from request body
      const { patterns } = await request.json();
      
      if (!patterns || !Array.isArray(patterns) || patterns.length === 0) {
        return new Response(JSON.stringify({ error: 'Invalid request body - patterns array required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Perform cache purge
      const result = await clearCache(env, patterns);
      
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      logger.error('Error purging cache', { error, env });
      
      return new Response(JSON.stringify({ error: 'Failed to purge cache' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
  
  // Admin endpoint to manually trigger data collection (protected)
  '/api/admin/trigger-collection': async (request, env, ctx) => {
    // Only allow POST method
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 
          'Content-Type': 'application/json',
          'Allow': 'POST',
        },
      });
    }
    
    // API key authentication
    const authHeader = request.headers.get('Authorization');
    const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    if (!apiKey || apiKey !== env.API_KEY) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    try {
      logger.info('Manual trigger of data collection process', { env });
      
      // Create a mock scheduled event
      const mockEvent = {
        scheduledTime: new Date().getTime(),
        cron: 'manual-trigger'
      };
      
      // Run the data collection process by calling the scheduled handler
      const collectionPromise = dataCollector.scheduled(mockEvent, env, ctx);
      ctx.waitUntil(collectionPromise.catch(error => {
        console.error(`Error in background data collection: ${error.message}`, error);
        // Log error to KV for later analysis
        return env.NH_LEGISLATIVE_METADATA.put(
          `error:data_collection:${Date.now()}`,
          JSON.stringify({
            timestamp: new Date().toISOString(),
            error: error.message,
            stack: error.stack
          })
        ).catch(err => {
          console.error(`Failed to log error to KV: ${err.message}`);
        });
      }));
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Data collection process triggered',
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      logger.error('Error triggering data collection', { error, env });
      
      return new Response(JSON.stringify({ 
        error: 'Failed to trigger data collection',
        message: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
};

// Apply middleware to routes
const cachedRoutes = applyCacheToRoutes(routes);

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// Main worker handler
export default {
  async fetch(request, env, ctx) {
    // Handle OPTIONS requests for CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders,
      });
    }
    
    // Parse the URL
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Create middleware stack
    const middlewares = [
      // Add request ID and logging
      createRequestLogger(logger),
      
      // Track request metrics
      metricsCollector.metricsMiddleware(),
      
      // Error handling wrapper
      withErrorHandling(async (request) => {
        // Find the route handler
        const handler = cachedRoutes[path];
        
        if (handler) {
          return await handler(request, env, ctx);
        }
        
        // Route not found
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    ];
    
    // Execute middleware stack
    let currentRequest = request;
    let currentHandler = async () => {
      // Route not found at the end of middleware chain
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        },
      });
    };
    
    // Build the middleware chain from right to left
    for (const middleware of middlewares.reverse()) {
      const nextHandler = currentHandler;
      currentHandler = async () => {
        return await middleware(currentRequest, env, {
          next: nextHandler,
        });
      };
    }
    
    // Execute the middleware chain
    try {
      const response = await currentHandler();
      
      // Add CORS headers to all responses
      const headers = new Headers(response.headers);
      
      for (const [key, value] of Object.entries(corsHeaders)) {
        headers.set(key, value);
      }
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      // Log any unhandled errors
      logger.fatal('Unhandled error in request processing', { 
        error: { message: error.message, stack: error.stack },
        path,
        method: request.method,
        env
      });
      
      // Return a generic error response
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        },
      });
    }
  }
}; 