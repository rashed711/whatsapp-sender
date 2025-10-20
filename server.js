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

// متغيرات لتخزين الحالة (الآن أقل اعتمادًا على المتغيرات اليدوية)
let client;
let qrCodeDataUrl = null;
let serverLogs = [];

// دالة لإضافة سجلات مع طابع زمني
const addLog = (message) => {
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'UTC' });
  const logMessage = `[${timestamp} UTC] ${message}`;
  console.log(logMessage);
  serverLogs.unshift(logMessage); // Add to the beginning
  if (serverLogs.length > 15) {
    serverLogs.pop(); // Keep only the last 15 logs
  }
};

// دالة مركزية لإنشاء وتهيئة عميل WhatsApp جديد
function initializeClient() {
  addLog('Creating and initializing a new WhatsApp client instance...');
  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
    },
  });

  // مسح رمز QR القديم عند بدء تهيئة جديدة
  qrCodeDataUrl = null;

  client.on('qr', async (qr) => {
    addLog('QR Code Received. Please scan.');
    qrCodeDataUrl = await qrcode.toDataURL(qr);
  });

  client.on('ready', () => {
    addLog('Client is ready! Connection established.');
    qrCodeDataUrl = null; // لم نعد بحاجة لرمز QR بعد الآن
  });

  client.on('disconnected', (reason) => {
    addLog(`Client was logged out. Reason: ${reason}. Please reconnect.`);
    qrCodeDataUrl = null;
    client = null; // تدمير مرجع العميل لضمان إنشاء واحد جديد
  });

  client.on('auth_failure', (msg) => {
    addLog(`Authentication Failure: ${msg}. Session is invalid.`);
  });

  client.initialize().catch(err => {
    addLog(`FATAL: Client initialization failed: ${err.message}`);
  });
}

// ---- ENDPOINTS API ----

app.post('/reset', async (req, res) => {
  addLog('Received request to reset client session.');
  if (client) {
    try {
      addLog('Destroying previous client instance...');
      await client.destroy();
      addLog('Previous client instance destroyed.');
    } catch (error) {
      addLog(`Warning: Error destroying client. It might have already been down. ${error.message}`);
    } finally {
      client = null;
      qrCodeDataUrl = null;
    }
  }
  initializeClient();
  res.status(200).json({ message: 'Client session reset initiated.' });
});

// نقطة نهاية للحالة تعتمد على المصدر الموثوق
app.get('/status', async (req, res) => {
  if (!client) {
    return res.json({ status: 'DISCONNECTED', qrCode: null, logs: serverLogs });
  }

  try {
    const state = await client.getState();
    if (state === 'CONNECTED') {
      return res.json({ status: 'CONNECTED', qrCode: null, logs: serverLogs });
    } else if (qrCodeDataUrl) {
      return res.json({ status: 'PENDING_QR_SCAN', qrCode: qrCodeDataUrl, logs: serverLogs });
    } else {
      return res.json({ status: 'CONNECTING', qrCode: null, logs: serverLogs });
    }
  } catch (error) {
    addLog(`Client state check failed: ${error.message}. Client is likely down or uninitialized.`);
    return res.json({ status: 'ERROR', qrCode: null, logs: serverLogs });
  }
});


// نقطة نهاية لتوليد رسالة باستخدام Gemini AI
app.post('/generate-message', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  addLog('Generating AI message...');
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
    addLog('AI message generated successfully.');
    res.json({ message: response.text });
  } catch (error) {
    addLog(`Error calling Gemini API: ${error.message}`);
    res.status(500).json({ error: 'Failed to generate message from Gemini API.' });
  }
});

// نقطة نهاية لإرسال الرسائل مع فحص صحة إجباري
app.post('/send', async (req, res) => {
  const { numbers, message } = req.body;

  // --- فحص الصحة الإجباري ---
  if (!client) {
    addLog('Send failed: Client does not exist.');
    return res.status(400).json({ error: 'عميل WhatsApp غير مهيأ. يرجى الاتصال أولاً.' });
  }
  try {
    const currentState = await client.getState();
    if (currentState !== 'CONNECTED') {
      const errorMsg = `عميل WhatsApp ليس جاهزًا. الحالة الحالية: ${currentState || 'غير معروف'}`;
      addLog(`Send failed: ${errorMsg}`);
      return res.status(400).json({ error: errorMsg });
    }
  } catch (error) {
    const errorMsg = 'تعذر التحقق من حالة اتصال WhatsApp. قد تكون الخدمة قيد إعادة التشغيل.';
    addLog(`Send failed: ${errorMsg} - ${error.message}`);
    return res.status(500).json({ error: errorMsg });
  }
  // --- نهاية فحص الصحة ---

  if (!numbers || !message || !Array.isArray(numbers) || numbers.length === 0) {
    return res.status(400).json({ error: 'مصفوفة الأرقام والرسالة مطلوبة.' });
  }
  
  addLog(`Sending message to ${numbers.length} numbers...`);
  let successCount = 0;
  let failedCount = 0;
  const failedNumbers = [];

  for (const number of numbers) {
    try {
      const chatId = `${number.trim()}@c.us`;
      await client.sendMessage(chatId, message);
      successCount++;
    } catch (error) {
      addLog(`Failed to send message to ${number}: ${error.message}`);
      failedCount++;
      failedNumbers.push(number);
    }
  }
  
  addLog(`Sending complete. Success: ${successCount}, Failed: ${failedCount}.`);
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
