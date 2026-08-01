---
format: 1080x1920
duration: 98s
message: "งานเฝ้าออเดอร์ 2 ชั่วโมงต่อวัน เหลือศูนย์ ด้วย n8n ตัวเดียว"
arc: Bumper+Cold Open → ความเจ็บ → เครื่องมือ → ลงมือทำ 3 ขั้น → พิสูจน์ → ส่งไม้ต่อ
audience: เจ้าของร้าน/ผู้ประกอบการไทยที่ไม่ใช่โปรแกรมเมอร์ ดู Shorts บนมือถือ ส่วนใหญ่ปิดเสียง
mode: autonomous
music: none
---

## Video direction

- **palette system** (จาก frame.md — ห้ามคิดสีเอง): canvas `#0A0E16` + dot-grid จางเป็น
  ambient background ทุกเฟรม · ink หลัก `#EEF2FA` · muted `#A9B4CD` · accent ตอนนี้ =
  ปะการัง `#FF6D7E` (ใช้กับ: เลขขั้น, นาฬิกา, ไฮไลต์, พัลส์ในเส้น workflow) ·
  mint `#3ECFB2` เป็น secondary เฉพาะฝั่ง "แชท/LINE" (เฟรม 1, 6, 7) ·
  indigo `#8B87FF` โผล่ครั้งเดียวในการ์ดสปอย EP2 (เฟรม 8)
- **series clock (อุปกรณ์ประจำซีรีส์)**: เกิดกลางเฟรม 2 (count-up จบที่ `02:00:00`
  แล้วหด+บินไปเกาะมุมขวาบน) จากนั้น**ทุกเฟรม 3–7 ต้องวางนาฬิกาเดิมไว้มุมขวาบน**
  (monospace, เดินถอยหลังช้าๆ ต่อเนื่อง — ค่าเริ่มแต่ละเฟรมไล่ลง: F3=01:58:xx, F4=01:55:xx,
  F5=01:50:xx, F6=01:45:xx, F7=01:40:xx) จนถึงจังหวะยุบเหลือ `00:00:04` ในเฟรม 7 ·
  เฟรม 8 ไม่มีนาฬิกา
- **motion grammar + reveal model**: long-tail `power3` เป็นค่าปริยาย นุ่มชนะเด้ง ·
  ทุกเฟรม reveal ตามคิวคำพูด (voiceover เป็นแกนจังหวะแม้คลิปเงียบ — คนดูอ่านข้อความ
  on-frame แทนเสียง) ห้าม front-load · ช่วง hold ให้นิ่งจริง อนุญาตแค่ jitter บางเบา
- **rhythm / held frames**: breather สองจุด — ท้ายเฟรม 3 (lockup n8n ค้างอ่าน) และ
  การ์ดสุดท้ายเฟรม 8 (progress bar ค้างนิ่งจนจบ) · เฟรมอื่นเคลื่อนตามคิวตลอด
- **negative list**: ห้าม gradient ม่วง-น้ำเงิน "AI" / bokeh ลอย · ห้ามโลโก้-UI จริงของ
  LINE/n8n (mock ตามอัตลักษณ์เท่านั้น ไอคอนแชทใช้ bubble ทั่วไป) · ห้ามตัวไทยจากฟอนต์อื่น
  นอกเหนือ display/body ของ frame.md · ห้าม slideshow (front-load แล้วแช่แข็ง) ·
  ห้าม screensaver (ของลอยอิสระ) · ล่าง ~17% เว้นว่างทุกเฟรม (วินัยแถบ caption ของซีรีส์)

## Frame 1 — Bumper + Cold Open

