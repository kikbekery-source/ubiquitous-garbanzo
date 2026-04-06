import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from '../hooks/useApi';

export default function AIConsultant() {
  const api = useApi();
  const [sessionId] = useState(() => 'session_' + Date.now());
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [memories, setMemories] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState('chat');
  const chatEndRef = useRef(null);

  const loadMemories = useCallback(async () => {
    try {
      const data = await api.get('/optimizer/ai/memory?limit=20');
      setMemories(data.data || []);
    } catch (e) { /* ignore */ }
  }, [api]);

  const loadRecommendations = useCallback(async () => {
    try {
      const data = await api.get('/optimizer/ai/recommendations?limit=20');
      setRecommendations(data.data || []);
    } catch (e) { /* ignore */ }
  }, [api]);

  useEffect(() => {
    loadMemories();
    loadRecommendations();
  }, [loadMemories, loadRecommendations]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || sending) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setSending(true);

    try {
      const result = await api.post('/optimizer/ai/chat', {
        message: userMsg,
        sessionId,
      });
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: result.response,
        memories: result.memories,
      }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `Error: ${e.message}`,
      }]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleRecStatus = async (id, status) => {
    try {
      await api.put(`/optimizer/ai/recommendations/${id}`, { status });
      loadRecommendations();
    } catch (e) { /* ignore */ }
  };

  const quickPrompts = [
    'วิเคราะห์ engagement ล่าสุดให้หน่อย',
    'แนะนำกลยุทธ์ยิงแอดสำหรับร้านอาหาร',
    'ควรเพิ่มหรือลดงบแคมเปญตอนนี้?',
    'ช่วยแนะนำ target audience ที่เหมาะ',
    'เปรียบเทียบ Facebook กับ TikTok อันไหนคุ้มกว่า',
    'สรุปภาพรวมการตลาดเดือนนี้',
  ];

  return (
    <div className="panel ai-consultant-panel">
      <div className="panel-header">
        <h2>AI Consultant - AdGenius</h2>
        <div className="sub-tabs">
          <button className={`tab-btn sm ${activeSubTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveSubTab('chat')}>
            Chat
          </button>
          <button className={`tab-btn sm ${activeSubTab === 'memory' ? 'active' : ''}`} onClick={() => setActiveSubTab('memory')}>
            Memory ({memories.length})
          </button>
          <button className={`tab-btn sm ${activeSubTab === 'recommendations' ? 'active' : ''}`} onClick={() => setActiveSubTab('recommendations')}>
            Recommendations ({recommendations.length})
          </button>
        </div>
      </div>

      {activeSubTab === 'chat' && (
        <div className="chat-container">
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-welcome">
                <div className="welcome-icon">🤖</div>
                <h3>AdGenius - ที่ปรึกษาโฆษณาส่วนตัว</h3>
                <p>สวัสดีครับ! ผมพร้อมช่วยวิเคราะห์และจัดการโฆษณาของคุณ</p>
                <div className="quick-prompts">
                  {quickPrompts.map((prompt, i) => (
                    <button
                      key={i}
                      className="quick-prompt-btn"
                      onClick={() => { setInput(prompt); }}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`chat-message ${msg.role}`}>
                <div className="message-avatar">
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className="message-content">
                  <pre className="message-text">{msg.text}</pre>
                  {msg.memories > 0 && (
                    <span className="memory-indicator">
                      Used {msg.memories} memories
                    </span>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="chat-message assistant">
                <div className="message-avatar">🤖</div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="chat-input-area">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="พิมพ์ข้อความถึง AdGenius..."
              rows={2}
              disabled={sending}
            />
            <button className="btn btn-primary send-btn" onClick={sendMessage} disabled={sending || !input.trim()}>
              Send
            </button>
          </div>
        </div>
      )}

      {activeSubTab === 'memory' && (
        <div className="memory-container">
          <div className="memory-header">
            <p className="text-muted">AI Memory stores insights, strategies, and learnings for smarter recommendations over time.</p>
          </div>
          {memories.length === 0 ? (
            <div className="empty-state small">
              <p>No memories yet. AI will learn as you use the system.</p>
            </div>
          ) : (
            <div className="memory-list">
              {memories.map(mem => (
                <div key={mem.id} className="memory-card">
                  <div className="memory-top">
                    <span className={`badge badge-${mem.category}`}>{mem.category}</span>
                    <span className="importance-bar" style={{ width: `${mem.importance * 100}%` }} />
                    <span className="text-muted">Importance: {(mem.importance * 100).toFixed(0)}%</span>
                  </div>
                  <h4>{mem.title}</h4>
                  <p className="memory-content">{
                    typeof mem.content === 'string' && mem.content.length > 200
                      ? mem.content.substring(0, 200) + '...'
                      : mem.content
                  }</p>
                  <div className="memory-footer">
                    <span>Accessed: {mem.access_count}x</span>
                    <span>{new Date(mem.created_at).toLocaleDateString('th-TH')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'recommendations' && (
        <div className="rec-container">
          {recommendations.length === 0 ? (
            <div className="empty-state small">
              <p>No recommendations yet. Run optimization or ask AI for analysis.</p>
            </div>
          ) : (
            <div className="rec-list">
              {recommendations.map(rec => (
                <div key={rec.id} className="rec-card">
                  <div className="rec-top">
                    <span className={`badge badge-${rec.type}`}>{rec.type}</span>
                    <span className={`status-badge ${rec.status}`}>{rec.status}</span>
                    <span className="confidence">Confidence: {(rec.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <p>{rec.recommendation}</p>
                  {rec.reasoning && <p className="text-muted">{rec.reasoning}</p>}
                  {rec.status === 'pending' && (
                    <div className="rec-actions">
                      <button className="btn btn-sm btn-success" onClick={() => handleRecStatus(rec.id, 'accepted')}>
                        Accept
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleRecStatus(rec.id, 'rejected')}>
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
