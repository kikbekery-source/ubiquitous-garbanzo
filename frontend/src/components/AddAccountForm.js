import React, { useState } from 'react';

const BANK_OPTIONS = [
  'ธนาคารกสิกรไทย (KBANK)',
  'ธนาคารไทยพาณิชย์ (SCB)',
  'ธนาคารกรุงเทพ (BBL)',
  'ธนาคารกรุงไทย (KTB)',
  'ธนาคารกรุงศรีอยุธยา (BAY)',
  'ธนาคารทหารไทยธนชาต (TTB)',
  'ธนาคารออมสิน (GSB)',
  'ธนาคาร ซีไอเอ็มบี ไทย (CIMBT)',
  'ธนาคารยูโอบี (UOB)',
  'ธนาคารแลนด์ แอนด์ เฮ้าส์ (LH)',
  'อื่นๆ',
];

export default function AddAccountForm({ onSubmit, onCancel }) {
  const [bankName, setBankName] = useState('');
  const [customBank, setCustomBank] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalBank = bankName === 'อื่นๆ' ? customBank : bankName;
    if (!finalBank || !accountNumber || !accountName) return;
    onSubmit({ bankName: finalBank, accountNumber, accountName });
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>เพิ่มบัญชีธนาคาร</h2>
          <button className="btn btn-ghost" onClick={onCancel}>&#10005;</button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>ธนาคาร</label>
            <select value={bankName} onChange={e => setBankName(e.target.value)} required>
              <option value="">-- เลือกธนาคาร --</option>
              {BANK_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          {bankName === 'อื่นๆ' && (
            <div className="form-group">
              <label>ชื่อธนาคาร</label>
              <input
                type="text" placeholder="ระบุชื่อธนาคาร"
                value={customBank} onChange={e => setCustomBank(e.target.value)} required
              />
            </div>
          )}
          <div className="form-group">
            <label>เลขที่บัญชี</label>
            <input
              type="text" placeholder="เช่น 123-4-56789-0"
              value={accountNumber} onChange={e => setAccountNumber(e.target.value)} required
            />
          </div>
          <div className="form-group">
            <label>ชื่อบัญชี</label>
            <input
              type="text" placeholder="ชื่อ-นามสกุล เจ้าของบัญชี"
              value={accountName} onChange={e => setAccountName(e.target.value)} required
            />
          </div>
          <div className="modal-actions">
            <button type="submit" className="btn btn-primary">เพิ่มบัญชี</button>
            <button type="button" className="btn btn-ghost" onClick={onCancel}>ยกเลิก</button>
          </div>
        </form>
      </div>
    </div>
  );
}
