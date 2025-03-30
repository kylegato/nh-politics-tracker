// monitoring.js
// Monitoring and logging utilities for the NH Legislative Accountability System

/**
 * Log levels
 */
const LOG_LEVELS = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
  FATAL: 50,
};

/**
 * Configuration for the logger
 */
const DEFAULT_CONFIG = {
  minLevel: LOG_LEVELS.INFO,
  includeTimestamp: true,
  redactSecrets: true,
  secretPatterns: [
    /api[-_]?key/i,
    /auth[-_]?token/i,
    /pass(word)?/i,
    /secret/i,
  ]
};

/**
 * Create a structured logger
 * @param {Object} options - Logger options
 * @returns {Object} - Logger object
 */
function createLogger(options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  
  /**
   * Log a message at the specified level
   * @param {number} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  function log(level, message, data = {}) {
    // Skip logging if level is below minimum
    if (level < config.minLevel) {
      return;
    }
    
    // Create log entry
    const entry = {
      level: getLevelName(level),
      message,
      ...(config.includeTimestamp ? { timestamp: new Date().toISOString() } : {}),
    };
    
    // Include additional data if provided
    if (Object.keys(data).length > 0) {
      // Redact secrets if configured
      const processedData = config.redactSecrets ? redactSensitiveData(data, config.secretPatterns) : data;
      entry.data = processedData;
    }
    
    // Output log entry
    if (level >= LOG_LEVELS.ERROR) {
      console.error(JSON.stringify(entry));
    } else if (level >= LOG_LEVELS.WARN) {
      console.warn(JSON.stringify(entry));
    } else {
      console.log(JSON.stringify(entry));
    }
    
    // Store high severity logs in KV for later analysis
    if (level >= LOG_LEVELS.ERROR && data.env) {
      storeLogEntry(entry, data.env).catch(error => {
        console.error(`Failed to store log entry: ${error.message}`);
      });
    }
  }
  
  /**
   * Store a log entry in KV for persistent logging
   * @param {Object} entry - Log entry
   * @param {Object} env - Environment with KV binding
   */
  async function storeLogEntry(entry, env) {
    try {
      const key = `log:${Date.now()}:${Math.random().toString(36).substring(2, 10)}`;
      
      // Store log with expiration (30 days)
      await env.NH_LEGISLATIVE_METADATA.put(key, JSON.stringify(entry), {
        expirationTtl: 60 * 60 * 24 * 30, // 30 days
      });
    } catch (error) {
      // Just log the error but don't throw
      console.error(`Error storing log entry: ${error.message}`);
    }
  }
  
  /**
   * Get the name of a log level
   * @param {number} level - Log level
   * @returns {string} - Level name
   */
  function getLevelName(level) {
    for (const [name, value] of Object.entries(LOG_LEVELS)) {
      if (value === level) {
        return name;
      }
    }
    return 'UNKNOWN';
  }
  
  /**
   * Redact sensitive data in object
   * @param {Object} data - Data to process
   * @param {Array} patterns - Regex patterns for sensitive fields
   * @returns {Object} - Redacted data
   */
  function redactSensitiveData(data, patterns) {
    const result = {};
    
    for (const [key, value] of Object.entries(data)) {
      // Check if key matches any sensitive patterns
      const isSensitive = patterns.some(pattern => pattern.test(key));
      
      if (isSensitive && typeof value === 'string') {
        // Redact sensitive string values
        result[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        // Recursively process nested objects
        result[key] = redactSensitiveData(value, patterns);
      } else {
        // Pass through non-sensitive values
        result[key] = value;
      }
    }
    
    return result;
  }
  
  // Create logger interface
  return {
    debug: (message, data) => log(LOG_LEVELS.DEBUG, message, data),
    info: (message, data) => log(LOG_LEVELS.INFO, message, data),
    warn: (message, data) => log(LOG_LEVELS.WARN, message, data),
    error: (message, data) => log(LOG_LEVELS.ERROR, message, data),
    fatal: (message, data) => log(LOG_LEVELS.FATAL, message, data),
  };
}

/**
 * Create middleware to log API requests
 * @param {Object} logger - Logger instance
 * @returns {Function} - Middleware function
 */
function createRequestLogger(logger) {
  return async (request, env, ctx) => {
    // Generate a unique request ID
    const requestId = Math.random().toString(36).substring(2, 15);
    
    // Start timing the request
    const startTime = Date.now();
    
    // Extract request details for logging
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;
    
    // Log the incoming request
    logger.info(`Request received: ${method} ${path}`, {
      requestId,
      method,
      path,
      query: Object.fromEntries(url.searchParams.entries()),
      userAgent: request.headers.get('User-Agent'),
      clientIp: request.headers.get('CF-Connecting-IP'),
      env,
    });
    
    try {
      // Process the request
      const response = await ctx.next();
      
      // Calculate request duration
      const duration = Date.now() - startTime;
      
      // Log the successful response
      logger.info(`Request completed: ${method} ${path}`, {
        requestId,
        status: response.status,
        duration,
        env,
      });
      
      // Add headers to the response
      const headers = new Headers(response.headers);
      headers.set('X-Request-ID', requestId);
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      // Calculate request duration
      const duration = Date.now() - startTime;
      
      // Log the error
      logger.error(`Error processing request: ${method} ${path}`, {
        requestId,
        error: {
          message: error.message,
          stack: error.stack,
        },
        duration,
        env,
      });
      
      // Re-throw the error for handling by error middleware
      throw error;
    }
  };
}

/**
 * Create a system metrics collector
 * @returns {Object} - Metrics collector
 */
function createMetricsCollector() {
  // Store metrics in memory
  const metrics = {
    requestCount: 0,
    errorCount: 0,
    requestDurations: [],
    apiCallCount: 0,
    kvOperations: {
      read: 0,
      write: 0,
    },
    analysisCount: 0,
  };
  
  // Reset duration stats periodically to avoid memory issues
  setInterval(() => {
    metrics.requestDurations = metrics.requestDurations.slice(-100);
  }, 60000);
  
  return {
    /**
     * Record a request being processed
     */
    recordRequest() {
      metrics.requestCount++;
    },
    
    /**
     * Record a request error
     */
    recordError() {
      metrics.errorCount++;
    },
    
    /**
     * Record request duration
     * @param {number} duration - Request duration in ms
     */
    recordDuration(duration) {
      metrics.requestDurations.push(duration);
    },
    
    /**
     * Record an API call to external service
     */
    recordApiCall() {
      metrics.apiCallCount++;
    },
    
    /**
     * Record a KV read operation
     */
    recordKvRead() {
      metrics.kvOperations.read++;
    },
    
    /**
     * Record a KV write operation
     */
    recordKvWrite() {
      metrics.kvOperations.write++;
    },
    
    /**
     * Record an analysis being performed
     */
    recordAnalysis() {
      metrics.analysisCount++;
    },
    
    /**
     * Get current metrics
     * @returns {Object} - Current metrics
     */
    getMetrics() {
      const durations = metrics.requestDurations;
      
      // Calculate statistics
      const avgDuration = durations.length > 0 
        ? durations.reduce((sum, val) => sum + val, 0) / durations.length 
        : 0;
      
      // Sort durations for percentiles
      const sortedDurations = [...durations].sort((a, b) => a - b);
      
      // Get 95th percentile if we have enough data
      const p95 = durations.length > 0 
        ? sortedDurations[Math.floor(durations.length * 0.95)] 
        : 0;
      
      // Get 99th percentile if we have enough data
      const p99 = durations.length > 0 
        ? sortedDurations[Math.floor(durations.length * 0.99)] 
        : 0;
      
      return {
        requests: {
          total: metrics.requestCount,
          errors: metrics.errorCount,
          errorRate: metrics.requestCount > 0 
            ? (metrics.errorCount / metrics.requestCount) * 100 
            : 0,
        },
        performance: {
          avgDuration,
          p95,
          p99,
        },
        operations: {
          apiCalls: metrics.apiCallCount,
          kvReads: metrics.kvOperations.read,
          kvWrites: metrics.kvOperations.write,
          analyses: metrics.analysisCount,
        },
        timestamp: new Date().toISOString(),
      };
    },
    
    /**
     * Save metrics to KV storage
     * @param {Object} env - Environment with KV binding
     */
    async saveMetrics(env) {
      try {
        const currentMetrics = this.getMetrics();
        const key = `metrics:${new Date().toISOString().split('T')[0]}:${Date.now()}`;
        
        await env.NH_LEGISLATIVE_METADATA.put(key, JSON.stringify(currentMetrics), {
          expirationTtl: 60 * 60 * 24 * 7, // Store for 7 days
        });
        
        // Update the latest metrics reference
        await env.NH_LEGISLATIVE_METADATA.put('metrics:latest', JSON.stringify(currentMetrics));
        
      } catch (error) {
        console.error(`Error saving metrics: ${error.message}`);
      }
    },
    
    /**
     * Create middleware to track request metrics
     * @returns {Function} - Middleware function
     */
    metricsMiddleware() {
      return async (request, env, ctx) => {
        // Record the request
        this.recordRequest();
        
        // Start timing
        const startTime = Date.now();
        
        try {
          // Process the request
          const response = await ctx.next();
          
          // Record duration
          const duration = Date.now() - startTime;
          this.recordDuration(duration);
          
          // Add headers with basic metrics
          const headers = new Headers(response.headers);
          headers.set('X-Request-Time', duration.toString());
          
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
          });
        } catch (error) {
          // Record error and duration
          this.recordError();
          this.recordDuration(Date.now() - startTime);
          
          // Re-throw for error handling
          throw error;
        }
      };
    },
  };
}

