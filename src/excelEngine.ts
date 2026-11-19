import * as XLSX from 'xlsx';
import { CatalogResponse, CategoryData, LaptopItem, PartItem } from './types';

const OVERRIDES_STORAGE_KEY = 'datagraph_price_overrides_v1';
const CUSTOM_CATALOG_STORAGE_KEY = 'datagraph_uploaded_catalog_v1';
const ADMIN_SESSION_KEY = 'datagraph_admin_key_v1';
const LOCAL_FALLBACK_ADMIN_PASS = 'datagraph1405';

export function getSavedAdminKey(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_SESSION_KEY);
  } catch {
    return null;
  }
}

export function clearAdminSession(): void {
  try {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
  } catch {
    // ignore
  }
}

export async function verifyAdminPassword(password: string): Promise<{ ok: boolean; error?: string }> {
  const trimmed = password.trim();
  if (!trimmed) return { ok: false, error: 'لطفاً رمز عبور مدیریت را وارد کنید.' };

  // 1. Try PHP endpoint on cPanel/DirectAdmin
  try {
    const fd = new FormData();
    fd.append('action', 'login');
    fd.append('admin_key', trimmed);
    const res = await fetch('./sync-catalog.php', { method: 'POST', body: fd });
    const ct = res.headers.get('content-type') || '';
    if (res.status !== 404 && ct.includes('application/json')) {
      const data = await res.json();
      if (res.ok && data.success) {
        sessionStorage.setItem(ADMIN_SESSION_KEY, trimmed);
        return { ok: true };
      }
      return { ok: false, error: data.error || 'رمز عبور اشتباه است.' };
    }
  } catch {
    // Non-PHP preview fallback below
  }

  try {
    const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: trimmed }) });
    if (res.ok && res.headers.get('content-type')?.includes('application/json') && (await res.json()).success) {
      try { sessionStorage.setItem(ADMIN_SESSION_KEY, trimmed); } catch { /* optional */ }
      return { ok: true };
    }
  } catch { /* standalone demo */ }
  // 2. Fallback for local preview / non-PHP environment
  if ((location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1') && trimmed === LOCAL_FALLBACK_ADMIN_PASS) {
    try {
      sessionStorage.setItem(ADMIN_SESSION_KEY, trimmed);
    } catch {
      // ignore
    }
    return { ok: true };
  }
  return { ok: false, error: 'رمز عبور مدیریت اشتباه است.' };
}

export async function changeAdminPasswordOnServer(
  currentKey: string,
  newPassword: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const fd = new FormData();
    fd.append('action', 'change_password');
    fd.append('admin_key', currentKey);
    fd.append('new_password', newPassword.trim());
    const res = await fetch('./sync-catalog.php', { method: 'POST', body: fd });
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const data = await res.json();
      if (res.ok && data.success) {
        sessionStorage.setItem(ADMIN_SESSION_KEY, newPassword.trim());
        return { ok: true, message: data.message || 'رمز مدیریت با موفقیت تغییر یافت.' };
      }
      return { ok: false, message: data.error || 'خطا در تغییر رمز عبور' };
    }
  } catch {
    // ignore
  }
  return {
    ok: false,
    message: 'تغییر رمز دائمی پس از آپلود روی هاست (cPanel / PHP) فعال می‌شود.',
  };
}

export async function persistCatalogToHost(
  catalog: CatalogResponse,
  adminKey: string,
  rawFile?: File
): Promise<{ syncedToServer: boolean; message?: string }> {
  try {
    const fd = new FormData();
    fd.append('action', 'save_catalog');
    fd.append('admin_key', adminKey);
    fd.append('catalog_json', JSON.stringify(catalog));
    if (rawFile) {
      fd.append('excel_file', rawFile);
    }
    const res = await fetch('./sync-catalog.php', { method: 'POST', body: fd });
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const data = await res.json();
      if (res.ok && data.success) {
        return { syncedToServer: true, message: data.message };
      }
      return { syncedToServer: false, message: data.error };
    }
  } catch {
    // non-PHP preview
  }
  return { syncedToServer: false };
}

