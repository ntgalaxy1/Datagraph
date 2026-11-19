import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { CatalogResponse, CurrencyMode } from '../types';
import { inventoryRequest, inventoryRows, InventoryRow, normalizeSearch } from '../inventoryClient';
import { currencyLabel, formatMoney, formatNumberInputWithCommas, normalizeDigitsToEnglish } from '../utils';
import { InventorySettings } from './InventorySettings';
import { InventoryImport } from './InventoryImport';

const columns=['name','specs','initial_price','price','stock'] as const;
type Field=typeof columns[number];
const columnNames:Record<Field,string>={name:'نام کالا / مدل',specs:'مشخصات',initial_price:'قیمت اولیه',price:'قیمت فروش',stock:'موجودی'};
export function InventorySpreadsheet({catalog,currency,onCatalog}:{catalog:CatalogResponse;currency:CurrencyMode;onCatalog:(c:CatalogResponse)=>void}) {
  const [tab,setTab]=useState(catalog.categories.find(c=>!['hdd','ssd','other','keyboard_mouse','speaker','silicon','dvd','laptop','accessories','all'].includes(c.key))?.key || 'storage'),[query,setQuery]=useState(''),[page,setPage]=useState(0);
  const [drafts,setDrafts]=useState<Record<string,Partial<Record<Field,string>>>>({}),[quick,setQuick]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[settings,setSettings]=useState<'database'|'sheets'|null>(null),[file,setFile]=useState<File|null>(null);
  const grid=useRef<HTMLTableElement>(null);const factor=currency==='toman'?10:1;
  const rows=useMemo(()=>inventoryRows(catalog),[catalog]);
  const q=normalizeSearch(query);
  const matches=useMemo(()=>rows.filter(r=>!q||normalizeSearch([r.name,r.specs,r.category_key,r.id].join(' ')).includes(q)),[rows,q]);
  const visible=q?matches:matches.filter(r=>(tab==='storage'?['ssd','hdd'].includes(r.category_key):tab==='accessories'?['other','keyboard_mouse','speaker','silicon','dvd'].includes(r.category_key):r.category_key===tab));
  const pageRows=visible.slice(page*80,(page+1)*80);
  const catName=(r:InventoryRow)=>r.kind==='laptop'?'لپ‌تاپ':catalog.categories.find(c=>c.key===r.category_key)?.persian_label||r.category_key;
  const tabs=[...catalog.categories.filter(c=>!['hdd','ssd','other','keyboard_mouse','speaker','silicon','dvd','laptop','accessories','all'].includes(c.key)).map(c=>({key:c.key,title:`${c.persian_label} (${c.invoice_label})`})),{key:'storage',title:'حافظه (SSD / HDD)'}];
  function parseNumber(value:string,key:Field):number|null{if(value.trim()==='')return null;const n=Number(normalizeDigitsToEnglish(value).replace(/[,٬\s]/g,''));if(!Number.isFinite(n)||n<0||(key==='stock'&&!Number.isInteger(n)))throw new Error('عدد نامعتبر است؛ موجودی باید صحیح و مبالغ غیرمنفی باشند.');return key==='stock'?n:Math.round(n*factor);}
  async function save(row:InventoryRow,overrides?:Partial<Record<Field,string>>){
    if(busy)return;const dirty=overrides||drafts[row.id];if(!dirty||!Object.keys(dirty).length)return;
    const changes:Record<string,unknown>={};
    try{Object.entries(dirty).forEach(([key,value])=>{changes[key]=['price','initial_price','stock'].includes(key)?parseNumber(value!,key as Field):value;});}
    catch(e){setMessage((e as Error).message);return;}
    setBusy(true);setMessage('در حال ذخیره...');
    try{
      if(location.protocol==='file:'){
        const next=structuredClone(catalog);for(const c of next.categories){c.items=c.items.map(p=>p.id===row.id?{...p,...changes,previous_price:p.price}:p);}
        next.laptops=next.laptops.map(p=>p.id===row.id?{...p,...changes,model:String(changes.name??p.model),previous_price:p.price}:p);
        onCatalog(next);setMessage('فقط پیش‌نمایش محلی به‌روزرسانی شد؛ ذخیره MySQL نیازمند نصب روی هاست است.');
      }else{const result=await inventoryRequest('row_patch',{id:row.id,revision:row.revision,changes});onCatalog(result.catalog);setMessage('ذخیره شد ✓ — تغییر برای ارسال به Google Sheets در صف است.');
        if(result.sync_enabled) {
          inventoryRequest('sync',{},true).then(sync=>{onCatalog(sync.catalog);setMessage('قیمت ذخیره و با Google Sheets همگام شد ✓');}).catch(()=>setMessage('قیمت در MySQL ذخیره شد؛ ارسال به شیت در انتظار تلاش مجدد یا Cron است.'));
        }}
      setDrafts(prev=>{const n={...prev};delete n[row.id];return n;});setQuick(prev=>{const n={...prev};delete n[row.id];return n;});
    }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
  }
  async function reload(){if(busy)return;setBusy(true);try{const r=await fetch('./api/inventory.php?action=catalog',{cache:'no-store'});const data=await r.json();if(!r.ok||!data.success)throw new Error(data.error||'خطا در بازخوانی');onCatalog(data.catalog);setMessage('اطلاعات تازه دریافت شد. پیش‌نویس‌های ذخیره‌نشده حفظ شدند.');}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
  function keyDown(e:React.KeyboardEvent<HTMLInputElement>,row:InventoryRow,r:number,c:number){
    if(e.key==='Escape'){setDrafts(prev=>{const next={...prev};delete next[row.id];return next;});e.currentTarget.blur();}
    if(e.key==='Enter'){e.preventDefault();save(row);grid.current?.querySelector<HTMLInputElement>(`input[data-r="${r+1}"][data-c="${c}"]`)?.focus();}
    if(e.key==='ArrowUp'||e.key==='ArrowDown'||(e.altKey&&(e.key==='ArrowLeft'||e.key==='ArrowRight'))){e.preventDefault();const nr=r+(e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0);const nc=c+(e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0);grid.current?.querySelector<HTMLInputElement>(`input[data-r="${nr}"][data-c="${nc}"]`)?.focus();}
  }
  function exportExcel(){const data=rows.map(r=>({id:r.id,kind:r.kind,category_key:r.category_key,name:r.name,specs:r.specs,price:r.price,initial_price:r.initial_price,stock:r.stock,brand:r.brand||''}));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(data),'Inventory');XLSX.writeFile(wb,'DataGraph-Inventory-RIAL.xlsx');setMessage('خروجی Excel با واحد ریال آماده شد؛ این خروجی فقط شامل داده‌های ذخیره‌شده است.');}
  async function add(){if(busy)return;const name=prompt('نام محصول جدید:');if(!name?.trim())return;const initial=prompt('قیمت اولیه ('+currencyLabel(currency)+') — خالی برای استعلام:','');if(initial===null)return;let initialPrice:number|null;try{initialPrice=parseNumber(initial,'price');}catch(e){setMessage((e as Error).message);return;}const cat=tab==='all'||['storage','accessories'].includes(tab)?catalog.categories[0]?.key:tab;setBusy(true);try{const r=await inventoryRequest('row_add',{row:{name:name.trim(),kind:cat==='laptop'?'laptop':'part',category_key:cat,price:initialPrice,initial_price:initialPrice,stock:null}});onCatalog(r.catalog);setQuery(name);setPage(0);setMessage('محصول افزوده شد؛ قیمت را در سلول وارد کنید.');}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
  async function remove(row:InventoryRow){if(!confirm(`محصول «${row.name}» حذف شود؟ حذف از شیت جداگانه انجام می‌شود؛ ردیف باقی‌مانده در شیت ممکن است دوباره وارد شود.`))return;setBusy(true);try{const r=await inventoryRequest('row_delete',{id:row.id,revision:row.revision});onCatalog(r.catalog);setMessage('از سایت حذف شد.');}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
  return <section className="inventory-workbook" aria-label="مدیریت شیتی محصولات">
    <div className="inventory-pinned">
      <div className="flex flex-wrap justify-between gap-2 items-center"><h2 className="font-extrabold">مدیریت شیتی موجودی و قیمت‌ها</h2><span className="text-xs">{catalog._storage==='mysql'?'MySQL متصل':'حالت JSON / پیش‌نمایش — MySQL را راه‌اندازی کنید'}</span></div>
      <label className="block font-bold text-sm mt-3">جست‌وجوی زنده و تغییر سریع قیمت<input autoComplete="off" aria-label="جست‌وجوی زنده محصولات" placeholder="نام، بخشی از مدل، مشخصات یا شناسه را تایپ کنید…" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}} className="inventory-search"/></label>
      {q&&<div className="quick-matches" aria-live="polite"><p className="text-xs p-2">{matches.length} نتیجه در تمام دسته‌ها؛ نمایش ۸ نتیجه اول</p>{matches.slice(0,8).map(row=><div key={row.id} className="quick-match"><div><b>{row.name}</b><small>{catName(row)}</small></div><div className="text-xs">قیمت قبلی/فعلی: <b>{formatMoney(row.price,currency)}</b><small>{currencyLabel(currency)}</small></div><label className="text-xs">قیمت جدید<input aria-label={`قیمت جدید ${row.name}`} inputMode="numeric" dir="ltr" value={quick[row.id]??''} onChange={e=>{if(/[^0-9,٬\s]/.test(normalizeDigitsToEnglish(e.target.value))){setMessage('قیمت باید عدد صحیح و غیرمنفی باشد.');return;}setQuick(v=>({...v,[row.id]:formatNumberInputWithCommas(e.target.value)}));}} onKeyDown={e=>{if(e.key==='Enter'&&quick[row.id]!==undefined)save(row,{price:quick[row.id]});}}/></label><button type="button" disabled={busy||quick[row.id]===undefined} className="primary" onClick={()=>save(row,{price:quick[row.id]})}>به‌روزرسانی</button></div>)}</div>}
      <div className="inventory-toolbar">
        <details className="inventory-tools">
          <summary role="button" aria-label="ابزارک">ابزارک <span aria-hidden="true">⌄</span></summary>
          <div className="inventory-tools-menu" onClick={e=>{if((e.target as HTMLElement).closest('button'))e.currentTarget.closest('details')?.removeAttribute('open');}}>
        <label className="inventory-import-button">ورود Excel / CSV<input type="file" aria-label="انتخاب فایل ورود Excel یا CSV" accept=".xlsx,.csv" hidden onChange={e=>{const f=e.target.files?.[0];if(f){if(f.size>8*1024*1024)setMessage('حداکثر اندازه فایل ۸ مگابایت است.');else setFile(f);}e.target.value='';e.currentTarget.closest('details')?.removeAttribute('open');}}/></label>
        <button type="button" onClick={exportExcel}>خروجی Excel (.xlsx) — ریال</button>
        <button type="button" disabled={busy} onClick={add}>+ محصول</button><button type="button" disabled={busy} onClick={reload}>بازخوانی</button>
        <button type="button" onClick={()=>setSettings('sheets')}>تنظیم Google Sheets</button><button type="button" onClick={()=>setSettings('database')}>تنظیم MySQL</button>
          </div>
        </details>
        <span className="text-xs">مبالغ شبکه: ریال | نمایش: {currencyLabel(currency)}</span>
      </div>
      <div className="inventory-status" role="status">{message||'Enter: ذخیره ردیف • Tab: سلول بعد • ↑ ↓: ردیف‌ها • Alt+←/→: ستون‌ها • Escape: لغو پیش‌نویس'}</div>
    </div>
    <div className="inventory-tabs" role="tablist" aria-label="برگه‌های دسته‌بندی">{tabs.map(t=><button type="button" key={t.key} role="tab" aria-selected={!q&&tab===t.key} onClick={()=>{setTab(t.key);setPage(0);}}>{t.title}</button>)}</div>
    {q&&<p className="px-3 py-2 text-xs text-ink-500">نتایج جست‌وجو در تمام محصولات، شامل لپ‌تاپ و لوازم جانبی</p>}
    <div className="inventory-grid-wrap"><table ref={grid} className="inventory-grid" aria-label="جدول محصولات قابل ویرایش"><thead><tr><th># / دسته</th>{columns.map(c=><th key={c}>{columnNames[c]}{c.includes('price')?' ('+currencyLabel(currency)+')':''}</th>)}<th>وضعیت / ذخیره</th></tr></thead><tbody>
      {pageRows.map((row,r)=><tr key={row.id}><td><span>{page*80+r+1}</span><small>{catName(row)}</small><small dir="ltr">{row.id}</small></td>{columns.map((col,c)=>{const raw=row[col];const val=drafts[row.id]?.[col]??(col==='name'||col==='specs'?String(raw??''):raw===null||raw===undefined?'':formatNumberInputWithCommas(col==='stock'?Number(raw):Math.round(Number(raw)/factor)));return <td key={col}><input aria-label={`${columnNames[col]} ${row.name}`} data-r={r} data-c={c} dir={col==='name'||col==='specs'?'auto':'ltr'} inputMode={col==='name'||col==='specs'?'text':'numeric'} value={val} onChange={e=>{if(col!=='name'&&col!=='specs'&&/[^0-9,٬\s]/.test(normalizeDigitsToEnglish(e.target.value))){setMessage('فقط عدد صحیح و غیرمنفی وارد کنید.');return;}const value=col==='name'||col==='specs'?e.target.value:formatNumberInputWithCommas(e.target.value);setDrafts(d=>({...d,[row.id]:{...d[row.id],[col]:value}}));}} onKeyDown={e=>keyDown(e,row,r,c)}/>{col==='price'&&row.previous_price!==null&&<small>قبل از آخرین ویرایش: {formatMoney(row.previous_price,currency)}</small>}</td>;})}<td><small>{drafts[row.id]?'ذخیره‌نشده':row.sync_pending?'در انتظار ارسال به شیت':'ذخیره‌شده ✓'}</small><button type="button" disabled={busy||!drafts[row.id]} onClick={()=>save(row)}>ذخیره</button><button type="button" disabled={busy} onClick={()=>remove(row)} aria-label={`حذف ${row.name}`}>حذف</button></td></tr>)}
      {!pageRows.length&&<tr><td colSpan={7}>محصولی پیدا نشد.</td></tr>}
    </tbody></table></div>
    <div className="inventory-pagination"><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>قبلی</button><span>{visible.length} محصول • صفحه {page+1} از {Math.max(1,Math.ceil(visible.length/80))}</span><button disabled={(page+1)*80>=visible.length} onClick={()=>setPage(p=>p+1)}>بعدی</button><span>{Object.keys(drafts).length} ردیف پیش‌نویس</span></div>
    {settings&&<InventorySettings mode={settings} onClose={()=>setSettings(null)} onCatalog={onCatalog}/>}
    {file&&<InventoryImport file={file} catalog={catalog} onClose={()=>setFile(null)} onCatalog={onCatalog}/>}
  </section>;
}
