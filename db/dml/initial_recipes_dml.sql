-- Seed data for a new, empty schema (run after db/ddl/recipes_ddl.sql).
-- Ids are looked up by name rather than hard-coded, so it works whatever the sequences hand out.
SET search_path TO myrecipes;

-- Add units
INSERT INTO units (name, description) VALUES ('cnt', 'Count');
INSERT INTO units (name, description) VALUES ('tsp', 'Teaspoon(s)');
INSERT INTO units (name, description) VALUES ('tbsp', 'Tablespoon(s)');
INSERT INTO units (name, description) VALUES ('fl oz', 'Fluid Ounce(s)');
INSERT INTO units (name, description) VALUES ('c', 'Cup(s)');
INSERT INTO units (name, description) VALUES ('pt', 'Pint(s)');
INSERT INTO units (name, description) VALUES ('qt', 'Quart(s)');
INSERT INTO units (name, description) VALUES ('gal', 'Gallon(s)');
INSERT INTO units (name, description) VALUES ('oz', 'Ounce(s)');
INSERT INTO units (name, description) VALUES ('lb', 'Pound(s)');
INSERT INTO units (name, description) VALUES ('mL', 'Milliliter(s)');
INSERT INTO units (name, description) VALUES ('L', 'Liter(s)');
INSERT INTO units (name, description) VALUES ('g', 'Gram(s)');
INSERT INTO units (name, description) VALUES ('kg', 'Kilogram(s)');

-- Categories
INSERT INTO categories (code, parent_code, title, description) values ('ALL', NULL, 'All', 'Root category for all categories');
INSERT INTO categories (code, parent_code, title, description) values ('BRD00', 'ALL', 'Breads', 'Base category for bread recipes');
INSERT INTO categories (code, parent_code, title, description) values ('BRDQU', 'BRD00', 'Quick Breads', 'Quick bread recipes (biscuits, soda breads, muffins, etc)');
INSERT INTO categories (code, parent_code, title, description) values ('BRDFR', 'BRDQU', 'Fruit Breads', 'Fruit Breads: (Banana, zucchini, pumpkin, etc');
INSERT INTO categories (code, parent_code, title, description) values ('BRDMF', 'BRDQU', 'Muffins', 'Any type of Muffins');
INSERT INTO categories (code, parent_code, title, description) values ('BRDBS', 'BRDQU', 'Biscuits', 'Any type of Biscuits');

-- Add a recipe
INSERT INTO recipes (name, description, author, servings, prep_time, cook_time, keywords, category_code) VALUES ('Mom''s Zucchini Bread', 'Zucchini bread recipe from mom. Given by Papa.', 'Suzanne Gatewood', 8, 90, 60,'mom,family', 'BRDFR');