- type: hook
- blueprint: kinetic-type-beats (Adapt)
- duration: 8.88s
- transition_in: cut
- status: animated
- poster: 5s
- scene: แท่งสี 7 แท่งติดไล่กันเป็น bumper ซีรีส์ แล้วตัดเข้าแชท — ออเดอร์เด้งเข้าเองต่อหน้าคนดู
- voiceover: "ผมจะสอนทำระบบออโตเมติกด้วย n8n แบบฟรีๆ ไม่ต้องเสียตังค์สักบาท ดูนะ ออเดอร์เพิ่งเข้าเมื่อกี้ เด้งเข้า LINE เองเลย ผมไม่ได้แตะอะไรเลย"
- focal: การ์ดแจ้งเตือนออเดอร์ (ใบแรก)
- roles: การ์ดแจ้งเตือน ×2 = foreground subject · แท่งสี 7 แท่ง + ชื่อซีรีส์ = supporting (เฉพาะ 0–3s) · ผิวแชทเข้ม + dot-grid = background (หรี่ ~40%)
- sfx: seven ascending pings, notification pop ×2, kinetic slam
- src: compositions/frames/01-hook.html

Adapt: คงลายเซ็น kinetic beats (สลับ/แลนด์เป็นจังหวะ จบด้วย spring-pop payoff) —
บีตแรกเป็นแท่งสีแทนคำ บีตหลังเป็นการ์ดแจ้งเตือนแทนคำ

Scene 1 (0.0–1.6s): จอมืด — แท่งสีทั้ง 7 whip เข้าจากล่างแบบ waterfall-entry ไล่ซ้าย→ขวา
เรียงเป็น full-width strip กลางจอ (y≈0.42) แท่ง EP1 (ปะการัง) สูงกว่าเพื่อน 2 เท่า
Scene 2 (1.6–3.0s): ชื่อซีรีส์ "7 เครื่องมือฟรี ที่ทำงานแทนคุณได้" สแนปเข้าใต้แท่ง
(waterfall คำ) ค้างครึ่งวิ แล้วทั้งชุดตัดแข็งออก
Scene 3 (3.0–4.6s): ผิวแชทเข้มโผล่ (layered-depth, หรี่ 40%) — การ์ดแจ้งเตือนใบแรก
spring-pop-entrance กลางจอ ~55% ของเฟรม: หัว "ออเดอร์ใหม่ #1042" + ชื่อลูกค้า + ที่อยู่ + เมนู
พร้อมจุดเวลา "เมื่อครู่นี้"
Scene 4 (4.6–6.2s): การ์ดใบสองซ้อนเหลื่อมเข้าอีกชั้น (spring-pop, stagger สั้น) + ชิป
mint "ส่งอัตโนมัติ" ป๊อปมุมการ์ด — สื่อว่าระบบยิงเอง
Scene 5 (6.2–8.0s): บรรทัดฮีโร่ "ผมไม่ได้แตะอะไรเลย" kinetic-beat-slam โซน upper-third
(ตัวหนา ~ระดับ display) แล้วนิ่งอ่านจนตัดเฟรม

## Frame 2 — ความเจ็บ: เฝ้าจอวันละ 2 ชั่วโมง

- type: pain_point
- blueprint: dataviz-countup (Adapt)
- duration: 15.2s
- transition_in: cut
- status: animated
- scene: ลูปงานมือทับถมเป็นรายการ ตัวนับออเดอร์ไต่ 1→34 แล้ว count-up เวลา 02:00:00 กลายเป็นนาฬิกาประจำตอน
- voiceover: "เมื่อก่อนผมนั่งเฝ้าหน้าร้านออนไลน์ทั้งวัน มีออเดอร์เข้าที ก็ก็อปชื่อ ก็อปที่อยู่ ไปวางในกลุ่ม LINE วันนึงสามสิบกว่าออเดอร์ เสียเวลาสองชั่วโมงต่อวัน บางทีก็อปพลาด ของไปส่งผิดบ้าน"
- focal: ตัวเลขเวลา 02:00:00 (ฮีโร่ count-up ปลายเฟรม)
- roles: รายการลูปงานมือ + ตัวนับออเดอร์ = foreground ช่วงแรก แล้วถอยเป็น supporting (หรี่ 40%) · ตัวเลขเวลา = foreground ช่วงท้าย · dot-grid = background
- sfx: soft tick ต่อบรรทัด, error buzz, rising whoosh, clock dock thunk
- src: compositions/frames/02-pain.html

