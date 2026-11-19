import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { CatalogResponse } from '../types';
import { columnAliases, inventoryRequest, normalizeSearch } from '../inventoryClient';
import { normalizeDigitsToEnglish } from '../utils';

export function InventoryImport({ file, catalog, onClose, onCatalog }: { file: File; catalog: CatalogResponse; onClose:()=>void; onCatalog:(c:CatalogResponse)=>void }) {
  const [book,setBook]=useState<XLSX.WorkBook|null>(null),[sheet,setSheet]=useState(''),[mapping,setMapping]=useState<Record<string,string>>({});
  const [unit,setUnit]=useState('rial'),[category,setCategory]=useState(catalog.categories[0]?.key||'other'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const canon=(s:string)=>normalizeSearch(s).replace(/[\s_-]/g,'');
  React.useEffect(()=>{file.arrayBuffer().then(b=>{const wb=XLSX.read(b,{type:'array',raw:true});setBook(wb);setSheet(wb.SheetNames[0]);}).catch(e=>setMessage(e.message));},[file]);
  const matrix=useMemo(()=>book&&sheet?XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[sheet],{header:1,defval:'',blankrows:false}):[],[book,sheet]);
  const headers=(matrix[0]||[]).map(String);
  React.useEffect(()=>{const next:Record<string,string>={};Object.entries(columnAliases).forEach(([key,aliases])=>{const i=headers.findIndex(h=>aliases.some(a=>canon(a)===canon(h)));next[key]=i<0?'':String(i);});setMapping(next);},[sheet,book]);
  function numeric(v:unknown,label:string):number|null {if(v===null||v===undefined||String(v).trim()==='')return null;const s=normalizeDigitsToEnglish(String(v)).replace(/[,٬\s]/g,'');const n=Number(s);if(!Number.isFinite(n)||n<0)throw new Error('مقدار نامعتبر '+label+': '+v);return n;}
  function makeRows(){
    if(mapping.name==='')throw new Error('ستون نام کالا را مشخص کنید.');
    return matrix.slice(1).map((cells,index)=>{
      const get=(key:string)=>mapping[key]!==''&&mapping[key]!==undefined?cells[Number(mapping[key])]:'';
      const name=String(get('name')).trim();if(!name)return null;
      const catText=String(get('category_key')||category).trim();
      const aliases:Record<string,string>={mb:'motherboard',gpu:'vga',psu:'power',cooling:'fan',accessories:'other','رم':'ram','پردازنده':'cpu','مادربرد':'motherboard','لپ‌تاپ':'laptop','laptops':'laptop','کارت گرافیک':'vga','پاور':'power','کیس':'case','مانیتور':'monitor'};
      let cat=catalog.categories.find(c=>[c.key,c.persian_label,c.invoice_label].some(s=>canon(s)===canon(catText)))?.key||aliases[normalizeSearch(catText)]||catText;
      if(!/^[a-zA-Z0-9_-]{1,100}$/.test(cat))throw new Error(`ردیف ${index+2}: دسته «${catText}» شناخته نشد؛ از کلید دسته در فایل خروجی یا دسته پیش‌فرض استفاده کنید.`);
      const kind=normalizeSearch(String(get('kind')))==='laptop'||cat==='laptop'?'laptop':'part';if(kind==='laptop')cat='laptop';
      const factor=unit==='toman'?10:1;const price=numeric(get('price'),'قیمت');const stock=numeric(get('stock'),'موجودی');
      if(stock!==null&&!Number.isInteger(stock))throw new Error('موجودی باید عدد صحیح باشد؛ ردیف '+(index+2));
      const row:Record<string,unknown>={kind,category_key:cat,name};
      for(const key of ['id','specs','brand'])if(mapping[key]!==''&&mapping[key]!==undefined)row[key]=String(get(key));
      if(mapping.price!=='')row.price=price===null?null:Math.round(price*factor);
      if(mapping.stock!=='')row.stock=stock;
      if(mapping.initial_price!==''){const p=numeric(get('initial_price'),'قیمت اولیه');row.initial_price=p===null?null:Math.round(p*factor);}
      return row;
    }).filter(Boolean);
  }
  let preview:Record<string,unknown>[]=[];let validation='';try{preview=makeRows() as Record<string,unknown>[];}catch(e){validation=(e as Error).message;}
  async function submit(){setBusy(true);setMessage('');try{const rows=makeRows();const result=await inventoryRequest('import',{rows,catalog_revision:catalog._revision});onCatalog(result.catalog);setMessage(`${result.imported} ردیف در یک تراکنش ذخیره شد؛ حذف بر اساس غیبت در فایل انجام نمی‌شود.`);if(result.sync_enabled)inventoryRequest('sync',{},true).then(sync=>onCatalog(sync.catalog)).catch(()=>setMessage('فایل در MySQL ذخیره شد؛ ارسال به شیت در انتظار تلاش مجدد است.'));}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
  return <div className="inventory-modal" role="dialog" aria-modal="true" aria-label="ورود فایل Excel"><section>
    <div className="flex justify-between"><h2 className="font-bold">تطبیق ستون‌ها و پیش‌نمایش ورود Excel / CSV</h2><button onClick={onClose}>بستن ×</button></div>
    <p>واحد ذخیره‌سازی ریال است. شناسه ثابت، اولویت تطبیق دارد؛ بدون شناسه از نوع + دسته + نام نرمال‌شده استفاده می‌شود. ستون انتخاب‌نشده نباید مشخصات قبلی را پاک کند. پیش از اعمال، پیش‌نمایش را بررسی کنید.</p>
    <label>برگه<select value={sheet} onChange={e=>setSheet(e.target.value)}>{book?.SheetNames.map(n=><option key={n}>{n}</option>)}</select></label>
    <label>واحد قیمت فایل<select value={unit} onChange={e=>setUnit(e.target.value)}><option value="rial">ریال</option><option value="toman">تومان</option></select></label>
    <label>دسته پیش‌فرض برای فایل بدون ستون دسته<select value={category} onChange={e=>setCategory(e.target.value)}>{catalog.categories.map(c=><option key={c.key} value={c.key}>{c.persian_label}</option>)}<option value="laptop">لپ‌تاپ</option></select></label>
    <div className="grid sm:grid-cols-2 gap-3">{Object.keys(columnAliases).map(key=><label key={key}>{key}<select value={mapping[key]??''} onChange={e=>setMapping(m=>({...m,[key]:e.target.value}))}><option value="">انتخاب نشده</option>{headers.map((h,i)=><option key={i} value={String(i)}>{h||'ستون '+(i+1)}</option>)}</select></label>)}</div>
    <p className="text-brand">{validation||`${preview.length} محصول معتبر؛ نمایش ۵ ردیف اول`}</p>
    <pre dir="ltr" className="text-xs whitespace-pre-wrap break-all bg-slate-100 p-3">{JSON.stringify(preview.slice(0,5),null,2)}</pre>
    <button className="primary" type="button" disabled={busy||!!validation||!preview.length} onClick={submit}>{busy?'در حال ورود...':'تأیید و ورود فایل'}</button><p role="status">{message}</p>
  </section></div>;
}
