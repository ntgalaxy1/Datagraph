export interface PartItem {
  id: string;
  row: number;
  category_key: string;
  name: string;
  raw_name: string;
  specs?: string;
  stock?: number | null;
  previous_price?: number | null;
  revision?: number;
  sync_pending?: boolean;
  initial_price?: number | null;
  excel_price: number | null;
  price: number | null;
  has_override: boolean;
  hyperlink: string | null;
}

export interface CategoryData {
  key: string;
  sheet_header: string;
  invoice_label: string;
  persian_label: string;
  col_name: number;
  col_price: number;
  invoice_row: number | null;
  in_pc_invoice: boolean;
  count: number;
  priced_count: number;
  hyperlink_count: number;
  items: PartItem[];
}

export interface LaptopItem {
  id: string;
  row: number;
  model: string;
  raw_model: string;
  brand: 'ASUS' | 'LENOVO' | 'ACER' | 'OTHER';
  excel_fill_rgb: string | null;
  brand_color: string;
  brand_label: string;
  specs?: string;
  stock?: number | null;
  previous_price?: number | null;
  revision?: number;
  sync_pending?: boolean;
  initial_price?: number | null;
  excel_price: number | null;
  price: number | null;
  has_override: boolean;
}

export interface SheetMeta {
  name: string;
  rows: number;
  cols: number;
}

export interface VbaFormMeta {
  name: string;
  caption: string;
  role: string;
}

export interface ContentBlock {
  id: string;
  title: string;
  body: string;
  visible: boolean;
}
export interface SiteContent {
  headerBadge: string;
  footerCredit: string;
  blocks: ContentBlock[];
}
export interface CatalogResponse {
  _revision?: number;
  _storage?: string;
  content?: SiteContent;
  workbook: {
    filename: string;
    size_bytes: number;
    modified_iso: string;
    sheets: SheetMeta[];
    vba_forms: VbaFormMeta[];
  };
  store: {
    name: string;
    tagline: string;
    address: string;
    phone: string;
    mobile: string;
    assembly_note: string;
    price_disclaimer: string;
    raw_footer: string;
    default_assembly_fee: number;
    laptop_invoice_header: string;
    default_selected_laptop: string | null;
  };
  stats: {
    total_parts: number;
    priced_parts: number;
    hyperlinked_parts: number;
    total_categories: number;
    total_laptops: number;
    priced_laptops: number;
  };
  categories: CategoryData[];
  laptops: LaptopItem[];
}

export type CurrencyMode = 'rial' | 'toman';

export interface SelectedPCItem {
  part: PartItem | null;
  customName?: string;
  customPrice?: number | null;
  qty: number;
}

export interface InstallmentPlan {
  enabled: boolean;
  totalAmount: number;
  cashPayment: number;
  monthlyRate: number;
  months: number;
  totalInterest: number;
  monthlyInstallment: number;
}