Adapt: คงลายเซ็น count-up-landing-hero-metric — chart เปลี่ยนเป็นรายการงานมือ + ตัวนับ
ออเดอร์ และ hero metric คือเวลา ซึ่งไม่จบเฉยๆ แต่หด+บินไปเกิดเป็นนาฬิกาประจำซีรีส์

Scene 1 (0.0–2.4s): บรรทัดแรกของลูป "ก็อปชื่อลูกค้า" เลื่อนเข้า (rule-of-thirds ซ้าย)
พร้อมกากบาทปะการังหน้าบรรทัด · ชิปตัวนับ "ออเดอร์ที่ 1" มุมบนซ้าย
Scene 2 (2.4–5.8s): บรรทัดถัดๆ ทับถมลงมาตามคิว: "ก็อปที่อยู่" → "สลับไปวางใน LINE" →
"ทำซ้ำ…" (waterfall-entry ทีละบรรทัด) ตัวนับวิ่ง 1→34 (counting-dynamic-scale โตขึ้นตามค่า)
Scene 3 (5.8–8.6s): แถวผิดพลาดแทรกเข้า "ที่อยู่ผิด — ของไปส่งผิดบ้าน" เน้นด้วย
chromatic-glitch สั้นๆ หนึ่งจังหวะ (ไม่วนซ้ำ) บรรทัดอื่นหรี่ลง
Scene 4 (8.6–13.0s): ทั้งรายการหรี่ 40% ถอยเป็นฉากหลัง — ตัวเลขเวลา count-up
00:00:00→02:00:00 กลางจอ (counting-dynamic-scale, โตจนกิน ~50% ความกว้าง)
ค้างครึ่งวิ แล้วหดตัวลงพร้อมเคลื่อนไปเกาะมุมขวาบน (การเดินทางเดียว, power3 ยาว)
กลายเป็นนาฬิกาประจำซีรีส์ขนาดชิป — แลนด์แล้ววาบปะการังหนึ่งครั้ง นิ่งจนตัดเฟรม

## Frame 3 — เครื่องมือ: n8n

- type: product_intro
- blueprint: logo-assemble-lockup (Reproduce)
- duration: 10.24s
- transition_in: cut
- status: animated
- scene: โหนดวิ่งมาต่อสายกันแล้วประกอบเป็นเวิร์ดมาร์ก n8n + ป้าย ฟรี · OPEN SOURCE
- voiceover: "ตัวที่ผมใช้ชื่อ n8n เครื่องมือต่องานอัตโนมัติ ลากบล็อกต่อกันเป็นเส้น ฟรี เป็น open source เอาไปลงเครื่องตัวเองได้ ไม่มีค่ารายเดือน"
- focal: เวิร์ดมาร์ก "n8n"
- roles: เวิร์ดมาร์ก = foreground subject · โหนด+เส้นก่อนประกอบ = supporting · glow หลังโลโก้ + dot-grid = background
- sfx: node pops, connect ticks, assemble bloom, pill snaps ×3
- src: compositions/frames/03-tool.html

Reproduce: elements assemble → centered lockup → ต่อท้ายด้วยป้ายคุณสมบัติ (ลายเซ็น =
การประกอบร่างของมาร์ก)

Scene 1 (0.0–2.2s): โหนดกลม 5 ตัว spring-pop-entrance กระจายรอบกลางจอ (layered-depth)
เส้นเชื่อมวาดตัวเองระหว่างโหนด (svg-path-draw) ตามคิว "ลากบล็อกต่อกันเป็นเส้น"
Scene 2 (2.2–4.6s): โหนด+เส้นวิ่งเข้าหากันแล้วประกอบเป็นเวิร์ดมาร์ก "n8n" ตัวใหญ่สีปะการัง
กลางจอ y≈0.42 (~60% ความกว้าง) — ambient-glow-bloom ผุดหลังมาร์กเบาๆ (peak ≤0.45)
Scene 3 (4.6–7.0s): บรรทัดอธิบายไทยคลี่ใต้มาร์ก (waterfall-entry ทีละคำ):
"เครื่องมือต่องานอัตโนมัติ — ลากบล็อกต่อกันเป็นเส้น"
Scene 4 (7.0–10.0s): ป้าย pill สแนปเข้าทีละใบใต้บรรทัด (spring-pop, stagger ≤0.5s):
"ฟรี" · "OPEN SOURCE" · "ไม่มีค่ารายเดือน" — แล้ว **held read** ทั้ง lockup นิ่งสนิท
(breather ที่จัดสรรไว้) นาฬิกามุมขวาบนเดินถอยหลังเงียบๆ (01:58:41→…)

