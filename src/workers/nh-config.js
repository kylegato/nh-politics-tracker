// nh-config.js
// Configuration settings for New Hampshire legislative tracking

/**
 * Configuration for the NH Legislative Tracker
 */
const NH_CONFIG = {
  // OpenStates API configuration
  OPENSTATES_API_URL: "https://v3.openstates.org",
  STATE_CODE: "nh", // New Hampshire state code
  CURRENT_SESSION: "2025", // Current legislative session
  
  // Data lookback period (in days) for initial fetch
  LOOKBACK_DAYS: 30,
  
  // Bill categorization keywords
  CATEGORIES: {
    TAXES: ['tax', 'revenue', 'levy', 'fiscal', 'income', 'budget'],
    EDUCATION: ['education', 'school', 'student', 'teacher', 'university', 'college'],
    HEALTH: ['health', 'medical', 'hospital', 'insurance', 'medicare', 'medicaid'],
    ENVIRONMENT: ['environment', 'climate', 'pollution', 'conservation', 'energy'],
    JUSTICE: ['justice', 'crime', 'prison', 'police', 'court', 'law'],
    INFRASTRUCTURE: ['infrastructure', 'road', 'highway', 'bridge', 'transport']
  },
  
  // Committee IDs of interest
  TRACKED_COMMITTEES: [
    "ocd-organization/61b3eb5c-8be7-4ab5-a1fe-f2fcd4c11f59", // Finance
    "ocd-organization/67f55745-9e43-4a29-aede-060e6c2588a7", // Education
    "ocd-organization/00e9ee77-a609-42b3-bd28-3d87ca3fda25"  // Ways and Means
  ]
};

export default NH_CONFIG;
