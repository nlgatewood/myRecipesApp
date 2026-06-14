import { Routes, Route, NavLink, Outlet } from 'react-router-dom'
import styles from "./css/HeaderMenu.module.css";
import Home from './components/Home.jsx'
import SiteMaintenancePanel from './components/SiteMaintenancePanel';
import AddRecipePanel from './components/AddRecipePanel';
import './App.css'


function App() {

  return (
    <Routes>
      <Route element={<HeaderMenu />}>
        {/* Use an index route for "/" */}
        <Route index element={<Home />} />
        <Route path="add-recipe" element={<AddRecipePanel />} />
        <Route path="site-maintenance" element={<SiteMaintenancePanel />} />
      </Route>
    </Routes>
  )

}

function HeaderMenu(){

  return (
    <div className={styles.headerwrapper}>
        <nav className={styles.linklist}>
	        <NavLink to="/">Home</NavLink>
            <NavLink to="/add-recipe">Add Recipes</NavLink>
            <NavLink to="/site-maintenance">Site Maintenance</NavLink>
        </nav>
        <Outlet /> {/* Only route content renders here */}
    </div>
  )

}

export default App
