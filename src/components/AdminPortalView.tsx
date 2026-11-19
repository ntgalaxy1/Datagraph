import {GeminiAssistant,AIInvoiceLine} from './GeminiAssistant';
import { InventorySpreadsheet } from './InventorySpreadsheet';
import { BackupManager } from './BackupManager';
import { ContentManager } from './ContentManager';
import React, { useState, useEffect } from 'react';
import { CatalogResponse, CurrencyMode, LaptopItem, PartItem } from '../types';
import {
  formatMoney,
  currencyLabel,
  toPersianDigits,
  formatNumberInputWithCommas,
  parseCommaFormattedNumber,
} from '../utils';
import {
  ShieldCheck,
  Lock,
  UploadCloud,
  RefreshCw,
  KeyRound,
  Plus,
  Trash2,
  Edit3,
  Check,
  Search,
  Save,
  Store,
  Cpu,
  Laptop,
  X,
} from 'lucide-react';

interface AdminPortalViewProps {
  onAIInvoice:(lines:AIInvoiceLine[],catalog:CatalogResponse)=>void;
  catalog: CatalogResponse;
  currency: CurrencyMode;
  isAdmin: boolean;
  onAdminLogin: (password: string) => Promise<{ ok: boolean; error?: string }>;
  onAdminLogout: () => void;
  onAdminChangePassword: (newPassword: string) => Promise<{ ok: boolean; message: string }>;
  onCatalogUpdated: (catalog: CatalogResponse) => void;
  onSaveCatalogChanges: (updatedCatalog: CatalogResponse) => Promise<void>;
  onUploadExcel: (file: File) => Promise<void>;
  onReloadExcel: () => Promise<void>;
}

