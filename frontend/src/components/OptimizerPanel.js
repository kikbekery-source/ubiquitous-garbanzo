import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';

export default function OptimizerPanel() {
  const api = useApi();
  const [rules, setRules] = useState([]);
  const [stats, setStats] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [showCreateRule, setShowCreateRule] = useState(false);
  const [running, setRunning] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [rulesData, statsData] = await Promise.all([
        api.get('/optimizer/rules?activeOnly=false'),
        api.get('/optimizer/stats'),
      ]);
      setRules(rulesData.data || []);
      setStats(statsData);
    } catch (e) { /* ignore */ }
  }, [api]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreateDefaults = async () => {
    try {
      await api.post('/optimizer/rules/defaults');
      loadData();
    } catch (e) { alert(e.message); }
  };

  const handleRunOptimization = async () => {
    setRunning(true);
    try {
      const result = await api.post('/optimizer/run');
      setLastResult(result);
      loadData();
    } catch (e) {
      alert(e.message);
    } finally {
      setRunning(false);
    }
  };

  const handleSchedule = async (action) => {
    try {
      if (action === 'start') {
        await api.post('/optimizer/schedule/start', { intervalMinutes: 60 });
      } else {
        await api.post('/optimizer/schedule/stop');
      }
      loadData();
    } catch (e) { alert(e.message); }
  };

  const handleToggleRule = async (id, isActive) => {
    try {
      await api.put(`/optimizer/rules/${id}`, { isActive: isActive ? 0 : 1 });
      loadData();
    } catch (e) { alert(e.message); }
  };

  const handleDeleteRule = async (id) => {
    if (!window.confirm('Delete this rule?')) return;
    try {
      await api.del(`/optimizer/rules/${id}`);
      loadData();
    } catch (e) { alert(e.message); }
  };

  const handleCreateRule = async (rule) => {
    try {
      await api.post('/optimizer/rules', rule);
      setShowCreateRule(false);
      loadData();
    } catch (e) { alert(e.message); }
  };

  const handleBudgetAnalysis = async () => {
    setRunning(true);
    try {
      const result = await api.post('/optimizer/ai/budget-analysis');
      setLastResult({ aiBudgetAnalysis: result });
    } catch (e) {
      alert(e.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Auto-Optimization Engine</h2>
        <div className="panel-actions">
          <button className="btn btn-primary" onClick={handleRunOptimization} disabled={running}>
            {running ? 'Running...' : 'Run Now'}
          </button>
          <button className="btn btn-accent" onClick={handleBudgetAnalysis} disabled={running}>
            AI Budget Analysis
          </button>
          {stats?.isRunning ? (
            <button className="btn btn-warning" onClick={() => handleSchedule('stop')}>
              Stop Schedule
            </button>
          ) : (
            <button className="btn btn-success" onClick={() => handleSchedule('start')}>
              Start Schedule (1h)
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="stats-grid small">
          <div className="mini-stat">
            <span className="mini-stat-value">{stats.totalRules}</span>
            <span className="mini-stat-label">Total Rules</span>
          </div>
          <div className="mini-stat">
            <span className="mini-stat-value">{stats.activeRules}</span>
            <span className="mini-stat-label">Active Rules</span>
          </div>
          <div className="mini-stat">
            <span className="mini-stat-value">{stats.totalBudgetChanges}</span>
            <span className="mini-stat-label">Budget Changes</span>
          </div>
          <div className="mini-stat">
            <span className="mini-stat-value">{stats.pendingRecommendations}</span>
            <span className="mini-stat-label">Pending Recs</span>
          </div>
          <div className="mini-stat">
            <span className={`mini-stat-value ${stats.isRunning ? 'text-success' : ''}`}>
              {stats.isRunning ? 'RUNNING' : 'STOPPED'}
            </span>
            <span className="mini-stat-label">Scheduler</span>
          </div>
        </div>
      )}

      {/* Optimization Result */}
      {lastResult && (
        <div className="analysis-card">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h3>Last Optimization Result</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setLastResult(null)}>Close</button>
          </div>

          {lastResult.aiBudgetAnalysis ? (
            <div>
              <h4>AI Budget Analysis</h4>
              <p><strong>Strategy:</strong> {lastResult.aiBudgetAnalysis.overallStrategy}</p>
              {lastResult.aiBudgetAnalysis.adjustments?.map((adj, i) => (
                <div key={i} className="rec-card">
                  <strong>{adj.campaignName}</strong>
                  <span className={`action-badge ${adj.action}`}>{adj.action} {adj.changePercent}%</span>
                  <span>{adj.currentBudget} → {adj.recommendedBudget}</span>
                  <p className="text-muted">{adj.reason}</p>
                  <span className="confidence">Confidence: {((adj.confidence || 0) * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <p>Rules Checked: {lastResult.rulesChecked}</p>
              <p>Actions Applied: {lastResult.actionsApplied?.length || 0}</p>
              <p>AI Recommendations: {lastResult.aiRecommendations?.length || 0}</p>
              {lastResult.actionsApplied?.map((action, i) => (
                <div key={i} className="action-log">
                  <span className={`action-badge ${action.action}`}>{action.action}</span>
                  <span>{action.campaignName}</span>
                  {action.oldBudget && <span>{action.oldBudget} → {action.newBudget}</span>}
                  <span className={action.success ? 'text-success' : 'text-danger'}>
                    {action.success ? 'Success' : 'Failed'}
                  </span>
                </div>
              ))}
              {lastResult.errors?.length > 0 && (
                <div className="error-list">
                  {lastResult.errors.map((err, i) => <p key={i} className="text-danger">{err}</p>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Rules */}
      <div className="rules-section">
        <div className="rules-header">
          <h3>Optimization Rules</h3>
          <div>
            <button className="btn btn-sm" onClick={() => setShowCreateRule(true)}>+ Add Rule</button>
            <button className="btn btn-sm btn-secondary" onClick={handleCreateDefaults}>Load Defaults</button>
          </div>
        </div>

        {showCreateRule && (
          <CreateRuleForm onSubmit={handleCreateRule} onCancel={() => setShowCreateRule(false)} />
        )}

        <div className="rules-list">
          {rules.length === 0 && (
            <div className="empty-state small">
              <p>No optimization rules. Click "Load Defaults" for recommended rules.</p>
            </div>
          )}
          {rules.map(rule => (
            <div key={rule.id} className={`rule-card ${rule.is_active ? '' : 'inactive'}`}>
              <div className="rule-top">
                <h4>{rule.name}</h4>
                <div className="rule-controls">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={!!rule.is_active}
                      onChange={() => handleToggleRule(rule.id, rule.is_active)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteRule(rule.id)}>Delete</button>
                </div>
              </div>
              <div className="rule-condition">
                <code>
                  IF {rule.condition_metric} {rule.condition_operator} {rule.condition_value}
                  {' '}(over {rule.condition_timeframe})
                </code>
                <span>→</span>
                <code>{rule.action_type} {rule.action_value ? `(${rule.action_value}%)` : ''}</code>
              </div>
              <div className="rule-meta">
                <span>Cooldown: {rule.cooldown_hours}h</span>
                {rule.max_budget_limit && <span>Max: {rule.max_budget_limit}</span>}
                {rule.min_budget_limit && <span>Min: {rule.min_budget_limit}</span>}
                {rule.last_triggered_at && (
                  <span>Last triggered: {new Date(rule.last_triggered_at).toLocaleString('th-TH')}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Budget Changes */}
      {stats?.recentChanges?.length > 0 && (
        <div className="detail-section">
          <h3>Recent Budget Changes</h3>
          <div className="history-list">
            {stats.recentChanges.map(ch => (
              <div key={ch.id} className="history-item">
                <span className={`action-badge ${ch.action}`}>{ch.action}</span>
                <span>{ch.old_budget} → {ch.new_budget}</span>
                <span className="badge badge-default">{ch.triggered_by}</span>
                <span className="text-muted">{ch.reason}</span>
                <span className="text-muted">{new Date(ch.created_at).toLocaleString('th-TH')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CreateRuleForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({
    name: '',
    conditionMetric: 'ctr',
    conditionOperator: '>',
    conditionValue: 3.0,
    conditionTimeframe: '24h',
    actionType: 'increase_budget',
    actionValue: 20,
    cooldownHours: 24,
    maxBudgetLimit: null,
    minBudgetLimit: null,
  });

  return (
    <div className="create-rule-form">
      <h4>Create Optimization Rule</h4>
      <div className="form-row">
        <div className="form-group">
          <label>Rule Name</label>
          <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Scale high CTR campaigns" />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Metric</label>
          <select value={form.conditionMetric} onChange={e => setForm(f => ({ ...f, conditionMetric: e.target.value }))}>
            <option value="ctr">CTR (%)</option>
            <option value="cpc">CPC (THB)</option>
            <option value="cpm">CPM (THB)</option>
            <option value="cpa">CPA (THB)</option>
            <option value="roas">ROAS (x)</option>
            <option value="frequency">Frequency</option>
            <option value="spend">Spend (THB)</option>
          </select>
        </div>
        <div className="form-group">
          <label>Operator</label>
          <select value={form.conditionOperator} onChange={e => setForm(f => ({ ...f, conditionOperator: e.target.value }))}>
            <option value=">">Greater than (&gt;)</option>
            <option value="<">Less than (&lt;)</option>
            <option value=">=">Greater or equal (&gt;=)</option>
            <option value="<=">Less or equal (&lt;=)</option>
          </select>
        </div>
        <div className="form-group">
          <label>Value</label>
          <input type="number" step="0.1" value={form.conditionValue} onChange={e => setForm(f => ({ ...f, conditionValue: Number(e.target.value) }))} />
        </div>
        <div className="form-group">
          <label>Timeframe</label>
          <select value={form.conditionTimeframe} onChange={e => setForm(f => ({ ...f, conditionTimeframe: e.target.value }))}>
            <option value="24h">24 hours</option>
            <option value="48h">48 hours</option>
            <option value="72h">72 hours</option>
            <option value="7d">7 days</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Action</label>
          <select value={form.actionType} onChange={e => setForm(f => ({ ...f, actionType: e.target.value }))}>
            <option value="increase_budget">Increase Budget</option>
            <option value="decrease_budget">Decrease Budget</option>
            <option value="pause_campaign">Pause Campaign</option>
            <option value="pause_ad">Pause Ad</option>
            <option value="notify">Notify Only</option>
          </select>
        </div>
        {(form.actionType === 'increase_budget' || form.actionType === 'decrease_budget') && (
          <div className="form-group">
            <label>Change %</label>
            <input type="number" value={form.actionValue || ''} onChange={e => setForm(f => ({ ...f, actionValue: Number(e.target.value) }))} />
          </div>
        )}
        <div className="form-group">
          <label>Cooldown (hours)</label>
          <input type="number" value={form.cooldownHours} onChange={e => setForm(f => ({ ...f, cooldownHours: Number(e.target.value) }))} />
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={() => onSubmit(form)} disabled={!form.name}>Create Rule</button>
      </div>
    </div>
  );
}
