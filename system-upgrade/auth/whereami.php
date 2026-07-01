<?php
// เปิดไฟล์นี้ผ่านเบราว์เซอร์ 1 ครั้งเพื่อดู path จริง แล้วเอาไปใส่ใน .htaccess จากนั้น "ลบไฟล์นี้ทิ้ง"
header('Content-Type: text/plain; charset=utf-8');
echo "path ของโฟลเดอร์นี้คือ:\n" . __DIR__ . "\n\n";
echo "ให้แก้บรรทัด AuthUserFile ใน .htaccess เป็น:\n";
echo "AuthUserFile " . __DIR__ . "/.htpasswd\n\n";
echo "เสร็จแล้วลบ whereami.php ทิ้งด้วย\n";
