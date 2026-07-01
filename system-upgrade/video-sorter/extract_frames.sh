#!/usr/bin/env bash
# ดึงภาพนิ่งจากคลิปทุกตัวในโฟลเดอร์ เพื่อให้ Claude ดูแล้วจัดหมวด (โหมด 2)
# ใช้: ./extract_frames.sh <โฟลเดอร์คลิป> [จำนวนเฟรมต่อคลิป=4]
# ไฟล์เสีย 1 ไฟล์ = ข้ามไฟล์นั้น ไม่ล้มทั้งชุด · รันซ้ำได้ ทำต่อเฉพาะที่ยังไม่เสร็จ
set -uo pipefail

SRC="${1:?ใส่โฟลเดอร์คลิปด้วย เช่น ./extract_frames.sh ~/คลิปดิบ}"
N="${2:-4}"
OUT="$SRC/_frames"
mkdir -p "$OUT"

ok=0; bad=0; skipped=0
shopt -s nullglob nocaseglob
for f in "$SRC"/*.{mp4,mov,mkv,avi,webm}; do
  name="$(basename "${f%.*}")"
  dir="$OUT/$name"
  # ถือว่า "ทำแล้ว" ต่อเมื่อเฟรมสุดท้ายมีจริง (โฟลเดอร์ค้างจากรอบที่พัง = ทำใหม่)
  if [ -f "$dir/f$N.jpg" ]; then
    echo "ข้าม (ทำแล้ว): $name"; skipped=$((skipped+1)); continue
  fi
  rm -rf "$dir"; mkdir -p "$dir"

  dur="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f" 2>/dev/null || echo 1)"
  dur="${dur%.*}"
  case "$dur" in ''|*[!0-9]*) dur=1 ;; esac   # กัน ffprobe ตอบ N/A หรือค่าประหลาด
  [ "$dur" -lt 1 ] && dur=1

  fail=0
  for i in $(seq 1 "$N"); do
    # กระจายเฟรมทั่วคลิป เลี่ยงเฟรมแรกสุด (มักเป็นจอดำ)
    t=$(( dur * i / (N + 1) ))
    # -f image2 -update 1 กันชื่อไฟล์ที่มี % ถูกตีความเป็น pattern
    if ! ffmpeg -v error -ss "$t" -i "$f" -frames:v 1 -q:v 3 -vf "scale=640:-1" \
         -f image2 -update 1 "$dir/f$i.jpg" -y; then
      fail=1; break
    fi
  done

  if [ "$fail" -eq 1 ] || [ ! -f "$dir/f$N.jpg" ]; then
    echo "⚠️ ดึงเฟรมไม่ได้ ข้าม: $name (ไฟล์อาจเสียหรืออ่านไม่ออก)"
    rm -rf "$dir"; bad=$((bad+1)); continue
  fi
  ok=$((ok+1))
  echo "✅ $name → $N เฟรม (ยาว ${dur}s)"
done

echo
echo "สรุป: สำเร็จ $ok · ข้าม(ทำแล้ว) $skipped · พัง $bad"
echo "เฟรมทั้งหมดอยู่ที่: $OUT"
echo "ขั้นถัดไป: ให้ Claude อ่านรูปในแต่ละโฟลเดอร์แล้วจัดหมวด + สร้าง plan.json"
[ "$bad" -eq 0 ]
