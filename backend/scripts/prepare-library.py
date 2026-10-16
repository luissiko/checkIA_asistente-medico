"""Preparación local explícita. No activa documentos ni ejecuta JavaScript."""
import argparse,datetime,hashlib,html,json,pathlib,re,shutil,subprocess,urllib.request
from html.parser import HTMLParser
from urllib.parse import urlsplit
HOSTS={'medlineplus.gov','www.niddk.nih.gov','www.who.int','www.imss.gob.mx','www.cenetec-difusion.com','cenetec-difusion.com','www.nhs.uk','www.nice.org.uk','www.cdc.gov','www.paho.org','www.healthdirect.gov.au'}
LIMIT=8*1024*1024
ROOT=pathlib.Path(__file__).resolve().parents[1]/'knowledge'
def safe(url):
 u=urlsplit(url)
 if u.scheme!='https' or u.hostname not in HOSTS or u.username or u.password or u.port or u.query or u.fragment:raise ValueError('URL fuera de la política institucional')
 return url
class Redirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,req,fp,code,msg,headers,newurl):
  safe(newurl);return super().redirect_request(req,fp,code,msg,headers,newurl)
class Text(HTMLParser):
 def __init__(self):super().__init__();self.skip=0;self.parts=[]
 def handle_starttag(self,t,a):
  if t in ('script','style','head','nav','footer'):self.skip+=1
 def handle_endtag(self,t):
  if t in ('script','style','head','nav','footer'):self.skip=max(0,self.skip-1)
 def handle_data(self,d):
  if not self.skip and d.strip():self.parts.append(d.strip())
def extract_html(raw):
 m=re.search(r'window\.__APP_PROPS__\s*=\s*(\{.*?\});?\s*</script>',raw,re.S)
 if m:
  data=json.loads(m[1]);strings=[]
  def walk(x):
   if isinstance(x,dict):
    for v in x.values():walk(v)
   elif isinstance(x,list):
    for v in x:walk(v)
   elif isinstance(x,str) and len(x)>100:strings.append(x)
  walk(data);raw='\n'.join(strings)
 p=Text();p.feed(raw);return html.unescape('\n'.join(p.parts))
def main():
 a=argparse.ArgumentParser(description=__doc__);a.add_argument('--confirm-download',action='store_true');args=a.parse_args()
 if not args.confirm_download:a.error('Usa --confirm-download. Comprueba permisos de uso antes de descargar. No se evaden bloqueos.')
 corpus=json.loads((ROOT/'corpus.json').read_text(encoding='utf-8-sig'));out=ROOT/'staging'/datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d_%H%M%S_%f');out.mkdir(parents=True)
 records=[];opener=urllib.request.build_opener(Redirect())
 for d in corpus['documents']:
  entry={'id':d['id'],'url':d['url'],'downloadedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'clinicalReview':'pending'};records.append(entry)
  try:
   with opener.open(safe(d['url']),timeout=20) as r:raw=r.read(LIMIT+1);content=r.headers.get('Content-Type','');final=safe(r.url)
   if len(raw)>LIMIT:raise ValueError('Documento mayor a 8 MiB; preparación manual requerida')
   pdf=raw.startswith(b'%PDF');path=out/(d['id']+('.pdf' if pdf else '.html'));path.write_bytes(raw)
   entry.update(status='downloaded',sha256=hashlib.sha256(raw).hexdigest(),bytes=len(raw),finalUrl=final,contentType=content)
   target=out/(d['id']+'.txt')
   if pdf:
    if not shutil.which('pdftotext'):entry['extraction']='manual_pdf_required';continue
    subprocess.run(['pdftotext','-layout',str(path),str(target)],check=True,timeout=30,capture_output=True)
    text=target.read_text(encoding='utf-8',errors='replace')
   else:text=extract_html(raw.decode('utf-8',errors='replace'));target.write_text(text,encoding='utf-8')
   entry.update(extractedCharacters=len(text),extraction='needs_manual_review' if len(text)>300 else 'insufficient_text_or_ocr_required')
  except Exception as e:entry.update(status='unavailable',error=str(e)[:200])
  print(d['id']+': '+entry['status'])
 (out/'manifest.json').write_text(json.dumps({'note':'Revisar tablas, páginas, unidades, menús y OCR. Descarga no equivale a revisión clínica. Nada se importó al corpus ni al índice.','records':records},ensure_ascii=False,indent=2),encoding='utf-8')
 print('Preparación guardada en '+str(out))
if __name__=='__main__':main()
