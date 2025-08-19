import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import format from 'pg-format';

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  max: 10,
  idleTimeoutMillis: 10_000
});

const app = express();
app.use(express.json());
app.use(cors({ methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'] }));

//Set the search path (schema) for every new connection. Should be defined in the .env file as 'myrecipes'
pool.on('connect', async (client) => {
   await client.query(format('SET search_path TO %I, pg_catalog', process.env.PGSCHEMA));
});

// server log
app.use((req, _res, next) => { console.log(`[api] ${req.method} ${req.url}`); next(); });

/*---------------------------------------------- 
 * GET /api/health
 * Returns if the APIs are reachable or not
 *----------------------------------------------*/
app.get('/api/health', async (_req, res) => {

   try {
      await pool.query('SELECT 1'); 
      res.json({ ok: true }); 
   }
   catch (e) { 
      res.status(500).json({ error: 'db down', details: String(e) }); 
   }
});

/*---------------------------------------------- 
 * GET /api/units
 * -> [{ code, description }, ...]
 * Returns a list of units
 *----------------------------------------------*/
app.get('/api/units', async (_req, res) => {

   try {
      const { rows } = await pool.query(`SELECT code, description 
	                                 FROM units;`);
      res.json(rows);
   } 
   catch (e) {
        res.status(500).json({ error: String(e) });
   }
});

/*---------------------------------------------- 
 * POST /api/units
 * Body: { code: string, description: string }
 * Upsert on units.code.
 *----------------------------------------------*/
app.post('/api/units', async (req, res) => {

   const { code, description } = req.body ?? {};

   if (!code || !description) {

      return res.status(400).json({ error: 'code, description are required' });
   }

   try {
      const { rows } = await pool.query(`INSERT INTO units (code, description)
                                         VALUES ($1, $2)
                                         ON CONFLICT (code)
                                         DO UPDATE SET description = EXCLUDED.description
                                         RETURNING code, description;`,
                                         [code, description]);

    res.status(201).json(rows[0]);
   } 
   catch (e) {
      res.status(500).json({ error: String(e) });
   }
});

/*---------------------------------------------- 
 * DELETE /api/units/:code
 * Body: { code: string }
 *----------------------------------------------*/
app.delete('/api/units/:code', async (req, res) => {

   const code = String(req.params.code || '').trim();

   if (!code) return res.status(400).json({ error: 'code is required' });

   try {
      const { rows } = await pool.query(`DELETE FROM units 
	                                 WHERE code = $1 
	                                 RETURNING code`, 
	                                 [code]);

      if (!rows.length) return res.status(404).json({ error: 'not found' });

      return res.status(204).end(); // success, no body
   } 
   catch (e) {

      if (e.code === '23503') return res.status(409).json({ error: 'Unit is in use' });
      console.error(e);

      return res.status(500).json({ error: 'Server error' });
  }
});


app.listen(process.env.PORT, '127.0.0.1', () => {console.log(`myrecipes API listening on http://127.0.0.1:${process.env.PORT}`);});
