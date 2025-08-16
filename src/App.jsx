import { useState } from 'react'
import { Routes, Route, NavLink, Outlet } from 'react-router-dom'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import Home from './pages/Home.jsx'
import GenderCodesPanel from './pages/GenderCodesPanel';
import './App.css'

function Layout(){

  const [count, setCount] = useState(0);

  return (
    <div style={{ padding: 16, maxWidth: 960, margin: '0 auto' }}>
      <nav style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
	<NavLink to="/">Home</NavLink>
        <NavLink to="/gender-codes">Gender Codes</NavLink>
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
        <Route path="gender-codes" element={<GenderCodesPanel />} />
      </Route>
    </Routes>
  )

}

export default App