const CATEGORY_DEFS = [
  { key: 'monitor', sheet_header: 'Monitor', invoice_label: 'Monitor', persian_label: 'مانیتور', col_name: 1, col_price: 2, invoice_row: 3, in_pc_invoice: true },
  { key: 'motherboard', sheet_header: 'Main Board', invoice_label: 'Motherboard', persian_label: 'مادربرد', col_name: 3, col_price: 4, invoice_row: 4, in_pc_invoice: true },
  { key: 'cpu', sheet_header: 'Cpu', invoice_label: 'CPU', persian_label: 'پردازنده (CPU)', col_name: 5, col_price: 6, invoice_row: 5, in_pc_invoice: true },
  { key: 'ram', sheet_header: 'Ram', invoice_label: 'RAM', persian_label: 'حافظه رم (RAM)', col_name: 7, col_price: 8, invoice_row: 6, in_pc_invoice: true },
  { key: 'vga', sheet_header: 'VGA', invoice_label: 'VGA', persian_label: 'کارت گرافیک (VGA)', col_name: 9, col_price: 10, invoice_row: 7, in_pc_invoice: true },
  { key: 'hdd', sheet_header: 'HDD', invoice_label: 'HDD', persian_label: 'هارد دیسک (HDD)', col_name: 11, col_price: 12, invoice_row: 8, in_pc_invoice: true },
  { key: 'ssd', sheet_header: 'SSD', invoice_label: 'SSD / M.2', persian_label: 'حافظه خشک (SSD / M.2)', col_name: 13, col_price: 14, invoice_row: 9, in_pc_invoice: true },
  { key: 'power', sheet_header: 'Power', invoice_label: 'Power', persian_label: 'منبع تغذیه (Power)', col_name: 15, col_price: 16, invoice_row: 10, in_pc_invoice: true },
  { key: 'dvd', sheet_header: 'DVD Writer', invoice_label: 'DVD-RW', persian_label: 'درایو نوری (DVD-RW)', col_name: 17, col_price: 18, invoice_row: 11, in_pc_invoice: true },
  { key: 'case', sheet_header: 'Case', invoice_label: 'Case', persian_label: 'کیس (Case)', col_name: 19, col_price: 20, invoice_row: 12, in_pc_invoice: true },
  { key: 'keyboard_mouse', sheet_header: 'Keyboard & mouse', invoice_label: 'Keyboard & Mouse', persian_label: 'کیبورد و ماوس', col_name: 21, col_price: 22, invoice_row: 13, in_pc_invoice: true },
  { key: 'speaker', sheet_header: 'Speaker', invoice_label: 'Accessories', persian_label: 'اسپیکر و جانبی', col_name: 23, col_price: 24, invoice_row: 14, in_pc_invoice: true },
  { key: 'fan', sheet_header: 'fan', invoice_label: 'Cooling / Fan', persian_label: 'خنک‌کننده و فن', col_name: 25, col_price: 26, invoice_row: 15, in_pc_invoice: true },
  { key: 'silicon', sheet_header: 'Silicon', invoice_label: 'Silicon / Thermal Paste', persian_label: 'خمیر سیلیکون', col_name: 27, col_price: 28, invoice_row: null, in_pc_invoice: false },
];

