<?php
declare(strict_types=1);
$private=sys_get_temp_dir().'/dg-installer-test-'.bin2hex(random_bytes(5));mkdir($private,0700,true);putenv('DATAGRAPH_PRIVATE_DIR='.$private);
require __DIR__.'/../public/api/install-lib.php';
function check_install($ok,$message){if(!$ok)throw new RuntimeException($message);}
$config=['db_host'=>getenv('TEST_DB_HOST')?:'127.0.0.1','db_name'=>getenv('TEST_DB_NAME')?:'datagraph_test','db_user'=>getenv('TEST_DB_USER')?:'dgtest','db_password'=>getenv('TEST_DB_PASSWORD')?:'test-only-password'];
if(!str_ends_with($config['db_name'],'_test'))throw new RuntimeException('Disposable *_test DB only');
$db=inv_db($config);foreach(['dg_price_audit','dg_products','dg_meta'] as $t)$db->exec('DROP TABLE IF EXISTS '.$t);
$installed=dg_install_database($config);
check_install($installed['installation']['parts']>0,'Migrates real catalog');
check_install(is_file($private.'/install.complete.json'),'Completion marker');
check_install(is_file($private.'/inventory-config.json'),'Private configuration generated');
check_install((fileperms($private.'/inventory-config.json')&0777)===0600,'Private config permissions');
check_install(is_file($private.'/backups/'.$installed['installation']['backup']),'Pre-install backup');
try{dg_install_database($config);throw new RuntimeException('Unexpected reinstall');}catch(RuntimeException $e){check_install(str_contains($e->getMessage(),'locked'),'Reinstall refused');}
// Simulate a previous run that committed MySQL but failed just before config publish.
unlink($private.'/install.complete.json');unlink($private.'/inventory-config.json');
$token=inv_meta($db,'install_token');$seed=file_get_contents(__DIR__.'/../public/data/catalog.json');
$target=hash('sha256',$config['db_host'].'|'.$config['db_name']);
$first=$db->query('SELECT product_id FROM dg_products LIMIT 1')->fetchColumn();$rev=inv_lock($db);$row=inv_product(inv_find($db,$first));inv_upsert($db,array_merge($row,['price'=>987654321]),'site');inv_commit($db,$rev);
dg_install_private_json('mysql-install-journal.json',['target'=>$target,'seed_hash'=>hash('sha256',$seed),'install_token'=>$token,'backup'=>$installed['installation']['backup']]);
$resumed=dg_install_database($config);
check_install(inv_product(inv_find($db,$first))['price']===987654321,'Resume must not reseed committed data');
check_install(dg_install_locked(),'Resume locks setup');
echo "PASS installer: tables + real catalog migration, pre-backup, private config, permanent lock, interrupted-install resume\n";
