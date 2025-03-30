import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './styles/dashboard.css';
import './styles/app.css';

// Import components
import Home from './components/Home';
import About from './components/About';
import AccountabilityDashboard from './components/AccountabilityDashboard';
import BillAnalysisDashboard from './components/BillAnalysisDashboard';

function App() {
  return (
    <Router>
      <div className="app-container">
        <header className="app-header">
          <h1>NH Legislative Accountability Tracker</h1>
          <nav className="app-nav">
            <a href="/" className="nav-item">Home</a>
            <a href="/bills" className="nav-item">Bill Analysis</a>
            <a href="/accountability" className="nav-item">Accountability</a>
            <a href="/about" className="nav-item">About</a>
          </nav>
        </header>
        
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/bills" element={<BillAnalysisDashboard />} />
            <Route path="/accountability" element={<AccountabilityDashboard />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </main>
        
        <footer className="app-footer">
          <div className="container">
            <p>&copy; {new Date().getFullYear()} NH Legislative Accountability Project</p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 