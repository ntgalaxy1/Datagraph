import {AIInvoiceLine} from './components/GeminiAssistant';
import {inventoryRows} from './inventoryClient';
import { LockedFooter } from './components/LockedFooter';
import { RecommendedSystems } from './components/RecommendedSystems';
import { StoreContact } from './components/StoreContact';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  CatalogResponse,
  CurrencyMode,
  InstallmentPlan,
  LaptopItem,
  PartItem,
  SelectedPCItem,
} from './types';
import {
  formatMoney,
  currencyLabel,
  toPersianDigits,
  formatNumberInputWithCommas,
  parseCommaFormattedNumber,
} from './utils';
import {
  loadInitialCatalog,
  parseExcelBufferInBrowser,
  saveFullCatalog,
  verifyAdminPassword,
  changeAdminPasswordOnServer,
  clearAdminSession,
  getSavedAdminKey,
} from './excelEngine';
import { SearchablePartSelect } from './components/SearchablePartSelect';
import { InstallmentCalculator } from './components/InstallmentCalculator';
import { InvoicePreview } from './components/InvoicePreview';
import { LaptopCatalogView } from './components/LaptopCatalogView';
import { AdminPortalView } from './components/AdminPortalView';
import {
  Monitor,
  Cpu,
  CircuitBoard,
  MemoryStick,
  HardDrive,
  Database,
  Tv,
  Disc,
  Box,
  Zap,
  Keyboard,
  Mouse,
  Volume2,
  Printer,
  Headphones,
  Calculator,
  FileText,
  Laptop,
  Wrench,
  RotateCcw,
  Filter,
  Sparkles,
  Phone,
  MapPin,
  ShieldCheck,
  Lock,
} from 'lucide-react';

type ActiveTab = 'pc-builder' | 'laptops' | 'installment' | 'invoice' | 'admin';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  monitor: <Monitor className="w-5 h-5" />,
  mb: <CircuitBoard className="w-5 h-5" />,
  cpu: <Cpu className="w-5 h-5" />,
  ram: <MemoryStick className="w-5 h-5" />,
  ssd: <Zap className="w-5 h-5" />,
  hdd: <HardDrive className="w-5 h-5" />,
  vga: <Tv className="w-5 h-5" />,
  odd: <Disc className="w-5 h-5" />,
  case: <Box className="w-5 h-5" />,
  power: <Database className="w-5 h-5" />,
  keyboard: <Keyboard className="w-5 h-5" />,
  mouse: <Mouse className="w-5 h-5" />,
  speaker: <Volume2 className="w-5 h-5" />,
  printer: <Printer className="w-5 h-5" />,
  other: <Headphones className="w-5 h-5" />,
};

