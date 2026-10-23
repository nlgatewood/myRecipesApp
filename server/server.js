import 'dotenv/config';
import express from 'express';
import { Pool } from 'pg';
import format from 'pg-format';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import sharp from 'sharp';

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
//No CORS: nginx serves the site and the API from the same origin, so browsers only allow
//the site's own pages to call it. (Allowing every origin would let any web page edit recipes.)

//An idle connection can error (e.g. Postgres restarted). Without a listener Node treats it as fatal and exits
pool.on('error', (err) => { console.error('[db] idle client error:', err.message); });

//Set the search path (schema) for every new connection. Should be defined in the .env file as 'myrecipes'
pool.on('connect', async (client) => {
   await client.query(format('SET search_path TO %I, pg_catalog', process.env.PGSCHEMA));
});

//Recipe photos are kept on disk (outside the Vite build and git). recipe_images.url holds 'images/<file>',
//which the client turns into /myrecipes/api/images/<file>
const IMAGE_DIR = process.env.IMAGE_DIR || path.resolve(import.meta.dirname, '../data/images');
await fs.mkdir(IMAGE_DIR, { recursive: true });

//File names are unique and never rewritten, so browsers can cache them for good
app.use('/api/images', express.static(IMAGE_DIR, { maxAge: '365d', immutable: true }));

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
 * GET /api/recipe-details
 * -> {recipeId}
 * Returns a recipes details in 'recipes' table
 *----------------------------------------------*/
app.get('/api/recipe-details', async (_req, res) => {

   const recipeId = parseId(_req.query.recipeId);

   //Not a valid id -> same empty answer as an id that doesn't exist, so the page shows "not found"
   if (!recipeId) return res.json(null);

   try {
      let query = `select id, name, description, author, servings, prep_time, cook_time, keywords, category_code
                   from recipes
                   where id = $1`;

      const { rows } = await pool.query(query, [recipeId]);

      res.json(rows[0]);
  }
   catch (e) {
        res.status(500).json({ error: String(e) });
   }
});

/*---------------------------------------------- 
 * GET /api/recipe-ingredients
 * -> {recipeId}
 * Returns a recipe ingredients in 'recipe-ingredients' table
 *----------------------------------------------*/
app.get('/api/recipe-ingredients', async (_req, res) => {

   const recipeId = parseId(_req.query.recipeId);

   if (!recipeId) return res.json([]);

   try {
      let query = `select r.id, r.recipe_id, r.ingredient_description, quantity, r.unit_id, u.description "unit_description", r.ranking, r.optional
                   from recipe_ingredients r 
                        LEFT JOIN units u ON (r.unit_id = u.id)
                   where r.recipe_id = $1
                   order by ranking;`;

      const { rows } = await pool.query(query, [recipeId]);

      res.json(rows);
  }
   catch (e) {
        res.status(500).json({ error: String(e) });
   }
});

/*---------------------------------------------- 
 * GET /api/recipe-steps
 * -> {recipeId}
 * Returns a recipe steps in 'recipe-steps' table
 *----------------------------------------------*/
app.get('/api/recipe-steps', async (_req, res) => {

   const recipeId = parseId(_req.query.recipeId);

   if (!recipeId) return res.json([]);

   try {
      let query = `select id, description, ranking
                   from recipe_steps
                    where recipe_id = $1
                   order by ranking`;

      const { rows } = await pool.query(query, [recipeId]);

      res.json(rows);
  }
   catch (e) {
        res.status(500).json({ error: String(e) });
   }
});

/*----------------------------------------------
 * POST /api/recipes
 * Body: { name, description, author, servings, prep_time, cook_time, keywords, category_code,
 *         ingredients: [{ ingredient_description, quantity, unit_id, optional }],
 *         steps: [{ description }] }
 * Inserts a recipe with its ingredients and steps in one transaction.
 * Ingredient and step ranking follows the order of the arrays.
 *----------------------------------------------*/
