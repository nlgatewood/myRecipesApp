import { Link } from 'react-router-dom';
import { formatMinutes, totalMinutes } from '../format';
import styles from '../css/Categories.module.css';

//Recipe card used by the category browser and the search results.
//Must be rendered inside an element with the Categories .panel class (it supplies the theme tokens)
export default function RecipeCard({ recipe, showCategory = true, matchedKeywords = [], matchedIngredients = [] }) {

   const time = formatMinutes(totalMinutes(recipe.prep_time, recipe.cook_time));

   return (
      <Link to={`/recipes/${recipe.id}`} className={styles.recipeCard}>
         <span className={styles.recipeName}>{recipe.name}</span>
         {recipe.description && <span className={styles.recipeDesc}>{recipe.description}</span>}

         <span className={styles.recipeMeta}>
            {showCategory && <span className={styles.tag}>{recipe.category_title}</span>}
            {time && <span>{time}</span>}
            {matchedKeywords.map(k => <span key={k} className={styles.keyword}>#{k}</span>)}
         </span>

         {matchedIngredients.length > 0 && (
            <span className={styles.ingredientMatch}>
               Uses {matchedIngredients.join(', ')}
            </span>
         )}
      </Link>
   );
}