export function App() {
  const catalogRevision = useRef(0);
  const [loadError, setLoadError] = useState('');
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [introPhase, setIntroPhase] = useState<'playing' | 'done'>('playing');

  const [activeTab, setActiveTab] = useState<ActiveTab>('pc-builder');
  const [invoiceSubMode, setInvoiceSubMode] = useState<'pc' | 'laptop'>('pc');
  const [currency, setCurrency] = useState<CurrencyMode>('toman');
  const [onlyPricedGlobal, setOnlyPricedGlobal] = useState(false);

  // PC Builder Selections
  const [aiInvoice,setAIInvoice]=useState<AIInvoiceLine[]|null>(null);
  const [selections, setSelections] = useState<Record<string, SelectedPCItem>>({});
  const [assemblyEnabled, setAssemblyEnabled] = useState(true);
  const [assemblyFee, setAssemblyFee] = useState(5000000);
  const [customerName, setCustomerName] = useState('');

  // Laptop Selections
  const [selectedLaptops, setSelectedLaptops] = useState<LaptopItem[]>([]);
  const [laptopCustomPrices, setLaptopCustomPrices] = useState<Record<string, number>>({});

  // Installment Plan
  const [installment, setInstallment] = useState<InstallmentPlan>({
    enabled: false,
    totalAmount: 0,
    cashPayment: 0,
    monthlyRate: 4,
    months: 6,
    totalInterest: 0,
    monthlyInstallment: 0,
  });

  // Admin Session State
  const [adminKey, setAdminKey] = useState<string>(() => getSavedAdminKey() || '');
  const isAdmin = Boolean(adminKey);

  const initSelectionsFromCatalog = (data: CatalogResponse) => {
    setAssemblyFee(data.store.default_assembly_fee || 5000000);
    setSelections((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const init: Record<string, SelectedPCItem> = {};
      for (const cat of data.categories) {
        init[cat.key] = { part: null, qty: 1, customPrice: null };
      }
      init['other'] = { part: null, qty: 1, customPrice: null };
      return init;
    });

    setSelectedLaptops((prev) => {
      if (prev.length > 0 || !data.store.default_selected_laptop) return prev;
      const def = data.laptops.find((l) => l.model === data.store.default_selected_laptop);
      return def ? [def] : prev;
    });
  };

  useEffect(() => {
    let mounted = true;
    const minIntroTimer = new Promise((resolve) => setTimeout(resolve, 2100));

    Promise.all([loadInitialCatalog(false), minIntroTimer])
      .then(([data]) => {
        if (!mounted) return;
        setCatalog(data);
        initSelectionsFromCatalog(data);
        setIntroPhase('done');
      })
      .catch((error) => {
        if (mounted) { setIntroPhase('done'); setLoadError(error instanceof Error ? error.message : 'خطا در دریافت اطلاعات'); }
      });

  return () => {
      mounted = false;
    };
  }, []);

  const handleReloadExcel = async () => {
    try {
      const r = await fetch('/api/reload', { method: 'POST', headers: { 'X-Admin-Key': adminKey } });
      if (r.ok) {
        const res = await fetch('/api/catalog');
        if (res.ok) {
          const d: CatalogResponse = await res.json();
          setCatalog(d);
          return;
        }
      }
    } catch {
      // Static fallback
    }
    const fresh = await loadInitialCatalog(true);
    setCatalog(fresh);
  };

  const handleUploadExcel = async (file: File) => {
    const buf = await file.arrayBuffer();
    const parsed = await parseExcelBufferInBrowser(buf, file.name, catalog?.store, adminKey || undefined, file);
    setCatalog(parsed);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await fetch('/api/upload-excel', { method: 'POST', headers: { 'X-Admin-Key': adminKey }, body: fd });
    } catch {
      // Handled by sync-catalog.php on cPanel
    }
  };

  const applyUpdatedCatalog = (saved: CatalogResponse) => {
    if (saved._storage === 'mysql') {
      if ((saved._revision || 0) < catalogRevision.current) return;
      catalogRevision.current = saved._revision || 0;
    }
    setCatalog(saved);
    setSelections(prev => Object.fromEntries(saved.categories.map(c => {
      const old = prev[c.key];
      const part = c.items.find(p => p.id === old?.part?.id) || null;
      return [c.key, { part, qty: old?.qty || 1, customPrice: old?.customPrice ?? null }];
    })));
    setSelectedLaptops(prev => prev.flatMap(old => {
      const current = saved.laptops.find(l => l.id === old.id);
      return current ? [current] : [];
    }));
    setAssemblyFee(saved.store.default_assembly_fee || 5000000);
  };

  const handleSaveCatalogChanges = async (updated: CatalogResponse) => {
    const saved = await saveFullCatalog(updated, adminKey || undefined);
    applyUpdatedCatalog(saved);
  };

  const handleAdminLogin = async (password: string) => {
    const res = await verifyAdminPassword(password);
    if (res.ok) {
      setAdminKey(password);
    }
    return res;
  };

  const handleAdminLogout = () => {
    clearAdminSession();
    setAdminKey('');
  };

  const handleAdminChangePassword = async (newPassword: string) => {
    const res = await changeAdminPasswordOnServer(adminKey, newPassword);
    if (res.ok) {
      setAdminKey(newPassword);
    }
    return res;
  };

  const pcItemsCount = useMemo(() => {
    return Object.values(selections).filter((s) => s?.part !== null).length;
  }, [selections]);

  const pcTotalRial = useMemo(() => {
    let sum = 0;
    for (const s of Object.values(selections)) {
      if (!s || !s.part) continue;
      const unit =
        s.customPrice !== undefined && s.customPrice !== null
          ? s.customPrice
          : s.part.price ?? 0;
      sum += unit * (s.qty || 1);
    }
    if (assemblyEnabled) sum += assemblyFee;
    return sum;
  }, [selections, assemblyEnabled, assemblyFee]);

  const handleSelectPart = (catKey: string, part: PartItem | null) => {
    setSelections((prev) => ({
      ...prev,
      [catKey]: {
        part,
        qty: prev[catKey]?.qty || 1,
        customPrice: null,
      },
    }));
  };

  const handleQtyChange = (catKey: string, qty: number) => {
    setSelections((prev) => ({
      ...prev,
      [catKey]: { ...prev[catKey], qty },
    }));
  };

  const handleCustomPriceChange = (catKey: string, price: number | null) => {
    setSelections((prev) => ({
      ...prev,
      [catKey]: { ...prev[catKey], customPrice: price },
    }));
  };

  const handleResetPC = () => {
    if (!catalog) return;
    const clean: Record<string, SelectedPCItem> = {};
    for (const cat of catalog.categories) {
      clean[cat.key] = { part: null, qty: 1, customPrice: null };
    }
    clean['other'] = { part: null, qty: 1, customPrice: null };
    setSelections(clean);
  };

  const handleToggleLaptop = (laptop: LaptopItem) => {
    setSelectedLaptops((prev) => {
      const exists = prev.some((l) => l.id === laptop.id);
      if (exists) return prev.filter((l) => l.id !== laptop.id);
      return [...prev, laptop];
    });
  };

  const handleLaptopCustomPrice = (laptopId: string, priceRial: number | null) => {
    setLaptopCustomPrices((prev) => {
      const copy = { ...prev };
      if (priceRial === null) delete copy[laptopId];
      else copy[laptopId] = priceRial;
      return copy;
    });
  };

  // --- Calm Smooth Logo Fade Intro (Zero technical text!) ---
  if (loadError) return <main dir="rtl" className="max-w-xl mx-auto my-16 p-6 bg-white rounded-xl border"><h1 className="font-bold">دریافت اطلاعات فروشگاه ممکن نشد</h1><p className="my-4">{loadError}</p><button className="bg-brand text-white p-3 rounded-xl" onClick={() => window.location.reload()}>تلاش مجدد</button></main>;
    if (introPhase === 'playing' || !catalog) {
    return (
      <div className="fixed inset-0 z-50 bg-surface-50 flex items-center justify-center p-6 select-none">
        <div className="relative flex flex-col items-center">
          <div className="absolute -inset-12 rounded-full bg-brand/8 blur-3xl pointer-events-none" />
          <img
            src="./assets/logo-full.png"
            alt="دیتاگراف"
            className="relative h-24 sm:h-32 w-auto object-contain animate-logo-intro"
          />
        </div>
      </div>
    );
  }

    const aiRows=inventoryRows(catalog);
  const aiCategories=(aiInvoice||[]).map((line,i)=>{const row=aiRows.find(r=>r.id===line.id)!;const base=catalog.categories.find(c=>c.key===row?.category_key)||catalog.categories[0];return {...base,key:'ai-'+i,in_pc_invoice:true,invoice_label:row?.kind==='laptop'?'Laptop':base.invoice_label,persian_label:row?.kind==='laptop'?'لپ‌تاپ':base.persian_label,items:[]};});
  const aiSelections:Record<string,SelectedPCItem>={};
  (aiInvoice||[]).forEach((line,i)=>{const row=aiRows.find(r=>r.id===line.id);if(row)aiSelections['ai-'+i]={part:{...row,row:i,raw_name:row.name,excel_price:row.initial_price,has_override:false,hyperlink:null},qty:line.quantity};});
  const pcInvoiceCategories = catalog.categories.filter((c) => c.in_pc_invoice);
  const accessoriesCat = catalog.categories.find((c) => !c.in_pc_invoice);
  const factor = currency === 'toman' ? 10 : 1;

  return (
    <div className="min-h-screen flex flex-col bg-surface-100 text-ink-900 animate-fade-up-soft">
      {/* Top Crimson Accent Line Matching DataGraph Logo */}
      <div className="h-1 bg-brand print:hidden" />

      {/* Sleek Light Header Synchronized with Logo */}
      <header className="print:hidden sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shadow-[0_2px_20px_-10px_rgba(20,23,31,0.08)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
          {/* Brand Logo + Title */}
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('pc-builder')}
              className="flex items-center gap-3.5 text-right group"
            >
              <img
                src="./assets/logo-badge.png"
                alt="دیتاگراف"
                className="h-11 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-black tracking-tight text-ink-900">
                    {catalog.store.name}
                  </h1>
                  <span className="hidden sm:inline-block text-[10px] px-2.5 py-0.5 rounded-full bg-brand/10 text-brand font-extrabold">
                    {catalog.content?.headerBadge ?? 'فروشگاه تخصصی سیستم و لپ‌تاپ'}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-ink-500">
                  {catalog.store.tagline}
                </p>
              </div>
            </button>

            {/* Mobile Currency Switcher */}
            <div className="flex lg:hidden items-center bg-surface-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setCurrency('toman')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  currency === 'toman' ? 'bg-brand text-white' : 'text-ink-500'
                }`}
              >
                تومان
              </button>
              <button
                type="button"
                onClick={() => setCurrency('rial')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  currency === 'rial' ? 'bg-brand text-white' : 'text-ink-500'
                }`}
              >
                ریال
              </button>
            </div>
          </div>

          {/* Navigation Tabs (Public tabs + Admin Login) */}
          <nav aria-label="ناوبری اصلی" className="main-nav flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('pc-builder')}
              className={`min-w-0 px-2 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold flex items-center gap-2 transition-all ${
                activeTab === 'pc-builder'
                  ? 'bg-brand text-white shadow-md shadow-brand/25'
                  : 'text-ink-700 hover:bg-surface-100'
              }`}
            >
              <Cpu className="w-4 h-4" />
              اسمبل PC
              {pcItemsCount > 0 && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] rounded-full font-extrabold ${
                    activeTab === 'pc-builder'
                      ? 'bg-white text-brand'
                      : 'bg-brand/10 text-brand'
                  }`}
                >
                  {toPersianDigits(pcItemsCount)}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('laptops')}
              className={`min-w-0 px-2 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold flex items-center gap-2 transition-all ${
                activeTab === 'laptops'
                  ? 'bg-brand text-white shadow-md shadow-brand/25'
                  : 'text-ink-700 hover:bg-surface-100'
              }`}
            >
              <Laptop className="w-4 h-4" />
              لپ‌تاپ‌ها
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('installment')}
              className={`min-w-0 px-2 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold flex items-center gap-2 transition-all ${
                activeTab === 'installment'
                  ? 'bg-brand text-white shadow-md shadow-brand/25'
                  : 'text-ink-700 hover:bg-surface-100'
              }`}
            >
              <Calculator className="w-4 h-4" />
              اقساط
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('invoice')}
              className={`min-w-0 px-2 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold flex items-center gap-2 transition-all ${
                activeTab === 'invoice'
                  ? 'bg-brand text-white shadow-md shadow-brand/25'
                  : 'text-ink-700 hover:bg-surface-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              پیش‌فاکتور
            </button>

            <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block" />

            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={`min-w-0 px-2 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold flex items-center gap-1.5 border transition-all ${
                activeTab === 'admin'
                  ? 'bg-ink-900 text-white border-ink-900 shadow-sm'
                  : isAdmin
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-surface-100 text-ink-700 border-slate-200 hover:border-brand/40 hover:text-brand'
              }`}
            >
              {isAdmin ? (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  پنل مدیریت
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  ورود مدیر
                </>
              )}
            </button>
          </nav>

          {/* Desktop Currency Toggle */}
          <div className="hidden lg:flex items-center gap-2 bg-surface-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setCurrency('toman')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                currency === 'toman'
                  ? 'bg-brand text-white shadow-sm shadow-brand/25'
                  : 'text-ink-500 hover:text-ink-900'
              }`}
            >
              تومان
            </button>
            <button
              type="button"
              onClick={() => setCurrency('rial')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                currency === 'rial'
                  ? 'bg-brand text-white shadow-sm shadow-brand/25'
                  : 'text-ink-500 hover:text-ink-900'
              }`}
            >
              ریال
            </button>
          </div>
        </div>
        <div className="header-contacts max-w-7xl mx-auto px-4 pb-2"><StoreContact store={catalog.store} compact /></div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeTab === 'pc-builder' && catalog.content?.blocks.filter(b => b.visible).map(b => (
          <section key={b.id} className="print:hidden mb-5 rounded-2xl border border-slate-200 bg-white p-5">
            {b.title && <h2 className="text-lg font-bold mb-2">{b.title}</h2>}
            <p className="whitespace-pre-wrap text-sm leading-7">{b.body}</p>
          </section>
        ))}
        {activeTab === 'pc-builder' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Left/Right Main Configurator */}
            <div className="xl:col-span-8 space-y-4">
              <RecommendedSystems catalog={catalog} currency={currency} onApply={setSelections} />
              <div className="rounded-2xl bg-white border border-slate-200 p-3 flex justify-end">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOnlyPricedGlobal((v) => !v)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all ${
                      onlyPricedGlobal
                        ? 'bg-brand/10 border-brand text-brand-dark'
                        : 'bg-surface-100 border-slate-200 text-ink-500 hover:text-ink-900'
                    }`}
                  >
                    <Filter className="w-3.5 h-3.5" />
                    فقط قطعات قیمت‌دار
                  </button>

                  {pcItemsCount > 0 && (
                    <button
                      type="button"
                      onClick={handleResetPC}
                      className="p-2 rounded-xl bg-surface-100 hover:bg-brand/10 text-ink-500 hover:text-brand transition-colors"
                      title="پاک کردن قطعات انتخابی"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Part Rows */}
              <div className="space-y-3">
                {pcInvoiceCategories.map((cat) => {
                  const sel = selections[cat.key] || { part: null, qty: 1, customPrice: null };
                  return (
                    <SearchablePartSelect
                      key={cat.key}
                      categoryLabel={cat.invoice_label}
                      persianLabel={cat.persian_label}
                      items={cat.items}
                      selectedPart={sel.part}
                      customPrice={sel.customPrice}
                      qty={sel.qty}
                      currency={currency}
                      onlyPricedGlobal={onlyPricedGlobal}
                      icon={CATEGORY_ICONS[cat.key] || <Cpu className="w-5 h-5" />}
                      onSelect={(part) => handleSelectPart(cat.key, part)}
                      onQtyChange={(q) => handleQtyChange(cat.key, q)}
                      onCustomPriceChange={(p) => handleCustomPriceChange(cat.key, p)}
                    />
                  );
                })}

                {accessoriesCat && (
                  <SearchablePartSelect
                    key="other"
                    categoryLabel="Other"
                    persianLabel="لوازم جانبی، شبکه و کابل"
                    items={accessoriesCat.items}
                    selectedPart={selections['other']?.part || null}
                    customPrice={selections['other']?.customPrice}
                    qty={selections['other']?.qty || 1}
                    currency={currency}
                    onlyPricedGlobal={onlyPricedGlobal}
                    icon={CATEGORY_ICONS['other']}
                    onSelect={(part) => handleSelectPart('other', part)}
                    onQtyChange={(q) => handleQtyChange('other', q)}
                    onCustomPriceChange={(p) => handleCustomPriceChange('other', p)}
                  />
                )}
              </div>
            </div>

            {/* Sticky Live Invoice Summary Card */}
            <aside className="xl:col-span-4 xl:sticky xl:top-24 space-y-4">
              <div className="rounded-3xl bg-white border border-slate-200 shadow-[0_12px_40px_-15px_rgba(20,23,31,0.1)] overflow-hidden">
                {/* Summary Header with Logo */}
                <div className="p-5 bg-ink-900 text-white border-b-4 border-brand flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src="./assets/logo-badge.png"
                      alt="دیتاگراف"
                      className="h-9 w-auto rounded bg-white p-0.5"
                    />
                    <div>
                      <h3 className="text-sm font-black">خلاصه پیش‌فاکتور سیستم</h3>
                      <p className="text-[11px] text-slate-300">
                        {toPersianDigits(pcItemsCount)} قطعه انتخاب شده
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {/* Customer Name */}
                  <div>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="نام خریدار / سازمان جهت درج در پیش‌فاکتور..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-100 border border-slate-200 text-xs text-ink-900 placeholder-ink-400 focus:outline-none focus:border-brand focus:bg-white transition-colors"
                    />
                  </div>

                  {/* Selected Parts Mini List */}
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                    {pcItemsCount === 0 ? (
                      <div className="py-8 text-center text-xs text-ink-400 border border-dashed border-slate-200 rounded-2xl bg-surface-50">
                        هنوز قطعه‌ای انتخاب نشده است.
                        <br />
                        از فهرست قطعات یا دکمه‌های سیستم پیشنهادی استفاده نمایید.
                      </div>
                    ) : (
                      Object.entries(selections).map(([key, sel]) => {
                        if (!sel?.part) return null;
                        const unit =
                          sel.customPrice !== undefined && sel.customPrice !== null
                            ? sel.customPrice
                            : sel.part.price ?? 0;
                        const rowSum = unit * (sel.qty || 1);
                        return (
                          <div
                            key={key}
                            className="flex items-center justify-between gap-2 text-xs py-2 px-3 rounded-xl bg-surface-100/80 border border-slate-200/70"
                          >
                            <div className="truncate min-w-0">
                              <span className="text-[10px] font-bold text-brand ml-1.5 uppercase">
                                {key}:
                              </span>
                              <span dir="ltr" className="font-mono font-semibold text-ink-900">
                                {sel.part.name}
                              </span>
                              {sel.qty > 1 && (
                                <span className="mr-1 text-brand font-extrabold">
                                  ×{toPersianDigits(sel.qty)}
                                </span>
                              )}
                            </div>
                            <span className="shrink-0 font-bold text-ink-900 tabular-nums">
                              {rowSum > 0 ? formatMoney(rowSum, currency) : 'استعلام'}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Assembly Fee Toggle */}
                  <div className="p-3.5 rounded-2xl bg-surface-100 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-extrabold text-ink-900">
                        <input
                          type="checkbox"
                          checked={assemblyEnabled}
                          onChange={(e) => setAssemblyEnabled(e.target.checked)}
                          className="rounded accent-[#D43342] w-4 h-4"
                        />
                        <Wrench className="w-3.5 h-3.5 text-brand" />
                        خدمات نصب، اسمبل و راه‌اندازی
                      </label>
                      {assemblyEnabled && (
                        <input
                          type="text"
                          inputMode="numeric"
                          dir="ltr"
                          value={formatNumberInputWithCommas(Math.round(assemblyFee / factor))}
                          onChange={(e) =>
                            setAssemblyFee(parseCommaFormattedNumber(e.target.value) * factor)
                          }
                          className="w-28 px-2 py-1 rounded-lg bg-white border border-slate-200 text-left font-mono tabular-nums text-xs font-bold text-ink-900 focus:outline-none focus:border-brand"
                        />
                      )}
                    </div>
                    <p className="text-[10px] text-ink-500 leading-relaxed">
                      {catalog.store.assembly_note}
                    </p>
                  </div>

                  {/* Grand Total Box */}
                  <div className="p-4 rounded-2xl bg-brand text-white shadow-lg shadow-brand/25">
                    <div className="flex items-center justify-between text-xs text-white/90 mb-1">
                      <span className="font-semibold">جمع کل پیش‌فاکتور:</span>
                      <span>واحد: {currencyLabel(currency)}</span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black tabular-nums text-left">
                      {formatMoney(pcTotalRial, currency)}{' '}
                      <span className="text-xs font-normal text-white/85">
                        {currencyLabel(currency)}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setInvoiceSubMode('pc');
                        setActiveTab('invoice');
                      }}
                      className="col-span-2 py-3.5 px-4 rounded-xl bg-ink-900 hover:bg-brand text-white font-extrabold text-sm shadow-md flex items-center justify-center gap-2 transition-all"
                    >
                      <FileText className="w-4 h-4" />
                      صدور و چاپ پیش‌فاکتور رسمی
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setInstallment((prev) => ({
                          ...prev,
                          totalAmount: pcTotalRial,
                        }));
                        setActiveTab('installment');
                      }}
                      className="col-span-2 py-2.5 px-3 rounded-xl bg-brand/10 hover:bg-brand/20 text-brand-dark font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Calculator className="w-3.5 h-3.5" />
                      محاسبه شرایط اقساط برای این سیستم
                    </button>
                  </div>
                </div>
              </div>

            </aside>
          </div>
        )}

        {activeTab === 'laptops' && (
          <LaptopCatalogView
            laptops={catalog.laptops}
            selectedLaptops={selectedLaptops}
            laptopCustomPrices={laptopCustomPrices}
            currency={currency}
            onToggleLaptop={handleToggleLaptop}
            onClearSelectedLaptops={() => setSelectedLaptops([])}
            onUpdateLaptopCustomPrice={handleLaptopCustomPrice}
            onGoToLaptopInvoice={() => {
              setInvoiceSubMode('laptop');
              setActiveTab('invoice');
            }}
          />
        )}

        {activeTab === 'installment' && (
          <InstallmentCalculator
            invoiceTotalRial={pcTotalRial}
            currency={currency}
            currentPlan={installment}
            onApplyPlan={(plan) => setInstallment(plan)}
            onNavigateToInvoice={() => {
              setInvoiceSubMode('pc');
              setActiveTab('invoice');
            }}
          />
        )}

        {activeTab === 'invoice' && (
          <><div className="no-print mb-2">{aiInvoice&&<button onClick={()=>setAIInvoice(null)}>خروج از پیش‌فاکتور هوش مصنوعی و بازگشت به انتخاب‌های دستی</button>}</div><InvoicePreview
            catalog={aiInvoice?{...catalog,categories:aiCategories}:catalog}
            selections={aiInvoice?aiSelections:selections}
            assemblyEnabled={aiInvoice?false:assemblyEnabled}
            assemblyFee={assemblyFee}
            currency={currency}
            installment={installment}
            selectedLaptops={selectedLaptops}
            laptopCustomPrices={laptopCustomPrices}
            customerName={customerName}
            setCustomerName={setCustomerName}
            invoiceMode={aiInvoice?'pc':invoiceSubMode}
            setInvoiceMode={setInvoiceSubMode}
          /></>
        )}

        {activeTab === 'admin' && (
          <AdminPortalView
            onAIInvoice={(lines,fresh)=>{applyUpdatedCatalog(fresh);setAIInvoice(lines);setCustomerName('');setInstallment(prev=>({...prev,enabled:false}));setInvoiceSubMode('pc');setActiveTab('invoice');}}
            catalog={catalog}
            currency={currency}
            isAdmin={isAdmin}
            onAdminLogin={handleAdminLogin}
            onAdminLogout={handleAdminLogout}
            onAdminChangePassword={handleAdminChangePassword}
            onCatalogUpdated={applyUpdatedCatalog}
            onSaveCatalogChanges={handleSaveCatalogChanges}
            onUploadExcel={handleUploadExcel}
            onReloadExcel={handleReloadExcel}
          />
        )}
      </main>

      <LockedFooter />
    </div>
  );
}
export default App;
