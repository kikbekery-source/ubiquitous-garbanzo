<?php
// rooms-api.php — ทะเบียน "ห้องงาน" + สถานะแจ้งเตือน (อยู่หลัง .htaccess auth)
// GET                          → คืน rooms.json ทั้งไฟล์
// POST {action:"mute",id}      → ปิดแจ้งเตือนห้องนั้น (จนกว่าจะสั่งเปิดในห้องเอง)
// POST {action:"unmute",id}    → เปิดแจ้งเตือนกลับ
// POST {action:"update",room:{...}} → agent (จาร์วิส/กาโมร่า) รายงานความคืบหน้า (upsert ตาม id)
header('Content-Type: application/json; charset=utf-8');
$FILE = __DIR__ . '/../data/rooms.json';

function load($f) {
  if (!file_exists($f)) return array('rooms' => array());
  $d = json_decode(file_get_contents($f), true);
  return is_array($d) ? $d : array('rooms' => array());
}
function save($f, $d) {
  $fp = fopen($f, 'c+');
  if (!$fp) { http_response_code(500); echo '{"ok":false,"error":"write failed"}'; exit; }
  flock($fp, LOCK_EX);
  ftruncate($fp, 0); rewind($fp);
  fwrite($fp, json_encode($d, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
  flock($fp, LOCK_UN); fclose($fp);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  echo json_encode(load($FILE), JSON_UNESCAPED_UNICODE);
  exit;
}

$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in) || empty($in['action'])) { http_response_code(400); echo '{"ok":false,"error":"bad request"}'; exit; }

$data = load($FILE);
$action = $in['action'];

if ($action === 'mute' || $action === 'unmute') {
  $found = false;
  foreach ($data['rooms'] as &$r) {
    if ($r['id'] === $in['id']) { $r['muted'] = ($action === 'mute'); $found = true; }
  }
  unset($r);
  if (!$found) { http_response_code(404); echo '{"ok":false,"error":"room not found"}'; exit; }
} elseif ($action === 'update') {
  $room = isset($in['room']) ? $in['room'] : null;
  if (!is_array($room) || empty($room['id'])) { http_response_code(400); echo '{"ok":false,"error":"room.id required"}'; exit; }
  $room['updated'] = date('Y-m-d H:i');
  $found = false;
  foreach ($data['rooms'] as &$r) {
    if ($r['id'] === $room['id']) {
      // ห้องที่โค้ชปิดเสียงไว้ ให้คงสถานะปิดเสียงเดิม — เปิดได้จากคำสั่งโค้ชเท่านั้น
      $room['muted'] = !empty($r['muted']);
      $r = array_merge($r, $room); $found = true;
    }
  }
  unset($r);
  if (!$found) { $room['muted'] = false; $data['rooms'][] = $room; }
} else {
  http_response_code(400); echo '{"ok":false,"error":"unknown action"}'; exit;
}

save($FILE, $data);
echo '{"ok":true}';
