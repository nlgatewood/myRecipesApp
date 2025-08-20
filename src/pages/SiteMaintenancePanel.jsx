// /var/www/gwfamilytreeapp/src/SiteMaintenancePanel.jsx
import { useEffect, useState } from 'react';
import { apiHealth, listUnits, insertUnits, deleteUnit } from '../api';
import styles from '../css/SiteMaintenancePanel.module.css';

export default function SiteMaintenancePanel() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ code: '', description: '' });
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

      const submitter = e.nativeEvent.submitter; // the button that triggered submit
      const action = submitter?.name;            // 'add' or 'delete'
      const codeForDelete = submitter?.value;    // carries row code for delete

      try {
         if (action === 'add') {

            if (!form.code.trim() || !form.description.trim()) {
               setErr('Both code and description are required.');
               return;
            }

            const payload = { code: form.code.trim(), description: form.description.trim() };
            const saved = await insertUnits(payload);

            setRows(prev => {
               const i = prev.findIndex(r => r.code === saved.code);

               if (i >= 0) { 
                  const copy = prev.slice(); copy[i] = saved; return copy; 
               }

               return [saved, ...prev];
            });

            setForm({ code: '', description: '' });

         } 
         else if (action === 'delete') {

            const code = codeForDelete;

            if (!window.confirm(`Delete "${code}"?`)) return;
            await deleteUnit(code);
            setRows(prev => prev.filter(r => r.code !== code));
         }
      } 
      catch (e2) {
         setErr(String(e2));
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
               placeholder="Code (e.g. tsp)"
               value={form.code}
               onChange={e => setForm({ ...form, code: e.target.value })}
               required={false}/>

            <input
               id={styles.addDesc}
               placeholder="description (e.g. teaspoon)"
               value={form.description}
               onChange={e => setForm({ ...form, description: e.target.value })}
               required={false} />

            {/* Delete controls (one button per row, still submits the same form) */}
            <ul className={styles.delTable}>
               {rows.map(r => (
                  <li key={r.code} className={styles.delRow}>
                     <span className={styles.delCode}>{r.code}</span>
                     <span className={styles.delDesc}>{r.description}</span>
                     <span className={styles.delButton}>

                        <button
                           type="submit"
                           name="delete"
                           value={r.code} // read as submitter.value
                           disabled={deleting === r.code} >
                           {deleting === r.code ? 'Deleting…' : 'Delete'}
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

