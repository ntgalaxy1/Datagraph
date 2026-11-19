<?php
declare(strict_types=1);
require_once __DIR__.'/sheets-lib.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
try {
    if($_SERVER['REQUEST_METHOD']!=='POST'){http_response_code(405);throw new RuntimeException('POST required');}
    if((int)($_SERVER['CONTENT_LENGTH']??0)>8000000)throw new RuntimeException('Request too large');
    $body=json_decode(file_get_contents('php://input'),true,512,JSON_THROW_ON_ERROR);$action=$body['action']??'sync';
    if($action==='webhook') {
        $settings=sheets_settings();$auth=$_SERVER['HTTP_AUTHORIZATION']??'';$token=str_starts_with($auth,'Bearer ')?substr($auth,7):(string)($body['token']??'');
        if(empty($settings['secret'])||!hash_equals($settings['secret'],$token)){http_response_code(403);throw new RuntimeException('Invalid sync token');}
        $lock=fopen(dg_private_dir().'/sheets-sync.lock','c');
        if(!flock($lock,LOCK_EX|LOCK_NB)){http_response_code(409);throw new RuntimeException('Sync busy; scheduled reconciliation will retry');}
        try{$db=inv_db();$result=sheets_pull_rows($db,$body['rows']??[],(int)($body['sequence']??0));}finally{flock($lock,LOCK_UN);fclose($lock);}
        echo json_encode(['success'=>true,'result'=>$result]);exit;
    }
    inv_auth($body);$config=inv_config();
    if($action==='settings_get'){
        $s=$config['sheets']??[];unset($s['secret']);$s['has_secret']=!empty($config['sheets']['secret']);
        echo json_encode(['success'=>true,'settings'=>$s,'last_sync'=>!empty($config['db_name'])?inv_meta(inv_db(),'last_sync'):null]);exit;
    }
    if($action==='settings_save'){
        $s=$body['settings']??[];$id=trim((string)($s['sheet_id']??''));
        if(preg_match('~/spreadsheets/d/([a-zA-Z0-9_-]+)~',$id,$m))$id=$m[1];
        if(!preg_match('/^[a-zA-Z0-9_-]{15,200}$/D',$id))throw new InvalidArgumentException('Invalid Google Sheet ID');
        $url=trim((string)($s['webapp_url']??''));
        if(!preg_match('~^https://script\.google\.com/macros/s/[a-zA-Z0-9_-]+/exec$~D',$url))throw new InvalidArgumentException('Invalid Apps Script /exec URL');
        $secret=(string)($s['secret']??'');if($secret==='')$secret=$config['sheets']['secret']??'';
        if(strlen($secret)<32)throw new InvalidArgumentException('Sync secret must contain at least 32 characters');
        if((($config['sheets']['sheet_id']??null)!==$id || ($config['sheets']['webapp_url']??null)!==$url) && !empty($config['db_name'])) { $d=inv_db();$r=inv_lock($d);inv_set_meta($d,'last_sheet_sequence',0);$d->exec('UPDATE dg_products SET sheet_hash=NULL, dirty=1');inv_commit($d,$r); }
        $config['sheets']=['sheet_id'=>$id,'webapp_url'=>$url,'secret'=>$secret];inv_save_config($config);
        echo json_encode(['success'=>true]);exit;
    }
    if($action==='sync'){$result=sheets_sync();echo json_encode(['success'=>true,'result'=>$result,'catalog'=>inv_catalog(inv_db())],JSON_UNESCAPED_UNICODE);exit;}
    throw new RuntimeException('Unknown sync action');
}catch(Throwable $e){if(http_response_code()<400)http_response_code(400);error_log('DataGraph sheets: '.$e->getMessage());echo json_encode(['success'=>false,'error'=>$e instanceof PDOException?'Database operation failed':$e->getMessage()],JSON_UNESCAPED_UNICODE);}
