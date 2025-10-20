import React, { useState, useEffect, useCallback, useRef } from 'react';
import { generateMessage } from './services/geminiService';
import { getStatus, sendMessages, resetSession } from './api/whatsappService';
import { Card } from './components/Card';
import { Button } from './components/Button';
import { Spinner } from './components/Spinner';
import { WhatsAppIcon, CheckCircleIcon, PaperAirplaneIcon, SparklesIcon } from './components/Icons';

enum ConnectionStatus {
  DISCONNECTED,
  CONNECTING,
  PENDING_QR_SCAN,
  CONNECTED,
  ERROR,
}

interface SendResult {
  success: number;
  failed: number;
  failedNumbers?: string[];
}

const MAX_POLL_RETRIES = 10; // سنحاول 10 مرات (حوالي 30 ثانية) قبل إعلان الفشل

const App: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [phoneNumbers, setPhoneNumbers] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [geminiPrompt, setGeminiPrompt] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('اضغط على زر "الاتصال" للبدء.');
  const [isSending, setIsSending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRetriesRef = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async () => {
    // لا داعي للاستعلام إذا كنا متصلين بالفعل أو حدث خطأ
    if (connectionStatus === ConnectionStatus.CONNECTED || connectionStatus === ConnectionStatus.ERROR) {
      stopPolling();
      return;
    }
  
    try {
      const data = await getStatus();
      pollRetriesRef.current = 0; // نجح الاتصال، أعد تعيين عداد المحاولات
  
      if (data.status === 'CONNECTED') {
        setConnectionStatus(ConnectionStatus.CONNECTED);
        setQrCode(null);
        setStatusMessage('تم الاتصال بنجاح!');
        stopPolling();
      } else if (data.status === 'PENDING_QR_SCAN') {
        // بمجرد الحصول على رمز QR، نظل في هذه الحالة حتى يتم الاتصال بنجاح
        // هذا يمنع الواجهة من الارتداد لحالة "جاري الاتصال" إذا انقطع الخادم مؤقتًا
        setConnectionStatus(ConnectionStatus.PENDING_QR_SCAN);
        setQrCode(data.qrCode);
        setStatusMessage('يرجى مسح الرمز ضوئيًا باستخدام WhatsApp.');
      } else if (connectionStatus === ConnectionStatus.CONNECTING) {
        // إذا كنا لا نزال في مرحلة الاتصال ولم يأت الرمز بعد
        setStatusMessage('في انتظار رمز QR من الخادم...');
      }
    } catch (error) {
      pollRetriesRef.current += 1;
      console.warn(` فشل الاتصال بالخادم، المحاولة رقم ${pollRetriesRef.current}`);
  
      if (pollRetriesRef.current >= MAX_POLL_RETRIES) {
        console.error('Polling error after max retries:', error);
        setStatusMessage((error as Error).message || 'فشل الاتصال بالخادم بعد عدة محاولات.');
        setConnectionStatus(ConnectionStatus.ERROR);
        stopPolling();
      }
    }
  }, [stopPolling, connectionStatus]);

  const handleConnect = async () => {
    // إعادة تعيين الحالة لبدء عملية جديدة
    setConnectionStatus(ConnectionStatus.CONNECTING);
    setStatusMessage('جاري إعادة تعيين الجلسة السابقة...');
    setSendResult(null);
    setQrCode(null);
    pollRetriesRef.current = 0;
    
    // التأكد من عدم وجود مؤقت يعمل بالفعل
    stopPolling();

    try {
      // الخطوة الجديدة: إجبار الخادم على بدء جلسة جديدة ونظيفة
      await resetSession();

      setStatusMessage('جاري الاتصال بالخادم... قد يستغرق الأمر ما يصل إلى 50 ثانية.');
      pollStatus(); // استدعاء فوري للمحاولة الأولى
      intervalRef.current = setInterval(pollStatus, 3000); // ثم البدء في الاستعلام الدوري
    } catch (error) {
      console.error('Failed to reset session:', error);
      setStatusMessage((error as Error).message || 'فشل في بدء جلسة جديدة على الخادم.');
      setConnectionStatus(ConnectionStatus.ERROR);
    }
  };
  
  useEffect(() => {
    // تنظيف المؤقت عند إغلاق المكون
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  const handleGenerateMessage = async () => {
    if (!geminiPrompt.trim()) {
      setStatusMessage('الرجاء إدخال وصف للرسالة.');
      return;
    }
    setIsGenerating(true);
    setStatusMessage('');
    setSendResult(null);
    try {
      const generated = await generateMessage(geminiPrompt);
      setMessage(generated);
    } catch (error) {
      console.error('Error generating message:', error);
      setStatusMessage((error as Error).message || 'حدث خطأ أثناء توليد الرسالة.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = async () => {
    const numbers = phoneNumbers.split('\n').map(n => n.trim()).filter(n => n !== '' && /^\d+$/.test(n));
    if (numbers.length === 0) {
      setStatusMessage('الرجاء إدخال أرقام هواتف صالحة.');
      return;
    }
    if (!message.trim()) {
      setStatusMessage('الرجاء كتابة رسالة.');
      return;
    }
    
    setIsSending(true);
    setSendResult(null);
    setStatusMessage(`جاري إرسال الرسائل إلى ${numbers.length} رقم...`);

    try {
        const result = await sendMessages(numbers, message);
        setSendResult(result);
        setStatusMessage(`اكتمل الإرسال: ${result.success} نجاح، ${result.failed} فشل.`);
        
        setTimeout(() => {
            setStatusMessage('');
            setSendResult(null);
            setPhoneNumbers('');
            setMessage('');
        }, 10000);
    } catch (error) {
        console.error('Sending error:', error);
        setStatusMessage((error as Error).message || 'حدث خطأ فادح أثناء الإرسال.');
    } finally {
        setIsSending(false);
    }
  };

  const isConnectButtonDisabled = connectionStatus === ConnectionStatus.CONNECTING || connectionStatus === ConnectionStatus.PENDING_QR_SCAN;

  return (
    <div className="bg-gray-100 min-h-screen flex items-center justify-center p-4 font-[Tahoma]">
      <div className="w-full max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800">مرسل رسائل WhatsApp الجماعية</h1>
          <p className="text-lg text-gray-600 mt-2">مدعوم بالذكاء الاصطناعي من Gemini</p>
        </header>

        <main className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Connection Card */}
          <Card>
            <h2 className="text-2xl font-semibold text-gray-700 mb-4 border-b pb-2 flex items-center gap-2">
              <WhatsAppIcon />
              الخطوة 1: الاتصال بـ WhatsApp
            </h2>
            <div className="flex flex-col items-center justify-center h-full min-h-[300px]">
              {connectionStatus !== ConnectionStatus.CONNECTED && (
                <Button onClick={handleConnect} disabled={isConnectButtonDisabled}>
                  {connectionStatus === ConnectionStatus.CONNECTING || connectionStatus === ConnectionStatus.PENDING_QR_SCAN 
                    ? <><Spinner /> جارٍ الاتصال...</> 
                    : 'الاتصال بـ WhatsApp'}
                </Button>
              )}
              {connectionStatus === ConnectionStatus.PENDING_QR_SCAN && qrCode && (
                <img src={qrCode} alt="WhatsApp QR Code" className="mt-4 border-4 border-teal-500 rounded-lg p-1" />
              )}
              {connectionStatus === ConnectionStatus.CONNECTED && (
                <div className="text-center text-green-600">
                  <CheckCircleIcon className="w-16 h-16 mx-auto" />
                  <p className="mt-4 text-xl font-semibold">متصل بنجاح!</p>
                </div>
              )}
              <p className="mt-4 text-center text-gray-600 h-10 px-2">{statusMessage}</p>
            </div>
          </Card>

          {/* Messaging Card */}
          <Card className={connectionStatus !== ConnectionStatus.CONNECTED ? 'opacity-50 pointer-events-none' : ''}>
            <h2 className="text-2xl font-semibold text-gray-700 mb-4 border-b pb-2">الخطوة 2: إعداد وإرسال الرسالة</h2>
            
            <div className="mb-4">
              <label htmlFor="phoneNumbers" className="block text-md font-medium text-gray-700 mb-2">
                أرقام الهواتف (كل رقم في سطر)
              </label>
              <textarea
                id="phoneNumbers"
                rows={5}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                value={phoneNumbers}
                onChange={(e) => setPhoneNumbers(e.target.value)}
                placeholder="201234567890&#10;201098765432"
                disabled={isSending}
              />
            </div>

            <div className="mb-4">
              <label htmlFor="geminiPrompt" className="block text-md font-medium text-gray-700 mb-2">
                توليد رسالة بالذكاء الاصطناعي (اختياري)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="geminiPrompt"
                  className="flex-grow p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                  value={geminiPrompt}
                  onChange={(e) => setGeminiPrompt(e.target.value)}
                  placeholder="مثال: عرض تهنئة بحلول عيد الفطر"
                  disabled={isGenerating || isSending}
                />
                <Button onClick={handleGenerateMessage} disabled={isGenerating || isSending} className="w-32">
                  {isGenerating ? <Spinner /> : <SparklesIcon />}
                  توليد
                </Button>
              </div>
            </div>

            <div className="mb-6">
              <label htmlFor="message" className="block text-md font-medium text-gray-700 mb-2">
                نص الرسالة
              </label>
              <textarea
                id="message"
                rows={6}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="اكتب رسالتك هنا..."
                disabled={isSending}
              />
            </div>
            
            <div className="text-left">
              <Button onClick={handleSend} disabled={isSending || !message.trim() || !phoneNumbers.trim()} className="w-full md:w-auto flex items-center justify-center gap-2">
                {isSending ? <Spinner /> : <PaperAirplaneIcon />}
                إرسال الرسائل
              </Button>
            </div>
            
            {sendResult && sendResult.failed > 0 && (
              <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
                <p className="font-bold mb-2">فشل الإرسال إلى الأرقام التالية:</p>
                <ul className="list-disc list-inside">
                  {sendResult.failedNumbers?.map(num => <li key={num}>{num}</li>)}
                </ul>
              </div>
            )}

          </Card>
        </main>
      </div>
    </div>
  );
};

export default App;