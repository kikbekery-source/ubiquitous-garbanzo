/**
 * Auto-Optimization Engine
 * Automatically manages ad budgets and performance based on rules and AI analysis
 *
 * Features:
 * - Rule-based budget adjustments (increase/decrease/pause)
 * - Performance monitoring with configurable thresholds
 * - Automatic ad pausing for underperformers
 * - Budget scaling for winning campaigns
 * - Kill switch for emergency budget protection
 * - Integration with AI Consultant for smart decisions
 */

const { v4: uuidv4 } = require('uuid');

class AutoOptimizer {
  constructor() {
    this.db = null;
    this.fbAds = null;
    this.aiConsultant = null;
    this.running = false;
    this.intervalId = null;

    // Default thresholds from research
    this.defaultThresholds = {
      roas_good: 3.0,
      roas_bad: 2.0,
      roas_kill: 1.0,
      ctr_good: 2.0,
      ctr_bad: 0.5,
      frequency_warning: 3.0,
      frequency_critical: 5.0,
      max_budget_increase_pct: 20,
      min_conversions_for_decision: 20,
      lookback_days: 3,
      max_daily_budget: 10000,
      min_daily_budget: 100,
    };
  }

  init(db, fbAds, aiConsultant) {
    this.db = db;
    this.fbAds = fbAds;
    this.aiConsultant = aiConsultant;
    console.log('Auto-Optimizer initialized');
  }

  // ─── Rule Management ──────────────────────────────────────

