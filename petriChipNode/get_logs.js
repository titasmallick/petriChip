const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));
    
    await page.goto('http://localhost:3000/index_v3.html');
    await new Promise(r => setTimeout(r, 2000));
    await browser.close();
})();
