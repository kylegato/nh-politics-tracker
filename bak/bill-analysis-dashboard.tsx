import React, { useState, useEffect } from 'react';
import { Tabs, Tab } from './Tabs';

const API_BASE_URL = 'https://api.nh-legislative-tracker.com';

// Mock data for development
const MOCK_DATA = {
  highlighted_bills: [
    {
      id: 'bill_123',
      identifier: 'HB 123',
      title: 'An Act Relative to Property Tax Relief for Elderly Residents',
      impacts: {
        tax_impact: {
          summary: 'Creates significant property tax exemptions for residents over 65 years of age, potentially reducing county tax revenue.'
        },
        budget_impact: {
          summary: 'Could result in an estimated $2.4 million reduction in annual property tax collection.'
        },
        societal_impact: {
          summary: 'Would substantially improve affordability for elderly homeowners on fixed incomes.'
        }
      }
    },
    {
      id: 'bill_456',
      identifier: 'SB 456',
      title: 'An Act Establishing a Carbon Reduction Fund',
      impacts: {
        tax_impact: {
          summary: 'Creates a new fee structure on high-emission businesses, effectively acting as a targeted carbon tax.'
        },
        budget_impact: {
          summary: 'Expected to generate $18 million annually for renewable energy initiatives.'
        },
        societal_impact: {
          summary: 'Major potential impact on energy consumption patterns and business practices.'
        }
      }
    },
    {
      id: 'bill_789',
      identifier: 'HB 789',
      title: 'An Act Reforming Education Funding Formulas',
      impacts: {
        tax_impact: {
          summary: 'No direct tax impact, but redistributes existing education funding.'
        },
        budget_impact: {
          summary: 'Significant reallocation of approximately $45 million in education funds across districts.'
        },
        societal_impact: {
          summary: 'Substantial changes to school resource distribution, particularly benefiting rural districts.'
        }
      }
    }
  ],
  bill_detail: {
    id: 'bill_123',
    identifier: 'HB 123',
    title: 'An Act Relative to Property Tax Relief for Elderly Residents',
    analysis_available: true,
    analysis_timestamp: '2023-03-15T14:22:31Z',
    impacts: {
      tax_impact: {
        summary: 'Creates significant property tax exemptions for residents over 65 years of age, potentially reducing county tax revenue.',
        details: `• Establishes property tax exemption of $75,000 for homeowners aged 65-75
• Increases to $100,000 exemption for those over 75
• Income caps apply: $45,000 for single filers, $60,000 for joint filers
• Local municipalities can opt to increase exemption amounts
• Estimated to affect approximately 15,000 households statewide`
      },
      budget_impact: {
        summary: 'Could result in an estimated $2.4 million reduction in annual property tax collection.',
        details: `• Projected $2.4 million reduction in property tax collection statewide
• Individual town impacts vary significantly based on elderly population
• No state reimbursement mechanism for municipal revenue loss
• Implementation costs approximately $150,000 for system updates
• Potential secondary impact of $300,000 on state elderly assistance programs`
      },
      societal_impact: {
        summary: 'Would substantially improve affordability for elderly homeowners on fixed incomes.',
        details: `• Primary beneficiaries are elderly homeowners on fixed incomes
• Average annual savings of $1,200-$1,800 per qualifying household
• Could allow more seniors to remain in their homes longer
• Potential increased economic activity from seniors with more disposable income
• May indirectly support aging-in-place initiatives and reduce demand for assisted living`
      },
      institutional_alignment: {
        summary: 'Aligns with broader legislative priorities on aging population support and housing affordability.',
        details: `• Consistent with NH's increased focus on elderly support policies
• Follows similar measures passed in neighboring states
• Complements existing property tax relief programs
• Addresses campaign promises from multiple representatives
• Supported by senior advocacy organizations statewide`
      }
    }
  }
};

