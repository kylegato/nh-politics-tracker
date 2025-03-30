# NH Legislative Accountability System - Architecture Update

This document outlines the additions to our New Hampshire Legislative Accountability System architecture to incorporate Cloudflare Workers AI for bill analysis.

## 1. AI Analysis Component

We have added a dedicated AI analysis component that processes bill text to provide insights in four key areas:

1. **Tax Impact**: Analyzes how bills affect taxation for individuals, businesses, and government revenue
2. **Budget Impact**: Evaluates the financial implications for state and local budgets
3. **Societal Impact**: Assesses how bills might affect NH residents, communities, and social structures
4. **Institutional Alignment**: Examines how bills fit into broader legislative priorities regardless of party

### Implementation Details

- **Technology**: Cloudflare Workers AI using the Meta Llama 3 model (@cf/meta/llama-3-8b-instruct)
- **Integration Point**: Analysis occurs during the data collection process
- **Execution Timing**: Analysis is performed when new or updated bills are detected
- **Caching Strategy**: Analysis results cached for 7 days to optimize costs
- **Rate Limiting**: Processing occurs in small batches with delays to manage resource usage

## 2. Data Flow

The updated data flow with AI analysis is:

1. **Scheduled Collection**:
   - Worker runs every 4 hours to check for updated bills
   - Retrieves bill content from OpenStates API
   - Batches bills for processing

2. **AI Analysis Pipeline**:
   - For each bill in a batch:
     - Extract and prepare bill text
     - Generate prompts for each analysis type
     - Send to Cloudflare Workers AI
     - Parse and structure responses
     - Store results in KV storage

3. **Highlights Detection**:
   - Bills with significant impacts are added to a highlights index
   - Analysis summaries are aggregated for dashboard visualization

4. **API Endpoints**:
   - New endpoints expose analysis data to the frontend
   - Support filtering and searching by impact types

## 3. Cost Optimization

We've implemented several strategies to manage costs:

1. **Cached Analysis**: Results are cached for 7 days to avoid reprocessing stable content
2. **Batch Processing**: Bills are analyzed in small batches with rate limiting
3. **Input Optimization**: Bill text is prepared and trimmed to reduce token usage
4. **Selective Analysis**: Only substantive bills with sufficient text are analyzed
5. **On-Demand Processing**: Detailed analysis is only performed when bills change

## 4. API Extensions

We've added the following new API endpoints:

- `GET /api/analysis?bill_id={billId}` - Get complete analysis for a specific bill
- `GET /api/analysis?impact_type={type}` - Get bills with a specific impact type
- `GET /api/analysis?highlighted=true` - Get all bills with significant impacts
- `GET /api/analysis` - Get summary of all analysis data

## 5. UI Components

New frontend components support the analysis features:

1. **Bill Analysis Dashboard**:
   - Overview of bills with significant impacts
   - Filtering by impact type
   - Detailed analysis view with tabbed interface

2. **Impact Visualization**:
   - Color-coded impact summaries
   - Categorized by impact type
   - Detail expansion for comprehensive analysis

## 6. Future Enhancements

Potential improvements to the AI analysis component:

1. **Comparative Analysis**: Comparing current bills to historical legislation
2. **Trend Detection**: Identifying emerging legislative patterns over time
3. **Cross-Bill Analysis**: Analyzing how multiple bills might interact
4. **Custom Analysis Types**: Adding specific analysis types requested by users
5. **Feedback Integration**: Allowing users to provide feedback on analysis quality

## 7. Technical Requirements

- Cloudflare Workers account with AI binding enabled
- KV namespaces for data storage
- Scheduled triggers for regular data collection
- API Gateway for frontend communication

## 8. Conclusion

The addition of AI-powered bill analysis significantly enhances our NH Legislative Accountability System by providing citizens with deeper insights into the potential impacts of legislation. By using Cloudflare Workers AI, we maintain our serverless architecture while adding powerful analytical capabilities that help citizens better understand how bills might affect taxation, budgets, and society.