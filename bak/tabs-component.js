// Tabs.js
import React, { useState } from 'react';

export const Tab = ({ children, label, color }) => {
  return (
    <div className="tab-content">
      {children}
    </div>
  );
};

export const Tabs = ({ children }) => {
  const [activeTab, setActiveTab] = useState(0);
  
  // Filter out any non-Tab children
  const tabs = React.Children.toArray(children).filter(
    child => React.isValidElement(child) && child.type === Tab
  );
  
  if (tabs.length === 0) {
    return <div>No tabs provided</div>;
  }
  
  return (
    <div className="tabs-container">
      <div className="tabs-header">
        {tabs.map((tab, index) => (
          <button
            key={index}
            className={`tab-button ${activeTab === index ? 'active' : ''}`}
            onClick={() => setActiveTab(index)}
            style={{ 
              borderBottomColor: activeTab === index ? tab.props.color : 'transparent',
              color: activeTab === index ? tab.props.color : 'inherit'
            }}
          >
            {tab.props.label}
          </button>
        ))}
      </div>
      <div className="tab-content-container">
        {tabs[activeTab]}
      </div>
    </div>
  );
};
