import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

export default function Home() {

   const [count, setCount] = useState(0)

   return (
      <div style={{ padding: 16, maxWidth: 960, margin: '0 auto' }}>
         <h1>My Recipes!</h1>
	 <div className="card">
	    <button onClick={() => setCount((count) => count+1)}> count is {count} </button> 
	 </div>
      {/* Simple link to another page */}
      <p><Link to="/site-maintenance">Go to Site Maintenance</Link></p>
      </div>
  )
}
