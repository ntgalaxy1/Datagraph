<?php
declare(strict_types=1);
$private=sys_get_temp_dir().'/dg-mysql-'.bin2hex(random_bytes(4));mkdir($private,0700,true);putenv('DATAGRAPH_PRIVATE_DIR='.$private);
require __DIR__.'/../public/api/sheets-lib.php';
function check($b,$m){if(!$b)throw new RuntimeException($m);}
$config=['db_host'=>getenv('TEST_DB_HOST')?:'127.0.0.1','db_name'=>getenv('TEST_DB_NAME')?:'datagraph_test','db_user'=>getenv('TEST_DB_USER')?:'dgtest','db_password'=>getenv('TEST_DB_PASSWORD')?:'test-only-password'];
if(!str_ends_with($config['db_name'],'_test'))throw new RuntimeException('Use a disposable *_test database only');
inv_save_config($config);$db=inv_db();
foreach(['dg_price_audit','dg_products','dg_meta'] as $t)$db->exec('DROP TABLE IF EXISTS '.$t);
inv_schema($db);
$catalog=['categories'=>[['key'=>'cpu','persian_label'=>'پردازنده','invoice_label'=>'CPU','items'=>[['id'=>'cpu-1','name'=>'Intel Core i5 12400','price'=>100,'excel_price'=>100,'specs'=>'LGA1700','stock'=>5]]]],'laptops'=>[],'store'=>['name'=>'Test'],'stats'=>[]];
inv_seed($db,$catalog);$a=inv_catalog($db);check($a['stats']['total_parts']===1,'Migration count');
$rev=inv_lock($db);$p=inv_upsert($db,['id'=>'cpu-1','name'=>'Intel Core i5 12400','category_key'=>'cpu','price'=>200],'site',1);inv_commit($db,$rev);
check($p['initial_price']===100&&$p['price']===200&&$p['previous_price']===100,'Price history/initial preservation');check($p['specs']==='LGA1700'&&$p['stock']===5,'Unmapped fields preserved');
$rev=inv_lock($db);$p=inv_upsert($db,['kind'=>'part','category_key'=>'cpu','name'=>'  Intel   Core i5 12400  ','price'=>210],'excel');inv_commit($db,$rev);check((int)$db->query('SELECT COUNT(*) FROM dg_products')->fetchColumn()===1,'Natural-key dedup');
try{$rev=inv_lock($db);inv_upsert($db,array_merge($p,['price'=>300]),'site',1);throw new RuntimeException('Stale update unexpectedly succeeded');}catch(RuntimeException $e){$db->rollBack();check(str_contains($e->getMessage(),'changed elsewhere'),'Optimistic conflict');http_response_code(200);}
$remote=['id'=>'cpu-1','name'=>'Intel Core i5 12400','kind'=>'part','category_key'=>'cpu','specs'=>'LGA1700','price'=>400,'initial_price'=>100,'stock'=>5,'brand'=>null];
sheets_pull_rows($db,[$remote]);check(inv_product(inv_find($db,'cpu-1'))['price']===400,'Sheet authority first pull');
$rev=inv_lock($db);inv_upsert($db,array_merge($remote,['price'=>500]),'site');inv_commit($db,$rev);
sheets_pull_rows($db,[$remote]);check(inv_product(inv_find($db,'cpu-1'))['price']===500,'Unchanged sheet must not clobber pending site update');
$remote['price']=600;$r=sheets_pull_rows($db,[$remote]);check(inv_product(inv_find($db,'cpu-1'))['price']===600&&$r['sheet_won_conflicts']===1,'Changed Sheet wins conflict');
$backup=dg_backup_create();$z=new ZipArchive();$z->open($private.'/backups/'.$backup);$dump=$z->getFromName('database.sql');check(is_string($dump)&&str_contains($dump,'dg_products')&&str_contains($dump,'600'),'MySQL backup contains live database');$z->close();
// Restore the generated dump into the same disposable DB after dropping all tables.
foreach(['dg_price_audit','dg_products','dg_meta'] as $t)$db->exec('DROP TABLE '.$t);
$db->exec($dump);
check(inv_product(inv_find($db,'cpu-1'))['price']===600,'Generated SQL restores the live product price');
echo "PASS: MySQL migration, edit/history, dedup, partial import, optimistic conflicts, Sheet precedence, SQL backup/restore\n";
