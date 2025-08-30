// /var/www/gwfamilytreeapp/src/SiteMaintenancePanel.jsx
import { useEffect, useState } from 'react';
import { apiHealth, listUnits, insertUnits, deleteUnit } from '../api';
import styles from '../css/SiteMaintenancePanel.module.css';

export default function SiteMaintenancePanel() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ name: '', description: '' });
  const [deleting, setDeleting] = useState(null);
  const [err, setErr] = useState('');
  const [health, setHealth] = useState('…');

  useEffect(() => {
    (async () => {
      try {
        setHealth((await apiHealth()).ok ? 'ok' : 'down');
        setRows(await listUnits());
      } 
      catch (e) { setErr(String(e)); }
    })();
  }, []);

   async function onSubmit(e) {

      e.preventDefault();
      setErr('');

      try {
         if (!form.name.trim() || !form.description.trim()) {

            setErr('Both name and description are required.');
            return;
         }

         const payload = { name: form.name.trim(), description: form.description.trim() };
         const saved = await insertUnits(payload);

         setRows(prev => {
            const i = prev.findIndex(r => r.name === saved.name);

            if (i >= 0) { 
               const copy = prev.slice(); copy[i] = saved; return copy; 
            }

            return [saved, ...prev];
         });

         setForm({ name: '', description: '' });
      } 
      catch (e2) {
         setErr(String(e2));
      }
   }

   async function handleDelete(id, name) {

      if (!window.confirm(`Delete "${name}"?`)) return;

      try {
         await deleteUnit(id);
         setRows(prev => prev.filter(r => r.id !== id));
      }
      catch (e) {
         setErr(String(e));
      }
         
   }

   return (

      <div style={{ maxWidth: 640, margin: '2rem auto' }}>
         <h2>Units <small>api: {health}</small></h2>

         <form className={styles.addForm} onSubmit={onSubmit}>
            <h3>Update Measurement Units</h3>

            {/* Add controls */}
            <button type="submit" name="add">Add</button>
            <input
               id={styles.addCode}
               name="name"
               placeholder="Name Code (e.g. tsp)"
               value={form.name}
               onChange={e => setForm({ ...form, name: e.target.value })}
               required={false}/>

            <input
               id={styles.addDesc}
               name="description"
               placeholder="description (e.g. teaspoon)"
               value={form.description}
               onChange={e => setForm({ ...form, description: e.target.value })}
               required={false} />

            {/* Delete controls (one button per row, still submits the same form) */}
            <ul className={styles.delTable}>
               {rows.map(r => (
                  <li key={r.id} className={styles.delRow}>
                     <span className={styles.delCode}>{r.name}</span>
                     <span className={styles.delDesc}>{r.description}</span>
                     <span className={styles.delButton}>

                        <button
                           type="button"
                           name="delete"
                           onClick={() => handleDelete(r.id, r.name)}
                           disabled={deleting === r.name} >
                           {deleting === r.name ? 'Deleting…' : 'Delete'}
                        </button>

                     </span>
                  </li>
               ))}
            </ul>
         </form>

         {err && <div style={{ color:'crimson', marginTop: 8 }}>Error: {err}</div>}
      </div>
   );
}

