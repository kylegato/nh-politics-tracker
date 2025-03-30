// caching-middleware.js
// Enhanced middleware to implement caching using Cloudflare Cache API

const { StorageError } = require('./error-handling');

/**
 * Create a cached response handler with stale-while-revalidate support
 * @param {Function} handler - The original handler function
 * @param {Object} options - Caching options
 * @returns {Function} - Wrapped handler with caching
 */
export function withCache(handler, options = {}) {
  const {
    cacheTtl = 3600, // Default cache TTL: 1 hour
    staleWhileRevalidateTtl = 600, // Default stale TTL: 10 minutes
    cacheControl = null, // Will be auto-generated if not provided
    bypassCache = false,
    varyHeaders = ['Accept', 'Accept-Encoding'],
    compression = true,
  } = options;
  
  // Generate cache control header if not provided
  const cacheControlHeader = cacheControl || 
    `public, max-age=${cacheTtl}, stale-while-revalidate=${staleWhileRevalidateTtl}`;
  
  return async (request, env, ctx) => {
    // Skip caching for non-GET requests
    if (request.method !== 'GET') {
      return handler(request, env, ctx);
    }
    
    // Check if we should bypass cache
    const url = new URL(request.url);
    if (bypassCache || url.searchParams.has('nocache')) {
      return handler(request, env, ctx);
    }
    
    // Create a cache key from the request URL and any relevant headers
    const cacheKey = await createCacheKey(request, varyHeaders);
    
    // Try to get from cache first
    const cache = caches.default;
    let response = await cache.match(cacheKey);
    
    // Handle cached response
    if (response) {
      // Add header to indicate cache hit
      const headers = new Headers(response.headers);
      headers.set('X-Cache', 'HIT');
      
      // Check if the cached response is stale
      const dateHeader = headers.get('Date');
      const cacheDate = dateHeader ? new Date(dateHeader).getTime() : 0;
      const ageInSeconds = (Date.now() - cacheDate) / 1000;
      
      if (ageInSeconds > cacheTtl && ageInSeconds <= (cacheTtl + staleWhileRevalidateTtl)) {
        // If stale, set header and trigger background revalidation
        headers.set('X-Cache-Status', 'STALE');
        
        // Create stale response to return immediately
        const staleResponse = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
        
        // Revalidate in the background
        ctx.waitUntil(revalidateCache(cacheKey, handler, request, env, ctx, {
          cacheTtl,
          staleWhileRevalidateTtl,
          cacheControlHeader,
          compression
        }));
        
        return staleResponse;
      }
      
      // Fresh cache hit
      headers.set('X-Cache-Status', 'FRESH');
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
    
    // Cache miss - get from handler
    try {
      response = await handler(request, env, ctx);
      
      // Don't cache error responses
      if (response.status >= 400) {
        const errorHeaders = new Headers(response.headers);
        errorHeaders.set('X-Cache', 'BYPASS');
        errorHeaders.set('X-Cache-Status', 'ERROR');
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: errorHeaders,
        });
      }
      
      // Clone the response before caching
      const clonedResponse = response.clone();
      const headers = new Headers(clonedResponse.headers);
      
      // Set caching headers
      headers.set('Cache-Control', cacheControlHeader);
      headers.set('X-Cache', 'MISS');
      headers.set('X-Cache-Status', 'MISS');
      
      // Apply compression if enabled
      let responseBody = clonedResponse.body;
      if (compression && clonedResponse.headers.get('Content-Type')?.includes('application/json')) {
        // Compress JSON responses
        const responseText = await clonedResponse.text();
        responseBody = JSON.stringify(JSON.parse(responseText));
        headers.set('Content-Encoding', 'gzip');
      }
      
      // Create a cacheable response
      const cachedResponse = new Response(responseBody, {
        status: clonedResponse.status,
        statusText: clonedResponse.statusText,
        headers,
      });
      
      // Store in cache
      ctx.waitUntil(cache.put(cacheKey, cachedResponse.clone()));
      
      return cachedResponse;
    } catch (error) {
      // Handle errors in the handler
      console.error(`Cache handler error: ${error.message}`, error);
      
      // Return error response
      const errorHeaders = new Headers({
        'Content-Type': 'application/json',
        'X-Cache': 'BYPASS',
        'X-Cache-Status': 'ERROR',
      });
      
      return new Response(JSON.stringify({
        error: {
          message: 'An error occurred processing your request',
          code: 'HANDLER_ERROR',
        }
      }), {
        status: 500,
        headers: errorHeaders,
      });
    }
  };
}

