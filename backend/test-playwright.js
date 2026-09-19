const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    headless: false
  });

  const page = await browser.newPage();

  await page.goto("https://demo.inelabteamdev.com/", {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });

  console.log("Page title:", await page.title());

  await page.waitForTimeout(5000);

  await browser.close();
})();