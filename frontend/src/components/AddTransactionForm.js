import React, { useState } from 'react';

export default function AddTransactionForm({ accountId, onSubmit, onCancel }) {
  const [type, setType] = useState('deposit');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || !transactionDate) return;
    onSubmit({
      accountId,
      type,
      amount: parseFloat(amount),
      description: description || undefined,
      transactionDate,
    });
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>เพิ่มรายการ</h2>
          <button className="btn btn-ghost" onClick={onCancel}>&#10005;</button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>ประเภท</label>
            <div className="type-toggle">
              <button
                type="button"
                className={`type-btn ${type === 'deposit' ? 'active deposit' : ''}`}
                onClick={() => setType('deposit')}
              >
                รับโอนเข้า
              </button>
              <button
                type="button"
                className={`type-btn ${type === 'withdrawal' ? 'active withdrawal' : ''}`}
                onClick={() => setType('withdrawal')}
              >
                เบิกจ่าย
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>จำนวนเงิน (บาท)</label>
            <input
              type="number" step="0.01" min="0"
              placeholder="0.00"
              value={amount} onChange={e => setAmount(e.target.value)} required
            />
          </div>
          <div className="form-group">
            <label>วันที่</label>
            <input
              type="date"
              value={transactionDate} onChange={e => setTransactionDate(e.target.value)} required
            />
          </div>
          <div className="form-group">
            <label>รายละเอียด (ไม่บังคับ)</label>
            <input
              type="text" placeholder="เช่น โอนจาก นาย ก."
              value={description} onChange={e => setDescription(e.target.value)}
            />
          </div>
          <div className="modal-actions">
            <button type="submit" className="btn btn-primary">เพิ่มรายการ</button>
            <button type="button" className="btn btn-ghost" onClick={onCancel}>ยกเลิก</button>
          </div>
        </form>
      </div>
    </div>
  );
}