export const AdminPortalView: React.FC<AdminPortalViewProps> = ({
  catalog,
  onAIInvoice,
  currency,
  isAdmin,
  onAdminLogin,
  onAdminLogout,
  onAdminChangePassword,
  onSaveCatalogChanges,
  onCatalogUpdated,
  onUploadExcel,
  onReloadExcel,
}) => {
  // Login state
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);

  // Admin sub-sections
  const [section, setSection] = useState<'parts' | 'laptops' | 'store' | 'security' | 'content' | 'backup' | 'inventory'>('inventory');
  const [activeCatKey, setActiveCatKey] = useState<string>(catalog.categories[0]?.key || 'monitor');
  const [searchQuery, setSearchQuery] = useState('');

  // Inline item edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editInitialPrice, setEditInitialPrice] = useState('');
  const [editLink, setEditLink] = useState('');

  // Add new item state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newBrand, setNewBrand] = useState<'ASUS' | 'LENOVO' | 'ACER' | 'OTHER'>('ASUS');

  // Store info form state
  const [storeName, setStoreName] = useState(catalog.store.name);
  const [storeTagline, setStoreTagline] = useState(catalog.store.tagline);
  const [storeAddress, setStoreAddress] = useState(catalog.store.address);
  const [storePhone, setStorePhone] = useState(catalog.store.phone);
  const [storeMobile, setStoreMobile] = useState(catalog.store.mobile);
  const [assemblyFee, setAssemblyFee] = useState(
    Math.round((catalog.store.default_assembly_fee || 5000000) / (currency === 'toman' ? 10 : 1))
  );
  const [assemblyNote, setAssemblyNote] = useState(catalog.store.assembly_note);
  const [priceDisclaimer, setPriceDisclaimer] = useState(catalog.store.price_disclaimer);

  // Security password state
  const [newPass, setNewPass] = useState('');
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setStoreName(catalog.store.name);
    setStoreTagline(catalog.store.tagline);
    setStoreAddress(catalog.store.address);
    setStorePhone(catalog.store.phone);
    setStoreMobile(catalog.store.mobile);
    setAssemblyNote(catalog.store.assembly_note);
    setPriceDisclaimer(catalog.store.price_disclaimer);
    setAssemblyFee(Math.round(catalog.store.default_assembly_fee / (currency === 'toman' ? 10 : 1)));
  }, [catalog.store, currency]);

  const factor = currency === 'toman' ? 10 : 1;

  const notify = (msg: string) => {
    setStatusToast(msg);
    setTimeout(() => setStatusToast(null), 3000);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginBusy(true);
    setLoginError(null);
    const res = await onAdminLogin(passwordInput);
    setLoginBusy(false);
    if (res.ok) {
      setPasswordInput('');
    } else {
      setLoginError(res.error || 'رمز عبور اشتباه است.');
    }
  };

  // --- Not Logged In: Clean Branded Login Card ---
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto py-10">
        <div className="rounded-3xl bg-white border border-slate-200 shadow-xl p-8 space-y-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-brand/10 text-brand flex items-center justify-center">
              <Lock className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-black text-ink-900">ورود مدیر فروشگاه دیتاگراف</h2>
            <p className="text-xs text-ink-500 leading-relaxed">
              جهت ویرایش قیمت‌ها، افزودن یا حذف کالاها، بروزرسانی فایل اکسل و تغییر مشخصات فروشگاه، رمز مدیریت را وارد نمایید.
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="رمز عبور مدیریت..."
              dir="ltr"
              autoFocus
              className="w-full px-4 py-3.5 rounded-xl bg-surface-100 border border-slate-200 text-ink-900 font-mono text-sm text-center focus:outline-none focus:border-brand focus:bg-white transition-all"
            />

            {loginError && (
              <div className="p-3 rounded-xl bg-brand/10 border border-brand/25 text-brand-dark text-xs font-bold text-center">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loginBusy}
              className="w-full py-3.5 rounded-xl bg-brand hover:bg-brand-dark text-white font-extrabold text-sm shadow-lg shadow-brand/25 transition-all disabled:opacity-50"
            >
              {loginBusy ? 'در حال بررسی...' : 'ورود به پنل مدیریت'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Logged In: Full Management Console ---
  const activeCategory =
    catalog.categories.find((c) => c.key === activeCatKey) || catalog.categories[0];

  const filteredParts = (activeCategory?.items || []).filter((i) =>
    !searchQuery.trim() ? true : i.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const filteredLaptops = catalog.laptops.filter((l) =>
    !searchQuery.trim() ? true : l.model.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const cloneCatalog = (): CatalogResponse => JSON.parse(JSON.stringify(catalog));

  const recomputeStats = (c: CatalogResponse) => {
    let totalP = 0;
    let pricedP = 0;
    let linkedP = 0;
    for (const cat of c.categories) {
      cat.count = cat.items.length;
      cat.priced_count = cat.items.filter((x) => x.price && x.price > 0).length;
      cat.hyperlink_count = cat.items.filter((x) => x.hyperlink).length;
      totalP += cat.count;
      pricedP += cat.priced_count;
      linkedP += cat.hyperlink_count;
    }
    c.stats.total_parts = totalP;
    c.stats.priced_parts = pricedP;
    c.stats.hyperlinked_parts = linkedP;
    c.stats.total_laptops = c.laptops.length;
    c.stats.priced_laptops = c.laptops.filter((l) => l.price && l.price > 0).length;
  };

  const startPartEdit = (item: PartItem) => {
    setEditingId(item.id);
    setEditInitialPrice(formatNumberInputWithCommas(Math.round((item.initial_price ?? item.excel_price ?? item.price ?? 0) / factor)));
    setEditName(item.name);
    setEditPrice(item.price ? formatNumberInputWithCommas(Math.round(item.price / factor)) : '');
    setEditLink(item.hyperlink || '');
  };

  const savePartEdit = async (item: PartItem) => {
    const next = cloneCatalog();
    const cat = next.categories.find((c) => c.key === item.category_key);
    if (!cat) return;
    const target = cat.items.find((x) => x.id === item.id);
    if (!target) return;

    const rawP = parseCommaFormattedNumber(editPrice);
    const numP = rawP > 0 ? rawP * factor : null;

    target.name = editName.trim() || target.name;
    target.raw_name = target.name;
    target.price = numP && numP > 0 ? Math.round(numP) : null;
    target.initial_price = editInitialPrice.trim() === '' ? null : parseCommaFormattedNumber(editInitialPrice) * factor;
    target.excel_price = target.price;
    target.hyperlink = editLink.trim() || null;

    recomputeStats(next);
    setEditingId(null);
    await onSaveCatalogChanges(next);
    notify('تغییرات قطعه با موفقیت ذخیره شد.');
  };

  const deletePart = async (item: PartItem) => {
    if (!confirm(`آیا از حذف «${item.name}» مطمئن هستید؟`)) return;
    const next = cloneCatalog();
    const cat = next.categories.find((c) => c.key === item.category_key);
    if (!cat) return;
    cat.items = cat.items.filter((x) => x.id !== item.id);
    recomputeStats(next);
    await onSaveCatalogChanges(next);
    notify('قطعه حذف شد.');
  };

  const addNewPart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const next = cloneCatalog();
    const cat = next.categories.find((c) => c.key === activeCatKey);
    if (!cat) return;

    const rawP = parseCommaFormattedNumber(newPrice);
    const numP = rawP > 0 ? Math.round(rawP * factor) : null;
    const nextRow = (cat.items.reduce((m, x) => Math.max(m, x.row), 2) || 2) + 1;

    cat.items.unshift({
      id: `part:${cat.key}:custom_${Date.now()}`,
      row: nextRow,
      category_key: cat.key,
      name: newName.trim(),
      raw_name: newName.trim(),
      initial_price: numP && numP > 0 ? numP : null,
      excel_price: numP && numP > 0 ? numP : null,
      price: numP && numP > 0 ? numP : null,
      has_override: false,
      hyperlink: null,
    });

    recomputeStats(next);
    setNewName('');
    setNewPrice('');
    setShowAddForm(false);
    await onSaveCatalogChanges(next);
    notify('کالای جدید به لیست اضافه شد.');
  };

  const startLaptopEdit = (lap: LaptopItem) => {
    setEditingId(lap.id);
    setEditInitialPrice(formatNumberInputWithCommas(Math.round((lap.initial_price ?? lap.excel_price ?? lap.price ?? 0) / factor)));
    setEditName(lap.model);
    setEditPrice(lap.price ? formatNumberInputWithCommas(Math.round(lap.price / factor)) : '');
  };

  const saveLaptopEdit = async (lap: LaptopItem) => {
    const next = cloneCatalog();
    const target = next.laptops.find((x) => x.id === lap.id);
    if (!target) return;

    const rawP = parseCommaFormattedNumber(editPrice);
    const numP = rawP > 0 ? Math.round(rawP * factor) : null;

    target.model = editName.trim() || target.model;
    target.raw_model = target.model;
    target.price = numP && numP > 0 ? numP : null;
    target.initial_price = editInitialPrice.trim() === '' ? null : parseCommaFormattedNumber(editInitialPrice) * factor;
    target.excel_price = target.price;

    recomputeStats(next);
    setEditingId(null);
    await onSaveCatalogChanges(next);
    notify('مشخصات و قیمت لپ‌تاپ ذخیره شد.');
  };

  const deleteLaptop = async (lap: LaptopItem) => {
    if (!confirm(`آیا از حذف لپ‌تاپ «${lap.model}» مطمئن هستید؟`)) return;
    const next = cloneCatalog();
    next.laptops = next.laptops.filter((x) => x.id !== lap.id);
    recomputeStats(next);
    await onSaveCatalogChanges(next);
    notify('لپ‌تاپ حذف شد.');
  };

  const addNewLaptop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const next = cloneCatalog();
    const rawP = parseCommaFormattedNumber(newPrice);
    const numP = rawP > 0 ? Math.round(rawP * factor) : null;
    const colorMap = {
      ASUS: '#00B0F0',
      LENOVO: '#EAB308',
      ACER: '#84CC16',
      OTHER: '#94A3B8',
    };

    next.laptops.unshift({
      id: `laptop:custom_${Date.now()}`,
      row: next.laptops.length + 2,
      model: newName.trim(),
      raw_model: newName.trim(),
      brand: newBrand,
      excel_fill_rgb: null,
      brand_color: colorMap[newBrand],
      brand_label: newBrand,
      initial_price: numP && numP > 0 ? numP : null,
      excel_price: numP && numP > 0 ? numP : null,
      price: numP && numP > 0 ? numP : null,
      has_override: false,
    });

    recomputeStats(next);
    setNewName('');
    setNewPrice('');
    setShowAddForm(false);
    await onSaveCatalogChanges(next);
    notify('لپ‌تاپ جدید اضافه شد.');
  };

  const saveStoreDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = cloneCatalog();
    next.store = {
      ...next.store,
      name: storeName.trim(),
      tagline: storeTagline.trim(),
      address: storeAddress.trim(),
      phone: storePhone.trim(),
      mobile: storeMobile.trim(),
      default_assembly_fee: Math.round((Number(assemblyFee) || 0) * factor),
      assembly_note: assemblyNote.trim(),
      price_disclaimer: priceDisclaimer.trim(),
    };
    await onSaveCatalogChanges(next);
    notify('اطلاعات فروشگاه و هزینه مونتاژ با موفقیت ذخیره شد.');
  };

  const handleExcelUploadInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      await onUploadExcel(f);
      notify('فایل اکسل جدید با موفقیت خوانده و جایگزین شد.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handlePassChange = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await onAdminChangePassword(newPass);
    notify(res.message);
    if (res.ok) setNewPass('');
  };

  if (section === 'inventory') return <div className="space-y-4">
    <GeminiAssistant catalog={catalog} currency={currency} onCreate={onAIInvoice}/>
    <InventorySpreadsheet catalog={catalog} currency={currency} onCatalog={onCatalogUpdated} />
    <nav aria-label="ابزارهای مدیریت" className="flex flex-wrap gap-2 text-xs">
      <button type="button" className="border rounded-xl px-4 py-2 bg-white" onClick={() => setSection('content')}>محتوا و دسته‌بندی‌ها</button>
      <button type="button" className="border rounded-xl px-4 py-2 bg-white" onClick={() => setSection('store')}>مشخصات فروشگاه</button>
      <button type="button" className="border rounded-xl px-4 py-2 bg-white" onClick={() => setSection('security')}>تغییر رمز مدیریت</button>
      <button type="button" className="border rounded-xl px-4 py-2 bg-white" onClick={() => setSection('backup')}>پشتیبان‌گیری</button>
      <button type="button" className="border rounded-xl px-4 py-2 bg-ink-900 text-white" onClick={onAdminLogout}>خروج مدیر</button>
    </nav>
  </div>;

  return (
    <div className="space-y-6">
      <button type="button" onClick={() => setSection('inventory')} className="bg-brand text-white px-5 py-3 rounded-xl font-bold">جدول شیتی محصولات و تغییر سریع قیمت</button>
      {/* Top Admin Header */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-brand text-white flex items-center justify-center shadow-md shadow-brand/25">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-ink-900">پنل مدیریت یکپارچه فروشگاه دیتاگراف</h2>
            <p className="text-xs text-ink-500">
              ویرایش مستقیم قیمت‌ها، افزودن/حذف قطعات و لپ‌تاپ‌ها، بروزرسانی اکسل و تنظیمات فاکتور
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className={`${catalog._storage === 'mysql' ? 'hidden' : ''} cursor-pointer px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-dark text-white text-xs font-bold shadow-md shadow-brand/20 flex items-center gap-2 transition-all`}>
            <UploadCloud className="w-4 h-4" />
            <span>{uploading ? 'در حال جایگزینی...' : 'بارگذاری فایل اکسل جدید'}</span>
            <input
              type="file"
              accept=".xlsm,.xlsx"
              onChange={handleExcelUploadInput}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={onReloadExcel}
            className="px-3.5 py-2.5 rounded-xl bg-surface-100 hover:bg-surface-200 text-ink-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            بازخوانی اطلاعات
          </button>

          <button
            type="button"
            onClick={onAdminLogout}
            className="px-3.5 py-2.5 rounded-xl bg-ink-900 hover:bg-brand text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Lock className="w-3.5 h-3.5" />
            خروج مدیر
          </button>
        </div>
      </div>

      {statusToast && (
        <div className="rounded-xl bg-emerald-600 text-white px-4 py-3 text-xs font-bold shadow-lg flex items-center justify-between">
          <span>{statusToast}</span>
          <Check className="w-4 h-4" />
        </div>
      )}

      <p className="text-xs text-ink-500 bg-white border rounded-xl p-3">قیمت اولیه هنگام افزودن محصول ثبت می‌شود و قیمت فروش با همان مبلغ شروع می‌شود. در بخش ویرایش، هر دو مبلغ جداگانه قابل تغییرند؛ فاکتور بر اساس قیمت فروش صادر می‌شود.</p>
      <button type="button" onClick={() => setSection('backup')} className="px-5 py-3 rounded-xl border bg-white font-bold">پشتیبان‌گیری</button>
      {section === 'backup' && <BackupManager />}
      <p className="text-xs text-ink-500">فوتر و امضای توسعه‌دهنده ثابت‌اند و از پنل قابل تغییر نیستند.</p>
      {/* Sub-navigation */}
      <button type="button" onClick={() => setSection('content')} className="px-5 py-3 rounded-xl bg-brand text-white font-bold">مدیریت محتوا و دسته‌بندی‌ها</button>
      {section === 'content' && <ContentManager catalog={catalog} onSave={onSaveCatalogChanges} />}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => {
            setSection('parts');
            setShowAddForm(false);
          }}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 border transition-all ${
            section === 'parts'
              ? 'bg-brand text-white border-brand shadow-sm shadow-brand/25'
              : 'bg-white text-ink-700 border-slate-200 hover:border-brand/40'
          }`}
        >
          <Cpu className="w-4 h-4" />
          مدیریت قطعات سیستم ({toPersianDigits(catalog.stats.total_parts)})
        </button>

        <button
          type="button"
          onClick={() => {
            setSection('laptops');
            setShowAddForm(false);
          }}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 border transition-all ${
            section === 'laptops'
              ? 'bg-brand text-white border-brand shadow-sm shadow-brand/25'
              : 'bg-white text-ink-700 border-slate-200 hover:border-brand/40'
          }`}
        >
          <Laptop className="w-4 h-4" />
          مدیریت لپ‌تاپ‌ها ({toPersianDigits(catalog.stats.total_laptops)})
        </button>

        <button
          type="button"
          onClick={() => setSection('store')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 border transition-all ${
            section === 'store'
              ? 'bg-brand text-white border-brand shadow-sm shadow-brand/25'
              : 'bg-white text-ink-700 border-slate-200 hover:border-brand/40'
          }`}
        >
          <Store className="w-4 h-4" />
          مشخصات فروشگاه و مونتاژ
        </button>

        <button
          type="button"
          onClick={() => setSection('security')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 border transition-all ${
            section === 'security'
              ? 'bg-brand text-white border-brand shadow-sm shadow-brand/25'
              : 'bg-white text-ink-700 border-slate-200 hover:border-brand/40'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          تغییر رمز مدیریت
        </button>
      </div>

      {/* SECTION 1: PARTS MANAGEMENT */}
      {section === 'parts' && (
        <div className="space-y-4">
          {/* Category pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {catalog.categories.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setActiveCatKey(cat.key)}
                className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                  activeCatKey === cat.key
                    ? 'bg-ink-900 text-white border-ink-900'
                    : 'bg-white text-ink-700 border-slate-200 hover:border-brand/40'
                }`}
              >
                {cat.persian_label} ({toPersianDigits(cat.count)})
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-ink-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`جستجو در ${activeCategory.persian_label}...`}
                className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-surface-100 border border-slate-200 text-xs sm:text-sm text-ink-900 focus:outline-none focus:border-brand focus:bg-white"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-dark text-white text-xs font-bold flex items-center justify-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              افزودن قطعه جدید به «{activeCategory.persian_label}»
            </button>
          </div>

          {showAddForm && (
            <form
              onSubmit={addNewPart}
              className="rounded-2xl bg-white border-2 border-brand/30 p-4 flex flex-col sm:flex-row items-stretch sm:items-end gap-3"
            >
              <div className="flex-1 space-y-1">
                <label className="text-xs font-bold text-ink-700">نام و مدل دقیق قطعه</label>
                <input
                  type="text"
                  dir="ltr"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Asus ROG Strix B760-F Gaming"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-100 border border-slate-200 text-sm font-mono text-ink-900"
                />
              </div>
              <div className="sm:w-52 space-y-1">
                <label className="text-xs font-bold text-ink-700">
                  قیمت اولیه ({currencyLabel(currency)})
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  aria-label="قیمت اولیه محصول جدید"
                  value={newPrice}
                  onChange={(e) => setNewPrice(formatNumberInputWithCommas(e.target.value))}
                  placeholder="مثلاً 25,000,000"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-100 border border-slate-200 text-sm font-mono tabular-nums text-left text-ink-900"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-brand text-white text-xs font-bold"
                >
                  ثبت قطعه
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="p-2.5 rounded-xl bg-surface-100 text-ink-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[560px]">
              <table className="w-full text-xs sm:text-sm border-collapse">
                <thead className="bg-surface-100 sticky top-0 z-10 text-ink-700 border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4 text-left font-extrabold">نام و مدل کالا</th>
                    <th className="py-3 px-4 text-left">قیمت اولیه ({currencyLabel(currency)})</th>
<th className="py-3.5 px-4 text-left font-extrabold w-48">
                      قیمت فروش ({currencyLabel(currency)})
                    </th>
                    <th className="py-3.5 px-4 text-center font-extrabold w-36">مدیریت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredParts.map((item) => {
                    const isEd = editingId === item.id;
                    return (
                      <tr key={item.id} className="hover:bg-surface-50">
                        <td dir="ltr" className="py-2.5 px-4 text-left font-mono">
                          {isEd ? (
                            <div className="space-y-1.5">
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full px-3 py-1.5 rounded-lg border border-brand text-xs font-mono text-ink-900"
                              />
                              <input
                                type="url"
                                value={editLink}
                                onChange={(e) => setEditLink(e.target.value)}
                                placeholder="لینک مشخصات (اختیاری)..."
                                className="w-full px-3 py-1 rounded-lg border border-slate-200 text-[11px] font-mono text-ink-500"
                              />
                            </div>
                          ) : (
                            <span className="font-semibold text-ink-900">{item.name}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-left tabular-nums">
                          {isEd ? <input type="text" inputMode="numeric" dir="ltr" aria-label="ویرایش قیمت اولیه" value={editInitialPrice} onChange={e => setEditInitialPrice(formatNumberInputWithCommas(e.target.value))} className="w-36 px-3 py-1.5 rounded-lg border border-brand text-xs font-mono" /> : <span className="text-xs text-ink-500">{formatMoney(item.initial_price !== undefined ? item.initial_price : (item.excel_price ?? item.price), currency)}</span>}
                        </td>
                        <td className="py-2.5 px-4 text-left tabular-nums">
                          {isEd ? (
                            <input
                              type="text"
                              inputMode="numeric"
                              dir="ltr"
                              value={editPrice}
                              onChange={(e) => setEditPrice(formatNumberInputWithCommas(e.target.value))}
                              placeholder="قیمت..."
                              className="w-36 px-3 py-1.5 rounded-lg border border-brand text-xs font-mono tabular-nums text-left text-ink-900"
                            />
                          ) : item.price && item.price > 0 ? (
                            <span className="font-extrabold text-brand-dark">
                              {formatMoney(item.price, currency)}
                            </span>
                          ) : (
                            <span className="text-ink-400 text-xs">استعلام روز</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          {isEd ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => savePartEdit(item)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" />
                                ذخیره
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="p-1.5 rounded-lg bg-surface-100 text-ink-500"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => startPartEdit(item)}
                                className="p-2 rounded-lg bg-surface-100 hover:bg-brand hover:text-white text-ink-700 transition-colors"
                                title="ویرایش نام و قیمت"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deletePart(item)}
                                className="p-2 rounded-lg bg-surface-100 hover:bg-red-600 hover:text-white text-ink-500 transition-colors"
                                title="حذف کالا"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: LAPTOPS MANAGEMENT */}
      {section === 'laptops' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-ink-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجوی مدل لپ‌تاپ..."
                className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-surface-100 border border-slate-200 text-xs sm:text-sm text-ink-900 focus:outline-none focus:border-brand focus:bg-white"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-dark text-white text-xs font-bold flex items-center justify-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              افزودن لپ‌تاپ جدید
            </button>
          </div>

          {showAddForm && (
            <form
              onSubmit={addNewLaptop}
              className="rounded-2xl bg-white border-2 border-brand/30 p-4 flex flex-col sm:flex-row items-stretch sm:items-end gap-3"
            >
              <div className="sm:w-36 space-y-1">
                <label className="text-xs font-bold text-ink-700">برند</label>
                <select
                  value={newBrand}
                  onChange={(e) => setNewBrand(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-xl bg-surface-100 border border-slate-200 text-xs font-bold text-ink-900"
                >
                  <option value="ASUS">ASUS</option>
                  <option value="LENOVO">LENOVO</option>
                  <option value="ACER">ACER</option>
                  <option value="OTHER">سایر</option>
                </select>
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs font-bold text-ink-700">مدل و مشخصات لپ‌تاپ</label>
                <input
                  type="text"
                  dir="ltr"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder='Asus VivoBook 15 i5-1335U / 16GB / 512SSD / 15.6" FHD'
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-100 border border-slate-200 text-sm font-mono text-ink-900"
                />
              </div>
              <div className="sm:w-48 space-y-1">
                <label className="text-xs font-bold text-ink-700">
                  قیمت اولیه ({currencyLabel(currency)})
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  aria-label="قیمت اولیه محصول جدید"
                  value={newPrice}
                  onChange={(e) => setNewPrice(formatNumberInputWithCommas(e.target.value))}
                  placeholder="مثلاً 25,000,000"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-100 border border-slate-200 text-sm font-mono tabular-nums text-left text-ink-900"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-brand text-white text-xs font-bold"
              >
                ثبت لپ‌تاپ
              </button>
            </form>
          )}

          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[560px]">
              <table className="w-full text-xs sm:text-sm border-collapse">
                <thead className="bg-surface-100 sticky top-0 z-10 text-ink-700 border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4 text-right font-extrabold w-28">برند</th>
                    <th className="py-3.5 px-4 text-left font-extrabold">مدل و مشخصات</th>
                    <th className="py-3 px-4 text-left">قیمت اولیه ({currencyLabel(currency)})</th>
<th className="py-3.5 px-4 text-left font-extrabold w-48">
                      قیمت فروش ({currencyLabel(currency)})
                    </th>
                    <th className="py-3.5 px-4 text-center font-extrabold w-36">مدیریت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLaptops.map((lap) => {
                    const isEd = editingId === lap.id;
                    return (
                      <tr key={lap.id} className="hover:bg-surface-50">
                        <td className="py-2.5 px-4 font-mono font-bold text-ink-700">
                          {lap.brand}
                        </td>
                        <td dir="ltr" className="py-2.5 px-4 text-left font-mono">
                          {isEd ? (
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full px-3 py-1.5 rounded-lg border border-brand text-xs font-mono text-ink-900"
                            />
                          ) : (
                            <span className="font-semibold text-ink-900">{lap.model}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-left tabular-nums">
                          {isEd ? <input type="text" inputMode="numeric" dir="ltr" aria-label="ویرایش قیمت اولیه" value={editInitialPrice} onChange={e => setEditInitialPrice(formatNumberInputWithCommas(e.target.value))} className="w-36 px-3 py-1.5 rounded-lg border border-brand text-xs font-mono" /> : <span className="text-xs text-ink-500">{formatMoney(lap.initial_price !== undefined ? lap.initial_price : (lap.excel_price ?? lap.price), currency)}</span>}
                        </td>
                        <td className="py-2.5 px-4 text-left tabular-nums">
                          {isEd ? (
                            <input
                              type="text"
                              inputMode="numeric"
                              dir="ltr"
                              value={editPrice}
                              onChange={(e) => setEditPrice(formatNumberInputWithCommas(e.target.value))}
                              className="w-36 px-3 py-1.5 rounded-lg border border-brand text-xs font-mono tabular-nums text-left text-ink-900"
                            />
                          ) : lap.price && lap.price > 0 ? (
                            <span className="font-extrabold text-brand-dark">
                              {formatMoney(lap.price, currency)}
                            </span>
                          ) : (
                            <span className="text-ink-400 text-xs">استعلام روز</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          {isEd ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => saveLaptopEdit(lap)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold"
                              >
                                ذخیره
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="p-1.5 rounded-lg bg-surface-100 text-ink-500"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => startLaptopEdit(lap)}
                                className="p-2 rounded-lg bg-surface-100 hover:bg-brand hover:text-white text-ink-700 transition-colors"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteLaptop(lap)}
                                className="p-2 rounded-lg bg-surface-100 hover:bg-red-600 hover:text-white text-ink-500 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: STORE SETTINGS & ASSEMBLY FEE */}
      {section === 'store' && (
        <form
          onSubmit={saveStoreDetails}
          className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 space-y-5 max-w-3xl"
        >
          <h3 className="text-base font-extrabold text-ink-900 border-b border-slate-100 pb-3">
            ویرایش اطلاعات فروشگاه، آدرس و هزینه مونتاژ در پیش‌فاکتور
          </h3>

          <p className="text-xs text-ink-500">مرجع مشترک اطلاعات تماس: تغییر آدرس و شماره‌ها در این بخش، در صفحه اصلی، فوتر و هر دو فاکتور اعمال می‌شود.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-ink-700">نام برند / فروشگاه</label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-100 border border-slate-200 text-sm text-ink-900"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-ink-700">عنوان معرفی (زیرلوگو)</label>
              <input
                type="text"
                value={storeTagline}
                onChange={(e) => setStoreTagline(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-100 border border-slate-200 text-sm text-ink-900"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-ink-700">تلفن ثابت</label>
              <input
                type="text"
                dir="ltr"
                value={storePhone}
                onChange={(e) => setStorePhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-100 border border-slate-200 text-sm font-mono text-ink-900"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-ink-700">شماره همراه</label>
              <input
                type="text"
                dir="ltr"
                value={storeMobile}
                onChange={(e) => setStoreMobile(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-100 border border-slate-200 text-sm font-mono text-ink-900"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-ink-700">آدرس فروشگاه</label>
              <input
                type="text"
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-100 border border-slate-200 text-sm text-ink-900"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-ink-700">
                هزینه پیش‌فرض نصب و مونتاژ ({currencyLabel(currency)})
              </label>
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                value={formatNumberInputWithCommas(assemblyFee)}
                onChange={(e) => setAssemblyFee(parseCommaFormattedNumber(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-100 border border-slate-200 text-sm font-mono tabular-nums text-left text-ink-900"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-ink-700">تذکر اعتبار قیمت در فاکتور</label>
              <input
                type="text"
                value={priceDisclaimer}
                onChange={(e) => setPriceDisclaimer(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-100 border border-slate-200 text-sm text-ink-900"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-ink-700">شرح خدمات نصب و مونتاژ</label>
              <input
                type="text"
                value={assemblyNote}
                onChange={(e) => setAssemblyNote(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-100 border border-slate-200 text-sm text-ink-900"
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-bold shadow-md shadow-brand/25 flex items-center gap-2 transition-all"
          >
            <Save className="w-4 h-4" />
            ذخیره تنظیمات فروشگاه
          </button>
        </form>
      )}

      {/* SECTION 4: PASSWORD CHANGE */}
      {section === 'security' && (
        <form
          onSubmit={handlePassChange}
          className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 space-y-4 max-w-md"
        >
          <h3 className="text-base font-extrabold text-ink-900">تغییر رمز عبور مدیر</h3>
          <p className="text-xs text-ink-500 leading-relaxed">
            رمز جدید جایگزین رمز قبلی روی هاست می‌شود و به‌صورت هش‌شده ذخیره می‌گردد.
          </p>
          <input
            type="password"
            dir="ltr"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            placeholder="رمز عبور جدید (حداقل ۱۲ کاراکتر)..."
            required
            className="w-full px-4 py-3 rounded-xl bg-surface-100 border border-slate-200 text-sm font-mono text-center text-ink-900"
          />
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-bold"
          >
            ثبت رمز جدید
          </button>
        </form>
      )}
    </div>
  );
};
