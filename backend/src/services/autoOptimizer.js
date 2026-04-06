/**
 * Auto-Optimization Engine
 * Automatically manages ad campaigns based on rules and AI recommendations
 *
 * Features:
 * - Rule-based optimization (if CTR < X then do Y)
 * - AI-driven budget adjustment
 * - Auto-pause underperforming ads
 * - Auto-scale winning campaigns
 * - Scheduled optimization cycles
 */

const { v4: uuidv4 } = require('uuid');

class AutoOptimizer {
  constructor() {
    this.db = null;
    this.fbAds = null;
    this.aiConsultant = null;
    this.isRunning = false;
    this.intervalId = null;
  }

  init(db, fbAdsService, aiConsultantService) {
    this.db = db;
    this.fbAds = fbAdsService;
    this.aiConsultant = aiConsultantService;
    console.log('Auto-Optimizer initialized');
  }

  // ─── Optimization Rules CRUD ──────────────────────────────

  createRule({
    name, campaignId = null, conditionMetric, conditionOperator, conditionValue,
    conditionTimeframe = '24h', actionType, actionValue = null,
    maxBudgetLimit = null, minBudgetLimit = null, cooldownHours = 24,
  }) {
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
    return id;
  }

  getRules(activeOnly = true) {
    const query = activeOnly
      ? 'SELECT * FROM optimization_rules WHERE is_active = 1 ORDER BY created_at DESC'
      : 'SELECT * FROM optimization_rules ORDER BY created_at DESC';
    return this.db.prepare(query).all();
  }

