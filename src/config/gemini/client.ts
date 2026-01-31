import { GoogleGenAI } from "@google/genai";

export class GeminiClient {
    private static client: GoogleGenAI;

    private constructor() { }

    public static getGeminiClient() {
        if (!GeminiClient.client) {
            GeminiClient.client = new GoogleGenAI({
                apiKey: process.env.GEMINI_API_KEY ?? '',
            })
        }
        return GeminiClient.client;
    }
}