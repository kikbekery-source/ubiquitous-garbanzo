# รายงานตรวจทานระบบหลังบ้าน (Backend Review) — Video Footage Analyzer

วันที่ตรวจ: 1 กรกฎาคม 2026
ขอบเขต: โค้ดทั้งหมดใน `backend/` ของ repo นี้ (Node.js + Express + SQLite) รวมถึงการรันทดสอบจริงใน mock mode

> **หมายเหตุเรื่อง fastup-academy.com**: เว็บ fastup-academy.com เป็นแพลตฟอร์มขายฝาก-จำนอง ซึ่ง**โค้ดของเว็บนั้นไม่ได้อยู่ใน repo นี้** — repo นี้มีเฉพาะระบบวิเคราะห์วิดีโอร้านอาหาร (Video Footage Analyzer) รายงานนี้จึงครอบคลุมเฉพาะระบบหลังบ้านใน repo นี้เท่านั้น หากต้องการให้ตรวจระบบหลังบ้านของ fastup-academy.com โดยตรง ต้องเชื่อมต่อ repo ของเว็บนั้นเข้ามาในเซสชันก่อน

---

## สรุปผู้บริหาร

ระบบมีโครงสร้างที่ดี เขียนสะอาด และรันได้จริงใน mock mode (ทดสอบแล้วทุก endpoint) แต่**ยังไม่พร้อมใช้งานจริง**ด้วยเหตุผลหลัก 3 ข้อ:

1. **ฟีเจอร์หลักยังไม่ทำงานจริง** — ระบบอ้างว่า "วิเคราะห์วิดีโอด้วย Gemini" แต่จริง ๆ แล้วส่งให้ Gemini แค่**ชื่อไฟล์กับความยาว** ไม่ได้ส่งตัววิดีโอเลย ผลวิเคราะห์จึงเป็นการเดาจากชื่อไฟล์
2. **ไม่มีระบบยืนยันตัวตนเลย** — ใครก็ตามที่เข้าถึง server ได้ สามารถลบโปรเจกต์ หรือสั่งวิเคราะห์รัว ๆ จนเปลืองโควต้า Gemini API ได้
3. **มีบั๊กที่ยืนยันแล้วจากการทดสอบจริง** — เช่น export CSV พังทันที (HTTP 500) เมื่อชื่อโปรเจกต์เป็นภาษาไทย ซึ่งเป็น use case หลักของระบบนี้

---

## จุดแข็ง

- **โครงสร้างโค้ดชัดเจน** — แยก `routes/`, `services/`, `db/` เป็นสัดส่วน อ่านง่าย ขยายต่อได้
- **ปลอดภัยจาก SQL injection** — ใช้ prepared statements ทุกจุด ไม่มีการต่อ string เข้า SQL จากข้อมูลผู้ใช้เลย
- **ออกแบบฐานข้อมูลดี** — เปิด WAL mode, foreign keys, มี index ครบ, มี CHECK constraints บนคอลัมน์สถานะ, ใช้ ON DELETE CASCADE ถูกต้อง
- **ใช้ transaction ตอน sync** — การ sync คลิปจาก Drive ทำใน transaction เดียว ข้อมูลไม่พังครึ่งทาง
- **Review ใช้ upsert (`ON CONFLICT`)** — แก้ผลรีวิวซ้ำได้โดยไม่เกิด row ซ้ำ
- **Mock mode ใช้งานได้จริง** — ไม่มี API key ก็พัฒนา/ทดสอบ UI ได้ครบวงจร (ทดสอบแล้ว: สร้างโปรเจกต์ → sync → analyze-all → stats → review ผ่านหมด)
- **CSV ใส่ BOM** — คิดถึงการเปิดไฟล์ภาษาไทยใน Excel แล้ว (แม้ escaping ยังมีปัญหา ดูด้านล่าง)

---

## บั๊กที่ยืนยันแล้วจากการทดสอบจริง

### B1 — Export CSV พัง (HTTP 500) เมื่อชื่อโปรเจกต์เป็นภาษาไทย 🔴

