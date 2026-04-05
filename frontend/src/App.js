import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from './hooks/useApi';
import Dashboard from './components/Dashboard';
import AccountDetail from './components/AccountDetail';
import AddAccountForm from './components/AddAccountForm';
import AddTransactionForm from './components/AddTransactionForm';
import AlertPanel from './components/AlertPanel';
import './App.css';

export default function App() {
  const api = useApi();
  const [dashboardData, setDashboardData] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [accountDetail, setAccountDetail] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [view, setView] = useState('dashboard');

  const loadDashboard = useCallback(async () => {
    try {
      const data = await api.get('/dashboard');
      setDashboardData(data);
    } catch (e) { /* ignore */ }
  }, [api]);

  const loadAccountDetail = useCallback(async (accountId) => {
    try {
      const [detail, txData] = await Promise.all([
        api.get(`/accounts/${accountId}`),
        api.get(`/transactions/account/${accountId}?limit=100`),
      ]);
      setAccountDetail(detail);
      setTransactions(txData.transactions || []);
    } catch (e) { /* ignore */ }
  }, [api]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const handleSelectAccount = async (account) => {
    setSelectedAccount(account);
    setView('detail');
    await loadAccountDetail(account.id);
  };

  const handleBack = () => {
    setView('dashboard');
    setSelectedAccount(null);
    setAccountDetail(null);
    loadDashboard();
  };

  const handleCreateAccount = async (data) => {
    await api.post('/accounts', data);
    setShowAddAccount(false);
    loadDashboard();
  };

  const handleAddTransaction = async (data) => {
    await api.post('/transactions', data);
    setShowAddTransaction(false);
    if (selectedAccount) {
      await loadAccountDetail(selectedAccount.id);
    }
    loadDashboard();
  };

  const handleAddEmail = async (accountId, emailData) => {
    await api.post(`/accounts/${accountId}/emails`, emailData);
    await loadAccountDetail(accountId);
  };

  const handleRemoveEmail = async (accountId, emailId) => {
    await api.del(`/accounts/${accountId}/emails/${emailId}`);
    await loadAccountDetail(accountId);
  };

  const handleToggleAccount = async (accountId, isActive) => {
    const method = 'PUT';
    const res = await fetch(`/api/accounts/${accountId}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    });
    await res.json();
    loadDashboard();
    if (selectedAccount && selectedAccount.id === accountId) {
      await loadAccountDetail(accountId);
    }
  };

  const handleDeleteAccount = async (accountId) => {
    await api.del(`/accounts/${accountId}`);
    handleBack();
  };

  const handleMarkAlertRead = async (alertId) => {
    const res = await fetch(`/api/dashboard/alerts/${alertId}/read`, { method: 'PUT' });
    await res.json();
    loadDashboard();
  };

  const handleMarkAllAlertsRead = async () => {
    const res = await fetch('/api/dashboard/alerts/read-all', { method: 'PUT' });
    await res.json();
    loadDashboard();
  };

  const unreadCount = dashboardData?.alerts?.length || 0;

  // Dashboard view
  if (view === 'dashboard') {
    return (
      <div className="app">
        <header className="app-header">
          <div className="header-left">
            <h1>Bank Transfer Alerts</h1>
            <p className="subtitle">ระบบแจ้งเตือนการโอนเงิน & ติดตามเกณฑ์ภาษี</p>
          </div>
          <div className="header-actions">
            <button className="btn btn-alert-toggle" onClick={() => setShowAlerts(!showAlerts)}>
              {unreadCount > 0 && <span className="alert-badge">{unreadCount}</span>}
              แจ้งเตือน
            </button>
            <button className="btn btn-primary" onClick={() => setShowAddAccount(true)}>
              + เพิ่มบัญชี
            </button>
          </div>
        </header>

        {showAlerts && dashboardData && (
          <AlertPanel
            alerts={dashboardData.alerts}
            onMarkRead={handleMarkAlertRead}
            onMarkAllRead={handleMarkAllAlertsRead}
            onClose={() => setShowAlerts(false)}
          />
        )}

        {showAddAccount && (
          <AddAccountForm
            onSubmit={handleCreateAccount}
            onCancel={() => setShowAddAccount(false)}
          />
        )}

        <main className="app-main">
          {dashboardData ? (
            <Dashboard
              data={dashboardData}
              onSelectAccount={handleSelectAccount}
              onToggleAccount={handleToggleAccount}
            />
          ) : (
            <div className="loading-state">
              <div className="spinner" />
              <p>กำลังโหลดข้อมูล...</p>
            </div>
          )}
        </main>
      </div>
    );
  }

  // Account detail view
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <button className="btn btn-ghost" onClick={handleBack}>
            &#8592; กลับ
          </button>
          <h1>{accountDetail?.bank_name} - {accountDetail?.account_name}</h1>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => setShowAddTransaction(true)}>
            + เพิ่มรายการ
          </button>
        </div>
      </header>

      {showAddTransaction && selectedAccount && (
        <AddTransactionForm
          accountId={selectedAccount.id}
          onSubmit={handleAddTransaction}
          onCancel={() => setShowAddTransaction(false)}
        />
      )}

      <main className="app-main">
        {accountDetail ? (
          <AccountDetail
            account={accountDetail}
            transactions={transactions}
            dashboardAccount={dashboardData?.accounts?.find(a => a.id === selectedAccount?.id)}
            onAddEmail={handleAddEmail}
            onRemoveEmail={handleRemoveEmail}
            onToggleAccount={handleToggleAccount}
            onDeleteAccount={handleDeleteAccount}
          />
        ) : (
          <div className="loading-state">
            <div className="spinner" />
            <p>กำลังโหลดข้อมูล...</p>
          </div>
        )}
      </main>
    </div>
  );
}
