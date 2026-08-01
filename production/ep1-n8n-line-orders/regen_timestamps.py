#!/usr/bin/env python3
"""Regenerate the 8 narration lines via ElevenLabs with-timestamps and rebuild
audio_meta.json with phrase-level word timings (Whisper is unusable for Thai)."""
import base64
import json
import os
import re
import subprocess
import sys
import urllib.request

VOICE = "OeVmyiPzojQWoTlEJLRA"
MODEL = "eleven_v3"
KEY = os.environ["ELEVENLABS_API_KEY"]
URL = (
    f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}/with-timestamps"
    "?output_format=mp3_44100_128"
)

# spoken lines = the 4-space-indented blocks of SCRIPT.md, in order
script = open("SCRIPT.md", encoding="utf-8").read()
lines = [m.strip() for m in re.findall(r"^    (\S.*)$", script, flags=re.M)]
assert len(lines) == 8, f"expected 8 spoken lines, got {len(lines)}"

meta = json.load(open("audio_meta.json"))
assert len(meta["voices"]) == 8

for i, text in enumerate(lines, start=1):
    nn = f"{i:02d}"
    body = json.dumps({"text": text, "model_id": MODEL, "language_code": "th"}).encode()
    req = urllib.request.Request(
        URL, data=body,
        headers={"xi-api-key": KEY, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        res = json.load(r)
    mp3 = base64.b64decode(res["audio_base64"])
    open(f"assets/voice/{nn}.mp3", "wb").write(mp3)
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", f"assets/voice/{nn}.mp3",
         "-ar", "44100", "-ac", "1", f"assets/voice/{nn}.wav"],
        check=True,
    )
    dur = float(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", f"assets/voice/{nn}.wav"],
        capture_output=True, text=True, check=True,
    ).stdout.strip())

    al = res["alignment"]
    chars, starts, ends = (
        al["characters"],
        al["character_start_times_seconds"],
        al["character_end_times_seconds"],
    )
    # map whitespace-delimited phrase tokens onto the char timeline
    words, pos = [], 0
    for wi, tok in enumerate(text.split()):
        # skip whitespace chars in the alignment stream
        while pos < len(chars) and chars[pos].isspace():
            pos += 1
        tok_chars = list(tok)
        if pos + len(tok_chars) > len(chars):
            print(f"  line {nn}: alignment shorter than text at token {wi}", file=sys.stderr)
            break
        seg = "".join(chars[pos:pos + len(tok_chars)])
        if seg != tok:
            print(f"  line {nn}: mismatch {seg!r} != {tok!r} — realigning", file=sys.stderr)
        words.append({
            "id": wi,
            "text": tok,
            "start": round(starts[pos], 3),
            "end": round(ends[pos + len(tok_chars) - 1], 3),
        })
        pos += len(tok_chars)

    # listen-gate: the audio must transcribe back close to the script
    import difflib, tempfile, shutil
    td = tempfile.mkdtemp()
    subprocess.run(["npx", "hyperframes", "transcribe", f"assets/voice/{nn}.wav",
                    "--model", "small", "--language", "th", "--dir", td],
                   capture_output=True, cwd=".")
    heard = ""
    try:
        heard = " ".join(w["text"] for w in json.load(open(f"{td}/transcript.json")))
    except Exception:
        pass
    shutil.rmtree(td, ignore_errors=True)
    norm = lambda t: re.sub(r"[\s\u0e48-\u0e4c]", "", t)
    ratio = difflib.SequenceMatcher(None, norm(text), norm(heard)).ratio()
    print(f"  listen-gate {nn}: ratio={ratio:.2f} heard[:60]={heard[:60]!r}")
    if ratio < 0.5:
        sys.exit(f"line {nn} FAILED listen-gate (ratio {ratio:.2f}) — not shipping garbled audio")

    v = meta["voices"][i - 1]
    v["duration_s"] = round(dur, 3)
    v["words"] = words
    print(f"line {nn}: {dur:.2f}s · {len(words)} tokens · last end {words[-1]['end']}s")

json.dump(meta, open("audio_meta.json", "w"), ensure_ascii=False, indent=2)
print("audio_meta.json rebuilt")
