<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/api/sheets-lib.php';
try{echo json_encode(sheets_sync(),JSON_UNESCAPED_UNICODE).PHP_EOL;}catch(Throwable $e){fwrite(STDERR,$e->getMessage().PHP_EOL);exit(1);}
