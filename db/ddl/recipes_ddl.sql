-- ============================================================
-- PostgreSQL DDL for MyRecipesApp
-- Defines schema for categories, units, recipes, ingredients,
-- recipe_ingredients (xref), and recipe_steps
-- ============================================================

-- Set the schema to 'myrecipes'
SET search_path TO myrecipes;

-- ============================================================
-- 1. Categories
-- Hierarchical classification of recipes. Supports parent/child.
-- ============================================================
CREATE TABLE categories (
   code          VARCHAR(10) PRIMARY KEY,
   parent_code   VARCHAR(10),
   title         VARCHAR(50),
   description   TEXT NOT NULL,

   CONSTRAINT fk_categories_codes
     FOREIGN KEY (parent_code)
     REFERENCES categories (code)
     ON DELETE SET NULL
);

-- Index for quick lookup of subcategories by parent
CREATE INDEX IF NOT EXISTS idx_categories_parent_code
  ON categories(parent_code);

-- Documentation
COMMENT ON TABLE categories IS 'Recipe categories in a simple hierarchy (self-referential).';
COMMENT ON COLUMN categories.code IS 'Short, stable category identifier (e.g., "DSRT"). Max 5 chars; primary key.';
COMMENT ON COLUMN categories.parent_code IS 'Optional parent category; NULL for top-level. References categories.category_code.';
COMMENT ON COLUMN categories.title IS 'Category title viewable on the page';
COMMENT ON COLUMN categories.description IS 'Human-readable category description.';

-- ============================================================
-- 2. Units
-- Canonical measurement units for ingredient quantities.
-- ============================================================
CREATE TABLE units (
   id           BIGSERIAL PRIMARY KEY,
   name         TEXT NOT NULL,
   description  TEXT NOT NULL,

   CONSTRAINT uq_units_name UNIQUE (name)
);

COMMENT ON TABLE units IS 'Canonical measurement units for ingredient quantities.';
COMMENT ON COLUMN units.id IS 'Surrogate key for units.';
COMMENT ON COLUMN units.name IS 'Unit code name (e.g., "g", "kg", "tsp", "cup").';
COMMENT ON COLUMN units.description IS 'Display name/description of the unit.';

-- ============================================================
-- 3. Recipes
-- Master table of recipes with metadata and category assignment.
-- ============================================================
CREATE TABLE recipes (
   id            BIGSERIAL PRIMARY KEY,
   name          VARCHAR(50) NOT NULL,
   description	 TEXT,
   author        VARCHAR(50),
   servings      SMALLINT,
   prep_time     SMALLINT,
   cook_time     SMALLINT,
   keywords      TEXT,
   category_code VARCHAR(10) NOT NULL,
   activity_date TIMESTAMPTZ NOT NULL DEFAULT now(),
   
   CONSTRAINT fk_recipe_category_code
     FOREIGN KEY (category_code)
     REFERENCES categories (code)
     ON DELETE RESTRICT,
	 
   CONSTRAINT ck_recipes_servings
     CHECK (servings > 0),
   CONSTRAINT ck_recipes_prep_time
     CHECK (prep_time >= 0),	 
   CONSTRAINT ck_recipes_cook_time
     CHECK (cook_time >= 0)	 
);

-- Indexes for category lookups and keyword searching
CREATE INDEX IF NOT EXISTS idx_recipe_category_code ON recipes(category_code);
CREATE INDEX IF NOT EXISTS idx_recipe_keywords      ON recipes(keywords);

COMMENT ON TABLE recipes IS 'Top-level recipes with basic metadata and category assignment.';
COMMENT ON COLUMN recipes.id IS 'Surrogate key for recipes.';
COMMENT ON COLUMN recipes.name IS 'Short recipe title (<= 50 chars).';
COMMENT ON COLUMN recipes.description IS 'Free-text recipe overview/notes.';
COMMENT ON COLUMN recipes.author IS 'Optional author/source field (free text).';
COMMENT ON COLUMN recipes.servings IS 'Number of portions the recipe makes. Smallint; must be > 0.';
COMMENT ON COLUMN recipes.prep_time IS 'Preparation time in minutes (chopping, mixing, etc.). Smallint; must be >= 0.';
COMMENT ON COLUMN recipes.cook_time IS 'Cooking time in minutes (baking, simmering, etc.). Smallint; must be >= 0.';
COMMENT ON COLUMN recipes.keywords IS 'Free-text keywords for search/discovery.';
COMMENT ON COLUMN recipes.category_code IS 'FK to categories.category_code. Classifies the recipe.';
COMMENT ON COLUMN recipes.activity_date IS 'Timestamp for creation/update activity; defaults to now().';

-- ============================================================
-- 4. Ingredients
-- Normalized list of ingredients used across recipes.
-- ============================================================
CREATE TABLE ingredients (
   id          BIGSERIAL PRIMARY KEY,
   name        TEXT NOT NULL,
   description TEXT,
   
   CONSTRAINT uq_ingredients_name UNIQUE (name)
);