## Frame 4 — ขั้นที่ 1: สร้าง Webhook

- type: feature_showcase
- blueprint: cursor-ui-demo (Adapt)
- duration: 13.68s
- transition_in: cut
- status: animated
- scene: chapter card 01 แล้วเคอร์เซอร์ใหญ่สร้าง workflow เลือก Webhook ได้ลิงก์มาก็อปเก็บ
- voiceover: "ขั้นแรก สร้าง workflow ใหม่ เลือกตัวเริ่มต้นเป็น Webhook — ประตูรับข้อมูล ใครส่งอะไรเข้ามา เส้นงานเริ่มทำงานทันที มันจะให้ลิงก์มา ก็อปเก็บไว้ก่อน"
- focal: โหนด Webhook (และช่องลิงก์ของมัน)
- roles: เคอร์เซอร์ oversized = eye-carrier · โหนด/เมนู/ช่องลิงก์ = foreground subject · แคนวาส mock (dot-grid เข้ม) = background หรี่ 40%
- sfx: card swipe, ui click, menu expand, node pop, copy chime
- src: compositions/frames/04-step1.html

Adapt: คงลายเซ็น cursor-drives-state-change — เพิ่ม chapter card เปิดตามธรรมเนียมซีรีส์
(การ์ดคือ waterfall-entry ของเลข+ชื่อขั้น)

Scene 1 (0.0–0.8s): chapter card เต็มจอ: เลข "01" ใหญ่สีปะการัง whip ขึ้นจากล่าง +
"สร้าง Webhook" fade เข้าใต้เลข — ตัดแข็งออก
Scene 2 (0.8–3.8s): แคนวาสจำลองโผล่ (พื้นเข้มขึ้นอีกชั้น, มุมโค้ง, หรี่ 40%) — เคอร์เซอร์
ใหญ่เข้าจากขอบล่างซ้ายนอกจอ เคลื่อนถึงปุ่ม "+" กลางแคนวาส (ทางเดียว ไม่วน)
Scene 3 (3.8–8.2s): คลิก (cursor-click-ripple) → เมนูเลือกโหนดคลี่ลง (anchored-layout-expand)
รายการ 4 แถว แถว "Webhook" ไฮไลต์ปะการังเมื่อเคอร์เซอร์ถึง → คลิกเลือก
Scene 4 (8.2–12.4s): โหนด Webhook spring-pop ลงกลางแคนวาส ตามคิว "ประตูรับข้อมูล" —
ชิปอธิบายสั้นป๊อปใต้โหนด: "ประตูรับข้อมูลเข้าเส้นงาน"
Scene 5 (12.4–17.0s): ช่องลิงก์เลื่อนออกใต้โหนด (URL แบบ mono ตัดปลาย) เคอร์เซอร์คลิกปุ่มก็อป
→ press-release-spring + toast "คัดลอกแล้ว" ป๊อปเหนือปุ่ม — นิ่งอ่านวิสุดท้าย
(นาฬิกา 01:55:xx เดินอยู่มุมขวาบน)

## Frame 5 — ขั้นที่ 2: ต่อเข้าหน้าร้าน แล้วกด Test

