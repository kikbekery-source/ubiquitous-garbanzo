<?php
// comments-api.php — เก็บคอมเมนต์ปักหมุดของโค้ช (อยู่หลัง .htaccess auth)
// GET  ?page=<path>                 → {comments:[...]} ของหน้านั้น
// POST {page:"...", comments:[...]} → บันทึกทับรายการคอมเมนต์ของหน้านั้น
header('Content-Type: application/json; charset=utf-8');
$FILE = __DIR__ . '/../data/comments.json';
$MAX_COMMENTS_PER_PAGE = 500;

function fail($code, $msg) {
  http_response_code($code);
  echo json_encode(array('ok' => false, 'error' => $msg));
  exit;
}

// อ่าน+แก้+เขียน ภายใต้ lock เดียวกัน — กันคอมเมนต์สองหน้าบันทึกพร้อมกันแล้วทับกันหาย
function withFile($file, $write, $fn) {
  $fp = fopen($file, 'c+');
  if (!$fp) fail(500, 'cannot open data file');
  flock($fp, $write ? LOCK_EX : LOCK_SH);
  $raw = stream_get_contents($fp);
  $data = json_decode($raw, true);
  if (!is_array($data)) $data = array();
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
  $page = isset($_GET['page']) && is_string($_GET['page']) ? $_GET['page'] : '';
  $c = withFile($FILE, false, function (&$data) use ($page) {
    return isset($data[$page]) && is_array($data[$page]) ? $data[$page] : array();
  });
  echo json_encode(array('comments' => $c), JSON_UNESCAPED_UNICODE);
  exit;
}

$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in) || !isset($in['page']) || !is_string($in['page'])
    || !isset($in['comments']) || !is_array($in['comments'])) {
  fail(400, 'page (string) + comments (list) required');
}
if (count($in['comments']) > $MAX_COMMENTS_PER_PAGE) {
  fail(413, 'too many comments (max ' . $MAX_COMMENTS_PER_PAGE . ')');
}

withFile($FILE, true, function (&$data) use ($in) {
  $data[$in['page']] = $in['comments'];
  return null;
});

echo '{"ok":true}';
