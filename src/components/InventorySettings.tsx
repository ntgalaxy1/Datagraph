import React, { useEffect, useState } from 'react';
import script from '../../integrations/google-sheets/Code.gs?raw';
import { inventoryRequest } from '../inventoryClient';
import { CatalogResponse } from '../types';

export function InventorySettings({ mode, onClose, onCatalog }: { mode: 'database' | 'sheets'; onClose: () => void; onCatalog: (c: CatalogResponse) => void }) {
  const [values, setValues] = useState<Record<string,string>>({ db_host: 'localhost', db_name: '', db_user: '', db_password: '', sheet_id: '', webapp_url: '', secret: '' });
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false), [message,setMessage]=useState(''), [configured,setConfigured]=useState(false);
  useEffect(()=>{ inventoryRequest(mode==='database'?'status':'settings_get',{},mode==='sheets').then(r=>{
    const data=mode==='sheets'?r.settings:r;setConfigured(!!r.configured);setValues(v=>({...v,...(Object.fromEntries(Object.entries(data).filter(([,x])=>typeof x==='string')) as Record<string,string>)}));
    if(r.last_sync)setMessage('آخرین همگام‌سازی: '+r.last_sync.at);
  }).catch(e=>setMessage(e.message)).finally(()=>setLoading(false)); },[mode]);
  async function run(sync=false){setBusy(true);setMessage('');try{
    const r=mode==='database'?await inventoryRequest('configure_database',values):await inventoryRequest(sync?'sync':'settings_save',sync?{}:{settings:values},true);
    if(r.catalog)onCatalog(r.catalog);setMessage(sync?`دریافت: ${r.result.pulled} | ارسال: ${r.result.pushed} | تعارض با اولویت شیت: ${r.result.conflicts}`:'تنظیمات ذخیره شد.');if(mode==='database')setConfigured(true);
    setValues(v=>({...v,db_password:'',secret:''}));
  }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
  const label:Record<string,string>={db_host:'DB Host',db_name:'نام کامل دیتابیس cPanel',db_user:'نام کامل کاربر دیتابیس',db_password:'رمز کاربر دیتابیس',sheet_id:'لینک یا شناسه Google Sheet',webapp_url:'آدرس Web App اسکریپت (/exec)',secret:'کلید مشترک همگام‌سازی (حداقل ۳۲ کاراکتر)'};
  return <div className="inventory-modal" role="dialog" aria-modal="true" aria-label={mode==='database'?'تنظیم MySQL':'تنظیم Google Sheets'}><section>
    <div className="flex items-center justify-between gap-4"><h2 className="font-bold">{mode==='database'?'راه‌اندازی MySQL و مهاجرت اطلاعات':'تنظیمات همگام‌سازی Google Sheets'}</h2><button onClick={onClose} type="button">بستن ×</button></div>
    {mode==='database'?<p>ابتدا در cPanel → MySQL Database Wizard دیتابیس و کاربر بسازید و ALL PRIVILEGES بدهید. این فرم داده فعلی JSON را بدون حذف فایل اصلی به جداول MySQL منتقل می‌کند؛ رمزها فقط در مسیر خصوصی خارج از public_html ذخیره می‌شوند. قبل از انتقال بکاپ بگیرید.</p>:<p>Google Sheets در تعارض مرجع است. تغییر سایت «در انتظار ارسال» می‌ماند تا همگام‌سازی موفق شود. کلید را هم در این فرم و هم در Script Properties وارد کنید؛ کلید ذخیره‌شده هرگز دوباره نمایش داده نمی‌شود.</p>}
    {(mode==='database'?['db_host','db_name','db_user','db_password']:['sheet_id','webapp_url','secret']).map(k=><label key={k}>{label[k]}<input dir="ltr" type={k==='db_password'||k==='secret'?'password':'text'} value={values[k]} autoComplete="off" disabled={loading||busy||(mode==='database'&&configured)} onChange={e=>setValues(v=>({...v,[k]:e.target.value}))}/></label>)}
    {mode==='sheets'&&<button type="button" onClick={()=>setValues(v=>({...v,secret:Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('')}))}>ساخت کلید جدید (پیش از ذخیره برای Script Properties کپی کنید)</button>}
    {mode==='sheets'&&values.secret&&<div dir="ltr" className="break-all select-all bg-slate-100 p-3">{values.secret}</div>}
    <div className="flex flex-wrap gap-3"><button type="button" className="primary" disabled={loading||busy||(mode==='database'&&configured)} onClick={()=>run()}>{busy?'در حال اجرا...':mode==='database'?'اتصال و انتقال اطلاعات':'ذخیره تنظیمات'}</button>{mode==='sheets'&&<button type="button" disabled={loading||busy} onClick={()=>run(true)}>همگام‌سازی دوطرفه اکنون (ابتدا دریافت شیت)</button>}</div>
    <p role="status" className="text-brand font-bold">{message}</p>
    {mode==='sheets'&&<>
      <h3 className="font-bold">اتصال Google Sheets</h3>
      <ol className="list-decimal list-inside space-y-2 text-sm"><li>در شیت، Extensions → Apps Script را باز کنید و کد زیر را جایگزین کنید.</li><li>در Project Settings → Script Properties مقادیر SHEET_ID، SYNC_SECRET و SITE_URL=https://datagraphlist.ir را وارد کنید.</li><li>Deploy → New deployment → Web App؛ Execute as: Me و Who has access: Anyone. دسترسی درخواست‌شده را بررسی و تأیید کنید. دسترسی واقعی درخواست‌های داده با کلید محافظت می‌شود.</li><li>آدرس /exec را در فرم بالا قرار دهید. تابع installDatagraphTriggers را یک بار اجرا کنید.</li><li>برگه Inventory با ستون‌های استاندارد ساخته می‌شود؛ داده اولیه را از همین پنل Export کنید و در این برگه وارد کنید یا ابتدا همگام‌سازی را برای ارسال سایت اجرا کنید. برگه‌های قدیمی حذف نمی‌شوند.</li><li>برای ارسال خودکار تغییرات سایت، Cron پنج‌دقیقه‌ای داخل راهنما را در cPanel نصب کنید. پنل به‌تنهایی Cron را فعال نمی‌کند.</li></ol>
      <button type="button" onClick={()=>navigator.clipboard.writeText(script).then(()=>setMessage('کد کپی شد.')).catch(()=>setMessage('کد زیر را دستی انتخاب و کپی کنید.'))}>کپی کد Apps Script</button>
      <textarea aria-label="کد Google Apps Script" dir="ltr" readOnly value={script} rows={12} className="font-mono text-xs"/>
    </>}
  </section></div>;
}
