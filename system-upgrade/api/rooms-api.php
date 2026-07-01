<?php
// rooms-api.php — ทะเบียน "ห้องงาน" + สถานะแจ้งเตือน (อยู่หลัง .htaccess auth)
// GET                          → คืน rooms.json ทั้งไฟล์
// POST {action:"mute",id}      → ปิดแจ้งเตือนห้องนั้น (จนกว่าจะสั่งเปิดในห้องเอง)
// POST {action:"unmute",id}    → เปิดแจ้งเตือนกลับ
// POST {action:"update",room:{...}} → agent (จาร์วิส/กาโมร่า) รายงานความคืบหน้า (upsert ตาม id)
header('Content-Type: application/json; charset=utf-8');
$FILE = __DIR__ . '/../data/rooms.json';
$MAX_ROOMS = 200; // กันไฟล์บวมจาก agent ที่ตั้ง id มั่ว

function fail($code, $msg) {
  http_response_code($code);
  echo json_encode(array('ok' => false, 'error' => $msg));
  exit;
}

// อ่าน+แก้+เขียน ภายใต้ lock เดียวกันทั้งหมด — กันสองคนบันทึกพร้อมกันแล้วข้อมูลทับกันหาย
function withFile($file, $write, $fn) {
  $fp = fopen($file, 'c+');
  if (!$fp) fail(500, 'cannot open data file');
  flock($fp, $write ? LOCK_EX : LOCK_SH);
  $raw = stream_get_contents($fp);
  $data = json_decode($raw, true);
  if (!is_array($data) || !isset($data['rooms']) || !is_array($data['rooms'])) {
    $data = array('rooms' => array());
  }
  $result = $fn($data);
  if ($write) {
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    fflush($fp);
  }
  flock($fp, LOCK_UN);
  fclose($fp);
  return $result;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  $out = withFile($FILE, false, function (&$data) { return $data; });
  echo json_encode($out, JSON_UNESCAPED_UNICODE);
  exit;
}

$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in) || empty($in['action'])) fail(400, 'bad request');
$action = $in['action'];

if ($action === 'mute' || $action === 'unmute') {
  if (empty($in['id']) || !is_string($in['id'])) fail(400, 'id required');
  $found = withFile($FILE, true, function (&$data) use ($in, $action) {
    $found = false;
    foreach ($data['rooms'] as &$r) {
      if (isset($r['id']) && $r['id'] === $in['id']) { $r['muted'] = ($action === 'mute'); $found = true; }
    }
    unset($r);
    return $found;
  });
  if (!$found) fail(404, 'room not found');
} elseif ($action === 'update') {
  $room = isset($in['room']) ? $in['room'] : null;
  if (!is_array($room) || empty($room['id']) || !is_string($room['id'])) fail(400, 'room.id required');
  $room['updated'] = date('Y-m-d H:i');
  $err = withFile($FILE, true, function (&$data) use ($room) {
    $found = false;
    foreach ($data['rooms'] as &$r) {
      if (isset($r['id']) && $r['id'] === $room['id']) {
        // ห้องที่โค้ชปิดเสียงไว้ ให้คงสถานะปิดเสียงเดิม — เปิดได้จากคำสั่งโค้ชเท่านั้น
        $room['muted'] = !empty($r['muted']);
        $r = array_merge($r, $room);
        $found = true;
      }
    }
    unset($r);
    if (!$found) {
      global $MAX_ROOMS;
      if (count($data['rooms']) >= $MAX_ROOMS) return 'too many rooms (' . $MAX_ROOMS . ') — ลบห้องเก่าออกก่อน';
      $room['muted'] = false;
      $data['rooms'][] = $room;
    }
    return null;
  });
  if ($err) fail(409, $err);
} else {
  fail(400, 'unknown action');
}

echo '{"ok":true}';
