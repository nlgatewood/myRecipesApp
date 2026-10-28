// Recipes.jsx
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteRecipe, getRecipeDetails, getRecipeImages, getRecipeIngredients, getRecipeSteps, imageSrc,
         listCategories } from '../api';
import { formatMinutes, formatQuantity, totalMinutes } from '../format';
import styles from '../css/Recipes.module.css';

//Units are stored like "Cup(s)" or "Pinch(es)". Show "Cup"/"Pinch" for 1 or less, "Cups"/"Pinches" otherwise.
//'Count' isn't shown at all ("2 Eggs" rather than "2 Count Eggs")
function formatUnit(description, quantity) {

   if (!description || description === 'Count') return '';

   const plural = quantity === null || Number(quantity) > 1;
   return description.replace(/\((e?s)\)/, (_, ending) => (plural ? ending : ''));
}

//Walks up the category tree to build ["Breads", "Quick Breads", "Fruit Breads"], skipping the root 'All'
function categoryPath(categories, code) {

   const byCode = new Map(categories.map(c => [c.code, c]));
   const titles = [];

   for (let cur = byCode.get(code), depth = 0; cur?.parent_code && depth < 20; cur = byCode.get(cur.parent_code), depth++) {
      titles.unshift(cur.title);
   }
   return titles;
}