/**
 * Revalidate a cached response in the background
 * @param {Request} cacheKey - The cache key request
 * @param {Function} handler - The original handler function
 * @param {Request} request - The original request
 * @param {Object} env - Environment variables
 * @param {Object} ctx - Context object
 * @param {Object} options - Cache options
 * @returns {Promise<void>}
 */
async function revalidateCache(cacheKey, handler, request, env, ctx, options) {
  try {
    // Execute the handler to get fresh data
    const freshResponse = await handler(request.clone(), env, ctx);
    
    // Don't cache error responses
    if (freshResponse.status >= 400) {
      return;
    }
    
    // Prepare the response for caching
    const headers = new Headers(freshResponse.headers);
    headers.set('Cache-Control', options.cacheControlHeader);
    headers.set('X-Cache', 'REVALIDATED');
    headers.set('X-Cache-Status', 'FRESH');
    
    // Apply compression if enabled
    let responseBody = freshResponse.body;
    if (options.compression && freshResponse.headers.get('Content-Type')?.includes('application/json')) {
      const responseText = await freshResponse.text();
      responseBody = JSON.stringify(JSON.parse(responseText));
      headers.set('Content-Encoding', 'gzip');
    }
    
    // Create a cacheable response
    const cachedResponse = new Response(responseBody, {
      status: freshResponse.status,
      statusText: freshResponse.statusText,
      headers,
    });
    
    // Update the cache
    const cache = caches.default;
    await cache.put(cacheKey, cachedResponse);
    
    console.log(`Successfully revalidated cache for ${cacheKey.url}`);
  } catch (error) {
    console.error(`Error revalidating cache: ${error.message}`, error);
    // We don't throw here since this is a background operation
  }
}

/**
 * Create a unique cache key from the request
 * @param {Request} request - The original request
 * @param {Array} varyHeaders - Headers to include in cache key
 * @returns {Request} - A new request to use as cache key
 */
async function createCacheKey(request, varyHeaders = []) {
  // Create a new request to use as the cache key
  const url = new URL(request.url);
  
  // Sort query parameters for consistent cache keys
  const params = Array.from(url.searchParams.entries())
    .sort((a, b) => a[0].localeCompare(b[0]));
  
  url.search = new URLSearchParams(params).toString();
  
  const cacheKeyRequest = new Request(url.toString());
  
  // Copy relevant headers to the cache key request
  const headers = new Headers();
  
  for (const name of varyHeaders) {
    const value = request.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }
  
  // Create a new request with these headers to use as a cache key
  return new Request(url.toString(), {
    headers,
    method: 'GET',
  });
}

/**
 * Apply cache middleware to API Gateway routes with appropriate TTLs
 * @param {Object} routes - Object with route handler functions
 * @returns {Object} - Object with cached route handler functions
 */
