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

app.get('/', (req, res) => {
  res.status(200).send('WhatsApp Backend Server is running and reachable!');
});

if (!process.env.API_KEY) {
  console.error("API_KEY for Gemini is not set in environment variables.");
  process.exit(1);
}
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

let client;
let qrCodeDataUrl = null;
let isInitializing = false;
let serverLogs = [];

const addLog = (message) => {
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'UTC' });
  const logMessage = `[${timestamp} UTC] ${message}`;
  console.log(logMessage);
  serverLogs.unshift(logMessage);
  if (serverLogs.length > 20) {
    serverLogs.pop();
  }
};

// الدالة المركزية والوحيدة لإدارة وتشغيل عميل WhatsApp
async function startWhatsAppClient() {
  if (client || isInitializing) {
    addLog('Start request ignored: Client is already running or initializing.');
    return;
  }

  addLog('Attempting to initialize a new WhatsApp client...');
  isInitializing = true;
  qrCodeDataUrl = null;

  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
    },
  });

  client.on('qr', async (qr) => {
    addLog('QR Code received. Waiting for scan.');
    qrCodeDataUrl = await qrcode.toDataURL(qr);
  });

  client.on('ready', () => {
    addLog('Client is ready! Connection successful.');
    qrCodeDataUrl = null;
    isInitializing = false;
  });

  client.on('disconnected', async (reason) => {
    addLog(`Client disconnected. Reason: ${reason}. Destroying instance and attempting to restart.`);
    if (client) {
      await client.destroy().catch(e => addLog(`Error destroying client on disconnect: ${e.message}`));
    }
    client = null;
    isInitializing = false;
    qrCodeDataUrl = null;
    // سنقوم بإعادة التشغيل تلقائيًا عند الطلب التالي لـ /status
  });

  client.on('auth_failure', async (msg) => {
    addLog(`Authentication Failure: ${msg}. Session is invalid. Destroying instance.`);
    if (client) {
        await client.destroy().catch(e => addLog(`Error destroying client on auth_failure: ${e.message}`));
    }
    client = null;
    isInitializing = false;
    qrCodeDataUrl = null;
  });

  try {
    await client.initialize();
  } catch (err) {
    addLog(`FATAL: Client initialization failed: ${err.message}`);
    if (client) {
      await client.destroy().catch(e => addLog(`Error destroying client after init fail: ${e.message}`));
    }
    client = null;
    isInitializing = false;
  }
}

// ---- ENDPOINTS API ----

// نقطة النهاية /status أصبحت الآن "ذكية" وتقوم بالإصلاح الذاتي
app.get('/status', async (req, res) => {
    // الأولوية 1: إذا كان العميل موجودًا، تحقق من حالته الحقيقية أولاً.
    if (client) {
        try {
            const state = await client.getState();
            if (state === 'CONNECTED') {
                // آلية أمان: إذا كان متصلاً، تأكد من مسح رمز QR وأبلغ الواجهة بالحقيقة.
                if (qrCodeDataUrl) {
                    addLog('Failsafe triggered: Client is CONNECTED but QR was still present. Clearing QR.');
                    qrCodeDataUrl = null;
                }
                return res.json({ status: 'CONNECTED', qrCode: null, logs: serverLogs });
            }
        } catch (error) {
            addLog(`Health check failed: ${error.message}. Client presumed dead.`);
            client = null;
            isInitializing = false;
            qrCodeDataUrl = null; // تأكد من التنظيف
            return res.json({ status: 'ERROR', qrCode: null, logs: serverLogs });
        }
    }

    // إذا وصلنا إلى هنا، فالعميل ليس في حالة "CONNECTED"
    // الأولوية 2: إذا كان هناك رمز QR جاهز، أرسله.
    if (qrCodeDataUrl) {
        return res.json({ status: 'PENDING_QR_SCAN', qrCode: qrCodeDataUrl, logs: serverLogs });
    }

    // الأولوية 3: إذا كانت العملية قيد التهيئة (لكن لا يوجد عميل أو QR بعد)، أبلغ بذلك.
    if (isInitializing) {
        return res.json({ status: 'CONNECTING', qrCode: null, logs: serverLogs });
    }

    // الأولوية 4: إذا لم يكن هناك شيء يحدث على الإطلاق، ابدأ العملية.
    if (!client && !isInitializing) {
        startWhatsAppClient();
        return res.json({ status: 'INITIALIZING', qrCode: null, logs: serverLogs });
    }

    // حالة احتياطية: لا ينبغي الوصول إليها عادةً.
    return res.json({ status: 'DISCONNECTED', qrCode: null, logs: serverLogs });
});


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
      },
    });
    addLog('AI message generated successfully.');
    res.json({ message: response.text });
  } catch (error) {
    addLog(`Error calling Gemini API: ${error.message}`);
    res.status(500).json({ error: 'Failed to generate message from Gemini API.' });
  }
});

app.post('/send', async (req, res) => {
  const { numbers, message } = req.body;
  if (!client) {
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

app.listen(port, () => {
  console.log(`WhatsApp backend server listening on port ${port}`);
  startWhatsAppClient(); // تهيئة العميل عند بدء تشغيل الخادم لأول مرة
});