import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getRecipeCounts, getRecipesByCategory, listCategories } from '../api';
import RecipeCard from './RecipeCard';
import styles from '../css/Categories.module.css';

const ROOT = 'ALL';
const PAGE_SIZE = 12;

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

//Page numbers to show: always the first and last, plus a window around the current page,
//with null marking a gap (e.g. 1 … 4 5 6 … 12)
function pageList(current, total) {
   const pages = [];
   for (let p = 1; p <= total; p++) {
      if (p === 1 || p === total || Math.abs(p - current) <= 1) pages.push(p);
      else if (pages[pages.length - 1] !== null) pages.push(null);
   }
   return pages;
}

function CategoriesPanel() {

   //The current category lives in the URL (?category=BRDFR) so the browser Back button walks
   //up the tree, and returning from a recipe lands you where you left off
   const [searchParams, setSearchParams] = useSearchParams();

   const [categories, setCategories] = useState([]);
   const [counts, setCounts] = useState({});
   const [recipes, setRecipes] = useState([]);
   const [treeStatus, setTreeStatus] = useState('loading');      // loading | ready | error
   const [recipesStatus, setRecipesStatus] = useState('loading'); // loading | ready | error

   const recipesSection = useRef(null);

   const byCode = useMemo(() => new Map(categories.map(c => [c.code, c])), [categories]);

   //parent code -> child categories, sorted by title
   const childrenOf = useMemo(() => {
      const map = new Map();
      for (const c of categories) {
         if (!map.has(c.parent_code)) map.set(c.parent_code, []);
         map.get(c.parent_code).push(c);
      }
      for (const list of map.values()) list.sort((a, b) => a.title.localeCompare(b.title));
      return map;
   }, [categories]);

   //category code -> recipes in it and everything nested under it
   const totals = useMemo(() => {
      const result = new Map();
      const total = (code, depth = 0) => {
         if (result.has(code)) return result.get(code);
         let sum = counts[code] ?? 0;
         if (depth < 20) {
            for (const child of childrenOf.get(code) ?? []) sum += total(child.code, depth + 1);
         }
         result.set(code, sum);
         return sum;
      };
      categories.forEach(c => total(c.code));
      return result;
   }, [categories, childrenOf, counts]);

   //Fall back to the root if the URL names a category that doesn't exist
   const requested = searchParams.get('category') || ROOT;
   const currentCode = treeStatus === 'ready' && !byCode.has(requested) ? ROOT : requested;
   const current = byCode.get(currentCode);
   const subcategories = childrenOf.get(currentCode) ?? [];

   //The page also lives in the URL (?page=2); clamp it to the pages that exist
   const pageCount = Math.max(1, Math.ceil(recipes.length / PAGE_SIZE));
   const requestedPage = parseInt(searchParams.get('page'), 10) || 1;
   const page = Math.min(Math.max(requestedPage, 1), pageCount);
   const pageStart = (page - 1) * PAGE_SIZE;
   const pageRecipes = recipes.slice(pageStart, pageStart + PAGE_SIZE);

   //Breadcrumbs from the root down to the current category
   const path = [];
   for (let cur = current, depth = 0; cur && depth < 20; cur = byCode.get(cur.parent_code), depth++) {
      path.unshift(cur);
   }

   useEffect(() => {

      async function loadCategories() {

         try {
            const [categoryData, countData] = await Promise.all([listCategories(), getRecipeCounts()]);

            setCategories(categoryData);
            setCounts(Object.fromEntries(countData.map(row => [row.category_code, row.count])));
            setTreeStatus('ready');

         } catch (err) {
            console.error("Failed to load categories:", err);
            setTreeStatus('error');
         }
      }

      loadCategories();
   }, []);

   useEffect(() => {

      let ignore = false;   // drop the response if the user has already moved to another category

      async function loadRecipes() {

         setRecipesStatus('loading');

         try {
            //"All recipes" lists everything; any other category lists only the recipes filed directly in it
            const recipesData = await getRecipesByCategory(currentCode, { includeSubcategories: currentCode === ROOT });

            if (!ignore) {
               setRecipes(recipesData);
               setRecipesStatus('ready');
            }
         } catch (err) {
            console.error("Failed to load recipes:", err);
            if (!ignore) setRecipesStatus('error');
         }
      }

      loadRecipes();
      return () => { ignore = true; };
   }, [currentCode]);

   const openCategory = (code) => {
      setSearchParams(code === ROOT ? {} : { category: code });
   };

   const openPage = (next) => {
      const params = currentCode === ROOT ? {} : { category: currentCode };
      if (next > 1) params.page = String(next);
      setSearchParams(params);
      recipesSection.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
   };

   const titleOf = (category) => (category.code === ROOT ? 'All recipes' : category.title);

   return (
      <section className={styles.panel}>

         {treeStatus === 'error' && (
            <p className={styles.banner} role="alert">Could not load categories. Check that the API is running.</p>
         )}

         {/* ---------- Breadcrumbs ---------- */}
         {/* Always rendered (even at "All recipes", or before categories load) so the page doesn't jump */}
         <nav aria-label="Category path">
            <ol className={styles.breadcrumbs}>
               {path.map((category, index) => (
                  <li key={category.code}>
                     {index < path.length - 1 ? (
                        <button type="button" onClick={() => openCategory(category.code)}>{titleOf(category)}</button>
                     ) : (
                        <span aria-current="page">{titleOf(category)}</span>
                     )}
                  </li>
               ))}
            </ol>
         </nav>

         {/* ---------- Subcategories ---------- */}
         {subcategories.length > 0 && (
            <div className={styles.section}>
               <h3 className={styles.sectionTitle}>{currentCode === ROOT ? 'Categories' : 'Subcategories'}</h3>

               <ul className={styles.categoryGrid}>
                  {subcategories.map(category => {
                     //The tile counts recipes filed directly in the category, matching what opening it shows.
                     //It's only dimmed when the whole branch is empty
                     const recipeCount = counts[category.code] ?? 0;
                     const branchEmpty = (totals.get(category.code) ?? 0) === 0;
                     const childCount = (childrenOf.get(category.code) ?? []).length;

                     return (
                        <li key={category.code}>
                           <button
                              type="button"
                              className={`${styles.categoryTile} ${branchEmpty ? styles.emptyTile : ''}`}
                              onClick={() => openCategory(category.code)}
                           >
                              <span className={styles.tileTitle}>{category.title}</span>
                              <span className={styles.tileMeta}>
                                 {plural(recipeCount, 'recipe')}
                                 {childCount > 0 && ` · ${childCount} ${childCount === 1 ? 'subcategory' : 'subcategories'}`}
                              </span>
                              <span className={styles.chevron} aria-hidden="true">›</span>
                           </button>
                        </li>
                     );
                  })}
               </ul>
            </div>
         )}

         {/* ---------- Recipes ---------- */}
         <div className={styles.section} ref={recipesSection}>
            <div className={styles.sectionHeader}>
               <h3 className={styles.sectionTitle}>Recipes</h3>
               {pageCount > 1 && (
                  <span className={styles.pageRange}>
                     {pageStart + 1}–{pageStart + pageRecipes.length} of {recipes.length}
                  </span>
               )}
            </div>

            {recipesStatus === 'loading' && recipes.length === 0 && <p className={styles.empty}>Loading recipes…</p>}
            {recipesStatus === 'error' && <p className={styles.empty}>Could not load recipes.</p>}

            {recipes.length > 0 && (
               <ul className={`${styles.recipeGrid} ${recipesStatus === 'loading' ? styles.stale : ''}`}>
                  {pageRecipes.map(recipe => (
                     <li key={recipe.id}>
                        {/* Label the category when it differs from the one being viewed (i.e. on All recipes) */}
                        <RecipeCard recipe={recipe} showCategory={recipe.category_code !== currentCode} />
                     </li>
                  ))}
               </ul>
            )}

            <p className={styles.addRecipe}>
               <Link to={currentCode === ROOT ? '/add-recipe' : `/add-recipe?category=${encodeURIComponent(currentCode)}`}>
                  + Add a recipe{current && currentCode !== ROOT ? ` to ${current.title}` : ''}
               </Link>
            </p>

            {pageCount > 1 && (
               <nav className={styles.pagination} aria-label="Recipe pages">
                  <button type="button" onClick={() => openPage(page - 1)} disabled={page === 1}>
                     ‹ Prev
                  </button>
                  {pageList(page, pageCount).map((p, index) => (
                     p === null ? (
                        <span key={`gap-${index}`} className={styles.pageGap} aria-hidden="true">…</span>
                     ) : (
                        <button
                           type="button"
                           key={p}
                           onClick={() => openPage(p)}
                           aria-current={p === page ? 'page' : undefined}
                           aria-label={`Page ${p}`}
                        >
                           {p}
                        </button>
                     )
                  ))}
                  <button type="button" onClick={() => openPage(page + 1)} disabled={page === pageCount}>
                     Next ›
                  </button>
               </nav>
            )}
         </div>
      </section>
   );
}

export default CategoriesPanel;
