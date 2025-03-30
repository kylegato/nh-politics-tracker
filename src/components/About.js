import React from 'react';
import '../styles/About.css';

const About = () => {
  return (
    <div className="container">
      <h2>About NH Legislative Accountability Tracker</h2>
      
      <section className="about-section">
        <h3>Our Mission</h3>
        <p>
          The NH Legislative Accountability Tracker aims to bring transparency to the New Hampshire 
          legislative process and provide citizens with accessible tools to understand and hold 
          their elected officials accountable.
        </p>
      </section>
      
      <section className="about-section">
        <h3>Data Sources</h3>
        <p>
          Our data is sourced directly from:
        </p>
        <ul>
          <li>The New Hampshire General Court official records</li>
          <li>OpenStates API for legislative tracking</li>
          <li>Public voting records and legislative archives</li>
          <li>Official representative statements and campaign materials</li>
        </ul>
        <p>
          All data is collected, processed, and analyzed using automated systems with regular 
          human review for accuracy.
        </p>
      </section>
      
      <section className="about-section">
        <h3>Methodology</h3>
        <p>
          Our analysis uses the following methodologies:
        </p>
        <ul>
          <li>
            <strong>Bill Analysis:</strong> Our AI-powered system examines bill text and metadata to determine 
            potential impacts on taxes, budgets, and society. Analysis is verified by policy experts for accuracy.
          </li>
          <li>
            <strong>Representative Accountability:</strong> Metrics are calculated directly from public voting 
            records, attendance logs, and tracked campaign promises. All calculations use transparent methodologies 
            that are documented and replicable.
          </li>
          <li>
            <strong>Nonpartisan Approach:</strong> Our analysis avoids political interpretation and focuses on 
            objective measurements of legislative actions and outcomes.
          </li>
        </ul>
      </section>
      
      <section className="about-section">
        <h3>Our Team</h3>
        <p>
          The NH Legislative Accountability Tracker is maintained by a team of volunteer developers, 
          data scientists, and civic-minded individuals committed to improving transparency in state government.
        </p>
      </section>
      
      <section className="about-section">
        <h3>Contact Information</h3>
        <p>
          For questions, feedback, or data correction requests, please contact us at:
          <br />
          <a href="mailto:info@nhlat.org">info@nhlat.org</a>
        </p>
      </section>
    </div>
  );
};

export default About; 