app.post('/api/recipes', async (req, res) => {

   const { error, recipe } = parseRecipeBody(req.body);

   if (error) return res.status(400).json({ error });

   const client = await pool.connect();

   try {
      await client.query('BEGIN');

      const { rows } = await client.query(`INSERT INTO recipes (name, description, author, servings, prep_time, cook_time, keywords, category_code)
                                           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                                           RETURNING id`,
                                           recipeColumnValues(recipe));
      const recipeId = rows[0].id;

      await insertRecipeChildren(client, recipeId, recipe);

      await client.query('COMMIT');
      res.status(201).json({ id: recipeId });
   }
   catch (e) {
      await rollback(client);
      sendRecipeSaveError(res, e);
   }
   finally {
      client.release();
   }
});

/*----------------------------------------------
 * PUT /api/recipes/:id
 * Body: same as POST /api/recipes
 * Replaces a recipe's details, ingredients and steps in one transaction.
 * The ingredient and step lists are rewritten from the arrays (simplest way to keep the ranking right).
 *----------------------------------------------*/
app.put('/api/recipes/:id', async (req, res) => {

   const id = Number(req.params.id);

   if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id is required' });

   const { error, recipe } = parseRecipeBody(req.body);

   if (error) return res.status(400).json({ error });

   const client = await pool.connect();

   try {
      await client.query('BEGIN');

      const { rows } = await client.query(`UPDATE recipes
                                           SET name = $1, description = $2, author = $3, servings = $4, prep_time = $5,
                                               cook_time = $6, keywords = $7, category_code = $8, activity_date = now()
                                           WHERE id = $9
                                           RETURNING id`,
                                           [...recipeColumnValues(recipe), id]);

      if (!rows.length) {
         await rollback(client);
         return res.status(404).json({ error: 'not found' });
      }

      await client.query(`DELETE FROM recipe_ingredients WHERE recipe_id = $1`, [id]);
      await client.query(`DELETE FROM recipe_steps WHERE recipe_id = $1`, [id]);

      await insertRecipeChildren(client, id, recipe);

      await client.query('COMMIT');
      res.json({ id: rows[0].id });
   }
   catch (e) {
      await rollback(client);
      sendRecipeSaveError(res, e);
   }
   finally {
      client.release();
   }
});

//ROLLBACK that can't throw, so a broken connection doesn't turn into an unhandled rejection
async function rollback(client) {
   try { await client.query('ROLLBACK'); }
   catch (e) { console.error('[db] rollback failed:', e.message); }
}

//Validates the body shared by POST and PUT /api/recipes. Returns { error } or { recipe }
function parseRecipeBody(body) {

   const { name, description, author, servings, prep_time, cook_time, keywords, category_code,
           ingredients = [], steps = [] } = body ?? {};

   const recipe = {
      name: String(name ?? '').trim(),
      description: description || null,
      author: author || null,
      servings: toIntOrNull(servings),
      prep_time: toIntOrNull(prep_time),
      cook_time: toIntOrNull(cook_time),
      keywords: keywords || null,
      category_code,
      ingredients,
      steps
   };

   if (!recipe.name || !category_code) {
      return { error: 'name and category_code are required' };
   }

   //Same limits as the form and the VARCHAR(50) columns, so a long value gets a clear message instead of a 500
   if (recipe.name.length > 50) return { error: 'Keep the name to 50 characters or fewer.' };
   if (String(recipe.author ?? '').length > 50) return { error: 'Keep the author to 50 characters or fewer.' };

   //'All recipes' is the root of the tree, not a category a recipe can be filed in (the form doesn't offer it)
   if (category_code === ROOT_CATEGORY) return { error: 'Pick a category other than "All recipes".' };

   if ([recipe.servings, recipe.prep_time, recipe.cook_time].some(Number.isNaN)) {
      return { error: 'servings, prep_time and cook_time must be whole numbers' };
   }

   if (!Array.isArray(ingredients) || !Array.isArray(steps)) {
      return { error: 'ingredients and steps must be arrays' };
   }

   if (ingredients.some(i => !String(i?.ingredient_description ?? '').trim())) {
      return { error: 'Every ingredient needs a description.' };
   }

   const badNumber = (value, check) => value !== null && value !== undefined && value !== '' && !check(Number(value));

   if (ingredients.some(i => badNumber(i.quantity, n => Number.isFinite(n) && n > 0))) {
      return { error: 'Ingredient quantities must be numbers above 0.' };
   }

   if (ingredients.some(i => badNumber(i.unit_id, n => Number.isInteger(n) && n > 0))) {
      return { error: 'Unknown unit.' };
   }

   return { recipe };
}