/**
 * Create a health check endpoint handler
 * @param {Object} metricsCollector - Metrics collector
 * @returns {Function} - Health check handler
 */
function createHealthCheckHandler(metricsCollector) {
  return async (request, env) => {
    // Check KV connectivity
    let kvStatus = 'unknown';
    try {
      await env.NH_LEGISLATIVE_METADATA.get('health_check');
      kvStatus = 'ok';
    } catch (error) {
      kvStatus = 'error';
    }
    
    // Get system metrics
    const metrics = metricsCollector.getMetrics();
    
    // Build health response
    const health = {
      status: kvStatus === 'ok' ? 'healthy' : 'degraded',
      version: process.env.VERSION || '1.0.0',
      timestamp: new Date().toISOString(),
      components: {
        kv: {
          status: kvStatus,
        },
      },
      metrics: {
        requestCount: metrics.requests.total,
        errorRate: metrics.requests.errorRate.toFixed(2) + '%',
        avgResponseTime: metrics.performance.avgDuration.toFixed(2) + 'ms',
      },
    };
    
    // Return health check response
    return new Response(JSON.stringify(health, null, 2), {
      status: health.status === 'healthy' ? 200 : 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  };
}

module.exports = {
  LOG_LEVELS,
  createLogger,
  createRequestLogger,
  createMetricsCollector,
  createHealthCheckHandler,
}; 