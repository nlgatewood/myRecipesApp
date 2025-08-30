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
      const { rows } = await pool.query(`SELECT id, name, description 
                                         FROM units;`);
      res.json(rows);
   } 
   catch (e) {
        res.status(500).json({ error: String(e) });
   }
});

/*---------------------------------------------- 
 * POST /api/units
 * Body: { name: string, description: string }
 * Upsert on units.code.
 *----------------------------------------------*/
app.post('/api/units', async (req, res) => {

   const { name, description } = req.body ?? {};

   if (!name || !description) {

      return res.status(400).json({ error: 'name, description are required' });
   }

   try {
      const { rows } = await pool.query(`INSERT INTO units (name, description)
                                         VALUES ($1, $2)
                                         RETURNING id, name, description;`,
                                         [name, description]);

    res.status(201).json(rows[0]);
   } 
   catch (e) {
      res.status(500).json({ error: String(e) });
   }
});

/*---------------------------------------------- 
 * DELETE /api/units/:id
 * Body: { id: BIGINT }
 *----------------------------------------------*/
app.delete('/api/units/:id', async (req, res) => {

   const id = (req.params.id || '').trim();

   if (!id) return res.status(400).json({ error: 'id is required' });

   try {
      const { rows } = await pool.query(`DELETE FROM units 
                                         WHERE id = $1
                                         RETURNING id`,
                                         [id]);

      if (!rows.length) return res.status(404).json({ error: 'not found' });

      return res.status(204).end(); // success, no body
   } 
   catch (e) {

      if (e.code === '23503') return res.status(409).json({ error: 'Unit is in use' });
      console.error(e);

      return res.status(500).json({ error: 'Server error' });
  }
});

/*----------------------------------------------
 * GET /api/ingredients
 * -> [{ name, description }, ...]
 * Returns a list of ingredients
 *----------------------------------------------*/
app.get('/api/ingredients', async (_req, res) => {

   try {
      const { rows } = await pool.query(`SELECT * FROM ingredients;`);
      res.json(rows);                                                                                                                                                                                                                                                                      }                                                                                                                                                                                                                                                                                       catch (e) {                                                                                                                                                                                                                                                                                  res.status(500).json({ error: String(e) });                                                                                                                                                                                                                                        }                                                                                                                                                                                                                                                                                    });    

/*----------------------------------------------
 * POST /api/ingredients
 * Body: { name: string, description: string }
 * Insert into Ingredients table
 *----------------------------------------------*/
app.post('/api/ingredients', async (req, res) => {

   const { name, description } = req.body ?? {};

   if (!name || !description) {

      return res.status(400).json({ error: 'name, description are required' });
   }

   try {
      const { rows } = await pool.query(`INSERT INTO ingredients (id, name, description)
                                         VALUES (NULL, $1, $2)
                                         RETURNING id, name, description;`,
                                         [name, description]);

    res.status(201).json(rows[0]);
   }
   catch (e) {
      res.status(500).json({ error: String(e) });
   }
});

/*----------------------------------------------
 * DELETE /api/ingredients/:code
 * Body: { id: string }
 *----------------------------------------------*/
app.delete('/api/ingredients/:code', async (req, res) => {

   const id = Number(req.params.id);

   if (!id) return res.status(400).json({ error: 'id is required' });

   try {
      const { rows } = await pool.query(`DELETE FROM ingredients
                                         WHERE id = $1
                                         RETURNING id`,
                                         [id]);

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
