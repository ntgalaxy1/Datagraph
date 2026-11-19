import React from 'react';
import { Instagram, MessageCircle } from 'lucide-react';
import { CatalogResponse } from '../types';
import { normalizeDigitsToEnglish, toPersianDigits } from '../utils';

export function StoreContact({ store, compact = false }: { store: CatalogResponse['store']; compact?: boolean }) {
  const dial = (value: string) => { const n = normalizeDigitsToEnglish(value).replace(/[^+0-9]/g, ''); return n.startsWith('0') ? '+98' + n.slice(1) : n; };
  return <div className={`store-contact flex flex-wrap items-center gap-x-4 gap-y-2 leading-relaxed ${compact ? 'text-[10px]' : 'text-xs'}`}>
    {!compact && store.address?.trim() && <span className="whitespace-pre-wrap">آدرس: {store.address.trim()}</span>}
    {store.phone?.trim() && <a className="font-semibold hover:text-brand" href={`tel:${dial(store.phone)}`}>تلفن: <bdi dir="ltr">{toPersianDigits(store.phone.trim())}</bdi></a>}
    <a className="font-semibold hover:text-brand" href="tel:+989143040751">موبایل: <bdi dir="ltr">۰۹۱۴۳۰۴۰۷۵۱</bdi></a>
    <a href="https://wa.me/989143040751" target="_blank" rel="noreferrer" aria-label="واتساپ فروشگاه" className="inline-flex items-center gap-1 hover:text-brand"><MessageCircle size={15} /><span>واتساپ</span></a>
    <a href="https://instagram.com/datagraphstore" target="_blank" rel="noreferrer" aria-label="اینستاگرام فروشگاه" className="inline-flex items-center gap-1 hover:text-brand"><Instagram size={15} /><bdi dir="ltr">@datagraphstore</bdi></a>
  </div>;
}
