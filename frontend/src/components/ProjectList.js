import React, { useState } from 'react';

export default function ProjectList({ projects, onSelect, onCreateProject, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [folderId, setFolderId] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !folderId) return;
    await onCreateProject({ name, driveFolderId: folderId });
    setName('');
    setFolderId('');
    setShowForm(false);
  };

  return (
    <div className="project-list">
      <div className="section-header">
        <h2>โปรเจคทั้งหมด</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'ยกเลิก' : '+ สร้างโปรเจคใหม่'}
        </button>
      </div>

      {showForm && (
        <form className="create-form" onSubmit={handleSubmit}>
          <input
            type="text" placeholder="ชื่อโปรเจค เช่น ร้านส้มตำแม่ปุ๋ย"
            value={name} onChange={e => setName(e.target.value)} required
          />
          <input
            type="text" placeholder="Google Drive Folder ID"
            value={folderId} onChange={e => setFolderId(e.target.value)} required
          />
          <button type="submit" className="btn btn-success">สร้างโปรเจค</button>
        </form>
      )}

      {projects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📁</div>
          <p>ยังไม่มีโปรเจค</p>
          <p className="text-muted">สร้างโปรเจคใหม่เพื่อเริ่มวิเคราะห์วิดีโอ</p>
        </div>
      ) : (
        <div className="project-grid">
          {projects.map(p => (
            <div key={p.id} className="project-card" onClick={() => onSelect(p)}>
              <h3>{p.name}</h3>
              <div className="project-stats">
                <div className="stat">
                  <span className="stat-value">{p.total_clips || 0}</span>
                  <span className="stat-label">คลิปทั้งหมด</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{p.analyzed_clips || 0}</span>
                  <span className="stat-label">วิเคราะห์แล้ว</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{p.reviewed_clips || 0}</span>
                  <span className="stat-label">รีวิวแล้ว</span>
                </div>
              </div>
              <div className="project-progress">
                <div
                  className="progress-bar"
                  style={{
                    width: p.total_clips
                      ? `${((p.reviewed_clips || 0) / p.total_clips) * 100}%`
                      : '0%',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
