/**
 * Ad Analyzer Database Schema
 * Tables for social media engagement, campaigns, AI memory, and optimization
 */

function initAdSchema(db) {
  db.exec(`
    -- =============================================
    -- Social Media Accounts
    -- =============================================
    CREATE TABLE IF NOT EXISTS social_accounts (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL CHECK(platform IN ('facebook', 'tiktok')),
      account_name TEXT NOT NULL,
      account_id TEXT NOT NULL,
      access_token TEXT,
      token_expires_at DATETIME,
      page_id TEXT,
      pixel_id TEXT,
      ad_account_id TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'expired')),
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- =============================================
    -- Engagement Data (Facebook + TikTok)
    -- =============================================
    CREATE TABLE IF NOT EXISTS engagements (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      platform TEXT NOT NULL CHECK(platform IN ('facebook', 'tiktok')),
      post_id TEXT NOT NULL,
      post_type TEXT CHECK(post_type IN ('image', 'video', 'carousel', 'reel', 'story', 'text', 'live')),
      post_url TEXT,
      post_content TEXT,
      thumbnail_url TEXT,
      -- Metrics
      likes INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      shares INTEGER DEFAULT 0,
      saves INTEGER DEFAULT 0,
      reach INTEGER DEFAULT 0,
      impressions INTEGER DEFAULT 0,
      views INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      engagement_rate REAL DEFAULT 0,
      -- TikTok specific
      tiktok_plays INTEGER DEFAULT 0,
      tiktok_full_watches INTEGER DEFAULT 0,
      tiktok_avg_watch_time REAL DEFAULT 0,
      -- Timestamps
      post_date DATETIME,
      fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      raw_data TEXT,
      FOREIGN KEY (account_id) REFERENCES social_accounts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_engagements_account ON engagements(account_id);
    CREATE INDEX IF NOT EXISTS idx_engagements_platform ON engagements(platform);
    CREATE INDEX IF NOT EXISTS idx_engagements_rate ON engagements(engagement_rate DESC);
    CREATE INDEX IF NOT EXISTS idx_engagements_date ON engagements(post_date DESC);

    -- =============================================
    -- Ad Campaigns
    -- =============================================
    CREATE TABLE IF NOT EXISTS ad_campaigns (
      id TEXT PRIMARY KEY,
      fb_campaign_id TEXT,
      account_id TEXT NOT NULL,
      name TEXT NOT NULL,
      objective TEXT NOT NULL CHECK(objective IN (
        'AWARENESS', 'TRAFFIC', 'ENGAGEMENT', 'LEADS',
        'APP_PROMOTION', 'SALES', 'CONVERSIONS'
      )),
      status TEXT DEFAULT 'PAUSED' CHECK(status IN (
        'ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED', 'DRAFT'
      )),
      daily_budget REAL,
      lifetime_budget REAL,
      budget_remaining REAL,
      start_date DATETIME,
      end_date DATETIME,
      target_audience TEXT,
      bid_strategy TEXT DEFAULT 'LOWEST_COST' CHECK(bid_strategy IN (
        'LOWEST_COST', 'COST_CAP', 'BID_CAP', 'MINIMUM_ROAS'
      )),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES social_accounts(id) ON DELETE CASCADE
    );

    -- =============================================
    -- Ad Sets (targeting groups within campaigns)
    -- =============================================
    CREATE TABLE IF NOT EXISTS ad_sets (
      id TEXT PRIMARY KEY,
      fb_adset_id TEXT,
      campaign_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'PAUSED',
      daily_budget REAL,
      targeting_spec TEXT,
      placements TEXT,
      age_min INTEGER DEFAULT 18,
      age_max INTEGER DEFAULT 65,
      genders TEXT,
      locations TEXT,
      interests TEXT,
      custom_audiences TEXT,
      optimization_goal TEXT DEFAULT 'LINK_CLICKS',
      billing_event TEXT DEFAULT 'IMPRESSIONS',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES ad_campaigns(id) ON DELETE CASCADE
    );

    -- =============================================
    -- Individual Ads
    -- =============================================
    CREATE TABLE IF NOT EXISTS ads (
      id TEXT PRIMARY KEY,
      fb_ad_id TEXT,
      adset_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'PAUSED',
      creative_type TEXT CHECK(creative_type IN ('image', 'video', 'carousel')),
      headline TEXT,
      body_text TEXT,
      call_to_action TEXT DEFAULT 'LEARN_MORE',
      link_url TEXT,
      image_url TEXT,
      video_url TEXT,
      source_post_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (adset_id) REFERENCES ad_sets(id) ON DELETE CASCADE,
      FOREIGN KEY (source_post_id) REFERENCES engagements(id)
    );

    -- =============================================
    -- Ad Performance Metrics (hourly/daily snapshots)
    -- =============================================
    CREATE TABLE IF NOT EXISTS ad_performance (
      id TEXT PRIMARY KEY,
      ad_id TEXT NOT NULL,
      campaign_id TEXT NOT NULL,
      date DATE NOT NULL,
      hour INTEGER,
      impressions INTEGER DEFAULT 0,
      reach INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      ctr REAL DEFAULT 0,
      cpc REAL DEFAULT 0,
      cpm REAL DEFAULT 0,
      spend REAL DEFAULT 0,
      conversions INTEGER DEFAULT 0,
      conversion_value REAL DEFAULT 0,
      cpa REAL DEFAULT 0,
      roas REAL DEFAULT 0,
      frequency REAL DEFAULT 0,
      video_views INTEGER DEFAULT 0,
      video_views_p25 INTEGER DEFAULT 0,
      video_views_p50 INTEGER DEFAULT 0,
      video_views_p75 INTEGER DEFAULT 0,
      video_views_p100 INTEGER DEFAULT 0,
      fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE,
      FOREIGN KEY (campaign_id) REFERENCES ad_campaigns(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_adperf_ad ON ad_performance(ad_id);
    CREATE INDEX IF NOT EXISTS idx_adperf_campaign ON ad_performance(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_adperf_date ON ad_performance(date DESC);

    -- =============================================
    -- Budget History (audit trail)
    -- =============================================
    CREATE TABLE IF NOT EXISTS budget_history (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('increase', 'decrease', 'set', 'pause', 'resume')),
      old_budget REAL,
      new_budget REAL,
      reason TEXT,
      triggered_by TEXT CHECK(triggered_by IN ('manual', 'ai_auto', 'rule_based')),
      ai_confidence REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES ad_campaigns(id) ON DELETE CASCADE
    );

    -- =============================================
    -- Optimization Rules
    -- =============================================
    CREATE TABLE IF NOT EXISTS optimization_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      campaign_id TEXT,
      condition_metric TEXT NOT NULL,
      condition_operator TEXT NOT NULL CHECK(condition_operator IN ('>', '<', '>=', '<=', '==', '!=')),
      condition_value REAL NOT NULL,
      condition_timeframe TEXT DEFAULT '24h',
      action_type TEXT NOT NULL CHECK(action_type IN (
        'increase_budget', 'decrease_budget', 'pause_campaign',
        'resume_campaign', 'pause_ad', 'duplicate_ad', 'notify'
      )),
      action_value REAL,
      max_budget_limit REAL,
      min_budget_limit REAL,
      cooldown_hours INTEGER DEFAULT 24,
      last_triggered_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES ad_campaigns(id) ON DELETE SET NULL
    );

    -- =============================================
    -- AI Memory System
    -- =============================================
    CREATE TABLE IF NOT EXISTS ai_memory (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL CHECK(category IN (
        'insight', 'strategy', 'audience', 'creative',
        'budget', 'performance', 'competitor', 'trend', 'conversation'
      )),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      context TEXT,
      importance REAL DEFAULT 0.5,
      tags TEXT,
      related_campaign_id TEXT,
      embedding_vector TEXT,
      access_count INTEGER DEFAULT 0,
      last_accessed_at DATETIME,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (related_campaign_id) REFERENCES ad_campaigns(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_memory_category ON ai_memory(category);
    CREATE INDEX IF NOT EXISTS idx_memory_importance ON ai_memory(importance DESC);
    CREATE INDEX IF NOT EXISTS idx_memory_tags ON ai_memory(tags);

    -- =============================================
    -- AI Conversation History
    -- =============================================
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      message TEXT NOT NULL,
      context_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_conversations_session ON ai_conversations(session_id);

    -- =============================================
    -- AI Recommendations Log
    -- =============================================
    CREATE TABLE IF NOT EXISTS ai_recommendations (
      id TEXT PRIMARY KEY,
      campaign_id TEXT,
      type TEXT NOT NULL CHECK(type IN (
        'budget_adjustment', 'audience_change', 'creative_suggestion',
        'campaign_creation', 'campaign_pause', 'scaling', 'general'
      )),
      recommendation TEXT NOT NULL,
      reasoning TEXT,
      confidence REAL DEFAULT 0.5,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected', 'auto_applied')),
      applied_at DATETIME,
      result_summary TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES ad_campaigns(id) ON DELETE SET NULL
    );
  `);

  console.log('Ad analyzer schema initialized');
}

module.exports = { initAdSchema };
