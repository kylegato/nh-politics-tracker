import React, { useState, useEffect } from 'react';
import '../styles/AccountabilityDashboard.css';

// Mock data for development
const MOCK_DATA = {
  legislators: [
    {
      id: 'leg_123',
      name: 'Jane Smith',
      party: 'Republican',
      district: 'Hillsborough 21',
      voting_record: {
        bills_sponsored: 12,
        bills_cosponsored: 34,
        votes_cast: 187,
        attendance_rate: 0.94,
        vote_alignment: {
          party: 0.87,
          stated_position: 0.92
        }
      },
      key_votes: [
        {
          bill_id: 'bill_123',
          bill_identifier: 'HB 123',
          bill_title: 'An Act Relative to Property Tax Relief for Elderly Residents',
          vote: 'yes',
          party_alignment: true,
          statement: 'This bill provides necessary relief to our elderly citizens facing rising property taxes.'
        },
        {
          bill_id: 'bill_456',
          bill_identifier: 'SB 456',
          bill_title: 'An Act Establishing a Carbon Reduction Fund',
          vote: 'no',
          party_alignment: true,
          statement: 'The economic burden this places on businesses would be detrimental to our state economy.'
        }
      ]
    },
    {
      id: 'leg_124',
      name: 'John Doe',
      party: 'Democrat',
      district: 'Merrimack 15',
      voting_record: {
        bills_sponsored: 8,
        bills_cosponsored: 27,
        votes_cast: 183,
        attendance_rate: 0.91,
        vote_alignment: {
          party: 0.89,
          stated_position: 0.85
        }
      },
      key_votes: [
        {
          bill_id: 'bill_123',
          bill_identifier: 'HB 123',
          bill_title: 'An Act Relative to Property Tax Relief for Elderly Residents',
          vote: 'yes',
          party_alignment: false,
          statement: 'While I have concerns about municipal funding, I believe this bill is necessary for our elderly residents.'
        },
        {
          bill_id: 'bill_456',
          bill_identifier: 'SB 456',
          bill_title: 'An Act Establishing a Carbon Reduction Fund',
          vote: 'yes',
          party_alignment: true,
          statement: 'This fund is critical for our state to address climate change and encourage renewable energy development.'
        }
      ]
    }
  ],
  legislator_detail: {
    id: 'leg_123',
    name: 'Jane Smith',
    party: 'Republican',
    district: 'Hillsborough 21',
    photo_url: null,
    contact: {
      email: 'jane.smith@legnh.gov',
      phone: '603-555-1234',
      office: 'Legislative Office Building, Room 302'
    },
    biography: 'Jane Smith has served in the NH House since 2018. She previously worked in small business development and education.',
    committees: [
      'Finance',
      'Education',
      'Ways and Means'
    ],
    voting_record: {
      bills_sponsored: 12,
      bills_cosponsored: 34,
      votes_cast: 187,
      attendance_rate: 0.94,
      vote_alignment: {
        party: 0.87,
        stated_position: 0.92
      }
    },
    voting_history: [
      {
        session: '2022-2023',
        votes_cast: 101,
        attendance_rate: 0.96,
        party_alignment_rate: 0.88
      },
      {
        session: '2021-2022',
        votes_cast: 86,
        attendance_rate: 0.92,
        party_alignment_rate: 0.86
      }
    ],
    key_votes: [
      {
        bill_id: 'bill_123',
        bill_identifier: 'HB 123',
        bill_title: 'An Act Relative to Property Tax Relief for Elderly Residents',
        vote: 'yes',
        party_alignment: true,
        statement: 'This bill provides necessary relief to our elderly citizens facing rising property taxes.'
      },
      {
        bill_id: 'bill_456',
        bill_identifier: 'SB 456',
        bill_title: 'An Act Establishing a Carbon Reduction Fund',
        vote: 'no',
        party_alignment: true,
        statement: 'The economic burden this places on businesses would be detrimental to our state economy.'
      }
    ],
    consistency_score: 0.87,
    promise_fulfillment: {
      promises_made: 14,
      promises_kept: 11,
      promises_broken: 2,
      promises_in_progress: 1
    }
  }
};

