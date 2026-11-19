<?php
if (PHP_SAPI !== 'cli') exit(1);
// Set password via environment, never command-line arguments or source control.
$root = $argv[1] ?? '';
$password = getenv('DATAGRAPH_ADMIN_PASSWORD') ?: '';
if (!is_dir($root . '/data') || strlen($password) < 12) { fwrite(STDERR, "Usage: DATAGRAPH_ADMIN_PASSWORD environment (12+ chars), php setup-admin.php /absolute/public_html\n"); exit(1); }
$path = $root . '/data/.admin_secret.json';
file_put_contents($path, json_encode(['password_hash' => password_hash($password, PASSWORD_DEFAULT)]), LOCK_EX);
chmod($path, 0600);
echo "Admin configured. Unset the environment variable now.\n";
