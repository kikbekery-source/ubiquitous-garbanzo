/* ─── Email Assistant - Frontend JavaScript ─── */

let currentAnalysis = null;
let allAnalyzedEmails = [];

// ─── Navigation ──────────────────────────────────────

function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');

    // Load data for page
    if (page === 'accounts') loadAccounts();
    if (page === 'memory') loadMemory();
    if (page === 'settings') loadConfig();
    if (page === 'logs') loadLogs();
}

// ─── Toast Notifications ─────────────────────────────

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// ─── API Helper ──────────────────────────────────────

async function api(url, method = 'GET', body = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }
    return data;
}

// ─── Accounts ────────────────────────────────────────

async function loadAccounts() {
    try {
        const accounts = await api('/api/accounts');
        const list = document.getElementById('accountsList');

        if (accounts.length === 0) {
            list.innerHTML = '<p style="color:var(--text2);">ยังไม่มีบัญชีอีเมล กรุณาเพิ่มบัญชี</p>';
            document.getElementById('statAccounts').textContent = '0';
            return;
        }

        document.getElementById('statAccounts').textContent = accounts.length;

        list.innerHTML = accounts.map(acc => `
            <div class="account-item">
                <div class="account-info">
                    <span class="provider-badge provider-${acc.provider}">${acc.provider}</span>
                    <span>${acc.email}</span>
                </div>
                <button class="btn btn-danger btn-sm" onclick="removeAccount('${acc.email}')">
                    ✕ ลบ
                </button>
            </div>
        `).join('');
    } catch (e) {
        showToast('โหลดบัญชีไม่สำเร็จ: ' + e.message, 'error');
    }
}