const BillAnalysisDashboard = () => {
  const [activeTab, setActiveTab] = useState('highlighted');
  const [highlightedBills, setHighlightedBills] = useState([]);
  const [selectedBill, setSelectedBill] = useState(null);
  const [selectedImpactType, setSelectedImpactType] = useState(null);
  const [impactBills, setImpactBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch highlighted bills on component mount
  useEffect(() => {
    // In a real implementation, we would fetch from the API
    // For now, we'll use mock data
    setHighlightedBills(MOCK_DATA.highlighted_bills);
  }, []);

  // Fetch bill detail when a bill is selected
  useEffect(() => {
    if (selectedBill) {
      // In a real implementation, we would fetch from the API
      // For now, we'll use mock data
      setSelectedBill(MOCK_DATA.bill_detail);
    }
  }, [selectedBill]);

  // Fetch bills by impact type when selected
  useEffect(() => {
    if (selectedImpactType) {
      setLoading(true);
      // In a real implementation, we would fetch from the API
      // For now, we'll simulate with a timeout and mock data
      setTimeout(() => {
        // Filter highlighted bills to those that have the selected impact
        const filteredBills = MOCK_DATA.highlighted_bills.filter(
          bill => bill.impacts[selectedImpactType]
        );
        setImpactBills(filteredBills);
        setLoading(false);
      }, 500);
    }
  }, [selectedImpactType]);

  // Handle bill selection
  const handleBillSelect = (billId) => {
    // In a real implementation, we would fetch the bill detail
    setSelectedBill({...MOCK_DATA.bill_detail, id: billId});
    setActiveTab('detail');
  };

  // Handle impact type selection
  const handleImpactTypeSelect = (impactType) => {
    setSelectedImpactType(impactType);
    setActiveTab('impact');
  };

  // Get an appropriate color for the impact type
  const getImpactColor = (impactType) => {
    switch(impactType) {
      case 'tax_impact': return '#d97706'; // Amber-600
      case 'budget_impact': return '#059669'; // Emerald-600
      case 'societal_impact': return '#2563eb'; // Blue-600
      case 'institutional_alignment': return '#7c3aed'; // Violet-600
      default: return '#6b7280'; // Gray-500
    }
  };

  // Render highlighted bills tab
  const renderHighlightedBills = () => (
    <div className="highlighted-bills">
      <h2>Bills with Significant Impact</h2>
      <p className="description">
        These bills have been identified by our AI analysis as having significant tax, budget, or societal impacts.
      </p>
      
      <div className="impact-filters">
        <h3>Filter by Impact Type:</h3>
        <div className="impact-buttons">
          <button 
            onClick={() => handleImpactTypeSelect('tax_impact')}
            className="impact-button"
            style={{ borderColor: getImpactColor('tax_impact') }}
          >
            Tax Impact
          </button>
          <button 
            onClick={() => handleImpactTypeSelect('budget_impact')}
            className="impact-button"
            style={{ borderColor: getImpactColor('budget_impact') }}
          >
            Budget Impact
          </button>
          <button 
            onClick={() => handleImpactTypeSelect('societal_impact')}
            className="impact-button"
            style={{ borderColor: getImpactColor('societal_impact') }}
          >
            Societal Impact
          </button>
        </div>
      </div>
      
      <div className="bill-cards">
        {highlightedBills.length === 0 ? (
          <p>No highlighted bills available.</p>
        ) : (
          highlightedBills.map(bill => (
            <div 
              key={bill.id} 
              className="bill-card"
              onClick={() => handleBillSelect(bill.id)}
            >
              <div className="bill-header">
                <h3>{bill.identifier}</h3>
                <span className="bill-title">{bill.title}</span>
              </div>
              
              <div className="bill-impacts">
                {bill.impacts.tax_impact && (
                  <div className="impact-summary" style={{ borderLeftColor: getImpactColor('tax_impact') }}>
                    <strong>Tax Impact:</strong>
                    <p>{bill.impacts.tax_impact.summary}</p>
                  </div>
                )}
                
                {bill.impacts.budget_impact && (
                  <div className="impact-summary" style={{ borderLeftColor: getImpactColor('budget_impact') }}>
                    <strong>Budget Impact:</strong>
                    <p>{bill.impacts.budget_impact.summary}</p>
                  </div>
                )}
                
                {bill.impacts.societal_impact && (
                  <div className="impact-summary" style={{ borderLeftColor: getImpactColor('societal_impact') }}>
                    <strong>Societal Impact:</strong>
                    <p>{bill.impacts.societal_impact.summary}</p>
                  </div>
                )}
              </div>
              
              <div className="bill-footer">
                <button className="view-details">View Full Analysis</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // Render impact-filtered bills tab
  const renderImpactBills = () => {
    // Map impact type to readable name
    const impactTypeNames = {
      'tax_impact': 'Tax Impact',
      'budget_impact': 'Budget Impact',
      'societal_impact': 'Societal Impact',
      'institutional_alignment': 'Institutional Alignment'
    };
    
    const impactName = impactTypeNames[selectedImpactType] || selectedImpactType;
    
    return (
      <div className="impact-bills">
        <div className="section-header">
          <h2>Bills with Significant {impactName}</h2>
          <button onClick={() => setActiveTab('highlighted')} className="back-button">
            &larr; Back to All Impacts
          </button>
        </div>
        
        {loading ? (
          <p>Loading bills...</p>
        ) : (
          <>
            {impactBills.length === 0 ? (
              <p>No bills found with significant {impactName.toLowerCase()}.</p>
            ) : (
              <div className="bill-cards">
                {impactBills.map(bill => (
                  <div 
                    key={bill.id} 
                    className="bill-card"
                    onClick={() => handleBillSelect(bill.id)}
                  >
                    <div className="bill-header">
                      <h3>{bill.identifier}</h3>
                      <span className="bill-title">{bill.title}</span>
                    </div>
                    
                    <div className="bill-impacts">
                      <div 
                        className="impact-summary" 
                        style={{ borderLeftColor: getImpactColor(selectedImpactType) }}
                      >
                        <strong>{impactName}:</strong>
                        <p>{bill.impacts[selectedImpactType].summary}</p>
                      </div>
                    </div>
                    
                    <div className="bill-footer">
                      <button className="view-details">View Full Analysis</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // Render bill detail tab
  const renderBillDetail = () => {
    if (!selectedBill) {
      return (
        <div className="bill-detail">
          <div className="section-header">
            <h2>Bill Analysis</h2>
            <button onClick={() => setActiveTab('highlighted')} className="back-button">
              &larr; Back to Highlighted Bills
            </button>
          </div>
          <p>No bill selected.</p>
        </div>
      );
    }
    
    return (
      <div className="bill-detail">
        <div className="section-header">
          <h2>Bill Analysis</h2>
          <button onClick={() => setActiveTab('highlighted')} className="back-button">
            &larr; Back to Highlighted Bills
          </button>
        </div>
        
        <div className="bill-header-detail">
          <h3>{selectedBill.identifier}: {selectedBill.title}</h3>
          <p className="analysis-date">
            Analysis performed: {new Date(selectedBill.analysis_timestamp).toLocaleDateString()}
          </p>
        </div>
        
        <div className="impact-tabs">
          <Tabs>
            <Tab label="Tax Impact" color={getImpactColor('tax_impact')}>
              {selectedBill.impacts.tax_impact ? (
                <div className="impact-content">
                  <h4>Summary</h4>
                  <p>{selectedBill.impacts.tax_impact.summary}</p>
                  
                  <h4>Details</h4>
                  <div className="impact-details">
                    {selectedBill.impacts.tax_impact.details.split('\n').map((point, index) => (
                      <p key={index}>{point}</p>
                    ))}
                  </div>
                </div>
              ) : (
                <p>No tax impact analysis available for this bill.</p>
              )}
            </Tab>
            
            <Tab label="Budget Impact" color={getImpactColor('budget_impact')}>
              {selectedBill.impacts.budget_impact ? (
                <div className="impact-content">
                  <h4>Summary</h4>
                  <p>{selectedBill.impacts.budget_impact.summary}</p>
                  
                  <h4>Details</h4>
                  <div className="impact-details">
                    {selectedBill.impacts.budget_impact.details.split('\n').map((point, index) => (
                      <p key={index}>{point}</p>
                    ))}
                  </div>
                </div>
              ) : (
                <p>No budget impact analysis available for this bill.</p>
              )}
            </Tab>
            
            <Tab label="Societal Impact" color={getImpactColor('societal_impact')}>
              {selectedBill.impacts.societal_impact ? (
                <div className="impact-content">
                  <h4>Summary</h4>
                  <p>{selectedBill.impacts.societal_impact.summary}</p>
                  
                  <h4>Details</h4>
                  <div className="impact-details">
                    {selectedBill.impacts.societal_impact.details.split('\n').map((point, index) => (
                      <p key={index}>{point}</p>
                    ))}
                  </div>
                </div>
              ) : (
                <p>No societal impact analysis available for this bill.</p>
              )}
            </Tab>
            
            <Tab label="Institutional Alignment" color={getImpactColor('institutional_alignment')}>
              {selectedBill.impacts.institutional_alignment ? (
                <div className="impact-content">
                  <h4>Summary</h4>
                  <p>{selectedBill.impacts.institutional_alignment.summary}</p>
                  
                  <h4>Details</h4>
                  <div className="impact-details">
                    {selectedBill.impacts.institutional_alignment.details.split('\n').map((point, index) => (
                      <p key={index}>{point}</p>
                    ))}
                  </div>
                </div>
              ) : (
                <p>No institutional alignment analysis available for this bill.</p>
              )}
            </Tab>
          </Tabs>
        </div>
      </div>
    );
  };

  return (
    <div className="bill-analysis-dashboard">
      <header className="dashboard-header">
        <h1>NH Bill Impact Analysis</h1>
        <p className="subtitle">
          AI-powered analysis of tax, budget, and societal impacts of New Hampshire legislation
        </p>
      </header>
      
      <main className="dashboard-content">
        {error && (
          <div className="error-message">
            Error loading data: {error}
          </div>
        )}
        
        {activeTab === 'highlighted' && renderHighlightedBills()}
        {activeTab === 'impact' && renderImpactBills()}
        {activeTab === 'detail' && renderBillDetail()}
      </main>
    </div>
  );
};

export default BillAnalysisDashboard;