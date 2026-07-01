#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""footage_tool.py — ทะเบียนคลังฟุตเทจ (ระบบหลังบ้านโค้ชกิ๊ก)

หลักการ: คลิปที่โรงงานผลิตสร้างเอง "ลงทะเบียนตั้งแต่ตอนสร้าง" (register)
ของเก่าค้างสต็อกให้ Claude ดูเฟรมแล้วสร้าง plan.json มา apply ทีเดียว
ทุกคำสั่งจะจัดไฟล์เข้าโฟลเดอร์หมวดหมู่ + อัปเดตสารบัญ INDEX.md อัตโนมัติ

ใช้:
  # ลงทะเบียนตอนสร้างเสร็จ (เรียกต่อท้าย pipeline โรงงานผลิต)
  python3 footage_tool.py register --library ~/คลังคลิป --file render.mp4 \
      --cat PROD --title "ผัดไทยกุ้งสด" --source factory

  # คัดแยกของเก่า: Claude ดูเฟรมแล้วเขียน plan.json → สั่ง apply
  python3 footage_tool.py apply --library ~/คลังคลิป --plan plan.json

  # สร้างสารบัญใหม่จากทะเบียน
  python3 footage_tool.py index --library ~/คลังคลิป

รูปแบบ plan.json:
  [{"file": "/path/คลิป.mp4", "cat": "PROD", "title": "ผัดไทยกุ้งสด",
    "confidence": 0.92, "note": "เห็นขั้นตอนผัดชัด"}, ...]
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime

CATS = {
    'PROD': '01-PROD-ผลิตปรุงอาหาร',
    'PREP': '02-PREP-เตรียมของ',
    'TALK': '03-TALK-พูดคุย',
    'OTH': '04-OTH-อื่นๆ',
}
CAT_THAI = {'PROD': 'ผลิต/ปรุง', 'PREP': 'เตรียมของ', 'TALK': 'พูดคุย', 'OTH': 'อื่นๆ'}
REGISTRY = '_registry.json'
LOW_CONFIDENCE = 0.7


def load_registry(lib):
    p = os.path.join(lib, REGISTRY)
    if os.path.exists(p):
        with open(p, encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, dict) and isinstance(data.get('clips'), list):
                return data
    return {'clips': []}


def save_registry(lib, data):
    p = os.path.join(lib, REGISTRY)
    tmp = p + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    os.replace(tmp, p)


def next_number(reg, cat):
    nums = [int(m.group(1)) for c in reg['clips']
            if c.get('code', '').startswith(cat + '-')
            for m in [re.match(r'^%s-(\d+)$' % cat, c['code'])] if m]
    return max(nums, default=0) + 1


def clean_title(title):
    """ตัดอักขระที่ใช้ในชื่อไฟล์ไม่ได้ เก็บไทย/อังกฤษ/ตัวเลขไว้"""
    t = re.sub(r'[\\/:*?"<>|\s]+', '_', title.strip())
    return t.strip('_')[:60] or 'ไม่มีชื่อ'


def video_duration(path):
    try:
        out = subprocess.run(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
             '-of', 'csv=p=0', path],
            capture_output=True, text=True, timeout=30)
        return round(float(out.stdout.strip()), 1)
    except Exception:
        return None