- type: feature_showcase
- blueprint: panel-edit-live-sync (Adapt)
- duration: 15.6s
- transition_in: cut
- status: animated
- scene: chapter card 02 แล้ววางลิงก์ในแผงร้าน กด Test — ข้อมูลจริงวิ่งเข้าฝั่ง n8n ทันที
- voiceover: "ขั้นที่สอง เอาลิงก์ไปใส่ในหน้าตั้งค่าของร้าน ตรงช่องแจ้งเตือนออเดอร์ ตรงนี้สำคัญ ต้องกด Test ก่อนทุกครั้ง ไม่งั้นขั้นต่อไปพัง พอ Test ผ่าน จะเห็นข้อมูลจริงวิ่งเข้ามา"
- focal: คู่ control↔target — ปุ่ม Test (บน) กับการ์ดข้อมูลที่คลี่ใต้โหนด (ล่าง)
- roles: แผงตั้งค่าร้าน (บน) + โหนด Webhook (ล่าง) = foreground คู่ · แบนเนอร์คำเตือน = supporting เด่นชั่วขณะ · dot-grid = background
- sfx: typing ticks, warning slam, press spring, data whoosh, success chime
- src: compositions/frames/05-step2.html

Adapt: จอแยกซ้าย/ขวาของ blueprint เปลี่ยนเป็น**ซ้อนบน/ล่าง** (กติกา portrait) —
คงลายเซ็น edit-แล้ว-target-ขยับในบีตเดียวกัน (control-target-sync)

Scene 1 (0.0–0.8s): chapter card "02 · ต่อเข้าหน้าร้าน" (แบบเดียวกับ 01) ตัดแข็งออก
Scene 2 (0.8–4.8s): stack แนวตั้ง: การ์ดแผงตั้งค่าร้าน (บน ~45%) มีช่อง
"URL แจ้งเตือนออเดอร์" — ลิงก์จากขั้นที่ 1 พิมพ์ลงช่องทีละส่วน (discrete-text-sequence)
· การ์ดโหนด Webhook (ล่าง ~35%) จุดสถานะ "รอฟัง" กะพริบช้าสองรอบแล้วนิ่ง
Scene 3 (4.8–8.0s): แบนเนอร์เตือนกรอบปะการังหนาสแลมเข้ากลางรอยต่อสองการ์ดหนึ่งจังหวะ:
"ต้องกด Test ก่อนทุกครั้ง" ค้างสองวิ แล้วย่อไปเกาะเหนือปุ่ม Test
Scene 4 (8.0–13.0s): เคอร์เซอร์กดปุ่ม Test (กดยุบ-เด้งคืน) → ในบีตเดียวกัน
พัลส์แสงปะการังไหลจากการ์ดบนลงการ์ดล่าง (control-target-sync) → การ์ดข้อมูลออเดอร์
(ชื่อ/ที่อยู่/เมนู) คลี่ออกใต้โหนด (anchored-layout-expand)
Scene 5 (13.0–17.0s): ชิปเขียวมิ้นต์ "Test ผ่าน ✓" ป๊อปมุมการ์ดล่าง — นิ่งอ่าน
(นาฬิกา 01:50:xx มุมขวาบน)

## Frame 6 — ขั้นที่ 3: ต่อ LINE แล้วเปิด Active

- type: feature_showcase
- blueprint: cursor-ui-demo (Adapt)
- duration: 9.6s
- transition_in: cut
- status: animated
- scene: chapter card 03 ลากชิปข้อมูลจากโหนดแรกไปวางในข้อความ แล้วสับสวิตช์ Active ทั้งเส้นติดสว่าง
- voiceover: "ขั้นที่สาม ต่อบล็อก LINE เข้าไปท้ายเส้น ลากชื่อลูกค้ากับที่อยู่จากบล็อกแรก มาวางในช่องข้อความ เท่านี้คือจบแล้ว กด Active มุมขวาบน"
- focal: เส้น workflow ครบสาย (Webhook → แชท) ที่ติดสว่างตอน Active
- roles: ชิปข้อมูล 2 ตัวที่ถูกลาก = foreground ระหว่างกลาง · โหนดแชท (mint) = foreground ปลายทาง · สวิตช์ Active = supporting เด่นท้ายเฟรม · แคนวาส = background
- sfx: node connect, drag grab ×2, drop snap ×2, toggle click, line power-up
- src: compositions/frames/06-step3.html

