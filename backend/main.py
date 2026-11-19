import os
import hmac
import io
import json
import zipfile
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import openpyxl

app = FastAPI(title="DataGraph Smart PC & Laptop API")

@app.middleware("http")
async def protect_mutations(request, call_next):
    # Production cPanel uses PHP authentication. The optional preview API must
    # never accept anonymous catalog changes on a public preview host.
    protected = {"/api/reload", "/api/override-price", "/api/save-catalog", "/api/upload-excel"}
    if request.url.path in protected and request.method != 'GET':
        expected = os.environ.get('DATAGRAPH_ADMIN_PASSWORD', '')
        supplied = request.headers.get('X-Admin-Key', '')
        if not expected or not hmac.compare_digest(expected, supplied):
            return JSONResponse({"detail": "Admin authorization required"}, status_code=403)
    return await call_next(request)


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST_DIR = os.path.join(BASE_DIR, "web_bundle")
XLSM_PATH = os.path.join(BASE_DIR, "data", "List PC.xlsm")
OVERRIDES_PATH = os.path.join(BASE_DIR, "data", "custom_overrides.json")

# Exact 14 column pairs from Sheet 'ليست کالا ها' + mapping to 'فاکتور PC'
CATEGORY_DEFS = [
    {
        "key": "monitor",
        "sheet_header": "Monitor",
        "invoice_label": "Monitor",
        "persian_label": "مانیتور",
        "col_name": 1,   # A
        "col_price": 2,  # B
        "invoice_row": 3,
        "in_pc_invoice": True,
    },
    {
        "key": "motherboard",
        "sheet_header": "Main Board",
        "invoice_label": "Motherboard",
        "persian_label": "مادربرد",
        "col_name": 3,   # C
        "col_price": 4,  # D
        "invoice_row": 4,
        "in_pc_invoice": True,
    },
    {
        "key": "cpu",
        "sheet_header": "Cpu",
        "invoice_label": "CPU",
        "persian_label": "پردازنده (CPU)",
        "col_name": 5,   # E
        "col_price": 6,  # F
        "invoice_row": 5,
        "in_pc_invoice": True,
    },
    {
        "key": "ram",
        "sheet_header": "Ram",
        "invoice_label": "RAM",
        "persian_label": "حافظه رم (RAM)",
        "col_name": 7,   # G
        "col_price": 8,  # H
        "invoice_row": 6,
        "in_pc_invoice": True,
    },
    {
        "key": "vga",
        "sheet_header": "VGA",
        "invoice_label": "VGA",
        "persian_label": "کارت گرافیک (VGA)",
        "col_name": 9,   # I
        "col_price": 10, # J
        "invoice_row": 7,
        "in_pc_invoice": True,
    },
    {
        "key": "hdd",
        "sheet_header": "HDD",
        "invoice_label": "HDD",
        "persian_label": "هارد دیسک (HDD)",
        "col_name": 11,  # K
        "col_price": 12, # L
        "invoice_row": 8,
        "in_pc_invoice": True,
    },
    {
        "key": "ssd",
        "sheet_header": "SSD",
        "invoice_label": "SSD / M.2",
        "persian_label": "حافظه خشک (SSD / M.2)",
        "col_name": 13,  # M
        "col_price": 14, # N
        "invoice_row": 9,
        "in_pc_invoice": True,
    },
    {
        "key": "power",
        "sheet_header": "Power",
        "invoice_label": "Power",
        "persian_label": "منبع تغذیه (Power)",
        "col_name": 15,  # O
        "col_price": 16, # P
        "invoice_row": 10,
        "in_pc_invoice": True,
    },
    {
        "key": "dvd",
        "sheet_header": "DVD Writer",
        "invoice_label": "DVD-RW",
        "persian_label": "درایو نوری (DVD-RW)",
        "col_name": 17,  # Q
        "col_price": 18, # R
        "invoice_row": 11,
        "in_pc_invoice": True,
    },
    {
        "key": "case",
        "sheet_header": "Case",
        "invoice_label": "Case",
        "persian_label": "کیس (Case)",
        "col_name": 19,  # S
        "col_price": 20, # T
        "invoice_row": 12,
        "in_pc_invoice": True,
    },
    {
        "key": "keyboard_mouse",
        "sheet_header": "Keyboard & mouse",
        "invoice_label": "Keyboard & Mouse",
        "persian_label": "کیبورد و ماوس",
        "col_name": 21,  # U
        "col_price": 22, # V
        "invoice_row": 13,
        "in_pc_invoice": True,
    },
    {
        "key": "speaker",
        "sheet_header": "Speaker",
        "invoice_label": "Accessories",
        "persian_label": "اسپیکر و جانبی",
        "col_name": 23,  # W
        "col_price": 24, # X
        "invoice_row": 14,
        "in_pc_invoice": True,
    },
    {
        "key": "fan",
        "sheet_header": "fan",
        "invoice_label": "Cooling / Fan",
        "persian_label": "خنک‌کننده و فن",
        "col_name": 25,  # Y
        "col_price": 26, # Z
        "invoice_row": 15,
        "in_pc_invoice": True,
    },
    {
        "key": "silicon",
        "sheet_header": "Silicon",
        "invoice_label": "Silicon / Thermal Paste",
        "persian_label": "خمیر سیلیکون",
        "col_name": 27,  # AA
        "col_price": 28, # AB
        "invoice_row": None,
        "in_pc_invoice": False, # Optional extra row or separate in catalog
    },
]


