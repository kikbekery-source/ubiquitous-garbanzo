# 🔍 รายงานตรวจทานระบบหลังบ้าน — coach-kik.com/system/
> ตรวจเมื่อ: 1 ก.ค. 2026 · ครอบคลุม: ระบบหลังบ้านที่ใช้งานจริง (coach-kik.com/system/) + โค้ด Video Footage Analyzer ในรีโพนี้

---

## 1) ภาพรวมสิ่งที่ตรวจ

| ส่วน | เทคโนโลยี | สถานะ |
|---|---|---|
| Dashboard `/system/` | Static HTML + inline JS, โหลดข้อมูลจาก `/system/data/*.json` | 🟢 ใช้งานจริง |
| ข้อมูล 11 หน้า (home, rules, team, pages, factory, assets, preview, calendar, report, ads, seo) | JSON แก้มือ | 🟡 บางหน้ายังว่าง |
| รีพอร์ต Meta | `/ad/report-api.php` (PHP 7.4) | 🟡 followers/posts ใช้ได้ · engage/reach = 0 หมด |
| ระบบยิงแอด `/ad/` | PHP + session (มี login redirect) | 🟢 มี auth |
| คลังวิดีโอ (vault) | โดเมนแยก (xn--12c8buau7do9gl7e.com) | 🟢 คลิปเล่นได้ |
| Video Footage Analyzer (รีโพนี้) | Node.js + Express + SQLite + Gemini | 🔴 ยังไม่ deploy / ยังวิเคราะห์วิดีโอจริงไม่ได้ |

ปฏิทินมี **258 events** (posted 11 · scheduled 203 · pending 42 · done 1 · canceled 1) ช่วง 25 มิ.ย. – 15 ก.ค. 2026

---

## 2) 💪 จุดแข็ง

1. **โครงสร้างชัด แยกส่วนดี** — 11 หน้าจัดกลุ่ม ควบคุม/คอนเทนต์/วัดผล · แยก `/system/` ออกจากหน้าเว็บลูกค้าตามกฎเหล็กข้อ 1-2
2. **สถาปัตยกรรมเบา ทนทาน** — static HTML + JSON ไม่มี dependency ไม่มี build step แก้ง่าย โฮสต์ที่ไหนก็ได้
3. **มีวินัยการทำงานเป็นลายลักษณ์อักษร** — SYSTEM-RULES.md, log ต่อหน้า (`data/<หน้า>.json`), COMPASS.md — ระบบบันทึกงานครบ
4. **ปฏิทินโพสต์ทำงานได้จริง** — ฟิลเตอร์เพจ/ช่องทาง, ดูรายชั่วโมง, แจ้งเตือนเมื่อฟิลเตอร์ซ่อนโพสต์, คำนวณวันที่แบบ local time กัน timezone เพี้ยน (comment ในโค้ดระบุเหตุผลไว้ด้วย)
5. **รีพอร์ตดึงสดจาก Meta API ได้จริง** — followers และ posts7 มีข้อมูลครบ 8 เพจ พร้อมระบบเกรด A-D
6. **มี HTML escaping ในจุดแสดงผล** (`ce()`, `esc()`) และ error handling เวลาโหลด JSON ไม่ได้
7. **ฝั่งรีโพ:** SQL ใช้ parameterized query ทั้งหมด, schema มี CHECK constraint + foreign key + index ครบ, มี mock mode ให้ทดสอบ UI ได้โดยไม่ต้องมี API key

---

## 3) ⚠️ จุดอ่อน (เรียงตามความรุนแรง)

### 🔴 วิกฤต — ความปลอดภัย
| # | ปัญหา | ผลกระทบ |
|---|---|---|
| W1 | **`/system/` เปิด public ไม่มี login** (ทดสอบแล้ว: เข้าได้ทันที status 200) | คนนอกเห็นแผนคอนเทนต์ทั้งหมด, ตารางโพสต์ล่วงหน้า, ลิงก์คลิปก่อนเผยแพร่, โครงสร้างทีม, กฎภายใน |
| W2 | **`/ad/report-api.php` เปิด public** | เผย Facebook Page ID + สถิติทุกเพจให้คนนอก |
| W3 | **`SYSTEM-RULES.md` เข้าถึงได้ public** | เผยโครงสร้างเซิร์ฟเวอร์ (docroot `/kik/`), ขั้นตอนภายใน, ชื่อเครื่องมือ |
| W4 | **กฎข้อ 6 สั่งใช้ plain FTP** (ไม่เข้ารหัส) | รหัสผ่าน FTP วิ่งเป็น plain text — ดักได้ = ยึดเว็บได้ทั้งเว็บ |
| W5 | **PHP 7.4.33** ที่ `/ad/` — EOL ตั้งแต่ พ.ย. 2022 ไม่มี security patch แล้ว | ช่องโหว่ที่รู้จักสาธารณะไม่ถูกอุด |

