
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001; // Server 3001-portda ishlaydi

// Katta hajmdagi ma'lumotlarni qabul qilish uchun limitni oshiramiz
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Ma'lumotlarni saqlash uchun papkalar
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const REPORTS_DIR = path.join(DATA_DIR, 'reports');
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR);

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// --- REPORTS API (Hisobotlar) ---

// 1. Hisobotni saqlash (POST)
app.post('/api/reports', (req, res) => {
    try {
        const { date, ...data } = req.body;
        if (!date) return res.status(400).send('Sana (date) talab qilinadi');
        
        const filePath = path.join(REPORTS_DIR, `${date}.json`);
        fs.writeFileSync(filePath, JSON.stringify({ date, ...data }, null, 2));
        
        console.log(`[Saved] Report for ${date}`);
        res.json({ success: true, message: "Saqlandi" });
    } catch (e) {
        console.error("Save error:", e);
        res.status(500).json({ error: e.message });
    }
});

// 2. Bitta hisobotni olish (GET by Date)
app.get('/api/reports/:date', (req, res) => {
    const filePath = path.join(REPORTS_DIR, `${req.params.date}.json`);
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        res.json(JSON.parse(data));
    } else {
        res.status(404).send('Report not found');
    }
});

// 3. Barcha hisobotlar ro'yxatini olish (GET List)
app.get('/api/reports', (req, res) => {
    try {
        const files = fs.readdirSync(REPORTS_DIR);
        const reports = files
            .filter(file => file.endsWith('.json'))
            .map(file => {
                const content = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, file), 'utf8'));
                return {
                    date: content.date,
                    timestamp: content.timestamp,
                    wagonCount: content.wagons ? content.wagons.length : 0
                };
            });
        res.json(reports);
    } catch (e) {
        res.json([]);
    }
});

// 4. Hisobotni o'chirish (DELETE)
app.delete('/api/reports/:date', (req, res) => {
    const filePath = path.join(REPORTS_DIR, `${req.params.date}.json`);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[Deleted] Report ${req.params.date}`);
        res.json({ success: true });
    } else {
        res.status(404).send('Not found');
    }
});

// --- SETTINGS API (Sozlamalar) ---

app.post('/api/settings', (req, res) => {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
});

app.get('/api/settings', (req, res) => {
    if (fs.existsSync(SETTINGS_FILE)) {
        res.json(JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')));
    } else {
        res.json(null); // Sozlamalar yo'q bo'lsa null qaytadi
    }
});

app.listen(PORT, () => {
    console.log(`--------------------------------------------------`);
    console.log(`✅ LOCAL BACKEND ISHLAMOQDA: http://localhost:${PORT}`);
    console.log(`📁 Ma'lumotlar papkasi: ${DATA_DIR}`);
    console.log(`--------------------------------------------------`);
});
