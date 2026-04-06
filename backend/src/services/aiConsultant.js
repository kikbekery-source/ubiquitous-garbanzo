/**
 * AI Consultant Service - Personal Ad Agency powered by Gemini
 * Features: Analysis, Recommendations, Memory System, Conversation
 * 
 * Acts as an intelligent consultant that:
 * - Analyzes engagement data from Facebook & TikTok
 * - Recommends which posts to boost as ads
 * - Suggests budget allocation and optimization
 * - Maintains memory of past decisions and their outcomes
 * - Provides Thai-language consulting
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { v4: uuidv4 } = require('uuid');

class AIConsultant {
  constructor() {
    this.model = null;
    this.mockMode = false;
    this.db = null;
    this.systemPrompt = null;
  }

  init(db) {
    this.db = db;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      console.warn('Gemini API key not configured for AI Consultant. Using mock mode.');
      this.mockMode = true;
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 4096,
      },
    });

    this.systemPrompt = `คุณคือ "AdGenius" - ที่ปรึกษาด้านการตลาดดิจิทัลและการยิงแอดโฆษณาส่วนตัว
คุณเป็นเอเจนซี่ AI ที่ฉลาดและมีประสบการณ์ มีความเชี่ยวชาญใน:

1. การวิเคราะห์ Engagement บน Facebook และ TikTok
2. การสร้างและจัดการแคมเปญโฆษณา Facebook Ads
3. การปรับงบประมาณโฆษณาอัตโนมัติ
4. การวิเคราะห์ KPIs: CTR, CPC, CPM, CPA, ROAS, Frequency
5. การแนะนำ Target Audience
6. การเลือก Content ที่เหมาะจะทำเป็นโฆษณา

กฎสำคัญ:
- ตอบเป็นภาษาไทยเสมอ
- ให้คำแนะนำที่เป็นรูปธรรม มีตัวเลขชัดเจน
- อ้างอิงข้อมูลจริงจาก metrics ที่ได้รับ
- คิดเหมือนเอเจนซี่มืออาชีพ ไม่ใช่แค่ chatbot
- เมื่อแนะนำการปรับงบ ต้องอธิบายเหตุผลชัดเจน
- ตอบในรูปแบบ JSON เมื่อถูกขอ

KPI Benchmarks (Thailand Market):
- CTR ที่ดี: > 2% (Facebook), > 1% (TikTok)
- CPC ที่ดี: < ฿5 (Facebook), < ฿3 (TikTok)
- CPM ที่ดี: < ฿150 (Facebook), < ฿100 (TikTok)
- Engagement Rate ที่ดี: > 3% (Facebook), > 5% (TikTok)
- ROAS ที่ดี: > 3x
- Frequency ที่เหมาะสม: 1.5-3.0 ครั้ง`;

    console.log('AI Consultant (AdGenius) initialized');
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

  getMemories({ category = null, minImportance = 0, limit = 20, search = null }) {
    if (!this.db) return [];

    let query = 'SELECT * FROM ai_memory WHERE importance >= ?';
    const params = [minImportance];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    if (search) {
      query += ' AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY importance DESC, created_at DESC LIMIT ?';
    params.push(limit);

    const memories = this.db.prepare(query).all(...params);

    // Update access count
    for (const mem of memories) {
      this.db.prepare('UPDATE ai_memory SET access_count = access_count + 1, last_accessed_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(mem.id);
    }

    return memories;
  }

  // ─── Conversation Management ──────────────────────────────

  saveConversation(sessionId, role, message, contextData = null) {
    if (!this.db) return;
    const id = uuidv4();
    this.db.prepare(`
      INSERT INTO ai_conversations (id, session_id, role, message, context_data)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, sessionId, role, message, contextData ? JSON.stringify(contextData) : null);
  }

  getConversationHistory(sessionId, limit = 20) {
    if (!this.db) return [];
    return this.db.prepare(
      'SELECT * FROM ai_conversations WHERE session_id = ? ORDER BY created_at ASC LIMIT ?'
    ).all(sessionId, limit);
  }

  // ─── Core AI Analysis ─────────────────────────────────────

  async analyzeEngagement(engagementData, platform) {
    const prompt = `วิเคราะห์ข้อมูล Engagement จาก ${platform} ต่อไปนี้:

${JSON.stringify(engagementData, null, 2)}

กรุณาวิเคราะห์และตอบเป็น JSON:
{
  "summary": "สรุปภาพรวมสั้นๆ",
  "topPerformers": [
    {
      "postId": "id",
      "reason": "เหตุผลที่โพสต์นี้ทำผลได้ดี",
      "adPotential": "high/medium/low",
      "suggestedAdType": "ประเภทโฆษณาที่แนะนำ"
    }
  ],
  "insights": [
    "insight 1",
    "insight 2"
  ],
  "contentStrategy": {
    "whatWorks": "สิ่งที่ทำแล้วได้ผล",
    "improve": "สิ่งที่ควรปรับปรุง",
    "nextSteps": ["ขั้นตอนถัดไป"]
  },
  "audienceInsights": "ข้อมูลเชิงลึกเกี่ยวกับกลุ่มเป้าหมาย"
}`;

    return this._askGemini(prompt, 'engagement_analysis');
  }

  async recommendAdCreation(topPosts, budget, objective) {
    const memories = this.getMemories({ category: 'strategy', minImportance: 0.6, limit: 5 });
    const pastInsights = memories.map(m => m.content).join('\n');

    const prompt = `คุณเป็นที่ปรึกษาโฆษณา ช่วยแนะนำการสร้างแอดจากโพสต์ที่ทำผลได้ดี:

โพสต์ที่แนะนำ:
${JSON.stringify(topPosts, null, 2)}

งบประมาณ: ฿${budget}/วัน
วัตถุประสงค์: ${objective}

${pastInsights ? `ข้อมูลจากประสบการณ์ที่ผ่านมา:\n${pastInsights}` : ''}

ตอบเป็น JSON:
{
  "campaigns": [
    {
      "name": "ชื่อแคมเปญ",
      "sourcePostId": "id ของโพสต์ต้นทาง",
      "objective": "TRAFFIC/ENGAGEMENT/CONVERSIONS",
      "dailyBudget": 0,
      "targeting": {
        "ageMin": 18,
        "ageMax": 45,
        "genders": ["all"],
        "locations": { "countries": ["TH"] },
        "interests": ["interest1", "interest2"]
      },
      "adCopy": {
        "headline": "หัวข้อโฆษณา",
        "body": "เนื้อหาโฆษณา",
        "callToAction": "LEARN_MORE/SHOP_NOW/SIGN_UP"
      },
      "estimatedResults": {
        "dailyReach": "จำนวนที่คาดว่าจะเข้าถึง",
        "estimatedCTR": "CTR ที่คาดหวัง",
        "estimatedCPC": "CPC ที่คาดหวัง"
      },
      "reasoning": "เหตุผลที่แนะนำแคมเปญนี้"
    }
  ],
  "budgetAllocation": {
    "strategy": "กลยุทธ์การจัดสรรงบ",
    "breakdown": [{"campaign": "ชื่อ", "percentage": 0, "amount": 0}]
  },
  "timeline": "แผนระยะเวลา",
  "expectedROAS": "ROAS ที่คาดหวัง"
}`;

    const result = await this._askGemini(prompt, 'ad_recommendation');

    // Save insight to memory
    if (result && !this.mockMode) {
      this.saveMemory({
        category: 'strategy',
        title: `Ad recommendation - Budget ฿${budget}/day`,
        content: JSON.stringify(result),
        importance: 0.7,
        tags: ['ad_creation', objective],
      });
    }

    return result;
  }

  async analyzeCampaignPerformance(performanceData) {
    const memories = this.getMemories({ category: 'performance', limit: 5 });
    const historicalContext = memories.map(m => `${m.title}: ${m.content}`).join('\n');

    const prompt = `วิเคราะห์ผลลัพธ์แคมเปญโฆษณา:

ข้อมูลผลลัพธ์:
${JSON.stringify(performanceData, null, 2)}

${historicalContext ? `ข้อมูลเปรียบเทียบจากอดีต:\n${historicalContext}` : ''}

KPI Benchmarks:
- CTR ที่ดี > 2%, แย่ < 0.5%
- CPC ที่ดี < ฿5, แย่ > ฿15
- Frequency เหมาะสม 1.5-3.0, สูงเกิน > 4.0
- ROAS ที่ดี > 3x

ตอบเป็น JSON:
{
  "overallScore": 0-100,
  "status": "excellent/good/average/poor/critical",
  "summary": "สรุปผลลัพธ์",
  "kpiAnalysis": {
    "ctr": {"value": 0, "status": "good/bad", "comment": ""},
    "cpc": {"value": 0, "status": "good/bad", "comment": ""},
    "cpm": {"value": 0, "status": "good/bad", "comment": ""},
    "frequency": {"value": 0, "status": "good/bad", "comment": ""},
    "roas": {"value": 0, "status": "good/bad", "comment": ""}
  },
  "budgetRecommendation": {
    "action": "increase/decrease/maintain/pause",
    "percentage": 0,
    "newBudget": 0,
    "reason": "เหตุผล"
  },
  "optimizationTips": ["tip1", "tip2"],
  "urgentActions": ["สิ่งที่ต้องทำทันที"],
  "confidence": 0.0-1.0
}`;

    const result = await this._askGemini(prompt, 'campaign_analysis');

    // Store performance insight
    if (result && !this.mockMode) {
      this.saveMemory({
        category: 'performance',
        title: `Campaign analysis - Score: ${result.overallScore}/100`,
        content: JSON.stringify(result),
        importance: result.overallScore < 40 ? 0.9 : 0.5,
        tags: ['campaign_performance', result.status],
      });
    }

    return result;
  }

  async suggestBudgetAdjustment(campaigns) {
    const prompt = `จากข้อมูลแคมเปญทั้งหมด ช่วยแนะนำการปรับงบประมาณ:

${JSON.stringify(campaigns, null, 2)}

หลักการ:
- แคมเปญที่ CTR สูง + CPC ต่ำ → เพิ่มงบ (max 30%/วัน)
- แคมเปญที่ Frequency > 4 → ลดงบหรือเปลี่ยน audience
- แคมเปญที่ CPA สูงกว่า target → ลดงบ 20-50%
- แคมเปญที่ ROAS < 1 หลังจาก 3 วัน → หยุดทันที
- งบรวมต้องไม่เกินงบที่กำหนด

ตอบเป็น JSON:
{
  "adjustments": [
    {
      "campaignId": "id",
      "campaignName": "ชื่อ",
      "currentBudget": 0,
      "recommendedBudget": 0,
      "action": "increase/decrease/pause/maintain",
      "changePercent": 0,
      "reason": "เหตุผล",
      "priority": "high/medium/low",
      "confidence": 0.0-1.0
    }
  ],
  "totalCurrentSpend": 0,
  "totalRecommendedSpend": 0,
  "overallStrategy": "กลยุทธ์ภาพรวม"
}`;

    return this._askGemini(prompt, 'budget_recommendation');
  }

  // ─── Chat / Consultant Mode ───────────────────────────────

  async chat(sessionId, userMessage) {
    // Load conversation history
    const history = this.getConversationHistory(sessionId, 10);
    
    // Load relevant memories
    const memories = this.getMemories({ search: userMessage, limit: 5 });
    const memoryContext = memories.length > 0
      ? `\n\nข้อมูลจากหน่วยความจำ:\n${memories.map(m => `- [${m.category}] ${m.title}: ${m.content}`).join('\n')}`
      : '';

    // Save user message
    this.saveConversation(sessionId, 'user', userMessage);

    const conversationContext = history.map(h => `${h.role}: ${h.message}`).join('\n');

    const prompt = `${this.systemPrompt || 'คุณเป็นที่ปรึกษาด้านการตลาดดิจิทัล'}
${memoryContext}

ประวัติการสนทนา:
${conversationContext}

user: ${userMessage}

ตอบเป็นภาษาไทย อย่างเป็นมืออาชีพ:`;

    const response = await this._askGemini(prompt, 'chat', false);
    
    // Save assistant response
    const responseText = typeof response === 'string' ? response : JSON.stringify(response);
    this.saveConversation(sessionId, 'assistant', responseText);

    // Auto-save important insights from conversation
    if (userMessage.includes('กลยุทธ์') || userMessage.includes('strategy') || 
        userMessage.includes('แผน') || userMessage.includes('เป้าหมาย')) {
      this.saveMemory({
        category: 'conversation',
        title: `Conversation insight - ${new Date().toLocaleDateString('th-TH')}`,
        content: `Q: ${userMessage}\nA: ${responseText.substring(0, 500)}`,
        importance: 0.4,
        tags: ['conversation'],
      });
    }

    return { response: responseText, memories: memories.length };
  }

  // ─── Recommendation Logging ───────────────────────────────

  saveRecommendation({ campaignId, type, recommendation, reasoning, confidence = 0.5 }) {
    if (!this.db) return null;

    const id = uuidv4();
    this.db.prepare(`
      INSERT INTO ai_recommendations (id, campaign_id, type, recommendation, reasoning, confidence)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, campaignId, type, recommendation, reasoning, confidence);

    return id;
  }

  getRecommendations({ campaignId = null, status = null, limit = 20 }) {
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

    const updates = ['status = ?'];
    const params = [status];

    if (status === 'accepted' || status === 'auto_applied') {
      updates.push('applied_at = CURRENT_TIMESTAMP');
    }
    if (resultSummary) {
      updates.push('result_summary = ?');
      params.push(resultSummary);
    }

    params.push(id);
    this.db.prepare(`UPDATE ai_recommendations SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  // ─── Internal Gemini Communication ────────────────────────

  async _askGemini(prompt, context = 'general', parseJson = true) {
    if (this.mockMode) return this._mockResponse(context);

    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();

      if (!parseJson) return text;

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return text;
    } catch (error) {
      console.error(`AI Consultant error (${context}):`, error.message);
      return this._mockResponse(context);
    }
  }

  _mockResponse(context) {
    const mocks = {
      engagement_analysis: {
        summary: 'ภาพรวม Engagement อยู่ในเกณฑ์ดี โพสต์ประเภทวิดีโอทำผลได้ดีที่สุด',
        topPerformers: [
          { postId: 'mock_post_2', reason: 'วิดีโอสอนทำอาหารได้ engagement สูงสุด', adPotential: 'high', suggestedAdType: 'Video Ad - Traffic' },
          { postId: 'mock_post_1', reason: 'โปรโมชั่นได้ clicks สูง', adPotential: 'high', suggestedAdType: 'Image Ad - Conversions' },
        ],
        insights: [
          'วิดีโอมี engagement rate สูงกว่าโพสต์ภาพ 3.2 เท่า',
          'โพสต์ช่วง 18:00-21:00 ได้ reach สูงสุด',
          'Content ประเภทสอนทำอาหารมี share rate สูงที่สุด',
          'กลุ่มเป้าหมายหลักเป็นผู้หญิง อายุ 25-34 ปี',
        ],
        contentStrategy: {
          whatWorks: 'วิดีโอสอนทำอาหาร + โปรโมชั่น ทำผลได้ดีที่สุด',
          improve: 'ควรเพิ่ม CTA ในโพสต์ และใช้ hashtag ที่ตรงกลุ่มมากขึ้น',
          nextSteps: ['สร้างวิดีโอสอนทำอาหารเพิ่ม', 'ทำ A/B Test โปรโมชั่น', 'เพิ่ม UGC content จากลูกค้า'],
        },
        audienceInsights: 'กลุ่มเป้าหมายหลักสนใจอาหารไทย ทำอาหาร และร้านอาหาร อายุ 25-45 ปี ส่วนใหญ่อยู่ในกรุงเทพฯ',
      },
      ad_recommendation: {
        campaigns: [
          {
            name: 'แคมเปญ - วิดีโอสอนทำผัดไทย',
            sourcePostId: 'mock_post_2',
            objective: 'TRAFFIC',
            dailyBudget: 500,
            targeting: {
              ageMin: 25, ageMax: 45, genders: ['all'],
              locations: { countries: ['TH'] },
              interests: ['อาหารไทย', 'ทำอาหาร', 'ร้านอาหาร'],
            },
            adCopy: {
              headline: 'ผัดไทยสูตรเด็ด ทำเองได้ง่ายมาก!',
              body: 'ดูวิธีทำผัดไทยสูตรลับจากเชฟมืออาชีพ อร่อยเหมือนร้านดัง ทำเองที่บ้านได้เลย',
              callToAction: 'LEARN_MORE',
            },
            estimatedResults: { dailyReach: '5,000-15,000', estimatedCTR: '3-5%', estimatedCPC: '฿2-4' },
            reasoning: 'โพสต์ต้นทางมี engagement rate สูง 7.2% และยอด share สูง แสดงว่า content มีคุณภาพ',
          },
        ],
        budgetAllocation: {
          strategy: 'เริ่มด้วยงบ 70% ที่แคมเปญหลัก แล้วกระจาย 30% สำหรับทดสอบ',
          breakdown: [{ campaign: 'วิดีโอสอนทำผัดไทย', percentage: 70, amount: 350 }],
        },
        timeline: 'ทดสอบ 3-5 วันแรก แล้ว optimize ตาม performance',
        expectedROAS: '2.5-4x',
      },
      campaign_analysis: {
        overallScore: 72,
        status: 'good',
        summary: 'แคมเปญทำผลได้ดีในภาพรวม CTR สูงกว่าค่าเฉลี่ย แต่ CPC ยังสูงอยู่เล็กน้อย',
        kpiAnalysis: {
          ctr: { value: 4.09, status: 'good', comment: 'สูงกว่า benchmark (2%) มาก' },
          cpc: { value: 2.45, status: 'good', comment: 'อยู่ในเกณฑ์ดี ต่ำกว่า ฿5' },
          cpm: { value: 100.22, status: 'good', comment: 'ต่ำกว่า benchmark ฿150' },
          frequency: { value: 1.41, status: 'good', comment: 'เหมาะสม ยังไม่เกิน threshold' },
          roas: { value: 3.2, status: 'good', comment: 'สูงกว่า 3x ถือว่าดี' },
        },
        budgetRecommendation: {
          action: 'increase',
          percentage: 20,
          newBudget: 600,
          reason: 'CTR สูง + CPC ต่ำ + ROAS ดี = ควรเพิ่มงบเพื่อ scale',
        },
        optimizationTips: [
          'ลอง Lookalike Audience จากคนที่ engage แล้ว',
          'เพิ่ม placement บน Instagram Stories',
          'ทดสอบ ad copy ใหม่ 2-3 แบบ',
        ],
        urgentActions: [],
        confidence: 0.85,
      },
      budget_recommendation: {
        adjustments: [
          {
            campaignId: 'mock_campaign_1',
            campaignName: 'แคมเปญวิดีโอสอนทำอาหาร',
            currentBudget: 500,
            recommendedBudget: 650,
            action: 'increase',
            changePercent: 30,
            reason: 'CTR 4.09% สูงมาก, CPC ต่ำ, ROAS > 3x - ควร scale up',
            priority: 'high',
            confidence: 0.88,
          },
        ],
        totalCurrentSpend: 500,
        totalRecommendedSpend: 650,
        overallStrategy: 'เพิ่มงบแคมเปญที่ทำผลดี ลดงบแคมเปญที่ไม่คุ้ม',
      },
      chat: 'สวัสดีครับ! ผม AdGenius ที่ปรึกษาด้านโฆษณาดิจิทัลส่วนตัวของคุณ 🎯\n\nผมพร้อมช่วยคุณวิเคราะห์ข้อมูล จัดการแคมเปญ และเพิ่มประสิทธิภาพโฆษณาของคุณครับ\n\nคุณต้องการให้ช่วยเรื่องอะไรครับ?',
    };

    return mocks[context] || mocks.chat;
  }
}

module.exports = new AIConsultant();
