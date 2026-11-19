<?php
declare(strict_types=1);
require_once __DIR__.'/inventory-lib.php';
function dg_install_locked(): bool {
    return is_file(dg_private_dir().'/install.complete.json') || !empty(inv_config()['db_name']);
}
function dg_install_private_json(string $name,array $data): void {
    $dir=dg_private_dir();$temp=tempnam($dir,'.setup-');
    if($temp===false)throw new RuntimeException('Cannot write private installation state');
    chmod($temp,0600);
    try {
        if(file_put_contents($temp,json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),LOCK_EX)===false)throw new RuntimeException('Cannot save private installation state');
        if(!rename($temp,$dir.'/'.$name))throw new RuntimeException('Cannot publish private installation state');
    }finally{if(is_file($temp))unlink($temp);}
}
/** Admin authentication MUST be performed by the caller before this function. */
function dg_install_database(array $input): array {
    foreach(['pdo_mysql','mbstring','zip'] as $ext)if(!extension_loaded($ext))throw new RuntimeException('Required PHP extension missing: '.$ext);
    $dir=dg_private_dir();$handle=fopen($dir.'/mysql-installer.lock','c');
    if(!$handle||!flock($handle,LOCK_EX|LOCK_NB))throw new RuntimeException('Another installation is running. Wait, then retry.');
    $db=null;$advisory=false;$lockName='';
    try {
        if(dg_install_locked())throw new RuntimeException('Installation is locked. The existing database/configuration was not changed.');
        $old=inv_config();
        $config=array_merge($old,array_intersect_key($input,array_flip(['db_host','db_name','db_user','db_password'])));
        foreach(['db_host','db_name','db_user','db_password'] as $key)if(!isset($config[$key])||!is_string($config[$key])||$config[$key]==='')throw new InvalidArgumentException('Complete all database fields');
        $seedPath=dirname(__DIR__).'/data/catalog.json';
        if(!is_file($seedPath))throw new RuntimeException('data/catalog.json is missing. Upload the installer beside your existing site files.');
        $seedText=file_get_contents($seedPath);$seed=json_decode($seedText,true,512,JSON_THROW_ON_ERROR);
        if(!is_array($seed['categories']??null)||!is_array($seed['laptops']??null)||!isset($seed['store']))throw new RuntimeException('Invalid JSON catalog; restore the source catalog before installing');
        $db=inv_db($config);
        $lockName='dg_install_'.substr(hash('sha256',$config['db_host'].'|'.$config['db_name']),0,40);
        $q=$db->prepare('SELECT GET_LOCK(?, 0)');$q->execute([$lockName]);
        if((int)$q->fetchColumn()!==1)throw new RuntimeException('Database installation is busy');$advisory=true;
        $target=hash('sha256',$config['db_host'].'|'.$config['db_name']);
        $seedHash=hash('sha256',$seedText);$journalPath=$dir.'/mysql-install-journal.json';
        $journal=is_file($journalPath)?json_decode(file_get_contents($journalPath),true,512,JSON_THROW_ON_ERROR):null;
        if($journal && (($journal['target']??'')!==$target||($journal['seed_hash']??'')!==$seedHash))throw new RuntimeException('An unfinished installation targets a different database/catalog. Review the private journal; do not overwrite existing tables.');
        $existing=$db->query("SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('dg_meta','dg_products','dg_price_audit')")->fetchAll(PDO::FETCH_COLUMN);
        if(!$journal){
            if($existing)throw new RuntimeException('This database already contains DataGraph tables. Use a new empty database; nothing was overwritten.');
            $journal=['target'=>$target,'seed_hash'=>$seedHash,'install_token'=>bin2hex(random_bytes(24)),'backup'=>dg_backup_create(),'started_at'=>gmdate(DATE_ATOM)];
            dg_install_private_json('mysql-install-journal.json',$journal);
        }
        if($existing && in_array('dg_meta',$existing,true)){
            $owner=inv_meta($db,'install_token');
            if($owner!==null&&!hash_equals($journal['install_token'],(string)$owner))throw new RuntimeException('Database belongs to a different installation. No data changed.');
            if($owner===null && inv_meta($db,'catalog')!==null)throw new RuntimeException('Existing catalog has no matching installer journal; refused to overwrite');
        }
        inv_schema($db);
        inv_set_meta($db,'install_token',$journal['install_token']);
        if(inv_meta($db,'catalog')===null)inv_seed($db,$seed);
        // A retry after a filesystem/config error resumes committed data, never reseeds it.
        $catalog=inv_catalog($db);
        inv_save_config($config);
        $result=['installed_at'=>gmdate(DATE_ATOM),'parts'=>$catalog['stats']['total_parts'],'laptops'=>$catalog['stats']['total_laptops'],'backup'=>$journal['backup']];
        // A committed config is itself a permanent lock even if this extra marker
        // cannot be written (e.g. disk becoming full immediately after commit).
        try{dg_install_private_json('install.complete.json',$result);}catch(Throwable $e){error_log('DataGraph completion marker: '.$e->getMessage());}
        @unlink($journalPath);
        return ['catalog'=>$catalog,'installation'=>$result];
    } finally {
        if($db&&$db->inTransaction())$db->rollBack();
        if($db&&$advisory){try{$release=$db->prepare('SELECT RELEASE_LOCK(?)');$release->execute([$lockName]);}catch(Throwable $e){/* connection closes automatically */}}
        flock($handle,LOCK_UN);fclose($handle);
    }
}
