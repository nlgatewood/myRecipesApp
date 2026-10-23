import { Routes, Route, NavLink, Outlet } from 'react-router-dom'
import HeaderMenu from './components/HeaderMenu.jsx';
import Home from './pages/Home.jsx';
import Recipes from './pages/Recipes.jsx';
import SiteMaintenancePanel from './components/SiteMaintenancePanel';
import AddRecipePanel from './components/AddRecipePanel';
import './App.css'


function App() {

  return (
    <Routes>
      <Route element={<HeaderMenu />}>
        {/* Use an index route for "/" */}
        <Route index element={<Home />} />
        {/* Different keys so going from Edit to Add mounts a fresh, empty form instead of reusing the edit form's state */}
        <Route path="add-recipe" element={<AddRecipePanel key="add" />} />
        <Route path="site-maintenance" element={<SiteMaintenancePanel />} />
        <Route path="recipes/:recipeId" element={<Recipes />} />
        <Route path="recipes/:recipeId/edit" element={<AddRecipePanel key="edit" />} />
      </Route>
    </Routes>
  );

}

export default App
