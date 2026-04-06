import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';

export default function EngagementPanel() {
  const api = useApi();
  const [engagements, setEngagements] = useState([]);
  const [stats, setStats] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [platform, setPlatform] = useState('');
  const [sort, setSort] = useState('engagement_rate');

  const loadData = useCallback(async () => {
    try {
      const [engData, statsData] = await Promise.all([
        api.get(`/engagement?sort=${sort}&order=DESC&limit=50${platform ? `&platform=${platform}` : ''}`),
        api.get('/engagement/stats'),
      ]);
      setEngagements(engData.data || []);
      setStats(statsData);
    } catch (e) { /* ignore */ }
  }, [api, platform, sort]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleFetch = async (plat) => {
    setLoading(true);
    try {
      if (plat === 'facebook') {
        await api.post('/engagement/facebook/fetch', { limit: 25 });
      } else {
        await api.post('/engagement/tiktok/fetch', { maxCount: 20 });
      }
      await loadData();
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const result = await api.post('/engagement/analyze', { platform: platform || undefined, limit: 20 });
      setAnalysis(result);
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Engagement Analytics</h2>
        <div className="panel-actions">
          <button className="btn btn-primary" onClick={() => handleFetch('facebook')} disabled={loading}>
            {loading ? 'Loading...' : 'Fetch Facebook'}
          </button>
          <button className="btn btn-secondary" onClick={() => handleFetch('tiktok')} disabled={loading}>
            {loading ? 'Loading...' : 'Fetch TikTok'}
          </button>
          <button className="btn btn-accent" onClick={handleAnalyze} disabled={loading || engagements.length === 0}>
            AI Analyze
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="stats-grid">
          <StatCard
            title="Facebook"
            stats={stats.facebook}
            color="#1877f2"
            icon="f"
          />
          <StatCard
            title="TikTok"
            stats={stats.tiktok}
            color="#000000"
            icon="T"
          />
        </div>
      )}

      {/* Filters */}
      <div className="filters-bar">
        <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="">All Platforms</option>
          <option value="facebook">Facebook</option>
          <option value="tiktok">TikTok</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="engagement_rate">Engagement Rate</option>
          <option value="likes">Likes</option>
          <option value="comments">Comments</option>
          <option value="shares">Shares</option>
          <option value="reach">Reach</option>
          <option value="views">Views</option>
          <option value="post_date">Date</option>
        </select>
      </div>

      {/* AI Analysis Results */}
      {analysis?.aiAnalysis && (
        <div className="analysis-card">
          <h3>AI Analysis Results</h3>
          <p className="analysis-summary">{analysis.aiAnalysis.summary}</p>
          {analysis.aiAnalysis.insights && (
            <div className="insights-list">
              <h4>Key Insights:</h4>
              <ul>
                {analysis.aiAnalysis.insights.map((insight, i) => (
                  <li key={i}>{insight}</li>
                ))}
              </ul>
            </div>
          )}
          {analysis.aiAnalysis.contentStrategy && (
            <div className="strategy-box">
              <h4>Content Strategy:</h4>
              <p><strong>What works:</strong> {analysis.aiAnalysis.contentStrategy.whatWorks}</p>
              <p><strong>Improve:</strong> {analysis.aiAnalysis.contentStrategy.improve}</p>
            </div>
          )}
          {analysis.aiAnalysis.topPerformers && (
            <div className="top-performers">
              <h4>Top Performers for Ads:</h4>
              {analysis.aiAnalysis.topPerformers.map((p, i) => (
                <div key={i} className="performer-card">
                  <span className={`badge badge-${p.adPotential === 'high' ? 'success' : p.adPotential === 'medium' ? 'warning' : 'default'}`}>
                    {p.adPotential}
                  </span>
                  <span>{p.reason}</span>
                  <span className="text-muted">{p.suggestedAdType}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Engagement Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Platform</th>
              <th>Content</th>
              <th>Type</th>
              <th>Eng. Rate</th>
              <th>Likes</th>
              <th>Comments</th>
              <th>Shares</th>
              <th>Reach/Views</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {engagements.map((eng) => (
              <tr key={eng.id}>
                <td>
                  <span className={`platform-badge ${eng.platform}`}>
                    {eng.platform === 'facebook' ? 'FB' : 'TT'}
                  </span>
                </td>
                <td className="content-cell" title={eng.post_content}>
                  {(eng.post_content || '').substring(0, 60)}...
                </td>
                <td>{eng.post_type}</td>
                <td>
                  <span className={`rate-badge ${eng.engagement_rate > 5 ? 'high' : eng.engagement_rate > 2 ? 'medium' : 'low'}`}>
                    {eng.engagement_rate}%
                  </span>
                </td>
                <td>{formatNum(eng.likes)}</td>
                <td>{formatNum(eng.comments)}</td>
                <td>{formatNum(eng.shares)}</td>
                <td>{formatNum(eng.reach || eng.views)}</td>
                <td>{eng.post_date ? new Date(eng.post_date).toLocaleDateString('th-TH') : '-'}</td>
              </tr>
            ))}
            {engagements.length === 0 && (
              <tr>
                <td colSpan="9" className="empty-table">
                  No engagement data yet. Click "Fetch Facebook" or "Fetch TikTok" to start.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ title, stats, color, icon }) {
  if (!stats) return null;
  return (
    <div className="stat-card" style={{ borderLeftColor: color }}>
      <div className="stat-header">
        <span className="stat-icon" style={{ backgroundColor: color }}>{icon}</span>
        <h3>{title}</h3>
      </div>
      <div className="stat-body">
        <div className="stat-item">
          <span className="stat-value">{stats.total_posts || 0}</span>
          <span className="stat-label">Posts</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.avg_engagement_rate || 0}%</span>
          <span className="stat-label">Avg. Engagement</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{formatNum(stats.total_likes || 0)}</span>
          <span className="stat-label">Total Likes</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{formatNum(stats.total_reach || stats.total_views || 0)}</span>
          <span className="stat-label">{title === 'TikTok' ? 'Views' : 'Reach'}</span>
        </div>
      </div>
    </div>
  );
}

function formatNum(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}
