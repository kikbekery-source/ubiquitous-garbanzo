import React, { useState } from 'react';

const SCENE_TYPE_LABELS = {
  production: 'กระบวนการผลิต',
  preparation: 'เตรียมเครื่อง',
  conversation: 'พูดคุยสนุกสนาน',
  other: 'อื่นๆ',
};

const SCENE_TYPE_ICONS = {
  production: '🍳',
  preparation: '🥬',
  conversation: '💬',
  other: '📌',
};

export default function ClipReview({ clip, onReview, onAnalyze, onNext, onPrev, currentIndex, totalClips }) {
  const [editMode, setEditMode] = useState(false);
  const [menuName, setMenuName] = useState(clip.final_menu_name || clip.menu_name || '');
  const [sceneType, setSceneType] = useState(clip.final_scene_type || clip.scene_type || 'other');
  const [notes, setNotes] = useState(clip.notes || '');

  const handleReview = (decision) => {
    onReview({
      decision,
      finalMenuName: menuName,
      finalSceneType: sceneType,
      notes: notes || undefined,
    });
    setEditMode(false);
  };

  const confidence = clip.confidence_score ? (clip.confidence_score * 100).toFixed(0) : null;

  return (
    <div className="clip-review">
      <div className="clip-nav">
        <button className="btn btn-ghost" onClick={onPrev} disabled={currentIndex === 0}>
          ← ก่อนหน้า
        </button>
        <span className="clip-counter">{currentIndex + 1} / {totalClips}</span>
        <button className="btn btn-ghost" onClick={onNext} disabled={currentIndex >= totalClips - 1}>
          ถัดไป →
        </button>
      </div>

      <div className="review-layout">
        <div className="video-panel">
          <div className="video-container">
            {clip.drive_web_view_link && clip.drive_web_view_link !== '#' ? (
              <iframe
                src={clip.drive_web_view_link.replace('/view', '/preview')}
                title={clip.filename}
                allowFullScreen
                className="video-frame"
              />
            ) : (
              <div className="video-placeholder">
                <div className="placeholder-icon">🎬</div>
                <p>{clip.filename}</p>
                <p className="text-muted">
                  {clip.duration_seconds ? `${clip.duration_seconds}s` : 'ไม่ทราบความยาว'}
                  {clip.file_size ? ` · ${(clip.file_size / 1048576).toFixed(1)} MB` : ''}
                </p>
              </div>
            )}
          </div>
          <div className="video-info">
            <h3>{clip.filename}</h3>
          </div>
        </div>

        <div className="analysis-panel">
          {clip.analysis_status === 'completed' ? (
            <>
              <div className="analysis-card">
                <h4>ผลวิเคราะห์ AI</h4>

                <div className="analysis-field">
                  <label>ชื่อเมนู</label>
                  {editMode ? (
                    <input value={menuName} onChange={e => setMenuName(e.target.value)} className="edit-input" />
                  ) : (
                    <div className="field-value menu-name">{clip.menu_name || '-'}</div>
                  )}
                </div>

                <div className="analysis-field">
                  <label>ประเภทฉาก</label>
                  {editMode ? (
                    <select value={sceneType} onChange={e => setSceneType(e.target.value)} className="edit-select">
                      {Object.entries(SCENE_TYPE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{SCENE_TYPE_ICONS[key]} {label}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="field-value scene-badge" data-type={clip.scene_type}>
                      {SCENE_TYPE_ICONS[clip.scene_type]} {SCENE_TYPE_LABELS[clip.scene_type] || clip.scene_type}
                    </div>
                  )}
                </div>

                {confidence && (
                  <div className="analysis-field">
                    <label>ความมั่นใจ</label>
                    <div className="confidence-bar-wrapper">
                      <div className="confidence-bar">
                        <div
                          className={`confidence-fill ${confidence >= 80 ? 'high' : confidence >= 50 ? 'medium' : 'low'}`}
                          style={{ width: `${confidence}%` }}
                        />
                      </div>
                      <span className="confidence-text">{confidence}%</span>
                    </div>
                  </div>
                )}

                {editMode && (
                  <div className="analysis-field">
                    <label>หมายเหตุ</label>
                    <textarea
                      value={notes} onChange={e => setNotes(e.target.value)}
                      className="edit-textarea" placeholder="เพิ่มหมายเหตุ..."
                    />
                  </div>
                )}
              </div>

              {clip.decision ? (
                <div className={`review-status status-${clip.decision}`}>
                  <span className="status-icon">
                    {clip.decision === 'approved' ? '✅' : clip.decision === 'edited' ? '✏️' : '🗑️'}
                  </span>
                  <span>
                    {clip.decision === 'approved' ? 'ยืนยันแล้ว' :
                     clip.decision === 'edited' ? 'แก้ไขแล้ว' : 'ตัดทิ้งแล้ว'}
                  </span>
                </div>
              ) : null}

              <div className="review-actions">
                {!editMode ? (
                  <>
                    <button className="btn btn-approve" onClick={() => handleReview('approved')}>
                      ✅ ยืนยัน
                    </button>
                    <button className="btn btn-edit" onClick={() => setEditMode(true)}>
                      ✏️ แก้ไข
                    </button>
                    <button className="btn btn-discard" onClick={() => handleReview('discarded')}>
                      🗑️ ตัดทิ้ง
                    </button>
                  </>
                ) : (
                  <>
                    <button className="btn btn-approve" onClick={() => handleReview('edited')}>
                      💾 บันทึกการแก้ไข
                    </button>
                    <button className="btn btn-ghost" onClick={() => setEditMode(false)}>
                      ยกเลิก
                    </button>
                  </>
                )}
              </div>
            </>
          ) : clip.analysis_status === 'analyzing' ? (
            <div className="analysis-loading">
              <div className="spinner" />
              <p>กำลังวิเคราะห์ด้วย Gemini AI...</p>
            </div>
          ) : clip.analysis_status === 'failed' ? (
            <div className="analysis-error">
              <p>❌ วิเคราะห์ล้มเหลว</p>
              <p className="text-muted">{clip.error_message}</p>
              <button className="btn btn-primary" onClick={() => onAnalyze(clip.id)}>
                🔄 ลองใหม่
              </button>
            </div>
          ) : (
            <div className="analysis-pending">
              <p>ยังไม่ได้วิเคราะห์</p>
              <button className="btn btn-primary" onClick={() => onAnalyze(clip.id)}>
                🤖 วิเคราะห์คลิปนี้
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
