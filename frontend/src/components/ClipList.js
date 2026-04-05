import React from 'react';

const SCENE_ICONS = {
  production: '🍳',
  preparation: '🥬',
  conversation: '💬',
  other: '📌',
};

export default function ClipList({ clips, selectedId, onSelect, filter, onFilterChange }) {
  return (
    <div className="clip-list">
      <div className="clip-list-header">
        <h3>คลิปทั้งหมด ({clips.length})</h3>
        <select className="filter-select" value={filter} onChange={e => onFilterChange(e.target.value)}>
          <option value="all">ทั้งหมด</option>
          <option value="pending">รอรีวิว</option>
          <option value="approved">ยืนยันแล้ว</option>
          <option value="edited">แก้ไขแล้ว</option>
          <option value="discarded">ตัดทิ้ง</option>
          <option value="unanalyzed">ยังไม่วิเคราะห์</option>
        </select>
      </div>

      <div className="clip-items">
        {clips.map((clip, index) => (
          <div
            key={clip.id}
            className={`clip-item ${clip.id === selectedId ? 'active' : ''} ${clip.decision ? `reviewed-${clip.decision}` : ''}`}
            onClick={() => onSelect(clip, index)}
          >
            <div className="clip-item-icon">
              {clip.scene_type ? SCENE_ICONS[clip.scene_type] : '🎥'}
            </div>
            <div className="clip-item-info">
              <div className="clip-item-name">{clip.filename}</div>
              <div className="clip-item-meta">
                {clip.menu_name && <span className="menu-tag">{clip.menu_name}</span>}
                {clip.confidence_score && (
                  <span className="confidence-tag">{(clip.confidence_score * 100).toFixed(0)}%</span>
                )}
              </div>
            </div>
            <div className="clip-item-status">
              {clip.decision === 'approved' && <span className="status-dot approved" title="ยืนยัน" />}
              {clip.decision === 'edited' && <span className="status-dot edited" title="แก้ไข" />}
              {clip.decision === 'discarded' && <span className="status-dot discarded" title="ตัดทิ้ง" />}
              {!clip.decision && clip.analysis_status === 'completed' && <span className="status-dot pending" title="รอรีวิว" />}
              {clip.analysis_status === 'pending' && <span className="status-dot unanalyzed" title="ยังไม่วิเคราะห์" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
