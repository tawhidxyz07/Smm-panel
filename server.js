const express = require('express');
const app = express();

// SMM Panel গুলো সাধারণত JSON অথবা URL-encoded ফর্ম্যাটে ডেটা পাঠায়
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ১. Mock Database (বাস্তবে এগুলো MongoDB বা MySQL-এ থাকবে)
const users = {
    "TAWHID_SECRET_API_KEY_2026": { balance: 50.00, currency: "USD" } // আপনার কাস্টমারের API Key ও ব্যালেন্স
};

const orders = {}; // অর্ডার হিস্ট্রি সেভ রাখার জন্য
let orderCounter = 5000; // অর্ডার আইডি এখান থেকে শুরু হবে

// ২. Main SMM API Endpoint
app.post('/api/v2', (req, res) => {
    const { key, action, service, link, quantity, order } = req.body;

    // Authentication: API Key চেক করা
    if (!key || !users[key]) {
        return res.json({ error: "Invalid API key" });
    }

    const user = users[key];

    // Action 1: Balance Check (রিসেলার প্যানেল আপনার কাছে তাদের ব্যালেন্স চেক করবে)
    if (action === 'balance') {
        return res.json({ 
            balance: user.balance.toString(), 
            currency: user.currency 
        });
    }

    // Action 2: Add Order (রিসেলার প্যানেল নতুন ফলোয়ারের অর্ডার পাঠাবে)
    if (action === 'add') {
        if (!service || !link || !quantity) {
            return res.json({ error: "Missing parameters (service, link, quantity)" });
        }

        const qty = parseInt(quantity);
        const pricePer1k = 0.50; // প্রতি ১০০০ ফলোয়ারের দাম (0.50 USD)
        const cost = (qty / 1000) * pricePer1k;

        // ব্যালেন্স চেক
        if (user.balance < cost) {
            return res.json({ error: "Insufficient balance" });
        }

        // কাস্টমারের ব্যালেন্স থেকে টাকা কেটে নেওয়া
        user.balance -= cost;

        // নতুন অর্ডার তৈরি করা
        orderCounter++;
        orders[orderCounter] = {
            status: "Pending",
            charge: cost.toString(),
            start_count: "0",
            remains: qty.toString(),
            currency: "USD",
            link: link
        };

        /* 
          [!] এখানে আপনার অটোমেশন স্ক্রিপ্ট কল করবেন! 
          যেমন: startFacebookFollowerBot(link, qty); 
        */
        console.log(`[+] New Order Received: ID ${orderCounter} | Link: ${link} | Qty: ${qty}`);

        // কাস্টমারকে অর্ডারের কনফার্মেশন পাঠানো
        return res.json({ order: orderCounter });
    }

    // Action 3: Check Status (রিসেলার প্যানেল অর্ডারের অবস্থা জানতে চাইবে)
    if (action === 'status') {
        if (!order || !orders[order]) {
            return res.json({ error: "Order not found" });
        }
        return res.json(orders[order]);
    }

    // ইনভ্যালিড অ্যাকশন
    return res.json({ error: "Invalid action" });
});

// সার্ভার চালু করা
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`===========================================`);
    console.log(`SMM Provider API Running on port ${PORT}`);
    console.log(`Endpoint: http://localhost:${PORT}/api/v2`);
    console.log(`===========================================`);
});
