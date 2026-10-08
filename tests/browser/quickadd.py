import os; HERE=os.path.dirname(os.path.abspath(__file__))
from playwright.sync_api import sync_playwright
ok=fail=0
def T(n,c,d=''):
    global ok,fail
    if c: ok+=1
    else: fail+=1; print('FAIL',n,d)
html='<!doctype html><html><body><div id="root"></div><script src="bundle.js"></script></body></html>'
open(HERE+'/index.html','w').write(html)
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    def fresh(w=1280):
        pg=b.new_page(viewport={'width':w,'height':800}); pg.on('pageerror',lambda e:errs.append(str(e))); pg.goto('file://' + HERE + '/index.html'); return pg
    calls=lambda pg: pg.evaluate('window.__calls')
    pg=fresh()
    pg.fill('input[aria-label=Transaction]','food 120, grocery 29, transport 80'); pg.press('input[aria-label=Transaction]','Enter'); pg.press('input[aria-label=Transaction]','Enter'); pg.click('text=Add'); pg.click('text=Working…',timeout=2000) if False else None
    pg.wait_for_selector('text=Logged 3 entries'); c=calls(pg)
    T('double Enter + click => ONE save call',len(c)==1,c); T('3 items',len(c[0]['items'])==3 and [i['amount_minor'] for i in c[0]['items']]==[12000,2900,8000])
    T('success text lists items','Food — ₱120.00' in pg.inner_text('section') and 'Transportation — ₱80.00' in pg.inner_text('section')); T('input cleared after success',pg.input_value('input[aria-label=Transaction]')==''); T('router.refresh called',pg.evaluate('window.__refresh')>=1)
    # failure: no fake success, input kept, retry reuses request id; changed text gets a new id
    pg=fresh(); pg.evaluate('window.__fail=true'); pg.fill('input[aria-label=Transaction]','food 120'); pg.press('input[aria-label=Transaction]','Enter'); pg.wait_for_selector('text=Not saved')
    T('failure shows Not saved, not Logged','Logged' not in pg.inner_text('section')); T('input kept on failure',pg.input_value('input[aria-label=Transaction]')=='food 120')
    pg.press('input[aria-label=Transaction]','Enter'); pg.wait_for_selector('text=Not saved'); c=calls(pg); T('retry reuses same request id',len(c)==2 and c[0]['id']==c[1]['id'],[x['id'] for x in c])
    pg.fill('input[aria-label=Transaction]','food 121'); pg.press('input[aria-label=Transaction]','Enter'); pg.wait_for_selector('text=Not saved >> nth=0'); pg.wait_for_timeout(500); c=calls(pg); T('changed input => new request id',len(c)==3 and c[2]['id']!=c[0]['id'])
    pg.evaluate('window.__fail=false'); pg.click('button:has-text("Retry save")'); pg.wait_for_selector('text=Logged!'); T('retry then succeeds',True)
    # ambiguous: John 500 -> ask; nothing saved until answered
    pg=fresh(); pg.fill('input[aria-label=Transaction]','John 500'); pg.press('input[aria-label=Transaction]','Enter'); pg.wait_for_selector('text=Received'); T('ambiguous input saves nothing',len(calls(pg))==0)
    pg.click('button:has-text("Received")'); pg.wait_for_selector('text=Logged!'); c=calls(pg); T('Received => income 50000',c[0]['items'][0]['type']=='income' and c[0]['items'][0]['amount_minor']==50000 and 'Money from John'==c[0]['items'][0]['description'],c)
    # confirm: amazon -> category picker
    pg=fresh(); pg.fill('input[aria-label=Transaction]','amazon 1200'); pg.press('input[aria-label=Transaction]','Enter'); pg.wait_for_selector('text=confirm the category'); T('confirm saves nothing yet',len(calls(pg))==0)
    pg.select_option('section select','Entertainment'); pg.click('section button:has-text("Save")'); pg.wait_for_selector('text=Logged!'); T('confirm uses chosen category',calls(pg)[0]['items'][0]['category']=='Entertainment')
    # mixed: ok + ambiguous in one input -> held until resolved, then ONE save with both
    pg=fresh(); pg.fill('input[aria-label=Transaction]','food 100, John 500, bogus'); pg.press('input[aria-label=Transaction]','Enter'); pg.wait_for_selector('text=Received'); T('error shown for unparseable part','No amount found' in pg.inner_text('section'))
    T('nothing saved while pending',len(calls(pg))==0); pg.click('button:has-text("Spent")'); pg.wait_for_selector('text=confirm the category'); pg.click('section button:has-text("Save")'); pg.wait_for_selector('text=Added 2 transactions'); T('one save with both items',len(calls(pg))==1 and len(calls(pg)[0]['items'])==2)
    # discard
    pg=fresh(); pg.fill('input[aria-label=Transaction]','John 500'); pg.press('input[aria-label=Transaction]','Enter'); pg.wait_for_selector('text=Discard'); pg.click('text=Discard'); T('discard removes pending, saves nothing',len(calls(pg))==0 and pg.locator('text=Received').count()==0)
    # command + undo
    pg=fresh(); pg.fill('input[aria-label=Transaction]','delete the last transaction'); pg.press('input[aria-label=Transaction]','Enter'); pg.wait_for_selector('text=Undo delete'); pg.click('text=Undo delete'); pg.wait_for_selector('text=Restored'); c=calls(pg); T('delete command then undo',c[0]['fn']=='cmd' and c[1]['fn']=='restore' and c[1]['row']['id']=='abc',c)
    # empty / whitespace / long / html input
    pg=fresh(); pg.fill('input[aria-label=Transaction]','   '); pg.press('input[aria-label=Transaction]','Enter'); T('whitespace does nothing',len(calls(pg))==0)
    pg.fill('input[aria-label=Transaction]','<img src=x onerror=window.__xss=1> 5'); pg.press('input[aria-label=Transaction]','Enter'); pg.wait_for_timeout(700); T('HTML in input is text, not executed',pg.evaluate('window.__xss')is None and pg.locator('section img').count()==0)
    # mobile layout
    pg=fresh(390); T('no horizontal overflow at 390px',not pg.evaluate('document.documentElement.scrollWidth>innerWidth')); pg.fill('input[aria-label=Transaction]','x'*400); T('input capped at 500 chars',len(pg.input_value('input[aria-label=Transaction]'))<=500)
    T('no uncaught page errors',not errs,errs); print(f'browser (real Chromium, real QuickAdd component, mocked server actions): pass {ok} fail {fail}'); b.close()
