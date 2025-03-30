import React from 'react';
import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="container">
      <div className="home-hero">
        <h2>NH Legislative Accountability Tracker</h2>
        <p>
          Monitor and analyze New Hampshire legislation and hold representatives 
          accountable with our comprehensive tracking and analysis tools.
        </p>
        
        <div className="feature-cards">
          <div className="feature-card">
            <h3>Bill Analysis</h3>
            <p>
              Track and analyze bills in the New Hampshire legislature. 
              Our AI-powered analysis helps identify impacts on taxes, 
              budgets, and society.
            </p>
            <Link to="/bills" className="btn-primary">View Bill Analysis</Link>
          </div>
          
          <div className="feature-card">
            <h3>Representative Accountability</h3>
            <p>
              Monitor voting records, attendance, and promise fulfillment of
              your elected representatives. Hold them accountable for their actions.
            </p>
            <Link to="/accountability" className="btn-primary">View Representatives</Link>
          </div>
          
          <div className="feature-card">
            <h3>Data Transparency</h3>
            <p>
              All our data is sourced directly from public records with clear 
              attribution and methodology. Our analysis is transparent and nonpartisan.
            </p>
            <Link to="/about" className="btn-primary">Learn More</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home; 