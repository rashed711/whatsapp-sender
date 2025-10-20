import React, { useState, useEffect, useCallback, useRef } from 'react';
import { generateMessage } from './services/geminiService';
import { getStatus, sendMessages } from './api/whatsappService';
import { Card } from './components/Card';
import { Button } from './components/Button';
import { Spinner } from './components/Spinner';
import { WhatsAppIcon, CheckCircleIcon, PaperAirplaneIcon, SparklesIcon } from './components/Icons';

enum ConnectionStatus {
  DISCONNECTED,
  INITIALIZING,
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

const MAX_POLL_RETRIES = 12; // سنحاول 12 مرات (حوالي 36 ثانية)

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
  const [serverLogs, setServerLogs] = useState<string[]>([]);
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRetriesRef = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async () => {
    try {
      const data = await getStatus();
      pollRetriesRef.current = 0; // Reset retries on successful fetch
  
      if (data.logs) {
        setServerLogs(data.logs);
      }

      switch (data.status) {
        case 'CONNECTED':
          setConnectionStatus(ConnectionStatus.CONNECTED);
          setQrCode(null);
          setStatusMessage('تم الاتصال بنجاح!');
          stopPolling();
          break;
        case 'PENDING_QR_SCAN':
          setConnectionStatus(ConnectionStatus.PENDING_QR_SCAN);
          setQrCode(data.qrCode);
          setStatusMessage('يرجى مسح الرمز ضوئيًا باستخدام WhatsApp.');
          break;
        case 'CONNECTING':
        case 'INITIALIZING':
          setConnectionStatus(ConnectionStatus.CONNECTING);
          setStatusMessage('جاري تهيئة الاتصال على الخادم، يرجى الانتظار...');
          break;
        case 'ERROR':
            setConnectionStatus(ConnectionStatus.ERROR);
            setStatusMessage('حدث خطأ في الخادم. قد يحاول إعادة التشغيل تلقائيًا.');
            // لا نوقف الاستعلام هنا، لنرى إذا كان الخادم سيصلح نفسه
            break;
        default:
          setConnectionStatus(ConnectionStatus.DISCONNECTED);
          setStatusMessage('الخادم غير متصل. اضغط للاتصال.');
          stopPolling();
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
  }, [stopPolling]);

  const handleConnect = async () => {
    setConnectionStatus(ConnectionStatus.CONNECTING);
    setStatusMessage('جاري طلب الحالة من الخادم...');
    setSendResult(null);
    setQrCode(null);
    setServerLogs([]);
    pollRetriesRef.current = 0;
    
    stopPolling();
    // ابدأ الاستعلام فورًا ثم قم بتعيين الفاصل الزمني
    pollStatus(); 
    intervalRef.current = setInterval(pollStatus, 3000);
  };
  
  useEffect(() => {
    // Cleanup on component unmount
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
            <div className="flex flex-col items-center justify-center min-h-[300px]">
              {connectionStatus !== ConnectionStatus.CONNECTED && (
                <Button onClick={handleConnect} disabled={isConnectButtonDisabled}>
                  {isConnectButtonDisabled
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
            
            {serverLogs.length > 0 && (
              <div className="mt-6 border-t pt-4">
                <h3 className="text-md font-semibold text-gray-600 mb-2 text-center">سجلات الخادم الحية</h3>
                <div dir="ltr" className="bg-gray-900 text-white rounded-md p-3 text-xs font-mono h-32 overflow-y-auto">
                  {serverLogs.map((log, index) => (
                    <p key={index} className="whitespace-pre-wrap">{log}</p>
                  ))}
                </div>
              </div>
            )}
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