export function getLocalOverrides(): Record<string, number> {
  try {
    const raw = localStorage.getItem(OVERRIDES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setLocalOverride(itemId: string, price: number | null): Record<string, number> {
  const current = getLocalOverrides();
  if (price === null || price <= 0) {
    delete current[itemId];
  } else {
    current[itemId] = Math.round(price);
  }
  try {
    localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore storage quota errors
  }
  return current;
}

export function applyOverridesToCatalog(base: CatalogResponse): CatalogResponse {
  const overrides = getLocalOverrides();
  const cloned: CatalogResponse = JSON.parse(JSON.stringify(base));

  let pricedParts = 0;
  for (const cat of cloned.categories) {
    let catPriced = 0;
    for (const item of cat.items) {
      if (item.id in overrides) {
        item.price = overrides[item.id];
        item.has_override = true;
      } else {
        item.price = item.excel_price;
        item.has_override = false;
      }
      if (item.price && item.price > 0) {
        catPriced += 1;
        pricedParts += 1;
      }
    }
    cat.priced_count = catPriced;
  }

  let pricedLaptops = 0;
  for (const lap of cloned.laptops) {
    if (lap.id in overrides) {
      lap.price = overrides[lap.id];
      lap.has_override = true;
    } else {
      lap.price = lap.excel_price;
      lap.has_override = false;
    }
    if (lap.price && lap.price > 0) {
      pricedLaptops += 1;
    }
  }

  cloned.stats.priced_parts = pricedParts;
  cloned.stats.priced_laptops = pricedLaptops;
  return cloned;
}

function detectBrand(rgb: string | null, model: string): {
  brand: 'ASUS' | 'LENOVO' | 'ACER' | 'OTHER';
  color_hex: string;
  color_label: string;
} {
  const upperRgb = (rgb || '').toUpperCase();
  if (upperRgb.includes('00B0F0')) return { brand: 'ASUS', color_hex: '#00B0F0', color_label: 'آبی (ASUS)' };
  if (upperRgb.includes('FFFF00')) return { brand: 'LENOVO', color_hex: '#EAB308', color_label: 'زرد (LENOVO)' };
  if (upperRgb.includes('92D050')) return { brand: 'ACER', color_hex: '#84CC16', color_label: 'سبز (ACER)' };

  const u = model.toUpperCase();
  if (u.includes('ASUS')) return { brand: 'ASUS', color_hex: '#00B0F0', color_label: 'ASUS' };
  if (u.includes('LENOVO')) return { brand: 'LENOVO', color_hex: '#EAB308', color_label: 'LENOVO' };
  if (u.includes('ACER')) return { brand: 'ACER', color_hex: '#84CC16', color_label: 'ACER' };
  return { brand: 'OTHER', color_hex: '#94A3B8', color_label: 'سایر' };
}

/**
 * Parses an uploaded List PC.xlsm / .xlsx directly inside the browser (for cPanel static hosting!)
 */
export async function parseExcelBufferInBrowser(
  buffer: ArrayBuffer,
  filename: string,
  fallbackStore?: CatalogResponse['store'],
  adminKey?: string | null,
  rawFile?: File
): Promise<CatalogResponse> {
  const wb = XLSX.read(buffer, { type: 'array', cellStyles: true });

  const partsSheetName =
    wb.SheetNames.find((n) => n.includes('کالا') || n.includes('كالا')) || wb.SheetNames[0];
  const laptopsSheetName =
    wb.SheetNames.find((n) => n.includes('لپ تاپ') && n.includes('لیست')) || wb.SheetNames[1];

  const wsParts = wb.Sheets[partsSheetName];
  const wsLaptops = laptopsSheetName ? wb.Sheets[laptopsSheetName] : undefined;

  const categoriesOut: CategoryData[] = [];
  let totalParts = 0;
  let pricedParts = 0;
  let hyperlinkedParts = 0;

  const partsRange = wsParts && wsParts['!ref'] ? XLSX.utils.decode_range(wsParts['!ref']) : { e: { r: 210 } };
  const maxRow = partsRange.e.r + 1;

  for (const cdef of CATEGORY_DEFS) {
    const items: PartItem[] = [];
    for (let r = 2; r <= maxRow; r++) {
      const nameAddr = XLSX.utils.encode_cell({ r: r - 1, c: cdef.col_name - 1 });
      const priceAddr = XLSX.utils.encode_cell({ r: r - 1, c: cdef.col_price - 1 });
      const cellName = wsParts?.[nameAddr];
      const cellPrice = wsParts?.[priceAddr];

      if (!cellName || cellName.v === undefined || cellName.v === null) continue;
      const rawStr = String(cellName.v);
      const cleanStr = rawStr.trim();
      if (!cleanStr || cleanStr === '---') continue;

      const rawP = cellPrice?.v;
      const excelPrice = typeof rawP === 'number' && rawP > 0 ? Math.round(rawP) : null;
      const hlUrl: string | null = cellName.l?.Target || null;

      if (hlUrl) hyperlinkedParts++;
      if (excelPrice && excelPrice > 0) pricedParts++;
      totalParts++;

      items.push({
        id: `part:${cdef.key}:${r}`,
        row: r,
        category_key: cdef.key,
        name: cleanStr,
        raw_name: rawStr,
        excel_price: excelPrice,
        price: excelPrice,
        has_override: false,
        hyperlink: hlUrl,
      });
    }

    categoriesOut.push({
      ...cdef,
      count: items.length,
      priced_count: items.filter((i) => i.price && i.price > 0).length,
      hyperlink_count: items.filter((i) => i.hyperlink).length,
      items,
    });
  }

  const laptopsOut: LaptopItem[] = [];
  if (wsLaptops && wsLaptops['!ref']) {
    const lapRange = XLSX.utils.decode_range(wsLaptops['!ref']);
    for (let r = 1; r <= lapRange.e.r + 1; r++) {
      const mAddr = XLSX.utils.encode_cell({ r: r - 1, c: 0 });
      const pAddr = XLSX.utils.encode_cell({ r: r - 1, c: 1 });
      const cellM = wsLaptops[mAddr];
      const cellP = wsLaptops[pAddr];
      if (!cellM || cellM.v === undefined || cellM.v === null) continue;
      const cleanModel = String(cellM.v).trim();
      if (!cleanModel || cleanModel === '---') continue;

      const rgb: string | null = cellM.s?.fgColor?.rgb || null;
      const bmeta = detectBrand(rgb, cleanModel);
      const rawP = cellP?.v;
      const excelPrice = typeof rawP === 'number' && rawP > 0 ? Math.round(rawP) : null;

      laptopsOut.push({
        id: `laptop:${r}`,
        row: r,
        model: cleanModel,
        raw_model: String(cellM.v),
        brand: bmeta.brand,
        excel_fill_rgb: rgb,
        brand_color: bmeta.color_hex,
        brand_label: bmeta.color_label,
        excel_price: excelPrice,
        price: excelPrice,
        has_override: false,
      });
    }
  }

  const parsed: CatalogResponse = {
    workbook: {
      filename,
      size_bytes: buffer.byteLength,
      modified_iso: new Date().toISOString(),
      sheets: wb.SheetNames.map((name) => {
        const s = wb.Sheets[name];
        const rng = s && s['!ref'] ? XLSX.utils.decode_range(s['!ref']) : { e: { r: 0, c: 0 } };
        return { name, rows: rng.e.r + 1, cols: rng.e.c + 1 };
      }),
      vba_forms: [
        { name: 'UserForm3', caption: 'فاکتور هوشمند دیتاگراف', role: 'داشبورد اصلی' },
        { name: 'UserForm1', caption: 'انتخاب کالا', role: 'فرم انتخاب قطعات PC' },
        { name: 'UserForm2', caption: 'انتخاب لپ تاپ', role: 'فرم انتخاب نوت‌بوک' },
        { name: 'UserForm4', caption: 'محاسبه اقساط', role: 'محاسبه‌گر اقساط' },
      ],
    },
    store: fallbackStore || {
      name: 'دیتاگراف',
      tagline: 'فروشگاه اینترنتی قطعات رایانه',
      address: 'تبریز، خ امام، پاساژ سهند، ط همکف، پلاک 23',
      phone: '04135531145',
      mobile: '09143040751',
      assembly_note: 'نصب و مونتاژ شامل (اسمبل و کابل کشی - آپدیت بایوس - نصب ویندوز - نصب برنامه های عمومی و تخصصی)',
      price_disclaimer: 'قیمت قطعات در حین خرید به روز خواهد شد.',
      raw_footer: '',
      default_assembly_fee: 5000000,
      laptop_invoice_header: 'دیتا گراف - لیست پیشنهادی نوت بوک',
      default_selected_laptop: laptopsOut[0]?.model || null,
    },
    stats: {
      total_parts: totalParts,
      priced_parts: pricedParts,
      hyperlinked_parts: hyperlinkedParts,
      total_categories: CATEGORY_DEFS.length,
      total_laptops: laptopsOut.length,
      priced_laptops: laptopsOut.filter((l) => l.price && l.price > 0).length,
    },
    categories: categoriesOut,
    laptops: laptopsOut,
  };

  try {
    localStorage.setItem(CUSTOM_CATALOG_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore if storage full
  }

  // If admin is authenticated on cPanel/DirectAdmin, persist catalog.json on the server for all visitors!
  if (adminKey) {
    await persistCatalogToHost(parsed, adminKey, rawFile);
  }

  return applyOverridesToCatalog(parsed);
}

export async function loadInitialCatalog(forceFreshFromDisk = false): Promise<CatalogResponse> {
  // A hosted site always reads the authoritative server catalog, not a stale
  // browser copy. Local storage remains only for standalone offline previews.
  if (location.protocol === 'file:' && !forceFreshFromDisk) {
    try { const saved = localStorage.getItem(CUSTOM_CATALOG_STORAGE_KEY); if (saved) return applyOverridesToCatalog(JSON.parse(saved)); } catch { /* optional */ }
  }
  if (location.protocol !== 'file:') {
    let response: Response | null = null;
    try { response = await fetch('./api/inventory.php?action=catalog', { cache: 'no-store' }); } catch { /* legacy host may lack this endpoint */ }
    if (response && response.status !== 404 && response.headers.get('content-type')?.includes('application/json')) {
      const result = await response.json();
      if (response.ok && result.success && result.catalog) return result.catalog;
      throw new Error('دریافت اطلاعات فروشگاه از سرور ناموفق بود؛ وضعیت MySQL و اتصال هاست را بررسی کنید.');
    }
  }

  // 1. Try API server if present, otherwise static ./data/catalog.json (for cPanel/shared hosting!)
  try {
    const apiRes = await fetch('/api/catalog');
    if (apiRes.ok && apiRes.headers.get('content-type')?.includes('application/json')) {
      const data = await apiRes.json();
      return applyOverridesToCatalog(data);
    }
  } catch {
    // fallback to static JSON
  }

  const staticRes = await fetch(`./data/catalog.json?t=${Date.now()}`);
  if (!staticRes.ok) {
    throw new Error('فایل اطلاعات کالاها (data/catalog.json) یافت نشد.');
  }
  const staticData: CatalogResponse = await staticRes.json();
  return applyOverridesToCatalog(staticData);
}

/**
 * Pure client-side Excel (.xlsx) generator for PC Invoice (works on any static cPanel host!)
 */
export function downloadPCInvoiceClientXlsx(params: {
  customerName: string;
  rows: { group: string; name: string; price: number }[];
  assemblyEnabled: boolean;
  assemblyFee: number;
  grandTotal: number;
  store: CatalogResponse['store'];
  date: string;
  time: string;
  installment?: {
    enabled: boolean;
    cashPayment: number;
    months: number;
    monthlyRate: number;
    monthlyInstallment: number;
    totalInterest: number;
  };
}) {
  const aoa: (string | number)[][] = [
    [params.date, params.customerName ? `پیش فاکتور دیتاگراف - ${params.customerName}` : 'پیش فاکتور دیتاگراف', params.time],
    ['گروه کالا', 'نام کالا', 'قیمت (ریال)'],
  ];

  for (const r of params.rows) {
    aoa.push([r.group, r.name, r.price]);
  }

  aoa.push([
    'نصب و مونتاژ',
    params.assemblyEnabled ? 'شامل اسمبل، کابل‌کشی، آپدیت بایوس و نصب ویندوز' : 'بدون مونتاژ',
    params.assemblyEnabled ? params.assemblyFee : 0,
  ]);

  aoa.push(['جمع کل فاکتور', '', params.grandTotal]);
  aoa.push([]);
  aoa.push([params.store.price_disclaimer]);
  aoa.push([params.store.assembly_note]);
  aoa.push([`آدرس: ${params.store.address} | تلفن: ${params.store.phone} | موبایل: ${params.store.mobile}`]);

  if (params.installment?.enabled) {
    aoa.push([]);
    aoa.push([
      'شرایط اقساط',
      `پیش‌پرداخت نقدی: ${params.installment.cashPayment.toLocaleString('en-US')} ریال | ${params.installment.months} ماهه (${params.installment.monthlyRate}%)`,
      `هر قسط: ${params.installment.monthlyInstallment.toLocaleString('en-US')} ریال`,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 22 }, { wch: 54 }, { wch: 22 }];
  if (!ws['!views']) ws['!views'] = [];
  ws['!views'].push({ rightToLeft: true });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'فاکتور PC');
  XLSX.writeFile(wb, `DataGraph-PC-Invoice-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Pure client-side Excel (.xlsx) generator for Laptop Quote (works on any static cPanel host!)
 */
export function downloadLaptopQuoteClientXlsx(params: {
  customerName: string;
  laptops: { model: string; price: number }[];
  store: CatalogResponse['store'];
}) {
  const title = params.customerName
    ? `دیتا گراف - لیست پیشنهادی نوت بوک (${params.customerName})`
    : 'دیتا گراف - لیست پیشنهادی نوت بوک';

  const aoa: (string | number)[][] = [
    [title, ''],
    ['مدل و مشخصات لپ تاپ', 'قیمت (ریال)'],
  ];

  for (const lap of params.laptops) {
    aoa.push([lap.model, lap.price > 0 ? lap.price : 'استعلام روز']);
  }

  aoa.push([]);
  aoa.push([`آدرس: ${params.store.address} | تلفن: ${params.store.phone}`]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 64 }, { wch: 22 }];
  ws['!views'] = [{ rightToLeft: true }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'فاکتور لپ تاپ');
  XLSX.writeFile(wb, `DataGraph-Laptop-Quote-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function saveFullCatalog(
  updated: CatalogResponse,
  adminKey?: string
): Promise<CatalogResponse> {
  let persisted = false;
  if (adminKey) {
    const result = await persistCatalogToHost(updated, adminKey);
    persisted = result.syncedToServer;
  }
  if (!persisted && location.protocol !== 'file:') {
    try {
      const result = await fetch('/api/save-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey || '' },
        body: JSON.stringify({ catalog: updated }),
      });
      persisted = result.ok && result.headers.get('content-type')?.includes('application/json') === true;
    } catch { /* reported below */ }
    if (!persisted) throw new Error('ذخیره روی سرور تأیید نشد؛ اتصال و دسترسی مدیریت را بررسی کنید.');
  }
  try { localStorage.setItem(CUSTOM_CATALOG_STORAGE_KEY, JSON.stringify(updated)); } catch { /* optional browser cache */ }
  if (persisted && location.protocol !== 'file:') {
    const res = await fetch('./api/inventory.php?action=catalog', { cache: 'no-store' });
    if (res.ok && res.headers.get('content-type')?.includes('application/json')) { const data = await res.json(); if (data.success) return data.catalog; }
  }
  return updated;
}
