import React, { useMemo, useState } from 'react';
import { CatalogResponse, CurrencyMode, SelectedPCItem } from '../types';
import { formatMoney } from '../utils';

const tiers = [
  { id: 'office', title: 'اداری و خانگی', cpu: /12400(?!F)/i, ram: /16G.*3200/i, gpu: /1030.*2G/i, storage: /480|500|512/i, psu: /550W/i },
  { id: 'gaming', title: 'گیمینگ', cpu: /12400F/i, ram: /32G.*3200/i, gpu: /3060 12G/i, storage: /1TB|1000|1T /i, psu: /650W/i },
  { id: 'design', title: 'رندرینگ و طراحی', cpu: /12700(?!F|K)/i, ram: /64G.*3200/i, gpu: /3060 12G/i, storage: /1TB|1000|1T /i, psu: /750W/i },
  { id: 'coding', title: 'برنامه‌نویسی', cpu: /12400(?!F)/i, ram: /32G.*3200/i, gpu: /1650.*4G/i, storage: /1TB|1000|1T /i, psu: /650W/i },
  { id: 'budget', title: 'اقتصادی', cpu: /12100(?!F)/i, ram: /16G.*3200/i, gpu: /1030.*2G/i, storage: /240|256/i, psu: /450W|550W/i },
];
export function RecommendedSystems({ catalog, currency, onApply }: { catalog: CatalogResponse; currency: CurrencyMode; onApply: (items: Record<string, SelectedPCItem>) => void }) {
  const [tierId, setTierId] = useState('office');
  const tier = tiers.find(t => t.id === tierId)!;
  const rows = useMemo(() => {
    const rules: Record<string, RegExp> = { cpu: tier.cpu, motherboard: /H610.*D4|B660.*D4|B760.*D4/i, ram: tier.ram, vga: tier.gpu, ssd: tier.storage, hdd: /1TB|2TB/i, power: tier.psu, case: /Green Griffin G[2467]|GT301/i, fan: /Deep Cool AK400$/i, monitor: /24.*IPS|24.*FHD|PA248/i, keyboard_mouse: /A4tech/i, silicon: /Icefusion/i };
    return Object.entries(rules).map(([key, pattern]) => {
      const category = catalog.categories.find(c => c.key === key);
      const candidates = category?.items.filter(i => pattern.test(i.name)) || [];
      const part = candidates.find(i => (i.price || 0) > 0) || candidates[0] || null;
      return { key, title: category?.persian_label || key, part };
    });
  }, [catalog, tier]);
  return <section className="recommended-systems rounded-2xl bg-white border border-slate-200 p-4 space-y-3">
    <h2 className="font-extrabold text-sm">سیستم‌های پیشنهادی آماده — پیکربندی کامل</h2>
    <div className="flex flex-wrap gap-2">{tiers.map(t => <button type="button" key={t.id} onClick={() => setTierId(t.id)} className={`rounded-lg px-3 py-2 text-xs font-bold ${tierId === t.id ? 'bg-brand text-white' : 'bg-surface-100'}`}>{t.title}</button>)}</div>
    <p className="text-xs leading-6 text-ink-500">پلتفرم Intel نسل ۱۲، مادربرد LGA1700 نسخه DDR4 و حافظه DDR4-3200. مشخصات هر مدل از کاتالوگ خوانده می‌شود. تأیید نهایی نسخه BIOS، براکت LGA1700 خنک‌کننده، ابعاد کارت/کیس و ظرفیت واقعی پاور پیش از خرید ضروری است.</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{rows.map(r => <div key={r.key} className="min-w-0 rounded-xl border border-slate-200 p-3 text-xs"><div className="font-bold mb-1">{r.title}</div><div dir="auto" className="break-words leading-6">{r.part?.name || 'مدل منطبق در کاتالوگ موجود نیست — نیازمند انتخاب مدیر'}</div><div className="text-brand font-bold mt-1">{r.part?.price ? formatMoney(r.part.price, currency) : 'نیازمند استعلام قیمت'}</div></div>)}</div>
    <p className="text-xs text-ink-500">کارت گرافیک مستقل در همه پیکربندی‌ها درج شده است؛ برای سیستم اداری/اقتصادی با پردازنده غیر F، امکان حذف آن و استفاده از گرافیک داخلی وجود دارد. درایو نوری و اسپیکر اختیاری‌اند.</p>
    <button type="button" className="bg-brand text-white rounded-xl px-4 py-2 text-sm font-bold" onClick={() => { const next: Record<string, SelectedPCItem> = Object.fromEntries(catalog.categories.map(c => [c.key, { part: null, qty: 1, customPrice: null }])); rows.forEach(r => { next[r.key] = { part: r.part, qty: 1, customPrice: null }; }); onApply(next); }}>اعمال تمام قطعات این سیستم</button>
  </section>;
}
