// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';

// API service for backend communication
const API_BASE_URL = 'https://api.yourdomain.com';

const apiService = {
  // Fetch list of available states
  async getStates() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/states`);
      if (!response.ok) throw new Error('Failed to fetch states');
      return await response.json();
    } catch (error) {
      console.error('Error fetching states:', error);
      return [];
    }
  },
  
  // Fetch sessions for a specific state
  async getSessions(state) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/sessions?state=${state}`);
      if (!response.ok) throw new Error(`Failed to fetch sessions for ${state}`);
      return await response.json();
    } catch (error) {
      console.error(`Error fetching sessions for ${state}:`, error);
      return [];
    }
  },
  
  // Fetch bills for a specific state and session
  async getBills(state, session, page = 1, perPage = 20) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/bills?state=${state}&session=${session}&page=${page}&perPage=${perPage}`
      );
      if (!response.ok) throw new Error(`Failed to fetch bills for ${state}, session ${session}`);
      return await response.json();
    } catch (error) {
      console.error(`Error fetching bills for ${state}, session ${session}:`, error);
      return { results: [], pagination: { page: 1, per_page: perPage, total_items: 0, total_pages: 0 } };
    }
  },
  
  // Fetch a specific bill by ID
  async getBill(billId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/bills?id=${billId}`);
      if (!response.ok) throw new Error(`Failed to fetch bill ${billId}`);
      return await response.json();
    } catch (error) {
      console.error(`Error fetching bill ${billId}:`, error);
      return null;
    }
  },
  
  // Search for bills
  async searchBills(query, state = null, page = 1, perPage = 20) {
    try {
      let url = `${API_BASE_URL}/api/bills?query=${encodeURIComponent(query)}&page=${page}&perPage=${perPage}`;
      if (state) url += `&state=${state}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to search bills for "${query}"`);
      return await response.json();
    } catch (error) {
      console.error(`Error searching bills for "${query}":`, error);
      return { results: [], pagination: { page: 1, per_page: perPage, total_items: 0, total_pages: 0 } };
    }
  }
};

// Layout component
function Layout({ children }) {
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Legislative Tracker</h1>
        <nav>
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/search">Search</Link></li>
            <li><Link to="/about">About</Link></li>
          </ul>
        </nav>
      </header>
      <main className="app-content">
        {children}
      </main>
      <footer className="app-footer">
        <p>&copy; {new Date().getFullYear()} Legislative Tracker</p>
      </footer>
    </div>
  );
}

