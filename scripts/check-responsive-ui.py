import asyncio,json,argparse,shutil
from pathlib import Path
from playwright.async_api import async_playwright
parser=argparse.ArgumentParser(description='Read-only responsive checks against a seeded Resolve app; never sends an AI request.')
parser.add_argument('--base-url', default='http://localhost:3000')
parser.add_argument('--out', default='.ui-checks')
parser.add_argument('--chromium', default=shutil.which('chromium'))
parser.add_argument('--no-sandbox', action='store_true', help='Only for a trusted local app in a container that cannot run Chromium sandboxing.')
args=parser.parse_args()
BASE=args.base_url.rstrip('/')
OUT=Path(args.out);OUT.mkdir(parents=True,exist_ok=True)
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=args.chromium,args=['--disable-dev-shm-usage']+(['--no-sandbox'] if args.no_sandbox else []))
  context=await browser.new_context(viewport={'width':1440,'height':1040},color_scheme='light')
  page=await context.new_page();errors=[];api_calls=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  await page.route('**/api/chat',lambda route:route.abort())
  page.on('request',lambda r:api_calls.append(r.url) if '/api/chat' in r.url else None)
  await page.goto(BASE+'/payments',wait_until='networkidle')
  await page.get_by_role('heading',name='Payment history 15').wait_for(timeout=30000)
  await page.evaluate('document.fonts.ready')
  await page.screenshot(path=str(OUT/'desktop.png'),full_page=True)
  assert await page.locator('.payment-table tbody tr').count()==4
  await page.get_by_role('searchbox',name='Search payments').fill('absent merchant')
  await page.get_by_text('No payments match these filters.').wait_for()
  await page.get_by_role('searchbox',name='Search payments').fill('')
  await page.get_by_role('button',name='Next payments',exact=True).click()
  assert '5–8' in await page.locator('.ledger-pagination').inner_text()
  await page.get_by_role('button',name='Previous payments',exact=True).click()
  await page.locator('.payment-identity').first.click()
  await page.get_by_role('dialog',name='Payment details',exact=True).wait_for()
  await page.get_by_text('Possible matching charges',exact=True).wait_for()
  await page.screenshot(path=str(OUT/'payment-detail.png'))
  await page.get_by_role('button',name='Add to investigation',exact=True).click()
  assert await page.locator('.attached-payment').is_visible()
  await page.get_by_label('Describe a payment problem').fill('Please check if this was charged twice.')
  await page.get_by_role('button',name='Prepare investigation',exact=True).click()
  await page.wait_for_url('**/demo?customer_id=*')
  await page.get_by_label('Describe your payment problem').wait_for()
  await page.wait_for_function("document.querySelector('#message')?.value.includes('Payment reference:')", timeout=15000)
  assert not api_calls,api_calls
  await page.screenshot(path=str(OUT/'investigation.png'),full_page=True)
  manifest=await (await context.request.get(BASE+'/manifest.webmanifest')).json()
  assert manifest['display']=='standalone' and manifest['start_url']=='/payments'
  for icon in manifest['icons']:
   response=await context.request.get(BASE+icon['src']);assert response.ok
   assert response.headers['content-type'].startswith('image/png')
  assert await page.locator('meta[name="apple-mobile-web-app-capable"]').get_attribute('content')=='yes'
  assert 'viewport-fit=cover' in await page.locator('meta[name="viewport"]').get_attribute('content')
  response=await context.request.get(BASE+'/api/customers');assert 'no-store' in response.headers['cache-control']
  reports=[]
  for theme in ['light','dark']:
   await page.evaluate('(theme)=>localStorage.setItem("resolve-theme",theme)',theme)
   for route in ['/payments','/demo','/approvals','/under-the-hood','/']:
    print('Checking',theme,route,flush=True)
    await page.goto(BASE+route,wait_until='networkidle')
    for width,height in [(320,740),(390,844),(768,1024),(1024,768),(1440,1040),(1920,1080),(844,390)]:
     await page.set_viewport_size({'width':width,'height':height})
     overflow=await page.evaluate('document.documentElement.scrollWidth>innerWidth')
     if overflow:
      culprits=await page.evaluate('Array.from(document.querySelectorAll("body *")).filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(e=>({tag:e.tagName,cls:e.className,right:e.getBoundingClientRect().right}))')
      raise AssertionError({'route':route,'theme':theme,'width':width,'culprits':culprits})
     reports.append({'route':route,'theme':theme,'viewport':f'{width}x{height}'})
     if route=='/payments' and width==390:
      await page.evaluate('document.activeElement?.blur();window.scrollTo(0,0)')
      await page.screenshot(path=str(OUT/f'phone-{theme}.png'))
      await page.screenshot(path=str(OUT/f'phone-{theme}-full.png'),full_page=True)
      assert await page.locator('.site-header-actions').evaluate('(el)=>el.getBoundingClientRect().bottom<=document.querySelector(".site-header").getBoundingClientRect().bottom')
      await page.get_by_role('button',name='Open navigation',exact=True).click()
      await page.get_by_role('dialog',name='Workspace navigation').wait_for();await page.keyboard.press('Escape')
  assert not errors,errors
  (OUT/'browser-checks.json').write_text(json.dumps({'checks':reports,'errors':errors,'ai_requests':len(api_calls),'manifest':'verified','draft_handoff':'passed'},indent=2))
  print(json.dumps({'responsive_checks':len(reports),'errors':errors,'ai_requests':len(api_calls),'manifest':'passed','draft_handoff':'passed'}))
  await browser.close()
asyncio.run(main())
