import React from 'react';
import { Instagram, MessageCircle } from 'lucide-react';

/** Deliberately has no props, CMS selectors or runtime configuration. */
export function LockedFooter() {
  return <footer className="print:hidden border-t border-slate-200 bg-white py-5 mt-12" data-locked-footer="true">
    <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 items-center gap-4 text-xs text-ink-500">
      <div className="text-center">کلیه حقوق متعلق به فروشگاه دیتاگراف می‌باشد.</div>
      <div dir="ltr" className="text-center font-semibold">Powered by Naser Tavakkoli · <a href="https://instagram.com/nt.galaxy" target="_blank" rel="noreferrer">@nt.galaxy</a></div>
      <div className="flex flex-wrap justify-center gap-3">
        <span>آدرس: تبریز، خ امام، پاساژ سهند، ط همکف، پلاک ۲۳</span>
        <a href="tel:+984135531145">تلفن: <bdi>۰۴۱۳۵۵۳۱۱۴۵</bdi></a>
        <a href="tel:+989143040751">موبایل: <bdi>۰۹۱۴۳۰۴۰۷۵۱</bdi></a>
        <a href="https://wa.me/989143040751" target="_blank" rel="noreferrer" className="inline-flex gap-1"><MessageCircle size={14}/>واتساپ</a>
        <a href="https://instagram.com/datagraphstore" target="_blank" rel="noreferrer" className="inline-flex gap-1"><Instagram size={14}/><bdi>@datagraphstore</bdi></a>
      </div>
    </div>
  </footer>;
}
