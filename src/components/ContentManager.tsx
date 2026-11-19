import React, { useState } from 'react';
import { CatalogResponse, CategoryData, SiteContent } from '../types';

export function ContentManager({ catalog, onSave }: { catalog: CatalogResponse; onSave: (c: CatalogResponse) => Promise<void> }) {
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(catalog)) as CatalogResponse);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const content: SiteContent = draft.content || { headerBadge: 'فروشگاه تخصصی سیستم و لپ‌تاپ', footerCredit: 'Powered by Naser Tavakkoli · @nt.galaxy', blocks: [] };
  const update = (patch: Partial<SiteContent>) => setDraft({ ...draft, content: { ...content, ...patch } });
  const inputClass = 'w-full border border-slate-200 rounded-xl p-3 text-sm bg-white';
  const categoryUpdate = (key: string, patch: Partial<CategoryData>) => setDraft({ ...draft, categories: draft.categories.map(c => c.key === key ? { ...c, ...patch } : c) });
  async function save() {
    setBusy(true); setMessage('');
    const categories = draft.categories.map(c => ({ ...c, count: c.items.length, priced_count: c.items.filter(i => (i.price || 0) > 0).length, hyperlink_count: c.items.filter(i => i.hyperlink).length }));
    const next = { ...draft, content, categories, stats: { ...draft.stats, total_categories: categories.length, total_parts: categories.reduce((s,c) => s+c.count,0), priced_parts: categories.reduce((s,c) => s+c.priced_count,0), total_laptops: draft.laptops.length } };
    try { await onSave(next); setMessage('تغییرات ذخیره شد.'); } catch (e) { setMessage('ذخیره ناموفق بود: ' + String(e)); } finally { setBusy(false); }
  }
  return <div className="space-y-5">
    <section className="bg-white border rounded-2xl p-5 space-y-4">
      <h2 className="font-bold text-lg">ویرایش محتوای سایت</h2><p className="text-sm text-slate-500">آدرس، تلفن و موبایل فقط از تب «مشخصات فروشگاه و مونتاژ» مدیریت می‌شوند و در تمام سایت و فاکتورها مشترک هستند.</p>
      <p className="text-sm text-slate-500">خالی کردن متن، آن را از نمایش عمومی حذف می‌کند. برای اعمال تغییرات، ذخیره را بزنید.</p>
      <label className="block">نشان متنی بالای سایت<input className={inputClass} value={content.headerBadge} onChange={e => update({ headerBadge: e.target.value })} /></label>
      {(Object.keys(draft.store) as (keyof typeof draft.store)[]).filter(k => typeof draft.store[k] === 'string' && !['default_selected_laptop', 'address', 'phone', 'mobile', 'raw_footer'].includes(k)).map(k => <label className="block text-sm" key={k}>{({name:'نام فروشگاه',tagline:'شعار فروشگاه',address:'آدرس',phone:'تلفن',mobile:'موبایل',assembly_note:'توضیحات مونتاژ',price_disclaimer:'توضیح اعتبار قیمت',raw_footer:'متن تکمیلی فوتر',laptop_invoice_header:'عنوان فاکتور لپ‌تاپ'} as Record<string,string>)[k] || k}<textarea className={inputClass} value={String(draft.store[k] || '')} onChange={e => setDraft({ ...draft, store: { ...draft.store, [k]: e.target.value } })} /></label>)}
    </section>
    <section className="bg-white border rounded-2xl p-5 space-y-4">
      <h2 className="font-bold">بلوک‌های محتوایی صفحه اصلی</h2>
      <button type="button" className="text-brand font-bold" onClick={() => update({ blocks: [...content.blocks, { id: crypto.randomUUID(), title: '', body: '', visible: true }] })}>+ افزودن محتوای جدید</button>
      {content.blocks.map((block, i) => {
        const change = (patch: Partial<typeof block>) => update({ blocks: content.blocks.map(b => b.id === block.id ? { ...b, ...patch } : b) });
        return <div key={block.id} className="border rounded-xl p-4 space-y-3">
          <input aria-label="عنوان محتوا" placeholder="عنوان محتوا" className={inputClass} value={block.title} onChange={e => change({ title: e.target.value })} />
          <textarea aria-label="متن محتوا" placeholder="متن محتوا" rows={4} className={inputClass} value={block.body} onChange={e => change({ body: e.target.value })} />
          <div className="flex gap-5 flex-wrap"><label><input type="checkbox" checked={block.visible} onChange={e => change({ visible: e.target.checked })} /> نمایش در سایت</label>
          <button type="button" disabled={i === 0} onClick={() => { const blocks = [...content.blocks]; [blocks[i-1],blocks[i]] = [blocks[i],blocks[i-1]]; update({blocks}); }}>انتقال به بالا</button>
          <button type="button" className="text-red-600" onClick={() => { if (confirm('این محتوا حذف شود؟')) update({ blocks: content.blocks.filter(b => b.id !== block.id) }); }}>حذف محتوا</button></div>
        </div>;
      })}
    </section>
    <section className="bg-white border rounded-2xl p-5 space-y-4">
      <h2 className="font-bold">افزودن، ویرایش و حذف دسته‌بندی محصولات</h2>
      <p className="text-xs text-slate-500">حذف دسته‌بندی، تمام محصولات داخل آن را نیز حذف می‌کند. قطعات و لپ‌تاپ‌ها را از تب‌های مربوط مدیریت کنید.</p>
      <button type="button" className="text-brand font-bold" onClick={() => { const key = 'category_' + Date.now(); setDraft({ ...draft, categories: [...draft.categories, { key, sheet_header: 'گروه جدید', invoice_label: 'New', persian_label: 'گروه جدید', col_name: 0, col_price: 0, invoice_row: null, in_pc_invoice: true, count: 0, priced_count: 0, hyperlink_count: 0, items: [] }] }); }}>+ افزودن دسته‌بندی</button>
      {draft.categories.map(c => <div key={c.key} className="border rounded-xl p-3 grid sm:grid-cols-2 gap-3">
        <label>نام فارسی<input className={inputClass} value={c.persian_label} onChange={e => categoryUpdate(c.key, { persian_label: e.target.value })} /></label>
        <label>عنوان در فاکتور<input className={inputClass} value={c.invoice_label} onChange={e => categoryUpdate(c.key, { invoice_label: e.target.value })} /></label>
        <label><input type="checkbox" checked={c.in_pc_invoice} onChange={e => categoryUpdate(c.key, { in_pc_invoice: e.target.checked })} /> نمایش در فاکتور سیستم</label>
        <button type="button" className="text-red-600" onClick={() => { if (confirm(`دسته «${c.persian_label}» و ${c.items.length} محصول آن حذف شوند؟`)) setDraft({ ...draft, categories: draft.categories.filter(x => x.key !== c.key) }); }}>حذف دسته و محصولات ({c.items.length})</button>
      </div>)}
    </section>
    <div className="sticky bottom-3 bg-white border rounded-xl p-4 flex items-center gap-4 shadow-lg"><button type="button" disabled={busy} onClick={save} className="bg-brand text-white rounded-xl px-5 py-3 disabled:opacity-50">{busy ? 'در حال ذخیره...' : 'ذخیره تغییرات محتوا'}</button><span role="status">{message}</span></div>
  </div>;
}