INSERT INTO recipe_ingredients (recipe_id, ingredient_description, quantity, unit_id, ranking, optional) VALUES ((SELECT id FROM recipes WHERE name = 'Mom''s Zucchini Bread'), 'all-purpose flour', 3, (SELECT id FROM units WHERE name = 'c'), 1, NULL); --Flour
INSERT INTO recipe_ingredients (recipe_id, ingredient_description, quantity, unit_id, ranking, optional) VALUES ((SELECT id FROM recipes WHERE name = 'Mom''s Zucchini Bread'), 'Salt', 1, (SELECT id FROM units WHERE name = 'tsp'), 2, NULL); --Salt
INSERT INTO recipe_ingredients (recipe_id, ingredient_description, quantity, unit_id, ranking, optional) VALUES ((SELECT id FROM recipes WHERE name = 'Mom''s Zucchini Bread'), 'baking soda', 1, (SELECT id FROM units WHERE name = 'tsp'), 3, NULL); --Baking Soda
INSERT INTO recipe_ingredients (recipe_id, ingredient_description, quantity, unit_id, ranking, optional) VALUES ((SELECT id FROM recipes WHERE name = 'Mom''s Zucchini Bread'), 'baking powder', 1, (SELECT id FROM units WHERE name = 'tsp'), 4, NULL); --Baking Powder
INSERT INTO recipe_ingredients (recipe_id, ingredient_description, quantity, unit_id, ranking, optional) VALUES ((SELECT id FROM recipes WHERE name = 'Mom''s Zucchini Bread'), 'Ground cinnamon', 3, (SELECT id FROM units WHERE name = 'tsp'), 5, NULL); --Cinnamon
INSERT INTO recipe_ingredients (recipe_id, ingredient_description, quantity, unit_id, ranking, optional) VALUES ((SELECT id FROM recipes WHERE name = 'Mom''s Zucchini Bread'), 'Eggs', 3, (SELECT id FROM units WHERE name = 'cnt'), 6, NULL); --Eggs
INSERT INTO recipe_ingredients (recipe_id, ingredient_description, quantity, unit_id, ranking, optional) VALUES ((SELECT id FROM recipes WHERE name = 'Mom''s Zucchini Bread'), 'Vegetable Oil', 1, (SELECT id FROM units WHERE name = 'c'), 7, NULL); --Vegetable Oil
INSERT INTO recipe_ingredients (recipe_id, ingredient_description, quantity, unit_id, ranking, optional) VALUES ((SELECT id FROM recipes WHERE name = 'Mom''s Zucchini Bread'), 'White sugar', 2.25, (SELECT id FROM units WHERE name = 'c'), 8, NULL); --White Sugar
INSERT INTO recipe_ingredients (recipe_id, ingredient_description, quantity, unit_id, ranking, optional) VALUES ((SELECT id FROM recipes WHERE name = 'Mom''s Zucchini Bread'), 'Vanilla Extract', 3, (SELECT id FROM units WHERE name = 'tsp'), 9, NULL); --Vanilla Extract
INSERT INTO recipe_ingredients (recipe_id, ingredient_description, quantity, unit_id, ranking, optional) VALUES ((SELECT id FROM recipes WHERE name = 'Mom''s Zucchini Bread'), 'Grated Zucchini', 2, (SELECT id FROM units WHERE name = 'c'), 10, NULL); --Zucchini
INSERT INTO recipe_ingredients (recipe_id, ingredient_description, quantity, unit_id, ranking, optional) VALUES ((SELECT id FROM recipes WHERE name = 'Mom''s Zucchini Bread'), 'Chopped Walnuts', 1, (SELECT id FROM units WHERE name = 'c'), 11, 1); --Walnuts

INSERT INTO recipe_steps (recipe_id, description, ranking) values ((SELECT id FROM recipes WHERE name = 'Mom''s Zucchini Bread'), 'Grease and flour two 8x4 inch pans. Preheat oven to 325(F) degrees.', 1);
INSERT INTO recipe_steps (recipe_id, description, ranking) values ((SELECT id FROM recipes WHERE name = 'Mom''s Zucchini Bread'), 'Sift flour, salt, baking powder, soda, and cinnamon together in a bowl', 2);
INSERT INTO recipe_steps (recipe_id, description, ranking) values ((SELECT id FROM recipes WHERE name = 'Mom''s Zucchini Bread'), 'Beat eggs, oil, vanilla, and sugar together in a large bowl. Add sifted ingredients to the creamed mixture and beat well.', 3);
INSERT INTO recipe_steps (recipe_id, description, ranking) values ((SELECT id FROM recipes WHERE name = 'Mom''s Zucchini Bread'), 'Stir in zucchini and nuts until well combined. Pour batter into prepared pans.', 4);
INSERT INTO recipe_steps (recipe_id, description, ranking) values ((SELECT id FROM recipes WHERE name = 'Mom''s Zucchini Bread'), 'Bake for 40-60 minutes (until toothpick test comes out clean).', 5);
INSERT INTO recipe_steps (recipe_id, description, ranking) values ((SELECT id FROM recipes WHERE name = 'Mom''s Zucchini Bread'), 'Remove bread from pans and let completely cool on a cooling rack', 6);
