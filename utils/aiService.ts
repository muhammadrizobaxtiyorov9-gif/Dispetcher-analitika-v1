
import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `
You are a Text Encoding Repair Specialist.
Your ONLY task is to fix garbled text (mojibake) caused by incorrect encoding decoding (e.g., CP866 or Windows-1251 decoded as UTF-8).

--- INSTRUCTIONS ---
1. Analyze the input text.
2. If the text appears to be garbled (e.g., "CÏÏB", "ÑÏÏÂ", "âîãîí", "ÏÐÌÄ"), convert it to readable Cyrillic/Russian/Uzbek.
3. If the text is ALREADY readable, return it EXACTLY as is.
4. DO NOT remove any lines.
5. DO NOT reorder any lines.
6. DO NOT summarize or explain.
7. OUTPUT ONLY THE REPAIRED TEXT.
`;

export const cleanDataWithAI = async (rawText: string): Promise<string> => {
  // Use process.env.API_KEY exclusively as per guidelines.
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
      throw new Error("API Key topilmadi. .env faylini tekshiring (API_KEY).");
  }

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey });
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Fix the encoding of this text if it is garbled. Return the text exactly as is otherwise:\n\n${rawText}`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });

    return response.text || "";
  } catch (error) {
    console.error("AI Analysis Error:", error);
    throw new Error("Не удалось обработать данные с помощью ИИ. Проверьте API Key.");
  }
};
