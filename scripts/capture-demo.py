"""Capture the real UI using a labeled recorded Gemini replay, without API usage.

Optional tooling: Python playwright, system Chromium and ffmpeg.
Start the app first. No database or AI credentials are used by this capture.
"""
import asyncio
import json
import os
from pathlib import Path
from urllib.parse import urlparse, parse_qs

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get('DEMO_CAPTURE_URL', 'http://127.0.0.1:3000')
REPLAY = json.loads((ROOT / 'docs/demo-replay.json').read_text())
FRAMES = ROOT / '.demo-capture'


def event(value):
    return 'data: ' + json.dumps(value) + '\n\n'


def response_events():
    run = REPLAY['trace']
    events = [event({'type': 'run_started', 'runId': run['id'], 'model': run['model']})]
    for call in run['tool_calls']:
        events.append(event({'type': 'tool_started', 'callId': call['call_id'], 'name': call['name'], 'input': call['input']}))
        events.append(event({'type': 'tool_finished', 'callId': call['call_id'], 'result': call['result'], 'failed': call['failed'], 'durationMs': call['duration_ms']}))
    events.extend([
        event({'type': 'text_delta', 'text': run['final_text']}),
        event({'type': 'done', 'steps': len(run['steps']), 'limited': False}),
    ])
    return ''.join(events)


async def main():
    FRAMES.mkdir(exist_ok=True)
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-dev-shm-usage'])
        context = await browser.new_context(viewport={'width': 1280, 'height': 920}, device_scale_factor=1, timezone_id='America/Los_Angeles', color_scheme='light')
        pending = {'value': True}
        page_errors = []
        page = await context.new_page()
        page.on('pageerror', lambda err: page_errors.append(str(err)))

        async def api(route):
            path = urlparse(route.request.url).path
            if path == '/api/customers':
                body = {'customers': [REPLAY['customer']]}
            elif path == '/api/chat':
                await asyncio.sleep(1.5)
                await route.fulfill(status=200, content_type='text/event-stream', body=response_events())
                return
            elif path == '/api/refunds':
                body = {'refunds': [REPLAY['approval']] if pending['value'] else []}
            elif path.startswith('/api/refunds/') and route.request.method == 'POST':
                pending['value'] = False
                decision = json.loads(route.request.post_data)['decision']
                body = {'refund': {**REPLAY['approval'], 'status': 'succeeded' if decision == 'approve' else 'rejected'}}
            elif path == '/api/observability':
                source = parse_qs(urlparse(route.request.url).query).get('source', ['chat'])[0]
                body = {'runs': [REPLAY['trace']] if source in ['eval', 'all'] else [], 'reports': [REPLAY['report']]}
            else:
                await route.abort()
                raise AssertionError('Unexpected capture API: ' + path)
            await route.fulfill(status=200, content_type='application/json', body=json.dumps(body))

        await context.route('**/api/**', api)
        watermark = """(() => {
          const add = () => {
            if (document.querySelector('#recorded-capture-label')) return;
            const label = document.createElement('div'); label.id = 'recorded-capture-label';
            label.textContent = 'RECORDED GEMINI REPLAY · SIMULATED APPROVAL SCREEN · FICTIONAL PAYMENTS';
            label.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99999;text-align:center;background:#132e25;color:#edf5ee;padding:8px;font:11px Arial;letter-spacing:.6px;pointer-events:none';
            document.body.append(label);
          };
          if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
        })()"""
        await context.add_init_script(watermark)

        async def capture(name):
            await page.wait_for_timeout(300)
            await page.locator('#recorded-capture-label').wait_for()
            await page.screenshot(path=str(FRAMES / name))

        await page.goto(BASE + '/', wait_until='networkidle')
        await capture('01-landing.png')
        await page.get_by_role('link', name='Try it', exact=True).click()
        await page.get_by_role('option', name=REPLAY['customer']['name']).wait_for(state='attached')
        await page.get_by_label('Describe your payment problem').fill(REPLAY['message'])
        await capture('02-question.png')
        await page.get_by_role('button', name='Send message').click()
        await page.wait_for_timeout(200)
        await capture('03-investigating.png')
        await page.get_by_role('button', name='Send message').wait_for()
        await page.locator('.activity-panel > summary').click()
        await capture('04-evidence.png')
        await page.get_by_role('link', name='Approvals', exact=True).click()
        await page.get_by_role('button', name='Approve mock refund').wait_for()
        await capture('05-approval.png')
        await page.get_by_role('button', name='Approve mock refund').click()
        await page.get_by_role('status').filter(has_text='No real money moved').wait_for()
        await capture('06-approved.png')
        await page.get_by_role('button', name='Use dark mode').click()
        await page.get_by_role('link', name='Under the hood', exact=True).click()
        await page.get_by_text('12/40 passed (30.0%)', exact=True).wait_for()
        await capture('07-observability.png')
        assert not page_errors, page_errors
        await browser.close()
    print('Captured 7 labeled replay frames. No inference or database writes were performed.')


if __name__ == '__main__':
    asyncio.run(main())
