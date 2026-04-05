# Video Footage Analyzer - วิเคราะห์วิดีโอร้านอาหาร

Web app สำหรับวิเคราะห์และจัดหมวดหมู่ footage วิดีโอร้านอาหารด้วย Gemini AI

## Features

- ดึงวิดีโอจาก Google Drive folder อัตโนมัติ
- วิเคราะห์ด้วย Gemini 2.0: ชื่อเมนู, ประเภทฉาก, confidence score
- Review UI: เล่นวิดีโอ, ดูผล AI, ยืนยัน/แก้ไข/ตัดทิ้ง
- Progress tracking แบบ real-time
- Export รายงาน JSON/CSV

## Tech Stack

- **Backend**: Node.js + Express + SQLite (better-sqlite3)
- **Frontend**: React
- **AI**: Google Gemini 2.0 Flash
- **Storage**: Google Drive API

## Quick Start

```bash
# 1. Install dependencies
npm run install:all

# 2. Set up environment
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys

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
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | Path to Google service account JSON |
| `GOOGLE_DRIVE_FOLDER_ID` | Google Drive folder containing videos |
| `GEMINI_API_KEY` | Google Gemini API key |
| `PORT` | Backend port (default: 3001) |

## Mock Mode

หากไม่ได้ตั้งค่า API keys ระบบจะทำงานใน mock mode โดยใช้ข้อมูลจำลองเพื่อทดสอบ UI

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/projects` | List projects |
| POST | `/api/projects` | Create project |
| POST | `/api/projects/:id/sync` | Sync clips from Drive |
| GET | `/api/clips/project/:id` | List clips |
| POST | `/api/clips/:id/analyze` | Analyze single clip |
| POST | `/api/clips/project/:id/analyze-all` | Analyze all clips |
| POST | `/api/clips/:id/review` | Review a clip |
| GET | `/api/export/project/:id/json` | Export JSON report |
| GET | `/api/export/project/:id/csv` | Export CSV report |
| GET | `/api/export/project/:id/stats` | Get progress stats |
