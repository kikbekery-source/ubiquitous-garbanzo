# 📋 HANDOFF — ระบบหลังบ้านโค้ชกิ๊ก: เจออะไร แก้อะไรแล้ว เหลืออะไร
> ไฟล์ส่งต่องานฉบับเดียวจบ · สร้าง 1 ก.ค. 2026 โดยห้องคลาวด์ (Claude Code on the web)
> **สำหรับ Claude Code ในเครื่อง Mac ของโค้ช: อ่านไฟล์นี้จบแล้วลงมือทำ "งานที่เหลือ" (ส่วน C) ได้เลย**
>
> - รีโพ: `kikbekery-source/ubiquitous-garbanzo` · branch: `claude/backend-system-review-2e2wlb` · PR #2
> - ระบบจริง: https://coach-kik.com/system/ (static HTML + data/*.json) · `/ad/` = PHP 7.4
> - รหัสเข้าระบบ (โค้ชตั้งเอง): ดู `system-upgrade/auth/ACCESS.md` — user `kikkok`

---

## A) สิ่งที่ตรวจเจอ (การตรวจระบบหลังบ้านทั้งหมด 1 ก.ค. 2026)

### 🔴 วิกฤต — ความปลอดภัย (ยังไม่ได้แก้บนเซิร์ฟเวอร์ — เป็นงานของเครื่องนี้ ดูส่วน C)
| # | ปัญหา | หลักฐาน/ผลกระทบ |
|---|---|---|
| A1 | `/system/` เปิด public ไม่มี login | ทดสอบแล้วเข้าได้เลย — คนนอกเห็นแผนคอนเทนต์ 258 โพสต์, ลิงก์คลิปก่อนเผยแพร่, กฎภายใน |
| A2 | `/ad/report-api.php` เปิด public | ตอบสถิติ+Page ID ทุกเพจให้ใครก็ได้ |
| A3 | `SYSTEM-RULES.md` เข้าได้ public | เผย docroot `/kik/`, ขั้นตอนภายใน |
| A4 | กฎภายในสั่งใช้ plain FTP | รหัสวิ่งไม่เข้ารหัส — ดักได้ = ยึดเว็บได้ |
| A5 | PHP 7.4.33 (EOL พ.ย. 2022) ที่ `/ad/` | ไม่มี security patch แล้ว |