`backend/src/routes/export.js:82` ใส่ชื่อโปรเจกต์ลงใน header ตรง ๆ:

```js
res.setHeader('Content-Disposition', `attachment; filename="${project.name}_report.csv"`);
```

HTTP header รับได้เฉพาะอักขระ Latin-1 → ชื่อไทยทำให้ Node โยน `ERR_INVALID_CHAR` และผู้ใช้ได้หน้า HTML error แทนไฟล์ CSV ทดสอบยืนยันแล้วกับโปรเจกต์ชื่อ "ทดสอบ"

**วิธีแก้**: ใช้รูปแบบ RFC 5987 — `filename="report.csv"; filename*=UTF-8''${encodeURIComponent(project.name)}_report.csv`

### B2 — Review รับค่า `finalSceneType` อะไรก็ได้ 🟠

`backend/src/routes/clips.js:136-162` validate เฉพาะ `decision` แต่ไม่ validate `finalSceneType`/`finalMenuName` เลย และตาราง `reviews` ก็ไม่มี CHECK constraint บน `final_scene_type` (ต่างจากตาราง `analyses` ที่มี) ทดสอบยืนยันแล้ว: ส่งค่า `"ประเภทมั่ว"` เข้าไปได้สำเร็จ → ข้อมูลสกปรกจะหลุดไปถึงรายงาน export และตัวเลข sceneBreakdown จะนับไม่ครบ

---

## ส่วนที่ยังไม่สมบูรณ์ (Critical)

### C1 — Gemini ไม่เคยเห็นตัววิดีโอจริง 🔴 (ช่องว่างใหญ่ที่สุดของระบบ)

`backend/src/services/geminiAnalyzer.js:24-44` — prompt เขียนว่า "กรุณาวิเคราะห์วิดีโอนี้" แต่สิ่งที่ส่งไปมีแค่ **ชื่อไฟล์และความยาว** ผลลัพธ์ที่ได้จึงเป็นการเดาจากชื่อไฟล์ ไม่ใช่การวิเคราะห์ภาพจริง ทั้งที่ `googleDrive.js` มีเมธอด `getFileStream()` เตรียมไว้แล้วแต่**ไม่มีใครเรียกใช้เลย** และ confidence score ที่แสดงให้ผู้รีวิวดูจึงไม่มีความหมายจริง

**วิธีแก้**: ดาวน์โหลดวิดีโอจาก Drive (มี `getFileStream` อยู่แล้ว) → อัปโหลดเข้า Gemini Files API → รอสถานะ ACTIVE → เรียก `generateContent` พร้อมไฟล์วิดีโอ + ตั้ง `responseMimeType: 'application/json'` พร้อม `responseSchema` เพื่อบังคับรูปแบบคำตอบ (เลิกใช้การ strip markdown ด้วย regex)

### C2 — ไม่มี Authentication / Authorization เลย 🔴

ทุก endpoint เปิด public และ `cors()` เปิดกว้างทุก origin (`backend/src/index.js:13`) ถ้า deploy จริง:
- ใครก็ลบโปรเจกต์ได้ (`DELETE /api/projects/:id` ลบ cascade ทุกอย่างถาวร ไม่มี confirm/soft-delete)
- ใครก็สั่ง `analyze-all` รัว ๆ ได้ = เผาโควต้า/เงินค่า Gemini API

### C3 — `analyze-all` ทำงานแบบ synchronous ใน request เดียว 🔴

`backend/src/routes/clips.js:95-133` วนวิเคราะห์ทีละคลิปแล้วค่อยตอบ:
- คลิปเยอะ ๆ (เช่น 200 คลิป × คลิปละหลายวินาที) → request timeout แน่นอน โดยเฉพาะเมื่อแก้ C1 ให้อัปโหลดวิดีโอจริง
- README โฆษณา "Progress tracking แบบ real-time" แต่ทำจริงไม่ได้เพราะ request ค้างจนจบ
- **ไม่มีการกันกดซ้ำ** — ยิง analyze-all ซ้อน 2 ครั้ง จะวิเคราะห์คลิปเดิมซ้ำ (query กรองเฉพาะ `pending`/`failed` แต่ race ระหว่างอ่านกับอัปเดตสถานะยังเกิดได้ และคลิปที่ค้างสถานะ `analyzing` จากการ crash จะไม่ถูกหยิบมาทำใหม่ตลอดกาล)
- ไม่มี rate limiting ต่อ Gemini API

