import React from 'react';
import TaxGauge from './TaxGauge';

export default function Dashboard({ data, onSelectAccount, onToggleAccount }) {
  const { accounts, recommended_account, totals, tax_settings } = data;

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
  };

  return (
    <div className="dashboard">
      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-label">ยอดรับโอนเข้ารวม (ปีนี้)</div>
          <div className="summary-value deposit">{formatMoney(totals.total_deposits)} บาท</div>
          <div className="summary-sub">{totals.total_deposit_count} รายการ</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">ยอดเบิกจ่ายรวม (ปีนี้)</div>
          <div className="summary-value withdrawal">{formatMoney(totals.total_withdrawals)} บาท</div>
          <div className="summary-sub">{totals.total_withdrawal_count} รายการ</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">รับโอนวันนี้</div>
          <div className="summary-value">{formatMoney(totals.today_deposits)} บาท</div>
          <div className="summary-sub">{totals.today_deposit_count} รายการ</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">เบิกจ่ายวันนี้</div>
          <div className="summary-value">{formatMoney(totals.today_withdrawals)} บาท</div>
          <div className="summary-sub">{totals.today_withdrawal_count} รายการ</div>
        </div>
      </div>

      {/* Recommended Account Banner */}
      {recommended_account && (
        <div className="recommended-banner">
          <div className="recommended-icon">&#9733;</div>
          <div className="recommended-content">
            <div className="recommended-title">บัญชีที่แนะนำให้ใช้</div>
            <div className="recommended-detail">
              {recommended_account.bank_name} - {recommended_account.account_number}
              ({recommended_account.account_name})
              <span className="recommended-remaining">
                เหลือ {recommended_account.rule1_remaining.toLocaleString()} ครั้ง
                | ความเสี่ยง {recommended_account.tax_risk_percent.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tax Rules Info */}
      <div className="tax-rules-info">
        <h3>เกณฑ์ภาษี - ธนาคารรายงานสรรพากร</h3>
        <div className="tax-rules-grid">
          <div className="tax-rule">
            <div className="tax-rule-name">เกณฑ์ที่ 1</div>
            <div className="tax-rule-desc">รับโอนเข้า ≥ {tax_settings.transaction_limit_primary.toLocaleString()} ครั้ง/ปี</div>
          </div>
          <div className="tax-rule">
            <div className="tax-rule-name">เกณฑ์ที่ 2</div>
            <div className="tax-rule-desc">รับโอนเข้า ≥ {tax_settings.transaction_limit_secondary.toLocaleString()} ครั้ง + ≥ {formatMoney(tax_settings.amount_limit_secondary)} บาท/ปี</div>
          </div>
        </div>
      </div>

      {/* Account Cards */}
      <div className="section-header">
        <h2>บัญชีธนาคารทั้งหมด ({accounts.length})</h2>
      </div>

      {accounts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">&#x1F3E6;</div>
          <p>ยังไม่มีบัญชี</p>
          <p className="text-muted">กดปุ่ม "เพิ่มบัญชี" เพื่อเริ่มต้น</p>
        </div>
      ) : (
        <div className="account-grid">
          {accounts.map(acc => (
            <div
              key={acc.id}
              className={`account-card ${!acc.is_active ? 'inactive' : ''} ${acc.tax_risk_level}`}
              onClick={() => onSelectAccount(acc)}
            >
              <div className="account-card-header">
                <div className="account-bank">{acc.bank_name}</div>
                <div className={`account-status ${acc.is_active ? 'active' : 'paused'}`}>
                  {acc.is_active ? 'ใช้งาน' : 'หยุดใช้'}
                </div>
              </div>

              <div className="account-number">{acc.account_number}</div>
              <div className="account-name">{acc.account_name}</div>

              {/* Tax Gauge */}
              <TaxGauge
                percent={acc.tax_risk_percent}
                level={acc.tax_risk_level}
                rule1Remaining={acc.rule1_remaining}
                depositCount={acc.yearly_deposit_count}
                depositTotal={acc.yearly_deposit_total}
                settings={tax_settings}
              />

              {/* Quick Stats */}
              <div className="account-quick-stats">
                <div className="quick-stat">
                  <span className="quick-stat-label">รับเข้า</span>
                  <span className="quick-stat-value deposit">{acc.yearly_deposit_count} ครั้ง</span>
                </div>
                <div className="quick-stat">
                  <span className="quick-stat-label">ยอดรวม</span>
                  <span className="quick-stat-value">{formatMoney(acc.yearly_deposit_total)}</span>
                </div>
                <div className="quick-stat">
                  <span className="quick-stat-label">เบิกจ่าย</span>
                  <span className="quick-stat-value withdrawal">{acc.yearly_withdrawal_count} ครั้ง</span>
                </div>
              </div>

              {/* Risk Warning */}
              {(acc.tax_risk_level === 'danger' || acc.tax_risk_level === 'exceeded') && (
                <div className={`risk-warning ${acc.tax_risk_level}`}>
                  {acc.tax_risk_level === 'exceeded'
                    ? 'เกินเกณฑ์แล้ว! ธนาคารจะรายงานสรรพากร'
                    : `ใกล้เต็ม! เหลือ ${acc.rule1_remaining} ครั้ง`
                  }
                </div>
              )}

              {/* Email count */}
              <div className="account-footer">
                <span className="email-count">อีเมลที่ผูก: {acc.email_count}</span>
                {acc.is_active && acc.tax_risk_level === 'exceeded' && (
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={(e) => { e.stopPropagation(); onToggleAccount(acc.id, false); }}
                  >
                    หยุดใช้บัญชีนี้
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
