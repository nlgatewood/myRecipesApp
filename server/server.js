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
 * GET /api/recipe-details
 * -> {recipeId}
 * Returns a recipes details in 'recipes' table
 *----------------------------------------------*/
app.get('/api/recipe-details', async (_req, res) => {

   const { recipeId } = _req.query;

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

   const { recipeId } = _req.query;

   try {
      let query = `select r.recipe_id, r.ingredient_id, i.name, quantity, r.unit_id, u.description "unit_description", r.ranking, r.optional
                   from recipe_ingredients r 
                        JOIN ingredients i on (r.ingredient_id = i.id)
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

   const { recipeId } = _req.query;

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
 *         ingredients: [{ name, quantity, unit_id, optional }],
 *         steps: [{ description }] }
 * Inserts a recipe with its ingredients and steps in one transaction.
 * Ingredients are matched by name (case-insensitive) and created if they don't exist yet.
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
      await client.query('ROLLBACK');
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
         await client.query('ROLLBACK');
         return res.status(404).json({ error: 'not found' });
      }

      await client.query(`DELETE FROM recipe_ingredients WHERE recipe_id = $1`, [id]);
      await client.query(`DELETE FROM recipe_steps WHERE recipe_id = $1`, [id]);

      await insertRecipeChildren(client, id, recipe);

      await client.query('COMMIT');
      res.json({ id: rows[0].id });
   }
   catch (e) {
      await client.query('ROLLBACK');
      sendRecipeSaveError(res, e);
   }
   finally {
      client.release();
   }
});

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

   if ([recipe.servings, recipe.prep_time, recipe.cook_time].some(Number.isNaN)) {
      return { error: 'servings, prep_time and cook_time must be whole numbers' };
   }

   if (!Array.isArray(ingredients) || !Array.isArray(steps)) {
      return { error: 'ingredients and steps must be arrays' };
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

      const ingredientId = await findOrCreateIngredient(client, String(ingredient.name ?? '').trim());

      await client.query(`INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit_id, ranking, optional)
                          VALUES ($1, $2, $3, $4, $5, $6)`,
                          [recipeId, ingredientId, ingredient.quantity ?? null, ingredient.unit_id || null,
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

   if (e.code === '23505') return res.status(409).json({ error: 'The same ingredient is listed more than once.' });
   if (e.code === '23503') return res.status(400).json({ error: 'Unknown category or unit.' });
   if (e.code === '23514' || e.code === '22003') return res.status(400).json({ error: 'One of the numbers is out of range.' });
   if (e.message === 'ingredient name is required') return res.status(400).json({ error: 'Every ingredient needs a name.' });

   console.error(e);
   res.status(500).json({ error: String(e) });
}

/*----------------------------------------------
 * DELETE /api/recipes/:id
 * Deletes a recipe. Its ingredients, steps and images are removed by ON DELETE CASCADE.
 * Shared rows in the ingredients table are kept.
 *----------------------------------------------*/
app.delete('/api/recipes/:id', async (req, res) => {

   const id = Number(req.params.id);

   if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id is required' });

   try {
      const { rows } = await pool.query(`DELETE FROM recipes
                                         WHERE id = $1
                                         RETURNING id`,
                                         [id]);

      if (!rows.length) return res.status(404).json({ error: 'not found' });

      return res.status(204).end(); // success, no body
   }
   catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'Server error' });
   }
});

//Converts an optional numeric value to an integer. Blank -> null, non-integer -> NaN
function toIntOrNull(value) {

   if (value === null || value === undefined || value === '') return null;

   const n = Number(value);
   return Number.isInteger(n) ? n : NaN;
}

//Returns the id of an ingredient by name (case-insensitive), inserting it if it doesn't exist
async function findOrCreateIngredient(client, name) {

   if (!name) throw new Error('ingredient name is required');

   const found = await client.query(`SELECT id FROM ingredients
                                     WHERE lower(name) = lower($1)
                                     LIMIT 1`, [name]);

   if (found.rows.length) return found.rows[0].id;

   const created = await client.query(`INSERT INTO ingredients (name, description)
                                       VALUES ($1, $1)
                                       RETURNING id`, [name]);
   return created.rows[0].id;
}

/*----------------------------------------------
 * GET /api/categories
 * -> [{ code, parent_code, title }]
 * Returns every category (used to build the category picker)
 *----------------------------------------------*/
app.get('/api/categories', async (_req, res) => {

   try {
      const { rows } = await pool.query(`SELECT code, parent_code, title
                                         FROM categories
                                         ORDER BY title`);
      res.json(rows);
   }
   catch (e) {
      res.status(500).json({ error: String(e) });
   }
});

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
                          ARRAY(SELECT i.name
                                FROM recipe_ingredients ri
                                     JOIN ingredients i ON (ri.ingredient_id = i.id)
                                WHERE ri.recipe_id = r.id
                                  AND i.name ILIKE ANY ($1::text[])
                                ORDER BY ri.ranking) "matched_ingredients"
                   FROM recipes r
                        JOIN categories c ON (r.category_code = c.code)
                   WHERE NOT EXISTS (SELECT 1
                                     FROM unnest($1::text[]) term
                                     WHERE NOT (r.name ILIKE term
                                                OR coalesce(r.keywords, '') ILIKE term
                                                OR EXISTS (SELECT 1
                                                           FROM recipe_ingredients ri
                                                                JOIN ingredients i ON (ri.ingredient_id = i.id)
                                                           WHERE ri.recipe_id = r.id
                                                             AND i.name ILIKE term)))
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
 * GET /api/categories-by-parent
 * -> [{ code, parent_code }]
 * Returns a list of categories
 *----------------------------------------------*/
app.get('/api/categories-by-parent', async (_req, res) => {

   const { parentCode } = _req.query;

   try {
      let query = `SELECT code, parent_code, title
                   FROM categories `;

      const params = [];

      if (parentCode) {
         query += ` WHERE parent_code = $1`;
         params.push(parentCode);
      }
      else {
         query += ` WHERE parent_code IS NULL`
      }

      const { rows } = await pool.query(query, params);

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
      if (e.code === '23505') return res.status(409).json({ error: `A unit named "${name}" already exists.` });
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
