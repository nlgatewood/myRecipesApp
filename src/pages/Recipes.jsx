// Recipes.jsx
import { useEffect, useState } from 'react';
import { getRecipeDetails } from '../api';
import { useParams } from "react-router-dom";

export default function Recipes() {

   const { recipeId } = useParams();
   const [recipes, setRecipes] = useState([]);

   useEffect(() => {
   
      async function loadRecipe() {
   
         try {
            const recipeData = await getRecipeDetails(recipeId);
            setRecipes(recipeData);
   
         } catch (err) {
            console.error("Failed to load categories:", err);
         } 
      }
   
      loadRecipe();

   }, [recipeId]);


   return (

      <div>
         {recipes.map(recipe => (
            <p>{recipe.description}</p>
         ))}
      </div>
   );
}