//Values for the recipes columns, in the order the INSERT/UPDATE above use them
function recipeColumnValues(recipe) {
   return [recipe.name, recipe.description, recipe.author, recipe.servings,
           recipe.prep_time, recipe.cook_time, recipe.keywords, recipe.category_code];
}

//Inserts a recipe's ingredient and step rows. Ranking follows the order of the arrays
async function insertRecipeChildren(client, recipeId, recipe) {

   for (const [index, ingredient] of recipe.ingredients.entries()) {

      await client.query(`INSERT INTO recipe_ingredients (recipe_id, ingredient_description, quantity, unit_id, ranking, optional)
                          VALUES ($1, $2, $3, $4, $5, $6)`,
                          [recipeId, String(ingredient.ingredient_description).trim(), ingredient.quantity ?? null, ingredient.unit_id || null,
                           index + 1, ingredient.optional ? 1 : 0]);
   }

   for (const [index, step] of recipe.steps.entries()) {

      await client.query(`INSERT INTO recipe_steps (recipe_id, description, ranking)
                          VALUES ($1, $2, $3)`,
                          [recipeId, String(step.description ?? '').trim(), index + 1]);
   }
}

//Maps database errors from a recipe save to a friendly message
function sendRecipeSaveError(res, e) {

   if (e.code === '23503') return res.status(400).json({ error: 'Unknown category or unit.' });
   if (e.code === '23514' || e.code === '22003') return res.status(400).json({ error: 'One of the numbers is out of range.' });

   console.error(e);
   res.status(500).json({ error: String(e) });
}

/*----------------------------------------------
 * DELETE /api/recipes/:id
 * Deletes a recipe. Its ingredients, steps and images are removed by ON DELETE CASCADE.
 *----------------------------------------------*/
app.delete('/api/recipes/:id', async (req, res) => {

   const id = Number(req.params.id);

   if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id is required' });

   try {
      //The cascade removes the image rows, so look up their files first
      const { rows: images } = await pool.query(`SELECT url FROM recipe_images WHERE recipe_id = $1`, [id]);

      const { rows } = await pool.query(`DELETE FROM recipes
                                         WHERE id = $1
                                         RETURNING id`,
                                         [id]);

      if (!rows.length) return res.status(404).json({ error: 'not found' });

      await removeImageFiles(images.map(i => i.url));

      return res.status(204).end(); // success, no body
   }
   catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Server error' });
   }
});

/*----------------------------------------------
 * GET /api/recipe-images
 * -> {recipeId}
 * Returns a recipe's images in display order: [{ id, url, alt, sort_order }]
 *----------------------------------------------*/
app.get('/api/recipe-images', async (req, res) => {

   const recipeId = parseId(req.query.recipeId);

   if (!recipeId) return res.json([]);

   try {
      const { rows } = await pool.query(selectImagesQuery, [recipeId]);
      res.json(rows);
   }
   catch (e) {
      res.status(500).json({ error: String(e) });
   }
});

const selectImagesQuery = `select id, url, alt, sort_order
                           from recipe_images
                           where recipe_id = $1
                           order by sort_order, id`;

const MAX_IMAGES = 20;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_ALT_LENGTH = 200;

//Uploads are held in memory just long enough for sharp to resize them
const upload = multer({
   storage: multer.memoryStorage(),
   limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_IMAGES },
   fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/'))
}).array('images', MAX_IMAGES);

