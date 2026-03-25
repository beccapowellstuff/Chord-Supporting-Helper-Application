const { chromium, firefox, webkit } = require('playwright');

const browserType = process.argv[2] || 'chromium';

(async () => {
  let browserLauncher;

  if (browserType === 'firefox') browserLauncher = firefox;
  else if (browserType === 'webkit') browserLauncher = webkit;
  else browserLauncher = chromium;

  const browser = await browserLauncher.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('http://127.0.0.1:5500/index.html');

})();