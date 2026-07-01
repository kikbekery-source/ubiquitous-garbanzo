# 📦 ชุดอัปเกรดระบบหลังบ้าน coach-kik.com/system/
> สร้าง 1 ก.ค. 2026 · ไฟล์ทุกตัวพร้อมใช้ — เหลือแค่อัปขึ้นเซิร์ฟเวอร์ (จาร์วิส/คนที่มี FTP ทำตามนี้ได้เลย)

## มีอะไรในกล่อง

| โฟลเดอร์ | คืออะไร |
|---|---|
| `auth/` | ล็อกอิน /system/ (user `kikkok`) — `.htaccess` + `.htpasswd` + บันทึกรหัสใน `ACCESS.md` |
| `api/` | `rooms-api.php` (ทะเบียนห้องงาน+แจ้งเตือน) · `comments-api.php` (คอมเมนต์ปักหมุด) |
| `widgets/` | `ck-notify.js` (ป๊อปอัพแจ้งเตือน รูปฮีโร่ กด ✕ ทิ้งได้ กด 🔕 ปิดถาวรได้) · `ck-comment.js` (ปุ่มคอมเมนต์ลากปักหมุดเป็นจุดๆ) |
| `data/` | `rooms.json` ตัวอย่างเริ่มต้น (2 ห้อง) |
| `standards/` | `APPROVAL-STANDARD.md` ไฟล์บรรทัดฐานกลาง (Approve 100% / ถามก่อนเริ่มโปรเจกต์ / รายงานเข้าระบบ) |
| `video-sorter/` | `MODES.md` โหมดคัดแยกวิดีโอให้โค้ชเลือก + `extract_frames.sh` |

## วิธีติดตั้ง (ทีละขั้น ~15 นาที)

> ⚠️ **ลำดับสำคัญมาก: อัป `.htaccess` เป็นขั้นตอนท้ายๆ เสมอ** — ถ้าอัปทั้งที่ path ยังเป็น
> placeholder อยู่ Apache จะตอบ 500 ทั้งโฟลเดอร์ /system/ รวมถึง whereami.php ที่ต้องใช้หา path
> = ล็อกตัวเองออกจนกว่าจะลบ .htaccess ผ่าน FTP

1. **หา path จริงก่อน**: อัปเฉพาะ `auth/whereami.php` ขึ้น `/system/` → เปิด
   `https://coach-kik.com/system/whereami.php` → จดบรรทัด `AuthUserFile ...` ที่มันบอก
2. **แก้ `.htaccess` ในเครื่อง**: แทนบรรทัด `AuthUserFile` ด้วย path จริงจากข้อ 1
3. **อัปไฟล์ระบบทั้งหมด (ยังไม่รวม .htaccess/.htpasswd)** ให้โครงสร้างเป็น:
   ```
   /system/api/rooms-api.php
   /system/api/comments-api.php
   /system/widgets/ck-notify.js
   /system/widgets/ck-comment.js
   /system/data/rooms.json    ← ถ้ามี data/ อยู่แล้ว แค่เพิ่มไฟล์นี้
   /system/standards/APPROVAL-STANDARD.md
   /system/reports/video-analyzer.html   ← จาก reports/
   /system/reports/system-upgrade.html   ← จาก reports/
   /system/img/heroes/        ← ใส่รูปฮีโร่ (gamora.png, jarvis.png, ...)
   ```
   หมายเหตุ: โฟลเดอร์ `/system/data/` ต้องเขียนได้โดยเว็บเซิร์ฟเวอร์ (chmod 775 หรือ 777 ตามโฮสต์)
4. **เสียบ widget เข้าหน้า dashboard**: เพิ่ม 2 บรรทัดนี้ใน `/system/index.html` ก่อน `</body>`:
   ```html
   <script src="/system/widgets/ck-notify.js" defer></script>
   <script src="/system/widgets/ck-comment.js" defer></script>
   ```
5. **เปิดล็อก**: อัป `.htpasswd` แล้วตามด้วย `.htaccess` (ที่แก้ path แล้ว) ขึ้น `/system/`
   → **ลบ whereami.php ทิ้ง**
6. **ทดสอบ login**: เปิด `/system/` ในหน้าต่างไม่ระบุตัวตน ต้องเด้งถามรหัส → `kikkok` / `2222`
   (ถ้าเจอ 500 = path ใน .htaccess ผิด ให้ลบ .htaccess ออกก่อนแล้วทำข้อ 1-2 ใหม่)
7. **ทดสอบครบวงจร**: รีเฟรช /system/ → ต้องเห็นป๊อปอัพแจ้งเตือน 2 ห้อง (กาโมร่า+จาร์วิส)
   มุมขวาล่าง กด 📄 เปิดรายงานได้ และปุ่ม 💬 คอมเมนต์ มุมซ้ายล่าง ปักหมุด/ลากหมุดได้ทั้งเมาส์และนิ้ว
8. **ให้ agent ทุกตัวอ่าน** `standards/APPROVAL-STANDARD.md` และเพิ่มลิงก์เข้า `SYSTEM-RULES.md`

## หมายเหตุความปลอดภัย

- `.htaccess` ครอบทั้งโฟลเดอร์ /system/ — data/*.json, SYSTEM-RULES.md, รายงานทุกไฟล์จะถูกล็อกหมดในครั้งเดียว
- `/ad/report-api.php` อยู่นอก /system/ ยังเปิดอยู่ — ต้องแก้แยก (เพิ่มเช็ค session ของ /ad/ ที่หัวไฟล์)
- agent ที่ยิง API ต้องใส่ `-u kikkok:2222` (ดูตัวอย่างใน APPROVAL-STANDARD.md ข้อ 4)
