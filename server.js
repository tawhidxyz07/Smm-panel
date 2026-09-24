const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/start-auto-page', async (req, res) => {
    const { email, password, targetFollowLink, numberOfPages } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'FB ID & Password required!' });
    }

    res.json({ success: true, message: 'Background Bot Started on Render Cloud!' });

    (async () => {
        console.log(`[+] Bot Starting for ID: ${email}`);
        
        // Render-এর জন্য জরুরি ব্রাউজার সেটিংস
        const browser = await chromium.launch({ 
            headless: true, 
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ] 
        });
        
        const context = await browser.newContext();
        const page = await context.newPage();

        try {
            console.log('[+] Logging into Facebook...');
            await page.goto('https://www.facebook.com/');
            await page.fill('#email', email);
            await page.fill('#pass', password);
            await page.click('button[name="login"]');
            await page.waitForTimeout(10000);

            const count = parseInt(numberOfPages) || 5;

            for (let i = 0; i < count; i++) {
                console.log(`[+] Creating Page ${i + 1} of ${count}`);
                await page.goto('https://www.facebook.com/pages/create');
                await page.waitForTimeout(5000);

                const pageName = `Auto Brand ${Math.floor(10000 + Math.random() * 90000)}`;
                await page.fill('label[aria-label="Page name"] input', pageName);
                await page.fill('label[aria-label="Category"] input', 'Digital Creator');
                await page.keyboard.press('Enter');
                await page.waitForTimeout(3000);

                await page.click('div[aria-label="Create Page"]');
                await page.waitForTimeout(15000);

                console.log(`[+] Page Created! URL: ${page.url()}`);

                if (targetFollowLink) {
                    try {
                        await page.goto(targetFollowLink);
                        await page.waitForTimeout(5000);
                        const followBtn = await page.locator('div[aria-label="Follow"]').first();
                        if (await followBtn.isVisible()) {
                            await followBtn.click();
                            console.log('[+] Auto Follow Success!');
                        }
                    } catch (e) {
                        console.log('[-] Follow Error:', e.message);
                    }
                }

                await page.waitForTimeout(120000); // 2 min pause
            }
        } catch (err) {
            console.error('[-] BOT ERROR:', err.message);
        } finally {
            await browser.close();
        }
    })();
});

// Render-এর ডাইনামিক পোর্ট ধরা
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API Server is running on port ${PORT}`);
});