### C4 — ไม่ validate คำตอบจาก Gemini 🟠

`geminiAnalyzer.js:49-56` — ถ้า Gemini ตอบ `scene_type` นอกเหนือ 4 ค่าที่กำหนด SQLite CHECK จะโยน error ตอน UPDATE → คลิปกลายเป็น `failed` พร้อม error message ที่อ่านไม่รู้เรื่อง และถ้า `confidence_score` หายไป `Math.min(1, Math.max(0, undefined))` = `NaN` ถูกบันทึกลง DB

### C5 — Sync จาก Drive ไม่ครบวงจร 🟠

`backend/src/services/googleDrive.js:28-50`:
- **ไม่มี pagination** — `pageSize: 200` ครั้งเดียว โฟลเดอร์ที่มีวิดีโอเกิน 200 ไฟล์จะ sync ไม่ครบแบบเงียบ ๆ
- **ไม่จัดการไฟล์ที่ถูกลบ/เปลี่ยนชื่อใน Drive** — sync เป็น insert-only คลิปผี (ลบจาก Drive แล้ว) ค้างใน DB ตลอด
- **`thumbnailLink` ของ Google Drive หมดอายุ (~1 ชั่วโมง)** แต่ถูกเก็บลง DB ถาวร → thumbnail ใน UI พังหลังผ่านไปชั่วโมงเดียว

### C6 — Race ตอน start server 🟠

`backend/src/index.js:20-24` — init services เป็น async IIFE โดยไม่รอให้เสร็จก่อน `app.listen` ถ้า request `sync` เข้ามาก่อน `driveService.init()` เสร็จ `this.drive` ยังเป็น `null` → crash และถ้า init ล้มเหลวจะเป็น unhandled rejection เงียบ ๆ

---

## จุดอ่อนระดับรอง (Medium)

| # | ปัญหา | ตำแหน่ง |
|---|-------|---------|
| M1 | ไม่มี global error handler — error ที่หลุดจาก route ได้หน้า HTML 500 ของ Express แทน JSON | `index.js` |
| M2 | CSV escaping ผิดหลัก — แทน comma ด้วย `;` เฉพาะช่อง notes แต่ชื่อไฟล์/ชื่อเมนูที่มี comma, quote, ขึ้นบรรทัดใหม่ จะทำให้คอลัมน์เลื่อน ควร quote ทุก field ตามมาตรฐาน CSV | `export.js:67-79` |
| M3 | Health check รายงาน `database: 'connected'` แบบ hardcode ไม่ได้เช็คจริง | `index.js:41` |
| M4 | `multer` อยู่ใน dependencies แต่ไม่ถูกใช้เลย และเวอร์ชัน 1.x มีช่องโหว่ที่เปิดเผยแล้ว — ควรถอดออก | `backend/package.json` |
| M5 | ไม่มี graceful shutdown — ไม่ `db.close()` / WAL checkpoint ตอนปิด process | `index.js` |
| M6 | UI ซ้ำ 2 ชุด (standalone HTML ใน `backend/src/public/` + React ใน `frontend/`) เสี่ยง logic เพี้ยนไม่ตรงกัน และ README ไม่กล่าวถึง standalone UI เลย | — |
| M7 | ไม่มี input validation กลาง (เช่น รูปแบบ `driveFolderId`), ไม่มี rate limiting, ไม่มี security headers (helmet) | routes ทั้งหมด |
| M8 | **ไม่มี test แม้แต่ไฟล์เดียว** ไม่มี CI ไม่มี lint | ทั้ง repo |
| M9 | `projects.updated_at` ไม่เคยถูกอัปเดตหลัง insert | schema/routes |
| M10 | `GET /api/clips/project/:id` เมื่อกรอง `?status=` จะตัดคลิปที่ยังไม่มีแถว analysis ทิ้งเงียบ ๆ (LEFT JOIN + WHERE บนคอลัมน์ฝั่งขวา) | `clips.js:23-25` |

