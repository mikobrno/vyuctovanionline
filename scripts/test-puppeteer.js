
const puppeteer = require('puppeteer');

(async () => {
    try {
        console.log('Launching browser...');
        const browser = await puppeteer.launch();
        console.log('Browser launched.');
        const page = await browser.newPage();
        console.log('Page created.');
        await page.setContent('<h1>Hello World</h1>');
        console.log('Content set.');
        await page.pdf({ path: 'test_simple.pdf' });
        console.log('PDF generated.');
        await browser.close();
        console.log('Success.');
    } catch (e) {
        console.error(e);
    }
})();
