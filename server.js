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
app.use(cors()); // السماح بالطلبات من الواجهة الأمامية
app.use(bodyParser.json());

// التحقق من وجود مفتاح API الخاص بـ Gemini
if (!process.env.API_KEY) {
  console.error("API_KEY for Gemini is not set in environment variables.");
  process.exit(1); // إيقاف الخادم إذا لم يكن المفتاح موجودًا
}
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// إعداد عميل WhatsApp
const client = new Client({
  authStrategy: new LocalAuth(),
  // خاصية puppeteer ضرورية للعمل على Render
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

// متغيرات لتخزين حالة الاتصال ورمز QR
let connectionStatus = 'DISCONNECTED';
let qrCodeDataUrl = null;

client.on('qr', async (qr) => {
  console.log('QR RECEIVED');
  connectionStatus = 'PENDING_QR_SCAN';
  // تحويل نص QR إلى صورة بتشفير base64 ليتم عرضها في المتصفح
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
  // إعادة تشغيل العميل لمحاولة الاتصال مجددًا
  client.initialize();
});

client.initialize();

// ---- ENDPOINTS API ----

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
      contents: prompt, // إرسال طلب المستخدم مباشرة
      config: {
        // استخدام تعليمات النظام لتوجيه النموذج بشكل أفضل
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
      // تنسيق الرقم ليكون متوافقًا مع WhatsApp (e.g., '201234567890@c.us')
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

app.listen(port, () => {
  console.log(`WhatsApp backend server listening on port ${port}`);
});