export default function Recipes() {

   const { recipeId } = useParams();
   const navigate = useNavigate();

   const [recipe, setRecipe] = useState(null);
   const [recipeIngredients, setRecipeIngredients] = useState([]);
   const [recipeSteps, setRecipeSteps] = useState([]);
   const [recipeImages, setRecipeImages] = useState([]);
   const [shownImage, setShownImage] = useState(0);   // index of the photo shown large
   const [categoryTitles, setCategoryTitles] = useState([]);
   const [status, setStatus] = useState('loading');   // loading | ready | notFound | error
   const [confirmingDelete, setConfirmingDelete] = useState(false);
   const [deleting, setDeleting] = useState(false);
   const [deleteError, setDeleteError] = useState('');
   const photoViewerRef = useRef(null);   // <dialog> that shows the main photo uncropped

   useEffect(() => {

      async function loadRecipe() {

         setStatus('loading');

         try {
            const [recipeData, ingredientData, stepData, imageData, categoryData] = await Promise.all([
               getRecipeDetails(recipeId),
               getRecipeIngredients(recipeId),
               getRecipeSteps(recipeId),
               getRecipeImages(recipeId),
               listCategories()
            ]);

            //The API returns an empty body when no recipe matches the id
            if (!recipeData) {
               setStatus('notFound');
               return;
            }

            setRecipe(recipeData);
            setRecipeIngredients(ingredientData);
            setRecipeSteps(stepData);
            setRecipeImages(imageData);
            setShownImage(0);
            setCategoryTitles(categoryPath(categoryData, recipeData.category_code));
            setStatus('ready');

         } catch (err) {
            console.error("Failed to load Recipe:", err);
            setStatus('error');
         }
      }

      loadRecipe();

   }, [recipeId]);

   //Go back to where the user came from (keeps their category drill-down), or home if they landed here directly
   const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'));

   //Opens the browser's print dialog, where "Save as PDF" is one of the destinations.
   //The page title becomes the suggested PDF file name, so use the recipe name while printing
   function onPrint() {

      const siteTitle = document.title;
      document.title = recipe.name;

      window.addEventListener('afterprint', () => { document.title = siteTitle; }, { once: true });
      window.print();
   }

   async function onDelete() {

      setDeleting(true);
      setDeleteError('');

      try {
         await deleteRecipe(recipeId);
         navigate('/', { replace: true });   // replace so Back doesn't return to the deleted recipe
      } catch (err) {
         console.error("Failed to delete Recipe:", err);
         setDeleteError(err.message || 'Failed to delete the recipe.');
         setDeleting(false);
      }
   }

   if (status !== 'ready') {

      const messages = {
         loading: 'Loading recipe…',
         notFound: "We couldn't find that recipe.",
         error: 'Something went wrong loading this recipe. Check that the API is running.'
      };

      return (
         <div className={styles.page}>
            <div className={`${styles.card} ${styles.message}`}>
               <p role={status === 'loading' ? 'status' : 'alert'}>{messages[status]}</p>
               {status !== 'loading' && <Link to="/" className={styles.backLink}>← Back to categories</Link>}
            </div>
         </div>
      );
   }

   const totalTime = totalMinutes(recipe.prep_time, recipe.cook_time);

   const facts = [
      { label: 'Servings', value: recipe.servings },
      { label: 'Prep time', value: formatMinutes(recipe.prep_time) },
      { label: 'Cook time', value: formatMinutes(recipe.cook_time) },
      { label: 'Total time', value: formatMinutes(totalTime) }
   ];

   const mainImage = recipeImages[shownImage] ?? recipeImages[0];

   const keywords = (recipe.keywords ?? '').split(',').map(k => k.trim()).filter(Boolean);

   return (
      <div className={styles.page}>
         <article className={styles.card}>

            <div className={styles.toolbar}>
               <button type="button" className={styles.backLink} onClick={goBack}>← Back</button>

               {!confirmingDelete && (
                  <div className={styles.toolbarActions}>
                     <button type="button" className={styles.iconBtn} onClick={onPrint}
                             aria-label="Print or save as PDF" title="Print or save as PDF">
                        {/* Printer */}
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                           <path d="M7 9V3h10v6" />
                           <path d="M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
                           <path d="M7 14h10v7H7z" />
                        </svg>
                     </button>
                     <Link to={`/recipes/${recipeId}/edit`} className={styles.iconBtn}
                           aria-label="Edit recipe" title="Edit recipe">
                        {/* Pencil */}
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                           <path d="M12 20h9" />
                           <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
                        </svg>
                     </Link>
                     <button type="button" className={`${styles.iconBtn} ${styles.deleteIconBtn}`}
                             onClick={() => setConfirmingDelete(true)}
                             aria-label="Delete recipe" title="Delete recipe">
                        {/* Trash can */}
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                           <path d="M3 6h18" />
                           <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                           <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                           <path d="M10 11v6M14 11v6" />
                        </svg>
                     </button>
                  </div>
               )}
            </div>

            {/* Inline confirmation instead of window.confirm so it matches the page */}
            {confirmingDelete && (
               <div className={styles.confirmBox} role="alertdialog" aria-labelledby="confirm-delete-text">
                  <p id="confirm-delete-text">
                     Delete <strong>{recipe.name}</strong>? Its ingredients list, steps and photos will be removed too. This can't be undone.
                  </p>
                  {deleteError && <p className={styles.deleteError}>{deleteError}</p>}

                  <div className={styles.confirmActions}>
                     <button type="button" className={styles.cancelBtn} disabled={deleting}
                             onClick={() => { setConfirmingDelete(false); setDeleteError(''); }}>
                        Cancel
                     </button>
                     <button type="button" className={styles.confirmDeleteBtn} disabled={deleting} onClick={onDelete} autoFocus>
                        {deleting ? 'Deleting…' : 'Yes, delete'}
                     </button>
                  </div>
               </div>
            )}

            {/* ---------- Header ---------- */}
            <header className={styles.header}>
               {categoryTitles.length > 0 && (
                  <p className={styles.category}>{categoryTitles.join(' › ')}</p>
               )}

               <h1 className={styles.title}>{recipe.name}</h1>

               {recipe.author && <p className={styles.author}>By {recipe.author}</p>}
               {recipe.description && <p className={styles.description}>{recipe.description}</p>}

               {keywords.length > 0 && (
                  <ul className={styles.keywords} aria-label="Keywords">
                     {keywords.map(k => <li key={k}>{k}</li>)}
                  </ul>
               )}
            </header>

            {/* ---------- Photos (in sort_order; the first is the main one) ---------- */}
            {mainImage && (
               <section className={styles.gallery} aria-label="Photos">
                  <figure className={styles.mainPhoto}>
                     {/* The photo is cropped to fit the page, so clicking it opens the whole thing */}
                     <button type="button" className={styles.photoBtn} onClick={() => photoViewerRef.current?.showModal()}
                             aria-label="View full photo" title="View full photo">
                        <img src={imageSrc(mainImage.url)} alt={mainImage.alt || recipe.name} />
                     </button>
                     {mainImage.alt && <figcaption>{mainImage.alt}</figcaption>}
                  </figure>

                  {/* showModal() gives us Escape-to-close and the dimmed backdrop; a click anywhere closes it too */}
                  <dialog ref={photoViewerRef} className={styles.photoViewer} aria-label="Full photo"
                          onClick={() => photoViewerRef.current?.close()}>
                     <img src={imageSrc(mainImage.url)} alt={mainImage.alt || recipe.name} />
                     <button type="button" className={styles.photoViewerClose} aria-label="Close photo">×</button>
                  </dialog>

                  {recipeImages.length > 1 && (
                     <ul className={styles.thumbs}>
                        {recipeImages.map((image, index) => (
                           <li key={image.id}>
                              <button type="button" className={styles.thumb} onClick={() => setShownImage(index)}
                                      aria-label={`Show photo ${index + 1}`} aria-current={image === mainImage}>
                                 <img src={imageSrc(image.url)} alt="" loading="lazy" />
                              </button>
                           </li>
                        ))}
                     </ul>
                  )}
               </section>
            )}

            {/* ---------- Time & Servings ---------- */}
            <section className={styles.section}>
               <h2 className={styles.sectionTitle}>Time &amp; servings</h2>

               <dl className={styles.facts}>
                  {facts.map(fact => (
                     <div key={fact.label} className={styles.fact}>
                        <dt>{fact.label}</dt>
                        <dd>{fact.value ?? '—'}</dd>
                     </div>
                  ))}
               </dl>
            </section>

            {/* ---------- Ingredients ---------- */}
            <section className={styles.section}>
               <h2 className={styles.sectionTitle}>Ingredients</h2>

               {recipeIngredients.length > 0 ? (
                  <ul className={styles.ingredientList}>
                     {recipeIngredients.map((ingredient) => {
                        const amount = [formatQuantity(ingredient.quantity), formatUnit(ingredient.unit_description, ingredient.quantity)]
                           .filter(Boolean).join(' ');

                        return (
                           <li key={ingredient.id} className={styles.ingredient}>
                              <span className={styles.amount}>{amount}</span>
                              <span className={styles.ingredientName}>
                                 {ingredient.ingredient_description}
                                 {ingredient.optional === 1 && <span className={styles.optionalTag}>optional</span>}
                              </span>
                           </li>
                        );
                     })}
                  </ul>
               ) : (
                  <p className={styles.empty}>No ingredients listed.</p>
               )}
            </section>

            {/* ---------- Steps ---------- */}
            <section className={styles.section}>
               <h2 className={styles.sectionTitle}>Steps</h2>

               {recipeSteps.length > 0 ? (
                  <ol className={styles.stepList}>
                     {recipeSteps.map((step, index) => (
                        <li key={step.id} className={styles.step}>
                           <span className={styles.stepNumber} aria-hidden="true">{index + 1}</span>
                           <p>{step.description}</p>
                        </li>
                     ))}
                  </ol>
               ) : (
                  <p className={styles.empty}>No steps listed.</p>
               )}
            </section>
         </article>
      </div>
   );
}
