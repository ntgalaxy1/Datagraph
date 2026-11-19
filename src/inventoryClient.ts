import { CatalogResponse } from './types';
import { getSavedAdminKey } from './excelEngine';
export interface InventoryRow {
  id: string; kind: 'part' | 'laptop'; category_key: string; name: string;
  specs: string; price: number | null; initial_price: number | null;
  previous_price: number | null; stock: number | null; revision?: number;
  brand?: string; sync_pending?: boolean;
}
export function inventoryRows(catalog: CatalogResponse): InventoryRow[] {
  return [...catalog.categories.flatMap(c => c.items.map(p => ({ ...p, name: p.name, kind: 'part' as const, category_key: c.key, specs: p.specs || '', initial_price: p.initial_price ?? p.excel_price, previous_price: p.previous_price ?? null, stock: p.stock ?? null }))), ...catalog.laptops.map(p => ({ ...p, name: p.model, kind: 'laptop' as const, category_key: 'laptop', specs: p.specs || '', initial_price: p.initial_price ?? p.excel_price, previous_price: p.previous_price ?? null, stock: p.stock ?? null }))];
}
export async function inventoryRequest(action: string, payload: Record<string, unknown> = {}, sheets = false) {
  const res = await fetch(sheets ? './api/sheets-sync.php' : './api/inventory.php', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Key': getSavedAdminKey() || '' }, body: JSON.stringify({ action, ...payload }) });
  if (!res.headers.get('content-type')?.includes('application/json')) throw new Error('این قابلیت روی هاست PHP با MySQL فعال می‌شود؛ ابتدا نسخه جدید را نصب کنید.');
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error((res.status === 409 ? 'تعارض ویرایش: ' : '') + (data.error || 'عملیات ناموفق بود'));
  return data;
}
export const normalizeSearch = (s: string) => s.replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).toLowerCase().trim();
export const columnAliases: Record<string,string[]> = {
  id: ['id','sku','product_id','شناسه','کد کالا'], kind: ['kind','نوع'],
  category_key: ['category','category_key','دسته','دسته بندی','گروه','گروه کالا'],
  name: ['name','part name','product','product name','model','نام','نام کالا','نام محصول','مدل'],
  specs: ['specs','specifications','description','مشخصات','توضیحات'],
  price: ['price','selling price','قیمت','قیمت فروش','مبلغ'],
  initial_price: ['initial_price','initial price','قیمت اولیه'], stock: ['stock','quantity','qty','موجودی','تعداد'], brand: ['brand','برند'],
};
