<?php
declare(strict_types=1);
// No HTTP action is performed by this library. Archives are NEVER in the web root.
function dg_private_dir(): string {
    $root = realpath($_SERVER['DOCUMENT_ROOT'] ?? '') ?: __DIR__;
    if (PHP_SAPI === 'cli') $root = __DIR__;
    if (PHP_SAPI === 'cli' && !getenv('DATAGRAPH_PRIVATE_DIR')) throw new RuntimeException('Set DATAGRAPH_PRIVATE_DIR outside public_html for CLI backups');
    $dir = getenv('DATAGRAPH_PRIVATE_DIR') ?: dirname($root) . '/datagraph-private';
    if ($dir[0] !== '/') throw new RuntimeException('DATAGRAPH_PRIVATE_DIR must be absolute');
    if (!is_dir($dir) && !mkdir($dir, 0700, true)) throw new RuntimeException('Cannot create private directory');
    $real = realpath($dir);
    if ($real === $root || strpos($real . '/', $root . '/') === 0) throw new RuntimeException('Private directory must be outside the document root');
    return $real;
}
function dg_backups(): array {
    $dir = dg_private_dir() . '/backups';
    if (!is_dir($dir)) mkdir($dir, 0700, true);
    $files = glob($dir . '/backup-*.zip') ?: [];
    foreach ($files as $file) {
        if (filemtime($file) < time() - 30 * 86400) unlink($file);
    }
    $files = glob($dir . '/backup-*.zip') ?: [];
    rsort($files);
    return $files;
}
function dg_backup_create(): string {
    if (!class_exists('ZipArchive')) throw new RuntimeException('PHP zip extension is required');
    dg_backups();
    $dir = dg_private_dir();
    $lock = fopen($dir . '/backup.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) throw new RuntimeException('Backup already running');
    $tmp = $dir . '/backups/.working-' . bin2hex(random_bytes(6));
    $final = $dir . '/backups/backup-' . gmdate('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.zip';
    $catalogLock = fopen(__DIR__ . '/data/.catalog.lock', 'c');
    if (!$catalogLock || !flock($catalogLock, LOCK_SH)) throw new RuntimeException('Cannot lock database');
    try {
        $zip = new ZipArchive();
        if ($zip->open($tmp, ZipArchive::CREATE) !== true) throw new RuntimeException('Cannot open ZIP');
        $count = 0;
        // The production database is JSON in data/. There is no hidden SQL database.
        foreach (['data', 'uploads', 'assets'] as $folder) {
            $base = __DIR__ . '/' . $folder;
            if (!is_dir($base)) continue;
            $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($base, FilesystemIterator::SKIP_DOTS));
            foreach ($it as $file) {
                if ($file->isLink() || !$file->isFile() || in_array($file->getFilename(), ['.catalog.tmp', '.catalog.lock'], true)) continue;
                $relative = substr($file->getPathname(), strlen(__DIR__) + 1);
                if (!$zip->addFile($file->getPathname(), $relative)) throw new RuntimeException('Cannot archive ' . $relative);
                $count++;
            }
        }
        $storage = 'json';
        $configPath = dg_private_dir() . '/inventory-config.json';
        if (is_file($configPath)) {
            require_once __DIR__ . '/api/inventory-lib.php';
            $config = inv_config();
            if (!empty($config['db_name'])) {
                $storage = 'mysql'; $db = inv_db();
                $db->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
                $db->beginTransaction();
                try {
                    $sql = "SET NAMES utf8mb4;\nSET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';\n";
                    $dataSql = "START TRANSACTION;\n";
                    foreach (['dg_meta','dg_products','dg_price_audit'] as $table) {
                        $ddl = $db->query('SHOW CREATE TABLE `' . $table . '`')->fetch(PDO::FETCH_NUM)[1];
                        $sql .= $ddl . ";\n";
                        foreach ($db->query('SELECT * FROM `' . $table . '`', PDO::FETCH_ASSOC) as $row) {
                            $cols = implode(',', array_map(fn($k)=>'`'.$k.'`',array_keys($row)));
                            $vals = implode(',', array_map(fn($v)=>$v===null?'NULL':$db->quote((string)$v),array_values($row)));
                            $dataSql .= 'INSERT INTO `'.$table.'` ('.$cols.') VALUES ('.$vals.");\n";
                        }
                    }
                    $db->commit(); $sql .= $dataSql . "COMMIT;\n";
                } catch (Throwable $e) { if($db->inTransaction())$db->rollBack();throw $e; }
                $zip->addFromString('database.sql', $sql);
                $zip->addFile($configPath, 'private/inventory-config.json');
            }
        }
        $zip->addFromString('manifest.json', json_encode(['schema_version' => 2, 'created_utc' => gmdate(DATE_ATOM), 'storage' => $storage, 'files' => $count], JSON_PRETTY_PRINT));
        if (!$zip->close()) throw new RuntimeException('ZIP close failed');
        chmod($tmp, 0600);
        if (!rename($tmp, $final)) throw new RuntimeException('Atomic archive publish failed');
        return basename($final);
    } finally {
        if (is_file($tmp)) unlink($tmp);
        flock($catalogLock, LOCK_UN); fclose($catalogLock);
        flock($lock, LOCK_UN); fclose($lock);
    }
}
