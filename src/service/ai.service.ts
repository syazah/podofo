import type { GoogleGenAI } from "@google/genai";

export class AI {
    private client: GoogleGenAI;

    constructor(
        client: GoogleGenAI,
    ) {
        this.client = client;
    };

    public async sendMessage(params: {
        model: string;
        contents: any[];
    }) {
        return await this.client.models.generateContent(params);
    }

    public async sendMessageBatched(params: {
        model: string;
        src: any;
        config?: { displayName?: string };
    }) {
        return await this.client.batches.create(params);
    }
}