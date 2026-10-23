import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchRecipes } from '../api';
import RecipeCard from './RecipeCard';
import catStyles from '../css/Categories.module.css';
import styles from '../css/Search.module.css';

const DEBOUNCE_MS = 250;

//Same word splitting as /api/recipe-search, used to show which keywords matched
const splitTerms = (text) => text.toLowerCase().split(/[\s,]+/).filter(Boolean);

function matchingKeywords(recipe, terms) {
   return (recipe.keywords ?? '')
      .split(',')
      .map(k => k.trim())
      .filter(k => k && terms.some(t => k.toLowerCase().includes(t)));
}

export default function RecipeSearch() {

   //The search text lives in the URL (?q=...) so Back from a recipe returns to the same results
   const [searchParams, setSearchParams] = useSearchParams();
   const query = searchParams.get('q') ?? '';
   const term = query.trim();

   const [results, setResults] = useState([]);
   const [status, setStatus] = useState('idle');   // idle | loading | ready | error
   const inputRef = useRef(null);

   //Search as you type, waiting for a short pause so we don't query on every keystroke
   useEffect(() => {

      if (!term) {
         setResults([]);
         setStatus('idle');
         return;
      }

      let ignore = false;
      setStatus('loading');

      const timer = setTimeout(async () => {
         try {
            const data = await searchRecipes(term);
            if (!ignore) {
               setResults(data);
               setStatus('ready');
            }
         } catch (err) {
            console.error("Failed to search recipes:", err);
            if (!ignore) setStatus('error');
         }
      }, DEBOUNCE_MS);

      return () => { ignore = true; clearTimeout(timer); };
   }, [term]);

   //Press "/" anywhere on the page to jump to the search box
   useEffect(() => {

      const onKeyDown = (e) => {
         const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
         if (e.key === '/' && !typing) {
            e.preventDefault();
            inputRef.current?.focus();
         }
      };

      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
   }, []);

   //replace: true so each keystroke doesn't add a history entry. Other params (?category) are kept
   const setQuery = (value) =>
      setSearchParams(prev => {
         const next = new URLSearchParams(prev);
         if (value) next.set('q', value);
         else next.delete('q');
         return next;
      }, { replace: true });

   const clear = () => {
      setQuery('');
      inputRef.current?.focus();
   };

   const terms = splitTerms(term);

   return (
      <>
         <form role="search" className={styles.searchBar} onSubmit={e => { e.preventDefault(); inputRef.current?.blur(); }}>
            <label htmlFor="recipe-search" className={styles.srOnly}>Search recipes</label>

            <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
               <circle cx="11" cy="11" r="7" />
               <path d="M20 20l-3.5-3.5" />
            </svg>

            <input
               id="recipe-search"
               ref={inputRef}
               type="search"
               value={query}
               onChange={e => setQuery(e.target.value)}
               onKeyDown={e => { if (e.key === 'Escape') clear(); }}
               placeholder="Search by recipe name, keyword or ingredient…"
               autoComplete="off"
               enterKeyHint="search"
            />

            {query ? (
               <button type="button" className={styles.clearBtn} onClick={clear} aria-label="Clear search">✕</button>
            ) : (
               <kbd className={styles.shortcut} aria-hidden="true">/</kbd>
            )}
         </form>

         {/* ---------- Results (replace the category browser while searching) ---------- */}
         {term && (
            <section className={catStyles.panel} aria-label="Search results">
               <header className={catStyles.heading}>
                  <h2 className={catStyles.title}>Results for “{term}”</h2>
                  <span className={catStyles.count} aria-live="polite">
                     {status === 'ready' && `${results.length}${results.length === 50 ? '+' : ''} ${results.length === 1 ? 'recipe' : 'recipes'}`}
                     {status === 'loading' && 'Searching…'}
                  </span>
               </header>

               <div className={catStyles.section}>
                  {status === 'error' && <p className={catStyles.empty}>Search failed. Check that the API is running.</p>}

                  {status === 'ready' && results.length === 0 && (
                     <div className={catStyles.empty}>
                        <p>No recipes match “{term}”.</p>
                        <p className={styles.tip}>Try fewer or shorter words, e.g. “zuc” finds “Zucchini”, or search for an ingredient like “walnut”.</p>
                        <button type="button" className={styles.linkBtn} onClick={clear}>Browse categories instead</button>
                     </div>
                  )}

                  {results.length > 0 && (
                     <ul className={`${catStyles.recipeGrid} ${status === 'loading' ? catStyles.stale : ''}`}>
                        {results.map(recipe => (
                           <li key={recipe.id}>
                              <RecipeCard
                                 recipe={recipe}
                                 matchedKeywords={matchingKeywords(recipe, terms)}
                                 matchedIngredients={recipe.matched_ingredients ?? []}
                              />
                           </li>
                        ))}
                     </ul>
                  )}
               </div>

               <div className={styles.footer}>
                  <button type="button" className={styles.linkBtn} onClick={clear}>← Back to categories</button>
               </div>
            </section>
         )}
      </>
   );
}
