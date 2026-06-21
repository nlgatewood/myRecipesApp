import { Routes, Route, NavLink, Outlet } from 'react-router-dom'
import styles from "../css/HeaderMenu.module.css";

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
  );

}

export default HeaderMenu