  createRule({
    name, campaignId = null, conditionMetric, conditionOperator, conditionValue,
    conditionTimeframe = '24h', actionType, actionValue = null,
    maxBudgetLimit = null, minBudgetLimit = null, cooldownHours = 24,
  }) {
    if (!this.db) return null;

    const id = uuidv4();
    this.db.prepare(`
      INSERT INTO optimization_rules (
        id, name, campaign_id, condition_metric, condition_operator,
        condition_value, condition_timeframe, action_type, action_value,
        max_budget_limit, min_budget_limit, cooldown_hours
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, name, campaignId, conditionMetric, conditionOperator,
      conditionValue, conditionTimeframe, actionType, actionValue,
      maxBudgetLimit, minBudgetLimit, cooldownHours
    );

    return { id, name };
  }

  getRules(campaignId = null) {
    if (!this.db) return [];
    if (campaignId) {
      return this.db.prepare(
        'SELECT * FROM optimization_rules WHERE (campaign_id = ? OR campaign_id IS NULL) AND is_active = 1 ORDER BY created_at'
      ).all(campaignId);
    }
    return this.db.prepare('SELECT * FROM optimization_rules WHERE is_active = 1 ORDER BY created_at').all();
  }

  updateRule(id, updates) {
    if (!this.db) return;
    const fields = [];
    const values = [];
    for (const [key, val] of Object.entries(updates)) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      fields.push(`${snakeKey} = ?`);
      values.push(val);
    }
    values.push(id);
    this.db.prepare(`UPDATE optimization_rules SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  deleteRule(id) {
    if (!this.db) return;
    this.db.prepare('DELETE FROM optimization_rules WHERE id = ?').run(id);
  }

  // ─── Default Rules Setup ──────────────────────────────────

  setupDefaultRules() {
    const defaults = [
      {
        name: 'Scale Winners - High ROAS',
        conditionMetric: 'roas',
        conditionOperator: '>=',
        conditionValue: 3.0,
        conditionTimeframe: '3d',
        actionType: 'increase_budget',
        actionValue: 20,
        cooldownHours: 24,
      },
      {
        name: 'Cut Losers - Low ROAS',
        conditionMetric: 'roas',
        conditionOperator: '<',
        conditionValue: 2.0,
        conditionTimeframe: '3d',
        actionType: 'decrease_budget',
        actionValue: 30,
        cooldownHours: 24,
      },
      {
        name: 'Kill Switch - Negative ROAS',
        conditionMetric: 'roas',
        conditionOperator: '<',
        conditionValue: 1.0,
        conditionTimeframe: '2d',
        actionType: 'pause_campaign',
        cooldownHours: 48,
      },
      {
        name: 'Pause Zero Converters',
        conditionMetric: 'conversions',
        conditionOperator: '==',
        conditionValue: 0,
        conditionTimeframe: '2d',
        actionType: 'pause_campaign',
        cooldownHours: 48,
      },
      {
        name: 'Creative Fatigue Alert',
        conditionMetric: 'frequency',
        conditionOperator: '>',
        conditionValue: 3.0,
        conditionTimeframe: '7d',
        actionType: 'notify',
        cooldownHours: 72,
      },
      {
        name: 'High CPA Warning',
        conditionMetric: 'cpa',
        conditionOperator: '>',
        conditionValue: 100,
        conditionTimeframe: '3d',
        actionType: 'decrease_budget',
        actionValue: 20,
        cooldownHours: 24,
      },
    ];

    const created = [];
    for (const rule of defaults) {
      created.push(this.createRule(rule));
    }
    return created;
  }

  // ─── Performance Evaluation ───────────────────────────────

  async evaluateCampaign(campaignId) {
    // Get recent performance data
    const performances = this.db ? this.db.prepare(`
      SELECT * FROM ad_performance
      WHERE campaign_id = ?
      ORDER BY date DESC
      LIMIT 30
    `).all(campaignId) : [];

    if (performances.length === 0) {
      return { campaignId, status: 'no_data', actions: [] };
    }

    // Calculate aggregate metrics
    const metrics = this._calculateAggregateMetrics(performances);

    // Evaluate against rules
    const rules = this.getRules(campaignId);
    const triggeredActions = [];

    for (const rule of rules) {
      if (this._isRuleOnCooldown(rule)) continue;

      const metricValue = metrics[rule.condition_metric];
      if (metricValue === undefined) continue;

      if (this._evaluateCondition(metricValue, rule.condition_operator, rule.condition_value)) {
        triggeredActions.push({
          ruleId: rule.id,
          ruleName: rule.name,
          metric: rule.condition_metric,
          metricValue,
          threshold: rule.condition_value,
          actionType: rule.action_type,
          actionValue: rule.action_value,
        });
      }
    }

    return {
      campaignId,
      metrics,
      triggeredActions,
      status: triggeredActions.length > 0 ? 'action_needed' : 'healthy',
    };
  }

  async executeActions(campaignId, actions, autoApply = false) {
    const results = [];
    const campaign = this.db ? this.db.prepare(
      'SELECT * FROM ad_campaigns WHERE id = ?'
    ).get(campaignId) : null;

    for (const action of actions) {
      try {
        let result;

        switch (action.actionType) {
          case 'increase_budget': {
            const currentBudget = campaign ? campaign.daily_budget : 500;
            const increase = Math.min(action.actionValue || 20, this.defaultThresholds.max_budget_increase_pct);
            const newBudget = Math.min(
              currentBudget * (1 + increase / 100),
              this.defaultThresholds.max_daily_budget
            );

            if (autoApply && campaign && campaign.fb_campaign_id) {
              await this.fbAds.adjustBudget(campaign.fb_campaign_id, newBudget);
            }

            result = {
              action: 'increase_budget',
              oldBudget: currentBudget,
              newBudget: Math.round(newBudget * 100) / 100,
              applied: autoApply,
            };

            this._logBudgetChange(campaignId, 'increase', currentBudget, newBudget, action.ruleName, autoApply);
            break;
          }

          case 'decrease_budget': {
            const currentBudget = campaign ? campaign.daily_budget : 500;
            const decrease = action.actionValue || 30;
            const newBudget = Math.max(
              currentBudget * (1 - decrease / 100),
              this.defaultThresholds.min_daily_budget
            );

            if (autoApply && campaign && campaign.fb_campaign_id) {
              await this.fbAds.adjustBudget(campaign.fb_campaign_id, newBudget);
            }

            result = {
              action: 'decrease_budget',
              oldBudget: currentBudget,
              newBudget: Math.round(newBudget * 100) / 100,
              applied: autoApply,
            };

            this._logBudgetChange(campaignId, 'decrease', currentBudget, newBudget, action.ruleName, autoApply);
            break;
          }

          case 'pause_campaign': {
            if (autoApply && campaign && campaign.fb_campaign_id) {
              await this.fbAds.pauseCampaign(campaign.fb_campaign_id);
            }

            if (this.db && campaign) {
              this.db.prepare('UPDATE ad_campaigns SET status = ? WHERE id = ?').run('PAUSED', campaignId);
            }

            result = { action: 'pause_campaign', applied: autoApply };
            this._logBudgetChange(campaignId, 'pause', campaign?.daily_budget, 0, action.ruleName, autoApply);
            break;
          }

          case 'resume_campaign': {
            if (autoApply && campaign && campaign.fb_campaign_id) {
              await this.fbAds.resumeCampaign(campaign.fb_campaign_id);
            }

            if (this.db && campaign) {
              this.db.prepare('UPDATE ad_campaigns SET status = ? WHERE id = ?').run('ACTIVE', campaignId);
            }

            result = { action: 'resume_campaign', applied: autoApply };
            break;
          }

          case 'notify': {
            result = {
              action: 'notify',
              message: `⚠️ ${action.ruleName}: ${action.metric} = ${action.metricValue} (threshold: ${action.threshold})`,
              applied: true,
            };
            break;
          }

          default:
            result = { action: action.actionType, applied: false, reason: 'Unknown action type' };
        }

        // Update rule last triggered
        if (this.db) {
          this.db.prepare('UPDATE optimization_rules SET last_triggered_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(action.ruleId);
        }

        // Save AI recommendation
        if (this.aiConsultant) {
          this.aiConsultant.saveRecommendation({
            campaignId,
            type: 'budget_adjustment',
            recommendation: `${action.actionType}: ${JSON.stringify(result)}`,
            reasoning: `Rule "${action.ruleName}" triggered: ${action.metric} = ${action.metricValue}`,
            confidence: 0.8,
          });
        }

        results.push({ ...action, result, success: true });
      } catch (error) {
        results.push({ ...action, result: null, success: false, error: error.message });
      }
    }

    return results;
  }

  // ─── Scheduled Optimization Run ───────────────────────────

  async runOptimizationCycle() {
    if (!this.db) return { status: 'no_db', results: [] };

    const campaigns = this.db.prepare(
      "SELECT * FROM ad_campaigns WHERE status = 'ACTIVE'"
    ).all();

    const results = [];

    for (const campaign of campaigns) {
      const evaluation = await this.evaluateCampaign(campaign.id);

      if (evaluation.triggeredActions.length > 0) {
        const actionResults = await this.executeActions(
          campaign.id,
          evaluation.triggeredActions,
          true // auto-apply
        );
        results.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          evaluation,
          actionResults,
        });
      }
    }

    // AI analysis if consultant is available
    if (this.aiConsultant && campaigns.length > 0) {
      try {
        const allPerformance = this.db.prepare(`
          SELECT ap.*, ac.name as campaign_name
          FROM ad_performance ap
          JOIN ad_campaigns ac ON ap.campaign_id = ac.id
          WHERE ap.date >= date('now', '-7 days')
          ORDER BY ap.date DESC
        `).all();

        if (allPerformance.length > 0) {
          const aiAnalysis = await this.aiConsultant.analyzeCampaignPerformance({
            campaigns: campaigns.map(c => ({ id: c.id, name: c.name, status: c.status, budget: c.daily_budget })),
            performance: allPerformance,
          });
          results.push({ type: 'ai_analysis', data: aiAnalysis });
        }
      } catch (err) {
        results.push({ type: 'ai_analysis', error: err.message });
      }
    }

    return { status: 'completed', timestamp: new Date().toISOString(), results };
  }

  startScheduledOptimization(intervalMinutes = 60) {
    if (this.running) return { status: 'already_running' };

    this.running = true;
    this.intervalId = setInterval(() => {
      this.runOptimizationCycle().catch(err => {
        console.error('Optimization cycle error:', err);
      });
    }, intervalMinutes * 60 * 1000);

    console.log(`Auto-optimization started (every ${intervalMinutes} minutes)`);
    return { status: 'started', interval: intervalMinutes };
  }

  stopScheduledOptimization() {
    if (!this.running) return { status: 'not_running' };

    clearInterval(this.intervalId);
    this.running = false;
    console.log('Auto-optimization stopped');
    return { status: 'stopped' };
  }

  // ─── Helper Methods ───────────────────────────────────────

  _calculateAggregateMetrics(performances) {
    const totals = performances.reduce((acc, p) => ({
      impressions: acc.impressions + (p.impressions || 0),
      clicks: acc.clicks + (p.clicks || 0),
      spend: acc.spend + (p.spend || 0),
      conversions: acc.conversions + (p.conversions || 0),
      conversionValue: acc.conversionValue + (p.conversion_value || 0),
      reach: acc.reach + (p.reach || 0),
    }), { impressions: 0, clicks: 0, spend: 0, conversions: 0, conversionValue: 0, reach: 0 });

    return {
      impressions: totals.impressions,
      clicks: totals.clicks,
      spend: totals.spend,
      conversions: totals.conversions,
      ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
      cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
      cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0,
      cpa: totals.conversions > 0 ? totals.spend / totals.conversions : Infinity,
      roas: totals.spend > 0 ? totals.conversionValue / totals.spend : 0,
      frequency: totals.reach > 0 ? totals.impressions / totals.reach : 0,
      days: performances.length,
    };
  }

  _evaluateCondition(value, operator, threshold) {
    switch (operator) {
      case '>': return value > threshold;
      case '<': return value < threshold;
      case '>=': return value >= threshold;
      case '<=': return value <= threshold;
      case '==': return value === threshold;
      case '!=': return value !== threshold;
      default: return false;
    }
  }

  _isRuleOnCooldown(rule) {
    if (!rule.last_triggered_at) return false;
    const lastTriggered = new Date(rule.last_triggered_at).getTime();
    const cooldownMs = (rule.cooldown_hours || 24) * 60 * 60 * 1000;
    return Date.now() - lastTriggered < cooldownMs;
  }

  _logBudgetChange(campaignId, action, oldBudget, newBudget, reason, autoApply) {
    if (!this.db) return;
    this.db.prepare(`
      INSERT INTO budget_history (id, campaign_id, action, old_budget, new_budget, reason, triggered_by, ai_confidence)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(), campaignId, action, oldBudget, newBudget,
      reason, autoApply ? 'ai_auto' : 'manual', autoApply ? 0.8 : null
    );
  }

  // ─── Budget Overview ──────────────────────────────────────

  getBudgetHistory(campaignId = null, limit = 50) {
    if (!this.db) return [];
    if (campaignId) {
      return this.db.prepare(
        'SELECT * FROM budget_history WHERE campaign_id = ? ORDER BY created_at DESC LIMIT ?'
      ).all(campaignId, limit);
    }
    return this.db.prepare(
      'SELECT * FROM budget_history ORDER BY created_at DESC LIMIT ?'
    ).all(limit);
  }

  getBudgetSummary() {
    if (!this.db) return null;

    const activeCampaigns = this.db.prepare(
      "SELECT COUNT(*) as count, SUM(daily_budget) as total_daily FROM ad_campaigns WHERE status = 'ACTIVE'"
    ).get();

    const todaySpend = this.db.prepare(
      "SELECT SUM(spend) as total FROM ad_performance WHERE date = date('now')"
    ).get();

    const weekSpend = this.db.prepare(
      "SELECT SUM(spend) as total FROM ad_performance WHERE date >= date('now', '-7 days')"
    ).get();

    const recentChanges = this.db.prepare(
      'SELECT * FROM budget_history ORDER BY created_at DESC LIMIT 10'
    ).all();

    return {
      activeCampaigns: activeCampaigns?.count || 0,
      totalDailyBudget: activeCampaigns?.total_daily || 0,
      todaySpend: todaySpend?.total || 0,
      weekSpend: weekSpend?.total || 0,
      recentChanges,
      optimizerRunning: this.running,
    };
  }
}

module.exports = new AutoOptimizer();