  updateRule(id, updates) {
    const fields = [];
    const params = [];
    for (const [key, value] of Object.entries(updates)) {
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      fields.push(`${dbKey} = ?`);
      params.push(value);
    }
    params.push(id);
    this.db.prepare(`UPDATE optimization_rules SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  }

  deleteRule(id) {
    this.db.prepare('DELETE FROM optimization_rules WHERE id = ?').run(id);
  }

  // ─── Default Rules (Pre-configured best practices) ────────

  createDefaultRules() {
    const defaults = [
      {
        name: 'หยุดแคมเปญ ROAS ต่ำ',
        conditionMetric: 'roas', conditionOperator: '<', conditionValue: 1.0,
        conditionTimeframe: '72h', actionType: 'pause_campaign',
        cooldownHours: 48,
      },
      {
        name: 'เพิ่มงบแคมเปญ CTR สูง',
        conditionMetric: 'ctr', conditionOperator: '>', conditionValue: 3.0,
        conditionTimeframe: '24h', actionType: 'increase_budget', actionValue: 20,
        cooldownHours: 24,
      },
      {
        name: 'ลดงบเมื่อ CPC สูงเกิน',
        conditionMetric: 'cpc', conditionOperator: '>', conditionValue: 15.0,
        conditionTimeframe: '24h', actionType: 'decrease_budget', actionValue: 30,
        cooldownHours: 24,
      },
      {
        name: 'แจ้งเตือน Frequency สูง',
        conditionMetric: 'frequency', conditionOperator: '>', conditionValue: 4.0,
        conditionTimeframe: '48h', actionType: 'notify',
        cooldownHours: 24,
      },
      {
        name: 'หยุดโฆษณา CTR ต่ำมาก',
        conditionMetric: 'ctr', conditionOperator: '<', conditionValue: 0.5,
        conditionTimeframe: '48h', actionType: 'pause_ad',
        cooldownHours: 72,
      },
      {
        name: 'Scale แคมเปญที่ ROAS ดี',
        conditionMetric: 'roas', conditionOperator: '>', conditionValue: 4.0,
        conditionTimeframe: '48h', actionType: 'increase_budget', actionValue: 30,
        maxBudgetLimit: 5000, cooldownHours: 48,
      },
    ];

    const existingRules = this.getRules(false);
    if (existingRules.length > 0) return existingRules;

    for (const rule of defaults) {
      this.createRule(rule);
    }

    return this.getRules(false);
  }

  // ─── Optimization Execution ───────────────────────────────

  async runOptimizationCycle() {
    if (!this.db) return { error: 'Not initialized' };

    const results = {
      timestamp: new Date().toISOString(),
      rulesChecked: 0,
      actionsApplied: [],
      aiRecommendations: [],
      errors: [],
    };

    try {
      // 1. Get all active campaigns and their performance
      const campaigns = this.db.prepare(`
        SELECT c.*,
          (SELECT json_group_array(json_object(
            'date', p.date, 'impressions', p.impressions, 'clicks', p.clicks,
            'ctr', p.ctr, 'cpc', p.cpc, 'cpm', p.cpm, 'spend', p.spend,
            'conversions', p.conversions, 'roas', p.roas, 'frequency', p.frequency
          )) FROM ad_performance p WHERE p.campaign_id = c.id
          ORDER BY p.date DESC LIMIT 7
          ) as recent_performance
        FROM ad_campaigns c WHERE c.status = 'ACTIVE'
      `).all();

      // 2. Get active rules
      const rules = this.getRules(true);

      // 3. Check each rule against each campaign
      for (const rule of rules) {
        results.rulesChecked++;

        // Check cooldown
        if (rule.last_triggered_at) {
          const cooldownEnd = new Date(rule.last_triggered_at);
          cooldownEnd.setHours(cooldownEnd.getHours() + rule.cooldown_hours);
          if (new Date() < cooldownEnd) continue;
        }

        const targetCampaigns = rule.campaign_id
          ? campaigns.filter(c => c.id === rule.campaign_id)
          : campaigns;

        for (const campaign of targetCampaigns) {
          const perfData = this._parseCampaignPerformance(campaign.recent_performance);
          if (!perfData) continue;

          const metricValue = this._getMetricValue(perfData, rule.condition_metric);
          if (metricValue === null) continue;

          const triggered = this._evaluateCondition(metricValue, rule.condition_operator, rule.condition_value);

          if (triggered) {
            const actionResult = await this._executeAction(rule, campaign, metricValue);
            results.actionsApplied.push(actionResult);

            // Update rule last triggered
            this.db.prepare('UPDATE optimization_rules SET last_triggered_at = CURRENT_TIMESTAMP WHERE id = ?')
              .run(rule.id);

            // Log in budget history
            if (['increase_budget', 'decrease_budget'].includes(rule.action_type)) {
              this._logBudgetChange(campaign.id, rule, actionResult);
            }
          }
        }
      }

      // 4. AI-driven analysis (if campaigns exist)
      if (campaigns.length > 0) {
        try {
          const aiSuggestions = await this.aiConsultant.suggestBudgetAdjustment(
            campaigns.map(c => ({
              id: c.id,
              name: c.name,
              dailyBudget: c.daily_budget,
              performance: this._parseCampaignPerformance(c.recent_performance),
            }))
          );

          if (aiSuggestions && aiSuggestions.adjustments) {
            for (const adj of aiSuggestions.adjustments) {
              // Only auto-apply high confidence recommendations
              if (adj.confidence >= 0.8 && adj.action !== 'pause') {
                results.aiRecommendations.push({
                  ...adj,
                  autoApplied: true,
                });
              } else {
                // Save as pending recommendation
                this.aiConsultant.saveRecommendation({
                  campaignId: adj.campaignId,
                  type: 'budget_adjustment',
                  recommendation: `${adj.action} budget to ฿${adj.recommendedBudget}`,
                  reasoning: adj.reason,
                  confidence: adj.confidence,
                });
                results.aiRecommendations.push({
                  ...adj,
                  autoApplied: false,
                });
              }
            }
          }
        } catch (err) {
          results.errors.push(`AI analysis error: ${err.message}`);
        }
      }

    } catch (error) {
      results.errors.push(`Optimization cycle error: ${error.message}`);
    }

    return results;
  }

  // ─── Scheduled Optimization ───────────────────────────────

  startScheduledOptimization(intervalMinutes = 60) {
    if (this.isRunning) {
      return { status: 'already_running', interval: intervalMinutes };
    }

    this.isRunning = true;
    this.intervalId = setInterval(async () => {
      console.log(`[AutoOptimizer] Running scheduled optimization at ${new Date().toISOString()}`);
      const result = await this.runOptimizationCycle();
      console.log(`[AutoOptimizer] Cycle complete: ${result.actionsApplied.length} actions, ${result.aiRecommendations.length} AI recommendations`);
    }, intervalMinutes * 60 * 1000);

    console.log(`[AutoOptimizer] Scheduled optimization every ${intervalMinutes} minutes`);
    return { status: 'started', interval: intervalMinutes };
  }

  stopScheduledOptimization() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    return { status: 'stopped' };
  }

  // ─── Helper Methods ───────────────────────────────────────

  _parseCampaignPerformance(rawPerf) {
    if (!rawPerf) return null;
    try {
      const data = typeof rawPerf === 'string' ? JSON.parse(rawPerf) : rawPerf;
      if (!Array.isArray(data) || data.length === 0) return null;

      // Aggregate recent performance
      const totals = { impressions: 0, clicks: 0, spend: 0, conversions: 0, conversionValue: 0 };
      let maxFrequency = 0;

      for (const day of data) {
        totals.impressions += day.impressions || 0;
        totals.clicks += day.clicks || 0;
        totals.spend += day.spend || 0;
        totals.conversions += day.conversions || 0;
        if (day.frequency > maxFrequency) maxFrequency = day.frequency;
      }

      return {
        ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
        cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
        cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0,
        cpa: totals.conversions > 0 ? totals.spend / totals.conversions : 999,
        roas: totals.spend > 0 && totals.conversionValue > 0 ? totals.conversionValue / totals.spend : 0,
        frequency: maxFrequency,
        spend: totals.spend,
        impressions: totals.impressions,
        clicks: totals.clicks,
        conversions: totals.conversions,
        days: data.length,
      };
    } catch {
      return null;
    }
  }

  _getMetricValue(perfData, metric) {
    const map = {
      'ctr': perfData.ctr,
      'cpc': perfData.cpc,
      'cpm': perfData.cpm,
      'cpa': perfData.cpa,
      'roas': perfData.roas,
      'frequency': perfData.frequency,
      'spend': perfData.spend,
      'impressions': perfData.impressions,
      'clicks': perfData.clicks,
      'conversions': perfData.conversions,
    };
    return map[metric] !== undefined ? map[metric] : null;
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

  async _executeAction(rule, campaign, metricValue) {
    const result = {
      ruleId: rule.id,
      ruleName: rule.name,
      campaignId: campaign.id,
      campaignName: campaign.name,
      action: rule.action_type,
      metricValue,
      timestamp: new Date().toISOString(),
    };

    try {
      switch (rule.action_type) {
        case 'increase_budget': {
          const increase = rule.action_value || 20;
          const newBudget = campaign.daily_budget * (1 + increase / 100);
          const capped = rule.max_budget_limit ? Math.min(newBudget, rule.max_budget_limit) : newBudget;

          if (campaign.fb_campaign_id) {
            await this.fbAds.adjustBudget(campaign.fb_campaign_id, capped);
          }
          this.db.prepare('UPDATE ad_campaigns SET daily_budget = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(capped, campaign.id);

          result.oldBudget = campaign.daily_budget;
          result.newBudget = capped;
          result.success = true;
          break;
        }

        case 'decrease_budget': {
          const decrease = rule.action_value || 20;
          const newBudget = campaign.daily_budget * (1 - decrease / 100);
          const floored = rule.min_budget_limit ? Math.max(newBudget, rule.min_budget_limit) : Math.max(newBudget, 100);

          if (campaign.fb_campaign_id) {
            await this.fbAds.adjustBudget(campaign.fb_campaign_id, floored);
          }
          this.db.prepare('UPDATE ad_campaigns SET daily_budget = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(floored, campaign.id);

          result.oldBudget = campaign.daily_budget;
          result.newBudget = floored;
          result.success = true;
          break;
        }

        case 'pause_campaign': {
          if (campaign.fb_campaign_id) {
            await this.fbAds.pauseCampaign(campaign.fb_campaign_id);
          }
          this.db.prepare("UPDATE ad_campaigns SET status = 'PAUSED', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            .run(campaign.id);

          result.success = true;
          break;
        }

        case 'resume_campaign': {
          if (campaign.fb_campaign_id) {
            await this.fbAds.resumeCampaign(campaign.fb_campaign_id);
          }
          this.db.prepare("UPDATE ad_campaigns SET status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            .run(campaign.id);

          result.success = true;
          break;
        }

        case 'pause_ad': {
          // Pause lowest performing ad in campaign
          const lowestAd = this.db.prepare(`
            SELECT a.* FROM ads a
            JOIN ad_performance p ON p.ad_id = a.id
            WHERE a.adset_id IN (SELECT id FROM ad_sets WHERE campaign_id = ?)
            AND a.status = 'ACTIVE'
            GROUP BY a.id
            ORDER BY AVG(p.ctr) ASC LIMIT 1
          `).get(campaign.id);

          if (lowestAd) {
            this.db.prepare("UPDATE ads SET status = 'PAUSED', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
              .run(lowestAd.id);
            result.pausedAdId = lowestAd.id;
          }
          result.success = true;
          break;
        }

        case 'notify': {
          result.notification = `⚠️ ${rule.name}: ${rule.condition_metric} = ${metricValue.toFixed(2)} (threshold: ${rule.condition_operator} ${rule.condition_value})`;
          result.success = true;
          break;
        }

        default:
          result.success = false;
          result.error = `Unknown action: ${rule.action_type}`;
      }
    } catch (error) {
      result.success = false;
      result.error = error.message;
    }

    return result;
  }

  _logBudgetChange(campaignId, rule, actionResult) {
    this.db.prepare(`
      INSERT INTO budget_history (id, campaign_id, action, old_budget, new_budget, reason, triggered_by, ai_confidence)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(), campaignId,
      rule.action_type === 'increase_budget' ? 'increase' : 'decrease',
      actionResult.oldBudget || null,
      actionResult.newBudget || null,
      `Rule: ${rule.name}`,
      'rule_based',
      null
    );
  }

  // ─── Analytics / Dashboard Data ───────────────────────────

  getOptimizationStats() {
    const stats = {};

    stats.totalRules = this.db.prepare('SELECT COUNT(*) as c FROM optimization_rules').get().c;
    stats.activeRules = this.db.prepare('SELECT COUNT(*) as c FROM optimization_rules WHERE is_active = 1').get().c;
    stats.totalBudgetChanges = this.db.prepare('SELECT COUNT(*) as c FROM budget_history').get().c;
    stats.recentChanges = this.db.prepare(
      'SELECT * FROM budget_history ORDER BY created_at DESC LIMIT 10'
    ).all();
    stats.pendingRecommendations = this.db.prepare(
      "SELECT COUNT(*) as c FROM ai_recommendations WHERE status = 'pending'"
    ).get().c;
    stats.isRunning = this.isRunning;

    return stats;
  }
}

module.exports = new AutoOptimizer();
