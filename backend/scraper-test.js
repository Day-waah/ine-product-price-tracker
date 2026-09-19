const { chromium } = require('playwright');
const { scrapeProduct } = require('./scraper.service');

// Usage:
//   node test-scraper.js <id> <url> ["Product Name"]
//
// Example:
//   node test-scraper.js 50 https://demo.inelabteamdev.com/product/50 "Auralite Smart Bulb Pro"
//
// If no arguments are given, falls back to product 50 as a default.

function parseArgs() {
  const [id, url, name] = process.argv.slice(2);

  if (!id || !url) {
    console.log('No product given on the command line - using default product 50.\n');
    return {
      id: 50,
      name: 'Auralite Smart Bulb Pro',
      url: 'https://demo.inelabteamdev.com/product/50',
    };
  }

  return {
    id: isNaN(Number(id)) ? id : Number(id),
    name: name || `Product ${id}`,
    url,
  };
}

async function main() {
  const product = parseArgs();
  console.log('Scraping:', product);

  const browser = await chromium.launch({ headless: false });

  try {
    const result = await scrapeProduct(browser, product, {
      debug: process.env.DEBUG === '1',
    });
    console.log('\nResult:');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('\nFinal failure:', err.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();