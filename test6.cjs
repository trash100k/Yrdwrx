const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('LOG:', msg.text()));
  page.on('pageerror', err => console.log('ERR:', err.message));

  // let's inject local storage for demo mode to simulate logging in
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('cutty-demo-mode', 'active');
  });
  
  // since demo mode is active, App.tsx should redirect to dashboard
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' });
  
  await new Promise(r => setTimeout(r, 2000));
  const rootHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML || 'NO_ROOT');
  require('fs').writeFileSync('root_output.html', rootHtml);
  console.log('Saved to root_output.html. Length:', rootHtml.length);
  await browser.close();
})().catch(console.error);
