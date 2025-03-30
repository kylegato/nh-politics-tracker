# NH Legislative Analysis Persistent Storage Documentation

## Overview

This document explains the persistent storage strategy for AI-generated bill analyses in the NH Legislative Accountability System.

## Storage Strategy

### Analysis Keys

Analysis results are stored using a structured, predictable key format:
```
nh-[billType]-[chamber]-[number]-ai-analysis
```

For example:
- `nh-hb-house-123-ai-analysis` - Analysis for House Bill 123
- `nh-sb-senate-45-ai-analysis` - Analysis for Senate Bill 45
- `nh-cr-house-11-ai-analysis` - Analysis for House Concurrent Resolution 11

This standardized format ensures:
1. Easy retrieval without requiring lookups
2. Simple pattern matching for listing available analyses
3. Logical organization of analysis data
4. Permanent storage that persists beyond caching

### Content Hash Tracking

To avoid unnecessary AI processing, each analysis includes a content hash that tracks if the bill's content has changed:

1. When a bill is encountered, its text content is hashed
2. The system checks if analysis exists with the same content hash
3. Analysis is only performed if:
   - No analysis exists for the bill
   - The bill's content has changed since previous analysis

This approach minimizes API costs while ensuring analyses stay current.

## Bill Reference System

Bills maintain a reference to their analysis through a dedicated field:

```json
{
  "id": "ocd-bill/abcd1234",
  "identifier": "HB 123",
  "title": "An Act Relative to...",
  "nh_analysis_key": "nh-hb-house-123-ai-analysis"
}
```

The system also maintains a reverse mapping from bill IDs to analysis keys:
```
bill:[billId]:analysis-key → [analysisKey]
```

This dual reference system ensures analyses can be found even if:
- The bill ID changes
- The bill structure is updated
- The storage pattern needs to evolve

## Analysis Structure

Each analysis document contains:

```json
{
  "bill_id": "ocd-bill/abcd1234",
  "bill_identifier": "HB 123",
  "bill_title": "An Act Relative to...",
  "analysis_timestamp": "2023-03-15T14:22:31Z",
  "content_hash": "12345678",
  "analyses": {
    "tax_impact": {
      "summary": "Creates significant property tax exemptions...",
      "details": "• Establishes property tax exemption of $75,000..."
    },
    "budget_impact": {
      "summary": "Could result in an estimated $2.4 million reduction...",
      "details": "• Projected $2.4 million reduction in property tax..."
    },
    "societal_impact": {
      "summary": "Would substantially improve affordability...",
      "details": "• Primary beneficiaries are elderly homeowners..."
    },
    "institutional_alignment": {
      "summary": "Aligns with broader legislative priorities...",
      "details": "• Consistent with NH's increased focus on elderly..."
    }
  }
}
```

## API Access

The system provides multiple ways to access stored analyses:

1. **By Bill ID**:
   ```
   GET /api/analysis?bill_id=[billId]
   ```

2. **By Analysis Key**:
   ```
   GET /api/analysis?analysis_key=[analysisKey]
   ```

3. **By Bill Identifiers**:
   ```
   GET /api/analysis?bill_type=hb&chamber=house&bill_number=123
   ```

4. **By Impact Type**:
   ```
   GET /api/analysis?impact_type=tax_impact
   ```

5. **Highlighted Bills**:
   ```
   GET /api/analysis?highlighted=true
   ```

## Implementation Benefits

This persistent storage approach provides several benefits:

1. **Cost Efficiency**: 
   - Minimizes redundant AI processing
   - Only analyzes when content changes
   - Avoids analysis of minor updates

2. **Reliability**:
   - Analysis persists indefinitely
   - Not dependent on cache expiration
   - Available even if bill record changes

3. **Performance**:
   - Fast retrieval without complex lookups
   - No need to regenerate analyses
   - Predictable key structure for direct access

4. **Maintainability**:
   - Clear separation of bill data and analysis
   - Simple content hash verification
   - Standardized naming conventions

## Handling Special Cases

### Bill Content Changes

When a bill's content changes:
1. The content hash will differ
2. A new analysis will be generated
3. The analysis key reference will be updated
4. Previous analysis remains accessible by direct key

### Missing Analyses

If a bill references an analysis key that doesn't exist:
1. The API returns a specific error ("Analysis reference exists but content not found")
2. The scheduled worker will detect this and regenerate the analysis

### Handle API Key Updates

If the OpenStates API changes the ID format for bills:
1. Bill-to-analysis mapping remains intact
2. Analysis can still be accessed via bill type, chamber, and number
3. New mappings will be created for updated IDs

## Conclusion

This persistent storage approach ensures that AI analyses are:
1. Generated efficiently
2. Stored permanently
3. Retrieved reliably
4. Updated only when necessary

The standardized key format `nh-[billType]-[chamber]-[number]-ai-analysis` provides a consistent, predictable way to access analyses while minimizing unnecessary processing and API costs.