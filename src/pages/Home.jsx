import { useState } from 'react'

export default function Home() {

   const [count, setCount] = useState(0)

   return (
      <div style={{ padding: 16, maxWidth: 960, margin: '0 auto' }}>
         <h1>My Recipes!</h1>
	 <div className="card">
	    <button onClick={() => setCount((count) => count+1)}> count is {count} </button> 
	 </div>
      </div>
  )
}