### 🟠 ของที่พัง/ทำงานผิดบนระบบจริง (ยังไม่ได้แก้ — ดูส่วน C)
| # | ปัญหา |
|---|---|
| A6 | รีพอร์ต Meta: `eng7`/`reach7` = 0 ทุกเพจ (น่าจะขาด permission `read_insights` หรือ metric ผิดชื่อ) → เกรด A-D เพี้ยน |
| A7 | ปฏิทิน: ข้อมูลจริงมี status `done`/`canceled` แต่ `stTag()` ใน index.html ไม่รู้จัก → แสดงผิดเป็น "🕐 ตั้งเวลา" |
| A8 | หน้าพรีวิว: ปุ่ม ✅/❌/🗑️ เก็บใน localStorage เครื่องเดียว — ทีมไม่เห็นผลอนุมัติของโค้ช |
| A9 | `esc()` ใน index.html escape แค่ `&` กับ `<` (ไม่ครบ) — เสี่ยง HTML/attribute injection จากข้อมูล JSON |
| A10 | หน้า SEO ว่างเปล่า · 3/7 เพจไม่มี hub link · โค้ดหน้า /system/ ไม่อยู่ใน git · ไม่มี backup data/*.json |

### 🎬 Video Analyzer เดิมในรีโพ (backend/)
| # | ปัญหา |
|---|---|
| A11 | Gemini ไม่เคยเห็นวิดีโอ — ส่งแค่ชื่อไฟล์+ความยาวให้เดา (`geminiAnalyzer.js`) |
| A12 | ไม่มี auth · Drive ดึงได้แค่ 200 ไฟล์ (ไม่วน nextPageToken) · analyze-all เสี่ยง timeout · CSV ไม่ escape · ไม่มี test |
| — | **การตัดสินใจของโค้ช:** ไม่ซ่อมทางนี้แล้ว — เปลี่ยนเป็นแนวใหม่: คลิปที่สร้างเอง**ลงทะเบียนตั้งแต่ตอนสร้าง** + ของเก่าให้ Claude ในเครื่องดูภาพนิ่งคัดแยก (โหมด 2) — เครื่องมือใหม่สร้างเสร็จแล้ว (ส่วน B) |

---

## B) สิ่งที่แก้/สร้างเสร็จแล้ว (อยู่ใน branch นี้ ทดสอบผ่านแล้วทั้งหมด)

ทั้งหมดอยู่ในโฟลเดอร์ **`system-upgrade/`** — ผ่านการตรวจหาบั๊กโดยทีมตรวจอิสระ 5 ทีม แก้ทุกจุดที่ยืนยันแล้ว:

| ชิ้น | ไฟล์ | สถานะ |
|---|---|---|
| ระบบ login /system/ (user `kikkok`) | `auth/.htaccess` + `auth/.htpasswd` + `auth/whereami.php` + `auth/ACCESS.md` (บันทึกรหัส) | ✅ พร้อมอัป — **ยังไม่ได้อัปขึ้นเซิร์ฟเวอร์** |
| API ห้องงาน (ทะเบียนความคืบหน้า+ปิดเสียงแจ้งเตือน) | `api/rooms-api.php` | ✅ แก้ race condition แล้ว (ยิงขนาน 30 นัดไม่มีข้อมูลหาย) |
| API คอมเมนต์ปักหมุด | `api/comments-api.php` | ✅ เหมือนกัน + validate input |
| ป๊อปอัพแจ้งเตือน (รูปฮีโร่ผู้รับผิดชอบ, ✕ ปิด, 🔕 ปิดถาวรต่อห้อง, 📄 รายงานเต็มใน modal) | `widgets/ck-notify.js` | ✅ อุด XSS (javascript: URI) แล้ว |
| ปุ่มคอมเมนต์ปักหมุด ลากได้ | `widgets/ck-comment.js` | ✅ แก้ใหญ่: ใช้บนมือถือได้ (Pointer Events), หมุดเกาะ element ไม่เพี้ยนเมื่อสลับแท็บ/หมุนจอ, แยกชุดคอมเมนต์ต่อแท็บ, อุด XSS |
| ข้อมูลห้องตัวอย่าง 2 ห้อง | `data/rooms.json` | ✅ |
| หน้ารายงานเต็ม 2 ห้อง | `reports/video-analyzer.html`, `reports/system-upgrade.html` | ✅ |
| บรรทัดฐานกลาง (Approve 100% / คอมเมนต์คือใบสั่งงาน / ถามก่อนเริ่มโปรเจกต์ใหม่ / รายงานเข้า rooms-api ทุกครั้ง / กติกา QA กาโมร่า) | `standards/APPROVAL-STANDARD.md` | ✅ |
| เครื่องมือทะเบียนคลิป: `register` (ลงทะเบียนตอนสร้าง) / `apply` (คัดแยกของเก่าตาม plan.json) / `index` (สารบัญ) | `video-sorter/footage_tool.py` | ✅ กันทะเบียนหายตอน Ctrl-C, กันลงซ้ำ, กันเลขชน (flock), validate ทุก input |
| สคริปต์ดึงภาพนิ่งจากคลิปให้ Claude ดู | `video-sorter/extract_frames.sh` | ✅ ไฟล์เสียไม่ล้มทั้งชุด, รันซ้ำทำต่อจากที่ค้าง, รองรับชื่อไทย/%/เว้นวรรค |
| คู่มือติดตั้งขึ้นเซิร์ฟเวอร์ (ลำดับกันล็อกตัวเองออก) | `README.md` (ใน system-upgrade/) | ✅ |
| คู่มือรันในเครื่อง Mac + prompt สำเร็จรูป | `video-sorter/LOCAL-SETUP.md` + `MODES.md` | ✅ |
| รายงานตรวจระบบฉบับเต็ม | `docs/SYSTEM-REVIEW-2026-07.md` | ✅ |

**การตัดสินใจที่โค้ชเคาะแล้ว (อย่าถามซ้ำ):** โหมดคัดแยก = โหมด 2 (ภาพนิ่ง) · คลิปใหม่ลงทะเบียนตอนสร้าง · รหัสหมวด = PROD/PREP/TALK/OTH · รหัสเข้าระบบ = ใน ACCESS.md · โมเดลเขียนโค้ดหลัก = Fable 5

---

## C) งานที่เหลือ — ให้ Claude Code ในเครื่อง Mac ทำตามลำดับนี้

> ⚠️ กฎจาก SYSTEM-RULES.md: ห้ามทับ `/kik/index.html` (หน้าเว็บหลัก) · เทสต์จริงผ่านเบราว์เซอร์ก่อนบอกเสร็จ · งานหลังบ้านอยู่ /system/ เท่านั้น

### C1. ติดตั้งชุดอัปเกรดขึ้นเซิร์ฟเวอร์ (~15 นาที) — สำคัญสุด แก้ A1
ทำตาม `system-upgrade/README.md` เป๊ะๆ — **ลำดับสำคัญ: อัป whereami.php หา path ก่อน → แก้ AuthUserFile ใน .htaccess ในเครื่อง → อัปไฟล์อื่นทั้งหมด → อัป .htpasswd แล้ว .htaccess ท้ายสุด → ลบ whereami.php** (อัป .htaccess ก่อนแก้ path = 500 ทั้งเว็บ ล็อกตัวเองออก)
เสร็จแล้วเสียบ widget 2 บรรทัดเข้า `/system/index.html` ก่อน `</body>` แล้วเทสต์ผ่านเบราว์เซอร์: login เด้ง, ป๊อปอัพ 2 ห้องขึ้น, ปักหมุด/ลากหมุดได้ทั้งเมาส์และนิ้ว

### C2. ครอบ auth ที่ /ad/report-api.php + ซ่อน SYSTEM-RULES.md — แก้ A2, A3
เพิ่มเช็ค PHP session ของ /ad/ (มี login อยู่แล้ว) ที่หัว report-api.php · ย้าย/บล็อก SYSTEM-RULES.md ให้อยู่หลัง auth

### C3. คัดแยกฟุตเทจ + ต่อ register เข้าโรงงานผลิต — ใช้ของที่สร้างเสร็จแล้ว
1. ถามโค้ช: โฟลเดอร์ฟุตเทจดิบอยู่ไหน + จะตั้งคลังคลิปไว้ไหน
2. `bash system-upgrade/video-sorter/extract_frames.sh <โฟลเดอร์ฟุตเทจ>` (ต้องมี ffmpeg: `brew install ffmpeg`)
3. เปิดดูเฟรมใน `_frames/` ด้วยตาตัวเอง → เขียน `plan.json`: `[{"file":"...","cat":"PROD|PREP|TALK|OTH","title":"...","confidence":0.9,"note":"..."}]`
4. `python3 system-upgrade/video-sorter/footage_tool.py apply --library <คลัง> --plan plan.json`
5. เปิด `INDEX.md` ให้โค้ชดู + ชี้ตัวติดธง ⚠️ (confidence < 0.7)
6. หา pipeline ผลิตคลิป (auto_content.py, build_episode.py ฯลฯ) → เพิ่มขั้นตอนท้ายให้เรียก `footage_tool.py register --cat ... --title ...` — คลิปใหม่เข้าสารบัญเองทุกตัว

### C4. แก้ของพังใน /system/index.html — แก้ A7, A9
- `stTag()`: เพิ่มเคส `done` (🟢 เสร็จ) และ `canceled` (⚫ ยกเลิก)
- `esc()`: ให้ escape `& < > "` ครบ (มี `ce()` ที่ทำถูกอยู่แล้วในไฟล์เดียวกัน — ใช้ตัวนั้นแทนได้)
- เอาโค้ด /system/ ทั้งหมดเข้า git (โฟลเดอร์ใหม่ในรีโพนี้ก็ได้) + ตั้ง backup `data/*.json` รายวัน

### C5. หน้าพรีวิว: ย้ายผลอนุมัติไปฝั่งเซิร์ฟเวอร์ — แก้ A8
เปลี่ยน `pvSetStat`/`pvDelOne` ใน index.html จาก localStorage ไปเก็บผ่าน API (ทำ endpoint เพิ่มใน `/system/api/` ตามแบบ comments-api.php ได้เลย — อยู่หลัง auth แล้ว) → โค้ชกดผ่านที่ไหนทีมเห็นทุกเครื่อง

### C6. QA อัตโนมัติ (กาโมร่า) + แจ้งเตือนเข้าระบบ
ตั้งรอบรัน QA ในเครื่อง (ปลั๊กอินเทสต์ที่โค้ชโหลดไว้ 5 ตัว) ตรวจ flow ใช้งานจริงของ /system/ ทุกหน้า · จบทุกรอบรายงานเข้า:
```bash
curl -u kikkok:<รหัสใน ACCESS.md> -X POST https://coach-kik.com/system/api/rooms-api.php \
  -H "Content-Type: application/json" \
  -d '{"action":"update","room":{"id":"qa-gamora","name":"QA อัตโนมัติ","hero":"กาโมร่า","heroEmoji":"🗡️","status":"in-progress","stage":"รอบล่าสุดผ่าน/เจอบั๊ก X ตัว","goal":"เฝ้าระบบหลังบ้านทุกหน้า","message":"ประโยคเดียวที่จะเด้งหาโค้ช","report":"/system/reports/qa-gamora.html"}}'
```
กติกาเต็มอยู่ `system-upgrade/standards/APPROVAL-STANDARD.md` (ข้อ 4-5) — เจอบั๊ก = `status:"blocked"` + เขียนรายงาน HTML ใส่ `/system/reports/`

### C7. งานถัดไป (รอบหน้า ไม่บล็อกอะไร)
- แก้ Meta insights (A6): ขอ permission `read_insights` + ใช้ metric ปัจจุบัน · ระหว่างรอปรับสูตรเกรดไม่ให้พึ่ง eng7 อย่างเดียว
- อัปเกรด PHP 7.4 → 8.2+ (A5) · เปลี่ยน plain FTP → SFTP (A4)
- หน้า SEO + hub link 3 เพจที่ค้าง (A10)
- เปลี่ยนรหัส `kikkok` เป็นรหัสยาวขึ้นเมื่อระบบนิ่ง (`openssl passwd -apr1 <รหัสใหม่>` แทนใน .htpasswd)

### กฎที่ต้องถือระหว่างทำ
1. ทุกงานข้างบน = ห้อง `system-upgrade` / `video-analyzer` / `qa-gamora` ใน rooms.json — **อัปเดตความคืบหน้าผ่าน rooms-api ทุกครั้งที่ขยับ** (โค้ชดูจากป๊อปอัพ)
2. เริ่มโปรเจกต์ใหม่ต้องถามโค้ชก่อน: "เกี่ยวกับระบบหลังบ้านไหม" → เกี่ยว = ลงทะเบียนห้อง
3. ยังไม่ Approve = ยังไม่เสร็จ — ห้ามถอดปุ่มคอมเมนต์ออกจากหน้าใดๆ เอง
