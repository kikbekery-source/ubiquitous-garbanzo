import React from 'react';

export default function TaxGauge({ percent, level, rule1Remaining, depositCount, depositTotal, settings }) {
  const getBarColor = (pct) => {
    if (pct >= 90) return '#e74c3c';
    if (pct >= 75) return '#e67e22';
    if (pct >= 60) return '#f39c12';
    if (pct >= 40) return '#f1c40f';
    if (pct >= 20) return '#2ecc71';
    return '#27ae60';
  };

  const getGradient = (pct) => {
    if (pct >= 80) return 'linear-gradient(90deg, #f1c40f 0%, #e74c3c 100%)';
    if (pct >= 50) return 'linear-gradient(90deg, #2ecc71 0%, #f1c40f 100%)';
    return 'linear-gradient(90deg, #27ae60 0%, #2ecc71 100%)';
  };

  const clampedPercent = Math.min(percent, 100);

  return (
    <div className="tax-gauge">
      <div className="gauge-header">
        <span className="gauge-label">เกณฑ์ภาษี</span>
        <span className={`gauge-percent ${level}`}>{clampedPercent.toFixed(1)}%</span>
      </div>

      <div className="gauge-bar-container">
        <div className="gauge-bar-bg">
          <div
            className="gauge-bar-fill"
            style={{
              width: `${clampedPercent}%`,
              background: getGradient(clampedPercent),
            }}
          />
          {/* Threshold markers */}
          <div className="gauge-marker" style={{ left: '40%' }} title="40% - ระวัง" />
          <div className="gauge-marker" style={{ left: '60%' }} title="60% - เตือน" />
          <div className="gauge-marker warning" style={{ left: '80%' }} title="80% - อันตราย" />
        </div>
      </div>

      <div className="gauge-footer">
        <div className="gauge-detail">
          <span className="gauge-detail-label">ครั้ง:</span>
          <span>{depositCount?.toLocaleString()} / {settings?.transaction_limit_primary?.toLocaleString()}</span>
        </div>
        <div className="gauge-detail">
          <span className="gauge-detail-label">เหลือ:</span>
          <span style={{ color: getBarColor(clampedPercent) }}>
            {rule1Remaining?.toLocaleString()} ครั้ง
          </span>
        </div>
      </div>
    </div>
  );
}