//Runs multer and turns its errors (file too big, too many files) into a 400 with a readable message
function receiveImages(req, res, next) {
   upload(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: `Each photo must be ${MAX_IMAGE_BYTES / 1024 / 1024} MB or smaller.` });
      if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') return res.status(400).json({ error: `A recipe can have up to ${MAX_IMAGES} photos.` });
      next(err);
   });
}

/*----------------------------------------------
 * PUT /api/recipes/:id/images
 * multipart/form-data:
 *   images   - the newly added photo files
 *   manifest - JSON array giving the full image list in display order:
 *              [{ id, alt }]     an image the recipe already has
 *              [{ upload, alt }] the nth file in 'images'
 * Images the recipe has that aren't in the manifest are deleted (row and file).
 * New photos are auto-rotated, shrunk to fit 1600px and saved as WebP.
 *----------------------------------------------*/
app.put('/api/recipes/:id/images', receiveImages, async (req, res) => {

   const recipeId = parseId(req.params.id);

   if (!recipeId) return res.status(400).json({ error: 'id is required' });

   const files = req.files ?? [];
   const { error, manifest } = parseImageManifest(req.body?.manifest, files.length);

   if (error) return res.status(400).json({ error });

   //Write the new files before touching the database, and remove them again if anything fails
   const written = [];

   try {
      for (const file of files) {
         const name = `${recipeId}-${randomUUID()}.webp`;

         try {
            await sharp(file.buffer)
               .rotate()   // honour the phone's EXIF orientation
               .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
               .webp({ quality: 80 })
               .toFile(path.join(IMAGE_DIR, name));
         }
         catch {
            await removeImageFiles(written);
            return res.status(400).json({ error: `Couldn't read "${file.originalname}" as an image. Try a JPEG or PNG.` });
         }

         written.push(`images/${name}`);
      }
   }
   catch (e) {
      await removeImageFiles(written);
      console.error(e);
      return res.status(500).json({ error: String(e) });
   }

   const client = await pool.connect();
   let removed = [];

   try {
      await client.query('BEGIN');

      const { rows: recipe } = await client.query(`SELECT id FROM recipes WHERE id = $1 FOR UPDATE`, [recipeId]);

      if (!recipe.length) {
         await rollback(client);
         await removeImageFiles(written);
         return res.status(404).json({ error: 'not found' });
      }

      const { rows: existing } = await client.query(`SELECT id, url FROM recipe_images WHERE recipe_id = $1`, [recipeId]);
      const existingIds = new Set(existing.map(r => Number(r.id)));
      const keptIds = new Set(manifest.filter(m => m.id).map(m => m.id));

      if ([...keptIds].some(id => !existingIds.has(id))) {
         await rollback(client);
         await removeImageFiles(written);
         return res.status(400).json({ error: 'Unknown image.' });
      }

      removed = existing.filter(r => !keptIds.has(Number(r.id))).map(r => r.url);

      await client.query(`DELETE FROM recipe_images WHERE recipe_id = $1 AND NOT (id = ANY($2::bigint[]))`, [recipeId, [...keptIds]]);

      for (const [index, item] of manifest.entries()) {

         if (item.id) {
            await client.query(`UPDATE recipe_images SET alt = $1, sort_order = $2 WHERE id = $3`,
                               [item.alt, index + 1, item.id]);
         } else {
            await client.query(`INSERT INTO recipe_images (recipe_id, url, alt, sort_order) VALUES ($1, $2, $3, $4)`,
                               [recipeId, written[item.upload], item.alt, index + 1]);
         }
      }

      await client.query('COMMIT');
   }
   catch (e) {
      await rollback(client);
      await removeImageFiles(written);
      console.error(e);
      return res.status(500).json({ error: String(e) });
   }
   finally {
      client.release();
   }

   //Only delete files once the rows pointing at them are gone for good
   await removeImageFiles(removed);

   const { rows } = await pool.query(selectImagesQuery, [recipeId]);
   res.json(rows);
});

