import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import styles from '../css/AddRecipe.module.css';

async function onSubmit(e) {
  // wire later
}

export default function AddRecipe() {
  return (
    <div style={{ padding: 16, maxWidth: 960, margin: '0 auto' }}>
      <h1>Add a recipe!</h1>

      {/* when you wire submit: onSubmit={onSubmit} */}
      <form onSubmit="">
        <div className={styles.recipeDiv}>

          <div className={styles.recipeElements}>

            <div className={styles.recipeMeta}>
              <span className={styles.recipeName}>
                Recipe Name:
                <input type="text" />
              </span>

              <span className={styles.recipeDesc}>
                Description:
                <textarea />
              </span>

              <span className={styles.recAuthor}>
                Author:
                <input type="text" />
              </span>
            </div>

            <div className={styles.recipeTimes}>
              <span className={styles.recServings}>
                Serving Size:
                <input type="text" />
              </span>
              <span className={styles.recPrep}>
                Prep Time:
                <input type="text" />
              </span>
              <span className={styles.recCook}>
                Cook Time:
                <input type="text" />
              </span>
            </div>

            <div className={styles.ingredients}>
              <ul className={styles.ingredientList}>
                <li>
                  <span className={styles.ingredientTitle}>Ingredient Name</span>
                  <span className={styles.ingredientTitle}>Quantity</span>
                  <span className={styles.ingredientTitle}>Quantity Unit</span>
                </li>
                <li>
                  <input className={styles.ingredient1} type="text" />
                  <input className={styles.ingredientQuant1} type="text" />
                  <input className={styles.quantUnit1} type="text" />
                </li>
                <li>
                  <input className={styles.ingredient2} type="text" />
                  <input className={styles.ingredientQuant2} type="text" />
                  <input className={styles.quantUnit2} type="text" />
                </li>
                <li>
                  <input className={styles.ingredient3} type="text" />
                  <input className={styles.ingredientQuant3} type="text" />
                  <input className={styles.quantUnit3} type="text" />
                </li>
              </ul>
            </div>

            <div className={styles.ingredientSteps}>
              <ul className={styles.ingredientStepList}>
                <li>
                  <span className={styles.stepTitle}>Step Rank</span>
                  <span className={styles.stepTitle}>Step Text</span>
                </li>
                <li>
                  <input className={styles.stepRank1} type="text" />
                  <input className={styles.stepDesc1} type="text" />
                </li>
                <li>
                  <input className={styles.stepRank2} type="text" />
                  <input className={styles.stepDesc2} type="text" />
                </li>
                <li>
                  <input className={styles.stepRank3} type="text" />
                  <input className={styles.stepDesc3} type="text" />
                </li>
              </ul>
            </div>

          </div>

          <button className={styles.addRecipeBtn} type="submit">Add</button>
        </div>
      </form>
    </div>
  )
}

