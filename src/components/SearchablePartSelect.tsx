import React, { useState, useRef, useEffect } from 'react';
import { PartItem, CurrencyMode } from '../types';
import {
  formatMoney,
  currencyLabel,
  toPersianDigits,
  formatNumberInputWithCommas,
  parseCommaFormattedNumber,
} from '../utils';
import { Search, ChevronDown, X, ExternalLink, Check, Sparkles } from 'lucide-react';

interface SearchablePartSelectProps {
  categoryLabel: string;
  persianLabel: string;
  items: PartItem[];
  selectedPart: PartItem | null;
  customPrice: number | null | undefined;
  qty: number;
  currency: CurrencyMode;
  onlyPricedGlobal: boolean;
  icon: React.ReactNode;
  onSelect: (part: PartItem | null) => void;
  onQtyChange: (qty: number) => void;
  onCustomPriceChange: (price: number | null) => void;
}

export const SearchablePartSelect: React.FC<SearchablePartSelectProps> = ({
  categoryLabel,
  persianLabel,
  items,
  selectedPart,
  customPrice,
  qty,
  currency,
  onlyPricedGlobal,
  icon,
  onSelect,
  onQtyChange,
  onCustomPriceChange,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceDraft, setPriceDraft] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const filtered = items.filter((item) => {
    if (onlyPricedGlobal && (!item.price || item.price <= 0)) return false;
    if (!query.trim()) return true;
    return item.name.toLowerCase().includes(query.trim().toLowerCase());
  });

  const effectiveUnitPrice =
    customPrice !== undefined && customPrice !== null
      ? customPrice
      : selectedPart?.price ?? 0;

  const lineTotal = effectiveUnitPrice * qty;

  const startPriceEdit = () => {
    const currentVal =
      currency === 'toman' ? Math.round(effectiveUnitPrice / 10) : effectiveUnitPrice;
    setPriceDraft(currentVal > 0 ? formatNumberInputWithCommas(currentVal) : '');
    setEditingPrice(true);
  };

  const commitPriceEdit = () => {
    setEditingPrice(false);
    const num = parseCommaFormattedNumber(priceDraft);
    if (!priceDraft.trim() || num <= 0) {
      onCustomPriceChange(null);
      return;
    }
    onCustomPriceChange(currency === 'toman' ? num * 10 : num);
  };

  return (
    <div
      ref={containerRef}
      className={`group relative rounded-2xl border transition-all duration-200 ${
        selectedPart
          ? 'bg-white border-brand/45 shadow-[0_8px_28px_-8px_rgba(212,51,66,0.18)]'
          : 'bg-white border-slate-200/90 hover:border-brand/30 shadow-sm'
      } ${open ? 'z-40 ring-2 ring-brand/20' : 'z-10'}`}
    >
      <div className="p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center gap-3">
        {/* Category Title & Icon */}
        <div className="flex items-center justify-between lg:w-52 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                selectedPart
                  ? 'bg-brand text-white shadow-md shadow-brand/25'
                  : 'bg-brand/8 text-brand group-hover:bg-brand/15'
              }`}
            >
              {icon}
            </div>
            <div>
              <div className="text-sm font-extrabold text-ink-900">{persianLabel}</div>
              <div className="text-[11px] font-mono text-ink-400 tracking-wide">
                {categoryLabel}
              </div>
            </div>
          </div>

          <span className="lg:hidden text-[11px] text-ink-400 font-medium">
            {toPersianDigits(items.length)} مدل
          </span>
        </div>

        {/* Selector Trigger */}
        <div className="flex-1 min-w-0 relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className={`w-full text-right px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
              selectedPart
                ? 'bg-brand/[0.03] border-brand/25 text-ink-900'
                : 'bg-surface-100/80 border-slate-200 text-ink-500 hover:border-brand/30 hover:bg-white'
            }`}
          >
            <div className="truncate flex items-center gap-2 min-w-0">
              {selectedPart ? (
                <>
                  <span
                    dir="ltr"
                    className="font-mono text-xs sm:text-sm font-semibold text-ink-900 truncate"
                  >
                    {selectedPart.name}
                  </span>
                  {selectedPart.hyperlink && (
                    <a
                      href={selectedPart.hyperlink}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title="مشاهده مشخصات فنی"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand/10 text-brand hover:bg-brand hover:text-white text-[10px] font-sans font-semibold transition-colors shrink-0"
                    >
                      <ExternalLink className="w-3 h-3" />
                      مشخصات
                    </a>
                  )}
                </>
              ) : (
                <span className="text-xs sm:text-sm text-ink-500">
                  انتخاب یا جستجو در بین {toPersianDigits(items.length)} مدل...
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {selectedPart && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(null);
                  }}
                  className="p-1 rounded-md hover:bg-brand/15 text-ink-400 hover:text-brand transition-colors"
                  title="حذف انتخاب"
                >
                  <X className="w-3.5 h-3.5" />
                </span>
              )}
              <ChevronDown
                className={`w-4 h-4 text-ink-400 transition-transform duration-200 ${
                  open ? 'rotate-180 text-brand' : ''
                }`}
              />
            </div>
          </button>

          {/* Dropdown Popover */}
          {open && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-50">
              <div className="p-3 border-b border-slate-100 bg-surface-100 flex items-center gap-2">
                <Search className="w-4 h-4 text-brand shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`جستجو در ${persianLabel} (مثلاً Asus, Core i5, 16G)...`}
                  className="w-full bg-transparent text-xs sm:text-sm text-ink-900 placeholder-ink-400 focus:outline-none"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="text-ink-400 hover:text-brand"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    onSelect(null);
                    setOpen(false);
                    setQuery('');
                  }}
                  className="w-full px-4 py-2.5 text-right text-xs text-ink-400 hover:bg-surface-100 flex items-center justify-between"
                >
                  <span>--- (عدم انتخاب قطعه)</span>
                  <span className="font-mono text-[11px]">0</span>
                </button>

                {filtered.length === 0 ? (
                  <div className="p-6 text-center text-xs text-ink-400">
                    موردی با عبارت «{query}» یافت نشد.
                  </div>
                ) : (
                  filtered.map((item) => {
                    const isSelected = selectedPart?.id === item.id;
                    const hasPrice = item.price !== null && item.price > 0;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onSelect(item);
                          setOpen(false);
                          setQuery('');
                        }}
                        className={`w-full px-4 py-2.5 text-right flex items-center justify-between gap-3 transition-colors ${
                          isSelected
                            ? 'bg-brand/10 text-brand-dark font-bold'
                            : 'hover:bg-surface-100 text-ink-900'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isSelected && <Check className="w-4 h-4 text-brand shrink-0" />}
                          <span
                            dir="ltr"
                            className="font-mono text-xs sm:text-[13px] truncate text-left"
                          >
                            {item.name}
                          </span>
                        </div>

                        <div className="shrink-0 flex items-center gap-1.5">
                          {hasPrice ? (
                            <span className="text-xs font-bold text-ink-900 tabular-nums">
                              {formatMoney(item.price, currency)}{' '}
                              <span className="text-[10px] font-normal text-ink-500">
                                {currencyLabel(currency)}
                              </span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-ink-500 bg-surface-200 px-2 py-0.5 rounded-md">
                              استعلام روز
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quantity & Price Box */}
        <div className="flex items-center justify-between lg:justify-end gap-2.5 lg:w-60 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
          {selectedPart ? (
            <>
              <div className="flex items-center bg-surface-100 border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => onQtyChange(Math.max(1, qty - 1))}
                  className="px-2.5 py-1 text-xs font-bold text-ink-700 hover:bg-brand hover:text-white transition-colors"
                >
                  -
                </button>
                <span className="px-2.5 text-xs font-extrabold tabular-nums text-ink-900">
                  {toPersianDigits(qty)}
                </span>
                <button
                  type="button"
                  onClick={() => onQtyChange(qty + 1)}
                  className="px-2.5 py-1 text-xs font-bold text-ink-700 hover:bg-brand hover:text-white transition-colors"
                >
                  +
                </button>
              </div>

              <div className="text-left">
                {editingPrice ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    value={priceDraft}
                    onChange={(e) => setPriceDraft(formatNumberInputWithCommas(e.target.value))}
                    onBlur={commitPriceEdit}
                    onKeyDown={(e) => e.key === 'Enter' && commitPriceEdit()}
                    placeholder="مبلغ..."
                    autoFocus
                    className="w-32 px-2.5 py-1 rounded-lg bg-white border-2 border-brand text-xs text-left font-mono tabular-nums text-ink-900 focus:outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={startPriceEdit}
                    title="کلیک برای ثبت یا اصلاح قیمت در این پیش‌فاکتور"
                    className="text-left flex flex-col items-end"
                  >
                    {lineTotal > 0 ? (
                      <span className="text-sm font-black text-brand-dark tabular-nums">
                        {formatMoney(lineTotal, currency)}{' '}
                        <span className="text-[10px] font-semibold text-ink-500">
                          {currencyLabel(currency)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-brand bg-brand/10 border border-brand/25 px-2.5 py-1 rounded-lg flex items-center gap-1 hover:bg-brand hover:text-white transition-colors">
                        <Sparkles className="w-3 h-3" />
                        ثبت قیمت روز
                      </span>
                    )}
                  </button>
                )}
              </div>
            </>
          ) : (
            <span className="text-xs text-slate-300 font-mono">—</span>
          )}
        </div>
      </div>
    </div>
  );
};
