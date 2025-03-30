// rate-limiting.js
// Rate limiting middleware for the NH Legislative Accountability System API

const { RateLimitError } = require('./error-handling');

/**
 * Basic rate limiter that uses Cloudflare KV to track request counts
 */
class RateLimiter {
  /**
   * Create a new rate limiter
   * @param {Object} options - Rate limiter options
   * @param {number} options.limit - Max requests per window (default: 60)
   * @param {number} options.windowSec - Time window in seconds (default: 60)
   * @param {string} options.keyPrefix - KV key prefix (default: 'rate_limit')
   * @param {Function} options.keyGenerator - Function to generate rate limit key
   */
  constructor(options = {}) {
    this.limit = options.limit || 60; // Default: 60 requests
    this.windowSec = options.windowSec || 60; // Default: per minute
    this.keyPrefix = options.keyPrefix || 'rate_limit';
    
    // Default key generator uses IP address
    this.keyGenerator = options.keyGenerator || ((request) => {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      return `${this.keyPrefix}:${ip}`;
    });
  }

  /**
   * Check if a request is within rate limits
   * @param {Request} request - The request to check
   * @param {Object} env - Environment with KV binding
   * @returns {Promise<Object>} - Rate limit status
   * @throws {RateLimitError} If rate limit is exceeded
   */
  async checkLimit(request, env) {
    const key = this.keyGenerator(request);
    
    // Get current count from KV
    const countData = await env.NH_LEGISLATIVE_METADATA.get(key, { type: 'json' });
    
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - this.windowSec;
    
    let count = 0;
    let resetTime = now + this.windowSec;
    
    if (countData) {
      // If the window has not expired, use the existing count
      if (countData.timestamp > windowStart) {
        count = countData.count;
        resetTime = countData.timestamp + this.windowSec;
      }
    }
    
    // Increment count
    count++;
    
    // Create the new rate limit data
    const newData = {
      count,
      timestamp: now,
    };
    
    // Store in KV with expiration
    await env.NH_LEGISLATIVE_METADATA.put(key, JSON.stringify(newData), {
      expirationTtl: this.windowSec * 2, // Double the window to ensure expiration
    });
    
    // Calculate remaining requests
    const remaining = Math.max(0, this.limit - count);
    
    // Check if rate limit is exceeded
    if (count > this.limit) {
      throw new RateLimitError('Rate limit exceeded', {
        limit: this.limit,
        remaining: 0,
        reset: resetTime,
      });
    }
    
    return {
      limit: this.limit,
      remaining,
      reset: resetTime,
    };
  }

  /**
   * Create middleware for rate limiting
   * @returns {Function} - Middleware function
   */
  middleware() {
    return async (request, env, ctx) => {
      try {
        const limitStatus = await this.checkLimit(request, env);
        
        // Call the next handler
        const response = await ctx.next();
        
        // Add rate limit headers to the response
        const headers = new Headers(response.headers);
        headers.set('X-RateLimit-Limit', limitStatus.limit.toString());
        headers.set('X-RateLimit-Remaining', limitStatus.remaining.toString());
        headers.set('X-RateLimit-Reset', limitStatus.reset.toString());
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      } catch (error) {
        if (error instanceof RateLimitError) {
          // Return rate limit exceeded response
          const headers = new Headers({
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': error.details.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': error.details.reset.toString(),
          });
          
          return new Response(JSON.stringify(error.toJSON()), {
            status: 429,
            headers,
          });
        }
        
        // Re-throw other errors
        throw error;
      }
    };
  }
}

/**
 * Create different rate limiters for various API endpoints
 * @returns {Object} - Object with rate limiters for different endpoints
 */
function createRateLimiters() {
  return {
    // Default rate limiter: 60 requests per minute
    default: new RateLimiter({ 
      limit: 60, 
      windowSec: 60,
      keyPrefix: 'rate_limit:default'
    }),
    
    // Search endpoint: 30 requests per minute
    search: new RateLimiter({ 
      limit: 30, 
      windowSec: 60,
      keyPrefix: 'rate_limit:search'
    }),
    
    // Analysis endpoint: 20 requests per minute
    analysis: new RateLimiter({ 
      limit: 20, 
      windowSec: 60,
      keyPrefix: 'rate_limit:analysis'
    }),
    
    // Bills endpoint: 100 requests per minute
    bills: new RateLimiter({ 
      limit: 100, 
      windowSec: 60,
      keyPrefix: 'rate_limit:bills'
    }),
  };
}

module.exports = {
  RateLimiter,
  createRateLimiters,
}; 