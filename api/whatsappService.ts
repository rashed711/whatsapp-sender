// هام: استبدل هذا الرابط بالرابط الذي ستحصل عليه من Render.com
// مثال: 'https://my-whatsapp-sender.onrender.com'
const BACKEND_URL = 'https://whatsapp-sender-etav.onrender.com';

/**
 * جلب الحالة الحالية للاتصال ورمز QR من الخادم.
 */
export const getStatus = async () => {
  const response = await fetch(`${BACKEND_URL}/status`);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch status from server: ${errorText}`);
  }
  return response.json();
};

/**
 * إرسال الرسائل عبر الخادم الخلفي.
 * @param numbers - مصفوفة من أرقام الهواتف.
 * @param message - نص الرسالة.
 */
export const sendMessages = async (numbers: string[], message: string) => {
  const response = await fetch(`${BACKEND_URL}/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ numbers, message }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to send messages.' }));
    throw new Error(errorData.error);
  }

  return response.json();
};

/**
 * طلب توليد رسالة من الخادم الخلفي باستخدام Gemini AI.
 * @param prompt - الوصف المطلوب للرسالة.
 */
export const generateAIMessage = async (prompt: string) => {
    const response = await fetch(`${BACKEND_URL}/generate-message`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to generate AI message.' }));
        throw new Error(errorData.error);
    }
    
    const data = await response.json();
    return data.message;
}
