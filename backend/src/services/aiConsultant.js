/**
 * AI Consultant Service - Personal Ad Agency Agent
 * Powered by Google Gemini with persistent memory system
 *
 * Features:
 * - Analyzes engagement data and recommends ad strategies
 * - Remembers past decisions and outcomes (memory system)
 * - Provides budget recommendations based on KPIs
 * - Generates ad copy and creative suggestions
 * - Acts as a personal agency consultant in Thai
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { v4: uuidv4 } = require('uuid');

class AIConsultant {
  constructor() {
    this.model = null;
    this.mockMode = false;
    this.db = null;
    this.chatSessions = new Map(); // sessionId -> chat
  }

  init(db) {
    this.db = db;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      console.warn('Gemini API key not configured. AI Consultant using mock mode.');
      this.mockMode = true;
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.4,
        topP: 0.9,
        maxOutputTokens: 4096,
      },
    });
    console.log('AI Consultant initialized with Gemini');
  }

  // ─── Memory System ────────────────────────────────────────

  saveMemory({ category, title, content, context = null, importance = 0.5, tags = [], relatedCampaignId = null }) {
    if (!this.db) return null;

    const id = uuidv4();
    this.db.prepare(`
      INSERT INTO ai_memory (id, category, title, content, context, importance, tags, related_campaign_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, category, title, content, context, importance, JSON.stringify(tags), relatedCampaignId);

    return id;
  }

  getMemories({ category = null, limit = 20, minImportance = 0, search = null } = {}) {
    if (!this.db) return [];

    let query = 'SELECT * FROM ai_memory WHERE importance >= ?';
    const params = [minImportance];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    if (search) {
      query += ' AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY importance DESC, updated_at DESC LIMIT ?';
    params.push(limit);

    const memories = this.db.prepare(query).all(...params);

    // Update access count
    for (const mem of memories) {
      this.db.prepare('UPDATE ai_memory SET access_count = access_count + 1, last_accessed_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(mem.id);
    }

    return memories;
  }

  deleteMemory(id) {
    if (!this.db) return;
    this.db.prepare('DELETE FROM ai_memory WHERE id = ?').run(id);
  }

  // ─── Conversation History ─────────────────────────────────

  _saveConversation(sessionId, role, message, contextData = null) {
    if (!this.db) return;
    this.db.prepare(`
      INSERT INTO ai_conversations (id, session_id, role, message, context_data)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), sessionId, role, message, contextData ? JSON.stringify(contextData) : null);
  }

  _getConversationHistory(sessionId, limit = 20) {
    if (!this.db) return [];
    return this.db.prepare(
      'SELECT * FROM ai_conversations WHERE session_id = ? ORDER BY created_at DESC LIMIT ?'
    ).all(sessionId, limit).reverse();
  }

  // ─── Recommendations Log ──────────────────────────────────

  saveRecommendation({ campaignId = null, type, recommendation, reasoning, confidence = 0.5 }) {
    if (!this.db) return null;
    const id = uuidv4();
    this.db.prepare(`
      INSERT INTO ai_recommendations (id, campaign_id, type, recommendation, reasoning, confidence)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, campaignId, type, recommendation, reasoning, confidence);
    return id;
  }

  getRecommendations({ campaignId = null, status = null, limit = 20 } = {}) {
    if (!this.db) return [];
    let query = 'SELECT * FROM ai_recommendations WHERE 1=1';
    const params = [];
    if (campaignId) { query += ' AND campaign_id = ?'; params.push(campaignId); }
    if (status) { query += ' AND status = ?'; params.push(status); }
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    return this.db.prepare(query).all(...params);
  }

  updateRecommendationStatus(id, status, resultSummary = null) {
    if (!this.db) return;
    this.db.prepare(`
      UPDATE ai_recommendations SET status = ?, applied_at = CURRENT_TIMESTAMP, result_summary = ?
      WHERE id = ?
    `).run(status, resultSummary, id);
  }

  // ─── Core AI Analysis Functions ───────────────────────────

  async _buildContext() {
    const memories = this.getMemories({ limit: 10, minImportance: 0.3 });
    const recentRecs = this.getRecommendations({ limit: 5 });

    let context = '';
    if (memories.length > 0) {
      context += '\n=== ความทรงจำที่สำคัญ ===\n';
      for (const m of memories) {
        context += `[${m.category}] ${m.title}: ${m.content}\n`;
      }
    }
    if (recentRecs.length > 0) {
      context += '\n=== คำแนะนำล่าสุด ===\n';
      for (const r of recentRecs) {
        context += `[${r.type}/${r.status}] ${r.recommendation}\n`;
      }
    }
    return context;
  }

  _getSystemPrompt() {
    return `คุณคือ "AdGenie" - ที่ปรึกษาด้านการตลาดดิจิทัลส่วนตัว (Personal Ad Agency AI)
คุณเป็นเอเจนซี่โฆษณาที่ฉลาดและมีประสบการณ์ ทำหน้าที่:

1. **วิเคราะห์ Engagement** - วิเคราะห์ข้อมูล Facebook/TikTok เพื่อหาโพสต์ที่มีศักยภาพสำหรับทำโฆษณา
2. **แนะนำกลยุทธ์โฆษณา** - แนะนำ targeting, budget, creative strategy
3. **จัดการงบประมาณ** - แนะนำเพิ่ม/ลดงบตาม KPI (ROAS, CPA, CTR, Frequency)
4. **สร้าง Ad Copy** - เขียนข้อความโฆษณาที่ดึงดูด

=== KPI Benchmarks ที่ใช้ตัดสินใจ ===
- ROAS > 3x = ดี, ควรเพิ่มงบ | ROAS < 2x = แย่, ลดงบหรือหยุด
- CPA ต้องไม่เกิน 30-40% ของ Customer Lifetime Value
- CTR Facebook > 2% = ดี | CTR TikTok > 3% = ดี | ต่ำกว่า 0.5% = ต้องเปลี่ยน creative
- Frequency > 3.0 = เริ่มเบื่อแอด | > 5.0 = ต้องเปลี่ยน audience
- ห้ามเพิ่มงบเกิน 20%/วัน บน Meta (จะหลุด learning phase)
- ต้องมี 20-30 conversions ขึ้นไปก่อนตัดสินใจ optimize
- ใช้ข้อมูล 3-7 วันในการตัดสินใจ (ไม่ดูแค่วันเดียว)

=== กฎการตอบ ===
- ตอบเป็นภาษาไทยเสมอ
- ให้คำแนะนำที่ actionable ทำได้จริง
- เมื่อแนะนำเพิ่ม/ลดงบ ให้ระบุตัวเลขชัดเจน
- ให้เหตุผลประกอบทุกคำแนะนำ
- ตอบในรูปแบบ JSON เมื่อถูกขอ
- จดจำบริบทจากความทรงจำที่ได้รับมา`;
  }

  async chat(sessionId, userMessage, contextData = null) {
    if (this.mockMode) return this._mockChat(sessionId, userMessage);

    // Save user message
    this._saveConversation(sessionId, 'user', userMessage, contextData);

    // Build context from memory
    const memoryContext = await this._buildContext();

    // Get or create chat session
    if (!this.chatSessions.has(sessionId)) {
      const history = this._getConversationHistory(sessionId, 10);
      const chatHistory = history
        .filter(h => h.role !== 'system')
        .map(h => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.message }],
        }));

      const chat = this.model.startChat({
        history: chatHistory,
        systemInstruction: this._getSystemPrompt() + memoryContext,
      });
      this.chatSessions.set(sessionId, chat);
    }

    const chat = this.chatSessions.get(sessionId);

    try {
      const prompt = contextData
        ? `${userMessage}\n\n=== ข้อมูลประกอบ ===\n${JSON.stringify(contextData, null, 2)}`
        : userMessage;

      const result = await chat.sendMessage(prompt);
      const response = result.response.text();

      // Save assistant response
      this._saveConversation(sessionId, 'assistant', response);

      // Auto-extract insights to memory
      await this._autoExtractInsights(response, sessionId);

      return { role: 'assistant', message: response, sessionId };
    } catch (error) {
      return { role: 'assistant', message: `เกิดข้อผิดพลาด: ${error.message}`, sessionId, error: true };
    }
  }

  async analyzeEngagementForAds(engagements) {
    if (this.mockMode) return this._mockEngagementAnalysis(engagements);

    const memoryContext = await this._buildContext();

    const prompt = `${this._getSystemPrompt()}
${memoryContext}

=== วิเคราะห์ Engagement Data เพื่อเลือกโพสต์ทำโฆษณา ===

ข้อมูล Engagement:
${JSON.stringify(engagements, null, 2)}

กรุณาวิเคราะห์และตอบเป็น JSON:
{
  "analysis_summary": "สรุปภาพรวม",
  "top_posts_for_ads": [
    {
      "post_id": "",
      "score": 0-100,
      "reason": "เหตุผลที่เหมาะทำแอด",
      "suggested_objective": "AWARENESS|TRAFFIC|ENGAGEMENT|LEADS|SALES",
      "suggested_audience": "กลุ่มเป้าหมายที่แนะนำ",
      "suggested_budget": { "daily": 0, "duration_days": 0 },
      "ad_copy_suggestion": "ข้อความโฆษณาที่แนะนำ"
    }
  ],
  "content_insights": {
    "best_content_type": "",
    "best_posting_time": "",
    "audience_behavior": ""
  },
  "overall_strategy": "กลยุทธ์ภาพรวมที่แนะนำ",
  "confidence": 0.0-1.0
}`;

    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      const parsed = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, '').trim());

      // Save as memory
      this.saveMemory({
        category: 'insight',
        title: `การวิเคราะห์ Engagement ${new Date().toLocaleDateString('th-TH')}`,
        content: parsed.analysis_summary,
        importance: 0.7,
        tags: ['engagement', 'analysis'],
      });

      // Save recommendations
      for (const post of (parsed.top_posts_for_ads || [])) {
        this.saveRecommendation({
          type: 'creative_suggestion',
          recommendation: `โพสต์ ${post.post_id} ควรทำแอด: ${post.reason}`,
          reasoning: post.ad_copy_suggestion,
          confidence: parsed.confidence || 0.7,
        });
      }

      return parsed;
    } catch (error) {
      throw new Error(`AI analysis failed: ${error.message}`);
    }
  }

  async analyzeCampaignPerformance(campaignData) {
    if (this.mockMode) return this._mockCampaignAnalysis(campaignData);

    const memoryContext = await this._buildContext();

    const prompt = `${this._getSystemPrompt()}
${memoryContext}

=== วิเคราะห์ผลลัพธ์แคมเปญโฆษณา ===

ข้อมูลแคมเปญ:
${JSON.stringify(campaignData, null, 2)}

กรุณาวิเคราะห์และตอบเป็น JSON:
{
  "performance_summary": "สรุปผลลัพธ์",
  "health_score": 0-100,
  "kpi_analysis": {
    "roas": { "value": 0, "status": "good|warning|bad", "comment": "" },
    "cpa": { "value": 0, "status": "good|warning|bad", "comment": "" },
    "ctr": { "value": 0, "status": "good|warning|bad", "comment": "" },
    "frequency": { "value": 0, "status": "good|warning|bad", "comment": "" }
  },
  "budget_recommendations": [
    {
      "campaign_id": "",
      "action": "INCREASE|DECREASE|HOLD|PAUSE",
      "current_budget": 0,
      "suggested_budget": 0,
      "reason": ""
    }
  ],
  "action_items": [
    { "priority": "high|medium|low", "action": "", "reason": "" }
  ],
  "creative_feedback": "ข้อเสนอแนะด้าน creative",
  "confidence": 0.0-1.0
}`;

    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      const parsed = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, '').trim());

      // Save insights
      this.saveMemory({
        category: 'performance',
        title: `วิเคราะห์แคมเปญ ${new Date().toLocaleDateString('th-TH')}`,
        content: parsed.performance_summary,
        importance: 0.8,
        tags: ['campaign', 'performance'],
      });

      // Save budget recommendations
      for (const rec of (parsed.budget_recommendations || [])) {
        this.saveRecommendation({
          campaignId: rec.campaign_id,
          type: 'budget_adjustment',
          recommendation: `${rec.action}: ${rec.current_budget} → ${rec.suggested_budget}`,
          reasoning: rec.reason,
          confidence: parsed.confidence || 0.7,
        });
      }

      return parsed;
    } catch (error) {
      throw new Error(`Campaign analysis failed: ${error.message}`);
    }
  }

  async generateAdCopy({ product, targetAudience, tone = 'engaging', platform = 'facebook', objective = 'TRAFFIC' }) {
    if (this.mockMode) return this._mockAdCopy(product, platform);

    const prompt = `สร้างข้อความโฆษณาสำหรับ:
- สินค้า/บริการ: ${product}
- กลุ่มเป้าหมาย: ${targetAudience}
- โทน: ${tone}
- แพลตฟอร์ม: ${platform}
- วัตถุประสงค์: ${objective}

ตอบเป็น JSON:
{
  "variants": [
    {
      "headline": "หัวข้อ (ไม่เกิน 40 ตัวอักษร)",
      "body": "เนื้อหาโฆษณา",
      "cta": "LEARN_MORE|SHOP_NOW|SIGN_UP|CONTACT_US|BOOK_NOW",
      "hooks": ["จุดดึงดูด 1", "จุดดึงดูด 2"],
      "target_emotion": "ความรู้สึกที่ต้องการกระตุ้น"
    }
  ],
  "tips": "คำแนะนำเพิ่มเติม"
}`;

    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      return JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    } catch (error) {
      throw new Error(`Ad copy generation failed: ${error.message}`);
    }
  }

  async _autoExtractInsights(responseText, sessionId) {
    // Simple keyword-based insight extraction
    const insightKeywords = ['แนะนำ', 'ควร', 'เพิ่มงบ', 'ลดงบ', 'หยุด', 'กลยุทธ์', 'เป้าหมาย'];
    const hasInsight = insightKeywords.some(kw => responseText.includes(kw));

    if (hasInsight && responseText.length > 100) {
      this.saveMemory({
        category: 'conversation',
        title: `บทสนทนา ${new Date().toLocaleTimeString('th-TH')}`,
        content: responseText.substring(0, 500),
        importance: 0.3,
        tags: ['auto-extracted', sessionId],
      });
    }
  }

  // ─── Mock Responses ───────────────────────────────────────

  _mockChat(sessionId, message) {
    const responses = {
      default: `สวัสดีค่ะ! ฉันคือ AdGenie ที่ปรึกษาโฆษณาส่วนตัวของคุณ 🎯

จากข้อมูลที่มี ฉันมีคำแนะนำดังนี้:

1. **โพสต์ที่ทำผลได้ดี** ควรนำมาบูสต์เป็นโฆษณา
2. **งบประมาณ** แนะนำเริ่มที่ 300-500 บาท/วัน
3. **กลุ่มเป้าหมาย** ควรเริ่มจาก Lookalike Audience ของลูกค้าเดิม

ต้องการให้วิเคราะห์อะไรเพิ่มเติมไหมคะ?`,
    };

    if (this.db) {
      this._saveConversation(sessionId, 'user', message);
      this._saveConversation(sessionId, 'assistant', responses.default);
    }

    return { role: 'assistant', message: responses.default, sessionId, mock: true };
  }

  _mockEngagementAnalysis(engagements) {
    return {
      analysis_summary: 'โพสต์วิดีโอมี engagement สูงที่สุด โดยเฉพาะคอนเทนต์ที่เป็นสูตรอาหาร มี share rate สูงกว่าค่าเฉลี่ย 3 เท่า',
      top_posts_for_ads: [
        {
          post_id: 'mock_post_2',
          score: 92,
          reason: 'Engagement rate สูง 7.1%, share rate ดีเยี่ยม เหมาะทำ video ad',
          suggested_objective: 'ENGAGEMENT',
          suggested_audience: 'คนรักอาหาร อายุ 25-45 ในกรุงเทพและปริมณฑล',
          suggested_budget: { daily: 500, duration_days: 7 },
          ad_copy_suggestion: 'ผัดไทยสูตรเด็ด ดูจบทำเองได้! 🍜 กดสั่งเลย ส่งถึงบ้าน',
        },
        {
          post_id: 'mock_post_1',
          score: 78,
          reason: 'โปรโมชั่นมียอด like สูง เหมาะทำ conversion ad',
          suggested_objective: 'SALES',
          suggested_audience: 'คนที่เคย engage กับเพจ + Lookalike',
          suggested_budget: { daily: 300, duration_days: 5 },
          ad_copy_suggestion: 'ลด 50% ทุกเมนู! วันนี้เท่านั้น 🔥 สั่งเลย!',
        },
      ],
      content_insights: {
        best_content_type: 'วิดีโอสอนทำอาหาร',
        best_posting_time: '11:00-13:00 และ 18:00-20:00',
        audience_behavior: 'ชอบ share คอนเทนต์สูตรอาหาร, comment ถามสูตรเพิ่ม',
      },
      overall_strategy: 'เน้นสร้าง video content สูตรอาหาร แล้วบูสต์โพสต์ที่ได้ engagement สูง ใช้ Lookalike Audience จากคนที่เคย engage',
      confidence: 0.82,
    };
  }

  _mockCampaignAnalysis(campaignData) {
    return {
      performance_summary: 'แคมเปญมีผลลัพธ์ปานกลาง ROAS อยู่ที่ 2.8x ควรปรับ targeting เพื่อเพิ่มประสิทธิภาพ',
      health_score: 68,
      kpi_analysis: {
        roas: { value: 2.8, status: 'warning', comment: 'ใกล้เป้า 3x แต่ยังไม่ถึง ควรปรับ audience' },
        cpa: { value: 45, status: 'good', comment: 'CPA ต่ำกว่าเป้าหมายที่ 60 บาท' },
        ctr: { value: 2.1, status: 'good', comment: 'CTR ดีกว่าค่าเฉลี่ย' },
        frequency: { value: 2.3, status: 'good', comment: 'ยังไม่ถึงจุดที่ผู้ชมเบื่อ' },
      },
      budget_recommendations: [
        {
          campaign_id: 'mock_campaign_1',
          action: 'INCREASE',
          current_budget: 500,
          suggested_budget: 600,
          reason: 'CTR ดี CPA ต่ำ ควรเพิ่มงบ 20% เพื่อขยาย reach',
        },
      ],
      action_items: [
        { priority: 'high', action: 'ทดสอบ Lookalike Audience ใหม่', reason: 'ROAS ยังไม่ถึง 3x อาจเพราะ audience ยังไม่ตรง' },
        { priority: 'medium', action: 'เพิ่ม creative variant ใหม่ 2-3 ชิ้น', reason: 'ป้องกัน ad fatigue ก่อนถึง frequency 3.0' },
        { priority: 'low', action: 'ทดสอบ bid strategy เป็น Cost Cap', reason: 'อาจช่วยควบคุม CPA ให้ดีขึ้นอีก' },
      ],
      creative_feedback: 'Creative ปัจจุบันใช้ได้ดี CTR สูง แต่ควรเตรียม creative ใหม่ไว้สลับเมื่อ frequency เพิ่มขึ้น',
      confidence: 0.75,
    };
  }

  _mockAdCopy(product, platform) {
    return {
      variants: [
        {
          headline: `${product} สุดพิเศษ!`,
          body: `ค้นพบ ${product} ที่คุณจะหลงรัก ✨ คุณภาพเกินราคา สั่งวันนี้จัดส่งฟรี!`,
          cta: 'SHOP_NOW',
          hooks: ['ราคาพิเศษวันนี้เท่านั้น', 'จัดส่งฟรีทั่วประเทศ'],
          target_emotion: 'ความตื่นเต้นและความคุ้มค่า',
        },
        {
          headline: `ลอง ${product} แล้วจะติดใจ`,
          body: `ลูกค้ากว่า 10,000 คนเลือกเรา 💯 ${product} ที่ได้รับการรีวิวดีเยี่ยม กดสั่งเลย!`,
          cta: 'LEARN_MORE',
          hooks: ['Social proof: ลูกค้า 10,000+ คน', 'รีวิว 5 ดาว'],
          target_emotion: 'ความมั่นใจและความไว้วางใจ',
        },
      ],
      tips: 'แนะนำใช้รูปภาพ/วิดีโอที่แสดงสินค้าจริง ควรทดสอบ A/B test ทั้ง 2 variants',
    };
  }
}

module.exports = new AIConsultant();