export function applyCacheToRoutes(routes) {
  const cachedRoutes = {};
  
  // Define TTLs for different types of resources
  const ttlConfig = {
    bills: {
      cacheTtl: 1800, // 30 minutes
      staleWhileRevalidateTtl: 3600, // 1 hour stale
    },
    states: {
      cacheTtl: 86400, // 24 hours
      staleWhileRevalidateTtl: 259200, // 3 days stale
    },
    sessions: {
      cacheTtl: 43200, // 12 hours
      staleWhileRevalidateTtl: 86400, // 1 day stale
    },
    analysis: {
      cacheTtl: 3600, // 1 hour
      staleWhileRevalidateTtl: 7200, // 2 hours stale
    },
    default: {
      cacheTtl: 3600, // 1 hour
      staleWhileRevalidateTtl: 3600, // 1 hour stale
    }
  };
  
  for (const [path, handler] of Object.entries(routes)) {
    // Determine the appropriate TTL based on route
    let config = ttlConfig.default;
    
    if (path.includes('/bills')) {
      config = ttlConfig.bills;
    } else if (path.includes('/states')) {
      config = ttlConfig.states;
    } else if (path.includes('/sessions')) {
      config = ttlConfig.sessions;
    } else if (path.includes('/analysis')) {
      config = ttlConfig.analysis;
    }
    
    cachedRoutes[path] = withCache(handler, {
      cacheTtl: config.cacheTtl,
      staleWhileRevalidateTtl: config.staleWhileRevalidateTtl,
      cacheControl: `public, max-age=${config.cacheTtl}, stale-while-revalidate=${config.staleWhileRevalidateTtl}`,
    });
  }
  
  return cachedRoutes;
}

/**
 * Clear the cache for specific patterns
 * @param {Object} env - Environment with KV bindings
 * @param {Array} patterns - URL patterns to clear from cache
 * @returns {Promise<Object>} - Result of cache clearing operation
 */
export async function clearCache(env, patterns = []) {
  try {
    // Track cache purge events in KV
    const timestamp = new Date().toISOString();
    const purgeId = `purge_${Date.now()}`;
    
    // Store purge record
    await env.NH_LEGISLATIVE_METADATA.put(`cache_purge:${purgeId}`, JSON.stringify({
      id: purgeId,
      timestamp,
      patterns,
      status: 'requested'
    }));
    
    // For each pattern, update a special KV entry that changes on purge
    // This will be used by the API to detect when to bypass cache
    for (const pattern of patterns) {
      const normalizedPattern = pattern.replace(/[^a-zA-Z0-9]/g, '_');
      const purgeKey = `cache_version:${normalizedPattern}`;
      
      // Get current version or start at 1
      const currentVersion = await env.NH_LEGISLATIVE_METADATA.get(purgeKey) || '0';
      const newVersion = (parseInt(currentVersion, 10) + 1).toString();
      
      // Update version
      await env.NH_LEGISLATIVE_METADATA.put(purgeKey, newVersion);
    }
    
    // Update purge status
    await env.NH_LEGISLATIVE_METADATA.put(`cache_purge:${purgeId}`, JSON.stringify({
      id: purgeId,
      timestamp,
      patterns,
      status: 'completed',
      completedAt: new Date().toISOString()
    }));
    
    return {
      success: true,
      purgeId,
      timestamp,
      message: `Cache purge completed for patterns: ${patterns.join(', ')}`,
    };
  } catch (error) {
    console.error(`Error purging cache: ${error.message}`, error);
    
    throw new StorageError(`Failed to purge cache: ${error.message}`, {
      patterns,
      error: error.stack
    });
  }
}

/**
 * Get the current cache version for a URL pattern
 * Used to create cache-busting URLs when needed
 * @param {Object} env - Environment with KV bindings
 * @param {string} pattern - URL pattern to check
 * @returns {Promise<string>} - Current cache version
 */
export async function getCacheVersion(env, pattern) {
  try {
    const normalizedPattern = pattern.replace(/[^a-zA-Z0-9]/g, '_');
    const purgeKey = `cache_version:${normalizedPattern}`;
    
    // Get current version or default to 1
    const version = await env.NH_LEGISLATIVE_METADATA.get(purgeKey) || '1';
    return version;
  } catch (error) {
    console.error(`Error getting cache version: ${error.message}`);
    return '1'; // Default version
  }
}

/**
 * Create a URL with cache busting parameter
 * @param {string} url - Original URL
 * @param {string} version - Cache version
 * @returns {string} - URL with cache busting parameter
 */
export function createCacheBustUrl(url, version) {
  const urlObj = new URL(url);
  urlObj.searchParams.set('v', version);
  return urlObj.toString();
}

module.exports = {
  withCache,
  applyCacheToRoutes,
  clearCache,
  getCacheVersion,
  createCacheBustUrl
};
