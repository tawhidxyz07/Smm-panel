const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// অটো পেজ বানানোর API
app.post('/api/start-auto-page', async (req, res) => {
    const { email, password, targetFollowLink, numberOfPages } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'FB ID & Password required!' });
    }

    // ফ্রন্টএন্ডে সাথে সাথে রেসপন্স দিয়ে দেওয়া, যাতে ব্রাউজার লোডিংয়ে আটকে না থাকে
    res.json({ success: true, message: 'Background Bot Started! It will auto-create pages now.' });

    // ব্যাকগ্রাউন্ডে অটোমেশন প্রসেস শুরু
    (async () => {
        console.log(`[+] Bot Starting for ID: ${email}`);
        
        // Headless: false দিলে আপনার পিসিতে ব্রাউজার ওপেন হয়ে কাজ করা দেখতে পাবেন। 
        // সার্ভারে হোস্ট করলে headless: true করে দেবেন।
        const browser = await chromium.launch({ headless: false, args: ['--disable-notifications'] });
        const context = await browser.newContext();
        const page = await context.newPage();

        try {
            // স্টেপ ১: আপনার আইডিতে লগইন করা
            console.log('[+] Logging into Facebook...');
            await page.goto('https://www.facebook.com/');
            await page.fill('#email', email);
            await page.fill('#pass', password);
            await page.click('button[name="login"]');
            await page.waitForTimeout(10000); // লগইন হওয়ার জন্য ১০ সেকেন্ড অপেক্ষা

            const count = parseInt(numberOfPages) || 5;

            // স্টেপ ২: অটোমেটিক লুপের মাধ্যমে পেজ তৈরি করা
            for (let i = 0; i < count; i++) {
                console.log(`\n[+] ---> Creating Page ${i + 1} of ${count} <---`);
                
                // পেজ ক্রিয়েট লিঙ্কে যাওয়া
                await page.goto('https://www.facebook.com/pages/create');
                await page.waitForTimeout(5000);

                // পেজের নাম ও ক্যাটাগরি দেওয়া
                const pageName = `Auto Brand ${Math.floor(10000 + Math.random() * 90000)}`;
                await page.fill('label[aria-label="Page name"] input', pageName);
                await page.fill('label[aria-label="Category"] input', 'Digital Creator');
                await page.keyboard.press('Enter');
                await page.waitForTimeout(3000);

                // Create Page বাটনে ক্লিক করা
                console.log('[+] Clicking Create Page...');
                await page.click('div[aria-label="Create Page"]');
                await page.waitForTimeout(15000); // পেজ সেভ হতে সময় লাগে

                console.log(`[+] Page Created! URL: ${page.url()}`);

                // স্টেপ ৩: অটো ফলো দেওয়া
                if (targetFollowLink) {
                    try {
                        console.log(`[+] Going to target to auto-follow: ${targetFollowLink}`);
                        await page.goto(targetFollowLink);
                        await page.waitForTimeout(5000);
                        
                        // Follow বাটনে ক্লিক করা
                        const followBtn = await page.locator('div[aria-label="Follow"]').first();
                        if (await followBtn.isVisible()) {
                            await followBtn.click();
                            console.log('[+] Auto Follow Success!');
                        } else {
                            console.log('[-] Follow button not found (Maybe already followed).');
                        }
                    } catch (e) {
                        console.log('[-] Auto Follow Error: ', e.message);
                    }
                }

                // স্টেপ ৪: অটো পোস্ট করা (অপশনাল)
                try {
                    await page.goto('https://www.facebook.com/'); // হোমে ফিরে পোস্ট করা
                    await page.waitForTimeout(4000);
                    await page.click('div[role="button"]:has-text("What\'s on your mind?")');
                    await page.waitForTimeout(2000);
                    await page.fill('div[role="textbox"]', `Hello everyone! This is my new page ${pageName}. Keep following!`);
                    await page.click('div[aria-label="Post"]');
                    console.log('[+] Auto Post Published!');
                    await page.waitForTimeout(5000);
                } catch (e) {
                    console.log('[-] Auto Post Failed.');
                }

                // [অত্যন্ত জরুরি] ফেসবুক যেন আইডি ব্লক না করে তাই পরবর্তী পেজ বানানোর আগে ২ মিনিট পজ
                console.log('[+] Sleeping for 2 minutes before making the next page...');
                await page.waitForTimeout(120000); 
            }
            
            console.log('\n[+] ========== ALL PAGES CREATED SUCCESSFULLY ==========');

        } catch (err) {
            console.error('[-] BOT CRASHED:', err.message);
        } finally {
            await browser.close();
        }
    })();
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`API Server is running on http://localhost:${PORT}`);
});