//Validates the manifest for PUT /api/recipes/:id/images. Returns { error } or { manifest }
function parseImageManifest(text, fileCount) {

   let list;
   try { list = JSON.parse(text ?? '[]'); }
   catch { return { error: 'manifest must be JSON' }; }

   if (!Array.isArray(list)) return { error: 'manifest must be an array' };
   if (list.length > MAX_IMAGES) return { error: `A recipe can have up to ${MAX_IMAGES} photos.` };

   const manifest = [];
   const usedUploads = new Set();

   for (const item of list) {

      const alt = String(item?.alt ?? '').trim();
      if (alt.length > MAX_ALT_LENGTH) return { error: `Keep photo captions to ${MAX_ALT_LENGTH} characters or fewer.` };

      if (item?.id !== undefined) {
         const id = parseId(item.id);
         if (!id) return { error: 'Unknown image.' };
         manifest.push({ id, alt: alt || null });
      }
      else {
         const n = Number(item?.upload);
         if (!Number.isInteger(n) || n < 0 || n >= fileCount || usedUploads.has(n)) {
            return { error: 'A photo was not uploaded. Only JPEG, PNG, WebP and GIF images are accepted.' };
         }
         usedUploads.add(n);
         manifest.push({ upload: n, alt: alt || null });
      }
   }

   if (usedUploads.size !== fileCount) return { error: 'Every uploaded photo must be listed in the manifest.' };

   return { manifest };
}

//Deletes image files by their recipe_images.url. A missing file isn't an error
async function removeImageFiles(urls) {
   for (const url of urls) {
      try { await fs.unlink(path.join(IMAGE_DIR, path.basename(url))); }
      catch (e) { if (e.code !== 'ENOENT') console.error('[images] could not delete', url, e.message); }
   }
}

//Converts an optional numeric value to an integer. Blank -> null, non-integer -> NaN
function toIntOrNull(value) {

   if (value === null || value === undefined || value === '') return null;

   const n = Number(value);
   return Number.isInteger(n) ? n : NaN;
}

/*----------------------------------------------
 * GET /api/categories
 * -> [{ code, parent_code, title, description, recipe_count }]
 * Returns every category (used to build the category picker and tree).
 * recipe_count is the number of recipes filed directly in the category
 *----------------------------------------------*/
app.get('/api/categories', async (_req, res) => {

   try {
      const { rows } = await pool.query(`SELECT c.code, c.parent_code, c.title, c.description, count(r.id)::int "recipe_count"
                                         FROM categories c
                                              LEFT JOIN recipes r ON (r.category_code = c.code)
                                         GROUP BY c.code
                                         ORDER BY c.title`);
      res.json(rows);
   }
   catch (e) {
      res.status(500).json({ error: String(e) });
   }
});

/*----------------------------------------------
 * POST /api/categories
 * Body: { title, description?, parent_code }
 * Inserts a category. The code is generated from the title (e.g. "Muffins" -> "MUFFI")
 *----------------------------------------------*/
app.post('/api/categories', async (req, res) => {

   const { error, title, description, parent_code } = parseCategoryBody(req.body);

   if (error) return res.status(400).json({ error });

   try {
      const problem = await categoryPlacementProblem({ title, parent_code });
      if (problem) return res.status(problem.status).json({ error: problem.error });

      const code = await generateCategoryCode(title);

      const { rows } = await pool.query(`INSERT INTO categories (code, parent_code, title, description)
                                         VALUES ($1, $2, $3, $4)
                                         RETURNING code, parent_code, title, description, 0 "recipe_count"`,
                                         [code, parent_code, title, description]);

      res.status(201).json(rows[0]);
   }
   catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: 'That category code was just taken. Please try again.' });
      res.status(500).json({ error: String(e) });
   }
});

/*----------------------------------------------
 * PUT /api/categories/:code
 * Body: { title, description?, parent_code }
 * Updates a category's title/description or moves it under another parent.
 * The code itself never changes (recipes reference it). The root 'ALL' can't be edited
 *----------------------------------------------*/
