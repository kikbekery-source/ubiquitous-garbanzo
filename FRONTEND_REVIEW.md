# รายงานตรวจทานรอบ 2 — ฝั่งหน้าจอผู้ใช้ (Frontend) + จุดใหม่

วันที่: 1 กรกฎาคม 2026
ขอบเขต: `frontend/` (React) และ `backend/src/public/index.html` (หน้า HTML สำรอง) — ส่วนที่ยังไม่ได้ตรวจในรอบแรก (ดูรอบแรกที่ `BACKEND_REVIEW.md`)

> อินโฟกราฟิกอธิบายแบบเห็นภาพ (ภาษาไทย ไม่ใช้ศัพท์เทคนิค): [`docs/review-infographic.html`](docs/review-infographic.html) — เปิดในเบราว์เซอร์

---

## เรื่องการเข้าถึง (สำคัญ)

- ระบบรันในกล่องคลาวด์ที่แยกจากเครื่อง Mac ของผู้ใช้ จึง**อ่านไฟล์/memory/รหัสผ่านในเครื่องผู้ใช้ไม่ได้** และการตรวจโค้ดไม่จำเป็นต้องใช้รหัสผ่าน
- **โค้ดโปรเจกต์อสังหา (fastup-academy) ไม่ได้อยู่ใน repo นี้** — repo นี้มีเฉพาะ Video Footage Analyzer หากต้องการตรวจโค้ดอสังหาจริง ต้อง push โค้ดขึ้น repo ที่เข้าถึงได้
- fastup-academy.com เป็นเว็บ **PHP** (`app/login.php`, `app/register.php`, `app/submit.php`) — คนละ stack กับ repo นี้ (Node.js/React) ยืนยันว่า repo นี้ **ไม่ใช่** backend ของเว็บอสังหา

---

## จุดใหม่ที่ยืนยันจากโค้ดจริง (เรียงตามความรุนแรง)

