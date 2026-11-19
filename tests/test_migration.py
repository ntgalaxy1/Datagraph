import json, pathlib, subprocess, tempfile
with tempfile.TemporaryDirectory() as d:
    p = pathlib.Path(d) / 'catalog.json'
    p.write_text(json.dumps({'store': {'raw_footer': 'ignored'}, 'content': {'footerCredit': 'ignored'}, 'categories': [{'items': [{'price': 123}]}], 'laptops': []}))
    script = pathlib.Path(__file__).parents[1] / 'migrations/002_catalog.py'
    for _ in range(2):
        subprocess.run(['python3', str(script), str(p)], check=True)
    data = json.loads(p.read_text())
    assert data['schema_version'] == 2
    assert 'footerCredit' not in data['content']
    assert data['categories'][0]['items'][0]['initial_price'] == 123
print('PASS: idempotent JSON migration')
