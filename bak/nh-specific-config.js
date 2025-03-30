// nh-config.js
// Configuration specific to New Hampshire legislative tracking

/**
 * New Hampshire legislative tracking configuration
 */
const NH_CONFIG = {
  // API Configuration
  OPENSTATES_API_URL: 'https://v3.openstates.org',
  STATE_CODE: 'nh', // New Hampshire state code
  
  // Data Collection Settings
  UPDATE_FREQUENCY: '0 */4 * * *', // Every 4 hours
  LOOKBACK_DAYS: 30, // For initial data population
  
  // New Hampshire Specific Settings
  CHAMBERS: ['House', 'Senate'],
  COUNTIES: [
    'Belknap', 'Carroll', 'Cheshire', 'Coos', 
    'Grafton', 'Hillsborough', 'Merrimack', 
    'Rockingham', 'Strafford', 'Sullivan'
  ],
  
  // Representative Accountability Metrics
  ACCOUNTABILITY_METRICS: [
    { id: 'attendance', name: 'Attendance Rate', description: 'Percentage of votes attended' },
    { id: 'vote_party_alignment', name: 'Party Alignment', description: 'Percentage of votes aligned with party' },
    { id: 'sponsored_bills', name: 'Bills Sponsored', description: 'Number of bills sponsored' },
    { id: 'passed_bills', name: 'Bills Passed', description: 'Number of sponsored bills that passed' },
    { id: 'committee_attendance', name: 'Committee Attendance', description: 'Attendance rate at committee meetings' }
  ],
  
  // Committee Information
  TRACKED_COMMITTEES: [
    { id: 'SCJC', name: 'Senate Committee on the Judiciary' },
    { id: 'HCJC', name: 'House Committee on the Judiciary' },
    { id: 'SCFW', name: 'Senate Committee on Finance & Ways and Means' },
    { id: 'HCFW', name: 'House Committee on Finance & Ways and Means' },
    { id: 'SCED', name: 'Senate Committee on Education' },
    { id: 'HCED', name: 'House Committee on Education' },
    { id: 'SCHT', name: 'Senate Committee on Health & Human Services' },
    { id: 'HCHT', name: 'House Committee on Health & Human Services' },
    { id: 'SCET', name: 'Senate Committee on Energy & Transportation' },
    { id: 'HCET', name: 'House Committee on Energy & Transportation' }
  ],
  
  // New Hampshire Legislative Categories
  BILL_CATEGORIES: [
    'Education', 'Healthcare', 'Transportation', 'Environment', 
    'Taxation', 'Criminal Justice', 'Elections', 'Local Government',
    'State Government', 'Economic Development', 'Labor'
  ],
  
  // Current Legislative Session Information
  CURRENT_SESSION: '2025',
  CURRENT_SESSION_START: '2025-01-01',
  CURRENT_SESSION_END: '2025-12-31',
  
  // Additional Data Sources for Representative Accountability
  ADDITIONAL_SOURCES: [
    { 
      name: 'NH House Record',
      url: 'https://www.gencourt.state.nh.us/house/caljourns/default.aspx',
      dataType: 'voting_records'
    },
    { 
      name: 'NH Senate Record',
      url: 'https://www.gencourt.state.nh.us/senate/caljourns/default.aspx',
      dataType: 'voting_records'
    },
    { 
      name: 'NH Committee Archives',
      url: 'https://www.gencourt.state.nh.us/committee_minutes/default.aspx',
      dataType: 'committee_attendance'
    }
  ]
};

module.exports = NH_CONFIG;
