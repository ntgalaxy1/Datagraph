import pathlib,re,base64,json
root=pathlib.Path(__file__).resolve().parents[1]; d=root/'dist'
s=(d/'index.html').read_text()
def data(p):return 'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode()
js=next((d/'assets').glob('index-*.js')).read_text()
for name in ['logo-badge.png','logo-full.png']:
 uri=data(d/'assets'/name);s=s.replace('./assets/'+name,uri);js=js.replace('./assets/'+name,uri)
cat=(d/'data/catalog.json').read_text().replace('<','\\u003c')
shim='<script>window.__EMBEDDED_CATALOG__='+cat+''';const orig=window.fetch.bind(window);window.fetch=async function(i,o){const u=typeof i==='string'?i:(i&&i.url)||'';if(u.includes('catalog.json')||u.includes('/api/catalog'))return new Response(JSON.stringify(window.__EMBEDDED_CATALOG__),{status:200,headers:{'Content-Type':'application/json'}});return orig(i,o);};</script>'''
s=re.sub(r'<script[^>]+src="[^"]*index-[^"]*\.js"[^>]*></script>',lambda m:shim+'<script type="module">'+js.replace('</script','<\\/script')+'</script>',s)
css=next((d/'assets').glob('index-*.css')).read_text()
s=re.sub(r'<link[^>]+href="[^"]*index-[^"]*\.css"[^>]*>',lambda m:'<style>'+css+'</style>',s)
(root/'DataGraph-Smart-App.html').write_text(s, encoding='utf-8')
