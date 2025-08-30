import { useState } from 'react'
import { Routes, Route, NavLink, Outlet } from 'react-router-dom'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import Home from './pages/Home.jsx'
import SiteMaintenancePanel from './pages/SiteMaintenancePanel';
import AddRecipePanel from './pages/AddRecipePanel';
import './App.css'

function Layout(){

  const [count, setCount] = useState(0);

  return (
    <div style={{ padding: 16, maxWidth: 960, margin: '0 auto' }}>
      <nav style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
	<NavLink to="/">Home</NavLink>
        <NavLink to="/add-recipe">Add Recipes</NavLink>
        <NavLink to="/site-maintenance">Site Maintenance</NavLink>
      </nav>
      <Outlet /> {/* Only route content renders here */}
    </div>
  )

}

function App() {

  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Use an index route for "/" */}
        <Route index element={<Home />} />
        <Route path="add-recipe" element={<AddRecipePanel />} />
        <Route path="site-maintenance" element={<SiteMaintenancePanel />} />
      </Route>
    </Routes>
  )

}

export default App