app.put('/api/categories/:code', async (req, res) => {

   const code = String(req.params.code ?? '');
   const { error, title, description, parent_code } = parseCategoryBody(req.body);

   if (code === ROOT_CATEGORY) return res.status(400).json({ error: 'The "All recipes" category can\'t be changed.' });
   if (error) return res.status(400).json({ error });

   try {
      const problem = await categoryPlacementProblem({ code, title, parent_code });
      if (problem) return res.status(problem.status).json({ error: problem.error });

      const { rows } = await pool.query(`UPDATE categories
                                         SET title = $1, description = $2, parent_code = $3
                                         WHERE code = $4
                                         RETURNING code, parent_code, title, description`,
                                         [title, description, parent_code, code]);

      if (!rows.length) return res.status(404).json({ error: 'not found' });

      res.json(rows[0]);
   }
   catch (e) {
      res.status(500).json({ error: String(e) });
   }
});

/*----------------------------------------------
 * DELETE /api/categories/:code
 * Only empty categories can be deleted (no recipes, no subcategories).
 * Checked here because the schema's ON DELETE SET NULL would otherwise
 * silently turn the subcategories into stray top-level categories
 *----------------------------------------------*/
app.delete('/api/categories/:code', async (req, res) => {

   const code = String(req.params.code ?? '');

   if (code === ROOT_CATEGORY) return res.status(400).json({ error: 'The "All recipes" category can\'t be deleted.' });

   try {
      const { rows: [usage] } = await pool.query(`SELECT (SELECT count(*) FROM categories WHERE parent_code = $1)::int "children",
                                                         (SELECT count(*) FROM recipes WHERE category_code = $1)::int "recipes"`,
                                                  [code]);

      if (usage.children > 0) return res.status(409).json({ error: "Can't delete: move or delete its subcategories first." });
      if (usage.recipes > 0) return res.status(409).json({ error: "Can't delete: move its recipes to another category first." });

      const { rows } = await pool.query(`DELETE FROM categories
                                         WHERE code = $1
                                         RETURNING code`,
                                         [code]);

      if (!rows.length) return res.status(404).json({ error: 'not found' });

      return res.status(204).end(); // success, no body
   }
   catch (e) {

      if (e.code === '23503') return res.status(409).json({ error: "Can't delete: this category is still in use." });
      console.error(e);

      return res.status(500).json({ error: 'Server error' });
   }
});

const ROOT_CATEGORY = 'ALL';

//Validates { title, description, parent_code }. Returns { error } or the cleaned values
function parseCategoryBody(body) {

   const title = String(body?.title ?? '').trim();
   const description = String(body?.description ?? '').trim();   // column is NOT NULL, so blank is stored as ''
   const parent_code = String(body?.parent_code || ROOT_CATEGORY);

   if (!title) return { error: 'title is required' };
   if (title.length > 50) return { error: 'Keep the title to 50 characters or fewer.' };

   return { title, description, parent_code };
}

//Checks the parent exists, isn't the category itself or one of its descendants (which would
//create a loop), and that no sibling already has the same title. Returns { status, error } or null
async function categoryPlacementProblem({ code = null, title, parent_code }) {

   const parent = await pool.query(`SELECT 1 FROM categories WHERE code = $1`, [parent_code]);
   if (!parent.rows.length) return { status: 400, error: 'Unknown parent category.' };

   if (code) {
      const loop = await pool.query(`WITH RECURSIVE tree AS (
                                        SELECT code FROM categories WHERE code = $1
                                        UNION
                                        SELECT c.code FROM categories c JOIN tree t ON (c.parent_code = t.code)
                                     )
                                     SELECT 1 FROM tree WHERE code = $2`, [code, parent_code]);

      if (loop.rows.length) return { status: 400, error: "A category can't be moved inside itself or one of its subcategories." };
   }

   const sibling = await pool.query(`SELECT 1 FROM categories
                                     WHERE parent_code = $1
                                       AND lower(title) = lower($2)
                                       AND code <> coalesce($3, '')
                                     LIMIT 1`, [parent_code, title, code]);

   if (sibling.rows.length) return { status: 409, error: `There's already a "${title}" category there.` };

   return null;
}

