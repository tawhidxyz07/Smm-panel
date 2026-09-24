const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { chromium } = require('playwright');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Helper function: লাইভ স্ক্রিনশট ফ্রন্টএন্ডে পাঠানো
async function sendScreenshot(page, socket) {
    try {
        const buffer = await page.screenshot({ type: 'jpeg', quality: 60 });
        const base64Image = buffer.toString('base64');
        socket.emit('preview-frame', `data:image/jpeg;base64,${base64Image}`);
    } catch (e) {
        // Ignored if page closes
    }
}

io.on('connection', (socket) => {
    console.log('[+] Client connected for Live Preview:', socket.id);

    socket.on('start-automation', async (data) => {
        const { email, password, targetFollowLink, numberOfPages } = data;

        const log = (msg) => {
            console.log(msg);
            socket.emit('bot-log', msg);
        };

        log('[+] Command Received. Initializing Browser...');

        let browser;
        try {
            browser = await chromium.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu'
                ]
            });

            const context = await browser.newContext({
                viewport: { width: 1280, height: 720 }
            });
            const page = await context.newPage();

            // STEP 1: Facebook-এ যাওয়া
            log('[+] Navigating to Facebook.com...');
            await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded' });
            await sendScreenshot(page, socket);

            // STEP 2: Login Data দেওয়া
            log('[+] Typing Email and Password...');
            await page.fill('#email', email);
            await page.fill('#pass', password);
            await sendScreenshot(page, socket);

            log('[+] Clicking Login Button...');
            await page.click('button[name="login"]');
            await page.waitForTimeout(6000);
            await sendScreenshot(page, socket);

            // Login Checkpoint Verification
            const currentUrl = page.url();
            log(`[+] Current URL: ${currentUrl}`);

            if (currentUrl.includes('checkpoint') || currentUrl.includes('two_factor')) {
                log('[-] ALERT: Facebook Security Checkpoint / 2FA Blocked the login!');
                log('[-] Solution: Login manually once from a desktop/browser or check email.');
                await sendScreenshot(page, socket);
                await browser.close();
                return;
            }

            const count = parseInt(numberOfPages) || 3;

            // STEP 3: Auto Page Creation Loop
            for (let i = 0; i < count; i++) {
                log(`\n[+] === Creating Page ${i + 1} of ${count} ===`);
                await page.goto('https://www.facebook.com/pages/create', { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(4000);
                await sendScreenshot(page, socket);

                const pageName = `Auto Brand ${Math.floor(10000 + Math.random() * 90000)}`;
                log(`[+] Setting Page Name: ${pageName}`);
                await page.fill('label[aria-label="Page name"] input', pageName);
                await page.fill('label[aria-label="Category"] input', 'Digital Creator');
                await page.keyboard.press('Enter');
                await page.waitForTimeout(2000);
                await sendScreenshot(page, socket);

                log('[+] Submitting Page Creation Form...');
                await page.click('div[aria-label="Create Page"]');
                await page.waitForTimeout(12000);
                await sendScreenshot(page, socket);

                log(`[+] Page Created Successfully!`);

                // STEP 4: Auto Follow Target
                if (targetFollowLink) {
                    try {
                        log(`[+] Navigating to Target Link: ${targetFollowLink}`);
                        await page.goto(targetFollowLink, { waitUntil: 'domcontentloaded' });
                        await page.waitForTimeout(4000);
                        await sendScreenshot(page, socket);

                        const followBtn = page.locator('div[aria-label="Follow"]').first();
                        if (await followBtn.isVisible()) {
                            await followBtn.click();
                            log('[+] Auto Follow Clicked!');
                            await page.waitForTimeout(2000);
                            await sendScreenshot(page, socket);
                        } else {
                            log('[-] Follow button not visible.');
                        }
                    } catch (e) {
                        log(`[-] Follow Error: ${e.message}`);
                    }
                }

                log('[+] Pausing 1 Minute before next page...');
                await page.waitForTimeout(60000);
            }

            log('\n[+] ALL PROCESS COMPLETED SUCCESSFULLY!');

        } catch (err) {
            log(`[-] CRITICAL ERROR: ${err.message}`);
        } finally {
            if (browser) await browser.close();
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Live Server running on port ${PORT}`);
});