const AccountabilityDashboard = () => {
  const [legislators, setLegislators] = useState([]);
  const [selectedLegislator, setSelectedLegislator] = useState(null);
  const [filterParty, setFilterParty] = useState('all');
  const [filterDistrict, setFilterDistrict] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch legislators on component mount
  useEffect(() => {
    // In a real implementation, we would fetch from the API
    // For now, we'll use mock data
    setLegislators(MOCK_DATA.legislators);
  }, []);

  // Fetch legislator detail when a legislator is selected
  useEffect(() => {
    if (selectedLegislator) {
      setLoading(true);
      // In a real implementation, we would fetch from the API
      // For now, we'll use mock data and simulate a delay
      setTimeout(() => {
        setSelectedLegislator(MOCK_DATA.legislator_detail);
        setLoading(false);
      }, 500);
    }
  }, [selectedLegislator]);

  // Handle legislator selection
  const handleLegislatorSelect = (legislatorId) => {
    setSelectedLegislator({...MOCK_DATA.legislator_detail, id: legislatorId});
  };

  // Filter legislators based on current filters
  const filteredLegislators = legislators.filter(legislator => {
    if (filterParty !== 'all' && legislator.party.toLowerCase() !== filterParty.toLowerCase()) {
      return false;
    }
    if (filterDistrict !== 'all' && !legislator.district.includes(filterDistrict)) {
      return false;
    }
    return true;
  });

  // Render functions for different sections of the dashboard
  const renderLegislatorsList = () => (
    <div className="legislators-list">
      <h2>NH Legislators Accountability Tracker</h2>
      
      <div className="filters">
        <div className="filter-group">
          <label htmlFor="party-filter">Party:</label>
          <select 
            id="party-filter"
            value={filterParty}
            onChange={(e) => setFilterParty(e.target.value)}
          >
            <option value="all">All Parties</option>
            <option value="democrat">Democrat</option>
            <option value="republican">Republican</option>
            <option value="independent">Independent</option>
          </select>
        </div>
        
        <div className="filter-group">
          <label htmlFor="district-filter">District:</label>
          <input 
            type="text"
            id="district-filter"
            placeholder="Search by district..."
            value={filterDistrict === 'all' ? '' : filterDistrict}
            onChange={(e) => setFilterDistrict(e.target.value || 'all')}
          />
        </div>
      </div>
      
      {filteredLegislators.length === 0 ? (
        <p>No legislators match your filters.</p>
      ) : (
        <div className="legislator-cards">
          {filteredLegislators.map(legislator => (
            <div 
              key={legislator.id} 
              className="legislator-card"
              onClick={() => handleLegislatorSelect(legislator.id)}
            >
              <div className="legislator-header">
                <h3>{legislator.name}</h3>
                <span className={`party-badge ${legislator.party.toLowerCase()}`}>
                  {legislator.party}
                </span>
              </div>
              
              <div className="legislator-info">
                <p><strong>District:</strong> {legislator.district}</p>
                <p><strong>Bills Sponsored:</strong> {legislator.voting_record.bills_sponsored}</p>
                <p><strong>Attendance Rate:</strong> {(legislator.voting_record.attendance_rate * 100).toFixed(1)}%</p>
                <p><strong>Party Alignment:</strong> {(legislator.voting_record.vote_alignment.party * 100).toFixed(1)}%</p>
              </div>
              
              <div className="key-votes">
                <h4>Key Votes:</h4>
                <ul>
                  {legislator.key_votes.slice(0, 2).map(vote => (
                    <li key={vote.bill_id}>
                      <strong>{vote.bill_identifier}:</strong> Voted {vote.vote.toUpperCase()} on {vote.bill_title}
                    </li>
                  ))}
                </ul>
              </div>
              
              <button className="view-details">View Full Profile</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderLegislatorDetail = () => {
    if (!selectedLegislator) {
      return <div>Select a legislator to view their details.</div>;
    }

    if (loading) {
      return <div>Loading legislator details...</div>;
    }

    return (
      <div className="legislator-detail">
        <button 
          className="back-button"
          onClick={() => setSelectedLegislator(null)}
        >
          &larr; Back to Legislators List
        </button>
        
        <div className="legislator-profile">
          <div className="profile-header">
            <div className="profile-info">
              <h2>{selectedLegislator.name}</h2>
              <span className={`party-badge ${selectedLegislator.party.toLowerCase()}`}>
                {selectedLegislator.party}
              </span>
              <p className="district">{selectedLegislator.district}</p>
            </div>
            
            <div className="profile-contact">
              <p><strong>Email:</strong> {selectedLegislator.contact.email}</p>
              <p><strong>Phone:</strong> {selectedLegislator.contact.phone}</p>
              <p><strong>Office:</strong> {selectedLegislator.contact.office}</p>
            </div>
          </div>
          
          <div className="profile-tabs">
            <button 
              className={activeTab === 'overview' ? 'active' : ''}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button 
              className={activeTab === 'voting' ? 'active' : ''}
              onClick={() => setActiveTab('voting')}
            >
              Voting Record
            </button>
            <button 
              className={activeTab === 'promises' ? 'active' : ''}
              onClick={() => setActiveTab('promises')}
            >
              Promise Tracker
            </button>
          </div>
          
          <div className="tab-content">
            {activeTab === 'overview' && (
              <div className="overview-tab">
                <h3>Biography</h3>
                <p>{selectedLegislator.biography}</p>
                
                <h3>Committees</h3>
                <ul className="committees-list">
                  {selectedLegislator.committees.map((committee, index) => (
                    <li key={index}>{committee}</li>
                  ))}
                </ul>
                
                <h3>Summary Statistics</h3>
                <div className="stats-grid">
                  <div className="stat-box">
                    <span className="stat-value">{selectedLegislator.voting_record.bills_sponsored}</span>
                    <span className="stat-label">Bills Sponsored</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-value">{selectedLegislator.voting_record.bills_cosponsored}</span>
                    <span className="stat-label">Bills Co-Sponsored</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-value">{(selectedLegislator.voting_record.attendance_rate * 100).toFixed(1)}%</span>
                    <span className="stat-label">Attendance Rate</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-value">{(selectedLegislator.consistency_score * 100).toFixed(1)}%</span>
                    <span className="stat-label">Consistency Score</span>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'voting' && (
              <div className="voting-tab">
                <h3>Voting History</h3>
                <table className="voting-history">
                  <thead>
                    <tr>
                      <th>Session</th>
                      <th>Votes Cast</th>
                      <th>Attendance</th>
                      <th>Party Alignment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedLegislator.voting_history.map((session, index) => (
                      <tr key={index}>
                        <td>{session.session}</td>
                        <td>{session.votes_cast}</td>
                        <td>{(session.attendance_rate * 100).toFixed(1)}%</td>
                        <td>{(session.party_alignment_rate * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                <h3>Key Votes</h3>
                <div className="key-votes-list">
                  {selectedLegislator.key_votes.map(vote => (
                    <div key={vote.bill_id} className="key-vote">
                      <div className="vote-header">
                        <h4>{vote.bill_identifier}: {vote.bill_title}</h4>
                        <span className={`vote-badge ${vote.vote}`}>
                          Voted {vote.vote.toUpperCase()}
                        </span>
                      </div>
                      <p className="vote-statement">{vote.statement}</p>
                      <p className="party-alignment">
                        {vote.party_alignment 
                          ? 'This vote aligned with their party\'s position.' 
                          : 'This vote differed from their party\'s position.'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {activeTab === 'promises' && (
              <div className="promises-tab">
                <h3>Campaign Promise Tracker</h3>
                <div className="promise-summary">
                  <div className="promise-stat">
                    <span className="stat-value">{selectedLegislator.promise_fulfillment.promises_made}</span>
                    <span className="stat-label">Promises Made</span>
                  </div>
                  <div className="promise-stat kept">
                    <span className="stat-value">{selectedLegislator.promise_fulfillment.promises_kept}</span>
                    <span className="stat-label">Promises Kept</span>
                  </div>
                  <div className="promise-stat broken">
                    <span className="stat-value">{selectedLegislator.promise_fulfillment.promises_broken}</span>
                    <span className="stat-label">Promises Broken</span>
                  </div>
                  <div className="promise-stat in-progress">
                    <span className="stat-value">{selectedLegislator.promise_fulfillment.promises_in_progress}</span>
                    <span className="stat-label">In Progress</span>
                  </div>
                </div>
                
                <div className="promise-chart">
                  <div 
                    className="promise-bar kept" 
                    style={{ 
                      width: `${(selectedLegislator.promise_fulfillment.promises_kept / selectedLegislator.promise_fulfillment.promises_made) * 100}%` 
                    }}
                  ></div>
                  <div 
                    className="promise-bar in-progress" 
                    style={{ 
                      width: `${(selectedLegislator.promise_fulfillment.promises_in_progress / selectedLegislator.promise_fulfillment.promises_made) * 100}%` 
                    }}
                  ></div>
                  <div 
                    className="promise-bar broken" 
                    style={{ 
                      width: `${(selectedLegislator.promise_fulfillment.promises_broken / selectedLegislator.promise_fulfillment.promises_made) * 100}%` 
                    }}
                  ></div>
                </div>
                
                <p className="promise-note">
                  * Promises are tracked from campaign materials, public statements, and official websites.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="analysis-dashboard">
      {selectedLegislator ? renderLegislatorDetail() : renderLegislatorsList()}
    </div>
  );
};

export default AccountabilityDashboard;