Adapt: คงลายเซ็น cursor-drives-state — โชว์กริยา "ลาก" เต็มรูป (cursor-drag: grab →
ghost ride → drop-snap) สองรอบ แล้วปิดด้วย toggle จ่ายไฟทั้งเส้น

Scene 1 (0.0–0.8s): chapter card "03 · ส่งเข้า LINE" ตัดแข็งออก
Scene 2 (0.8–4.6s): กลับสู่แคนวาส: โหนดแชทใหม่ (ไอคอน bubble, ขอบ mint) spring-pop
ต่อท้ายเส้น — สายเชื่อมจาก Webhook วาดตัวเองถึงโหนดใหม่ (svg-path-draw)
Scene 3 (4.6–11.0s): เคอร์เซอร์ลากชิป "ชื่อลูกค้า" จากใต้โหนด Webhook (cursor-drag:
กดจับยุบเล็ก → เงา ghost ลอยตาม → ปล่อยสแนปลงช่องข้อความของโหนดแชท) แล้วลากชิป
"ที่อยู่" ซ้ำอีกรอบ — ช่องข้อความประกอบร่างเป็นเทมเพลตข้อความสมบูรณ์
Scene 4 (11.0–15.0s): เคอร์เซอร์เลื่อนไปมุมขวาบนแคนวาส สับสวิตช์ "Active"
(physics-press-reaction) → ทั้งเส้น workflow ติดสว่างพร้อมกันหนึ่งจังหวะ แล้วพัลส์
เริ่มวิ่งตลอดสาย (svg-icon-enrichment dash-flow, จำกัดรอบ)
Scene 5 (15.0–18.0s): ป้าย "ระบบทำงานแล้ว" ป๊อปเหนือเส้น — นิ่ง พัลส์วิ่งเบาๆ
(นาฬิกา 01:45:xx)

## Frame 7 — พิสูจน์: 4 วินาที เข้า LINE

- type: benefit_highlight
- blueprint: camera-journey (Reproduce)
- duration: 10s
- transition_in: cut
- status: animated
- scene: สั่งจริง กล้องพุ่งตามพัลส์จากปุ่มสั่งซื้อผ่านเส้นถึงแจ้งเตือน แล้วนาฬิกายุบ 02:00:00 → 00:00:04
- voiceover: "ลองสั่งจริงนะ กดสั่ง... สี่วินาที เข้า LINE แล้ว ชื่อถูก ที่อยู่ถูก จากทำมือสองชั่วโมงต่อวัน เหลือศูนย์ ผมไม่ต้องเฝ้าจอเลย"
- focal: พัลส์ปะการังที่เดินทาง (เหตุ→ผล) และนาฬิกาที่ยุบ
- roles: การ์ดหน้าร้าน (ต้นทาง) + การ์ดแจ้งเตือน (ปลายทาง) = foreground หัว-ท้าย · เส้น workflow = ทางวิ่ง · ตัวนับวินาที = supporting · dot-grid = background
- sfx: order click, whoosh travel, notification pop, clock collapse impact, headline slam
- src: compositions/frames/07-proof.html

Reproduce (sub-shape A — action roundtrip): คลิกที่แผงหนึ่ง → กล้องสวูปตามผลไปอีกแผง
(ลายเซ็น = การเดินทางของกล้องเล่าเหตุ→ผล)

