// server.js

const express = require('express');
const bodyParser = require('body-parser');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const port = 3000;
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("Error: GEMINI_API_KEY tidak ditemukan. Pastikan file .env sudah benar.");
    process.exit(1);
}

// --- INISIALISASI MODEL ---
const genAI = new GoogleGenerativeAI(apiKey);

// Model utama yang cepat dan efisien
const primaryModel = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-latest",
    generationConfig: { responseMimeType: "application/json" }
});
// Model fallback yang stabil jika model utama rate limited
const fallbackModel = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { responseMimeType: "application/json" }
});


// --- FUNGSI HELPER UNTUK KEANDALAN API ---

/**
 * Mencoba memanggil model utama, dan beralih ke model fallback jika terjadi error 429.
 * @param {string} prompt - Prompt yang akan dikirim.
 * @returns {Promise<any>} Hasil dari generateContent.
 */
async function safeGenerate(prompt) {
    try {
        console.log("Mencoba model utama (gemini-1.5-flash)...");
        return await primaryModel.generateContent(prompt);
    } catch (err) {
        const isRateLimitError = (err.status === 429 || (err.message && err.message.includes('429')));
        if (isRateLimitError) {
            console.warn("Model utama rate limited. Mencoba fallback ke model alternatif (gemini-pro)...");
            return await fallbackModel.generateContent(prompt);
        }
        throw err;
    }
}

/**
 * Mencoba kembali sebuah fungsi dengan jeda waktu yang meningkat (exponential backoff).
 * @param {Function} fn - Fungsi async yang akan dijalankan (dalam kasus ini, `safeGenerate`).
 * @param {number} retries - Jumlah maksimum percobaan ulang.
 * @returns {Promise<any>} Hasil dari fungsi yang berhasil.
 */
async function retryWithBackoff(fn, retries = 3) {
    let delay = 1000;
    let lastError;
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            const isRateLimitError = (err.status === 429 || (err.message && err.message.includes('429')));
            if (isRateLimitError && i < retries - 1) {
                console.log(`Percobaan ke-${i + 1} gagal, mencoba lagi dalam ${delay / 1000} detik...`);
                await new Promise(res => setTimeout(res, delay));
                delay *= 2;
            } else {
                throw err;
            }
        }
    }
    throw lastError;
}

// --- ROUTE & LOGIKA UTAMA ---
app.use(express.static('public'));
app.use(bodyParser.json());

app.post('/translate', async (req, res) => {
    try {
        const { text, sourceLang, targetLang } = req.body;
        if (!text || !sourceLang || !targetLang) {
            return res.status(400).json({ error: 'Parameter tidak lengkap.' });
        }
        
        const languageMap = { 'auto': 'auto', 'ar': 'Arabic', 'nl': 'Dutch', 'bg': 'Bulgarian', 'cs': 'Czech', 'da': 'Danish', 'et': 'Estonian', 'fi': 'Finnish', 'hu': 'Hungarian', 'he': 'Hebrew', 'id': 'Indonesian', 'en': 'English', 'it': 'Italian', 'ja': 'Japanese', 'jv': 'Jawa', 'de': 'German', 'ko': 'Korean', 'lv': 'Latvian', 'lt': 'Lithuanian', 'zh-CN': 'Mandarin Chinese', 'no': 'Norwegian', 'pl': 'Polish', 'pt': 'Portuguese', 'fr': 'French', 'ro': 'Romanian', 'ru': 'Russian', 'sk': 'Slovak', 'sl': 'Slovenian', 'es': 'Spanish', 'su': 'Sundanese', 'sv': 'Swedish', 'tr': 'Turkish', 'uk': 'Ukrainian', 'vi': 'Vietnamese', 'el': 'Greek' };
        
        const targetLangName = languageMap[targetLang];
        const needsRomanization = ['ja', 'ko', 'ar', 'he', 'ru', 'el', 'zh-CN', 'bg', 'uk'];
        const isAutoDetect = (sourceLang === 'auto');
        let prompt;

        if (isAutoDetect) {
            prompt = `Analyze the text: "${text}". Detect its language (ISO 639-1 code), translate it to ${targetLangName}${needsRomanization.includes(targetLang) ? ', and provide a romanization' : ''}. Respond ONLY with a valid JSON object following this schema: {"detectedSourceLang": "string", "translatedText": "string"${needsRomanization.includes(targetLang) ? ', "romanization": "string"' : ''}}`;
        } else {
            const sourceLangName = languageMap[sourceLang];
            prompt = `Translate from ${sourceLangName} to ${targetLangName}: "${text}". ${needsRomanization.includes(targetLang) ? `Also provide a romanization.` : ''} Respond ONLY with a valid JSON object following this schema: {"translatedText": "string"${needsRomanization.includes(targetLang) ? ', "romanization": "string"' : ''}}`;
        }
        
        const result = await retryWithBackoff(() => safeGenerate(prompt));
        const responseText = result.response.text();
        const data = JSON.parse(responseText);

        if (!isAutoDetect) {
            data.detectedSourceLang = sourceLang;
        }
        res.json(data);

    } catch (error) {
        console.error('PROSES FINAL GAGAL SETELAH SEMUA PERCOBAAN:', error.message);
        res.status(500).json({ error: `Maaf, kami mengalami masalah saat menghubungi layanan AI. Silakan coba lagi nanti.` });
    }
});

app.listen(port, () => {
    console.log(`Server TranslatorKu berjalan di http://localhost:${port}`);
});