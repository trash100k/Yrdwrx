const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('LOG:', msg.text()));
  page.on('pageerror', err => console.log('ERR:', err.message));

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  
  for(let i=0; i<10; i++) {
    await new Promise(r => setTimeout(r, 500));
    const rootHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML || 'NO_ROOT');
    console.log(`[${i*500}ms] root HTML length:`, rootHtml.length, rootHtml.substring(0, 100));
  }

  await browser.close();
})().catch(console.error);
