import { StoreContact } from './StoreContact';
import React, { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import {
  CatalogResponse,
  CurrencyMode,
  InstallmentPlan,
  LaptopItem,
  SelectedPCItem,
} from '../types';
import { formatMoney, currencyLabel, getPersianDateTime, toPersianDigits } from '../utils';
import {
  Printer,
  ImageDown,
  Laptop,
  Monitor,
  Phone,
  MapPin,
  Smartphone,
  User,
  CheckCircle,
} from 'lucide-react';

interface InvoicePreviewProps {
  catalog: CatalogResponse;
  selections: Record<string, SelectedPCItem>;
  assemblyEnabled: boolean;
  assemblyFee: number;
  currency: CurrencyMode;
  installment: InstallmentPlan;
  selectedLaptops: LaptopItem[];
  laptopCustomPrices: Record<string, number>;
  customerName: string;
  setCustomerName: (name: string) => void;
  invoiceMode: 'pc' | 'laptop';
  setInvoiceMode: (mode: 'pc' | 'laptop') => void;
}

export const InvoicePreview: React.FC<InvoicePreviewProps> = ({
  catalog,
  selections,
  assemblyEnabled,
  assemblyFee,
  currency,
  installment,
  selectedLaptops,
  laptopCustomPrices,
  customerName,
  setCustomerName,
  invoiceMode,
  setInvoiceMode,
}) => {
  const [paperSize, setPaperSize] = useState<'A5' | 'A4'>('A5');
  const [exportingImage, setExportingImage] = useState(false);
  const paperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.dataset.paper = paperSize;
    const style = document.createElement('style');
    style.textContent = `@media print { @page { size: ${paperSize} portrait; margin: ${paperSize === 'A5' ? 8 : 12}mm; } }`;
    document.head.appendChild(style);
    const fit = () => {
      const paper = paperRef.current;
      if (!paper) return;
      const body = paper.querySelector('.invoice-body') as HTMLElement;
      if (!body) return;
      body.style.zoom = '1';
      // Measure with print styles after the browser switches media.
      const available = (paperSize === 'A5' ? 723 : 1025) - (paper.querySelector('.invoice-header')?.getBoundingClientRect().height || 75);
      if (body.scrollHeight > available) body.style.zoom = String(available / body.scrollHeight);
    };
    const reset = () => { const body = paperRef.current?.querySelector('.invoice-body') as HTMLElement; if (body) body.style.zoom = ''; };
    window.addEventListener('beforeprint', fit);
    window.addEventListener('afterprint', reset);
    return () => { style.remove(); delete document.documentElement.dataset.paper; window.removeEventListener('beforeprint', fit); window.removeEventListener('afterprint', reset); };
  }, [paperSize]);

  const { date, time } = getPersianDateTime();

  const pcInvoiceCategories = catalog.categories.filter((c) => c.in_pc_invoice);
  const otherSel = selections['other'];

  const getRowData = (catKey: string) => {
    const sel = selections[catKey];
    if (!sel || !sel.part) {
      return { name: '---', unitPrice: 0, qty: 1, total: 0, hasSelection: false };
    }
    const unitPrice =
      sel.customPrice !== undefined && sel.customPrice !== null
        ? sel.customPrice
        : sel.part.price || 0;
    const total = unitPrice * (sel.qty || 1);
    const qtyLabel = sel.qty > 1 ? ` (×${sel.qty})` : '';
    return {
      name: `${sel.part.name}${qtyLabel}`,
      unitPrice,
      qty: sel.qty || 1,
      total,
      hasSelection: true,
    };
  };

  const partsSum = pcInvoiceCategories.reduce((acc, c) => acc + getRowData(c.key).total, 0);
  const otherTotal = otherSel?.part
    ? (otherSel.customPrice !== undefined && otherSel.customPrice !== null
        ? otherSel.customPrice
        : otherSel.part.price || 0) * (otherSel.qty || 1)
    : 0;
  const effectiveAssembly = assemblyEnabled ? assemblyFee : 0;
  const grandTotalPC = partsSum + otherTotal + effectiveAssembly;

  const grandTotalLaptops = selectedLaptops.reduce((acc, lap) => {
    const p = laptopCustomPrices[lap.id] ?? lap.price ?? 0;
    return acc + p;
  }, 0);

  const handleDownloadAsImage = async () => {
    if (!paperRef.current) return;
    setExportingImage(true);
    try {
      await document.fonts.ready;
      const clone = paperRef.current.cloneNode(true) as HTMLDivElement;
      clone.classList.add('export-a4');
      clone.dataset.paper = paperSize;
      const width = paperSize === 'A5' ? 559 : 794;
      const height = paperSize === 'A5' ? 794 : 1123;
      const stage = document.createElement('div');
      stage.style.cssText = `position:fixed;left:-20000px;top:0;width:${width}px;pointer-events:none`;
      clone.style.setProperty('width', `${width}px`, 'important');
      clone.style.setProperty('height', `${height}px`, 'important');
      clone.style.setProperty('padding', paperSize === 'A5' ? '30px' : '45px', 'important');
      stage.appendChild(clone);
      document.body.appendChild(stage);
      let dataUrl: string;
      try {
        const body = clone.querySelector('.invoice-body') as HTMLElement | null;
        if (body && clone.scrollHeight > height) {
          const available = height - (clone.querySelector('.invoice-header')?.getBoundingClientRect().height || 80) - 95;
          body.style.zoom = String(Math.min(1, available / body.scrollHeight));
        }
        dataUrl = await toPng(clone, { pixelRatio: 2.5, backgroundColor: '#ffffff', width, height });
      } finally { stage.remove(); }
      const safeCustomer = customerName.trim()
        ? `-${customerName.trim().replace(/\s+/g, '_')}`
        : '';
      const prefix = invoiceMode === 'pc' ? 'DataGraph-PC-Invoice' : 'DataGraph-Laptop-Quote';
      const link = document.createElement('a');
      link.download = `${prefix}${safeCustomer}-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Image export failed:', err);
      alert('خطا در تولید تصویر پیش‌فاکتور. لطفاً دوباره تلاش کنید.');
    } finally {
      setExportingImage(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5 print:space-y-0">
      {/* Action Toolbar (Hidden in Print / PDF) */}
      <div className="print:hidden rounded-2xl bg-white border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-surface-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setInvoiceMode('pc')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
              invoiceMode === 'pc'
                ? 'bg-brand text-white shadow-sm shadow-brand/25'
                : 'text-ink-500 hover:text-ink-900'
            }`}
          >
            <Monitor className="w-4 h-4" />
            پیش‌فاکتور سیستم (PC)
          </button>
          <button
            type="button"
            onClick={() => setInvoiceMode('laptop')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
              invoiceMode === 'laptop'
                ? 'bg-brand text-white shadow-sm shadow-brand/25'
                : 'text-ink-500 hover:text-ink-900'
            }`}
          >
            <Laptop className="w-4 h-4" />
            پیش‌فاکتور لپ‌تاپ ({toPersianDigits(selectedLaptops.length)})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 sm:flex-initial">
            <User className="w-4 h-4 text-ink-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="نام خریدار / شرکت (اختیاری)..."
              className="w-full sm:w-56 pr-9 pl-3 py-2 rounded-xl bg-surface-100 border border-slate-200 text-xs text-ink-900 placeholder-ink-400 focus:outline-none focus:border-brand focus:bg-white"
            />
          </div>

          <label className="text-xs font-bold">اندازه کاغذ
            <select aria-label="اندازه کاغذ" value={paperSize} onChange={e => setPaperSize(e.target.value as 'A5' | 'A4')} className="mx-2 border rounded-lg px-3 py-2 bg-white">
              <option value="A5">A5 (پیش‌فرض)</option><option value="A4">A4</option>
            </select>
          </label>
          <button
            type="button"
            onClick={handleDownloadAsImage}
            disabled={exportingImage}
            className="px-4 py-2 rounded-xl bg-ink-900 hover:bg-ink-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
          >
            <ImageDown className="w-4 h-4" />
            {exportingImage ? 'در حال ساخت تصویر...' : 'دانلود تصویر فاکتور (PNG)'}
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl bg-brand hover:bg-brand-dark text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-brand/25 transition-all"
          >
            <Printer className="w-4 h-4" />
            چاپ / PDF ({paperSize})
          </button>
        </div>
      </div>

      {/* Printable & Image-Exportable Official Paper Sheet */}
      {invoiceMode === 'pc' ? (
        <div
          ref={paperRef}
          className="invoice-paper bg-white text-slate-900 rounded-2xl shadow-xl overflow-hidden border border-slate-200"
        >
          {/* Top Header */}
          <div className="invoice-header bg-ink-900 text-white px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-b-4 border-brand">
            <div className="flex items-center gap-3.5">
              <img
                src="./assets/logo-badge.png"
                alt="دیتاگراف"
                className="h-11 w-auto object-contain rounded-md bg-white p-0.5"
              />
              <div>
                <h1 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
                  <span>پیش‌فاکتور فروش سیستم کامپیوتری</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-brand text-white font-bold">
                    {catalog.store.name}
                  </span>
                </h1>
                <p className="text-xs text-slate-300 mt-0.5">
                  {customerName ? `سفارش‌دهنده: ${customerName}` : catalog.store.tagline}
                </p>
              </div>
            </div>

            <div className="flex sm:flex-col items-center sm:items-end gap-4 sm:gap-0.5 text-xs font-mono bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
              <div className="text-slate-300">
                تاریخ: <span className="text-white font-bold">{date}</span>
              </div>
              <div className="text-slate-300">
                ساعت: <span className="text-white font-bold">{time}</span>
              </div>
            </div>
          </div>

          {/* Body Table */}
          <div className="invoice-body p-4 sm:p-6">
            <div className="overflow-x-auto rounded-xl border border-slate-300">
              <table className="w-full text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-b-2 border-slate-300">
                    <th className="py-2.5 px-3.5 text-right font-extrabold w-40 border-l border-slate-300">
                      گروه کالا
                    </th>
                    <th className="py-2.5 px-3.5 text-right font-extrabold border-l border-slate-300">
                      نام کالا و مشخصات فنی
                    </th>
                    <th className="py-2.5 px-3.5 text-left font-extrabold w-44">
                      قیمت ({currencyLabel(currency)})
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {pcInvoiceCategories.map((cat, idx) => {
                    const row = getRowData(cat.key);
                    return (
                      <tr
                        key={cat.key}
                        className={`${
                          idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'
                        } ${row.hasSelection ? 'font-semibold text-slate-900' : 'text-slate-400'}`}
                      >
                        <td className="py-2 px-3.5 border-l border-slate-200 font-mono text-xs font-bold text-slate-700 bg-slate-50/90">
                          <div className="flex items-center justify-between gap-2">
                            <span dir="ltr">{cat.invoice_label}</span>
                            <span className="text-[10px] font-sans font-normal text-slate-500">
                              {String(cat.persian_label || cat.invoice_label || cat.key).split(' ')[0]}
                            </span>
                          </div>
                        </td>
                        <td
                          dir="ltr"
                          className={`py-2 px-3.5 border-l border-slate-200 text-left font-mono text-xs ${
                            row.hasSelection ? 'text-slate-900 font-semibold' : 'text-slate-400'
                          }`}
                        >
                          {row.name}
                        </td>
                        <td className="py-2 px-3.5 text-left tabular-nums text-xs">
                          {row.hasSelection ? (
                            row.total > 0 ? (
                              <span className="font-bold text-slate-900">
                                {formatMoney(row.total, currency)}
                              </span>
                            ) : (
                              <span className="text-brand text-xs font-semibold">استعلام روز</span>
                            )
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {otherSel?.part && (
                    <tr className="bg-white font-semibold text-slate-900">
                      <td className="py-2 px-3.5 border-l border-slate-200 font-mono text-xs font-bold text-slate-700 bg-slate-50/90">
                        <div className="flex items-center justify-between gap-2">
                          <span dir="ltr">Other</span>
                          <span className="text-[10px] font-sans font-normal text-slate-500">
                            جانبی
                          </span>
                        </div>
                      </td>
                      <td
                        dir="ltr"
                        className="py-2 px-3.5 border-l border-slate-200 text-left font-mono text-xs text-slate-900 font-semibold"
                      >
                        {otherSel.part.name}
                        {otherSel.qty > 1 ? ` (×${otherSel.qty})` : ''}
                      </td>
                      <td className="py-2 px-3.5 text-left tabular-nums text-xs font-bold text-slate-900">
                        {otherTotal > 0 ? formatMoney(otherTotal, currency) : 'استعلام روز'}
                      </td>
                    </tr>
                  )}

                  {/* Assembly Row */}
                  <tr className="bg-slate-50 font-semibold text-slate-800 border-t-2 border-slate-300">
                    <td className="py-2 px-3.5 border-l border-slate-200 font-bold text-xs">
                      نصب و مونتاژ
                    </td>
                    <td className="py-2 px-3.5 border-l border-slate-200 text-xs text-slate-600">
                      {assemblyEnabled
                        ? 'اسمبل و کابل‌کشی حرفه‌ای، آپدیت بایوس، نصب ویندوز و نرم‌افزارهای عمومی و تخصصی'
                        : 'بدون خدمات نصب و مونتاژ'}
                    </td>
                    <td className="py-2 px-3.5 text-left font-bold tabular-nums text-xs">
                      {formatMoney(effectiveAssembly, currency)}
                    </td>
                  </tr>

                  {/* Grand Total Row */}
                  <tr className="invoice-total-row bg-brand text-white font-black text-sm sm:text-base">
                    <td colSpan={2} className="py-3 px-4 text-right">
                      جمع کل قابل پرداخت ({currencyLabel(currency)})
                    </td>
                    <td className="py-3 px-4 text-left text-base sm:text-lg text-white tabular-nums">
                      {formatMoney(grandTotalPC, currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Optional Installment Box */}
            {installment.enabled && (
              <div className="invoice-installment-box mt-4 rounded-xl border border-brand/35 bg-brand/[0.04] p-3.5">
                <div className="flex items-center gap-2 text-brand-dark font-extrabold text-xs mb-2">
                  <CheckCircle className="w-4 h-4" />
                  شرایط پرداخت اقساطی دیتاگراف
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="text-slate-500 text-[11px]">پیش‌پرداخت نقدی</div>
                    <div className="font-bold text-slate-900 mt-0.5 tabular-nums">
                      {formatMoney(installment.cashPayment, currency)} {currencyLabel(currency)}
                    </div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="text-slate-500 text-[11px]">تعداد اقساط</div>
                    <div className="font-bold text-slate-900 mt-0.5">
                      {toPersianDigits(installment.months)} ماه ({toPersianDigits(installment.monthlyRate)}٪)
                    </div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-brand/30">
                    <div className="text-slate-500 text-[11px]">مبلغ هر قسط</div>
                    <div className="font-black text-brand-dark mt-0.5 tabular-nums">
                      {formatMoney(installment.monthlyInstallment, currency)} {currencyLabel(currency)}
                    </div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="text-slate-500 text-[11px]">سود دوران تقسیط</div>
                    <div className="font-bold text-slate-900 mt-0.5 tabular-nums">
                      {formatMoney(installment.totalInterest, currency)} {currencyLabel(currency)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Compact Footer Note */}
            <div className="invoice-footer-box mt-4 rounded-xl bg-slate-100 border border-slate-300 p-3.5 text-xs text-slate-700 leading-relaxed space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-brand-dark">• {catalog.store.price_disclaimer}</span>
                <span className="text-[11px] text-slate-600">• {catalog.store.assembly_note}</span>
              </div>
              <div className="pt-1.5 border-t border-slate-300 flex flex-wrap items-center justify-between gap-3 font-semibold text-slate-800">
                <StoreContact store={catalog.store} />
              </div>
            </div>
            <div className="stamp-row"><div className="stamp-box">مهر و امضای فروشگاه</div></div>
          </div>
        </div>
      ) : (
        /* Printable & Image-Exportable Laptop Quote Sheet */
        <div
          ref={paperRef}
          className="invoice-paper bg-white text-slate-900 rounded-2xl shadow-xl overflow-hidden border border-slate-200"
        >
          <div className="invoice-header bg-ink-900 text-white px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-b-4 border-brand">
            <div className="flex items-center gap-3.5">
              <img
                src="./assets/logo-badge.png"
                alt="دیتاگراف"
                className="h-11 w-auto object-contain rounded-md bg-white p-0.5"
              />
              <div>
                <h1 className="text-lg sm:text-xl font-black">
                  {catalog.store.laptop_invoice_header || `${catalog.store.name} — لیست پیشنهادی نوت‌بوک و لپ‌تاپ`}
                </h1>
                <p className="text-xs text-slate-300 mt-0.5">
                  {customerName ? `مشتری گرامی: ${customerName}` : 'پیش‌فاکتور مقایسه و فروش لپ‌تاپ'}
                </p>
              </div>
            </div>
            <div className="text-xs font-mono text-slate-300">
              {date} | {time}
            </div>
          </div>

          <div className="invoice-body p-4 sm:p-6">
            <div className="overflow-x-auto rounded-xl border border-slate-300">
              <table className="w-full text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-b-2 border-slate-300">
                    <th className="py-2.5 px-3.5 text-center font-extrabold w-16 border-l border-slate-300">
                      ردیف
                    </th>
                    <th className="py-2.5 px-3.5 text-right font-extrabold border-l border-slate-300">
                      مدل و مشخصات لپ‌تاپ
                    </th>
                    <th className="py-2.5 px-3.5 text-left font-extrabold w-44">
                      قیمت ({currencyLabel(currency)})
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedLaptops.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-10 text-center text-slate-400">
                        هنوز لپ‌تاپی به لیست پیشنهادی اضافه نشده است. از تب «لیست لپ‌تاپ‌ها» مدل‌های موردنظر را انتخاب کنید.
                      </td>
                    </tr>
                  ) : (
                    selectedLaptops.map((lap, idx) => {
                      const effectiveP = laptopCustomPrices[lap.id] ?? lap.price ?? 0;
                      return (
                        <tr key={lap.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="py-2.5 px-3.5 text-center font-bold border-l border-slate-200">
                            {toPersianDigits(idx + 1)}
                          </td>
                          <td
                            dir="ltr"
                            className="py-2.5 px-3.5 text-left font-mono font-semibold text-slate-900 border-l border-slate-200"
                          >
                            {lap.model}
                          </td>
                          <td className="py-2.5 px-3.5 text-left font-bold tabular-nums">
                            {effectiveP > 0 ? (
                              formatMoney(effectiveP, currency)
                            ) : (
                              <span className="text-brand text-xs font-semibold">استعلام روز</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                  {selectedLaptops.length > 0 && (
                    <tr className="invoice-total-row bg-brand text-white font-black">
                      <td colSpan={2} className="py-3 px-4 text-right">
                        جمع کل موارد انتخاب‌شده ({toPersianDigits(selectedLaptops.length)} دستگاه)
                      </td>
                      <td className="py-3 px-4 text-left text-white tabular-nums text-base">
                        {formatMoney(grandTotalLaptops, currency)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="invoice-footer-box mt-4 rounded-xl bg-slate-100 border border-slate-300 p-3.5 text-xs text-slate-700 flex flex-wrap items-center justify-between gap-3 font-semibold">
              <StoreContact store={catalog.store} />
            </div>
            <div className="stamp-row"><div className="stamp-box">مهر و امضای فروشگاه</div></div>
          </div>
        </div>
      )}
    </div>
  );
};
