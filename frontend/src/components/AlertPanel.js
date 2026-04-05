import React from 'react';

export default function AlertPanel({ alerts, onMarkRead, onMarkAllRead, onClose }) {
  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'danger': return '!!';
      case 'warning': return '!';
      default: return 'i';
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString('th-TH', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="alert-panel">
      <div className="alert-panel-header">
        <h3>การแจ้งเตือน ({alerts.length})</h3>
        <div className="alert-panel-actions">
          {alerts.length > 0 && (
            <button className="btn btn-sm btn-ghost" onClick={onMarkAllRead}>
              อ่านทั้งหมด
            </button>
          )}
          <button className="btn btn-sm btn-ghost" onClick={onClose}>&#10005;</button>
        </div>
      </div>
      <div className="alert-list">
        {alerts.length === 0 ? (
          <div className="alert-empty">ไม่มีการแจ้งเตือนใหม่</div>
        ) : (
          alerts.map(alert => (
            <div key={alert.id} className={`alert-item ${alert.severity}`}>
              <div className={`alert-icon ${alert.severity}`}>
                {getSeverityIcon(alert.severity)}
              </div>
              <div className="alert-content">
                <div className="alert-account">
                  {alert.bank_name} - {alert.account_number}
                </div>
                <div className="alert-message">{alert.message}</div>
                <div className="alert-time">{formatTime(alert.created_at)}</div>
              </div>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => onMarkRead(alert.id)}
              >
                &#10003;
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
