const { chromium } = require('playwright');

const TARGET_URL = 'https://demo.inelabteamdev.com/';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const apiCalls = [];

  page.on('response', async (res) => {
    const url = res.url();
    const contentType = res.headers()['content-type'] || '';

    // Flag anything that looks like it could be catalog/product data.
    const looksRelevant = /api|product|catalog|list|shop|item/i.test(url);
    if (!looksRelevant) return;

    let bodyPreview = null;
    if (contentType.includes('application/json')) {
      try {
        const json = await res.json();
        bodyPreview = JSON.stringify(json).slice(0, 500);
      } catch {
        bodyPreview = '(could not parse JSON body)';
      }
    }

    apiCalls.push({
      url,
      status: res.status(),
      contentType,
      bodyPreview,
    });
  });

  console.log(`Loading ${TARGET_URL} ...\n`);
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {
    console.log('(networkidle timeout - continuing anyway)');
  });

  // Give any lazy-loaded content a moment to fire its requests.
  await page.waitForTimeout(2000);

  console.log('--- Relevant network calls seen while loading homepage ---\n');
  if (apiCalls.length === 0) {
    console.log('(none matched the api/product/catalog/list/shop/item filter)');
  } else {
    apiCalls.forEach((c, i) => {
      console.log(`${i + 1}. [${c.status}] ${c.url}`);
      console.log(`   content-type: ${c.contentType}`);
      if (c.bodyPreview) console.log(`   body preview: ${c.bodyPreview}`);
      console.log('');
    });
  }

  // Fallback source: scan the rendered DOM for product links directly.
  const productLinks = await page.$$eval('a[href*="/product/"]', (els) =>
    els.map((el) => ({ href: el.getAttribute('href'), text: el.textContent.trim() }))
  );

  console.log('--- Product links found in rendered homepage DOM ---\n');
  if (productLinks.length === 0) {
    console.log('(no /product/ links found on the homepage itself - may need to check a listing/shop page)');
  } else {
    productLinks.forEach((p, i) => console.log(`${i + 1}. ${p.href}  ->  "${p.text}"`));
  }

  await browser.close();
}

main();