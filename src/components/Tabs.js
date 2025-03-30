// Tabs.js
import React, { useState } from 'react';
import '../styles/Tabs.css';

// Tabs container component
export const Tabs = ({ children, defaultActive = 0 }) => {
  const [activeTab, setActiveTab] = useState(defaultActive);

  // Clone children with additional props
  const enhancedChildren = React.Children.map(children, (child, index) => {
    return React.cloneElement(child, {
      isActive: index === activeTab,
      onActivate: () => setActiveTab(index),
      tabIndex: index
    });
  });

  return (
    <div className="tabs-container">
      <div className="tabs-header">
        {React.Children.map(children, (child, index) => {
          return (
            <button
              className={`tab-button ${index === activeTab ? 'active' : ''}`}
              onClick={() => setActiveTab(index)}
              role="tab"
              aria-selected={index === activeTab}
              id={`tab-${index}`}
              aria-controls={`tabpanel-${index}`}
            >
              {child.props.label}
            </button>
          );
        })}
      </div>
      <div className="tabs-content">
        {enhancedChildren}
      </div>
    </div>
  );
};

// Individual tab component
export const Tab = ({ children, isActive, tabIndex, label }) => {
  if (!isActive) return null;
  
  return (
    <div 
      className="tab-panel"
      role="tabpanel"
      id={`tabpanel-${tabIndex}`}
      aria-labelledby={`tab-${tabIndex}`}
    >
      {children}
    </div>
  );
};

// Default export of both components
export default { Tabs, Tab };
