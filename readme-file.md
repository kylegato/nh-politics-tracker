# NH Legislative Accountability System

A serverless application that tracks New Hampshire legislative activity, analyzes bills using AI, and provides accountability metrics for representatives.

## Overview

This system collects data from the OpenStates API, analyzes bill text using Cloudflare Workers AI, and provides a user-friendly dashboard for citizens to understand the impact of legislation and track representative performance.

Key features:
- Real-time tracking of NH legislation
- AI-powered analysis of bill impacts (tax, budget, societal)
- Representative accountability metrics
- Committee attendance tracking
- Serverless architecture using Cloudflare Workers

## Requirements

- Cloudflare account with Workers & KV access
- Cloudflare Workers AI enabled
- OpenStates API key
- Node.js 16+ for local development
- npm or yarn

## Project Structure

```
/
├── src/
│   ├── workers/
│   │   ├── data-collector.js        # Scheduled worker for data collection
│   │   ├── api-gateway.js           # API endpoints for the frontend
│   │   ├── bill-analysis.js         # AI-powered bill analysis
│   │   ├── analysis-storage.js      # Storage management for analyses
│   │   └── nh-config.js             # NH-specific configuration
│   ├── components/                  # Frontend React components
│   │   ├── BillAnalysisDashboard.jsx
│   │   ├── AccountabilityDashboard.jsx
│   │   └── Tabs.js
│   └── styles/                      # CSS styles
│       ├── BillAnalysisDashboard.css
│       └── dashboard.css
├── wrangler.toml                    # Cloudflare Workers configuration
├── package.json
└── README.md
```

## Setup Instructions

### 1. Cloudflare Setup

1. **Create KV Namespaces**:
   - Log in to the Cloudflare dashboard
   - Navigate to Workers & Pages > KV
   - Create two namespaces:
     - `NH_LEGISLATIVE_DATA`
     - `NH_LEGISLATIVE_METADATA`
   - Note the namespace IDs for configuration

2. **Enable Workers AI**:
   - Navigate to Workers & Pages > AI
   - Enable Workers AI for your account
   - Verify access to the required models (Llama-3)

3. **Set Up Domain (optional)**:
   - Add your domain to Cloudflare if you plan to use a custom domain
   - Configure DNS settings as needed

### 2. Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/nh-legislative-tracker.git
   cd nh-legislative-tracker
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Install Wrangler CLI**:
   ```bash
   npm install -g wrangler
   ```

4. **Configure wrangler.toml**:
   - Edit the `wrangler.toml` file with your KV namespace IDs:
   ```toml
   # wrangler.toml
   name = "nh-legislative-tracker"
   compatibility_date = "2023-12-01"

   # KV Namespaces
   kv_namespaces = [
     { binding = "NH_LEGISLATIVE_DATA", id = "YOUR_KV_ID_HERE" },
     { binding = "NH_LEGISLATIVE_METADATA", id = "YOUR_KV_ID_HERE" }
   ]

   # Workers AI binding
   [ai]
   binding = "AI"

   # Schedule for the data collection worker
   [triggers]
   crons = ["0 */4 * * *"] # Every 4 hours
   ```

5. **Set up environment variables**:
   ```bash
   # Set OpenStates API key
   wrangler secret put OPENSTATES_API_KEY
   ```

### 3. Configuration

1. **Update NH-specific configuration**:
   - Edit `src/workers/nh-config.js` with any NH-specific settings
   - Adjust tracked committees, bill categories, etc.

2. **Configure frontend API URL**:
   - Set the API base URL in React components to match your deployed API gateway

## Deployment

### 1. Backend Deployment

1. **Deploy the data collection worker**:
   ```bash
   wrangler publish src/workers/data-collector.js
   ```

2. **Deploy the API gateway**:
   ```bash
   wrangler publish src/workers/api-gateway.js
   ```

3. **Configure scheduled triggers**:
   - Verify the CRON trigger is set up for the data collector
   - Default is every 4 hours (`0 */4 * * *`)

