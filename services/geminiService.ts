import { generateAIMessage } from '../api/whatsappService';

/**
 * Generates a marketing message by calling the backend service.
 * @param prompt - The user's prompt describing the desired message.
 * @returns A promise that resolves to the generated message text.
 */
export const generateMessage = async (prompt: string): Promise<string> => {
  if (!prompt.trim()) {
    throw new Error("Prompt cannot be empty.");
  }

  try {
    // الآن هذه الوظيفة تستدعي الخادم الخلفي الآمن
    const message = await generateAIMessage(prompt);
    return message;
  } catch (error) {
    console.error("Error fetching generated message from backend:", error);
    // يمكنك عرض رسالة خطأ أكثر تفصيلاً للمستخدم هنا
    throw new Error("Failed to generate message. Please check server connection.");
  }
};
