<?php
declare(strict_types=1);
ini_set('display_errors','0');
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');header('X-Content-Type-Options: nosniff');header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
$secure=(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off') || (int)($_SERVER['SERVER_PORT']??0)===443;
$local=in_array($_SERVER['REMOTE_ADDR']??'', ['127.0.0.1','::1'],true)&&in_array(parse_url('http://'.($_SERVER['HTTP_HOST']??''),PHP_URL_HOST),['localhost','127.0.0.1','::1'],true);
if(!$secure&&!$local){http_response_code(400);exit('Please open https://datagraphlist.ir/install.php — HTTPS is required.');}
ini_set('session.use_strict_mode','1');
session_name('dg_installer_session');session_set_cookie_params(['secure'=>$secure,'httponly'=>true,'samesite'=>'Strict']);session_start();
if(empty($_SESSION['csrf']))$_SESSION['csrf']=bin2hex(random_bytes(32));
$failure='';$result=null;$locked=false;$ready=false;$checks=[];
$values=['db_host'=>'localhost','db_name'=>'','db_user'=>''];
try {
    if(version_compare(PHP_VERSION,'8.2.0','<'))throw new RuntimeException('PHP 8.2 or newer is required');
    foreach(['api/install-lib.php','api/inventory-lib.php','backup-lib.php','api/schema.sql'] as $required)if(!is_file(__DIR__.'/'.$required))throw new RuntimeException('Upload the complete package; missing '.$required);
    require_once __DIR__.'/api/install-lib.php';
    $locked=dg_install_locked();
    if(!$locked){
        $checks=['PHP 8.2+'=>true,'PDO MySQL'=>extension_loaded('pdo_mysql'),'mbstring'=>extension_loaded('mbstring'),'ZIP'=>extension_loaded('zip'),'cURL (Google Sheets)'=>extension_loaded('curl'),'کاتالوگ JSON'=>is_readable(__DIR__.'/data/catalog.json'),'رمز مدیریت قبلی'=>is_readable(__DIR__.'/data/.admin_secret.json'),'مسیر خصوصی قابل نوشتن'=>is_writable(dg_private_dir())];
        $ready=!in_array(false,$checks,true);
        if($_SERVER['REQUEST_METHOD']==='POST'){
            if((int)($_SERVER['CONTENT_LENGTH']??0)>16384)throw new RuntimeException('Form too large');
            if(!hash_equals($_SESSION['csrf'],(string)($_POST['csrf']??''))){http_response_code(403);throw new RuntimeException('Form session expired; reload the page');}
            if(!$ready)throw new RuntimeException('ابتدا موارد قرمزِ پیش‌نیاز را برطرف کنید.');
            foreach(array_keys($values) as $key)$values[$key]=trim((string)($_POST[$key]??''));
            inv_auth(['admin_key'=>(string)($_POST['admin_password']??'')]);
            $installed=dg_install_database(array_merge($values,['db_password'=>(string)($_POST['db_password']??'')]));
            $result=$installed['installation'];$locked=true;session_destroy();
            $deleted=@unlink(__FILE__);
        }
    }
}catch(Throwable $e){
    if(http_response_code()<400)http_response_code(400);
    error_log('DataGraph installer: '.$e->getMessage());
    $failure=$e instanceof PDOException?'اتصال یا عملیات دیتابیس ناموفق بود. نام کامل دیتابیس/کاربر، رمز و ALL PRIVILEGES را بررسی کنید.':$e->getMessage();
    if(class_exists('PDO')&&function_exists('dg_install_locked')){try{$locked=dg_install_locked();}catch(Throwable $ignored){}}
}
function esc(string $s):string{return htmlspecialchars($s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
?>
<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>نصب خودکار MySQL | دیتاگراف</title><style>
*{box-sizing:border-box}body{margin:0;background:#faf7f7;color:#21191c;font-family:Tahoma,Arial,sans-serif;line-height:1.9}main{max-width:740px;margin:35px auto;padding:26px;background:white;border:1px solid #eadadd;border-top:5px solid #d43342;border-radius:16px}h1{font-size:23px;margin:0 0 10px}p{font-size:13px}.muted{color:#79686e}.notice{background:#fff5f6;border:1px solid #efc7ce;border-radius:10px;padding:14px;margin:14px 0;font-size:13px}.ok{color:#176d46}.bad{color:#b52432}.checks{display:grid;grid-template-columns:1fr 1fr;gap:7px;font-size:12px;margin:18px 0}.checks div{background:#faf7f7;padding:7px;border-radius:5px}label{display:block;font-size:13px;font-weight:bold;margin-top:14px}input{width:100%;padding:12px;border:1px solid #d8cbd0;border-radius:8px;font:inherit;margin-top:5px}input:focus{outline:2px solid #d43342}button{width:100%;padding:14px;border:0;border-radius:9px;background:#d43342;color:white;font:inherit;font-weight:bold;margin-top:22px;cursor:pointer}button:disabled{opacity:.5;cursor:not-allowed}a{color:#b52432}code{word-break:break-word}footer{margin-top:25px;font-size:11px;text-align:center;color:#79686e}@media(max-width:600px){main{margin:12px;padding:18px}.checks{grid-template-columns:1fr}h1{font-size:19px}}
</style></head><body><main><h1>نصب خودکار پایگاه داده دیتاگراف</h1><p class="muted">اتصال MySQL، ساخت جدول‌ها و انتقال اطلاعات فعلی؛ بدون نیاز به Terminal</p>
<?php if($failure):?><div class="notice bad" role="alert"><?=esc($failure)?></div><?php endif;?>
<?php if($result):?>
<h2 class="ok">نصب با موفقیت انجام شد ✓</h2><p>تعداد قطعات: <b><?=esc((string)$result['parts'])?></b> — لپ‌تاپ‌ها: <b><?=esc((string)$result['laptops'])?></b></p><p>فایل تنظیمات در مسیر خصوصی خارج از public_html ذخیره شد. فایل اصلی JSON و رمز ادمین تغییر نکردند.</p><p>بکاپ قبل از نصب: <code dir="ltr"><?=esc($result['backup'])?></code>؛ از بخش پشتیبان‌گیری پنل قابل دانلود است.</p><div class="notice"><?=!empty($deleted)?'فایل install.php به‌صورت خودکار حذف شد.':'نصب برای همیشه قفل شد. حذف خودکار فایل ممکن نشد؛ لطفاً install.php را از File Manager حذف کنید.'?></div><a href="./">ورود به سایت و پنل مدیریت ←</a>
<?php elseif($locked):?>
<h2>نصب قفل است 🔒</h2><p>این سایت قبلاً پیکربندی شده است. فرم نصب غیرفعال است و تنظیمات/داده‌ها بازنویسی نمی‌شوند.</p><p>فایل <code>install.php</code> را از File Manager حذف کنید. آپلود مجدد آن نیز قفل نصب را باز نمی‌کند.</p><a href="./">بازگشت به سایت</a>
<?php else:?>
<p>ابتدا در <b>cPanel → MySQL Database Wizard</b> دیتابیس و کاربر بسازید و کاربر را با <b>ALL PRIVILEGES</b> به همان دیتابیس متصل کنید. نصاب، دیتابیس/کاربر cPanel را نمی‌سازد؛ جدول‌ها و انتقال داده را انجام می‌دهد.</p>
<div class="checks"><?php foreach($checks as $name=>$ok):?><div class="<?=$ok?'ok':'bad'?>"><?=$ok?'✓':'✕'?> <?=esc($name)?></div><?php endforeach;?></div>
<?php if(isset($checks['رمز مدیریت قبلی'])&&!$checks['رمز مدیریت قبلی']):?><div class="notice">برای جلوگیری از تصاحب سایت، نصب به رمز مدیریت موجود نیاز دارد. ابتدا فایل رمز مدیریت قبلی را در data حفظ/بازیابی کنید؛ این نصاب رمز جدید یا حساب ناشناس ایجاد نمی‌کند.</div><?php endif;?>
<form method="post" action="" autocomplete="off">
<input type="hidden" name="csrf" value="<?=esc($_SESSION['csrf'])?>">
<label>میزبان دیتابیس (معمولاً localhost)<input name="db_host" dir="ltr" required value="<?=esc($values['db_host'])?>" maxlength="255"></label>
<label>نام کامل دیتابیس (با پیشوند cPanel)<input name="db_name" dir="ltr" required value="<?=esc($values['db_name'])?>" placeholder="account_datagraph" maxlength="100"></label>
<label>نام کامل کاربر دیتابیس<input name="db_user" dir="ltr" required value="<?=esc($values['db_user'])?>" placeholder="account_inventory" maxlength="100"></label>
<label>رمز کاربر دیتابیس<input type="password" name="db_password" dir="ltr" required autocomplete="new-password"></label>
<label>رمز فعلی مدیریت سایت (برای تأیید مالکیت نصب)<input type="password" name="admin_password" dir="ltr" required autocomplete="current-password"></label>
<div class="notice">پیش از مهاجرت بکاپ خودکار ساخته می‌شود؛ JSON اصلی پاک نمی‌شود. از دیتابیس خالی استفاده کنید. از بستن صفحه یا اجرای هم‌زمان نصب خودداری کنید. پس از موفقیت، نصاب حذف یا قفل خواهد شد.</div>
<button type="submit" <?=$ready?'':'disabled'?>>اتصال، ساخت جدول‌ها و انتقال اطلاعات</button>
</form>
<?php endif;?><footer dir="ltr">Powered by Naser Tavakkoli · @nt.galaxy</footer></main></body></html>
