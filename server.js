
// server.js
// هذا الملف هو الواجهة الخلفية التي ستعمل على منصة Render

const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { GoogleGenAI } = require('@google/genai');
const qrcode = require('qrcode');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// نقطة نهاية بسيطة للتحقق من أن الخادم يعمل ومتاح
app.get('/', (req, res) => {
  res.status(200).send('WhatsApp Backend Server is running and reachable!');
});

// التحقق من وجود مفتاح API الخاص بـ Gemini
if (!process.env.API_KEY) {
  console.error("API_KEY for Gemini is not set in environment variables.");
  process.exit(1);
}
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// متغيرات لتخزين حالة الاتصال ورمز QR
let connectionStatus = 'DISCONNECTED';
let qrCodeDataUrl = null;
let client;

// دالة مركزية لإنشاء وتهيئة عميل WhatsApp جديد
function initializeClient() {
  console.log('Initializing a new WhatsApp client instance...');
  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true, // تأكد من تشغيله في وضع headless على الخادم
    },
  });

  client.on('qr', async (qr) => {
    console.log('QR RECEIVED');
    connectionStatus = 'PENDING_QR_SCAN';
    qrCodeDataUrl = await qrcode.toDataURL(qr);
  });

  client.on('ready', () => {
    console.log('Client is ready!');
    connectionStatus = 'CONNECTED';
    qrCodeDataUrl = null;
  });

  client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
    connectionStatus = 'DISCONNECTED';
    qrCodeDataUrl = null;
    // لا تقم بإعادة التهيئة هنا لتجنب المشاكل، دع التحكم للمستخدم عبر /reset
  });

  client.on('auth_failure', (msg) => {
    console.error('AUTHENTICATION FAILURE', msg);
    connectionStatus = 'ERROR';
    qrCodeDataUrl = null;
  });

  console.log('Starting client initialization...');
  client.initialize().catch(err => {
    console.error('Client initialization failed:', err);
    connectionStatus = 'ERROR';
  });
}

// ---- ENDPOINTS API ----

// نقطة نهاية محسّنة لإعادة تعيين جلسة العميل
app.post('/reset', async (req, res) => {
  console.log('Received request to reset client session.');
  connectionStatus = 'CONNECTING'; // تحديث الحالة فورًا
  qrCodeDataUrl = null;

  try {
    if (client) {
      console.log('Destroying previous client instance...');
      await client.destroy();
      console.log('Previous client instance destroyed.');
    }
  } catch (error) {
    console.warn('Error destroying client, it might have been already down. Continuing with re-initialization.', error.message);
  } finally {
    initializeClient(); // إنشاء وتهيئة عميل جديد ونظيف
    res.status(200).json({ message: 'Client session reset initiated.' });
  }
});

// 1. نقطة نهاية لجلب حالة الاتصال
app.get('/status', (req, res) => {
  res.json({
    status: connectionStatus,
    qrCode: qrCodeDataUrl,
  });
});

// 2. نقطة نهاية لتوليد رسالة باستخدام Gemini AI
app.post('/generate-message', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are an expert copywriter. Your task is to write a short, friendly, and engaging WhatsApp message in Arabic based on the user\'s request. The message should be concise and ready to be sent.',
        temperature: 0.7,
        topP: 0.95,
      },
    });
    res.json({ message: response.text });
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    res.status(500).json({ error: 'Failed to generate message from Gemini API.' });
  }
});

// 3. نقطة نهاية لإرسال الرسائل
app.post('/send', async (req, res) => {
  const { numbers, message } = req.body;

  if (connectionStatus !== 'CONNECTED') {
    return res.status(400).json({ error: 'WhatsApp client is not connected.' });
  }

  if (!numbers || !message || !Array.isArray(numbers) || numbers.length === 0) {
    return res.status(400).json({ error: 'Numbers array and message are required.' });
  }

  let successCount = 0;
  let failedCount = 0;
  const failedNumbers = [];

  for (const number of numbers) {
    try {
      const chatId = `${number.trim()}@c.us`;
      await client.sendMessage(chatId, message);
      successCount++;
    } catch (error) {
      console.error(`Failed to send message to ${number}:`, error.message);
      failedCount++;
      failedNumbers.push(number);
    }
  }

  res.json({
    success: successCount,
    failed: failedCount,
    failedNumbers: failedNumbers,
  });
});


// بدء تشغيل الخادم والعميل لأول مرة
app.listen(port, () => {
  console.log(`WhatsApp backend server listening on port ${port}`);
  initializeClient(); // تهيئة العميل عند بدء تشغيل الخادم
});
