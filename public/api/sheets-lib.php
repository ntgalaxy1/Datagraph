<?php
declare(strict_types=1);
require_once __DIR__.'/inventory-lib.php';
function sheets_settings(): array { return inv_config()['sheets']??[]; }
function sheets_request(array $settings,array $payload): array {
    if(!extension_loaded('curl'))throw new RuntimeException('PHP cURL extension required');
    $url=$settings['webapp_url']??'';
    if(!preg_match('~^https://script\.google\.com/macros/s/[a-zA-Z0-9_-]+/exec$~D',$url))throw new RuntimeException('Use a deployed script.google.com Web App /exec URL');
    $payload['token']=$settings['secret'];$payload['sheet_id']=$settings['sheet_id'];
    for($hop=0;$hop<4;$hop++) {
        $ch=curl_init($url);
        curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>10,CURLOPT_TIMEOUT=>50,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_HTTPHEADER=>['Content-Type: application/json'],CURLOPT_POST=>$hop===0,CURLOPT_HEADER=>true]);
        if($hop===0)curl_setopt($ch,CURLOPT_POSTFIELDS,json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));
        $raw=curl_exec($ch);if($raw===false){$err=curl_error($ch);curl_close($ch);throw new RuntimeException('Apps Script connection failed: '.$err);}
        $status=curl_getinfo($ch,CURLINFO_RESPONSE_CODE);$len=curl_getinfo($ch,CURLINFO_HEADER_SIZE);$headers=substr($raw,0,$len);$text=substr($raw,$len);curl_close($ch);
        if(strlen($text)>8000000)throw new RuntimeException('Sheet response too large');
        if($status>=300&&$status<400) {
            if(!preg_match('/^Location:\s*(.+)$/mi',$headers,$m))throw new RuntimeException('Invalid Google redirect');
            $next=trim($m[1]);$host=parse_url($next,PHP_URL_HOST);
            if(parse_url($next,PHP_URL_SCHEME)!=='https'||!in_array($host,['script.google.com','script.googleusercontent.com'],true))throw new RuntimeException('Unsafe Google redirect blocked');
            $url=$next;continue;
        }
        $data=json_decode($text,true);if($status!==200||!is_array($data)||empty($data['success']))throw new RuntimeException($data['error']??'Apps Script returned an error; check deployment access');
        return $data;
    }
    throw new RuntimeException('Too many Google redirects');
}
function sheets_pull_rows(PDO $db,array $rows, int $sequence = 0): array {
    if(count($rows)>5000)throw new RuntimeException('Sheet exceeds 5000 products');
    $revision=inv_lock($db);$changed=0;$conflicts=0;
    try {
        $lastSequence=(int)inv_meta($db,'last_sheet_sequence',0);
        if($sequence>0&&$sequence<$lastSequence){$db->rollBack();return ['pulled'=>0,'sheet_won_conflicts'=>0];}
        $seen=[];
        foreach($rows as $raw) {
            $row=inv_row($raw);$id=(string)($row['id']??'');$key=$id!==''?$id:$row['natural_key'];
            if(isset($seen[$key]))throw new RuntimeException('Duplicate product in sheet: '.$key);if(isset($seen['natural:'.$row['natural_key']]))throw new RuntimeException('Duplicate category/model in Google Sheet');$seen['natural:'.$row['natural_key']]=true;$seen[$key]=true;
            $old=$id!==''?inv_find($db,$id):null;
            if(!$old) { $s=$db->prepare('SELECT * FROM dg_products WHERE natural_key=?');$s->execute([$row['natural_key']]);$old=$s->fetch(PDO::FETCH_ASSOC)?:null; }
            // First connection establishes Sheet authority. Thereafter unchanged
            // Sheet rows do NOT overwrite pending website edits.
            $hash=inv_hash($row);
            if(!$old||$old['sheet_hash']!==$hash) {
                if($old&&$old['dirty']&&$old['sheet_hash']!==null)$conflicts++;
                inv_upsert($db,$row,'sheet');$changed++;
            }
        }
        if($sequence>0)inv_set_meta($db,'last_sheet_sequence',$sequence);
        inv_commit($db,$revision);return ['pulled'=>$changed,'sheet_won_conflicts'=>$conflicts];
    } catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
function sheets_sync(): array {
    $config=inv_config();$settings=$config['sheets']??[];
    if(empty($settings['secret'])||empty($settings['sheet_id']))throw new RuntimeException('Configure Google Sheets first');
    $lock=fopen(dg_private_dir().'/sheets-sync.lock','c');
    if(!$lock||!flock($lock,LOCK_EX|LOCK_NB))throw new RuntimeException('Another sync is running');
    try {
        $db=inv_db();$remote=sheets_request($settings,['action'=>'read']);
        $result=sheets_pull_rows($db,$remote['rows']??[],(int)($remote['sequence']??0));
        $pending=$db->query('SELECT * FROM dg_products WHERE dirty=1 ORDER BY product_id')->fetchAll(PDO::FETCH_ASSOC);
        $sent=array_map('inv_product',$pending);
        // Send expected Sheet fingerprints (provided by Apps Script). The script
        // performs compare-and-swap under LockService; concurrent sheet edits win.
        $reply=$sent?sheets_request($settings,['action'=>'push','rows'=>$sent,'expected'=>$remote['versions']??[]]):['accepted'=>[],'conflicts'=>[]];
        $rev=inv_lock($db);$pushed=0;
        try {
            $accepted=array_fill_keys($reply['accepted']??[],true);
            foreach($pending as $p) if(isset($accepted[$p['product_id']])) {
                $stmt=$db->prepare('UPDATE dg_products SET dirty=0,sheet_hash=? WHERE product_id=? AND revision=?');
                $stmt->execute([inv_hash(inv_product($p)),$p['product_id'],$p['revision']]);$pushed+=$stmt->rowCount();
            }
            inv_set_meta($db,'last_sync',['at'=>gmdate(DATE_ATOM),'pulled'=>$result['pulled'],'pushed'=>$pushed,'sheet_won_conflicts'=>$result['sheet_won_conflicts']+count($reply['conflicts']??[])]);
            inv_commit($db,$rev);
        } catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
        // Fetch a second snapshot when a Sheet edit raced with the outbound push.
        if(!empty($reply['conflicts'])){ $latest=sheets_request($settings,['action'=>'read']);sheets_pull_rows($db,$latest['rows']??[],(int)($latest['sequence']??0)); }
        return ['pulled'=>$result['pulled'],'pushed'=>$pushed,'conflicts'=>$result['sheet_won_conflicts']+count($reply['conflicts']??[])];
    } finally {flock($lock,LOCK_UN);fclose($lock);}
}
