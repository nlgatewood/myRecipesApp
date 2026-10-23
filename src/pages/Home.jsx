import { useSearchParams } from 'react-router-dom';
import CategoriesPanel from '../components/CategoriesPanel';
import RecipeSearch from '../components/RecipeSearch';
import styles from '../css/Home.module.css';

function Home() {

   //While a search is active (?q=...) the results replace the category browser
   const [searchParams] = useSearchParams();
   const searching = Boolean(searchParams.get('q')?.trim());

   return (
      <div className={styles.page}>
         <RecipeSearch />

         {!searching && <CategoriesPanel />}
      </div>
  );
}

export default Home;
