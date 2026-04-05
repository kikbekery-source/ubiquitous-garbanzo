# Bank Transfer Alerts - ระบบแจ้งเตือนการโอนเงิน

ระบบ Dashboard สำหรับติดตามการโอนเงินเข้า-ออกบัญชีธนาคาร พร้อมแจ้งเตือนเกณฑ์ภาษีตามกฎหมายไทย

## Features

- เพิ่มและจัดการบัญชีธนาคารหลายบัญชี
- ผูกอีเมลกับแต่ละบัญชีเพื่อติดตามการแจ้งเตือน
- บันทึกรายการรับโอนเข้า/เบิกจ่าย พร้อมสรุปรายวัน
- **เกณฑ์ภาษีไทย** - ตรวจสอบตามกฎหมาย:
  - เกณฑ์ 1: รับโอนเข้า >= 3,000 ครั้ง/ปี
  - เกณฑ์ 2: รับโอนเข้า >= 400 ครั้ง + ยอดรวม >= 2,000,000 บาท/ปี
- **แถบพลังงาน** สีเขียว-เหลือง-แดง แสดงความใกล้เกณฑ์ภาษี
- แจ้งเตือนอัตโนมัติเมื่อใกล้ถึงเกณฑ์ (70%, 90%, เกิน)
- **แนะนำบัญชี** ที่ยังมีที่ว่างใช้งาน
- ปิดบัญชีอัตโนมัติเมื่อเกินเกณฑ์ เพื่อไม่ให้เข้าฐานภาษี
- Responsive รองรับทั้งมือถือและเดสก์ท็อป

## Tech Stack

- **Backend**: Node.js + Express + SQLite (better-sqlite3)
- **Frontend**: React 18
- **Database**: SQLite with WAL mode

## Quick Start

```bash
# 1. Install dependencies
npm run install:all

# 2. Set up environment
cp backend/.env.example backend/.env

# 3. Initialize database
npm run db:init

# 4. Start development
npm run dev:backend   # Terminal 1 - Backend on :3001
npm run dev:frontend  # Terminal 2 - Frontend on :3000
```

## Configuration

Edit `backend/.env`:

| Variable | Description |
|----------|-------------|
| `PORT` | Backend port (default: 3001) |
| `DB_PATH` | Database file path (default: ./data/bank_alerts.db) |

## API Endpoints

### Accounts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/accounts` | List all accounts with yearly stats |
| POST | `/api/accounts` | Create new account |
| GET | `/api/accounts/:id` | Get account detail with emails |
| PUT | `/api/accounts/:id` | Update account |
| DELETE | `/api/accounts/:id` | Delete account |
| POST | `/api/accounts/:id/emails` | Add email to account |
| DELETE | `/api/accounts/:id/emails/:emailId` | Remove email |

### Transactions
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/transactions/account/:id` | List transactions |
| POST | `/api/transactions` | Add transaction |
| POST | `/api/transactions/batch` | Batch add transactions |
| DELETE | `/api/transactions/:id` | Delete transaction |
| GET | `/api/transactions/summary/:id` | Daily summaries |

### Dashboard
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard` | Main dashboard data |
| GET | `/api/dashboard/alerts` | Get alerts |
| PUT | `/api/dashboard/alerts/:id/read` | Mark alert read |
| PUT | `/api/dashboard/alerts/read-all` | Mark all read |
| GET | `/api/dashboard/tax-settings` | Get tax settings |
| PUT | `/api/dashboard/tax-settings` | Update tax settings |

## Thai Tax Law Reference

ตาม พ.ร.บ. แก้ไขเพิ่มเติมประมวลรัษฎากร (ฉบับที่ 48) พ.ศ. 2562:

ธนาคารจะรายงานข้อมูลบัญชีให้กรมสรรพากร เมื่อเข้าเกณฑ์ **อย่างใดอย่างหนึ่ง**:

1. **ฝาก/รับโอนเข้า >= 3,000 ครั้ง/ปี** ต่อบัญชี
2. **ฝาก/รับโอนเข้า >= 400 ครั้ง + ยอดรวม >= 2,000,000 บาท/ปี** ต่อบัญชี

ข้อมูลที่ธนาคารรายงาน: ชื่อเจ้าของบัญชี, เลขประจำตัวผู้เสียภาษี, เลขที่บัญชี, จำนวนครั้งที่ฝาก, ยอดรวมที่ฝาก