### 2. Frontend Deployment

1. **Build the frontend**:
   ```bash
   npm run build
   ```

2. **Deploy to Cloudflare Pages**:
   ```bash
   wrangler pages publish build
   ```

### 3. Initial Data Population

1. **Trigger initial data collection**:
   - Manually run the data collection worker:
   ```bash
   wrangler worker run data-collector
   ```

2. **Verify data in KV**:
   - Check the KV namespace for stored data
   - Confirm analyses are being generated and stored

## Usage

### API Endpoints

The system provides the following key API endpoints:

1. **Bill Analysis**:
   - `GET /api/analysis?bill_id={billId}` - Get analysis for a specific bill
   - `GET /api/analysis?analysis_key={analysisKey}` - Get analysis by key
   - `GET /api/analysis?bill_type=hb&chamber=house&bill_number=123` - Get analysis by bill identifiers
   - `GET /api/analysis?impact_type=tax_impact` - Get bills with a specific impact type
   - `GET /api/analysis?highlighted=true` - Get all bills with significant impacts

2. **Accountability**:
   - `GET /api/accountability?legislator={legislatorId}` - Get accountability metrics for a legislator
   - `GET /api/accountability?metric={metricId}` - Get rankings for a specific metric
   - `GET /api/accountability?committee={committeeId}` - Get committee attendance records

3. **Legislative Data**:
   - `GET /api/bills?id={billId}` - Get a specific bill
   - `GET /api/bills?session={sessionId}` - Get bills from a session
   - `GET /api/legislators?id={legislatorId}` - Get a specific legislator
   - `GET /api/committees?id={committeeId}` - Get a specific committee

### Dashboards

The system provides two main dashboards:

1. **Bill Analysis Dashboard**:
   - View bills with significant tax, budget, or societal impacts
   - Filter by impact type
   - Explore detailed analysis of each bill

2. **Accountability Dashboard**:
   - Compare NH representatives by attendance, sponsored bills, etc.
   - Track committee attendance
   - View detailed representative profiles

## Development

### Local Testing

1. **Test the data collector**:
   ```bash
   wrangler dev src/workers/data-collector.js
   ```

2. **Test the API gateway**:
   ```bash
   wrangler dev src/workers/api-gateway.js
   ```

3. **Run the frontend locally**:
   ```bash
   npm start
   ```

### Adding New Features

1. **Extend bill analysis**:
   - Modify `src/workers/bill-analysis.js` to add new analysis types
   - Update the system prompts and response handling

2. **Add accountability metrics**:
   - Extend the data collection in `src/workers/data-collector.js`
   - Add new API endpoints in `src/workers/api-gateway.js`
   - Update dashboard components

## Maintenance

### Monitoring

1. **Check worker logs**:
   - Monitor Cloudflare Workers logs for errors
   - Set up alerts for failed executions

2. **Data integrity checks**:
   - Periodically verify data consistency
   - Check for missing analyses or accountability metrics

### Troubleshooting

1. **Data collection issues**:
   - Check OpenStates API rate limits
   - Verify API key is valid
   - Check for changes in API response format

2. **AI analysis issues**:
   - Verify Workers AI is enabled
   - Check for model name changes
   - Review prompt effectiveness

3. **Storage limits**:
   - Monitor KV storage usage
   - Implement data cleanup for older records if needed

## Best Practices

1. **Rate limiting**:
   - Respect OpenStates API rate limits
   - Use batch processing for bill analysis
   - Add delays between API calls

2. **Cost optimization**:
   - Only run analysis for changed bill content
   - Use content hashing to avoid redundant processing
   - Store analyses permanently to avoid reprocessing

3. **Data freshness**:
   - Regular scheduled updates (every 4 hours)
   - Update summaries after data collection
   - Clear caches when data changes

## License

[Insert your license information here]

## Acknowledgments

- OpenStates API for legislative data
- Cloudflare Workers and Workers AI
- React and Recharts libraries
