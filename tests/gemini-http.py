import requests,os
u='http://127.0.0.1:8011/api/gemini.php'
h={'X-Admin-Key':'test-fixture-only'}
def post(b,auth=True):return requests.post(u,json=b,headers=h if auth else {},timeout=5)
assert requests.get(u).status_code==405
assert post({'action':'status'},False).status_code==403
assert post({'action':'status'}).json()['configured']==False
assert post({'action':'extract','text':'CPU','consent':True}).status_code==400
assert post({'action':'configure','key':'TEST-KEY-NOT-REAL-123456789','model':'https://evil.example/'}).status_code==400
assert post({'action':'configure','key':'TEST-KEY-NOT-REAL-123456789','model':'gemini-2.5-flash'}).json()['success']
r=post({'action':'status'});assert r.json()['configured'] and 'TEST-KEY' not in r.text
assert os.stat('/home/user/.cache/dg-gemini-http/private/gemini-config.json').st_mode&0o777==0o600
assert post({'action':'extract','text':'CPU','consent':False}).status_code==400
assert post({'action':'extract','consent':True,'image':'bm90LWFuLWltYWdl'}).status_code==400
assert post({'action':'delete_key'}).json()['success']
assert not post({'action':'status'}).json()['configured']
print('PASS: method/auth, missing key, fixed model URL, private 0600 key, status redaction, consent, image validation, key deletion; no live Google request')
