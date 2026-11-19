<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/backup-lib.php';
function inv_config(): array {
    $file = dg_private_dir() . '/inventory-config.json';
    return is_file($file) ? json_decode(file_get_contents($file), true, 512, JSON_THROW_ON_ERROR) : [];
}
function inv_save_config(array $config): void {
    $path = dg_private_dir() . '/inventory-config.json';
    $tmp = tempnam(dg_private_dir(), '.inv-'); chmod($tmp, 0600);
    file_put_contents($tmp, json_encode($config, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), LOCK_EX);
    rename($tmp, $path);
}
function inv_db(?array $c = null): PDO {
    $c = $c ?? inv_config();
    if (empty($c['db_name'])) throw new RuntimeException('MySQL is not configured. Open database settings.');
    foreach (['db_host', 'db_name'] as $key) if (!preg_match('/^[a-zA-Z0-9_.-]+$/D', $c[$key] ?? '')) throw new InvalidArgumentException('Invalid database host/name');
    $db = new PDO('mysql:host=' . $c['db_host'] . ';dbname=' . $c['db_name'] . ';charset=utf8mb4', $c['db_user'], $c['db_password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]);
    $db->exec("SET time_zone = '+00:00'"); return $db;
}
function inv_schema(PDO $db): void {
    $sql = file_get_contents(__DIR__ . '/schema.sql');
    foreach (explode(';', $sql) as $statement) if (trim($statement)) $db->exec($statement);
    $db->exec("INSERT IGNORE INTO dg_meta (meta_key, value_json) VALUES ('revision', '0')");
}
function inv_meta(PDO $db, string $key, $default = null) {
    $stmt = $db->prepare('SELECT value_json FROM dg_meta WHERE meta_key=?'); $stmt->execute([$key]);
    $v = $stmt->fetchColumn(); return $v === false ? $default : json_decode($v, true, 512, JSON_THROW_ON_ERROR);
}
function inv_set_meta(PDO $db, string $key, $value): void {
    $db->prepare('INSERT INTO dg_meta(meta_key,value_json) VALUES (?,?) ON DUPLICATE KEY UPDATE value_json=VALUES(value_json)')->execute([$key, json_encode($value, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);
}
function inv_lock(PDO $db): int {
    $db->beginTransaction();
    $revision = (int)$db->query("SELECT value_json FROM dg_meta WHERE meta_key='revision' FOR UPDATE")->fetchColumn();
    return $revision;
}
function inv_commit(PDO $db, int $revision): void { inv_set_meta($db, 'revision', $revision + 1); $db->commit(); }
function inv_auth(array $body): void {
    $key = $_SERVER['HTTP_X_ADMIN_KEY'] ?? ($body['admin_key'] ?? '');
    $file = dirname(__DIR__) . '/data/.admin_secret.json';
    $hash = is_file($file) ? (json_decode(file_get_contents($file), true)['password_hash'] ?? '') : '';
    $ratePath = dg_private_dir() . '/inv-rate-' . hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'cli');
    $h = fopen($ratePath, 'c+'); flock($h, LOCK_EX);
    $rate = json_decode(stream_get_contents($h) ?: '{}', true) ?: [];
    if (($rate['since'] ?? 0) < time() - 900) $rate = ['since' => time(), 'count' => 0];
    $locked = ($rate['count'] ?? 0) >= 15;
    $ok = !$locked && $hash !== '' && password_verify((string)$key, $hash);
    if (!$ok) $rate['count'] = ($rate['count'] ?? 0) + 1;
    else $rate = [];
    rewind($h); ftruncate($h, 0); fwrite($h, json_encode($rate)); flock($h, LOCK_UN); fclose($h);
    if (!$ok) { http_response_code($locked ? 429 : 403); throw new RuntimeException('Admin authorization required'); }
}
function inv_money($value): ?int {
    if ($value === null || $value === '') return null;
    if (!is_numeric($value) || (float)$value < 0 || (float)$value > 999999999999999) throw new InvalidArgumentException('Invalid non-negative price');
    return (int)round((float)$value);
}
function inv_norm(string $s): string { return preg_replace('/\s+/u', ' ', trim(strtolower(str_replace(['ي','ك'], ['ی','ک'], $s)))); }
function inv_row(array $r): array {
    $name = trim((string)($r['name'] ?? $r['model'] ?? ''));
    if ($name === '' || strlen($name) > 2000) throw new InvalidArgumentException('Product name is required (max 2000 bytes)');
    $kind = ($r['kind'] ?? 'part') === 'laptop' ? 'laptop' : 'part';
    $cat = $kind === 'laptop' ? 'laptop' : trim((string)($r['category_key'] ?? $r['category'] ?? 'other'));
    if (!preg_match('/^[a-zA-Z0-9_-]{1,100}$/D', $cat)) throw new InvalidArgumentException('Category must use a known key');
    $stock = $r['stock'] ?? null;
    if ($stock === '') $stock = null;
    if ($stock !== null && (filter_var($stock, FILTER_VALIDATE_INT) === false || (int)$stock < 0)) throw new InvalidArgumentException('Stock must be a non-negative integer');
    if (array_key_exists('hyperlink', $r) && $r['hyperlink'] !== null && $r['hyperlink'] !== '') {
        if (!preg_match('~^https?://~i', (string)$r['hyperlink'])) $r['hyperlink'] = null;
    }
    $r['name'] = $name; $r['kind'] = $kind; $r['category_key'] = $cat;
    $r['price'] = inv_money($r['price'] ?? null); $r['stock'] = $stock === null ? null : (int)$stock;
    $r['specs'] = mb_substr((string)($r['specs'] ?? ''), 0, 10000);
    if (array_key_exists('initial_price', $r)) $r['initial_price'] = inv_money($r['initial_price']);
    $r['natural_key'] = hash('sha256', inv_norm($kind . '|' . $cat . '|' . $name));
    return $r;
}
function inv_hash(array $r): string {
    $r = inv_row($r);
    return hash('sha256', json_encode(array_map(fn($key) => $r[$key] ?? null, ['kind','category_key','name','specs','price','stock','initial_price','brand']), JSON_UNESCAPED_UNICODE));
}
function inv_find(PDO $db, string $id): ?array {
    $s = $db->prepare('SELECT * FROM dg_products WHERE product_id=?'); $s->execute([$id]); return $s->fetch(PDO::FETCH_ASSOC) ?: null;
}
function inv_product(array $dbrow): array {
    $r = json_decode($dbrow['payload_json'], true);
    foreach (['product_id' => 'id', 'category_key' => 'category_key', 'kind' => 'kind', 'name' => 'name', 'specs' => 'specs'] as $a => $b) $r[$b] = $dbrow[$a];
    foreach (['price', 'initial_price', 'previous_price', 'stock', 'revision'] as $key) $r[$key] = $dbrow[$key] === null ? null : (int)$dbrow[$key];
    if ($r['kind'] === 'laptop') { $r['model'] = $r['name']; $r['raw_model'] = $r['name']; }
    else $r['raw_name'] = $r['name'];
    $r['excel_price'] = $r['price']; $r['has_override'] = false; $r['sync_pending'] = (bool)$dbrow['dirty'];
    return $r;
}
function inv_upsert(PDO $db, array $input, string $source, ?int $expected = null): array {
    $r = inv_row($input); $id = trim((string)($r['id'] ?? ''));
    if ($id !== '' && strlen($id) > 191) throw new InvalidArgumentException('ID too long');
    $old = $id !== '' ? inv_find($db, $id) : null;
    if (!$old) { $s = $db->prepare('SELECT * FROM dg_products WHERE natural_key=?'); $s->execute([$r['natural_key']]); $old = $s->fetch(PDO::FETCH_ASSOC) ?: null; }
    if ($expected !== null && (!$old || (int)$old['revision'] !== $expected)) { http_response_code(409); throw new RuntimeException('Row changed elsewhere. Reload before saving.'); }
    if ($old) $r = inv_row(array_merge(inv_product($old), $input));
    if ($old) $id = $old['product_id'];
    elseif ($id === '') $id = 'p_' . bin2hex(random_bytes(12));
    $initial = array_key_exists('initial_price', $r) ? $r['initial_price'] : ($old ? ($old['initial_price'] === null ? null : (int)$old['initial_price']) : $r['price']);
    $r['initial_price'] = $initial;
    if ($old && $source !== 'sheet' && inv_hash($r) === inv_hash(inv_product($old)) && ($r['hyperlink'] ?? null) === (inv_product($old)['hyperlink'] ?? null)) return inv_product($old);
    $oldPrice = $old ? ($old['price'] === null ? null : (int)$old['price']) : null;
    $previous = $old && $oldPrice === $r['price'] ? ($old['previous_price'] === null ? null : (int)$old['previous_price']) : $oldPrice;
    $revision = $old ? (int)$old['revision'] + 1 : 1;
    $sheetHash = $source === 'sheet' ? inv_hash($r) : ($old['sheet_hash'] ?? null);
    $dirty = $source === 'sheet' ? 0 : 1;
    $payload = array_merge($old ? json_decode($old['payload_json'], true) : [], $r, ['id' => $id]);
    $sql = 'INSERT INTO dg_products(product_id,natural_key,kind,category_key,name,specs,price,initial_price,previous_price,stock,revision,payload_json,sheet_hash,dirty) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE natural_key=VALUES(natural_key),kind=VALUES(kind),category_key=VALUES(category_key),name=VALUES(name),specs=VALUES(specs),price=VALUES(price),initial_price=VALUES(initial_price),previous_price=VALUES(previous_price),stock=VALUES(stock),revision=VALUES(revision),payload_json=VALUES(payload_json),sheet_hash=VALUES(sheet_hash),dirty=VALUES(dirty)';
    // Never let a name collision silently update another ID through ON DUPLICATE KEY.
    $check = $db->prepare('SELECT product_id FROM dg_products WHERE natural_key=? AND product_id<>?'); $check->execute([$r['natural_key'], $id]);
    if ($check->fetchColumn()) throw new InvalidArgumentException('Duplicate category/model; use its existing ID');
    $db->prepare($sql)->execute([$id,$r['natural_key'],$r['kind'],$r['category_key'],$r['name'],$r['specs'],$r['price'],$initial,$previous,$r['stock'],$revision,json_encode($payload, JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$sheetHash,$dirty]);
    if (!$old || $oldPrice !== $r['price']) $db->prepare('INSERT INTO dg_price_audit(product_id,old_price,new_price,source) VALUES(?,?,?,?)')->execute([$id,$oldPrice,$r['price'],$source]);
    return inv_product(inv_find($db,$id));
}
function inv_catalog(PDO $db): array {
    $ownTransaction = !$db->inTransaction();
    if ($ownTransaction) $db->beginTransaction();
    try {
    $meta = inv_meta($db,'catalog'); if (!$meta) throw new RuntimeException('Run database migration first');
    $map = []; foreach ($meta['categories'] as &$cat) { $cat['items'] = []; $map[$cat['key']] = &$cat; } unset($cat);
    $meta['laptops'] = [];
    foreach ($db->query('SELECT * FROM dg_products ORDER BY category_key, name')->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $r = inv_product($row);
        if ($r['kind'] === 'laptop') $meta['laptops'][] = array_merge(['row'=>0,'raw_model'=>$r['name'],'brand'=>'OTHER','brand_color'=>'#D43342','brand_label'=>'OTHER','excel_fill_rgb'=>null],$r);
        else {
            if (!isset($map[$r['category_key']])) {
                $meta['categories'][] = ['key'=>$r['category_key'],'persian_label'=>$r['category_key'],'invoice_label'=>$r['category_key'],'sheet_header'=>$r['category_key'],'col_name'=>0,'col_price'=>0,'invoice_row'=>null,'in_pc_invoice'=>true,'items'=>[]];
                $map[$r['category_key']] = &$meta['categories'][count($meta['categories'])-1];
            }
            $map[$r['category_key']]['items'][] = array_merge(['row'=>0,'hyperlink'=>null],$r);
        }
    }
    $total=0;$priced=0;$linked=0;
    foreach ($meta['categories'] as &$c) { $c['count']=count($c['items']); $c['priced_count']=count(array_filter($c['items'], fn($i)=>($i['price']??0)>0));$c['hyperlink_count']=count(array_filter($c['items'],fn($i)=>!empty($i['hyperlink'])));$total+=$c['count'];$priced+=$c['priced_count'];$linked+=$c['hyperlink_count']; } unset($c);
    $meta['stats']=['total_parts'=>$total,'priced_parts'=>$priced,'hyperlinked_parts'=>$linked,'total_categories'=>count($meta['categories']),'total_laptops'=>count($meta['laptops']),'priced_laptops'=>count(array_filter($meta['laptops'],fn($i)=>($i['price']??0)>0))];
    $meta['_revision']=(int)inv_meta($db,'revision',0);$meta['_storage']='mysql';
    unset($meta['content']['footerCredit'],$meta['store']['raw_footer']);
    if ($ownTransaction) $db->commit();
    return $meta;
    } catch (Throwable $e) { if ($ownTransaction && $db->inTransaction()) $db->rollBack(); throw $e; }
}
function inv_seed(PDO $db, array $catalog, bool $replace = false): void {
    $revision = inv_lock($db);
    try {
        if (!$replace && inv_meta($db,'catalog')) throw new RuntimeException('Migration already completed; data was not overwritten');
        if ($replace && (int)($catalog['_revision'] ?? -1) !== $revision) { http_response_code(409); throw new RuntimeException('Catalog changed. Reload before saving settings.'); }
        $ids=[];
        foreach ($catalog['categories'] as &$cat) {
            foreach ($cat['items'] as $item) { $item['kind']='part';$item['category_key']=$cat['key'];$saved=inv_upsert($db,$item,'migration');$ids[]=$saved['id']; }
            $cat['items']=[];
        } unset($cat);
        foreach ($catalog['laptops'] as $item) { $item['kind']='laptop';$item['name']=$item['model'];$saved=inv_upsert($db,$item,'migration');$ids[]=$saved['id']; }
        if ($replace) {
            // Explicit full-catalog admin changes retain the prior UI's delete semantics.
            $keep=array_fill_keys($ids,true);
            foreach ($db->query('SELECT product_id FROM dg_products')->fetchAll(PDO::FETCH_COLUMN) as $id) if (!isset($keep[$id])) $db->prepare('DELETE FROM dg_products WHERE product_id=?')->execute([$id]);
        }
        $catalog['laptops']=[];unset($catalog['_revision'],$catalog['_storage'],$catalog['content']['footerCredit'],$catalog['store']['raw_footer']);
        inv_set_meta($db,'catalog',$catalog); inv_commit($db,$revision);
    } catch (Throwable $e) { if($db->inTransaction())$db->rollBack();throw $e; }
}
