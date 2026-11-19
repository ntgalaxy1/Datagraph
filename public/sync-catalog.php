<?php
/**
 * DataGraph Protected Admin API (cPanel / DirectAdmin)
 * فایل رمز و تنظیمات مدیریت دیتاگراف
 *
 * رمز تولید باید از طریق ops/setup-admin.php یا متغیر محیطی تنظیم شود.
 * این API هیچ رمز پیش‌فرض فعالی ندارد؛ در نبود تنظیمات، دسترسی رد می‌شود.
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$CONFIG_FILE = __DIR__ . '/data/.admin_secret.json';
$DEFAULT_PASSWORD = getenv('DATAGRAPH_ADMIN_PASSWORD') ?: '';
require_once __DIR__ . '/backup-lib.php';

function get_stored_hash($configFile, $defaultPass) {
    if (file_exists($configFile)) {
        $raw = @file_get_contents($configFile);
        $json = @json_decode($raw, true);
        if (is_array($json) && !empty($json['password_hash'])) {
            return $json['password_hash'];
        }
    }
    if ($defaultPass === '') { http_response_code(503); echo json_encode(['success' => false, 'error' => 'Admin is not configured. Run the CLI setup first.']); exit; }
    return password_hash($defaultPass, PASSWORD_DEFAULT);
}

$action = $_POST['action'] ?? $_GET['action'] ?? 'status';

if ($action === 'status') {
    echo json_encode([
        'status' => 'ready',
        'protected' => true,
        'php_enabled' => true
    ]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    exit;
}

// Small file-backed login throttle. Never trust X-Forwarded-For from clients.
$rateFile = dg_private_dir() . '/auth-' . hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'local') . '.json';
$rateHandle = fopen($rateFile, 'c+');
flock($rateHandle, LOCK_EX);
$rate = json_decode(stream_get_contents($rateHandle) ?: '{}', true) ?: [];
if (($rate['since'] ?? 0) < time() - 900) $rate = ['since' => time(), 'failures' => 0];
if (($rate['failures'] ?? 0) >= 10) {
    flock($rateHandle, LOCK_UN); fclose($rateHandle);
    http_response_code(429); echo json_encode(['success' => false, 'error' => 'Too many attempts. Try again in 15 minutes.']); exit;
}
$suppliedKey = $_POST['admin_key'] ?? '';
$storedHash = get_stored_hash($CONFIG_FILE, $DEFAULT_PASSWORD);

if (!password_verify($suppliedKey, $storedHash)) {
    $rate['failures'] = ($rate['failures'] ?? 0) + 1;
    rewind($rateHandle); ftruncate($rateHandle, 0); fwrite($rateHandle, json_encode($rate));
    flock($rateHandle, LOCK_UN); fclose($rateHandle);
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'error' => 'رمز عبور مدیریت اشتباه است.'
    ]);
    exit;
}

rewind($rateHandle); ftruncate($rateHandle, 0); fwrite($rateHandle, '{}'); flock($rateHandle, LOCK_UN); fclose($rateHandle);

// Authenticated backup management. Downloads use POST; no secrets in URLs.
if (in_array($action, ['backup_now', 'backup_list', 'backup_download'], true)) {
    try {
        if ($action === 'backup_now') {
            echo json_encode(['success' => true, 'name' => dg_backup_create()]);
        } elseif ($action === 'backup_list') {
            echo json_encode(['success' => true, 'backups' => array_map(function ($f) { return ['name' => basename($f), 'bytes' => filesize($f), 'created' => gmdate(DATE_ATOM, filemtime($f))]; }, dg_backups())]);
        } else {
            $name = $_POST['name'] ?? '';
            $files = dg_backups();
            $path = dg_private_dir() . '/backups/' . $name;
            if (!preg_match('/^backup-[0-9]{8}-[0-9]{6}-[a-f0-9]{8}\.zip$/D', $name) || !in_array($path, $files, true)) throw new RuntimeException('Backup not found');
            header('Content-Type: application/zip');
            header('Cache-Control: no-store');
            header('Content-Disposition: attachment; filename="' . $name . '"');
            header('Content-Length: ' . filesize($path));
            readfile($path);
        }
    } catch (Throwable $e) { http_response_code(400); echo json_encode(['success' => false, 'error' => $e->getMessage()]); }
    exit;
}

// 1. Verify login only
if ($action === 'login') {
    echo json_encode([
        'success' => true,
        'message' => 'ورود مدیر با موفقیت تایید شد.'
    ]);
    exit;
}

// 2. Change admin password
if ($action === 'change_password') {
    $newPass = trim($_POST['new_password'] ?? '');
    if (strlen($newPass) < 12) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'رمز عبور جدید باید حداقل ۱۲ کاراکتر باشد.'
        ]);
        exit;
    }
    $dataDir = __DIR__ . '/data';
    if (!is_dir($dataDir)) {
        mkdir($dataDir, 0755, true);
    }
    $newHash = password_hash($newPass, PASSWORD_DEFAULT);
    file_put_contents($CONFIG_FILE, json_encode(['password_hash' => $newHash], JSON_PRETTY_PRINT));
    echo json_encode([
        'success' => true,
        'message' => 'رمز مدیریت با موفقیت تغییر کرد.'
    ]);
    exit;
}

// 3. Sync entire catalog.json (after uploading new List PC.xlsm or editing prices)
if ($action === 'save_catalog') {
    $catalogJson = $_POST['catalog_json'] ?? '';
    if (empty($catalogJson)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'داده‌ای برای ذخیره‌سازی ارسال نشد.']);
        exit;
    }
    // Validate JSON
    $decoded = @json_decode($catalogJson, true);
    if (!is_array($decoded) || !isset($decoded['categories'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'ساختار فایل کاتالوگ نامعتبر است.']);
        exit;
    }

    require_once __DIR__ . '/api/inventory-lib.php';
    if (!empty(inv_config()['db_name'])) {
        try { inv_seed(inv_db(), $decoded, true); echo json_encode(['success'=>true,'message'=>'MySQL catalog updated']); }
        catch (Throwable $e) { if(http_response_code()<400)http_response_code(409); echo json_encode(['success'=>false,'error'=>$e instanceof PDOException?'Database save failed':$e->getMessage()]); }
        exit;
    }

    $dataDir = __DIR__ . '/data';
    if (!is_dir($dataDir)) {
        mkdir($dataDir, 0755, true);
    }

    unset($decoded['content']['footerCredit'], $decoded['store']['raw_footer']);
    $decoded['schema_version'] = 2;
    $catalogJson = json_encode($decoded, JSON_UNESCAPED_UNICODE);
    $lock = fopen($dataDir . '/.catalog.lock', 'c');
    flock($lock, LOCK_EX);
    file_put_contents($dataDir . '/.catalog.tmp', $catalogJson, LOCK_EX);
    rename($dataDir . '/.catalog.tmp', $dataDir . '/catalog.json');

    // Optional: also save uploaded raw .xlsm file if provided
    if (isset($_FILES['excel_file']) && $_FILES['excel_file']['error'] === UPLOAD_ERR_OK) {
        @move_uploaded_file($_FILES['excel_file']['tmp_name'], $dataDir . '/List PC.xlsm');
    }
    flock($lock, LOCK_UN); fclose($lock);

    echo json_encode([
        'success' => true,
        'message' => 'لیست کالاها و قیمت‌ها روی هاست برای تمام بازدیدکنندگان بروزرسانی شد.'
    ]);
    exit;
}

http_response_code(400);
echo json_encode(['success' => false, 'error' => 'عملیات نامشخص']);
