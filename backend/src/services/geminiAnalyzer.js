const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiAnalyzer {
  constructor() {
    this.model = null;
    this.mockMode = false;
  }

  init() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      console.warn('Gemini API key not configured. Using mock mode.');
      this.mockMode = true;
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }

  async analyzeClip(clipInfo) {
    if (this.mockMode) return this._mockAnalysis(clipInfo);

    const prompt = `คุณเป็นผู้เชี่ยวชาญในการวิเคราะห์วิดีโอร้านอาหาร กรุณาวิเคราะห์วิดีโอนี้:

ชื่อไฟล์: ${clipInfo.filename}
ความยาว: ${clipInfo.durationSeconds || 'ไม่ทราบ'} วินาที

กรุณาตอบในรูปแบบ JSON ดังนี้:
{
  "menu_name": "ชื่อเมนูอาหาร (ภาษาไทย)",
  "scene_type": "ประเภทฉาก (เลือกจาก: production, preparation, conversation, other)",
  "scene_type_thai": "คำอธิบายประเภทฉากเป็นภาษาไทย",
  "confidence_score": 0.85,
  "description": "คำอธิบายสั้นๆ ว่าเห็นอะไรในวิดีโอ"
}

หมายเหตุประเภทฉาก:
- production = กระบวนการผลิต/ปรุงอาหาร
- preparation = เตรียมเครื่อง/วัตถุดิบ
- conversation = พูดคุยสนุกสนาน
- other = อื่นๆ

ตอบเป็น JSON เท่านั้น ไม่ต้องมี markdown code block`;

    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      const parsed = JSON.parse(text.replace(/```json?\n?/g, '').replace(/```/g, '').trim());

      return {
        menuName: parsed.menu_name,
        sceneType: parsed.scene_type,
        confidenceScore: Math.min(1, Math.max(0, parsed.confidence_score)),
        rawResponse: JSON.stringify(parsed),
      };
    } catch (error) {
      throw new Error(`Gemini analysis failed: ${error.message}`);
    }
  }

  _mockAnalysis(clipInfo) {
    const filename = clipInfo.filename || '';
    const sceneTypes = ['production', 'preparation', 'conversation', 'other'];
    const mockData = {
      'ผัดไทย': { menu: 'ผัดไทยกุ้งสด', scene: 'production', conf: 0.92 },
      'ส้มตำ': { menu: 'ส้มตำไทย', scene: 'preparation', conf: 0.88 },
      'พูดคุย': { menu: '-', scene: 'conversation', conf: 0.95 },
      'ต้มยำ': { menu: 'ต้มยำกุ้งน้ำข้น', scene: 'production', conf: 0.90 },
      'ข้าวผัด': { menu: 'ข้าวผัดปู', scene: 'preparation', conf: 0.85 },
    };

    const match = Object.entries(mockData).find(([key]) => filename.includes(key));
    if (match) {
      const [, data] = match;
      return Promise.resolve({
        menuName: data.menu,
        sceneType: data.scene,
        confidenceScore: data.conf,
        rawResponse: JSON.stringify({ mock: true, ...data }),
      });
    }

    const randomScene = sceneTypes[Math.floor(Math.random() * 3)];
    return Promise.resolve({
      menuName: 'เมนูไม่ระบุ',
      sceneType: randomScene,
      confidenceScore: 0.6 + Math.random() * 0.3,
      rawResponse: JSON.stringify({ mock: true, filename }),
    });
  }
}

module.exports = new GeminiAnalyzer();
