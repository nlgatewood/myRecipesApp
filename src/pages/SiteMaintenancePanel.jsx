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
      } catch (e) { setErr(String(e)); }
    })();
  }, []);

  async function onSubmit(e) {

    e.preventDefault();
    setErr('');

    try {
      const saved = await insertUnits(form);

      // Update in place (upsert behavior)
      setRows(prev => {
        const i = prev.findIndex(r => r.code === saved.code);
        if (i >= 0) { const copy = prev.slice(); copy[i] = saved; return copy; }
        return [saved, ...prev];
      });
      setForm({ code: '', description: '' });
    } catch (e) { setErr(String(e)); }
  }

  async function onDeleteClick(code) {
     if (!window.confirm(`Delete "${code}"?`)) return;
     setErr('');
     setDeleting(code);
     try {
       await deleteUnit(code); // call your API
       // remove from UI immediately
       setRows(prev => prev.filter(r => r.code !== code));
     } catch (e) {
       setErr(String(e.message || e));
     } finally {
       setDeleting(null);
     }
   }

  return (
    <div style={{ maxWidth: 640, margin: '2rem auto' }}>
      <h2>Units <small>api: {health}</small></h2>

      <form className={styles.addForm} onSubmit={onSubmit}>
	 <h3>Update Measurement Units</h3> 
         <button type="submit">Add</button>
         <input id={styles.addCode} placeholder="Code (e.g. tsp)" value={form.code} onChange={e=>setForm({...form, code: e.target.value})}required />
         <input id={styles.addDesc} placeholder="description (e.g. teapsoon)" value={form.description} onChange={e=>setForm({...form, description: e.target.value})} required />
      </form>

      {err && <div style={{color:'crimson', marginTop: 8}}>Error: {err}</div>}

      <ul className={styles.delTable}>
         {rows.map(r => (
            <li key={r.code} className={styles.delRow}>
	       <span className={styles.delCode}>{r.code}</span>
	       <span className={styles.delDesc}>{r.description}</span>
	       <span className={styles.delButton}>
		 <button type="button" onClick={() => onDeleteClick(r.code)} disabled={deleting === r.code}>{deleting === r.code ? 'Deleting…' : 'Delete'}</button>
	       </span>
             </li>
         ))}
      </ul>
    </div>
  );
}

