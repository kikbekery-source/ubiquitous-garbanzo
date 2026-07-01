#!/usr/bin/env bash
# ดึงภาพนิ่งจากคลิปทุกตัวในโฟลเดอร์ เพื่อให้ Claude ดูแล้วจัดหมวด (โหมด 2)
# ใช้: ./extract_frames.sh <โฟลเดอร์คลิป> [จำนวนเฟรมต่อคลิป=4]
set -euo pipefail

SRC="${1:?ใส่โฟลเดอร์คลิปด้วย เช่น ./extract_frames.sh ~/คลิปดิบ}"
N="${2:-4}"
OUT="$SRC/_frames"
mkdir -p "$OUT"

shopt -s nullglob nocaseglob
for f in "$SRC"/*.{mp4,mov,mkv,avi,webm}; do
  name="$(basename "${f%.*}")"
  dir="$OUT/$name"
  [ -d "$dir" ] && { echo "ข้าม (ทำแล้ว): $name"; continue; }
  mkdir -p "$dir"
  dur="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f" 2>/dev/null || echo 0)"
  dur="${dur%.*}"; [ -z "$dur" ] || [ "$dur" -lt 1 ] && dur=1
  for i in $(seq 1 "$N"); do
    # กระจายเฟรมทั่วคลิป เลี่ยงเฟรมแรกสุด (มักเป็นจอดำ)
    t=$(( dur * i / (N + 1) ))
    ffmpeg -v error -ss "$t" -i "$f" -frames:v 1 -q:v 3 -vf "scale=640:-1" "$dir/f$i.jpg" -y
  done
  echo "✅ $name → $N เฟรม (ยาว ${dur}s)"
done

echo
echo "เสร็จแล้ว — เฟรมทั้งหมดอยู่ที่: $OUT"
echo "ขั้นถัดไป: ให้ Claude อ่านรูปในแต่ละโฟลเดอร์แล้วจัดหมวด + สร้าง INDEX.md"