//Builds a short unique code from the title, like the existing ones: "Muffins" -> "MUFFI", then "MUFF1", "MUFF2"...
async function generateCategoryCode(title) {

   const base = title.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) || 'CAT';

   for (let n = 0; n < 1000; n++) {

      const suffix = n === 0 ? '' : String(n);
      const code = base.slice(0, 5 - suffix.length) + suffix;

      const { rows } = await pool.query(`SELECT 1 FROM categories WHERE code = $1`, [code]);
      if (!rows.length) return code;
   }

   throw new Error('Could not generate a category code');
}

/*----------------------------------------------
 * GET /api/recipe-search
 * -> { q }
 * Searches recipe names, keywords and ingredients. Every word in q must match the name,
 * the keywords or one of the recipe's ingredients (case-insensitive, partial words OK).
 * Name matches are listed first. matched_ingredients lists the ingredients that matched a word.
 *----------------------------------------------*/
app.get('/api/recipe-search', async (_req, res) => {

   const q = String(_req.query.q ?? '').trim().slice(0, 100);

   //Escape LIKE wildcards so a search for "100%" doesn't match everything
   const escapeLike = (text) => text.replace(/[\\%_]/g, '\\$&');
   const terms = q.split(/[\s,]+/).filter(Boolean).slice(0, 10).map(t => `%${escapeLike(t)}%`);

   if (!terms.length) return res.json([]);

   try {
      let query = `SELECT r.id, r.name, r.description, r.prep_time, r.cook_time, r.keywords, r.category_code, c.title "category_title",
                          ARRAY(SELECT ri.ingredient_description
                                FROM recipe_ingredients ri
                                WHERE ri.recipe_id = r.id
                                  AND ri.ingredient_description ILIKE ANY ($1::text[])
                                ORDER BY ri.ranking) "matched_ingredients"
                   FROM recipes r
                        JOIN categories c ON (r.category_code = c.code)
                   WHERE NOT EXISTS (SELECT 1
                                     FROM unnest($1::text[]) term
                                     WHERE NOT (r.name ILIKE term
                                                OR coalesce(r.keywords, '') ILIKE term
                                                OR EXISTS (SELECT 1
                                                           FROM recipe_ingredients ri
                                                           WHERE ri.recipe_id = r.id
                                                             AND ri.ingredient_description ILIKE term)))
                   ORDER BY CASE WHEN r.name ILIKE $2 THEN 0
                                 WHEN r.name ILIKE $3 THEN 1
                                 ELSE 2 END,
                            lower(r.name)
                   LIMIT 50`;

      const { rows } = await pool.query(query, [terms, `${escapeLike(q)}%`, `%${escapeLike(q)}%`]);

      res.json(rows);
   }
   catch (e) {
      res.status(500).json({ error: String(e) });
   }
});

/*----------------------------------------------
 * GET /api/recipe-counts
 * -> [{ category_code, count }]
 * Number of recipes filed directly under each category
 *----------------------------------------------*/
app.get('/api/recipe-counts', async (_req, res) => {

   try {
      const { rows } = await pool.query(`SELECT category_code, count(*)::int "count"
                                         FROM recipes
                                         GROUP BY category_code`);
      res.json(rows);
   }
   catch (e) {
      res.status(500).json({ error: String(e) });
   }
});

/*---------------------------------------------- 
 * GET /api/recipes-by-category
 * -> { categoryCode, includeSubcategories? }
 * Returns the recipes in a category. With includeSubcategories=true, also
 * returns recipes from every category nested underneath it.
 *----------------------------------------------*/
app.get('/api/recipes-by-category', async (_req, res) => {

   const { categoryCode, includeSubcategories } = _req.query;

   try {
      //UNION (not UNION ALL) stops the recursion if the category data ever contains a loop
      const tree = includeSubcategories === 'true'
         ? `WITH RECURSIVE tree AS (
               SELECT code FROM categories WHERE code = $1
               UNION
               SELECT c.code FROM categories c JOIN tree t ON (c.parent_code = t.code)
            )`
         : `WITH tree AS (SELECT $1::varchar AS code)`;

      let query = `${tree}
                   SELECT r.id, r.name, r.description, r.prep_time, r.cook_time, r.category_code, c.title "category_title"
                   FROM recipes r
                        JOIN categories c ON (r.category_code = c.code)
                   WHERE r.category_code IN (SELECT code FROM tree)
                   ORDER BY lower(r.name)`;

      const { rows } = await pool.query(query, [categoryCode]);

      res.json(rows);
  }
   catch (e) {
        res.status(500).json({ error: String(e) });
   }
});

