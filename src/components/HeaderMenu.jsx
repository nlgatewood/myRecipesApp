import { Link, NavLink, Outlet } from 'react-router-dom'
import styles from "../css/HeaderMenu.module.css";

//Layout route: site header + menu on every page, with the page content rendered below
function HeaderMenu(){

  return (
    <div className={styles.headerwrapper}>
        <header className={styles.siteHeader}>
            <Link to="/" className={styles.brand}>
                <span className={styles.logo} aria-hidden="true">
                    {/* Cooking pot */}
                    <svg viewBox="0 0 24 24">
                        <path d="M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-6z" />
                        <path d="M2 10h20M9 6.5c0-1 .8-1.5 .8-2.5M12 6.5c0-1 .8-1.5 .8-2.5M15 6.5c0-1 .8-1.5 .8-2.5" />
                    </svg>
                </span>
                <span className={styles.brandName}>My Recipes</span>
            </Link>
        </header>

        <nav className={styles.linklist}>
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/add-recipe">Add Recipes</NavLink>
            <NavLink to="/site-maintenance">Site Maintenance</NavLink>
        </nav>

        <main>
            <Outlet /> {/* Only route content renders here */}
        </main>
    </div>
  );

}

export default HeaderMenu
