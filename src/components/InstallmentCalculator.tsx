import React, { useState, useEffect } from 'react';
import { CurrencyMode, InstallmentPlan } from '../types';
import {
  calculateInstallmentVBA,
  formatMoney,
  currencyLabel,
  toPersianDigits,
  formatNumberInputWithCommas,
  parseCommaFormattedNumber,
  normalizeDigitsToEnglish,
} from '../utils';
import { Calculator, CheckCircle2, RotateCcw, ArrowLeftRight } from 'lucide-react';

interface InstallmentCalculatorProps {
  invoiceTotalRial: number;
  currency: CurrencyMode;
  currentPlan: InstallmentPlan;
  onApplyPlan: (plan: InstallmentPlan) => void;
  onNavigateToInvoice?: () => void;
}

export const InstallmentCalculator: React.FC<InstallmentCalculatorProps> = ({
  invoiceTotalRial,
  currency,
  currentPlan,
  onApplyPlan,
  onNavigateToInvoice,
}) => {
  const factor = currency === 'toman' ? 10 : 1;

  const [totalInput, setTotalInput] = useState<number>(
    currentPlan.totalAmount > 0 ? currentPlan.totalAmount : invoiceTotalRial
  );
  const [cashInput, setCashInput] = useState<number>(currentPlan.cashPayment || 0);
  const [rateInput, setRateInput] = useState<number>(currentPlan.monthlyRate || 4);
  const [monthsInput, setMonthsInput] = useState<number>(currentPlan.months || 6);
  const [appliedToast, setAppliedToast] = useState(false);

  useEffect(() => {
    if (invoiceTotalRial > 0 && totalInput === 0) {
      setTotalInput(invoiceTotalRial);
    }
  }, [invoiceTotalRial]);

  const result = calculateInstallmentVBA(totalInput, cashInput, rateInput, monthsInput);

  const handleApply = () => {
    onApplyPlan({
      enabled: true,
      totalAmount: totalInput,
      cashPayment: cashInput,
      monthlyRate: rateInput,
      months: monthsInput,
      totalInterest: result.totalInterest,
      monthlyInstallment: result.monthlyInstallment,
    });
    setAppliedToast(true);
    setTimeout(() => setAppliedToast(false), 2500);
  };

  const handleReset = () => {
    setCashInput(0);
    setRateInput(4);
    setMonthsInput(6);
    onApplyPlan({
      enabled: false,
      totalAmount: invoiceTotalRial,
      cashPayment: 0,
      monthlyRate: 4,
      months: 6,
      totalInterest: 0,
      monthlyInstallment: 0,
    });
  };

  const displayTotal =
    totalInput > 0 ? formatNumberInputWithCommas(Math.round(totalInput / factor)) : '';
  const displayCash =
    cashInput > 0 ? formatNumberInputWithCommas(Math.round(cashInput / factor)) : '';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 text-brand text-xs font-bold">
            <Calculator className="w-3.5 h-3.5" />
            شرایط فروش اقساطی دیتاگراف
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-ink-900">
            محاسبه‌گر هوشمند اقساط خرید سیستم و لپ‌تاپ
          </h2>
          <p className="text-xs sm:text-sm text-ink-500">
            مبلغ کل، پیش‌پرداخت نقدی و تعداد ماه‌های بازپرداخت را مشخص کنید تا مبلغ هر قسط محاسبه و در پیش‌فاکتور درج شود.
          </p>
        </div>

        {invoiceTotalRial > 0 && invoiceTotalRial !== totalInput && (
          <button
            type="button"
            onClick={() => setTotalInput(invoiceTotalRial)}
            className="shrink-0 px-4 py-2.5 rounded-xl bg-brand/10 hover:bg-brand hover:text-white text-brand text-xs font-bold flex items-center gap-2 transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4" />
            فراخوانی جمع فاکتور فعلی ({formatMoney(invoiceTotalRial, currency)} {currencyLabel(currency)})
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Inputs Card */}
        <div className="lg:col-span-7 rounded-2xl bg-white border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="block text-xs font-extrabold text-ink-700">
                کل مبلغ فاکتور ({currencyLabel(currency)})
              </label>
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                value={displayTotal}
                onChange={(e) => {
                  const val = parseCommaFormattedNumber(e.target.value);
                  setTotalInput(val * factor);
                }}
                placeholder="مثلاً 25,000,000"
                className="w-full px-4 py-3 rounded-xl bg-surface-100 border border-slate-200 text-ink-900 font-mono text-sm text-left tabular-nums focus:outline-none focus:border-brand focus:bg-white transition-colors"
              />
              <div className="text-[11px] text-ink-500">
                معادل: {formatMoney(totalInput, currency)} {currencyLabel(currency)}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-extrabold text-ink-700">
                مبلغ پیش‌پرداخت نقدی ({currencyLabel(currency)})
              </label>
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                value={displayCash}
                onChange={(e) => {
                  const val = parseCommaFormattedNumber(e.target.value);
                  setCashInput(val * factor);
                }}
                placeholder="مثلاً 5,000,000"
                className="w-full px-4 py-3 rounded-xl bg-surface-100 border border-slate-200 text-ink-900 font-mono text-sm text-left tabular-nums focus:outline-none focus:border-brand focus:bg-white transition-colors"
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                {[20, 30, 40, 50].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setCashInput(Math.round((totalInput * pct) / 100))}
                    className="px-2.5 py-0.5 text-[11px] font-semibold rounded-md bg-surface-100 hover:bg-brand hover:text-white text-ink-700 border border-slate-200 transition-colors"
                  >
                    {toPersianDigits(pct)}٪ نقد
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-extrabold text-ink-700">
                درصد کارمزد ماهیانه (٪)
              </label>
              <input
                type="text"
                inputMode="decimal"
                dir="ltr"
                value={rateInput}
                onChange={(e) => {
                  const clean = normalizeDigitsToEnglish(e.target.value).replace(/[^0-9.]/g, '');
                  setRateInput(Number(clean) || 0);
                }}
                className="w-full px-4 py-3 rounded-xl bg-surface-100 border border-slate-200 text-ink-900 font-mono text-sm text-left tabular-nums focus:outline-none focus:border-brand focus:bg-white transition-colors"
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                {[2.5, 3, 3.5, 4, 5].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRateInput(r)}
                    className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-md border transition-colors ${
                      rateInput === r
                        ? 'bg-brand text-white border-brand'
                        : 'bg-surface-100 hover:border-brand/40 text-ink-700 border-slate-200'
                    }`}
                  >
                    {toPersianDigits(r)}٪
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-extrabold text-ink-700">
                تعداد اقساط (ماه)
              </label>
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                value={monthsInput}
                onChange={(e) => {
                  const val = parseCommaFormattedNumber(e.target.value);
                  setMonthsInput(Math.max(1, Math.min(60, val || 1)));
                }}
                className="w-full px-4 py-3 rounded-xl bg-surface-100 border border-slate-200 text-ink-900 font-mono text-sm text-left tabular-nums focus:outline-none focus:border-brand focus:bg-white transition-colors"
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                {[3, 6, 9, 12, 18].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMonthsInput(m)}
                    className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-md border transition-colors ${
                      monthsInput === m
                        ? 'bg-brand text-white border-brand'
                        : 'bg-surface-100 hover:border-brand/40 text-ink-700 border-slate-200'
                    }`}
                  >
                    {toPersianDigits(m)} ماهه
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Results Card */}
        <div className="lg:col-span-5 rounded-2xl bg-white border border-slate-200 shadow-sm p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <h3 className="text-base font-extrabold text-ink-900 border-b border-slate-100 pb-3">
              نتیجه محاسبه اقساط
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-ink-500">مانده قابل تقسیط:</span>
                <span className="font-bold text-ink-900 tabular-nums">
                  {formatMoney(result.remainingPrincipal, currency)} {currencyLabel(currency)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-ink-500">سود دوران تقسیط:</span>
                <span className="font-bold text-ink-900 tabular-nums">
                  {formatMoney(result.totalInterest, currency)} {currencyLabel(currency)}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-brand text-white shadow-lg shadow-brand/25 space-y-1">
                <div className="text-xs text-white/90 font-semibold">
                  مبلغ هر قسط ماهیانه (طی {toPersianDigits(monthsInput)} ماه):
                </div>
                <div className="text-2xl font-black tabular-nums">
                  {formatMoney(result.monthlyInstallment, currency)}{' '}
                  <span className="text-xs font-normal text-white/85">
                    {currencyLabel(currency)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                <span className="text-ink-500">جمع کل تمام‌شده (نقد + اقساط):</span>
                <span className="font-extrabold text-ink-900 tabular-nums">
                  {formatMoney(result.totalPayableWithInterest, currency)} {currencyLabel(currency)}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              onClick={handleApply}
              className="w-full py-3 px-4 rounded-xl bg-ink-900 hover:bg-brand text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              افزودن شرایط اقساط به پیش‌فاکتور
            </button>

            <div className="flex items-center gap-2">
              {currentPlan.enabled && onNavigateToInvoice && (
                <button
                  type="button"
                  onClick={onNavigateToInvoice}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-brand/10 hover:bg-brand/20 text-brand-dark text-xs font-bold transition-colors"
                >
                  مشاهده در پیش‌فاکتور
                </button>
              )}
              <button
                type="button"
                onClick={handleReset}
                className="py-2.5 px-3 rounded-xl bg-surface-100 hover:bg-surface-200 text-ink-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                پاک کردن
              </button>
            </div>

            {appliedToast && (
              <div className="text-center text-xs text-emerald-600 font-bold">
                شرایط اقساط در پیش‌فاکتور ثبت شد.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
