// error-handling.js
// Centralized error handling for the NH Legislative Accountability System

/**
 * Custom error class for the application
 */
export class ApplicationError extends Error {
  /**
   * Create a new application error
   * @param {string} message - Error message
   * @param {string} code - Error code
   * @param {number} statusCode - HTTP status code (for API errors)
   * @param {*} details - Additional error details
   */
  constructor(message, code = 'UNKNOWN_ERROR', statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Convert the error to a JSON response
   * @returns {Object} - Error as JSON
   */
  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        timestamp: this.timestamp,
        ...(this.details && { details: this.details })
      }
    };
  }

  /**
   * Convert the error to a Response object for API endpoints
   * @returns {Response} - Response object
   */
  toResponse() {
    return new Response(JSON.stringify(this.toJSON()), {
      status: this.statusCode,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}

/**
 * Data validation error
 */
export class ValidationError extends ApplicationError {
  constructor(message, details = null) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

/**
 * API error (for external API calls)
 */
export class ApiError extends ApplicationError {
  constructor(message, statusCode = 500, details = null) {
    super(message, 'API_ERROR', statusCode, details);
  }
}

/**
 * Storage error (for KV storage operations)
 */
export class StorageError extends ApplicationError {
  constructor(message, details = null) {
    super(message, 'STORAGE_ERROR', 500, details);
  }
}

/**
 * Not found error
 */
export class NotFoundError extends ApplicationError {
  constructor(message, details = null) {
    super(message, 'NOT_FOUND', 404, details);
  }
}

/**
 * Rate limit exceeded error
 */
export class RateLimitError extends ApplicationError {
  constructor(message, details = null) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, details);
  }
}

/**
 * Async error handler for API routes
 * @param {Function} handler - The route handler function
 * @returns {Function} - Wrapped handler with error handling
 */
export function withErrorHandling(handler) {
  return async (request, env, ctx) => {
    try {
      return await handler(request, env, ctx);
    } catch (error) {
      // Log the error
      console.error(`Error: ${error.message}`, error);

      // Return appropriate response based on error type
      if (error instanceof ApplicationError) {
        return error.toResponse();
      }

      // Convert unknown errors to application errors
      const appError = new ApplicationError(
        'An unexpected error occurred',
        'INTERNAL_ERROR',
        500
      );
      return appError.toResponse();
    }
  };
}

/**
 * Validate an object against a schema
 * @param {Object} data - The data to validate
 * @param {Object} schema - The validation schema
 * @throws {ValidationError} If validation fails
 */
export function validateData(data, schema) {
  const errors = [];

  for (const [field, rules] of Object.entries(schema)) {
    // Check required fields
    if (rules.required && (data[field] === undefined || data[field] === null)) {
      errors.push({ field, message: `${field} is required` });
      continue;
    }

    // Skip validation if field is not provided and not required
    if (data[field] === undefined || data[field] === null) {
      continue;
    }

    // Type validation
    if (rules.type && typeof data[field] !== rules.type) {
      errors.push({ field, message: `${field} must be a ${rules.type}` });
    }

    // Pattern validation
    if (rules.pattern && !rules.pattern.test(data[field])) {
      errors.push({ field, message: `${field} has invalid format` });
    }

    // Custom validation
    if (rules.validate && typeof rules.validate === 'function') {
      try {
        rules.validate(data[field]);
      } catch (error) {
        errors.push({ field, message: error.message });
      }
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Validation failed', errors);
  }
} 