COMMENT ON TABLE ingredients IS 'Normalized list of ingredients.';
COMMENT ON COLUMN ingredients.id IS 'Surrogate key for ingredients.';
COMMENT ON COLUMN ingredients.name IS 'Ingredient display name (<= 50 chars). Consider enforcing case-insensitive uniqueness.';
COMMENT ON COLUMN ingredients.description IS 'Optional notes or clarifications for the ingredient.';

-- ============================================================
-- 5. Recipe ↔ Ingredients (xref)
-- Join table linking recipes to their ingredients, with quantities.
-- ============================================================
CREATE TABLE recipe_ingredients (
   recipe_id      BIGINT NOT NULL,
   ingredient_id  BIGINT NOT NULL,
   quantity       NUMERIC(10,3),
   unit_id	      BIGINT,
   ranking		  SMALLINT NOT NULL,
   optional       SMALLINT,
   
   PRIMARY KEY (recipe_id, ingredient_id),
   CONSTRAINT fk_recipe_ingredient_recipe_id
     FOREIGN KEY (recipe_id) REFERENCES recipes (id) ON DELETE CASCADE,
   CONSTRAINT fk_recipe_ingredient_ingredient_id
     FOREIGN KEY (ingredient_id) REFERENCES ingredients (id) ON DELETE RESTRICT,
   CONSTRAINT fk_recipe_ingredient_unit
     FOREIGN KEY (unit_id) REFERENCES units (id) ON DELETE RESTRICT,
   CONSTRAINT ck_recipe_ingredients_quantity
     CHECK (quantity IS NULL OR quantity > 0)
);

-- Composite index for efficient lookups by ingredient → recipes
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient_recipe
  ON recipe_ingredients (ingredient_id, recipe_id);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_unit
  ON recipe_ingredients (unit_id);

COMMENT ON TABLE recipe_ingredients IS 'Join table linking recipes to ingredients with quantity + unit.';
COMMENT ON COLUMN recipe_ingredients.recipe_id IS 'FK to recipes.id.';
COMMENT ON COLUMN recipe_ingredients.ingredient_id IS 'FK to ingredients.id.';
COMMENT ON COLUMN recipe_ingredients.quantity IS 'Amount of the ingredient (nullable; e.g., NULL for "to taste"). NUMERIC(8,2).';
COMMENT ON COLUMN recipe_ingredients.unit_id IS 'FK to units.id describing the quantity unit (nullable if quantity is NULL).';
COMMENT ON COLUMN recipe_ingredients.ranking IS 'The order/ranking the ingredients are displayed.';
COMMENT ON COLUMN recipe_ingredients.optional IS 'Signifies if the ingredient is optional or not. 1 = optional';

-- ============================================================
-- 6. Recipe Steps
-- Ordered preparation instructions for each recipe.
-- ============================================================
CREATE TABLE recipe_steps (
   id	       BIGSERIAL PRIMARY KEY,
   recipe_id   BIGINT    NOT NULL,
   description TEXT      NOT NULL,
   ranking     SMALLINT  NOT NULL,
   
   CONSTRAINT fk_recipe_steps_recipe_id
     FOREIGN KEY (recipe_id) REFERENCES recipes (id) ON DELETE CASCADE,
   CONSTRAINT ck_recipe_steps_ranking_pos CHECK (ranking > 0),
   CONSTRAINT uq_recipe_steps_per_recipe UNIQUE (recipe_id, ranking)
);

CREATE INDEX IF NOT EXISTS idx_recipe_steps_recipe_id
  ON recipe_steps(recipe_id);

COMMENT ON TABLE recipe_steps IS 'Ordered preparation steps for a recipe.';
COMMENT ON COLUMN recipe_steps.id IS 'Surrogate key for step rows.';
COMMENT ON COLUMN recipe_steps.recipe_id IS 'FK to recipes.id.';
COMMENT ON COLUMN recipe_steps.description IS 'Instruction text for the step.';
COMMENT ON COLUMN recipe_steps.ranking IS '1-based step order; positive smallint.';


-- ============================================================
-- 7. Recipe Images
-- Images of the Recipe dishes.
-- ============================================================
CREATE TABLE recipe_images (
   id         BIGSERIAL PRIMARY KEY,
   recipe_id  BIGINT NOT NULL,
   url        TEXT NOT NULL,
   alt        TEXT,
   sort_order INTEGER,
   
   CONSTRAINT fk_recipe_images_id
     FOREIGN KEY (recipe_id) REFERENCES recipes (id) ON DELETE CASCADE
);

CREATE INDEX idx_recipe_images_recipe ON recipe_images(recipe_id, sort_order);

COMMENT ON TABLE recipe_images IS 'Images associated with a recipe, stored with metadata for ordering and accessibility.';
COMMENT ON COLUMN recipe_images.id IS 'Surrogate key for image rows.';
COMMENT ON COLUMN recipe_images.recipe_id IS 'FK to recipes.id. Each image belongs to one recipe.';
COMMENT ON COLUMN recipe_images.url IS 'Path/URL or storage key pointing to the image asset.';
COMMENT ON COLUMN recipe_images.alt IS 'Alternative text for accessibility or descriptive caption.';
COMMENT ON COLUMN recipe_images.sort_order IS 'Numeric sort order for images within a recipe (lower numbers appear first).';

-- ============================================================
-- End of schema
-- ============================================================