def load_overrides() -> Dict[str, int]:
    if os.path.exists(OVERRIDES_PATH):
        try:
            with open(OVERRIDES_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_overrides(data: Dict[str, int]):
    os.makedirs(os.path.dirname(OVERRIDES_PATH), exist_ok=True)
    with open(OVERRIDES_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def detect_brand_from_color(rgb: Optional[str], name: str) -> Dict[str, str]:
    rgb_upper = (rgb or "").upper()
    if "00B0F0" in rgb_upper:
        return {"brand": "ASUS", "color_hex": "#00B0F0", "color_label": "آبی (ASUS)"}
    if "FFFF00" in rgb_upper:
        return {"brand": "LENOVO", "color_hex": "#EAB308", "color_label": "زرد (LENOVO)"}
    if "92D050" in rgb_upper:
        return {"brand": "ACER", "color_hex": "#84CC16", "color_label": "سبز (ACER)"}
    upper_name = name.upper()
    if "ASUS" in upper_name:
        return {"brand": "ASUS", "color_hex": "#00B0F0", "color_label": "ASUS"}
    if "LENOVO" in upper_name:
        return {"brand": "LENOVO", "color_hex": "#EAB308", "color_label": "LENOVO"}
    if "ACER" in upper_name:
        return {"brand": "ACER", "color_hex": "#84CC16", "color_label": "ACER"}
    return {"brand": "OTHER", "color_hex": "#94A3B8", "color_label": "سایر"}


def parse_workbook(filepath: str) -> Dict[str, Any]:
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Workbook not found: {filepath}")

    overrides = load_overrides()
    wb = openpyxl.load_workbook(filepath, data_only=True, keep_vba=True)

    # 1. Parse 'ليست کالا ها'
    ws_parts = wb["ليست کالا ها"]
    categories_out = []
    total_parts_count = 0
    priced_parts_count = 0
    hyperlinked_parts_count = 0

    for cdef in CATEGORY_DEFS:
        c_name = cdef["col_name"]
        c_price = cdef["col_price"]
        items = []

        for r in range(2, ws_parts.max_row + 1):
            cell_name = ws_parts.cell(r, c_name)
            cell_price = ws_parts.cell(r, c_price)
            raw_val = cell_name.value
            if raw_val is None:
                continue
            raw_str = str(raw_val)
            clean_str = raw_str.strip()
            if clean_str == "" or clean_str == "---":
                continue

            item_id = f"part:{cdef['key']}:{r}"
            raw_price = cell_price.value
            excel_price: Optional[int] = int(raw_price) if isinstance(raw_price, (int, float)) and raw_price > 0 else None
            effective_price = overrides.get(item_id, excel_price)

            hl_url = cell_name.hyperlink.target if cell_name.hyperlink else None
            if hl_url:
                hyperlinked_parts_count += 1

            total_parts_count += 1
            if effective_price and effective_price > 0:
                priced_parts_count += 1

            items.append({
                "id": item_id,
                "row": r,
                "category_key": cdef["key"],
                "name": clean_str,
                "raw_name": raw_str,
                "excel_price": excel_price,
                "price": effective_price,
                "has_override": item_id in overrides,
                "hyperlink": hl_url,
            })

        categories_out.append({
            **cdef,
            "count": len(items),
            "priced_count": sum(1 for x in items if x["price"] and x["price"] > 0),
            "hyperlink_count": sum(1 for x in items if x["hyperlink"]),
            "items": items,
        })

    # 2. Parse 'لیست لپ تاپ'
    ws_laptops = wb["لیست لپ تاپ"]
    laptops_out = []
    for r in range(1, ws_laptops.max_row + 1):
        cell_model = ws_laptops.cell(r, 1)
        cell_price = ws_laptops.cell(r, 2)
        val = cell_model.value
        if val is None:
            continue
        clean_model = str(val).strip()
        if clean_model == "" or clean_model == "---":
            continue

        rgb = None
        if cell_model.fill and cell_model.fill.fill_type and cell_model.fill.start_color:
            if cell_model.fill.start_color.type == "rgb":
                rgb = cell_model.fill.start_color.rgb

        brand_meta = detect_brand_from_color(rgb, clean_model)
        item_id = f"laptop:{r}"
        raw_p = cell_price.value
        excel_price = int(raw_p) if isinstance(raw_p, (int, float)) and raw_p > 0 else None
        effective_price = overrides.get(item_id, excel_price)

        laptops_out.append({
            "id": item_id,
            "row": r,
            "model": clean_model,
            "raw_model": str(val),
            "brand": brand_meta["brand"],
            "excel_fill_rgb": rgb,
            "brand_color": brand_meta["color_hex"],
            "brand_label": brand_meta["color_label"],
            "excel_price": excel_price,
            "price": effective_price,
            "has_override": item_id in overrides,
        })

    # 3. Parse 'فاکتور PC' metadata & defaults
    ws_pc_inv = wb["فاکتور PC"]
    assembly_fee_val = ws_pc_inv.cell(16, 3).value
    default_assembly_fee = int(assembly_fee_val) if isinstance(assembly_fee_val, (int, float)) else 5000000
    footer_note = ws_pc_inv.cell(18, 1).value or ""

    # 4. Parse 'فاکتور لپ تاپ' current sample row
    ws_lap_inv = wb["فاکتور لپ تاپ"]
    lap_inv_header = ws_lap_inv.cell(1, 1).value or "دیتا گراف\nلیست پیشنهادی نوت بوک"
    default_laptop_row = ws_lap_inv.cell(2, 1).value

    # Sheet structure metadata for Inspector
    sheets_meta = []
    for sname in wb.sheetnames:
        s = wb[sname]
        sheets_meta.append({
            "name": sname,
            "rows": s.max_row,
            "cols": s.max_column,
        })

    stat = os.stat(filepath)

    return {
        "workbook": {
            "filename": "List PC.xlsm",
            "size_bytes": stat.st_size,
            "modified_iso": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            "sheets": sheets_meta,
            "vba_forms": [
                {"name": "UserForm3", "caption": "فاکتور هوشمند دیتاگراف", "role": "داشبورد اصلی، جستجوی سریع قطعه و نوت‌بوک و دسترسی به فرم‌ها"},
                {"name": "UserForm1", "caption": "انتخاب کالا", "role": "فرم انتخاب ۱۳ گروه قطعات سیستم و ارسال به شیت فاکتور PC"},
                {"name": "UserForm2", "caption": "انتخاب لپ تاپ", "role": "فرم انتخاب تا ۶ دستگاه لپ‌تاپ پیشنهادی و ارسال به فاکتور لپ تاپ"},
                {"name": "UserForm4", "caption": "محاسبه اقساط", "role": "محاسبه‌گر دقیق سود دوران تقسیط و قسط ماهیانه و درج در ردیف‌های C18:C21 فاکتور"},
            ],
        },
        "store": {
            "name": "دیتاگراف",
            "tagline": "فروشگاه اینترنتی قطعات رایانه",
            "address": "تبریز، خ امام، پاساژ سهند، ط همکف، پلاک 23",
            "phone": "04135531145",
            "mobile": "09143040751",
            "assembly_note": "نصب و مونتاژ شامل (اسمبل و کابل کشی - آپدیت بایوس - نصب ویندوز - نصب برنامه های عمومی و تخصصی)",
            "price_disclaimer": "قیمت قطعات در حین خرید به روز خواهد شد.",
            "raw_footer": str(footer_note).strip(),
            "default_assembly_fee": default_assembly_fee,
            "laptop_invoice_header": str(lap_inv_header).strip(),
            "default_selected_laptop": str(default_laptop_row).strip() if default_laptop_row else None,
        },
        "stats": {
            "total_parts": total_parts_count,
            "priced_parts": priced_parts_count,
            "hyperlinked_parts": hyperlinked_parts_count,
            "total_categories": len(CATEGORY_DEFS),
            "total_laptops": len(laptops_out),
            "priced_laptops": sum(1 for x in laptops_out if x["price"] and x["price"] > 0),
        },
        "categories": categories_out,
        "laptops": laptops_out,
    }


CACHE_DATA: Optional[Dict[str, Any]] = None


def get_data(force_reload: bool = False) -> Dict[str, Any]:
    global CACHE_DATA
    if CACHE_DATA is None or force_reload:
        saved = os.path.join(BASE_DIR, 'public', 'data', 'catalog.json')
        if not force_reload and os.path.isfile(saved):
            with open(saved, encoding='utf-8') as f:
                CACHE_DATA = json.load(f)
        else:
            CACHE_DATA = parse_workbook(XLSM_PATH)
    return CACHE_DATA


class AdminLoginInput(BaseModel):
    password: str


@app.post("/api/admin/login")
def api_admin_login(payload: AdminLoginInput):
    expected = os.environ.get('DATAGRAPH_ADMIN_PASSWORD', '')
    if not expected or not hmac.compare_digest(expected, payload.password):
        raise HTTPException(status_code=403, detail='Invalid admin credential')
    return {"success": True}


@app.get("/api/catalog")
def api_get_catalog():
    return get_data(force_reload=False)


@app.post("/api/reload")
def api_reload():
    return get_data(force_reload=True)


class PriceOverrideInput(BaseModel):
    item_id: str
    price: Optional[int] = None


@app.post("/api/override-price")
def api_override_price(payload: PriceOverrideInput):
    overrides = load_overrides()
    if payload.price is None or payload.price <= 0:
        overrides.pop(payload.item_id, None)
    else:
        overrides[payload.item_id] = int(payload.price)
    save_overrides(overrides)
    return get_data(force_reload=True)


class FullCatalogSaveInput(BaseModel):
    catalog: Dict[str, Any]


@app.post("/api/save-catalog")
def api_save_catalog(payload: FullCatalogSaveInput):
    global CACHE_DATA
    payload.catalog.get('content', {}).pop('footerCredit', None)
    payload.catalog.get('store', {}).pop('raw_footer', None)
    CACHE_DATA = payload.catalog
    for p in [
        os.path.join(BASE_DIR, "public", "data", "catalog.json"),
        os.path.join(DIST_DIR, "data", "catalog.json"),
    ]:
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "w", encoding="utf-8") as f:
            json.dump(payload.catalog, f, ensure_ascii=False)
    return {"ok": True}


@app.post("/api/upload-excel")
async def api_upload_excel(file: UploadFile = File(...)):
    if not file.filename or not (file.filename.endswith(".xlsm") or file.filename.endswith(".xlsx")):
        raise HTTPException(status_code=400, detail="لطفاً یک فایل اکسل معتبر (.xlsm یا .xlsx) بارگذاری کنید.")
    content = await file.read()
    # Validate workbook structure before replacing
    try:
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
        if "ليست کالا ها" not in wb.sheetnames and "لیست لپ تاپ" not in wb.sheetnames:
            raise HTTPException(status_code=400, detail="شیت‌های استاندارد «ليست کالا ها» یا «لیست لپ تاپ» در این فایل یافت نشد.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"خطا در خواندن فایل اکسل: {str(e)}")

    with open(XLSM_PATH, "wb") as f:
        f.write(content)

    # Extract embedded logos if available
    try:
        for sub in [os.path.join(BASE_DIR, "public", "assets"), os.path.join(DIST_DIR, "assets")]:
            os.makedirs(sub, exist_ok=True)
            with zipfile.ZipFile(io.BytesIO(content), "r") as z:
                if "xl/media/image1.png" in z.namelist():
                    with open(os.path.join(sub, "logo-badge.png"), "wb") as f:
                        f.write(z.read("xl/media/image1.png"))
                if "xl/media/image2.png" in z.namelist():
                    with open(os.path.join(sub, "logo-full.png"), "wb") as f:
                        f.write(z.read("xl/media/image2.png"))
    except Exception:
        pass

    return get_data(force_reload=True)


class PCExportItem(BaseModel):
    category_key: str
    name: Optional[str] = None
    price: Optional[int] = 0
    qty: int = 1


class InstallmentSummary(BaseModel):
    enabled: bool = False
    cash_payment: int = 0
    months: int = 0
    monthly_rate: float = 0.0
    monthly_installment: int = 0
    total_interest: int = 0


class PCExportRequest(BaseModel):
    customer_name: Optional[str] = ""
    items: List[PCExportItem]
    assembly_enabled: bool = True
    assembly_fee: int = 5000000
    silicon_name: Optional[str] = None
    silicon_price: int = 0
    installment: Optional[InstallmentSummary] = None


@app.post("/api/export/pc-xlsx")
def export_pc_xlsx(req: PCExportRequest):
    """
    Loads the original workbook template (without VBA so .xlsx previews cleanly in browser & Excel),
    fills Sheet 'فاکتور PC' cleanly just like UserForm1 + UserForm4 in the original XLSM!
    """
    wb = openpyxl.load_workbook(XLSM_PATH, keep_vba=False)
    # Keep only فاکتور PC as active clean invoice sheet (or remove macro sheets)
    for name in list(wb.sheetnames):
        if name != "فاکتور PC":
            del wb[name]

    ws = wb["فاکتور PC"]
    now = datetime.now()
    ws["A1"] = now.strftime("%Y-%m-%d")
    ws["B1"] = f"پیش فاکتور دیتاگراف\n{req.customer_name}" if req.customer_name else "پیش فاکتور\nدیتاگراف"
    ws["C1"] = now.strftime("%H:%M:%S")

    # Map category_key -> invoice row (3..15)
    row_map = {c["key"]: c["invoice_row"] for c in CATEGORY_DEFS if c["invoice_row"]}

    # Clear B3:C15
    for r in range(3, 16):
        ws.cell(r, 2).value = "---"
        ws.cell(r, 3).value = 0

    total_sum = 0
    for item in req.items:
        r = row_map.get(item.category_key)
        if r and item.name and item.name.strip() and item.name.strip() != "---":
            qty_suffix = f" (×{item.qty})" if item.qty > 1 else ""
            line_price = (item.price or 0) * max(1, item.qty)
            ws.cell(r, 2).value = f"{item.name.strip()}{qty_suffix}"
            ws.cell(r, 3).value = line_price
            total_sum += line_price

    # If thermal paste (silicon) is chosen, append to Cooling/Fan or Accessories if empty
    if req.silicon_name and req.silicon_name.strip() != "---":
        existing_fan = ws.cell(15, 2).value
        if existing_fan and existing_fan != "---":
            ws.cell(15, 2).value = f"{existing_fan} + {req.silicon_name}"
            ws.cell(15, 3).value = int(ws.cell(15, 3).value or 0) + int(req.silicon_price or 0)
        else:
            ws.cell(15, 2).value = req.silicon_name
            ws.cell(15, 3).value = int(req.silicon_price or 0)
        total_sum += int(req.silicon_price or 0)

    # Row 16: نصب و مونتاژ
    asm_fee = int(req.assembly_fee) if req.assembly_enabled else 0
    ws.cell(16, 2).value = "شامل اسمبل، کابل‌کشی، بایوس و ویندوز" if req.assembly_enabled else "بدون مونتاژ"
    ws.cell(16, 3).value = asm_fee
    total_sum += asm_fee

    # Row 17: جمع کل فاکتور
    ws.cell(17, 3).value = total_sum

    # If installment is enabled, write details below footer (rows 24..27) cleanly
    if req.installment and req.installment.enabled and req.installment.months > 0:
        ws.cell(24, 1).value = "شرایط فروش اقساطی"
        ws.cell(24, 2).value = f"پیش‌پرداخت نقدی: {req.installment.cash_payment:,} ریال | تعداد اقساط: {req.installment.months} ماه ({req.installment.monthly_rate}% ماهیانه)"
        ws.cell(25, 1).value = "مبلغ هر قسط"
        ws.cell(25, 2).value = f"سود دوران تقسیط: {req.installment.total_interest:,} ریال"
        ws.cell(25, 3).value = req.installment.monthly_installment

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="DataGraph-PC-Invoice.xlsx"'},
    )


class LaptopExportItem(BaseModel):
    model: str
    price: int = 0


class LaptopExportRequest(BaseModel):
    customer_name: Optional[str] = ""
    laptops: List[LaptopExportItem]


@app.post("/api/export/laptop-xlsx")
def export_laptop_xlsx(req: LaptopExportRequest):
    wb = openpyxl.load_workbook(XLSM_PATH, keep_vba=False)
    for name in list(wb.sheetnames):
        if name != "فاکتور لپ تاپ":
            del wb[name]

    ws = wb["فاکتور لپ تاپ"]
    if req.customer_name:
        ws["A1"] = f"دیتا گراف\nلیست پیشنهادی نوت بوک ({req.customer_name})"

    # Clear rows 2..15
    for r in range(2, 16):
        ws.cell(r, 1).value = None
        ws.cell(r, 2).value = None

    for idx, item in enumerate(req.laptops[:14]):
        r = idx + 2
        ws.cell(r, 1).value = item.model
        ws.cell(r, 2).value = item.price if item.price and item.price > 0 else "تماس بگیرید"

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="DataGraph-Laptop-Quote.xlsx"'},
    )


# Mount static frontend build (dist/) so the entire app runs on ONE unified port
if os.path.isdir(os.path.join(DIST_DIR, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST_DIR, "assets")), name="assets")


@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    parts = full_path.split('/')
    if any(part.startswith('.') for part in parts) or full_path.endswith(('.php', '.env', '.zip', '.jks', '.keystore')):
        raise HTTPException(status_code=404)
    target = os.path.abspath(os.path.join(DIST_DIR, full_path))
    if os.path.commonpath([target, DIST_DIR]) != DIST_DIR:
        raise HTTPException(status_code=404)
    if full_path and os.path.isfile(target):
        return FileResponse(target)
    index_file = os.path.join(DIST_DIR, "index.html")
    if os.path.isfile(index_file):
        return FileResponse(index_file)
    raise HTTPException(status_code=404, detail="Frontend build not found")
