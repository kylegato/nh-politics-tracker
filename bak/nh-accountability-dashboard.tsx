import React, { useState, useEffect } from 'react';
import { LineChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const API_BASE_URL = 'https://api.nh-legislative-tracker.com';

// Mock data for development
const MOCK_DATA = {
  representatives: [
    { id: 'rep1', name: 'John Smith', party: 'Republican', district: '1', chamber: 'House' },
    { id: 'rep2', name: 'Jane Doe', party: 'Democrat', district: '2', chamber: 'House' },
    { id: 'rep3', name: 'Bob Johnson', party: 'Republican', district: '3', chamber: 'House' },
    { id: 'rep4', name: 'Sarah Williams', party: 'Democrat', district: '4', chamber: 'Senate' },
    { id: 'rep5', name: 'Mike Brown', party: 'Republican', district: '5', chamber: 'Senate' },
  ],
  metrics: [
    { id: 'attendance', name: 'Attendance Rate', description: 'Percentage of votes attended' },
    { id: 'vote_party_alignment', name: 'Party Alignment', description: 'Percentage of votes aligned with party' },
    { id: 'sponsored_bills', name: 'Bills Sponsored', description: 'Number of bills sponsored' },
    { id: 'passed_bills', name: 'Bills Passed', description: 'Number of sponsored bills that passed' },
    { id: 'committee_attendance', name: 'Committee Attendance', description: 'Attendance rate at committee meetings' }
  ],
  rankings: {
    attendance: [
      { id: 'rep1', name: 'John Smith', party: 'Republican', value: 97 },
      { id: 'rep4', name: 'Sarah Williams', party: 'Democrat', value: 95 },
      { id: 'rep2', name: 'Jane Doe', party: 'Democrat', value: 92 },
      { id: 'rep5', name: 'Mike Brown', party: 'Republican', value: 87 },
      { id: 'rep3', name: 'Bob Johnson', party: 'Republican', value: 75 },
    ],
    vote_party_alignment: [
      { id: 'rep3', name: 'Bob Johnson', party: 'Republican', value: 98 },
      { id: 'rep5', name: 'Mike Brown', party: 'Republican', value: 95 },
      { id: 'rep2', name: 'Jane Doe', party: 'Democrat', value: 93 },
      { id: 'rep4', name: 'Sarah Williams', party: 'Democrat', value: 85 },
      { id: 'rep1', name: 'John Smith', party: 'Republican', value: 72 },
    ],
    sponsored_bills: [
      { id: 'rep2', name: 'Jane Doe', party: 'Democrat', value: 24 },
      { id: 'rep5', name: 'Mike Brown', party: 'Republican', value: 18 },
      { id: 'rep4', name: 'Sarah Williams', party: 'Democrat', value: 15 },
      { id: 'rep1', name: 'John Smith', party: 'Republican', value: 12 },
      { id: 'rep3', name: 'Bob Johnson', party: 'Republican', value: 8 },
    ],
    rep_details: {
      'rep1': {
        accountability: {
          attendance: 97,
          vote_party_alignment: 72,
          sponsored_bills: 12,
          passed_bills: 5,
          committee_attendance: 94
        },
        voting_record: [
          { date: '2023-01-15', bill: 'HB 123', vote: 'Yes', party_vote: 'Yes' },
          { date: '2023-02-03', bill: 'HB 456', vote: 'No', party_vote: 'Yes' },
          { date: '2023-02-17', bill: 'HB 789', vote: 'Yes', party_vote: 'Yes' },
          { date: '2023-03-05', bill: 'HB 234', vote: 'No', party_vote: 'Yes' },
          { date: '2023-03-22', bill: 'HB 567', vote: 'Yes', party_vote: 'No' },
        ]
      }
    }
  }
};

const AccountabilityDashboard = () => {
  const [activeView, setActiveView] = useState('overview');
  const [selectedMetric, setSelectedMetric] = useState('attendance');
  const [selectedChamber, setSelectedChamber] = useState('all');
  const [selectedRepresentative, setSelectedRepresentative] = useState(null);
  const [representatives, setRepresentatives] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [rankings, setRankings] = useState([]);
  const [representativeDetails, setRepresentativeDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch initial data
  useEffect(() => {
    // In a real implementation, we would fetch from the API
    // For now, we'll use mock data
    setRepresentatives(MOCK_DATA.representatives);
    setMetrics(MOCK_DATA.metrics);
  }, []);

  // Fetch rankings when metric or chamber changes
  useEffect(() => {
    if (activeView === 'rankings' && selectedMetric) {
      // In a real implementation, we would fetch from the API
      // For now, we'll use mock data
      setRankings(MOCK_DATA.rankings[selectedMetric] || []);
    }
  }, [activeView, selectedMetric, selectedChamber]);

  // Fetch representative details when selected
  useEffect(() => {
    if (selectedRepresentative) {
      // In a real implementation, we would fetch from the API
      // For now, we'll use mock data
      setRepresentativeDetails(MOCK_DATA.rankings.rep_details[selectedRepresentative] || null);
    }
  }, [selectedRepresentative]);

  // Helper function to get party color
  const getPartyColor = (party) => {
    if (party === 'Republican') return '#bf1f24';
    if (party === 'Democrat') return '#2344c3';
    return '#777777';
  };

  // Handle representative selection
  const handleRepresentativeSelect = (repId) => {
    setSelectedRepresentative(repId);
    setActiveView('representative');
  };

  // Render overview section
  const renderOverview = () => (
    <div className="overview-section">
      <h2>New Hampshire Legislative Accountability Overview</h2>
      
      <div className="overview-stats">
        <div className="stat-card">
          <h3>Total Representatives</h3>
          <div className="stat-value">{representatives.length}</div>
        </div>
        <div className="stat-card">
          <h3>House Members</h3>
          <div className="stat-value">
            {representatives.filter(rep => rep.chamber === 'House').length}
          </div>
        </div>
        <div className="stat-card">
          <h3>Senate Members</h3>
          <div className="stat-value">
            {representatives.filter(rep => rep.chamber === 'Senate').length}
          </div>
        </div>
        <div className="stat-card">
          <h3>Active Bills</h3>
          <div className="stat-value">324</div>
        </div>
      </div>
      
      <h3>Accountability Metrics</h3>
      <p>
        Select a metric below to see how representatives rank against each other.
        These metrics help citizens hold their elected officials accountable.
      </p>
      
      <div className="metrics-grid">
        {metrics.map(metric => (
          <div 
            key={metric.id} 
            className="metric-card"
            onClick={() => {
              setSelectedMetric(metric.id);
              setActiveView('rankings');
            }}
          >
            <h4>{metric.name}</h4>
            <p>{metric.description}</p>
          </div>
        ))}
      </div>
    </div>
  );

  // Render rankings section
  const renderRankings = () => {
    const currentMetric = metrics.find(m => m.id === selectedMetric) || {};
    
    return (
      <div className="rankings-section">
        <div className="section-header">
          <h2>{currentMetric.name} Rankings</h2>
          <button onClick={() => setActiveView('overview')} className="back-button">
            &larr; Back to Overview
          </button>
        </div>
        
        <div className="filter-controls">
          <div className="filter-group">
            <label>Metric:</label>
            <select 
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
            >
              {metrics.map(metric => (
                <option key={metric.id} value={metric.id}>{metric.name}</option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label>Chamber:</label>
            <select 
              value={selectedChamber}
              onChange={(e) => setSelectedChamber(e.target.value)}
            >
              <option value="all">All Chambers</option>
              <option value="House">House</option>
              <option value="Senate">Senate</option>
            </select>
          </div>
        </div>
        
        <div className="rankings-visualization">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={rankings}
              layout="vertical"
              margin={{ top: 20, right: 30, left: 150, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 'dataMax']} />
              <YAxis 
                dataKey="name" 
                type="category" 
                tick={{ fill: '#333', fontSize: 14 }}
                width={140}
              />
              <Tooltip />
              <Legend />
              <Bar 
                dataKey="value" 
                name={currentMetric.name}
                fill="#8884d8"
                onClick={(data) => handleRepresentativeSelect(data.id)}
                cursor="pointer"
              >
                {rankings.map((entry, index) => (
                  <rect key={`rect-${index}`} fill={getPartyColor(entry.party)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        <div className="rankings-table">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Representative</th>
                <th>