Scene 1 (0.0–2.6s): การ์ดหน้าร้าน mock (เมนู + ราคา + ปุ่ม "สั่งซื้อ") กลางจอ —
เคอร์เซอร์กดปุ่ม (physics-press-reaction กดคู่ปุ่ม+เคอร์เซอร์)
Scene 2 (2.6–7.0s): กล้องเสมือน (viewport-change บน .world เดียว) พุ่งตามพัลส์ปะการัง
ที่วิ่งเข้าเส้น workflow — ผ่านโหนด Webhook → โหนดแชท พร้อม motion-blur-streak
ช่วงเร็วสุด · ตัวนับวินาทีเล็ก มุมล่างของทางวิ่ง (บนเขต keep-out) นับ 0.0→4.0
Scene 3 (7.0–10.2s): แลนด์: การ์ดแจ้งเตือนแชท spring-pop พร้อมข้อมูลครบ ชิปเช็ก
"ชื่อถูก ✓ ที่อยู่ถูก ✓" — จังหวะเดียวกัน นาฬิกามุมขวาบน**ยุบวูบลง**จาก 01:40:xx
สู่ `00:00:04` (เบลอทางดิ่งสั้นๆ + วาบปะการังหนึ่งครั้ง — บีตลายเซ็นของซีรีส์)
Scene 4 (10.2–13.4s): แถบเทียบซ้อนแนวตั้ง (full-width strip สองชั้น):
บน "ทำมือ 2 ชม./วัน" สีหม่น ขีดฆ่า — ล่าง "หลังต่อ n8n = 0" ตัวใหญ่สีปะการัง
Scene 5 (13.4–16.0s): บรรทัดฮีโร่ "ประหยัด 2 ชั่วโมง ทุกวัน" kinetic-beat-slam
กลางจอ แล้วนิ่งอ่านจนตัด

## Frame 8 — ส่งไม้ต่อ

- type: cta
- blueprint: titlecard-reveal (Reproduce)
- duration: 13.36s
- transition_in: cut
- status: animated
- poster: 6s
- scene: เชนการ์ดสามใบ: การบ้านหนึ่งอย่าง → สปอย EP2 → progress ซีรีส์ 9 ช่อง ค้างนิ่งปิดคลิป
- voiceover: "ถ้าจะเริ่ม ทำแค่อย่างเดียวพอ — สมัคร n8n แล้วสร้าง Webhook ให้ได้ลิงก์มา แค่นั้น ตอนหน้า เอาข้อความธรรมดา ให้ AI แปลงเป็นผังงานใน 3 นาที"
- focal: เช็กลิสต์การบ้าน (ใบ 1) → แถบ progress ซีรีส์ (ใบ 3)
- roles: การ์ดแต่ละใบ = foreground เดี่ยวตามช่วง · แถบสี indigo ใน card 2 = supporting · dot-grid = background
- sfx: card cut ×2, check ticks ×3, segment fill, soft resolve chord
- src: compositions/frames/08-handoff.html

Reproduce (card chain): การ์ดเกือบนิ่ง 3 ใบ ตัดแข็งต่อกัน จบด้วย hold ยาว
(ลายเซ็น = ความนิ่งคือ payload — one restrained move ต่อใบ)

Scene 1 (0.0–5.0s): ใบ 1 — หัว "การบ้านวันนี้ · 5 นาที" + เช็กลิสต์ 3 บรรทัด
waterfall-entry ทีละบรรทัดตามคิว: สมัคร n8n → สร้าง Webhook → ก็อปลิงก์เก็บไว้
เครื่องหมายถูกวาดตัวเอง (svg-path-draw) ท้ายบรรทัดที่พูดถึง
Scene 2 (5.0–9.4s): ตัดแข็ง → ใบ 2 — แถบข้าง indigo + "ตอนหน้า EP2 · Excalidraw"
บรรทัดรอง "พิมพ์ข้อความ ได้ผังงานทันที" คลี่หนึ่ง move (slide-up crossfade) แล้วนิ่ง
Scene 3 (9.4–14.0s): ตัดแข็ง → ใบ 3 — ชื่อซีรีส์กลางจอ + แถบ progress 9 ช่อง
(full-width strip ล่างกลาง เหนือเขต keep-out) ช่อง EP1 เติมเต็มสีปะการัง (stat-bars-and-fills
แบบ progress fill) ช่องอื่นหรี่ — **ค้างนิ่งสนิทจนเฟรมสุดท้าย** (hold ปิดคลิปที่จัดสรรไว้)
