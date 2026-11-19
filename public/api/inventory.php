<?php
declare(strict_types=1);
require_once __DIR__ . '/inventory-lib.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
try {
    if ((int)($_SERVER['CONTENT_LENGTH']??0)>10000000) throw new RuntimeException('Request too large');
    $body = $_SERVER['REQUEST_METHOD']==='POST' ? json_decode(file_get_contents('php://input'),true,512,JSON_THROW_ON_ERROR) : [];
    $action = $body['action'] ?? $_GET['action'] ?? 'catalog';
    if ($action==='catalog') {
        $config=inv_config();
        if (!empty($config['db_name'])) $catalog=inv_catalog(inv_db());
        else { $catalog=json_decode(file_get_contents(dirname(__DIR__).'/data/catalog.json'),true);$catalog['_storage']='json'; }
        echo json_encode(['success'=>true,'catalog'=>$catalog],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;
    }
    if ($_SERVER['REQUEST_METHOD']!=='POST') { http_response_code(405);throw new RuntimeException('POST required'); }
    if ((int)($_SERVER['CONTENT_LENGTH']??0)>10000000) throw new RuntimeException('Request too large');
    inv_auth($body);
    if ($action==='status') {
        $config=inv_config();echo json_encode(['success'=>true,'configured'=>!empty($config['db_name']),'db_host'=>$config['db_host']??'localhost','db_name'=>$config['db_name']??'','db_user'=>$config['db_user']??'']);exit;
    }
    if ($action==='configure_database') {
        require_once __DIR__.'/install-lib.php';
        $installation=dg_install_database($body);$db=inv_db();
        echo json_encode(['success'=>true,'catalog'=>inv_catalog($db)],JSON_UNESCAPED_UNICODE);exit;
    }
    $db=inv_db();
    if ($action==='row_patch' || $action==='row_add' || $action==='row_delete' || $action==='import') {
        $rev=inv_lock($db);
        try {
            if ($action==='import') {
                if ((int)($body['catalog_revision']??-1)!==$rev) {http_response_code(409);throw new RuntimeException('Catalog changed during import preview. Reload and retry.');}
                $rows=$body['rows']??[];if(count($rows)>5000)throw new RuntimeException('Maximum 5000 import rows per batch');
                $seen=[]; foreach($rows as $index=>$row) {
                    $r=inv_row($row);$key=!empty($r['id'])?$r['id']:$r['natural_key'];
                    if(isset($seen[$key]))throw new RuntimeException('Duplicate row inside import: '.($index+2));
                    if(isset($seen['natural:'.$r['natural_key']]))throw new RuntimeException('Duplicate model/category in import at row '.($index+2));
                    $seen['natural:'.$r['natural_key']]=true;$seen[$key]=true;inv_upsert($db,$row,'excel');
                }
                $result=['imported'=>count($rows)];
            } elseif ($action==='row_add') $result=['row'=>inv_upsert($db,$body['row'],'site')];
            else {
                $old=inv_find($db,(string)$body['id']);if(!$old)throw new RuntimeException('Product not found');
                if((int)($body['revision']??-1)!==(int)$old['revision']) {http_response_code(409);throw new RuntimeException('Row changed elsewhere; reload before saving');}
                if($action==='row_delete') { $db->prepare('DELETE FROM dg_products WHERE product_id=?')->execute([$old['product_id']]);$result=[]; }
                else {
                    $changes=array_intersect_key($body['changes']??[],array_flip(['name','specs','price','stock','initial_price','category_key','hyperlink','brand']));
                    $result=['row'=>inv_upsert($db,array_merge(inv_product($old),$changes),'site',(int)$body['revision'])];
                }
            }
            inv_commit($db,$rev);
        } catch(Throwable $e) { if($db->inTransaction())$db->rollBack();throw $e; }
        echo json_encode(array_merge(['success'=>true,'catalog'=>inv_catalog($db),'sync_enabled'=>!empty(inv_config()['sheets']['secret'])],$result),JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;
    }
    throw new RuntimeException('Unknown action');
} catch(Throwable $e) {
    if(http_response_code()<400)http_response_code($e instanceof InvalidArgumentException?422:400);
    // Database credentials must never appear in a browser-visible PDO exception.
    $message=$e instanceof PDOException ? 'Database operation failed; verify private DB configuration and server logs.' : $e->getMessage();
    error_log('DataGraph inventory: '.$e->getMessage());echo json_encode(['success'=>false,'error'=>$message],JSON_UNESCAPED_UNICODE);
}