### 🟠 สำคัญ — ของที่พัง/ทำงานผิด
| # | ปัญหา | รายละเอียด |
|---|---|---|
| W6 | **Meta insights ไม่ทำงาน** — `eng7` และ `reach7` = 0 ทุกเพจ | น่าจะขาด permission `read_insights` หรือเรียก metric ผิดชื่อ · ทำให้ระบบเกรด A-D เพี้ยน (เกรดใช้ eng7 ตัดสิน — เพจ 8.6k followers โดนตัดเกรดเพราะ eng7=0) |
| W7 | **ปฏิทินไม่รองรับ status `done` / `canceled`** ที่มีอยู่จริงในข้อมูล | `stTag()` รู้จักแค่ posted/pending/อื่นๆ→"ตั้งเวลา" — โพสต์ที่ done/canceled แสดงผลผิดเป็น "🕐 ตั้งเวลา" |
| W8 | **ผลอนุมัติหน้าพรีวิว (✅/❌/🗑️) เก็บใน localStorage** | โค้ชกดผ่านแล้ว **ทีมไม่เห็น** — ข้อมูลอยู่แค่ในเบราว์เซอร์เครื่องเดียว ล้าง cache = หาย ขัดกับกฎข้อ 5 (preview→approve→publish) ที่ต้องการ workflow ร่วมกันจริง |
| W9 | **`esc()` escape ไม่ครบ** — แทนที่แค่ `&` กับ `<` ไม่จัดการ `>` และ `"` | ค่าจาก JSON ที่มี `"` ถูกฉีดเข้า attribute เช่น `onclick="pvSetStat('...')"` ได้ → HTML พัง/JS injection (ความเสี่ยงต่ำเพราะทีมเขียน JSON เอง แต่เป็นระเบิดเวลา) |

### 🟡 ความเสี่ยงเชิงโครงสร้าง
- **W10** ข้อมูลทุกหน้าแก้ JSON ด้วยมือ ไม่มี validator — JSON พังหนึ่งตัวอักษร = หน้านั้นโหลดไม่ได้ทั้งหน้า และไม่มี backup/version control ของ `/system/` ที่ตรวจสอบได้ (โค้ดหน้า dashboard ไม่อยู่ในรีโพนี้)
- **W11** วิดีโอ vault อยู่คนละโดเมน — ถ้าโดเมน/certificate ฝั่งนั้นมีปัญหา คลังกับพรีวิวใช้ไม่ได้ทั้งหมด

---

## 4) 🧩 ส่วนที่ยังไม่สมบูรณ์ (Incomplete)

| หน้า/ส่วน | สถานะปัจจุบัน |
|---|---|
| **SEO** | placeholder "⏳ กำลังสร้างเฟสถัดไป" — ยังไม่มีอะไรเลย |
| **รีพอร์ต** | ได้แค่ followers/posts · engage/reach ยังเป็น 0 (W6) |
| **พรีวิว** | ใช้ได้แต่ approve ไม่ถึงทีม (W8) — ยังไม่ครบ workflow |
| **คลังวัตถุดิบ** | เฟส 3 (ฟุตเทจดิบขึ้น vault) ยังไม่ทำ · สถานะคลิปต้องแก้ JSON มือ |
| **เพจคอนเทนต์** | 3 จาก 7 เพจยังไม่มี hub link ("รอลิงก์": จดหมาย, UFO, ตั้งสติสิวะ) |
| **ทีม & สกิลฮีโร่** | เป็นแค่ลิงก์ออกไปบอร์ดภายนอก · สกิล 12/20 ยัง "รอสร้าง" |
| **ปฏิทิน** | log ในไฟล์เองบอก "รอ build เฟสถัดไป" — events ยังลงมือ ไม่ได้ sync อัตโนมัติจากคิวโพสต์จริง |
| **Video Footage Analyzer (รีโพนี้)** | ดูข้อ 5 |

