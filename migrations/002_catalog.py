"""Idempotent migration for the existing JSON database (not a SQL-backed app)."""
import json, pathlib, sys, shutil
p = pathlib.Path(sys.argv[1])
old = json.loads(p.read_text())
if old.get('schema_version', 1) < 2:
    shutil.copy2(p, p.with_suffix('.pre-v2.json'))
    old.get('content', {}).pop('footerCredit', None)
    old.get('store', {}).pop('raw_footer', None)
    for item in [i for c in old['categories'] for i in c['items']] + old['laptops']:
        item.setdefault('initial_price', item.get('excel_price', item.get('price')))
    old['schema_version'] = 2
    temp = p.with_suffix('.migrating')
    temp.write_text(json.dumps(old, ensure_ascii=False))
    temp.replace(p)
print('schema_version=2')
