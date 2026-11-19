<?php
$base = sys_get_temp_dir() . '/dg-test-' . bin2hex(random_bytes(5));
mkdir($base . '/site/data', 0700, true);
mkdir($base . '/site/uploads'); mkdir($base . '/site/assets');
copy(__DIR__ . '/../public/backup-lib.php', $base . '/site/backup-lib.php');
file_put_contents($base . '/site/data/catalog.json', '{"test":true}');
file_put_contents($base . '/site/uploads/example.txt', 'asset');
putenv('DATAGRAPH_PRIVATE_DIR=' . $base . '/private');
require $base . '/site/backup-lib.php';
function check($condition, $message) { if (!$condition) throw new RuntimeException($message); }
try {
    $name = dg_backup_create(); $path = $base . '/private/backups/' . $name;
    $z = new ZipArchive(); check($z->open($path) === true, 'ZIP must open');
    check($z->getFromName('data/catalog.json') === '{"test":true}', 'DB snapshot');
    check($z->getFromName('uploads/example.txt') === 'asset', 'Uploads snapshot');
    check($z->locateName('manifest.json') !== false, 'Manifest'); $z->close();
    $old = $base . '/private/backups/backup-20000101-000000-00000000.zip';
    file_put_contents($old, 'old'); touch($old, time() - 31 * 86400);
    $recent = $base . '/private/backups/backup-20200101-000000-11111111.zip';
    file_put_contents($recent, 'recent'); touch($recent, time() - 29 * 86400);
    dg_backups(); check(!file_exists($old), '31-day backup must be pruned'); check(file_exists($recent), '29-day backup must remain');
    echo "PASS: complete archive, 30-day retention, private storage\n";
} finally {
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($base, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($it as $f) { $f->isDir() ? rmdir($f->getPathname()) : unlink($f->getPathname()); }
    rmdir($base);
}
