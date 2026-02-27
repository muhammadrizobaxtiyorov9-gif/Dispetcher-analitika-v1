import express from 'express';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(cors());
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  // Data directories
  const DATA_DIR = path.join(__dirname, 'data');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

  const REPORTS_DIR = path.join(DATA_DIR, 'reports');
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR);

  const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
  const STATION_DATA_FILE = path.join(DATA_DIR, 'station_data.json');

  // --- API ROUTES ---

  // 1. Upload Station Data
  app.post('/api/admin/upload-stations', (req, res) => {
    try {
      const data = req.body;
      if (!Array.isArray(data)) {
        return res.status(400).json({ error: 'Data must be an array of stations' });
      }
      fs.writeFileSync(STATION_DATA_FILE, JSON.stringify(data, null, 2));
      console.log(`[Saved] Station data updated (${data.length} records)`);
      res.json({ success: true, count: data.length });
    } catch (e: any) {
      console.error("Station upload error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // 2. Get Station Data
  app.get('/api/station-data', (req, res) => {
    if (fs.existsSync(STATION_DATA_FILE)) {
      try {
        const data = fs.readFileSync(STATION_DATA_FILE, 'utf8');
        res.json(JSON.parse(data));
      } catch (e) {
        console.error("Error reading station data:", e);
        res.json([]);
      }
    } else {
      // Fallback to empty array or bundled data logic on frontend
      res.json([]);
    }
  });

  // 3. Reports API
  app.post('/api/reports', (req, res) => {
    try {
      const { date, ...data } = req.body;
      if (!date) return res.status(400).send('Date is required');
      
      const filePath = path.join(REPORTS_DIR, `${date}.json`);
      fs.writeFileSync(filePath, JSON.stringify({ date, ...data }, null, 2));
      
      console.log(`[Saved] Report for ${date}`);
      res.json({ success: true, message: "Saved" });
    } catch (e: any) {
      console.error("Save error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/reports/:date', (req, res) => {
    const filePath = path.join(REPORTS_DIR, `${req.params.date}.json`);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      res.json(JSON.parse(data));
    } else {
      res.status(404).send('Report not found');
    }
  });

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

  // 4. Settings API
  app.post('/api/settings', (req, res) => {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  });

  app.get('/api/settings', (req, res) => {
    if (fs.existsSync(SETTINGS_FILE)) {
      res.json(JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')));
    } else {
      res.json(null);
    }
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
