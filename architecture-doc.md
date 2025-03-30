# Legislative Tracking System Architecture Document

## 1. System Overview

The Legislative Tracking System is designed to aggregate, store, and serve legislative data from multiple states using the OpenStates API as the primary data source. The system follows a serverless architecture using Cloudflare Workers and KV storage to ensure high availability, scalability, and cost efficiency.

### 1.1 Key Requirements

- **Efficiency**: Minimize API calls to OpenStates to prevent rate limiting and DoS situations
- **Reliability**: Ensure data is consistently available even during high traffic
- **Separation of Concerns**: Public endpoints never directly hit the OpenStates API
- **Cost-effectiveness**: Optimize for minimal resource usage
- **Scalability**: Support growing data and user base without architectural changes

### 1.2 System Components

1. **Data Collection Service**: Background worker that fetches and updates legislative data
2. **Data Storage Layer**: Persistent storage using Cloudflare KV
3. **API Gateway**: Interface for frontend to access stored data
4. **Caching Layer**: Performance optimization to reduce KV operations
5. **Frontend Application**: User interface for browsing and searching legislation

## 2. Component Architecture

### 2.1 Data Collection Service

The Data Collection Service is implemented as a scheduled Cloudflare Worker that runs periodically to fetch updated legislative data from the OpenStates API.

**Key Features:**
- Scheduled execution (every 6 hours by default)
- Incremental updates based on last update timestamps
- Automatic pagination handling
- Rate limiting awareness with backoff strategies
- Error handling and retry logic

**Implementation Details:**
- Uses Cloudflare Workers Cron Triggers
- Maintains state via KV for tracking last update times
- Optimized batch processing for KV write operations
- Configurable for different states and update frequencies

### 2.2 Data Storage Layer

The system uses Cloudflare KV as the primary data store, organizing data efficiently for quick retrieval.

**Storage Structure:**
- **Bills**: `bill:{state}:{session}:{identifier}` → JSON of bill data
- **Indexes**: `index:{state}:{session}` → Array of bill identifiers
- **Metadata**: Various keys for configuration and tracking

**Design Considerations:**
- KV has a 25MB value size limit, which is sufficient for individual bill data
- Indexing strategy optimizes for common query patterns
- Uses structured keys for efficient list operations

### 2.3 API Gateway

The API Gateway serves as the interface between the frontend and the data storage layer.

**Endpoints:**
- `/api/bills` - Access bill data with various query parameters
- `/api/states` - List available states
- `/api/sessions` - List sessions for a specific state
- `/api/health` - System health check

**Features:**
- Request validation and sanitization
- CORS support for cross-origin requests
- Error handling with appropriate HTTP status codes
- Pagination for large result sets

### 2.4 Caching Layer

The Caching Layer improves performance by reducing the number of KV operations needed for frequently accessed data.

**Caching Strategy:**
- Tiered TTLs based on data type:
  - States: 24 hours (rarely changes)
  - Sessions: 12 hours (stable data)
  - Bills: 30 minutes (may change more frequently)
  - Search results: 5 minutes (frequent changes)
- Cache invalidation on data updates
- Cache-Control headers for browser caching
- Uses Cloudflare's edge cache for global distribution

### 2.5 Frontend Application

The frontend is a React-based single-page application that provides a user-friendly interface for accessing legislative data.

**Key Features:**
- Responsive design for mobile and desktop
- State and session browsing
- Bill search and filtering
- Detailed bill views with history and sponsor information
- Pagination for large result sets

**Implementation Details:**
- Built with React and React Router
- Communicates exclusively with the API Gateway
- Implements client-side caching for improved performance
- Follows accessibility best practices

## 3. Data Flow

### 3.1 Data Collection Flow

1. Scheduled worker triggers every 6 hours
2. Worker retrieves last update timestamps from KV
3. For each configured state:
   a. Fetch bills updated since last timestamp from OpenStates API
   b. Process bills in batches to avoid overwhelming KV
   c. Store bills in KV with appropriate keys
   d. Update indexes for efficient retrieval
   e. Update last update timestamp
4. Log completion and any errors

### 3.2 User Request Flow

1. User navigates to a page in the frontend application
2. Frontend makes request to API Gateway
3. API Gateway checks cache for the requested data
4. If cache hit: Return cached data directly
5. If cache miss:
   a. Retrieve data from KV storage
   b. Format response
   c. Store in cache for future requests
   d. Return data to frontend
6. Frontend renders the data for the user

### 3.3 Search Flow

1. User submits search query
2. Frontend sends request to API Gateway
3. API Gateway processes search parameters
4. For basic searches:
   a. Use existing indexes to filter bills
   b. Retrieve matching bills from KV
5. For complex searches:
   a. Retrieve broader set of bills based on filters
   b. Apply in-memory filtering for complex criteria
