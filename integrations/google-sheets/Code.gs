/** DataGraph two-way connector. Deploy as Web App (execute as YOU).
 * Script Properties: SHEET_ID, SYNC_SECRET (32+ chars), SITE_URL,
 * optional INVENTORY_TAB (default Inventory). Never put secrets in Sheet cells.
 */
const DG_HEADERS = ['id','kind','category_key','name','specs','price','initial_price','stock','brand'];
function dgProps_() {
  const p=PropertiesService.getScriptProperties().getProperties();
  if(!p.SHEET_ID || !p.SYNC_SECRET || p.SYNC_SECRET.length<32) throw Error('Set SHEET_ID and SYNC_SECRET in Project Settings / Script Properties');
  return p;
}
function dgSheet_() {
  const p=dgProps_(), ss=SpreadsheetApp.openById(p.SHEET_ID);
  let s=ss.getSheetByName(p.INVENTORY_TAB||'Inventory');
  if(!s) s=ss.insertSheet(p.INVENTORY_TAB||'Inventory');
  if(s.getLastRow()===0) {s.getRange(1,1,1,DG_HEADERS.length).setValues([DG_HEADERS]);s.setFrozenRows(1);}
  const h=s.getRange(1,1,1,DG_HEADERS.length).getValues()[0];
  if(JSON.stringify(h)!==JSON.stringify(DG_HEADERS)) throw Error('Inventory headers must be: '+DG_HEADERS.join(', ')+' (do not overwrite your original workbook; use a dedicated Inventory tab)');
  return s;
}
function dgNatural_(r){ return [r.kind||'part',r.category_key||'other',r.name||''].join('|').replace(/ي/g,'ی').replace(/ك/g,'ک').toLowerCase().trim().replace(/\s+/g,' '); }
function dgVersion_(r){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(DG_HEADERS.map(k=>r[k]===undefined?null:r[k]))).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');}
function dgSnapshot_(){
  const s=dgSheet_(), rows=[], versions={};
  const props=PropertiesService.getScriptProperties();const sequence=Number(props.getProperty('DG_SNAPSHOT_SEQUENCE')||'0')+1;props.setProperty('DG_SNAPSHOT_SEQUENCE',String(sequence));
  if(s.getLastRow()<2)return {rows:rows,versions:versions,sequence:sequence};
  const values=s.getRange(2,1,s.getLastRow()-1,DG_HEADERS.length).getValues();
  values.forEach((cells,i)=>{
    if(!String(cells[3]).trim())return;
    if(!cells[0]){cells[0]='gs_'+Utilities.getUuid();s.getRange(i+2,1).setValue(cells[0]);}
    const r={};DG_HEADERS.forEach((k,n)=>r[k]=cells[n]===''?null:cells[n]);
    r.id=String(r.id);r.kind=r.kind||'part';r.category_key=r.kind==='laptop'?'laptop':(r.category_key||'other');r.name=String(r.name);r.specs=r.specs||'';r.brand=r.brand||null;
    ['price','initial_price','stock'].forEach(k=>{if(r[k]!==null){const number=Number(String(r[k]).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[,٬]/g,''));if(!Number.isFinite(number)||number<0)throw Error('Invalid '+k+' at row '+(i+2));r[k]=number;}});
    r._row=i+2;rows.push(r);versions[r.id]=dgVersion_(r);versions['natural:'+dgNatural_(r)]=dgVersion_(r);
  });
  return {rows:rows,versions:versions,sequence:sequence};
}
function dgEqual_(a,b){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
function dgText_(v){if(typeof v==='string'&&/^[=+@-]/.test(v))return "'"+v;return v===undefined||v===null?'':v;}
function doPost(e){
  const lock=LockService.getScriptLock();let held=false;
  try{
    const p=dgProps_(), q=JSON.parse(e.postData.contents);
    if(!dgEqual_(String(q.token||''),p.SYNC_SECRET))throw Error('Unauthorized');
    if(q.sheet_id!==p.SHEET_ID)throw Error('Wrong sheet ID');
    lock.waitLock(20000);held=true;
    if(q.action==='read')return dgJson_(Object.assign({success:true},dgSnapshot_()));
    if(q.action!=='push')throw Error('Unknown action');
    const snapshot=dgSnapshot_(), s=dgSheet_(), accepted=[], conflicts=[], writes=[];let nextRow=s.getLastRow()+1;
    if(!Array.isArray(q.rows)||q.rows.length>5000)throw Error('Too many rows');
    q.rows.forEach(r=>{
      const old=snapshot.rows.find(x=>x.id===r.id)||snapshot.rows.find(x=>dgNatural_(x)===dgNatural_(r));
      const expected=(q.expected||{})[old?old.id:r.id]||(q.expected||{})['natural:'+dgNatural_(r)];
      // Compare-and-swap: a concurrent Sheet edit must never be overwritten.
      if(old && expected!==dgVersion_(old)){conflicts.push(r.id);return;}
      const row=old?old._row:nextRow++;
      writes.push({row:row,values:DG_HEADERS.map(k=>dgText_(r[k]))});
      accepted.push(r.id);
    });
    writes.sort((a,b)=>a.row-b.row);
    for(let i=0;i<writes.length;){let j=i+1;while(j<writes.length&&writes[j].row===writes[j-1].row+1&&j-i<500)j++;
      s.getRange(writes[i].row,1,j-i,DG_HEADERS.length).setValues(writes.slice(i,j).map(x=>x.values));i=j;}
    SpreadsheetApp.flush();
    return dgJson_({success:true,accepted:accepted,conflicts:conflicts});
  }catch(err){return dgJson_({success:false,error:String(err.message||err)});}finally{if(held)lock.releaseLock();}
}
function dgJson_(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
function datagraphOnEdit(e){
  if(!e||e.range.getSheet().getName()!==(dgProps_().INVENTORY_TAB||'Inventory')||e.range.getRow()<2)return;
  datagraphPushChanges();
}
function datagraphPushChanges(){
  const p=dgProps_();if(!/^https:\/\/[^/]+/.test(p.SITE_URL||''))throw Error('Set HTTPS SITE_URL');
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  let snapshot;
  try{snapshot=dgSnapshot_();}finally{lock.releaseLock();}
  const response=UrlFetchApp.fetch(p.SITE_URL.replace(/\/$/,'')+'/api/sheets-sync.php',{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+p.SYNC_SECRET},payload:JSON.stringify({action:'webhook',token:p.SYNC_SECRET,rows:snapshot.rows,sequence:snapshot.sequence}),muteHttpExceptions:true});
  const result=JSON.parse(response.getContentText());
  if(response.getResponseCode()!==200||!result.success)throw Error('Site rejected webhook: '+response.getContentText());
}
function installDatagraphTriggers(){
  dgSheet_();
  ScriptApp.getProjectTriggers().filter(t=>['datagraphOnEdit','datagraphPushChanges'].includes(t.getHandlerFunction())).forEach(t=>ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('datagraphOnEdit').forSpreadsheet(dgProps_().SHEET_ID).onEdit().create();
  ScriptApp.newTrigger('datagraphPushChanges').timeBased().everyMinutes(5).create();
}
