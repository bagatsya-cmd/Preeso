const nodemailer = require('nodemailer');
const User = require('../models/User');
const Product = require('../models/product');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

exports.checkAlerts = async () => {
  try {
    const users = await User.find({ 'alerts.0': { $exists: true } }).populate('alerts.productId');
    for (const user of users) {
      for (const alert of user.alerts) {
        if (alert.triggered) continue;
        const product = await Product.findById(alert.productId);
        if (!product) continue;
        const stores = product.stores || [];
        const targetStore = alert.storeName
          ? stores.find(s => s.storeName === alert.storeName)
          : stores.reduce((a, b) => (a.price < b.price ? a : b), stores[0]);
        if (!targetStore) continue;
        if (targetStore.price <= alert.targetPrice) {
          if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            await transporter.sendMail({
              to: user.email,
              subject: `🔔 Preeso: Price Drop Alert for ${product.name}!`,
              html: `
                <div style="font-family:sans-serif;max-width:500px;margin:auto">
                  <h2 style="color:#6366f1">🎉 Price Drop!</h2>
                  <p><strong>${product.name}</strong> is now <strong>₹${targetStore.price.toLocaleString()}</strong> on <strong>${targetStore.storeName}</strong>.</p>
                  <p>Your target price was ₹${alert.targetPrice.toLocaleString()}.</p>
                  <a href="${targetStore.link}" style="background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:12px">Buy Now on ${targetStore.storeName}</a>
                  <p style="color:#888;font-size:12px;margin-top:20px">You set this alert on Preeso.</p>
                </div>`
            });
          }
          alert.triggered = true;
        }
      }
      await user.save();
    }
  } catch (err) {
    console.error('Alert check error:', err);
  }
};