6. Return paginated results to frontend
7. Cache search results with short TTL

## 4. Scalability Considerations

### 4.1 KV Storage Limits

- Each KV namespace has a limit of:
  - 1 billion keys
  - Maximum value size of 25MB
  - 1000 writes per second (with burst capacity)
  - 100,000 reads per second

**Mitigation Strategies:**
- Implement pagination to limit result sets
- Use batch operations for writes
- Consider moving to D1 database for more complex queries if needed

### 4.2 Rate Limiting

**OpenStates API:**
- Standard limits of 30 requests per minute
- Scheduled worker respects these limits with appropriate delays
- Implements exponential backoff for rate limit errors

**Our API Gateway:**
- Implements basic rate limiting to prevent abuse
- Uses Cloudflare's built-in protection against DDoS attacks

### 4.3 Data Growth Planning

As the system tracks more states and builds historical data:

1. **Indexing Strategy:**
   - Create time-based partitions for historical data
   - Archive older sessions to cold storage if needed

2. **Query Optimization:**
   - Implement more sophisticated caching for common queries
   - Add specialized indexes for frequently used filters

3. **Storage Expansion:**
   - Plan for migration to D1 SQL database for complex queries
   - Consider hybrid storage approach with KV for hot data and D1 for historical data

## 5. Security Considerations

### 5.1 API Security

- API key for OpenStates stored securely as Worker Secret
- No authentication required for public API endpoints (read-only)
- Implement rate limiting to prevent abuse
- Validate and sanitize all input parameters

### 5.2 Data Protection

- No personally identifiable information (PII) is stored in the system
- All data is publicly available from official sources
- Apply principle of least privilege for all components

### 5.3 CORS Policy

- Implement appropriate CORS headers for API Gateway
- Restrict to known origins in production

## 6. Monitoring and Maintenance

### 6.1 Logging

- Structured logging for all components
- Capture key metrics:
  - API response times
  - Cache hit/miss ratios
  - Error rates
  - Data collection statistics

### 6.2 Alerting

- Set up alerts for:
  - Failed data collection jobs
  - Elevated error rates
  - Approaching storage limits
  - Rate limit warnings

### 6.3 Regular Maintenance

- Review and update state configurations quarterly
- Validate data accuracy against source periodically
- Clean up expired or redundant data
- Update dependencies and security patches

## 7. Deployment Strategy

### 7.1 Environment Setup

- **Development:** Local environment with wrangler dev
- **Staging:** Separate namespace with sample data
- **Production:** Full deployment with monitoring

### 7.2 Continuous Integration/Deployment

- GitHub Actions workflow for automated testing and deployment
- Staged deployment process:
  1. Run automated tests
  2. Deploy to staging environment
  3. Run integration tests
  4. Deploy to production with approval

### 7.3 Rollback Plan

- Maintain versioned deployments
- Ability to quickly roll back to previous version
- Automated health checks post-deployment

## 8. Cost Optimization

### 8.1 Cloudflare Workers

- Generous free tier: 100,000 requests per day
- Beyond free tier: $0.50 per million requests
- Use edge caching to reduce worker invocations

### 8.2 KV Storage

- Free tier: 1GB storage, 100,000 reads/day, 1,000 writes/day
- Beyond free tier:
  - $0.50 per GB of storage per month
  - $0.50 per million reads
  - $5.00 per million writes
- Optimize by:
  - Batching write operations
  - Implementing efficient caching
  - Cleaning up unnecessary data

### 8.3 Data Transfer

- Cloudflare includes generous bandwidth allowances
- Optimize payload sizes to reduce costs

## 9. Future Enhancements

### 9.1 Technical Improvements

- Implement full text search capabilities
- Add WebSocket support for real-time updates
- Develop admin interface for system monitoring
- Expand to D1 database for complex queries

### 9.2 Feature Roadmap

- User accounts for personalized tracking
- Email/notification alerts for bill status changes
- Data visualization dashboards
- Legislative comparison tools
- API access for third-party integrations

## 10. Conclusion

This architecture provides a robust, scalable, and cost-effective solution for tracking legislative data across multiple states. By leveraging Cloudflare's serverless platform, we can deliver a responsive user experience while maintaining efficient data collection from the OpenStates API.

The system is designed with future growth in mind, allowing for expansion to additional states, more sophisticated features, and increased user load without significant architectural changes.

---

## Appendix A: Key Dependencies

- **Cloudflare Workers**: Serverless execution environment
- **Cloudflare KV**: Key-value storage
- **OpenStates API**: Primary data source
- **React**: Frontend framework
- **React Router**: Client-side routing
- **Papa Parse**: CSV parsing (for potential data export)

## Appendix B: API Reference

Detailed API documentation is available in the separate API Reference document.