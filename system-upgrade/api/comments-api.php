<?php
// comments-api.php — เก็บคอมเมนต์ปักหมุดของโค้ช (อยู่หลัง .htaccess auth)
// GET  ?page=<path>                 → {comments:[...]} ของหน้านั้น
// POST {page:"...", comments:[...]} → บันทึกทับรายการคอมเมนต์ของหน้านั้น
header('Content-Type: application/json; charset=utf-8');
$FILE = __DIR__ . '/../data/comments.json';

$all = array();
if (file_exists($FILE)) {
  $d = json_decode(file_get_contents($FILE), true);
  if (is_array($d)) $all = $d;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  $page = isset($_GET['page']) ? $_GET['page'] : '';
  $c = isset($all[$page]) ? $all[$page] : array();
  echo json_encode(array('comments' => $c), JSON_UNESCAPED_UNICODE);
  exit;
}

$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in) || !isset($in['page']) || !isset($in['comments']) || !is_array($in['comments'])) {
  http_response_code(400); echo '{"ok":false,"error":"page + comments required"}'; exit;
}

$all[$in['page']] = $in['comments'];

$fp = fopen($FILE, 'c+');
if (!$fp) { http_response_code(500); echo '{"ok":false,"error":"write failed"}'; exit; }
flock($fp, LOCK_EX);
ftruncate($fp, 0); rewind($fp);
fwrite($fp, json_encode($all, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
flock($fp, LOCK_UN); fclose($fp);

echo '{"ok":true}';
