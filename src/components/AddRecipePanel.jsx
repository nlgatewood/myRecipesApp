import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getRecipeDetails, getRecipeImages, getRecipeIngredients, getRecipeSteps, imageSrc, insertRecipe,
         listCategories, listUnits, saveRecipeImages, updateRecipe } from '../api';
import { formatQuantity } from '../format';
import styles from '../css/AddRecipe.module.css';

const EMPTY_FORM = {
   name: '',
   categoryCode: '',
   author: '',
   description: '',
   keywords: '',
   servings: '',
   prepTime: '',
   cookTime: ''
};

const MAX_SMALLINT = 32767;

//Same limits as PUT /api/recipes/:id/images
const MAX_IMAGES = 20;
const MAX_IMAGE_MB = 20;
const IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/gif';

//Parses "2", "1.5", "1/2" or "1 1/2". Returns null when blank and NaN when it can't be read
function parseQuantity(text) {

   const value = text.trim();
   if (!value) return null;

   const mixed = value.match(/^(\d+)\s+(\d+)\/(\d+)$/);
   const fraction = value.match(/^(\d+)\/(\d+)$/);

   const n = mixed ? Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3])
           : fraction ? Number(fraction[1]) / Number(fraction[2])
           : Number(value);

   //Catches "1/0" (Infinity) as well as text that isn't a number
   return Number.isFinite(n) ? n : NaN;
}