---

## 5) 🎬 Video Footage Analyzer (โค้ดในรีโพนี้) — ตรวจโค้ดละเอียด

เครื่องมือนี้ตรงกับหน้า "โรงงานผลิต/คลังวัตถุดิบ" แต่ยังไม่เชื่อมกับระบบจริง สิ่งที่พบ:

### บั๊ก/ช่องโหว่ในโค้ด
1. **(ร้ายแรงสุด) Gemini ไม่ได้เห็นวิดีโอจริง** — `geminiAnalyzer.js:24-44` ส่งแค่**ชื่อไฟล์+ความยาว**ใน prompt แล้วให้ AI "เดา" เมนู/ฉากจากชื่อไฟล์ · `googleDrive.getFileStream()` มีอยู่แล้วแต่**ไม่ถูกเรียกใช้เลย** — ต้องอัปโหลดไฟล์ผ่าน Gemini File API แล้วส่งเข้า `generateContent` จึงจะวิเคราะห์ได้จริงตามที่ README โฆษณา
2. **ไม่มี authentication เลย** ทุก endpoint — ถ้า deploy ขึ้น public แบบ `/system/` จะซ้ำรอย W1
3. **Drive pagination ขาด** — `googleDrive.js:35` ดึงแค่ `pageSize: 200` ไม่วนลูป `nextPageToken` → โฟลเดอร์เกิน 200 คลิปจะหายเงียบๆ
4. **`analyze-all` ทำงาน synchronous ใน request เดียว** (`clips.js:95-133`) — 100 คลิป × หลายวินาที = HTTP timeout แน่นอน ต้องเป็น background job + polling
5. **ผลลัพธ์จาก Gemini ไม่ถูก validate** — ถ้า `scene_type` ที่ตอบมาไม่อยู่ใน 4 ค่าที่ CHECK constraint ยอมรับ → SQL error กลายเป็น analysis failed แบบงงๆ · `confidence_score` ที่หายไป → `NaN`
6. **CSV ไม่ escape ถูกต้อง** (`export.js:67-79`) — ชื่อไฟล์ที่มี `,` หรือ `"` ทำคอลัมน์เพี้ยน (แก้แบบแทน `,`→`;` เฉพาะ notes ไม่พอ) และ `Content-Disposition` ใส่ชื่อโปรเจกต์ภาษาไทยตรงๆ อาจทำ header พัง — ต้องใช้ `filename*=UTF-8''...`
7. **แข่งกันวิเคราะห์ได้** — กด analyze รายคลิประหว่าง analyze-all วิ่งอยู่ → วิเคราะห์ซ้ำ เปลือง API (status `analyzing` ไม่ถูกใช้เป็น lock)
8. **sync เพิ่มอย่างเดียว** — คลิปที่ถูกลบ/เปลี่ยนชื่อใน Drive ไม่ถูกอัปเดตหรือทำเครื่องหมาย stale
9. **ไม่มี test แม้แต่ไฟล์เดียว** ไม่มี lint ไม่มี CI · มี UI ซ้ำ 2 ชุด (React + standalone HTML ใน `backend/src/public/`) ต้องดูแลคู่

### จุดแข็งของโค้ด
Parameterized SQL ครบ · WAL + foreign keys + CASCADE · transaction ตอน sync · upsert reviews ถูกต้อง · แยก routes/services เป็นระเบียบ · CSV ใส่ BOM ให้ Excel อ่านไทยได้

---

## 6) 🛠️ แผนการแก้ให้สมบูรณ์ (4 เฟส)

### เฟส 1 — อุดความปลอดภัย (ทำทันที, ~1 วัน)
1. **ใส่รหัสผ่านหน้า `/system/*`** — เร็วสุด: HTTP Basic Auth ผ่าน `.htaccess` (เซิร์ฟเวอร์รัน PHP อยู่แล้ว น่าจะเป็น Apache) หรือใช้ PHP session login ที่ `/ad/` มีอยู่แล้วมาครอบ
2. **ครอบ auth ที่ `/ad/report-api.php`** — เช็ค session เดียวกับ `/ad/` ก่อนตอบข้อมูล
3. **ย้าย `SYSTEM-RULES.md` ไปหลัง auth** (หรือ deny ผ่าน .htaccess)
4. **เลิก plain FTP → ใช้ SFTP** (ปัญหา 451 ของ FTPS แก้ที่ passive mode/firewall ได้ ไม่ควรแลกด้วยรหัสผ่าน plain text)
5. **แจ้งโฮสต์อัปเกรด PHP 7.4 → 8.2+**

