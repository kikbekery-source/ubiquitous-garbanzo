import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';

export default function CampaignManager() {
  const api = useApi();
  const [campaigns, setCampaigns] = useState([]);
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [aiCreating, setAiCreating] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  const loadCampaigns = useCallback(async () => {
    try {
      const data = await api.get('/campaigns');
      setCampaigns(data.data || []);
    } catch (e) { /* ignore */ }
  }, [api]);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  const loadDetails = async (id) => {
    try {
      const data = await api.get(`/campaigns/${id}`);
      setDetails(data);
      setSelected(id);
    } catch (e) { /* ignore */ }
  };

  const handleCreate = async (formData) => {
    try {
      await api.post('/campaigns', formData);
      setShowCreate(false);
      loadCampaigns();
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleAICreate = async () => {
    setAiCreating(true);
    try {
      const result = await api.post('/campaigns/ai-create', {
        budget: 1000,
        objective: 'TRAFFIC',
        platform: 'facebook',
      });
      setAiResult(result);
      loadCampaigns();
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      setAiCreating(false);
    }
  };

  const handleBudget = async (id, action, amount) => {
    try {
      await api.post(`/campaigns/${id}/budget`, { action, amount });
      loadCampaigns();
      if (selected === id) loadDetails(id);
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.put(`/campaigns/${id}`, { status });
      loadCampaigns();
      if (selected === id) loadDetails(id);
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleAnalyze = async (id) => {
    try {
      const result = await api.get(`/campaigns/${id}/analyze`);
      setDetails(prev => ({ ...prev, aiAnalysis: result.aiAnalysis }));
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleLaunch = async (id) => {
    if (!window.confirm('Launch this campaign on Facebook? This will start spending budget.')) return;
    try {
      await api.post(`/campaigns/${id}/launch`);
      loadCampaigns();
      if (selected === id) loadDetails(id);
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Campaign Manager</h2>
        <div className="panel-actions">
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + New Campaign
          </button>
          <button className="btn btn-accent" onClick={handleAICreate} disabled={aiCreating}>
            {aiCreating ? 'AI Creating...' : 'AI Auto-Create'}
          </button>
        </div>
      </div>

      {/* AI Creation Result */}
      {aiResult && (
        <div className="analysis-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>AI Campaign Recommendations</h3>
            <button className="btn btn-ghost" onClick={() => setAiResult(null)}>Close</button>
          </div>
          {aiResult.recommendations?.campaigns?.map((camp, i) => (
            <div key={i} className="recommendation-card">
              <h4>{camp.name}</h4>
              <p>{camp.reasoning}</p>
              <div className="rec-details">
                <span>Budget: {camp.dailyBudget}/day</span>
                <span>Objective: {camp.objective}</span>
                <span>Est. CTR: {camp.estimatedResults?.estimatedCTR}</span>
              </div>
              {camp.adCopy && (
                <div className="ad-preview">
                  <strong>{camp.adCopy.headline}</strong>
                  <p>{camp.adCopy.body}</p>
                  <span className="badge badge-info">{camp.adCopy.callToAction}</span>
                </div>
              )}
            </div>
          ))}
          <p className="text-muted">{aiResult.created?.length || 0} campaigns created as drafts</p>
        </div>
      )}

      {/* Create Campaign Modal */}
      {showCreate && (
        <CreateCampaignForm
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      )}

      <div className="campaigns-layout">
        {/* Campaign List */}
        <div className="campaign-list">
          {campaigns.length === 0 && (
            <div className="empty-state small">
              <p>No campaigns yet.</p>
              <p className="text-muted">Create manually or let AI auto-create from your top engagement posts.</p>
            </div>
          )}
          {campaigns.map(camp => (
            <div
              key={camp.id}
              className={`campaign-card ${selected === camp.id ? 'selected' : ''}`}
              onClick={() => loadDetails(camp.id)}
            >
              <div className="campaign-top">
                <h4>{camp.name}</h4>
                <span className={`status-badge ${camp.status.toLowerCase()}`}>{camp.status}</span>
              </div>
              <div className="campaign-meta">
                <span>Objective: {camp.objective}</span>
                <span>Budget: {camp.daily_budget ? `${camp.daily_budget}/day` : 'N/A'}</span>
              </div>
              <div className="campaign-actions">
                <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); handleBudget(camp.id, 'increase', 100); }}>
                  +100
                </button>
                <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); handleBudget(camp.id, 'decrease', 100); }}>
                  -100
                </button>
                {camp.status === 'ACTIVE' && (
                  <button className="btn btn-sm btn-warning" onClick={(e) => { e.stopPropagation(); handleStatusChange(camp.id, 'PAUSED'); }}>
                    Pause
                  </button>
                )}
                {(camp.status === 'PAUSED' || camp.status === 'DRAFT') && (
                  <button className="btn btn-sm btn-success" onClick={(e) => { e.stopPropagation(); handleLaunch(camp.id); }}>
                    Launch
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Campaign Details */}
        {details && (
          <div className="campaign-details">
            <div className="detail-header">
              <h3>{details.campaign.name}</h3>
              <button className="btn btn-accent btn-sm" onClick={() => handleAnalyze(details.campaign.id)}>
                AI Analyze
              </button>
            </div>

            <div className="detail-grid">
              <div className="detail-item">
                <label>Status</label>
                <span className={`status-badge ${details.campaign.status.toLowerCase()}`}>
                  {details.campaign.status}
                </span>
              </div>
              <div className="detail-item">
                <label>Daily Budget</label>
                <span>{details.campaign.daily_budget || 'N/A'}</span>
              </div>
              <div className="detail-item">
                <label>Objective</label>
                <span>{details.campaign.objective}</span>
              </div>
              <div className="detail-item">
                <label>Bid Strategy</label>
                <span>{details.campaign.bid_strategy}</span>
              </div>
            </div>

            {/* Ad Sets */}
            {details.adSets?.length > 0 && (
              <div className="detail-section">
                <h4>Ad Sets ({details.adSets.length})</h4>
                {details.adSets.map(as => (
                  <div key={as.id} className="sub-card">
                    <span>{as.name}</span>
                    <span>Budget: {as.daily_budget || 'inherited'}</span>
                    <span>Goal: {as.optimization_goal}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Ads */}
            {details.ads?.length > 0 && (
              <div className="detail-section">
                <h4>Ads ({details.ads.length})</h4>
                {details.ads.map(ad => (
                  <div key={ad.id} className="sub-card">
                    <div>
                      <strong>{ad.headline || ad.name}</strong>
                      {ad.body_text && <p className="text-muted">{ad.body_text}</p>}
                    </div>
                    <span className={`status-badge ${ad.status.toLowerCase()}`}>{ad.status}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Budget History */}
            {details.budgetHistory?.length > 0 && (
              <div className="detail-section">
                <h4>Budget History</h4>
                <div className="history-list">
                  {details.budgetHistory.map(bh => (
                    <div key={bh.id} className="history-item">
                      <span className={`action-badge ${bh.action}`}>{bh.action}</span>
                      <span>{bh.old_budget} → {bh.new_budget}</span>
                      <span className="text-muted">{bh.reason}</span>
                      <span className="text-muted">{new Date(bh.created_at).toLocaleString('th-TH')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Analysis */}
            {details.aiAnalysis && (
              <div className="detail-section analysis-card">
                <h4>AI Performance Analysis</h4>
                <div className="score-display">
                  <span className={`score ${details.aiAnalysis.status}`}>
                    {details.aiAnalysis.overallScore}/100
                  </span>
                  <span>{details.aiAnalysis.status}</span>
                </div>
                <p>{details.aiAnalysis.summary}</p>

                {details.aiAnalysis.budgetRecommendation && (
                  <div className="rec-box">
                    <strong>Budget Recommendation:</strong>
                    <span className={`action-badge ${details.aiAnalysis.budgetRecommendation.action}`}>
                      {details.aiAnalysis.budgetRecommendation.action} {details.aiAnalysis.budgetRecommendation.percentage}%
                    </span>
                    <p>{details.aiAnalysis.budgetRecommendation.reason}</p>
                  </div>
                )}

                {details.aiAnalysis.optimizationTips && (
                  <ul>
                    {details.aiAnalysis.optimizationTips.map((tip, i) => (
                      <li key={i}>{tip}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateCampaignForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({
    name: '', objective: 'TRAFFIC', dailyBudget: 500, bidStrategy: 'LOWEST_COST',
  });

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>Create New Campaign</h3>
        <div className="form-group">
          <label>Campaign Name</label>
          <input
            type="text" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g., Promo Summer 2024"
          />
        </div>
        <div className="form-group">
          <label>Objective</label>
          <select value={form.objective} onChange={e => setForm(f => ({ ...f, objective: e.target.value }))}>
            <option value="AWARENESS">Awareness</option>
            <option value="TRAFFIC">Traffic</option>
            <option value="ENGAGEMENT">Engagement</option>
            <option value="LEADS">Leads</option>
            <option value="CONVERSIONS">Conversions</option>
            <option value="SALES">Sales</option>
          </select>
        </div>
        <div className="form-group">
          <label>Daily Budget (THB)</label>
          <input
            type="number" value={form.dailyBudget}
            onChange={e => setForm(f => ({ ...f, dailyBudget: Number(e.target.value) }))}
          />
        </div>
        <div className="form-group">
          <label>Bid Strategy</label>
          <select value={form.bidStrategy} onChange={e => setForm(f => ({ ...f, bidStrategy: e.target.value }))}>
            <option value="LOWEST_COST">Lowest Cost</option>
            <option value="COST_CAP">Cost Cap</option>
            <option value="BID_CAP">Bid Cap</option>
            <option value="MINIMUM_ROAS">Minimum ROAS</option>
          </select>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSubmit(form)} disabled={!form.name}>
            Create Campaign
          </button>
        </div>
      </div>
    </div>
  );
}