//Turns the flat category list into "Breads › Quick Breads" labels so nested categories are easy to tell apart
function buildCategoryOptions(categories) {

   const byCode = new Map(categories.map(c => [c.code, c]));

   return categories
      .filter(c => c.parent_code)   // skip the root 'All' category
      .map(c => {
         const titles = [];
         for (let cur = c, depth = 0; cur?.parent_code && depth < 20; cur = byCode.get(cur.parent_code), depth++) {
            titles.unshift(cur.title);
         }
         return { code: c.code, label: titles.join(' › ') };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
}

//Checks a whole-number form value. Blank is allowed
function isWholeNumber(value, min) {
   if (value === '') return true;
   const n = Number(value);
   return Number.isInteger(n) && n >= min && n <= MAX_SMALLINT;
}

const toText = (value) => (value === null || value === undefined ? '' : String(value));

function FieldError({ message }) {
   return message ? <p className={styles.error}>{message}</p> : null;
}

export default function AddRecipe() {

   const navigate = useNavigate();
   const [searchParams] = useSearchParams();   // ?category=BRDFR pre-selects the category (linked from the Home page)

   //Same form for adding (/add-recipe) and editing (/recipes/:recipeId/edit)
   const { recipeId } = useParams();
   const editing = Boolean(recipeId);

   //Row keys come from a counter (crypto.randomUUID isn't available over plain http)
   const nextKey = useRef(0);
   const newIngredient = () => ({ key: nextKey.current++, description: '', quantity: '', unitId: '', optional: false });
   const newStep = () => ({ key: nextKey.current++, description: '' });

   const [form, setForm] = useState(() => ({ ...EMPTY_FORM, categoryCode: searchParams.get('category') ?? '' }));
   const [ingredients, setIngredients] = useState(() => [newIngredient(), newIngredient(), newIngredient()]);
   const [steps, setSteps] = useState(() => [newStep(), newStep(), newStep()]);

   //Photos: saved ones have an id and url, new ones a File and a local preview URL
   const [images, setImages] = useState([]);
   const [imageError, setImageError] = useState('');
   const previewUrls = useRef(new Set());

   //A new recipe whose photos failed to upload is already saved; retrying updates it instead of adding a copy
   const savedId = useRef(null);

   const [categories, setCategories] = useState([]);
   const [units, setUnits] = useState([]);

   const [errors, setErrors] = useState({});
   const [loadError, setLoadError] = useState('');
   const [saveError, setSaveError] = useState('');
   const [saving, setSaving] = useState(false);
   const [recipeStatus, setRecipeStatus] = useState(editing ? 'loading' : 'ready');   // loading | ready | notFound | error

   //Edit mode: fill the form from the saved recipe
   useEffect(() => {

      if (!recipeId) return;

      async function loadRecipe() {

         try {
            const [recipe, ingredientData, stepData, imageData] = await Promise.all([
               getRecipeDetails(recipeId),
               getRecipeIngredients(recipeId),
               getRecipeSteps(recipeId),
               getRecipeImages(recipeId)
            ]);

            if (!recipe) {
               setRecipeStatus('notFound');
               return;
            }

            setForm({
               name: toText(recipe.name),
               categoryCode: toText(recipe.category_code),
               author: toText(recipe.author),
               description: toText(recipe.description),
               keywords: toText(recipe.keywords),
               servings: toText(recipe.servings),
               prepTime: toText(recipe.prep_time),
               cookTime: toText(recipe.cook_time)
            });

            setIngredients(ingredientData.map(i => ({
               key: nextKey.current++,
               description: toText(i.ingredient_description),
               quantity: formatQuantity(i.quantity),   // "1.500" -> "1 1/2"
               unitId: toText(i.unit_id),
               optional: i.optional === 1
            })));

            setSteps(stepData.map(s => ({ key: nextKey.current++, description: s.description })));
            setImages(imageData.map(i => ({ key: nextKey.current++, id: i.id, src: imageSrc(i.url), alt: toText(i.alt) })));
            setRecipeStatus('ready');

         } catch (err) {
            console.error("Failed to load Recipe:", err);
            setRecipeStatus('error');
         }
      }

      loadRecipe();
   }, [recipeId]);

   //Leave the form. When editing, go back to the recipe page we came from rather than stacking another copy in history
   const leave = () => {
      if (editing && window.history.state?.idx > 0) navigate(-1);
      else navigate(editing ? `/recipes/${recipeId}` : '/', { replace: editing });
   };

   useEffect(() => {

      async function loadOptions() {

         try {
            const [categoryData, unitData] = await Promise.all([
               listCategories(),
               listUnits()
            ]);

            setCategories(buildCategoryOptions(categoryData));
            setUnits(unitData);

         } catch (err) {
            console.error("Failed to load form options:", err);
            setLoadError('Could not load categories and units. Check that the API is running.');
         }
      }

      loadOptions();
   }, []);

   //Free the local previews when leaving the page
   useEffect(() => {
      const urls = previewUrls.current;
      return () => urls.forEach(url => URL.revokeObjectURL(url));
   }, []);

   function addImages(e) {

      const picked = [...e.target.files];
      e.target.value = '';   // lets the same file be picked again after removing it
      setImageError('');

      const tooBig = picked.filter(f => f.size > MAX_IMAGE_MB * 1024 * 1024);
      const accepted = picked.filter(f => f.type.startsWith('image/') && !tooBig.includes(f))
                             .slice(0, MAX_IMAGES - images.length);

      if (tooBig.length) setImageError(`Skipped ${tooBig.map(f => f.name).join(', ')}: photos must be ${MAX_IMAGE_MB} MB or smaller.`);
      else if (accepted.length < picked.length) setImageError(`A recipe can have up to ${MAX_IMAGES} photos.`);

      const added = accepted.map(file => {
         const src = URL.createObjectURL(file);
         previewUrls.current.add(src);
         return { key: nextKey.current++, file, src, alt: '' };
      });

      setImages(prev => [...prev, ...added]);
   }

   function removeImage(image) {
      if (image.file) {
         URL.revokeObjectURL(image.src);
         previewUrls.current.delete(image.src);
      }
      removeRow(setImages, image.key);
   }

   const updateField = (e) => {
      const { name, value } = e.target;
      setForm(prev => ({ ...prev, [name]: value }));
   };

   //Shared helpers for the ingredient and step lists
   const updateRow = (setList, key, changes) =>
      setList(prev => prev.map(row => (row.key === key ? { ...row, ...changes } : row)));

   const removeRow = (setList, key) =>
      setList(prev => prev.filter(row => row.key !== key));

   const moveRow = (setList, index, offset) =>
      setList(prev => {
         const target = index + offset;
         if (target < 0 || target >= prev.length) return prev;

         const next = [...prev];
         [next[index], next[target]] = [next[target], next[index]];
         return next;
      });

   //Validates the form and builds the API payload. Blank ingredient/step rows are ignored
   function validate() {

      const found = {};
      const name = form.name.trim();

      if (!name) found.name = 'Recipe name is required.';
      else if (name.length > 50) found.name = 'Keep the name to 50 characters or fewer.';

      if (form.author.trim().length > 50) found.author = 'Keep the author to 50 characters or fewer.';
      if (!form.categoryCode) found.categoryCode = 'Pick a category.';

      if (!isWholeNumber(form.servings, 1)) found.servings = 'Servings must be a whole number above 0.';
      if (!isWholeNumber(form.prepTime, 0)) found.prepTime = 'Enter prep time in whole minutes.';
      if (!isWholeNumber(form.cookTime, 0)) found.cookTime = 'Enter cook time in whole minutes.';

      const ingredientRows = [];

      for (const row of ingredients) {

         const ingredientDescription = row.description.trim();
         if (!ingredientDescription && !row.quantity.trim() && !row.unitId) continue;

         const quantity = parseQuantity(row.quantity);
         const errorKey = `ingredient-${row.key}`;

         if (!ingredientDescription) found[errorKey] = 'Enter the ingredient.';
         else if (quantity !== null && (Number.isNaN(quantity) || quantity <= 0)) {
            found[errorKey] = 'Quantity must be a number like 2, 1.5, 1/2 or 1 1/2.';
         }

         ingredientRows.push({
            ingredient_description: ingredientDescription,
            quantity,
            unit_id: row.unitId ? Number(row.unitId) : null,
            optional: row.optional
         });
      }

      const stepRows = steps
         .map(step => step.description.trim())
         .filter(Boolean)
         .map(description => ({ description }));

      const payload = {
         name,
         category_code: form.categoryCode,
         author: form.author.trim(),
         description: form.description.trim(),
         keywords: form.keywords.trim(),
         servings: form.servings,
         prep_time: form.prepTime,
         cook_time: form.cookTime,
         ingredients: ingredientRows,
         steps: stepRows
      };

      return { found, payload };
   }

   async function onSubmit(e) {

      e.preventDefault();
      setSaveError('');

      const { found, payload } = validate();
      setErrors(found);

      if (Object.keys(found).length > 0) return;

      setSaving(true);

      let id = recipeId ?? savedId.current;

      try {
         if (id) await updateRecipe(id, payload);
         else id = savedId.current = (await insertRecipe(payload)).id;
      } catch (err) {
         console.error("Failed to save recipe:", err);
         setSaveError(err.message || 'Failed to save the recipe.');
         setSaving(false);
         return;
      }

      try {
         //Editing always syncs, so removed photos get deleted. A new recipe only needs it when photos were added
         if (editing || images.length) {
            const saved = await saveRecipeImages(id, images.map(({ id, file, alt }) => ({ id, file, alt: alt.trim() })));
            setImages(saved.map(i => ({ key: nextKey.current++, id: i.id, src: imageSrc(i.url), alt: toText(i.alt) })));
         }
      } catch (err) {
         console.error("Failed to save photos:", err);
         setSaveError(`The recipe was saved, but the photos weren't: ${err.message || 'upload failed'}`);
         setSaving(false);
         return;
      }

      if (editing) leave();   // the recipe page reloads its data when it mounts again
      else navigate(`/recipes/${id}`);
   }

   const errorCount = Object.keys(errors).length;

   if (recipeStatus !== 'ready') {

      const messages = {
         loading: 'Loading recipe…',
         notFound: "We couldn't find that recipe.",
         error: 'Something went wrong loading this recipe. Check that the API is running.'
      };

      return (
         <div className={styles.page}>
            <div className={`${styles.card} ${styles.message}`}>
               <p role={recipeStatus === 'loading' ? 'status' : 'alert'}>{messages[recipeStatus]}</p>
               {recipeStatus !== 'loading' && (
                  <button type="button" className={styles.cancelBtn} onClick={() => navigate('/')}>← Back to categories</button>
               )}
            </div>
         </div>
      );
   }

   return (
      <div className={styles.page}>
         <div className={styles.card}>

            <header className={styles.header}>
               <h1 className={styles.title}>{editing ? 'Edit recipe' : 'Add a recipe'}</h1>
               <p className={styles.subtitle}>
                  {editing
                     ? 'Update the details below and save your changes.'
                     : 'Fill out the details below to save a new recipe.'} Only the name and category are required.
               </p>
            </header>

            {loadError && <p className={styles.banner} role="alert">{loadError}</p>}

            <form onSubmit={onSubmit} className={styles.form} noValidate>

               {/* ---------- Recipe Info ---------- */}
               <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Recipe info</h2>

                  <div className={styles.grid2}>
                     <label className={styles.field}>
                        <span className={styles.label}>Recipe name <span className={styles.required}>*</span></span>
                        <input
                           type="text"
                           name="name"
                           value={form.name}
                           onChange={updateField}
                           maxLength={50}
                           placeholder="Classic Pancakes"
                           aria-invalid={!!errors.name}
                        />
                        <FieldError message={errors.name} />
                     </label>

                     <label className={styles.field}>
                        <span className={styles.label}>Category <span className={styles.required}>*</span></span>
                        <select
                           name="categoryCode"
                           value={form.categoryCode}
                           onChange={updateField}
                           aria-invalid={!!errors.categoryCode}
                        >
                           <option value="">Select a category…</option>
                           {categories.map(c => (
                              <option key={c.code} value={c.code}>{c.label}</option>
                           ))}
                        </select>
                        <FieldError message={errors.categoryCode} />
                     </label>

                     <label className={`${styles.field} ${styles.fullWidth}`}>
                        <span className={styles.label}>Description</span>
                        <textarea
                           name="description"
                           value={form.description}
                           onChange={updateField}
                           rows="4"
                           placeholder="A quick, fluffy pancake recipe for weekend mornings."
                        />
                     </label>

                     <label className={styles.field}>
                        <span className={styles.label}>Author</span>
                        <input
                           type="text"
                           name="author"
                           value={form.author}
                           onChange={updateField}
                           maxLength={50}
                           placeholder="Who the recipe came from"
                           aria-invalid={!!errors.author}
                        />
                        <FieldError message={errors.author} />
                     </label>

                     <label className={styles.field}>
                        <span className={styles.label}>Keywords</span>
                        <input
                           type="text"
                           name="keywords"
                           value={form.keywords}
                           onChange={updateField}
                           placeholder="breakfast, family, quick"
                        />
                        <span className={styles.hint}>Comma-separated, used for searching later.</span>
                     </label>
                  </div>
               </section>

               {/* ---------- Time & Servings ---------- */}
               <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Time &amp; servings</h2>

                  <div className={styles.grid3}>
                     <label className={styles.field}>
                        <span className={styles.label}>Servings</span>
                        <input
                           type="number"
                           name="servings"
                           value={form.servings}
                           onChange={updateField}
                           min="1"
                           max={MAX_SMALLINT}
                           step="1"
                           inputMode="numeric"
                           placeholder="4"
                           aria-invalid={!!errors.servings}
                        />
                        <FieldError message={errors.servings} />
                     </label>

                     <label className={styles.field}>
                        <span className={styles.label}>Prep time</span>
                        <div className={styles.suffixInput}>
                           <input
                              type="number"
                              name="prepTime"
                              value={form.prepTime}
                              onChange={updateField}
                              min="0"
                              max={MAX_SMALLINT}
                              step="1"
                              inputMode="numeric"
                              placeholder="10"
                              aria-invalid={!!errors.prepTime}
                           />
                           <span aria-hidden="true">min</span>
                        </div>
                        <FieldError message={errors.prepTime} />
                     </label>

                     <label className={styles.field}>
                        <span className={styles.label}>Cook time</span>
                        <div className={styles.suffixInput}>
                           <input
                              type="number"
                              name="cookTime"
                              value={form.cookTime}
                              onChange={updateField}
                              min="0"
                              max={MAX_SMALLINT}
                              step="1"
                              inputMode="numeric"
                              placeholder="15"
                              aria-invalid={!!errors.cookTime}
                           />
                           <span aria-hidden="true">min</span>
                        </div>
                        <FieldError message={errors.cookTime} />
                     </label>
                  </div>
               </section>

               {/* ---------- Ingredients ---------- */}
               <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Ingredients</h2>
                  <p className={styles.hint}>Type each ingredient the way you want it to read, e.g. “all-purpose flour, sifted”.</p>

                  <div className={styles.list}>
                     {ingredients.length > 0 && (
                        <div className={`${styles.ingredientRow} ${styles.headerRow}`} aria-hidden="true">
                           <span>Quantity</span>
                           <span>Unit</span>
                           <span>Ingredient</span>
                           <span>Optional</span>
                           <span />
                        </div>
                     )}

                     {ingredients.map((row, index) => {
                        const error = errors[`ingredient-${row.key}`];

                        return (
                           <div key={row.key} className={`${styles.ingredientRow} ${error ? styles.rowInvalid : ''}`}>
                              <label className={styles.cell}>
                                 <span className={styles.cellLabel}>Quantity</span>
                                 <input
                                    type="text"
                                    value={row.quantity}
                                    onChange={e => updateRow(setIngredients, row.key, { quantity: e.target.value })}
                                    placeholder="1 1/2"
                                 />
                              </label>

                              <label className={styles.cell}>
                                 <span className={styles.cellLabel}>Unit</span>
                                 <select
                                    value={row.unitId}
                                    onChange={e => updateRow(setIngredients, row.key, { unitId: e.target.value })}
                                 >
                                    <option value="">No unit</option>
                                    {units.map(u => (
                                       <option key={u.id} value={u.id}>{u.description}</option>
                                    ))}
                                 </select>
                              </label>

                              <label className={`${styles.cell} ${styles.ingredientCell}`}>
                                 <span className={styles.cellLabel}>Ingredient</span>
                                 <input
                                    type="text"
                                    value={row.description}
                                    onChange={e => updateRow(setIngredients, row.key, { description: e.target.value })}
                                    placeholder="All-purpose flour"
                                 />
                              </label>

                              <label className={styles.checkboxCell}>
                                 <input
                                    type="checkbox"
                                    checked={row.optional}
                                    onChange={e => updateRow(setIngredients, row.key, { optional: e.target.checked })}
                                 />
                                 <span className={styles.cellLabel}>Optional</span>
                              </label>

                              <div className={styles.rowActions}>
                                 <button type="button" className={styles.iconBtn} onClick={() => moveRow(setIngredients, index, -1)}
                                         disabled={index === 0} aria-label="Move ingredient up">↑</button>
                                 <button type="button" className={styles.iconBtn} onClick={() => moveRow(setIngredients, index, 1)}
                                         disabled={index === ingredients.length - 1} aria-label="Move ingredient down">↓</button>
                                 <button type="button" className={`${styles.iconBtn} ${styles.removeBtn}`}
                                         onClick={() => removeRow(setIngredients, row.key)} aria-label="Remove ingredient">✕</button>
                              </div>

                              {error && <p className={`${styles.error} ${styles.rowError}`}>{error}</p>}
                           </div>
                        );
                     })}

                     {ingredients.length === 0 && <p className={styles.empty}>No ingredients yet.</p>}
                  </div>

                  <button type="button" className={styles.addRowBtn} onClick={() => setIngredients(prev => [...prev, newIngredient()])}>
                     + Add ingredient
                  </button>
               </section>

               {/* ---------- Steps ---------- */}
               <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Steps</h2>

                  <ol className={styles.list}>
                     {steps.map((step, index) => (
                        <li key={step.key} className={styles.stepRow}>
                           <span className={styles.stepNumber} aria-hidden="true">{index + 1}</span>

                           <label className={styles.cell}>
                              <span className={styles.srOnly}>Step {index + 1}</span>
                              <textarea
                                 rows="2"
                                 value={step.description}
                                 onChange={e => updateRow(setSteps, step.key, { description: e.target.value })}
                                 placeholder={index === 0 ? 'Mix the dry ingredients together.' : 'Next step…'}
                              />
                           </label>

                           <div className={styles.rowActions}>
                              <button type="button" className={styles.iconBtn} onClick={() => moveRow(setSteps, index, -1)}
                                      disabled={index === 0} aria-label={`Move step ${index + 1} up`}>↑</button>
                              <button type="button" className={styles.iconBtn} onClick={() => moveRow(setSteps, index, 1)}
                                      disabled={index === steps.length - 1} aria-label={`Move step ${index + 1} down`}>↓</button>
                              <button type="button" className={`${styles.iconBtn} ${styles.removeBtn}`}
                                      onClick={() => removeRow(setSteps, step.key)} aria-label={`Remove step ${index + 1}`}>✕</button>
                           </div>
                        </li>
                     ))}
                  </ol>

                  {steps.length === 0 && <p className={styles.empty}>No steps yet.</p>}

                  <button type="button" className={styles.addRowBtn} onClick={() => setSteps(prev => [...prev, newStep()])}>
                     + Add step
                  </button>
               </section>

               {/* ---------- Photos ---------- */}
               <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Photos</h2>
                  <p className={styles.hint}>The first photo is the main one. Use the arrows to change the order.</p>

                  {images.length > 0 ? (
                     <ul className={styles.imageGrid}>
                        {images.map((image, index) => (
                           <li key={image.key} className={styles.imageCard}>
                              <div className={styles.imageFrame}>
                                 <img src={image.src} alt={image.alt || `Photo ${index + 1}`} />
                                 {index === 0 && <span className={styles.coverBadge}>Main</span>}
                              </div>

                              <label className={styles.cell}>
                                 <span className={styles.srOnly}>Caption for photo {index + 1}</span>
                                 <input
                                    type="text"
                                    value={image.alt}
                                    onChange={e => updateRow(setImages, image.key, { alt: e.target.value })}
                                    maxLength={200}
                                    placeholder="Caption (optional)"
                                 />
                              </label>

                              <div className={styles.rowActions}>
                                 <button type="button" className={styles.iconBtn} onClick={() => moveRow(setImages, index, -1)}
                                         disabled={index === 0} aria-label={`Move photo ${index + 1} earlier`}>←</button>
                                 <button type="button" className={styles.iconBtn} onClick={() => moveRow(setImages, index, 1)}
                                         disabled={index === images.length - 1} aria-label={`Move photo ${index + 1} later`}>→</button>
                                 <button type="button" className={`${styles.iconBtn} ${styles.removeBtn}`}
                                         onClick={() => removeImage(image)} aria-label={`Remove photo ${index + 1}`}>✕</button>
                              </div>
                           </li>
                        ))}
                     </ul>
                  ) : (
                     <p className={styles.empty}>No photos yet.</p>
                  )}

                  <FieldError message={imageError} />

                  {images.length < MAX_IMAGES && (
                     <label className={styles.addRowBtn}>
                        + Add photos
                        <input type="file" accept={IMAGE_TYPES} multiple onChange={addImages} className={styles.srOnly} />
                     </label>
                  )}
               </section>

               {/* ---------- Actions ---------- */}
               <div className={styles.actions}>
                  <div className={styles.status} role="alert">
                     {errorCount > 0 && <p className={styles.error}>Please fix the highlighted {errorCount === 1 ? 'field' : 'fields'}.</p>}
                     {saveError && <p className={styles.error}>{saveError}</p>}
                  </div>

                  <button type="button" className={styles.cancelBtn} onClick={leave} disabled={saving}>Cancel</button>
                  <button className={styles.addRecipeBtn} type="submit" disabled={saving}>
                     {saving ? 'Saving…' : editing ? 'Save changes' : 'Save recipe'}
                  </button>
               </div>
            </form>
         </div>
      </div>
   );
}