### เฟส 2 — ซ่อมของที่พัง (~2-3 วัน)
6. **แก้ Meta insights** — ขอ permission `read_insights` + ใช้ metric ปัจจุบัน (`page_impressions_unique`, engagement จาก post-level) · ระหว่างรอ ปรับสูตรเกรดให้ไม่พึ่ง eng7 อย่างเดียว
7. **เพิ่ม `done`/`canceled` ใน `stTag()`** ของปฏิทิน + สีแยกชัด
8. **แก้ `esc()`** ให้ escape `& < > "` ครบ (มี `ce()` ที่ทำถูกอยู่แล้ว — ใช้ตัวเดียวทั้งไฟล์)
9. **เอาโค้ด `/system/` เข้า git** + สคริปต์ validate JSON ก่อนอัป (`python3 -m json.tool`) + backup `data/` อัตโนมัติรายวัน

### เฟส 3 — ปิด workflow ที่ค้าง (~1 สัปดาห์)
10. **Preview approve ฝั่ง server** — PHP endpoint เล็กๆ (อยู่หลัง auth เฟส 1) เขียนสถานะ ✅/❌ ลง `data/preview.json` → ทีมเห็นร่วมกัน, จาร์วิสอ่านผลไป publish ต่อได้ = ปิดลูป "preview ก่อน publish" ตามกฎข้อ 5 จริงๆ
11. **ปฏิทิน sync อัตโนมัติ** — สร้าง `calendar.json` จากคิวโพสต์/ผลโพสต์จริง (ฟอลคอน) แทนแก้มือ
12. **ทำหน้า SEO** (เฟสแรก: Search Console API ดึงคีย์เวิร์ด+อันดับต่อเพจ)
13. **เติม hub link 3 เพจที่ค้าง** + ย้ายบอร์ดสกิลฮีโร่เข้ามาในระบบ

### เฟส 4 — ทำ Video Footage Analyzer ให้ใช้จริง (~1-2 สัปดาห์)
14. **ให้ Gemini วิเคราะห์วิดีโอจริง**: ดึง stream จาก Drive → อัปโหลดผ่าน Gemini File API → ส่งเข้า model พร้อม prompt (โค้ด `getFileStream` มีแล้ว เหลือต่อท่อ)
15. **Validate ผลลัพธ์ AI** ก่อนลง DB (scene_type ∈ 4 ค่า, confidence เป็นตัวเลข 0-1)
16. **แปลง analyze-all เป็น background job** + endpoint `/stats` ที่มีอยู่ใช้ polling ความคืบหน้า + ใช้ status `analyzing` กันวิเคราะห์ซ้ำ
17. **วน `nextPageToken`** ตอน list Drive + จัดการคลิปที่หายจาก Drive (soft delete)
18. **แก้ CSV escaping + header ชื่อไฟล์ไทย** (`filename*=UTF-8''`)
19. **ใส่ auth ก่อน deploy** + เพิ่ม test ชุดแรก (routes + CSV + validator) + ตัด UI ซ้ำเหลือชุดเดียว
20. **เชื่อมเข้าหน้า "คลังวัตถุดิบ"**: ผล approve จาก analyzer → เขียนสถานะเข้า `assets.json` อัตโนมัติ = ปิดงานเฟส 3 ของคลังไปในตัว

---

## 7) สรุปสั้น

ระบบหลังบ้านนี้**ออกแบบ workflow ดี มีวินัยการบันทึกดีมาก** และส่วนปฏิทิน/คลัง/รีพอร์ตใช้งานได้จริงแล้ว แต่มี **ช่องโหว่ใหญ่สุดคือทั้งระบบเปิด public โดยไม่มี login (W1-W3)** ซึ่งควรแก้ก่อนสิ่งอื่นทั้งหมดภายในวันเดียว ถัดมาคือของที่พังเงียบๆ (insights=0, สถานะปฏิทินแสดงผิด, approve ไม่ถึงทีม) และงานที่ประกาศไว้แต่ยังไม่เสร็จ (SEO, เฟส 3 คลัง, analyzer ที่ยังวิเคราะห์วิดีโอจริงไม่ได้) — เดินตามแผน 4 เฟสข้างบนจะปิดครบทั้งหมด
