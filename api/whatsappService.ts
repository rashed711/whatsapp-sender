// هام: استبدل هذا الرابط بالرابط الذي ستحصل عليه من Render.com
// مثال: 'https://my-whatsapp-sender.onrender.com'
const BACKEND_URL = 'https://whatsapp-sender-etav.onrender.com';

const handleFetchError = (error: unknown): never => {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.error('Network error: Could not connect to the backend server.', { url: BACKEND_URL });
      throw new Error('لا يمكن الاتصال بالخادم. يرجى التحقق من أن الخادم يعمل وأن الرابط صحيح.');
    }
    // Re-throw other unexpected errors
    throw error;
}

/**
 * جلب الحالة الحالية للاتصال ورمز QR من الخادم.
 */
export const getStatus = async () => {
  try {
    const response = await fetch(`${BACKEND_URL}/status`);
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`فشل جلب الحالة من الخادم: ${errorText}`);
    }
    return response.json();
  } catch (error) {
    handleFetchError(error);
  }
};

/**
 * إرسال الرسائل عبر الخادم الخلفي.
 * @param numbers - مصفوفة من أرقام الهواتف.
 * @param message - نص الرسالة.
 */
export const sendMessages = async (numbers: string[], message: string) => {
    try {
        const response = await fetch(`${BACKEND_URL}/send`, {
            method: 'POST',
            headers: {
            'Content-Type': 'application/json',
            },
            body: JSON.stringify({ numbers, message }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'فشل إرسال الرسائل.' }));
            throw new Error(errorData.error);
        }

        return response.json();
    } catch(error) {
        handleFetchError(error);
    }
};

/**
 * طلب توليد رسالة من الخادم الخلفي باستخدام Gemini AI.
 * @param prompt - الوصف المطلوب للرسالة.
 */
export const generateAIMessage = async (prompt: string) => {
    try {
        const response = await fetch(`${BACKEND_URL}/generate-message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'فشل توليد رسالة الذكاء الاصطناعي.' }));
            throw new Error(errorData.error);
        }
        
        const data = await response.json();
        return data.message;
    } catch (error) {
        handleFetchError(error);
    }
}