/*----------------------------------------------
 * GET /api/units
 * -> [{ id, name, description, recipe_count }, ...]
 * Returns every unit, with the number of recipes that use it
 *----------------------------------------------*/
app.get('/api/units', async (_req, res) => {

   try {
      const { rows } = await pool.query(`SELECT u.id, u.name, u.description, count(DISTINCT ri.recipe_id)::int "recipe_count"
                                         FROM units u
                                              LEFT JOIN recipe_ingredients ri ON (ri.unit_id = u.id)
                                         GROUP BY u.id
                                         ORDER BY lower(u.name)`);
      res.json(rows);
   }
   catch (e) {
      res.status(500).json({ error: String(e) });
   }
});

/*----------------------------------------------
 * POST /api/units
 * Body: { name: string, description: string }
 * Inserts a unit. Names are unique (case-sensitive, so "L" and "l" can differ)
 *----------------------------------------------*/
app.post('/api/units', async (req, res) => {

   const { error, name, description } = parseLookupBody(req.body, { descriptionRequired: true });

   if (error) return res.status(400).json({ error });

   try {
      const { rows } = await pool.query(`INSERT INTO units (name, description)
                                         VALUES ($1, $2)
                                         RETURNING id, name, description, 0 "recipe_count"`,
                                         [name, description]);

      res.status(201).json(rows[0]);
   }
   catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: `A unit named "${name}" already exists.` });
      res.status(500).json({ error: String(e) });
   }
});

/*----------------------------------------------
 * PUT /api/units/:id
 * Body: { name: string, description: string }
 * Updates a unit. Recipes using it pick up the change automatically
 *----------------------------------------------*/
app.put('/api/units/:id', async (req, res) => {

   const id = parseId(req.params.id);
   const { error, name, description } = parseLookupBody(req.body, { descriptionRequired: true });

   if (!id) return res.status(400).json({ error: 'id is required' });
   if (error) return res.status(400).json({ error });

   try {
      const { rows } = await pool.query(`UPDATE units
                                         SET name = $1, description = $2
                                         WHERE id = $3
                                         RETURNING id, name, description`,
                                         [name, description, id]);

      if (!rows.length) return res.status(404).json({ error: 'not found' });

      res.json(rows[0]);
   }
   catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: `A unit named "${name}" already exists.` });
      res.status(500).json({ error: String(e) });
   }
});

/*----------------------------------------------
 * DELETE /api/units/:id
 * Fails with 409 if a recipe uses the unit
 *----------------------------------------------*/
app.delete('/api/units/:id', async (req, res) => {

   const id = parseId(req.params.id);

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

      if (e.code === '23503') return res.status(409).json({ error: "Can't delete: this unit is used by at least one recipe." });
      console.error(e);

      return res.status(500).json({ error: 'Server error' });
  }
});

//Validates { name, description } for the units routes. Returns { error } or { name, description }
function parseLookupBody(body, { descriptionRequired }) {

   const name = String(body?.name ?? '').trim();
   const description = String(body?.description ?? '').trim();

   if (!name) return { error: 'name is required' };
   if (descriptionRequired && !description) return { error: 'description is required' };

   return { name, description: description || null };
}

//Route ids must be positive integers. Returns the id, or null if invalid
function parseId(value) {

   const id = Number(value);
   return Number.isInteger(id) && id > 0 ? id : null;
}

app.listen(process.env.PORT, '127.0.0.1', () => {console.log(`myrecipes API listening on http://127.0.0.1:${process.env.PORT}`);});