async function addAccount() {
    const provider = document.getElementById('addProvider').value;
    const email = document.getElementById('addEmail').value.trim();
    const password = document.getElementById('addPassword').value;

    if (!email || !password) {
        showToast('กรุณากรอกอีเมลและรหัสผ่าน', 'error');
        return;
    }

    const btn = document.getElementById('btnAddAccount');
    btn.disabled = true;
    btn.textContent = '⏳ กำลังเชื่อมต่อ...';

    try {
        await api('/api/accounts', 'POST', { provider, email, password });
        showToast('เพิ่มบัญชี ' + email + ' สำเร็จ!', 'success');
        document.getElementById('addEmail').value = '';
        document.getElementById('addPassword').value = '';
        loadAccounts();
    } catch (e) {
        showToast('เพิ่มบัญชีไม่สำเร็จ: ' + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '🔐 เชื่อมต่อและเพิ่มบัญชี';
    }
}

async function removeAccount(email) {
    if (!confirm(`ต้องการลบบัญชี ${email} ใช่หรือไม่?`)) return;
    try {
        await api(`/api/accounts/${encodeURIComponent(email)}`, 'DELETE');
        showToast('ลบบัญชีสำเร็จ', 'success');
        loadAccounts();
    } catch (e) {
        showToast('ลบบัญชีไม่สำเร็จ: ' + e.message, 'error');
    }
}

// ─── Email Analysis ──────────────────────────────────

async function runAnalysis() {
    const loading = document.getElementById('analysisLoading');
    const summary = document.getElementById('summaryBox');
    loading.classList.add('active');
    summary.style.display = 'none';

    try {
        const result = await api('/api/emails/analyze', 'POST', { since_days: 1 });
        currentAnalysis = result.analysis;
        allAnalyzedEmails = result.analysis.emails || [];

        // Update summary
        summary.textContent = result.analysis.summary || 'ไม่มีสรุป';
        summary.style.display = 'block';

        // Update stats
        document.getElementById('statEmails').textContent = result.email_count || 0;
        document.getElementById('statImportant').textContent =
            (result.analysis.important_indices || []).length;
        document.getElementById('statSpam').textContent =
            (result.analysis.spam_indices || []).length;

        // Show important emails
        renderImportantEmails(result.analysis);

        // Render all emails on emails page
        renderEmailList(allAnalyzedEmails);

        showToast(`วิเคราะห์ ${result.email_count} อีเมลเรียบร้อย`, 'success');
    } catch (e) {
        summary.textContent = '❌ เกิดข้อผิดพลาด: ' + e.message;
        summary.style.display = 'block';
        showToast('วิเคราะห์ไม่สำเร็จ: ' + e.message, 'error');
    } finally {
        loading.classList.remove('active');
    }
}

function renderImportantEmails(analysis) {
    const card = document.getElementById('importantEmailsCard');
    const list = document.getElementById('importantEmailsList');
    const important = (analysis.emails || []).filter(e => e.priority === 'high');

    if (important.length === 0) {
        card.style.display = 'none';
        return;
    }

    card.style.display = 'block';
    list.innerHTML = important.map(em => renderEmailItem(em)).join('');
}

function renderEmailItem(em) {
    const orig = em.original || {};
    const priorityClass = em.is_spam ? 'is-spam' : `priority-${em.priority || 'low'}`;

    return `
        <div class="email-item ${priorityClass}">
            <div class="email-header">
                <div>
                    <div class="email-subject">${escapeHtml(orig.subject || 'No subject')}</div>
                    <div class="email-from">${escapeHtml(orig.from || 'Unknown')}</div>
                </div>
                <div class="email-date">${formatDate(orig.date)}</div>
            </div>
            <div class="email-summary">${escapeHtml(em.brief_summary || '')}</div>
            <div class="email-tags">
                <span class="tag tag-category">${em.category || 'other'}</span>
                ${em.priority === 'high' ? '<span class="tag tag-important">สำคัญ</span>' : ''}
                ${em.is_spam ? '<span class="tag tag-spam">สแปม</span>' : ''}
                ${em.action_needed && em.action_needed !== 'null' && em.action_needed !== '-'
                    ? `<span class="tag tag-action">${escapeHtml(em.action_needed)}</span>` : ''}
            </div>
        </div>
    `;
}

function renderEmailList(emails) {
    const list = document.getElementById('emailsList');
    if (!emails || emails.length === 0) {
        list.innerHTML = '<p style="color:var(--text2);">ไม่มีอีเมลที่วิเคราะห์แล้ว</p>';
        return;
    }
    list.innerHTML = emails.map(em => renderEmailItem(em)).join('');
}

function filterEmails() {
    const filter = document.getElementById('emailFilter').value;
    let filtered = allAnalyzedEmails;

    if (filter === 'important') {
        filtered = allAnalyzedEmails.filter(e => e.priority === 'high');
    } else if (filter === 'normal') {
        filtered = allAnalyzedEmails.filter(e => !e.is_spam && e.priority !== 'high');
    } else if (filter === 'spam') {
        filtered = allAnalyzedEmails.filter(e => e.is_spam);
    }

    renderEmailList(filtered);
}

async function deleteAllSpam() {
    if (!currentAnalysis) {
        showToast('กรุณาวิเคราะห์อีเมลก่อน', 'error');
        return;
    }

    const spamEmails = (currentAnalysis.emails || [])
        .filter(e => e.is_spam && e.original)
        .map(e => ({ account: e.original.account, id: e.original.id }));

    if (spamEmails.length === 0) {
        showToast('ไม่พบอีเมลขยะ', 'info');
        return;
    }

    if (!confirm(`ต้องการลบอีเมลขยะ ${spamEmails.length} ฉบับ ใช่หรือไม่?`)) return;

    try {
        await api('/api/emails/delete-spam', 'POST', { spam: spamEmails });
        showToast(`ลบอีเมลขยะ ${spamEmails.length} ฉบับสำเร็จ`, 'success');
    } catch (e) {
        showToast('ลบไม่สำเร็จ: ' + e.message, 'error');
    }
}

// ─── Daily Job ───────────────────────────────────────

async function runDailyJob() {
    showToast('กำลังรันงานประจำวัน...', 'info');
    try {
        const result = await api('/api/run-daily', 'POST');
        if (result.success) {
            showToast('รันงานประจำวันสำเร็จ! สรุปถูกส่งผ่าน Telegram', 'success');
            if (result.result && typeof result.result === 'object') {
                currentAnalysis = result.result;
                allAnalyzedEmails = result.result.emails || [];
                document.getElementById('summaryBox').textContent =
                    result.result.summary || 'เสร็จสิ้น';
            }
        } else {
            showToast('งานประจำวันล้มเหลว: ' + JSON.stringify(result.result), 'error');
        }
    } catch (e) {
        showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
    }
}

// ─── Memory ──────────────────────────────────────────

async function loadMemory() {
    try {
        const memory = await api('/api/memory');
        const display = document.getElementById('memoryDisplay');

        // Fill owner fields
        if (memory.owner) {
            document.getElementById('ownerName').value = memory.owner.name || '';
            document.getElementById('ownerJob').value = memory.owner.job || '';
            document.getElementById('ownerNotes').value = memory.owner.notes || '';
        }

        let html = '';

        if (memory.owner && memory.owner.last_insight) {
            html += `<div class="memory-section">
                <h4>💡 ข้อมูลเชิงลึกล่าสุด</h4>
                <pre>${escapeHtml(memory.owner.last_insight)}</pre>
            </div>`;
        }

        if (memory.important_senders && memory.important_senders.length > 0) {
            html += `<div class="memory-section">
                <h4>⭐ ผู้ส่งสำคัญ (${memory.important_senders.length} คน)</h4>
                <pre>${memory.important_senders.map(s => escapeHtml(s)).join('\n')}</pre>
            </div>`;
        }

        if (memory.spam_senders && memory.spam_senders.length > 0) {
            html += `<div class="memory-section">
                <h4>🚫 ผู้ส่งสแปม (${memory.spam_senders.length} แหล่ง)</h4>
                <pre>${memory.spam_senders.map(s => escapeHtml(s)).join('\n')}</pre>
            </div>`;
        }

        if (memory.email_patterns && Object.keys(memory.email_patterns).length > 0) {
            const top = Object.entries(memory.email_patterns).slice(0, 10);
            html += `<div class="memory-section">
                <h4>📊 ผู้ส่งบ่อยที่สุด</h4>
                <pre>${top.map(([k, v]) => `${escapeHtml(k)}: ${v} ครั้ง`).join('\n')}</pre>
            </div>`;
        }

        if (memory.interaction_history && memory.interaction_history.length > 0) {
            const last = memory.interaction_history[memory.interaction_history.length - 1];
            html += `<div class="memory-section">
                <h4>🕐 การวิเคราะห์ครั้งล่าสุด</h4>
                <pre>วันที่: ${last.date}
อีเมลที่ประมวลผล: ${last.emails_processed}
สแปมที่พบ: ${last.spam_found}
สำคัญที่พบ: ${last.important_found}</pre>
            </div>`;
        }

        if (!html) {
            html = '<p style="color:var(--text2);">ยังไม่มีข้อมูลในหน่วยความจำ AI จะเรียนรู้จากการวิเคราะห์อีเมลของคุณ</p>';
        }

        display.innerHTML = html;
    } catch (e) {
        showToast('โหลดหน่วยความจำไม่สำเร็จ: ' + e.message, 'error');
    }
}

async function saveOwnerInfo() {
    const name = document.getElementById('ownerName').value.trim();
    const job = document.getElementById('ownerJob').value.trim();
    const notes = document.getElementById('ownerNotes').value.trim();

    try {
        await api('/api/memory/owner', 'POST', { name, job, notes });
        showToast('บันทึกข้อมูลเจ้าของสำเร็จ', 'success');
        loadMemory();
    } catch (e) {
        showToast('บันทึกไม่สำเร็จ: ' + e.message, 'error');
    }
}

async function resetMemory() {
    if (!confirm('ต้องการรีเซ็ตหน่วยความจำ AI ทั้งหมด? ข้อมูลทั้งหมดที่ AI เรียนรู้จะหายไป')) return;
    try {
        await api('/api/memory/reset', 'POST');
        showToast('รีเซ็ตหน่วยความจำสำเร็จ', 'success');
        loadMemory();
    } catch (e) {
        showToast('รีเซ็ตไม่สำเร็จ: ' + e.message, 'error');
    }
}

// ─── Settings ────────────────────────────────────────

async function loadConfig() {
    try {
        const config = await api('/api/config');
        const geminiStatus = document.getElementById('geminiStatus');
        const telegramStatus = document.getElementById('telegramStatus');

        if (config.gemini_configured) {
            geminiStatus.textContent = '✅ กำหนดค่าแล้ว: ' + (config.gemini_api_key || '');
            geminiStatus.style.color = 'var(--green)';
        } else {
            geminiStatus.textContent = '⚠️ ยังไม่ได้กำหนดค่า';
            geminiStatus.style.color = 'var(--yellow)';
        }

        if (config.telegram_configured) {
            telegramStatus.textContent = '✅ กำหนดค่าแล้ว';
            telegramStatus.style.color = 'var(--green)';
            document.getElementById('telegramChatId').value = config.telegram_chat_id || '';
        } else {
            telegramStatus.textContent = '⚠️ ยังไม่ได้กำหนดค่า';
            telegramStatus.style.color = 'var(--yellow)';
        }

        document.getElementById('schedulerTime').value = config.scheduler_time || '08:00';
    } catch (e) {
        console.error('Load config error:', e);
    }
}

async function saveGeminiKey() {
    const key = document.getElementById('geminiApiKey').value.trim();
    if (!key) {
        showToast('กรุณากรอก API Key', 'error');
        return;
    }
    try {
        await api('/api/config', 'POST', { gemini_api_key: key });
        showToast('บันทึก Gemini API Key สำเร็จ', 'success');
        document.getElementById('geminiApiKey').value = '';
        loadConfig();
    } catch (e) {
        showToast('บันทึกไม่สำเร็จ: ' + e.message, 'error');
    }
}

async function saveTelegramConfig() {
    const token = document.getElementById('telegramToken').value.trim();
    const chatId = document.getElementById('telegramChatId').value.trim();
    if (!token || !chatId) {
        showToast('กรุณากรอก Bot Token และ Chat ID', 'error');
        return;
    }
    try {
        await api('/api/config', 'POST', {
            telegram_bot_token: token,
            telegram_chat_id: chatId,
        });
        showToast('บันทึกการตั้งค่า Telegram สำเร็จ', 'success');
        document.getElementById('telegramToken').value = '';
        loadConfig();
    } catch (e) {
        showToast('บันทึกไม่สำเร็จ: ' + e.message, 'error');
    }
}

async function testTelegram() {
    const token = document.getElementById('telegramToken').value.trim();
    const chatId = document.getElementById('telegramChatId').value.trim();
    if (!token || !chatId) {
        showToast('กรุณากรอก Bot Token และ Chat ID', 'error');
        return;
    }
    try {
        const result = await api('/api/config/test-telegram', 'POST', {
            bot_token: token,
            chat_id: chatId,
        });
        if (result.success) {
            showToast('ส่งข้อความทดสอบสำเร็จ! ตรวจสอบ Telegram ของคุณ', 'success');
            loadConfig();
        } else {
            showToast('ทดสอบไม่สำเร็จ: ' + result.message, 'error');
        }
    } catch (e) {
        showToast('ทดสอบไม่สำเร็จ: ' + e.message, 'error');
    }
}

async function saveSchedulerTime() {
    const time = document.getElementById('schedulerTime').value;
    try {
        await api('/api/config', 'POST', { scheduler_time: time });
        showToast(`ตั้งเวลาสรุปรายวันเป็น ${time} น. สำเร็จ`, 'success');
    } catch (e) {
        showToast('บันทึกไม่สำเร็จ: ' + e.message, 'error');
    }
}

// ─── Logs ────────────────────────────────────────────

async function loadLogs() {
    try {
        const logs = await api('/api/scheduler-logs');
        const list = document.getElementById('logsList');

        if (logs.length === 0) {
            list.innerHTML = '<p style="color:var(--text2);">ยังไม่มีประวัติการทำงาน</p>';
            return;
        }

        list.innerHTML = logs.reverse().map(log => `
            <div class="log-item">
                <span class="log-status log-${log.status}">${log.status}</span>
                <span class="log-time">${formatDate(log.timestamp)}</span>
                <span>${escapeHtml(log.details || '')}</span>
            </div>
        `).join('');
    } catch (e) {
        showToast('โหลดประวัติไม่สำเร็จ: ' + e.message, 'error');
    }
}

// ─── Utility ─────────────────────────────────────────

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        return d.toLocaleString('th-TH', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    } catch {
        return dateStr;
    }
}

// ─── Initialize ──────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    loadAccounts();
    loadConfig();

    // Load last analysis if available
    api('/api/last-analysis').then(data => {
        if (data.analysis) {
            currentAnalysis = data.analysis;
            allAnalyzedEmails = data.analysis.emails || [];
            document.getElementById('summaryBox').textContent =
                data.analysis.summary || 'กดวิเคราะห์เพื่อเริ่มต้น';
            document.getElementById('statEmails').textContent = data.email_count || '-';
            document.getElementById('statImportant').textContent =
                (data.analysis.important_indices || []).length;
            document.getElementById('statSpam').textContent =
                (data.analysis.spam_indices || []).length;
            renderImportantEmails(data.analysis);
            renderEmailList(allAnalyzedEmails);
        }
    }).catch(() => {});
});
