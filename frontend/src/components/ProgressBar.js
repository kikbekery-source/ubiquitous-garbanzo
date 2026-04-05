import React from 'react';

export default function ProgressBar({ stats }) {
  if (!stats || !stats.total) return null;

  const { total, approved, edited, discarded, pending_review, analyzing, pending_analysis, failed } = stats;
  const reviewed = (approved || 0) + (edited || 0) + (discarded || 0);

  return (
    <div className="progress-section">
      <div className="progress-header">
        <h3>ความคืบหน้า</h3>
        <span className="progress-text">{reviewed}/{total} รีวิวแล้ว</span>
      </div>

      <div className="progress-track">
        <div className="progress-segment approved" style={{ width: `${(approved / total) * 100}%` }}
          title={`ยืนยัน: ${approved}`} />
        <div className="progress-segment edited" style={{ width: `${(edited / total) * 100}%` }}
          title={`แก้ไข: ${edited}`} />
        <div className="progress-segment discarded" style={{ width: `${(discarded / total) * 100}%` }}
          title={`ตัดทิ้ง: ${discarded}`} />
      </div>

      <div className="progress-legend">
        <span className="legend-item"><i className="dot approved" /> ยืนยัน ({approved || 0})</span>
        <span className="legend-item"><i className="dot edited" /> แก้ไข ({edited || 0})</span>
        <span className="legend-item"><i className="dot discarded" /> ตัดทิ้ง ({discarded || 0})</span>
        <span className="legend-item"><i className="dot pending" /> รอรีวิว ({pending_review || 0})</span>
        {(analyzing || 0) > 0 && <span className="legend-item"><i className="dot analyzing" /> กำลังวิเคราะห์ ({analyzing})</span>}
        {(failed || 0) > 0 && <span className="legend-item"><i className="dot failed" /> ล้มเหลว ({failed})</span>}
      </div>
    </div>
  );
}
