// Recipes.jsx
import { useEffect, useState } from 'react';
import { getRecipeDetails, getRecipeIngredients, getRecipeSteps } from '../api';
import { useParams } from "react-router-dom";

export default function Recipes() {

   const { recipeId } = useParams();
   const [recipe, setRecipe] = useState([]);
   const [recipeIngredients, setRecipeIngredients] = useState([]);
   const [recipeSteps, setRecipeSteps] = useState([]);

   useEffect(() => {
   
      async function loadRecipe() {
   
         try {
            //Set the Recipe Details
            const recipeData = await getRecipeDetails(recipeId);
            setRecipe(recipeData);

            //Set the Ingredients
            const recipeIngredientsData = await getRecipeIngredients(recipeId);
            setRecipeIngredients(recipeIngredientsData);

            //Set the recipe steps
            const recipeStepsData = await getRecipeSteps(recipeId);
            setRecipeSteps(recipeStepsData);

   
         } catch (err) {
            console.error("Failed to load Recipe:", err);
         } 
      }
   
      loadRecipe();

   }, [recipeId]);


   return (
      
      <div>

         <header>
            <div>
               <h1>{recipe.name}</h1>
               <p>{recipe.description}</p>
               <p><strong>Author:</strong>{recipe.author}</p>
            </div>
         </header>

         <div>
            <span>
               <strong>Prep Time:</strong>{recipe.prep_time}
            </span>
            <span>
               <strong>Cook Time:</strong>{recipe.cook_time}
            </span>
            <span>
               <strong>Servings:</strong>{recipe.servings}
            </span>
         </div>


         <div>
            <h2>Ingredients</h2>

            {recipeIngredients.length > 0 ? (
               <ul>
                  {recipeIngredients.map((ingredient) => (
                     <li key={ingredient.id}>
                        {ingredient.quantity && (
                           <span>{ingredient.quantity} </span>
                        )}

                        {ingredient.unit_description && (
                          <span>{ingredient.unit_description} </span>
                        )}

                        <span>{ingredient.name}</span>
                     </li>
                  ))}
               </ul>
            ) : (
               <p>No ingredients listed.</p>
            )}
         </div>

         <div>
            <h2>Recipe Steps</h2>

            {recipeSteps.length > 0 ? (
               <ol>
                  {recipeSteps.map((step) => (
                     <li key={step.id}>
                        {step.description}
                     </li>
                  ))}
               </ol>
            ) : (
               <p>No steps listed.</p>
            )}
         </div>
      </div>
   );
}

