import styles from '../css/AddRecipe.module.css';

async function onSubmit(e) {
  e.preventDefault();
  // wire later
}

export default function AddRecipe() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Add a recipe</h1>
        <p className={styles.subtitle}>Fill out the details below to save a new recipe.</p>

        <form onSubmit={onSubmit} className={styles.form}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Recipe Info</h2>

            <div className={styles.recipeMeta}>
              <label className={styles.field}>
                <span>Recipe Name</span>
                <input type="text" placeholder="Classic Pancakes" />
              </label>

              <label className={`${styles.field} ${styles.fullWidth}`}>
                <span>Description</span>
                <textarea
                  rows="4"
                  placeholder="A quick, fluffy pancake recipe for weekend mornings."
                />
              </label>

              <label className={styles.field}>
                <span>Author</span>
                <input type="text" placeholder="Your name" />
              </label>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Time & Servings</h2>

            <div className={styles.recipeTimes}>
              <label className={styles.field}>
                <span>Serving Size</span>
                <input type="text" placeholder="4" />
              </label>

              <label className={styles.field}>
                <span>Prep Time</span>
                <input type="text" placeholder="10 mins" />
              </label>

              <label className={styles.field}>
                <span>Cook Time</span>
                <input type="text" placeholder="15 mins" />
              </label>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Ingredients</h2>
            </div>

            <div className={styles.tableLike}>
              <div className={`${styles.row} ${styles.headerRow}`}>
                <span>Ingredient Name</span>
                <span>Quantity</span>
                <span>Unit</span>
              </div>

              <div className={styles.row}>
                <input type="text" placeholder="Flour" />
                <input type="text" placeholder="2" />
                <input type="text" placeholder="cups" />
              </div>

              <div className={styles.row}>
                <input type="text" placeholder="Milk" />
                <input type="text" placeholder="1.5" />
                <input type="text" placeholder="cups" />
              </div>

              <div className={styles.row}>
                <input type="text" placeholder="Eggs" />
                <input type="text" placeholder="2" />
                <input type="text" placeholder="whole" />
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Steps</h2>

            <div className={styles.stepsTable}>
              <div className={`${styles.stepRow} ${styles.headerRow}`}>
                <span>Step</span>
                <span>Instruction</span>
              </div>

              <div className={styles.stepRow}>
                <input type="text" placeholder="1" />
                <input type="text" placeholder="Mix the dry ingredients together." />
              </div>

              <div className={styles.stepRow}>
                <input type="text" placeholder="2" />
                <input type="text" placeholder="Whisk in milk and eggs until smooth." />
              </div>

              <div className={styles.stepRow}>
                <input type="text" placeholder="3" />
                <input type="text" placeholder="Cook on a greased skillet until golden." />
              </div>
            </div>
          </section>

          <div className={styles.actions}>
            <button className={styles.addRecipeBtn} type="submit">
              Add Recipe
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}