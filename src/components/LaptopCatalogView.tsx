import React, { useState } from 'react';
import { CurrencyMode, LaptopItem } from '../types';
import {
  formatMoney,
  currencyLabel,
  toPersianDigits,
  formatNumberInputWithCommas,
  parseCommaFormattedNumber,
} from '../utils';
import {
  Laptop,
  Search,
  Check,
  Plus,
  Filter,
  FileText,
  Trash2,
  Edit3,
} from 'lucide-react';

interface LaptopCatalogViewProps {
  laptops: LaptopItem[];
  selectedLaptops: LaptopItem[];
  laptopCustomPrices: Record<string, number>;
  currency: CurrencyMode;
  onToggleLaptop: (laptop: LaptopItem) => void;
  onClearSelectedLaptops: () => void;
  onUpdateLaptopCustomPrice: (laptopId: string, priceRial: number | null) => void;
  onGoToLaptopInvoice: () => void;
}

export const LaptopCatalogView: React.FC<LaptopCatalogViewProps> = ({
  laptops,
  selectedLaptops,
  laptopCustomPrices,
  currency,
  onToggleLaptop,
  onClearSelectedLaptops,
  onUpdateLaptopCustomPrice,
  onGoToLaptopInvoice,
}) => {
  const [brandFilter, setBrandFilter] = useState<'ALL' | 'ASUS' | 'LENOVO' | 'ACER'>('ALL');
  const [onlyPriced, setOnlyPriced] = useState(false);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const factor = currency === 'toman' ? 10 : 1;
  const selectedIds = new Set(selectedLaptops.map((l) => l.id));

  const filtered = laptops.filter((lap) => {
    if (brandFilter !== 'ALL' && lap.brand !== brandFilter) return false;
    const p = laptopCustomPrices[lap.id] ?? lap.price ?? 0;
    if (onlyPriced && p <= 0) return false;
    if (query.trim()) {
      return lap.model.toLowerCase().includes(query.trim().toLowerCase());
    }
    return true;
  });

  const brandStats = {
    ALL: laptops.length,
    ASUS: laptops.filter((l) => l.brand === 'ASUS').length,
    LENOVO: laptops.filter((l) => l.brand === 'LENOVO').length,
    ACER: laptops.filter((l) => l.brand === 'ACER').length,
  };

  const startPriceEdit = (lap: LaptopItem) => {
    const p = laptopCustomPrices[lap.id] ?? lap.price ?? 0;
    setEditingId(lap.id);
    setDraft(p > 0 ? formatNumberInputWithCommas(Math.round(p / factor)) : '');
  };

  const commitPriceEdit = (lap: LaptopItem) => {
    setEditingId(null);
    const num = parseCommaFormattedNumber(draft);
    if (!draft.trim() || num <= 0) {
      onUpdateLaptopCustomPrice(lap.id, null);
      return;
    }
    onUpdateLaptopCustomPrice(lap.id, num * factor);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
              <Laptop className="w-5 h-5" />
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-ink-900">
              لیست نوت‌بوک و لپ‌تاپ‌های دیتاگراف
            </h2>
          </div>
          <p className="text-xs text-ink-500">
            می‌توانید یک یا چند مدل لپ‌تاپ را برای مقایسه و صدور پیش‌فاکتور رسمی انتخاب نمایید.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {selectedLaptops.length > 0 && (
            <button
              type="button"
              onClick={onClearSelectedLaptops}
              className="px-3.5 py-2 rounded-xl bg-surface-100 hover:bg-brand/10 text-ink-500 hover:text-brand text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              پاک کردن لیست ({toPersianDigits(selectedLaptops.length)})
            </button>
          )}
          <button
            type="button"
            onClick={onGoToLaptopInvoice}
            className="px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-dark text-white text-xs font-bold shadow-md shadow-brand/25 flex items-center gap-2 transition-all"
          >
            <FileText className="w-4 h-4" />
            مشاهده پیش‌فاکتور لپ‌تاپ ({toPersianDigits(selectedLaptops.length)} دستگاه)
          </button>
        </div>
      </div>

      {/* Brand Filters + Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {(['ALL', 'ASUS', 'LENOVO', 'ACER'] as const).map((b) => {
            const active = brandFilter === b;
            const label = b === 'ALL' ? 'همه برندها' : b;
            return (
              <button
                key={b}
                type="button"
                onClick={() => setBrandFilter(b)}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                  active
                    ? 'bg-brand text-white border-brand shadow-sm shadow-brand/25'
                    : 'bg-white text-ink-700 border-slate-200 hover:border-brand/40'
                }`}
              >
                {label} ({toPersianDigits(brandStats[b])})
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 text-ink-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجوی مدل لپ‌تاپ (Ryzen, i7, RTX 3050)..."
              className="w-full pr-9 pl-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-ink-900 placeholder-ink-400 focus:outline-none focus:border-brand"
            />
          </div>

          <button
            type="button"
            onClick={() => setOnlyPriced((v) => !v)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-colors shrink-0 ${
              onlyPriced
                ? 'bg-brand/10 border-brand text-brand-dark'
                : 'bg-white border-slate-200 text-ink-500 hover:text-ink-900'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            فقط قیمت‌دار
          </button>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((lap) => {
          const isSelected = selectedIds.has(lap.id);
          const effectiveP = laptopCustomPrices[lap.id] ?? lap.price ?? 0;
          const isEditing = editingId === lap.id;

          return (
            <div
              key={lap.id}
              className={`rounded-2xl p-5 border transition-all flex flex-col justify-between gap-4 relative overflow-hidden ${
                isSelected
                  ? 'bg-white border-brand shadow-[0_10px_30px_-8px_rgba(212,51,66,0.25)] ring-1 ring-brand/30'
                  : 'bg-white border-slate-200 hover:border-brand/35 shadow-sm'
              }`}
            >
              <div
                className="absolute top-0 right-0 left-0 h-1"
                style={{ backgroundColor: isSelected ? '#D43342' : lap.brand_color }}
              />

              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-md bg-surface-100 text-ink-700 border border-slate-200">
                    {lap.brand}
                  </span>

                  {effectiveP > 0 ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                      آماده فروش
                    </span>
                  ) : (
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-surface-100 text-ink-500">
                      استعلام قیمت
                    </span>
                  )}
                </div>

                <div
                  dir="ltr"
                  className="font-mono text-sm font-bold text-ink-900 leading-relaxed text-left"
                >
                  {lap.model}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <div>
                  {isEditing ? (
                    <input
                      type="text"
                      inputMode="numeric"
                      dir="ltr"
                      value={draft}
                      onChange={(e) => setDraft(formatNumberInputWithCommas(e.target.value))}
                      onBlur={() => commitPriceEdit(lap)}
                      onKeyDown={(e) => e.key === 'Enter' && commitPriceEdit(lap)}
                      autoFocus
                      placeholder="قیمت..."
                      className="w-36 px-2.5 py-1 rounded-lg bg-white border-2 border-brand text-xs font-mono tabular-nums text-left text-ink-900 focus:outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => startPriceEdit(lap)}
                      className="group/lp flex items-center gap-1.5 text-right"
                      title="ثبت یا اصلاح قیمت در پیش‌فاکتور"
                    >
                      {effectiveP > 0 ? (
                        <div>
                          <span className="text-base font-black text-brand-dark tabular-nums">
                            {formatMoney(effectiveP, currency)}
                          </span>{' '}
                          <span className="text-[11px] font-semibold text-ink-500">
                            {currencyLabel(currency)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-brand hover:underline">
                          + ثبت قیمت روز
                        </span>
                      )}
                      <Edit3 className="w-3 h-3 text-ink-400 opacity-0 group-hover/lp:opacity-100 transition-opacity" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onToggleLaptop(lap)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    isSelected
                      ? 'bg-brand text-white shadow-md shadow-brand/25'
                      : 'bg-surface-100 hover:bg-brand hover:text-white text-ink-700'
                  }`}
                >
                  {isSelected ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      انتخاب شد
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      افزودن به فاکتور
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