// Home page
function HomePage() {
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    async function fetchStates() {
      try {
        setLoading(true);
        const data = await apiService.getStates();
        setStates(data);
        setError(null);
      } catch (err) {
        setError('Failed to load states. Please try again later.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchStates();
  }, []);
  
  return (
    <Layout>
      <section className="hero">
        <h2>Track Legislation Across States</h2>
        <p>Stay informed about bills and legislative activity in various states.</p>
      </section>
      
      <section className="states-list">
        <h3>Select a State to Begin</h3>
        
        {loading && <p>Loading states...</p>}
        
        {error && <p className="error">{error}</p>}
        
        {!loading && !error && (
          <div className="state-grid">
            {states.map(state => (
              <Link 
                key={state.code} 
                to={`/state/${state.code}`} 
                className="state-card"
              >
                <h4>{state.name}</h4>
                <p>{state.classification}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
}

// State detail page
function StatePage({ match }) {
  const stateCode = match.params.stateCode;
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stateInfo, setStateInfo] = useState(null);
  
  useEffect(() => {
    async function fetchStateData() {
      try {
        setLoading(true);
        
        // Fetch state info
        const states = await apiService.getStates();
        const currentState = states.find(s => s.code === stateCode);
        setStateInfo(currentState);
        
        // Fetch sessions
        const sessionsData = await apiService.getSessions(stateCode);
        setSessions(sessionsData);
        setError(null);
      } catch (err) {
        setError('Failed to load state data. Please try again later.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchStateData();
  }, [stateCode]);
  
  return (
    <Layout>
      {loading && <p>Loading state information...</p>}
      
      {error && <p className="error">{error}</p>}
      
      {!loading && !error && stateInfo && (
        <>
          <div className="state-header">
            <h2>{stateInfo.name}</h2>
            <p>{stateInfo.classification}</p>
          </div>
          
          <section className="sessions-list">
            <h3>Legislative Sessions</h3>
            
            {sessions.length === 0 ? (
              <p>No sessions available for this state.</p>
            ) : (
              <div className="session-grid">
                {sessions.map(session => (
                  <Link 
                    key={session.identifier} 
                    to={`/state/${stateCode}/session/${session.identifier}`} 
                    className="session-card"
                  >
                    <h4>{session.name}</h4>
                    <p>Start: {new Date(session.start_date).toLocaleDateString()}</p>
                    {session.end_date && (
                      <p>End: {new Date(session.end_date).toLocaleDateString()}</p>
                    )}
                    <span className="page-info">{pagination.page} of {pagination.total_pages}</span>
                
                <button 
                  onClick={() => handlePageChange(pagination.page + 1)} 
                  disabled={pagination.page === pagination.total_pages}
                >
                  &rsaquo;
                </button>
                
                <button 
                  onClick={() => handlePageChange(pagination.total_pages)} 
                  disabled={pagination.page === pagination.total_pages}
                >
                  &raquo;
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}

// Bill detail page
function BillPage({ match }) {
  const { stateCode, sessionId, billId } = match.params;
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    async function fetchBill() {
      try {
        setLoading(true);
        const fullBillId = `${stateCode}:${sessionId}:${billId}`;
        const data = await apiService.getBill(fullBillId);
        setBill(data);
        setError(null);
      } catch (err) {
        setError('Failed to load bill details. Please try again later.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchBill();
  }, [stateCode, sessionId, billId]);
  
  return (
    <Layout>
      <div className="bill-header">
        <Link to={`/state/${stateCode}/session/${sessionId}`}>&larr; Back to Session</Link>
      </div>
      
      {loading && <p>Loading bill details...</p>}
      
      {error && <p className="error">{error}</p>}
      
      {!loading && !error && bill && (
        <div className="bill-details">
          <h2>{bill.identifier}: {bill.title}</h2>
          
          <div className="bill-meta">
            <p><strong>State:</strong> {bill.jurisdiction}</p>
            <p><strong>Session:</strong> {bill.session}</p>
            <p><strong>Last Updated:</strong> {new Date(bill.updated_at).toLocaleString()}</p>
          </div>
          
          {bill.abstract && (
            <section className="bill-abstract">
              <h3>Abstract</h3>
              <p>{bill.abstract}</p>
            </section>
          )}
          
          <section className="bill-sponsors">
            <h3>Sponsors</h3>
            {bill.sponsors && bill.sponsors.length > 0 ? (
              <ul>
                {bill.sponsors.map((sponsor, index) => (
                  <li key={index}>
                    {sponsor.name} ({sponsor.classification})
                  </li>
                ))}
              </ul>
            ) : (
              <p>No sponsor information available.</p>
            )}
          </section>
          
          <section className="bill-actions">
            <h3>Actions</h3>
            {bill.actions && bill.actions.length > 0 ? (
              <ul className="timeline">
                {bill.actions.map((action, index) => (
                  <li key={index} className="timeline-item">
                    <div className="timeline-date">
                      {new Date(action.date).toLocaleDateString()}
                    </div>
                    <div className="timeline-content">
                      <p>{action.description}</p>
                      <span className="action-type">{action.classification.join(', ')}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No action information available.</p>
            )}
          </section>
          
          {bill.sources && bill.sources.length > 0 && (
            <section className="bill-sources">
              <h3>Sources</h3>
              <ul>
                {bill.sources.map((source, index) => (
                  <li key={index}>
                    <a href={source.url} target="_blank" rel="noopener noreferrer">
                      {source.note || 'Source Link'}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Layout>
  );
}

// Search page
function SearchPage() {
  const [query, setQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [states, setStates] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 20,
    total_items: 0,
    total_pages: 0
  });
  
  useEffect(() => {
    // Fetch states for the filter dropdown
    async function fetchStates() {
      const statesData = await apiService.getStates();
      setStates(statesData);
    }
    
    fetchStates();
  }, []);
  
  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!query.trim()) return;
    
    setLoading(true);
    setSearched(true);
    
    try {
      const results = await apiService.searchBills(
        query,
        stateFilter || null,
        pagination.page,
        pagination.per_page
      );
      
      setSearchResults(results.results);
      setPagination(results.pagination);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.total_pages) {
      setPagination({
        ...pagination,
        page: newPage
      });
      
      // Re-run search with new page
      apiService.searchBills(
        query,
        stateFilter || null,
        newPage,
        pagination.per_page
      ).then(results => {
        setSearchResults(results.results);
        setPagination(results.pagination);
      });
    }
  };
  
  return (
    <Layout>
      <h2>Search Bills</h2>
      
      <form onSubmit={handleSearch} className="search-form">
        <div className="search-controls">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by keyword, bill number, etc."
            className="search-input"
            required
          />
          
          <select 
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="state-filter"
          >
            <option value="">All States</option>
            {states.map(state => (
              <option key={state.code} value={state.code}>
                {state.name}
              </option>
            ))}
          </select>
          
          <button type="submit" className="search-button" disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>
      
      {loading && <p>Searching...</p>}
      
      {searched && !loading && (
        <div className="search-results">
          <h3>Search Results</h3>
          
          {searchResults.length === 0 ? (
            <p>No bills found matching your search criteria.</p>
          ) : (
            <>
              <p>{pagination.total_items} bills found</p>
              
              <div className="bills-container">
                <table className="bills-table">
                  <thead>
                    <tr>
                      <th>State</th>
                      <th>Bill ID</th>
                      <th>Title</th>
                      <th>Last Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map(bill => (
                      <tr key={bill.id}>
                        <td>{bill.jurisdiction.toUpperCase()}</td>
                        <td>
                          <Link to={`/bill/${bill.jurisdiction}/${bill.session}/${bill.identifier}`}>
                            {bill.identifier}
                          </Link>
                        </td>
                        <td>{bill.title}</td>
                        <td>{new Date(bill.updated_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                <div className="pagination">
                  <button 
                    onClick={() => handlePageChange(1)} 
                    disabled={pagination.page === 1}
                  >
                    &laquo;
                  </button>
                  
                  <button 
                    onClick={() => handlePageChange(pagination.page - 1)} 
                    disabled={pagination.page === 1}
                  >
                    &lsaquo;
                  </button>
                  
                  <span className="page-info">{pagination.page} of {pagination.total_pages}</span>
                  
                  <button 
                    onClick={() => handlePageChange(pagination.page + 1)} 
                    disabled={pagination.page === pagination.total_pages}
                  >
                    &rsaquo;
                  </button>
                  
                  <button 
                    onClick={() => handlePageChange(pagination.total_pages)} 
                    disabled={pagination.page === pagination.total_pages}
                  >
                    &raquo;
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </Layout>
  );
}

// About page
function AboutPage() {
  return (
    <Layout>
      <h2>About Legislative Tracker</h2>
      
      <section className="about-content">
        <p>
          Legislative Tracker is a tool designed to help citizens, researchers, advocates, and 
          journalists monitor legislative activity across multiple states.
        </p>
        
        <p>
          Our data is sourced from the <a href="https://openstates.org/" target="_blank" rel="noopener noreferrer">OpenStates API</a>,
          which provides standardized access to legislative information from all 50 states.
        </p>
        
        <h3>Features</h3>
        <ul>
          <li>Browse bills by state and legislative session</li>
          <li>Search for bills across multiple states</li>
          <li>Track bill history and status updates</li>
          <li>View details about sponsors, actions, and more</li>
        </ul>
        
        <h3>Data Limitations</h3>
        <p>
          While we strive to provide the most accurate and up-to-date information, please be aware that:
        </p>
        <ul>
          <li>Data is updated periodically, not in real-time</li>
          <li>Some states may have delays in reporting legislative information</li>
          <li>The completeness of data may vary by state</li>
        </ul>
        
        <p>
          For the most current information on a specific bill, we recommend visiting the official 
          website of the relevant state legislature.
        </p>
      </section>
    </Layout>
  );
}

// Main App component
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/state/:stateCode" element={<StatePage />} />
        <Route path="/state/:stateCode/session/:sessionId" element={<SessionPage />} />
        <Route path="/bill/:stateCode/:sessionId/:billId" element={<BillPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
    </Router>
  );
}

export default App; className="session-type">{session.classification}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </Layout>
  );
}

// Session detail page with bills
function SessionPage({ match }) {
  const { stateCode, sessionId } = match.params;
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 20,
    total_items: 0,
    total_pages: 0
  });
  
  useEffect(() => {
    async function fetchBills() {
      try {
        setLoading(true);
        const data = await apiService.getBills(
          stateCode, 
          sessionId, 
          pagination.page, 
          pagination.per_page
        );
        
        setBills(data.results);
        setPagination(data.pagination);
        setError(null);
      } catch (err) {
        setError('Failed to load bills. Please try again later.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchBills();
  }, [stateCode, sessionId, pagination.page, pagination.per_page]);
  
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.total_pages) {
      setPagination({
        ...pagination,
        page: newPage
      });
    }
  };
  
  return (
    <Layout>
      <div className="session-header">
        <Link to={`/state/${stateCode}`}>&larr; Back to {stateCode.toUpperCase()}</Link>
        <h2>Bills for {stateCode.toUpperCase()} - Session {sessionId}</h2>
      </div>
      
      {loading && <p>Loading bills...</p>}
      
      {error && <p className="error">{error}</p>}
      
      {!loading && !error && (
        <>
          {bills.length === 0 ? (
            <p>No bills available for this session.</p>
          ) : (
            <div className="bills-container">
              <table className="bills-table">
                <thead>
                  <tr>
                    <th>Bill ID</th>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map(bill => (
                    <tr key={bill.id}>
                      <td>
                        <Link to={`/bill/${bill.jurisdiction}/${bill.session}/${bill.identifier}`}>
                          {bill.identifier}
                        </Link>
                      </td>
                      <td>{bill.title}</td>
                      <td>
                        {bill.latest_action_description || 'No status available'}
                      </td>
                      <td>{new Date(bill.updated_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              <div className="pagination">
                <button 
                  onClick={() => handlePageChange(1)} 
                  disabled={pagination.page === 1}
                >
                  &laquo;
                </button>
                
                <button 
                  onClick={() => handlePageChange(pagination.page - 1)} 
                  disabled={pagination.page === 1}
                >
                  &lsaquo;
                </button>
                
                <span