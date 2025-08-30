import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

async function onSubmit(e) {

}

export default function Home() {

   const [count, setCount] = useState(0)

   return (
      <div style={{ padding: 16, maxWidth: 960, margin: '0 auto' }}>
         <h1>My Recipes!</h1>

         <form onSubmit="">
            <div className="searchDiv">
               <input type='text'/>
               <button type="submit">Search</button>
            </div>
         </form>

         <p><Link to="/site-maintenance">Go to Site Maintenance</Link></p>
      </div>
  )
}
