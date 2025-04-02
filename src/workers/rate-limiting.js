// rate-limiting.js
// Rate limiting middleware for the NH Legislative Accountability System API

import { RateLimitError } from './error-handling';

/**
 * Basic rate limiter that uses Cloudflare KV to track request counts
 */
export class RateLimiter {
  /**
   * Create a new rate limiter
   * @param {Object} options - Rate limiter options
   * @param {number} options.limit - Max requests per window (default: 60)
   * @param {number} options.windowSec - Time window in seconds (default: 60)
   * @param {string} options.keyPrefix - KV key prefix (default: 'rate_limit')
   * @param {Function} options.keyGenerator - Function to generate rate limit key
   * @param {boolean} options.isEnabled - Whether rate limiting is enabled (default: false)
   */
  constructor(options = {}) {
    this.limit = options.limit || 60; // Default: 60 requests
    this.windowSec = options.windowSec || 60; // Default: per minute
    this.keyPrefix = options.keyPrefix || 'rate_limit';
    this.isEnabled = options.isEnabled !== undefined ? options.isEnabled : false; // Default: disabled
    
    // Default key generator uses IP address
    this.keyGenerator = options.keyGenerator || ((request) => {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      return `${this.keyPrefix}:${ip}`;
    });
  }

  /**
   * Check if a request is within rate limits
   * @param {Request} request - The request to check
   * @param {Object} env - Environment variables with KV binding
   * @returns {Promise<Object>} - Rate limit status
   * @throws {RateLimitError} If rate limit is exceeded
   */
  async checkLimit(request, env) {
    // If rate limiting is disabled, return unlimited status
    if (!this.isEnabled) {
      const now = Math.floor(Date.now() / 1000);
      return {
        limit: this.limit,
        remaining: this.limit,
        reset: now + this.windowSec,
      };
    }
    
    try {
      const key = this.keyGenerator(request);
      console.log(`Checking rate limit for key: ${key}`);
      
      // Get current count from KV
      let countData;
      try {
        countData = await env.NH_LEGISLATIVE_METADATA.get(key, { type: 'json' });
        console.log(`Rate limit data for ${key}: ${JSON.stringify(countData || 'not found')}`);
      } catch (error) {
        console.error(`Error reading rate limit data: ${error.message}`, error);
        // If we can't read the rate limit, we'll default to allowing the request
        // but with a reduced counter to ensure we eventually start rate limiting if needed
        countData = { count: Math.floor(this.limit / 2), timestamp: Math.floor(Date.now() / 1000) };
      }
      
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
      try {
        await env.NH_LEGISLATIVE_METADATA.put(key, JSON.stringify(newData), {
          expirationTtl: this.windowSec * 2, // Double the window to ensure expiration
        });
        console.log(`Updated rate limit for ${key}: count=${count}, limit=${this.limit}, reset=${resetTime}`);
        
        // Verify the write worked
        const verifyData = await env.NH_LEGISLATIVE_METADATA.get(key, { type: 'json' });
        if (!verifyData || verifyData.count !== count) {
          console.error(`Failed to verify rate limit data for ${key}`);
        }
      } catch (error) {
        console.error(`Error updating rate limit data: ${error.message}`, error);
        // Continue with the current count, but log the error
      }
      
      // Calculate remaining requests
      const remaining = Math.max(0, this.limit - count);
      
      // Check if rate limit is exceeded
      if (count > this.limit) {
        console.log(`Rate limit exceeded for ${key}: ${count} > ${this.limit}`);
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
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw error;
      }
      console.error(`Unexpected error in rate limiting: ${error.message}`, error);
      
      // Return a default safe value on unexpected errors
      const now = Math.floor(Date.now() / 1000);
      return {
        limit: this.limit,
        remaining: this.limit - 1, // Reduce by 1 to account for this request
        reset: now + this.windowSec,
      };
    }
  }

  /**
   * Create middleware for rate limiting
   * @returns {Function} - Middleware function
   */
  middleware() {
    return async (request, env, ctx) => {
      // If rate limiting is disabled, skip to the next handler
      if (!this.isEnabled) {
        return await ctx.next();
      }
      
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
          
          // Log rate limit events
          ctx.waitUntil((async () => {
            try {
              const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
              const url = new URL(request.url);
              const logKey = `rate_limit_exceeded:${Date.now()}`;
              
              await env.NH_LEGISLATIVE_METADATA.put(logKey, JSON.stringify({
                timestamp: new Date().toISOString(),
                ip: ip,
                path: url.pathname,
                limit: error.details.limit
              }), { expirationTtl: 86400 * 7 }); // Keep for 7 days
            } catch (logError) {
              console.error(`Failed to log rate limit event: ${logError.message}`);
            }
          })());
          
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
export function createRateLimiters() {
  // Check if rate limiting is enabled from environment variable
  const isEnabled = false; // Default to disabled
  
  return {
    // Default rate limiter: 60 requests per minute
    default: new RateLimiter({ 
      limit: 60, 
      windowSec: 60,
      keyPrefix: 'rate_limit:default',
      isEnabled: isEnabled
    }),
    
    // Search endpoint: 30 requests per minute
    search: new RateLimiter({ 
      limit: 30, 
      windowSec: 60,
      keyPrefix: 'rate_limit:search',
      isEnabled: isEnabled
    }),
    
    // Analysis endpoint: 20 requests per minute
    analysis: new RateLimiter({ 
      limit: 20, 
      windowSec: 60,
      keyPrefix: 'rate_limit:analysis',
      isEnabled: isEnabled
    }),
    
    // Bills endpoint: 100 requests per minute
    bills: new RateLimiter({ 
      limit: 100, 
      windowSec: 60,
      keyPrefix: 'rate_limit:bills',
      isEnabled: isEnabled
    }),
  };
} 