def fmt_duration(sec):
    if sec is None:
        return '—'
    if sec < 60:
        return '%d วิ' % round(sec)
    return '%d:%02d นาที' % (sec // 60, round(sec % 60))


def unique_path(path):
    if not os.path.exists(path):
        return path
    base, ext = os.path.splitext(path)
    i = 2
    while os.path.exists('%s(%d)%s' % (base, i, ext)):
        i += 1
    return '%s(%d)%s' % (base, i, ext)


def register_one(lib, reg, file, cat, title, confidence=None, note='', source='factory'):
    if cat not in CATS:
        raise ValueError('หมวด "%s" ไม่มีในระบบ (ใช้ %s)' % (cat, '/'.join(CATS)))
    if not os.path.isfile(file):
        raise FileNotFoundError('ไม่พบไฟล์: %s' % file)

    code = '%s-%03d' % (cat, next_number(reg, cat))
    cat_dir = os.path.join(lib, CATS[cat])
    os.makedirs(cat_dir, exist_ok=True)

    ext = os.path.splitext(file)[1].lower()
    dest = unique_path(os.path.join(cat_dir, '%s_%s%s' % (code, clean_title(title), ext)))

    dur = video_duration(file)
    shutil.move(file, dest)

    entry = {
        'code': code,
        'cat': cat,
        'title': title.strip(),
        'file': os.path.relpath(dest, lib),
        'original': os.path.basename(file),
        'duration': dur,
        'confidence': confidence,
        'note': note,
        'source': source,
        'added': datetime.now().strftime('%Y-%m-%d %H:%M'),
    }
    reg['clips'].append(entry)
    return entry


def generate_index(lib, reg):
    lines = ['# 📚 สารบัญคลังฟุตเทจ',
             '> อัปเดตล่าสุด: %s · ทั้งหมด %d คลิป · ไฟล์นี้สร้างอัตโนมัติโดย footage_tool.py ห้ามแก้มือ'
             % (datetime.now().strftime('%d/%m/%Y %H:%M'), len(reg['clips'])), '']

    flagged = [c for c in reg['clips']
               if c.get('confidence') is not None and c['confidence'] < LOW_CONFIDENCE]
    if flagged:
        lines += ['## ⚠️ คลิปที่ AI ไม่มั่นใจ — โค้ชควรเปิดดูเองก่อนใช้ (%d คลิป)' % len(flagged), '']
        lines += ['- **%s** %s (มั่นใจ %d%%) — `%s`'
                  % (c['code'], c['title'], round(c['confidence'] * 100), c['file'])
                  for c in flagged]
        lines.append('')

    for cat, folder in CATS.items():
        clips = [c for c in reg['clips'] if c.get('cat') == cat]
        lines += ['## %s — %s (%d คลิป)' % (cat, CAT_THAI[cat], len(clips)), '']
        if not clips:
            lines += ['_ยังไม่มีคลิปในหมวดนี้_', '']
            continue
        lines += ['| รหัส | เรื่อง | ยาว | มั่นใจ | ที่มา | หมายเหตุ |',
                  '|---|---|---|---|---|---|']
        for c in sorted(clips, key=lambda c: c['code']):
            conf = ('%d%%' % round(c['confidence'] * 100)) if c.get('confidence') is not None else '—'
            if c.get('confidence') is not None and c['confidence'] < LOW_CONFIDENCE:
                conf = '⚠️ ' + conf
            src = {'factory': '🏭 โรงงาน', 'ai-sort': '🤖 AI คัดแยก', 'manual': '✍️ มือ'}.get(
                c.get('source'), c.get('source') or '—')
            lines.append('| %s | %s | %s | %s | %s | %s |' % (
                c['code'], c['title'], fmt_duration(c.get('duration')),
                conf, src, c.get('note') or ''))
        lines.append('')

    with open(os.path.join(lib, 'INDEX.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))


def cmd_register(args):
    reg = load_registry(args.library)
    entry = register_one(args.library, reg, args.file, args.cat, args.title,
                         note=args.note, source=args.source)
    save_registry(args.library, reg)
    generate_index(args.library, reg)
    print('✅ ลงทะเบียนแล้ว: %s → %s' % (entry['code'], entry['file']))


def cmd_apply(args):
    with open(args.plan, encoding='utf-8') as f:
        plan = json.load(f)
    if not isinstance(plan, list):
        sys.exit('plan.json ต้องเป็น list ของรายการคลิป')

    reg = load_registry(args.library)
    done, failed = 0, []
    for item in plan:
        try:
            entry = register_one(
                args.library, reg,
                item['file'], item.get('cat', 'OTH'), item.get('title', ''),
                confidence=item.get('confidence'), note=item.get('note', ''),
                source='ai-sort')
            flag = ' ⚠️' if (entry['confidence'] is not None
                             and entry['confidence'] < LOW_CONFIDENCE) else ''
            print('✅ %s → %s%s' % (entry['code'], entry['file'], flag))
            done += 1
        except Exception as e:
            failed.append((item.get('file', '?'), str(e)))
            print('❌ %s: %s' % (item.get('file', '?'), e))
    save_registry(args.library, reg)
    generate_index(args.library, reg)
    print('\nสรุป: สำเร็จ %d · พลาด %d · สารบัญอัปเดตแล้วที่ %s'
          % (done, len(failed), os.path.join(args.library, 'INDEX.md')))
    if failed:
        sys.exit(1)


def cmd_index(args):
    reg = load_registry(args.library)
    generate_index(args.library, reg)
    print('✅ สร้างสารบัญใหม่แล้ว (%d คลิป): %s'
          % (len(reg['clips']), os.path.join(args.library, 'INDEX.md')))


def main():
    ap = argparse.ArgumentParser(description='ทะเบียนคลังฟุตเทจ โค้ชกิ๊ก')
    sub = ap.add_subparsers(dest='cmd', required=True)

    r = sub.add_parser('register', help='ลงทะเบียนคลิปที่เพิ่งสร้างเสร็จ')
    r.add_argument('--library', required=True, help='โฟลเดอร์คลังคลิป')
    r.add_argument('--file', required=True, help='ไฟล์คลิปที่จะลงทะเบียน (จะถูกย้ายเข้าคลัง)')
    r.add_argument('--cat', required=True, choices=sorted(CATS), help='หมวด')
    r.add_argument('--title', required=True, help='ชื่อเรื่อง/เมนู')
    r.add_argument('--note', default='', help='หมายเหตุ')
    r.add_argument('--source', default='factory', choices=['factory', 'manual'])
    r.set_defaults(func=cmd_register)

    a = sub.add_parser('apply', help='คัดแยกของเก่าตาม plan.json ที่ Claude สร้าง')
    a.add_argument('--library', required=True)
    a.add_argument('--plan', required=True)
    a.set_defaults(func=cmd_apply)

    i = sub.add_parser('index', help='สร้างสารบัญ INDEX.md ใหม่จากทะเบียน')
    i.add_argument('--library', required=True)
    i.set_defaults(func=cmd_index)

    args = ap.parse_args()
    if hasattr(args, 'library'):
        args.library = os.path.abspath(os.path.expanduser(args.library))
        os.makedirs(args.library, exist_ok=True)
    args.func(args)


if __name__ == '__main__':
    main()
