const MAX_ATTEMPTS = 3;
const NAV_TIMEOUT = 20000;
const ACTIVATE_TIMEOUT = 8000;
const PRICE_HIDDEN_CLEAR_TIMEOUT = 10000;
const PRICE_APPEAR_TIMEOUT = 12000;

function log(...args) { console.log(...args); }
function debugLog(debug, ...args) { if (debug) console.log('[debug]', ...args); }

async function attachDiagnostics(page, debug) {
  if (!debug) return;
  page.on('console', msg => debugLog(debug, 'console:', msg.type(), msg.text()));
  page.on('pageerror', err => debugLog(debug, 'pageerror:', err.message));
  page.on('requestfailed', req => debugLog(debug, 'requestfailed:', req.url(), req.failure()?.errorText));
  page.on('response', res => {
    if (res.url().includes('/api/')) debugLog(debug, 'response:', res.status(), res.url());
  });

  await page.exposeFunction('__diagLogEvent', (name) => debugLog(debug, 'event fired on .price-block:', name));
  await page.addInitScript(() => {
    window.addEventListener('load', () => {
      const el = document.querySelector('.price-block');
      if (!el) return;
      ['mouseenter', 'mousemove', 'mouseover', 'pointerenter', 'pointermove'].forEach(evt => {
        el.addEventListener(evt, () => window.__diagLogEvent(evt), { passive: true });
      });
    });
  });
}

async function handleCookieBanner(page, debug) {
  const acceptButton = page.getByRole('button', { name: /accept/i });
  try {
    await acceptButton.waitFor({ state: 'visible', timeout: 4000 });
  } catch {
    debugLog(debug, 'No cookie banner appeared - continuing.');
    return false;
  }
  await acceptButton.click();
  debugLog(debug, 'Cookie banner found and accepted.');
  return true;
}

async function simulateRealMouseMovement(page, box) {
  const startX = Math.max(box.x - 80, 0);
  const startY = box.y + box.height / 2;
  const endX = box.x + box.width / 2;
  const endY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  const steps = 15;
  for (let i = 1; i <= steps; i++) {
    const x = startX + ((endX - startX) * i) / steps;
    const y = startY + ((endY - startY) * i) / steps;
    await page.mouse.move(x, y);
    await page.waitForTimeout(35);
  }
  await page.waitForTimeout(400);
}

async function activateAndReveal(page, debug) {
  const priceBlock = page.locator('.price-block');
  await priceBlock.waitFor({ state: 'visible', timeout: 10000 });

  const box = await priceBlock.boundingBox();
  if (!box) throw new Error('Could not get bounding box for .price-block');

  await simulateRealMouseMovement(page, box);

  const blockHandle = await priceBlock.elementHandle();
  await page.waitForFunction(
    (el) => {
      const btn = el.querySelector('button[aria-label="Reveal price"]');
      return (btn && !btn.disabled) || !el.classList.contains('price-idle');
    },
    blockHandle,
    { timeout: ACTIVATE_TIMEOUT }
  );

  const revealButton = page.getByRole('button', { name: /reveal price/i });
  await revealButton.click();

  await page.waitForFunction(
    (el) => el && !el.innerText.includes('Price hidden'),
    blockHandle,
    { timeout: PRICE_HIDDEN_CLEAR_TIMEOUT }
  );

  try {
    await page.waitForFunction(
      (el) => /₹\s?[\d,]+/.test(el.innerText),
      blockHandle,
      { timeout: PRICE_APPEAR_TIMEOUT }
    );
  } catch {
    throw new Error('Current price did not appear within timeout.');
  }

  const text = (await priceBlock.innerText()).trim();
  debugLog(debug, 'Revealed price-block text:', JSON.stringify(text));
  if (debug) {
    // We have never observed the actual markup around the price amounts
    // themselves (only the surrounding block's innerText). Dump the full
    // inner HTML here so a real element-level selector can be identified
    // from an actual DEBUG=1 run, instead of guessing one.
    debugLog(debug, 'Revealed price-block HTML:', await priceBlock.innerHTML());
  }

  return text;
}

function parsePriceAndStock(rawText, debug) {
  const amounts = [...rawText.matchAll(/₹\s?([\d,]+)/g)].map(m => parseInt(m[1].replace(/,/g, ''), 10));
  if (amounts.length === 0) {
    throw new Error(`No price amount found in revealed text: "${rawText}"`);
  }

  let price;
  if (amounts.length === 1) {
    price = amounts[0];
  } else {
    // No confirmed DOM element distinguishes "original" from "current" price
    // yet, so we fall back to the observed pattern (current price is the
    // lower of the two). This is a heuristic, not a verified rule - flagged
    // loudly so a wrong extraction is visible rather than silent.
    price = Math.min(...amounts);
    log(`WARNING: multiple price amounts found (${amounts.join(', ')}) - using lowest (${price}) as current price via heuristic, not a confirmed DOM element.`);
  }

  const stockMatch = rawText.match(/(\d+)\s*(?:IN STOCK|LEFT)/i);
  if (!stockMatch) {
    throw new Error(`No stock quantity found in revealed text: "${rawText}"`);
  }
  const stock = parseInt(stockMatch[1], 10);

  if (!Number.isFinite(price) || price <= 0) throw new Error(`Price failed validation: ${price}`);
  if (!Number.isFinite(stock) || stock < 0) throw new Error(`Stock failed validation: ${stock}`);

  return { price, stock };
}

async function scrapeOnce(browser, product, debug) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT);
  await attachDiagnostics(page, debug);

  try {
    await page.goto(product.url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    await page.waitForLoadState('networkidle', { timeout: NAV_TIMEOUT }).catch(() => {
      debugLog(debug, 'networkidle timeout - continuing, page may still be usable.');
    });

    await handleCookieBanner(page, debug);
    const rawText = await activateAndReveal(page, debug);
    return parsePriceAndStock(rawText, debug);
  } finally {
    await context.close();
  }
}

/**
 * Scrapes current price and stock for a single product.
 *
 * @param {import('playwright').Browser} browser - an already-launched Playwright browser
 * @param {{ id: string|number, name: string, url: string }} product
 * @param {{ debug?: boolean, maxAttempts?: number }} [options]
 * @returns {Promise<{ productId: string|number, name: string, price: number, stock: number }>}
 */
async function scrapeProduct(browser, product, options = {}) {
  const debug = options.debug ?? (process.env.DEBUG === '1');
  const maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS;

  if (!product || !product.id || !product.url) {
    throw new Error('scrapeProduct requires product.id and product.url');
  }

  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    log(`[${product.name || product.id}] Attempt ${attempt}...`);
    try {
      const { price, stock } = await scrapeOnce(browser, product, debug);
      log(`[${product.name || product.id}] Success.`);
      return { productId: product.id, name: product.name, price, stock };
    } catch (err) {
      lastError = err;
      log(`[${product.name || product.id}] Attempt ${attempt} failed: ${err.message}`);
      if (attempt < maxAttempts) log('Retrying...');
    }
  }

  throw new Error(
    `Scraping failed for product ${product.id} (${product.name || 'unknown'}) after ${maxAttempts} attempts. Last error: ${lastError.message}`
  );
}

module.exports = { scrapeProduct };