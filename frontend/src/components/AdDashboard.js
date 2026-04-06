import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import EngagementPanel from './EngagementPanel';
import CampaignManager from './CampaignManager';
import AIConsultant from './AIConsultant';
import OptimizerPanel from './OptimizerPanel';

export default function AdDashboard({ onBack }) {
  const api = useApi();
  const [activeTab, setActiveTab] = useState('engagement');
  const [health, setHealth] = useState(null);

  const loadHealth = useCallback(async () => {
    try {
      const data = await api.get('/health');
      setHealth(data);
    } catch (e) { /* ignore */ }
  }, [api]);

  useEffect(() => { loadHealth(); }, [loadHealth]);

  const tabs = [
    { id: 'engagement', label: 'Engagement', icon: '📊' },
    { id: 'campaigns', label: 'Campaigns', icon: '📢' },
    { id: 'optimizer', label: 'Auto-Optimize', icon: '⚡' },
    { id: 'ai', label: 'AI Consultant', icon: '🤖' },
  ];

  return (
    <div className="ad-dashboard">
      <header className="ad-header">
        <div className="header-left">
          <button className="btn btn-ghost" onClick={onBack}>← กลับ</button>
          <h1>Ad Analyzer Dashboard</h1>
          <span className="badge badge-info">AdGenius AI</span>
        </div>
        <div className="header-right">
          {health && (
            <div className="service-status">
              <StatusDot label="FB" status={health.services?.facebookAds} />
              <StatusDot label="TT" status={health.services?.tiktokAnalytics} />
              <StatusDot label="AI" status={health.services?.aiConsultant} />
              <StatusDot label="Opt" status={health.services?.autoOptimizer === 'running' ? 'connected' : 'standby'} />
            </div>
          )}
        </div>
      </header>

      <nav className="ad-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="ad-content">
        {activeTab === 'engagement' && <EngagementPanel />}
        {activeTab === 'campaigns' && <CampaignManager />}
        {activeTab === 'optimizer' && <OptimizerPanel />}
        {activeTab === 'ai' && <AIConsultant />}
      </main>
    </div>
  );
}

function StatusDot({ label, status }) {
  const color = status === 'connected' || status === 'running'
    ? '#22c55e' : status === 'mock' ? '#f59e0b' : '#94a3b8';
  return (
    <span className="status-dot" title={`${label}: ${status}`}>
      <span style={{ backgroundColor: color, width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }} />
      {label}
    </span>
  );
}
