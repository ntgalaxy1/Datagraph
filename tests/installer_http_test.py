"""Run against a disposable local fixture only. Never target a real domain."""
import http.cookiejar, urllib.request, urllib.parse, urllib.error, re, pathlib, json, shutil, os
base = os.environ.get('INSTALL_TEST_URL','http://127.0.0.1:8003/')
assert urllib.parse.urlparse(base).hostname in ('127.0.0.1','localhost'), 'Local test only'
jar=http.cookiejar.CookieJar();client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
def form():
    text=client.open(base+'install.php').read().decode()
    token=re.search('name="csrf" value="([a-f0-9]+)"',text)
    return text,token.group(1) if token else None
text,token=form();assert token;assert 'اتصال، ساخت جدول' in text
payload={'csrf':token,'db_host':'127.0.0.1','db_name':'datagraph_installer_test','db_user':'dgtest','db_password':'test-only-password','admin_password':'test-admin-password-123'}
def submit(p):return client.open(base+'install.php',urllib.parse.urlencode(p).encode()).read().decode()
try:submit({**payload,'csrf':'bad'});raise AssertionError('Missing CSRF accepted')
except urllib.error.HTTPError as e:assert e.code==403
try:submit({**payload,'admin_password':'wrong'});raise AssertionError('Wrong admin accepted')
except urllib.error.HTTPError as e:assert e.code==403
try:submit({**payload,'db_password':'invalid-secret-test'});raise AssertionError('Wrong DB accepted')
except urllib.error.HTTPError as e:
    assert e.code==400
    assert 'invalid-secret-test' not in e.read().decode()
text=submit(payload);assert 'نصب با موفقیت انجام شد' in text;assert 'خودکار حذف شد' in text
try:client.open(base+'install.php');raise AssertionError('Installer not deleted')
except urllib.error.HTTPError as e:assert e.code==404
site=pathlib.Path('/home/user/.cache/dg-install-http/site')
assert not (site/'install.php').exists()
shutil.copy2(pathlib.Path(__file__).parents[1]/'public/install.php',site/'install.php')
text,token=form();assert 'نصب قفل است' in text and token is None
private=site.parent/'private'
assert (private/'install.complete.json').exists()
assert json.loads((private/'inventory-config.json').read_text())['db_name']=='datagraph_installer_test'
print('PASS HTTP installer: CSRF, owner auth, safe errors, one-click migration, self-deletion, re-upload remains locked')
