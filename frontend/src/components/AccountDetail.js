import React, { useState } from 'react';
import TaxGauge from './TaxGauge';

export default function AccountDetail({
  account, transactions, dashboardAccount,
  onAddEmail, onRemoveEmail, onToggleAccount, onDeleteAccount,
}) {
  const [newEmail, setNewEmail] = useState('');
  const [emailDesc, setEmailDesc] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const handleAddEmail = (e) => {
    e.preventDefault();
    if (!newEmail) return;
    onAddEmail(account.id, { email: newEmail, description: emailDesc || undefined });
    setNewEmail('');
    setEmailDesc('');
  };

  const da = dashboardAccount || {};

  return (
    <div className="account-detail">
      {/* Account Info */}
      <div className="detail-section">
        <div className="detail-header-row">
          <div>
            <h2>{account.bank_name}</h2>
            <div className="detail-account-number">{account.account_number}</div>
            <div className="detail-account-name">{account.account_name}</div>
          </div>
          <div className="detail-actions">
            <button
              className={`btn ${account.is_active ? 'btn-warning' : 'btn-success'}`}
              onClick={() => onToggleAccount(account.id, !account.is_active)}
            >
              {account.is_active ? 'หยุดใช้บัญชี' : 'เปิดใช้บัญชี'}
            </button>
            <button className="btn btn-danger" onClick={() => setShowDeleteConfirm(true)}>
              ลบบัญชี
            </button>
          </div>
        </div>

        {showDeleteConfirm && (
          <div className="delete-confirm">
            <p>ยืนยันการลบบัญชี {account.account_number}?</p>
            <p className="text-muted">ข้อมูลทั้งหมดจะถูกลบและไม่สามารถกู้คืนได้</p>
            <div className="confirm-actions">
              <button className="btn btn-danger" onClick={() => onDeleteAccount(account.id)}>ยืนยันลบ</button>
              <button className="btn btn-ghost" onClick={() => setShowDeleteConfirm(false)}>ยกเลิก</button>
            </div>
          </div>
        )}
      </div>

      <div className="detail-grid">
        {/* Tax Status */}
        <div className="detail-section">
          <h3>สถานะเกณฑ์ภาษี</h3>
          {da.tax_risk_level && (
            <TaxGauge
              percent={da.tax_risk_percent || 0}
              level={da.tax_risk_level || 'safe'}
              rule1Remaining={da.rule1_remaining || 0}
              depositCount={da.yearly_deposit_count || 0}
              depositTotal={da.yearly_deposit_total || 0}
              settings={da.tax_settings || { transaction_limit_primary: 3000 }}
            />
          )}

          <div className="tax-detail-stats">
            <div className="tax-stat-row">
              <span>เกณฑ์ 1: จำนวนครั้งรับโอน</span>
              <span className={da.rule1_triggered ? 'exceeded' : ''}>
                {(da.yearly_deposit_count || 0).toLocaleString()} / 3,000 ครั้ง
              </span>
            </div>
            <div className="tax-stat-row">
              <span>เกณฑ์ 2: จำนวนครั้ง (400+)</span>
              <span className={da.yearly_deposit_count >= 400 ? 'exceeded' : ''}>
                {(da.yearly_deposit_count || 0).toLocaleString()} / 400 ครั้ง
              </span>
            </div>
            <div className="tax-stat-row">
              <span>เกณฑ์ 2: ยอดเงิน (2 ล้าน+)</span>
              <span className={da.rule2_triggered ? 'exceeded' : ''}>
                {formatMoney(da.yearly_deposit_total || 0)} / 2,000,000.00 บาท
              </span>
            </div>
          </div>

          {/* Year Summary */}
          <div className="year-summary">
            <div className="year-stat">
              <div className="year-stat-label">รับโอนเข้า (ปีนี้)</div>
              <div className="year-stat-value deposit">
                {formatMoney(da.yearly_deposit_total)} บาท
              </div>
              <div className="year-stat-sub">{(da.yearly_deposit_count || 0).toLocaleString()} ครั้ง</div>
            </div>
            <div className="year-stat">
              <div className="year-stat-label">เบิกจ่าย (ปีนี้)</div>
              <div className="year-stat-value withdrawal">
                {formatMoney(da.yearly_withdrawal_total)} บาท
              </div>
              <div className="year-stat-sub">{(da.yearly_withdrawal_count || 0).toLocaleString()} ครั้ง</div>
            </div>
          </div>
        </div>

        {/* Linked Emails */}
        <div className="detail-section">
          <h3>อีเมลที่ผูกกับบัญชี</h3>
          <form className="add-email-form" onSubmit={handleAddEmail}>
            <input
              type="email"
              placeholder="อีเมล เช่น notify@bank.com"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              required
            />
            <input
              type="text"
              placeholder="คำอธิบาย (ไม่บังคับ)"
              value={emailDesc}
              onChange={e => setEmailDesc(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">เพิ่ม</button>
          </form>

          {account.emails && account.emails.length > 0 ? (
            <div className="email-list">
              {account.emails.map(email => (
                <div key={email.id} className="email-item">
                  <div className="email-info">
                    <div className="email-address">{email.email}</div>
                    {email.description && <div className="email-desc">{email.description}</div>}
                  </div>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => onRemoveEmail(account.id, email.id)}
                  >
                    ลบ
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted">ยังไม่มีอีเมลที่ผูก</p>
          )}
        </div>
      </div>

      {/* Transaction List */}
      <div className="detail-section">
        <h3>รายการล่าสุด ({transactions.length})</h3>
        {transactions.length > 0 ? (
          <div className="transaction-table-wrapper">
            <table className="transaction-table">
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>ประเภท</th>
                  <th>จำนวนเงิน</th>
                  <th>รายละเอียด</th>
                  <th>ที่มา</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => (
                  <tr key={tx.id} className={tx.type}>
                    <td>{formatDate(tx.transaction_date)}</td>
                    <td>
                      <span className={`type-badge ${tx.type}`}>
                        {tx.type === 'deposit' ? 'รับโอนเข้า' : 'เบิกจ่าย'}
                      </span>
                    </td>
                    <td className={`amount ${tx.type}`}>
                      {tx.type === 'deposit' ? '+' : '-'}{formatMoney(tx.amount)} บาท
                    </td>
                    <td>{tx.description || '-'}</td>
                    <td>{tx.source_email || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted">ยังไม่มีรายการ</p>
        )}
      </div>
    </div>
  );
}
