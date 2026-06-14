-- Add units
INSERT INTO units (name, description) VALUES ('cnt', 'Count');
INSERT INTO units (name, description) VALUES ('tsp', 'Teaspoon(s)');
INSERT INTO units (name, description) VALUES ('tbps', 'Tablespoon(s)');
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

-- Add Ingredients
INSERT INTO ingredients (name, description) VALUES ('all-purpose flour','all-purpose flour');
INSERT INTO ingredients (name, description) VALUES ('Salt','Salt');
INSERT INTO ingredients (name, description) VALUES ('baking soda','baking soda');
INSERT INTO ingredients (name, description) VALUES ('baking powder','baking powder');
INSERT INTO ingredients (name, description) VALUES ('cinnamon (ground)','Ground cinnamon');
INSERT INTO ingredients (name, description) VALUES ('egg(s)','Eggs');
INSERT INTO ingredients (name, description) VALUES ('vegetable oil','Vegetable Oil');
INSERT INTO ingredients (name, description) VALUES ('sugar (white)','White sugar');
INSERT INTO ingredients (name, description) VALUES ('vanilla extract','Vanilla Extract');
INSERT INTO ingredients (name, description) VALUES ('zucchini (grated)','Grated Zucchini');
INSERT INTO ingredients (name, description) VALUES ('walnuts (chopped)','Chopped Walnuts');

-- Categories
INSERT INTO categories (code, parent_code, title, description) values ('ALL', NULL, 'All', 'Root category for all categories');
INSERT INTO categories (code, parent_code, title, description) values ('BRD00', 'ALL', 'Breads', 'Base category for bread recipes');
INSERT INTO categories (code, parent_code, title, description) values ('BRDQU', 'BRD00', 'Quick Breads', 'Quick bread recipes (buscuits, soda breads, muffins, etc)');
INSERT INTO categories (code, parent_code, title, description) values ('BRDFR', 'BRDQU', 'Fruit Breads', 'Fruit Breads: (Banana, zucchini, pumpkin, etc');
INSERT INTO categories (code, parent_code, title, description) values ('BRDMF', 'BRDQU', 'Muffins', 'Any type of Muffins');
INSERT INTO categories (code, parent_code, title, description) values ('BRDBS', 'BRDQU', 'Buiscuits', 'Any type of Buiscuits');

-- Add a recipe
INSERT INTO recipes (name, description, author, servings, prep_time, cook_time, keywords, category_code) VALUES ('Mom''s Zuchinni Bread', 'Zuchinni bread recipe from mom. Given by Papa.', 'Suzanne Gatewood', 8, 90, 60,'mom,family', 'BRDFR');

INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit_id, ranking, optional) VALUES (2, 12, 3, 17, 1, NULL); --Flour
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit_id, ranking, optional) VALUES (2, 13, 1, 14, 2, NULL); --Salt
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit_id, ranking, optional) VALUES (2, 14, 1, 14, 3, NULL); --Baking Soda
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit_id, ranking, optional) VALUES (2, 15, 1, 14, 4, NULL); --Baking Powder
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit_id, ranking, optional) VALUES (2, 16, 3, 14, 5, NULL); --Cinnamon
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit_id, ranking, optional) VALUES (2, 17, 3, 27, 6, NULL); --Eggs
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit_id, ranking, optional) VALUES (2, 18, 1, 17, 7, NULL); --Vegetable Oil
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit_id, ranking, optional) VALUES (2, 19, 2.25, 17, 8, NULL); --White Sugar
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit_id, ranking, optional) VALUES (2, 20, 3, 14, 9, NULL); --Vanilla Extract
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit_id, ranking, optional) VALUES (2, 21, 2, 17, 10, NULL); --Zuchinni
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit_id, ranking, optional) VALUES (2, 22, 1, 17, 11, 1); --Walnuts

INSERT INTO recipe_steps (recipe_id, description, ranking) values (2, 'Grease and flour two 8x4 inch pans. Preheat oven to 325(F) degrees.', 1);
INSERT INTO recipe_steps (recipe_id, description, ranking) values (2, 'Sift flour, salt, baking powder, soda, and cinnamon together in a bowl', 2);
INSERT INTO recipe_steps (recipe_id, description, ranking) values (2, 'Beat eggs, oil, vanilla, and sugar together in a large bowl. Add sifted ingredients to the creamed mixture and beat well.', 3);
INSERT INTO recipe_steps (recipe_id, description, ranking) values (2, 'Stir in zucchini and nuts until well combined. Pour batter into prepared pans.', 4);
INSERT INTO recipe_steps (recipe_id, description, ranking) values (2, 'Bake for 40-60 minutes (until toothpick test comes out clean).', 5);
INSERT INTO recipe_steps (recipe_id, description, ranking) values (2, 'Remove bread from pans and let completely cool on a cooling rack', 6);