### 🔴 F1 — XSS ในหน้า HTML สำรอง (อันตรายสูงสุด)
`backend/src/public/index.html` — `renderClipList()` (บรรทัด 371-390), `renderClipDetail()` (399-458), `loadProjects()` (286-297) สร้าง DOM ด้วย template string ใส่ `innerHTML` โดยฝังค่าที่ไม่น่าเชื่อถือแบบดิบ ไม่มีการ escape:
- `clip.filename` — มาจากชื่อไฟล์ใน Google Drive (ผู้ตั้งชื่อไฟล์ควบคุมได้)
- `menu_name`, `scene_type`, `error_message` — มาจากผลลัพธ์ของ Gemini
- `p.name` — มาจาก input ผู้ใช้ (บรรทัด 288 การ escape ใน `onclick` จัดการเฉพาะ single quote ไม่ครอบคลุม `"`/`\`/`</script>`)

ไฟล์ชื่อ `<img src=x onerror=...>.mp4` จะทำให้สคริปต์ทำงานในเบราว์เซอร์ของผู้รีวิว (DOM-based / stored XSS)
**แก้**: escape ทุกค่าก่อนแสดง (สร้าง element ด้วย `textContent`/`createElement` หรือ escape HTML) — หรือเลิกใช้หน้านี้แล้วไปใช้ React ที่กัน XSS ให้อัตโนมัติ

### 🟠 F2 — ช่อง "Gemini API Key" ไม่ทำงานจริง (หลอกตา)
`saveSettings()` (บรรทัด 259-266) เก็บ `gemini_key`/`drive_folder` ลง `localStorage` แต่ไม่มีจุดใดอ่าน `gemini_key` กลับไปส่งให้เซิร์ฟเวอร์ (เซิร์ฟเวอร์อ่านคีย์จาก `.env` ของตัวเองเท่านั้น) ข้อความยังยอมรับว่า "ต้อง restart server" → ผู้ใช้สับสน
**แก้**: เอาช่องออก หรือทำ endpoint รับคีย์จริง (พร้อมพิจารณาความปลอดภัยของการเก็บคีย์)

### 🟡 F3 — วิเคราะห์คลิปเดี่ยวแล้วหน้าจอโชว์ข้อมูลเก่า
`frontend/src/App.js:90-95` `handleAnalyzeClip` เรียก `await loadClips(...)` แล้วอ่าน `clips.find(...)` จากตัวแปร `clips` ที่เป็น closure เก่า (ยังไม่อัปเดต) → `setSelectedClip(updated)` ได้ข้อมูลเก่าหรือ `undefined`
**แก้**: ใช้ค่าที่ `loadClips` คืนมา — `const newClips = await loadClips(...); const updated = newClips.find(...)` (เหมือนที่ `handleReview` ทำถูกอยู่แล้ว)

### 🟡 F4 — Error ถูกกลืนเงียบ ผู้ใช้ไม่เห็นอะไร
`App.js:26` `catch (e) { /* ignore */ }`, `App.js:38` `catch (e) { return []; }` และ `useApi` เปิด `loading`/`error` ไว้แต่ App.js ไม่เคยอ่านมาแสดง → เน็ตหลุด/เซิร์ฟเวอร์ error แล้วหน้าจอเงียบสนิท
**แก้**: แสดง error state + loading indicator ในหน้าหลัก

### 🔵 F5 — ข้อความ error สับสนเมื่อ response ไม่ใช่ JSON
`frontend/src/hooks/useApi.js:18` เรียก `await res.json()` ก่อนเช็ค `res.ok` เมื่อเซิร์ฟเวอร์ตอบหน้า HTML error (เช่นบั๊ก CSV ชื่อไทยในรอบแรก) `res.json()` จะ throw `SyntaxError` แทน error ที่สื่อความหมาย
**แก้**: เช็ค `res.ok`/`content-type` ก่อน parse

### 🔵 F6 — สร้างโปรเจกต์โดยไม่ใส่ Folder ID ได้โปรเจกต์เสีย
`backend/src/public/index.html:306` `folderId = ... || 'default'` → สร้างโปรเจกต์ที่ `drive_folder_id = 'default'` ซึ่ง sync ไม่ได้ โดยไม่เตือน
**แก้**: บังคับกรอก หรือเตือนก่อนสร้าง

### ℹ️ F7 — iframe preview ใช้ string replace เปราะ
`frontend/src/components/ClipReview.js:52` `drive_web_view_link.replace('/view', '/preview')` ถ้า format ลิงก์ต่างไป จะได้ URL ผิดเงียบๆ

---

## จุดแข็งฝั่งหน้าจอ (ยังไม่ได้ชมในรอบแรก)

- ดีไซน์เป็นระบบ ใช้สีสื่อสถานะชัด (เขียว/เหลือง/แดง) แถบ progress เข้าใจง่าย
- ภาษาไทยครบทั้งหน้าจอ เหมาะกับผู้ใช้จริง
- หน้าจอ React ปลอดภัยจาก XSS โดยอัตโนมัติ (JSX escape ให้) — ต่างจากหน้า HTML สำรอง
- แยกคอมโพเนนต์ชัด (ProjectList/ClipList/ClipReview/ProgressBar) ขยายต่อง่าย
- มี responsive รองรับจอมือถือ
- ตัวกรองคลิปครบทุกสถานะ

---

## โปรเจกต์ที่เกี่ยวข้องแต่ไม่เชื่อมกัน

- **fastup-academy.com** (PHP, อสังหา, จัดการเงินจริง + PII → ต้องเข้ม PDPA/security) ↔ **repo นี้** (Node/React, เครื่องมือภายใน) — คนละ stack ไม่มีสายเชื่อม
- เว็บอสังหาใช้อีเมล `contact@propfund.co.th` + LINE `@propfund` — คนละชื่อกับโดเมน `fastup-academy.com` บ่งชี้ว่ามีหลายแบรนด์/โดเมน (fastup ↔ propfund) ควรทำเอกสารกลางว่าระบบไหนใช้ฐานข้อมูล/บัญชีผู้ใช้ร่วมกันหรือไม่

---

## จุดที่ยังสงสัย/ไม่ชัดเจน (ต้องการคำตอบจากเจ้าของระบบ)

1. จะใช้หน้าจอชุดไหน — React หรือ HTML สำรอง? (ตอนนี้ซ้อนกัน 2 ชุด และชุด HTML มี XSS)
2. ระบบเปิดสู่อินเทอร์เน็ตหรือใช้ในทีม? (ยังไม่มีระบบล็อกอินเลย)
3. Gemini ควรดูวิดีโอจริงหรือเดาจากชื่อไฟล์พอ? (รอบแรกชี้แล้วว่าเห็นแค่ชื่อไฟล์)
4. คอนเทนต์ที่วิเคราะห์คือ "ร้านอาหาร" หรือ "อสังหา"? (โค้ดทั้งหมดพูดถึงเมนูอาหาร แต่เรียกว่าโปรเจกต์อสังหา)
5. fastup-academy กับ propfund ใช้บัญชีผู้ใช้/ฐานข้อมูลร่วมกันไหม?
