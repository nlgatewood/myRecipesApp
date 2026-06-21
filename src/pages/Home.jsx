//import { Link, NavLink, useNavigate } from 'react-router-dom'
import CategoriesPanel from '../components/CategoriesPanel';

//Will, eventually, add search functionality. Will build out categories drilldown first
function Home() {

   return (
      <div style={{ padding: 16, maxWidth: 960, margin: '0 auto' }}>
         <h1>My Recipes!!!</h1>
         
         <CategoriesPanel />

      </div>
  );
}

export default Home;
