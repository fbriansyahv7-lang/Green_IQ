// test-gemini.js

import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

if (!process.env.GEMINI_API_KEY) {
    console.error("🚨 ERROR: Variabel lingkungan GEMINI_API_KEY tidak ditemukan.");
    process.exit(1);
}

const ai = new GoogleGenAI({});
console.log("✅ Klien Gemini berhasil diinisialisasi.");

async function testConnection() {
    const simplePrompt = "Berapa total provinsi Indonesia?";

    try {
        console.log(`\n➡️ Mengirim pesan ke Gemini 2.5 Flash...`);

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: simplePrompt
        });

        const text = response.candidates[0].content.parts[0].text;

        console.log(`\n🤖 Balasan dari Gemini:\n-------------------------------------------------`);
        console.log(text);
        console.log(`-------------------------------------------------`);

    } catch (error) {
        console.error('\n❌ ERROR SAAT MEMANGGIL API:');
        console.error(error);
    }
}


testConnection();