---

## แผนการแก้ให้สมบูรณ์

### เฟส 1 — ทำให้ฟีเจอร์หลัก "ทำงานจริง" และแก้บั๊กที่ยืนยันแล้ว (ประมาณ 3–5 วัน)

1. **ส่งวิดีโอจริงให้ Gemini** (C1) — ต่อท่อ `getFileStream()` → Gemini Files API → `generateContent` พร้อม `responseSchema` บังคับ JSON
2. **Validate คำตอบ Gemini** (C4) — whitelist `scene_type`, ตรวจ `confidence_score` เป็นตัวเลข 0–1, fallback เป็น `other`/null พร้อม log
3. **แก้ CSV header ภาษาไทย** (B1) — ใช้ `filename*=UTF-8''...` ตาม RFC 5987
4. **Validate review input** (B2) — whitelist `finalSceneType` + เพิ่ม CHECK constraint ในตาราง `reviews`
5. **รอ services init เสร็จก่อน listen** (C6) — ย้าย `app.listen` เข้าไปหลัง `await init()` และ fail-fast ถ้า init พัง
6. **เพิ่ม global error handler** (M1) — middleware ตอบ JSON 500 เสมอสำหรับ `/api/*`

### เฟส 2 — พร้อมใช้งานจริง (Production-ready) (ประมาณ 1–2 สัปดาห์)

1. **Authentication** (C2) — อย่างน้อย API key ผ่าน header สำหรับทีมภายใน + จำกัด CORS เป็น whitelist
2. **เปลี่ยน analyze-all เป็น background job** (C3) — คิวใน process (เช่น p-queue จำกัด concurrency 2–3), endpoint ตอบทันทีพร้อม job id, ให้ frontend poll `/stats` ดู progress จริง, กันกดซ้ำด้วยการเช็คสถานะ `analyzing` + reset คลิปที่ค้าง `analyzing` ตอน start server
3. **Sync ให้ครบวงจร** (C5) — วน `nextPageToken` จนหมด, mark คลิปที่หายจาก Drive เป็น `removed`, เพิ่ม endpoint proxy thumbnail (ดึงสดผ่าน service account) แทนการเก็บ URL ที่หมดอายุ
4. **CSV escaping ตามมาตรฐาน** (M2) — quote ทุก field, escape `"` เป็น `""`
5. **Validation layer + hardening** (M7) — zod/joi validate ทุก request body, `express-rate-limit`, `helmet`
6. **ถอด multer**, เพิ่ม graceful shutdown, health check เช็ค DB จริง (M3–M5)
7. **Soft-delete โปรเจกต์** (หรืออย่างน้อย require confirmation token) แทนลบ cascade ถาวร (M9 ด้วย: อัปเดต `updated_at`)

### เฟส 3 — คุณภาพระยะยาว (ต่อเนื่อง)

1. **เขียน test** — unit test สำหรับ services (mock Gemini/Drive) + integration test ทุก route ด้วย supertest บน SQLite in-memory
2. **CI** — GitHub Actions รัน lint + test ทุก PR
3. **ยุบ UI เหลือชุดเดียว** — เลือก React frontend เป็นหลัก แล้ว build ลง `backend/src/public` ตอน deploy (M6)
4. **Structured logging** — pino/winston แทน console.log เพื่อ debug ปัญหา production ได้
5. **สำรองฐานข้อมูล** — cron backup ไฟล์ SQLite + เอกสารการ restore

---

## วิธีทดสอบที่ใช้ในการตรวจครั้งนี้

รัน backend ใน mock mode แล้วยิงทดสอบจริง: health check → สร้างโปรเจกต์ (ชื่อไทย) → sync (ได้ 5 คลิป mock) → analyze-all (สำเร็จ 5 คลิป) → stats → review (ทั้งค่าปกติและค่ามั่ว) → export JSON (ผ่าน) → export CSV (**พัง 500** — บั๊ก B1)
