import React from "react";
import { useEffect, useState } from 'react';
import { apiHealth, getCategoriesByParent, getRecipesByCategory } from '../api';
import { Link } from "react-router-dom";
import styles from '../css/Categories.module.css';


function CategoriesPanel() {

   const [categories, setCategories] = useState(['ALL']);
   const [parentCode, setParentCode] = useState(['ALL']);
   const [breadCrumbs, setBreadCrumbs] = useState([{code:'ALL', title:'All'}]);
   const [recipes, setRecipes] = useState([]);

   useEffect(() => {

      async function loadCategories() {

         try {
            const categoryData = await getCategoriesByParent(parentCode);
            setCategories(categoryData);

            const recipesData = await getRecipesByCategory(parentCode);
            setRecipes(recipesData);

         } catch (err) {
            console.error("Failed to load categories:", err);
         } 
      }

    loadCategories();
  }, [parentCode]);

   //Handler for when a category is clicked. set the Breadcrumbs and parent code
   const handleCategoryClick = (category) => {

      setBreadCrumbs((prev) => [
         ...prev,
         {code: category.code,
          title: category.title}
      ]);

      setParentCode(category.code);
   };

   //Handler for when a breadcrumb is clicked. Remove all the ones ahead of the one that was clicked
   const handleBreadcrumbClick = (code) => {

      const index = breadCrumbs.findIndex(b => b.code === code);

      setBreadCrumbs(breadCrumbs.slice(0, index + 1));
      setParentCode(code);
   };

  return (
    <div>
      <h2>Categories</h2>

      <div>
         {breadCrumbs.map(path => (

            <span key={path.code}>
               <a href='#' onClick={() =>handleBreadcrumbClick(path.code)}>{path.title}</a> /
            </span>
         ))}
      </div>

      <div className={styles.categoryGrid}>

         {categories.map(category => (
            <button onClick={() => handleCategoryClick(category)}>
               {category.title}
            </button>

         ))}
      </div>

      <div>
         {recipes.map(recipe => (

            <span key={recipe.code}>
                <Link to={`/recipes/${recipe.id}`}>{recipe.name}</Link>
            </span>
         ))}    
      </div>

    </div>
  );
}

export default CategoriesPanel;
