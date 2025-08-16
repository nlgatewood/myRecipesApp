import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';

const app = express();
app.use(express.json());
app.use(cors());

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  max: 10,
  idleTimeoutMillis: 10_000
});

// Health
app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: 'db down', details: String(e) }); }
});

/**
 * GET /api/gender_codes
 * -> [{ gender_code, gender_desc, gender_long_desc }, ...]
 */
app.get('/api/gender_codes', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT gender_code, gender_desc, gender_long_desc FROM familytree.gender_codes ORDER BY gender_code ASC;'
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

/**
 * POST /api/gender_codes
 * Body: { gender_code: string, gender_desc: string, gender_long_desc: string }
 * Upsert on gender_code.
 */
app.post('/api/gender_codes', async (req, res) => {
  const { gender_code, gender_desc, gender_long_desc } = req.body ?? {};
  if (!gender_code || !gender_desc || !gender_long_desc) {
    return res.status(400).json({ error: 'gender_code, gender_desc, and gender_long_desc are required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO familytree.gender_codes (gender_code, gender_desc, gender_long_desc)
       VALUES ($1, $2, $3)
       ON CONFLICT (gender_code)
       DO UPDATE SET gender_desc = EXCLUDED.gender_desc,
                     gender_long_desc = EXCLUDED.gender_long_desc
       RETURNING gender_code, gender_desc, gender_long_desc;`,
      [gender_code, gender_desc, gender_long_desc]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

const port = Number(process.env.PORT || 4001);
app.listen(port, '127.0.0.1', () => {
  console.log(`myrecipes API listening on http://127.0.0.1:${port}`);
});

