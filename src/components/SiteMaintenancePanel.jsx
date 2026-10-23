// SiteMaintenancePanel.jsx
import { useEffect, useState } from 'react';
import { apiHealth, listUnits, insertUnits, deleteUnit } from '../api';
import styles from '../css/SiteMaintenancePanel.module.css';

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

export default function SiteMaintenancePanel() {

   const [rows, setRows] = useState([]);
   const [form, setForm] = useState({ name: '', description: '' });
   const [health, setHealth] = useState('checking');        // checking | ok | down
   const [loadStatus, setLoadStatus] = useState('loading'); // loading | ready | error

   const [formError, setFormError] = useState('');
   const [adding, setAdding] = useState(false);

   const [confirmId, setConfirmId] = useState(null);    // row showing "Delete?" confirmation
   const [deletingId, setDeletingId] = useState(null);
   const [rowErrors, setRowErrors] = useState({});      // id -> message

   useEffect(() => {

      //Check health and load units separately so one failing doesn't hide the other
      apiHealth()
         .then(data => setHealth(data?.ok ? 'ok' : 'down'))
         .catch(() => setHealth('down'));

      listUnits()
         .then(data => {
            setRows([...data].sort(byName));
            setLoadStatus('ready');
         })
         .catch(err => {
            console.error("Failed to load units:", err);
            setLoadStatus('error');
         });
   }, []);

   const updateField = (e) => {
      const { name, value } = e.target;
      setForm(prev => ({ ...prev, [name]: value }));
   };

   async function onSubmit(e) {

      e.preventDefault();
      setFormError('');

      const payload = { name: form.name.trim(), description: form.description.trim() };

      if (!payload.name || !payload.description) {
         setFormError('Both a code and a description are required.');
         return;
      }

      setAdding(true);

      try {
         const saved = await insertUnits(payload);
         setRows(prev => [...prev, saved].sort(byName));
         setForm({ name: '', description: '' });
      }
      catch (err) {
         setFormError(err.message || 'Failed to add the unit.');
      }
      finally {
         setAdding(false);
      }
   }

   async function handleDelete(id) {

      setDeletingId(id);
      setRowErrors(prev => ({ ...prev, [id]: '' }));

      try {
         await deleteUnit(id);
         setRows(prev => prev.filter(r => r.id !== id));
         setConfirmId(null);
      }
      catch (err) {
         const message = err.message === 'Unit is in use'
            ? "Can't delete: this unit is used by at least one recipe."
            : err.message || 'Delete failed.';
         setRowErrors(prev => ({ ...prev, [id]: message }));
      }
      finally {
         setDeletingId(null);
      }
   }

   const healthLabel = { checking: 'Checking API…', ok: 'API connected', down: 'API unreachable' }[health];

   return (
      <div className={styles.page}>
         <div className={styles.card}>

            <header className={styles.header}>
               <div>
                  <h1 className={styles.title}>Site maintenance</h1>
                  <p className={styles.subtitle}>Manage the lookup lists used across the site.</p>
               </div>

               <span className={`${styles.status} ${styles[health]}`} role="status">
                  <span className={styles.dot} aria-hidden="true" />
                  {healthLabel}
               </span>
            </header>

            {/* ---------- Measurement units ---------- */}
            <section className={styles.section}>
               <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Measurement units</h2>
                  {loadStatus === 'ready' && <span className={styles.count}>{rows.length} units</span>}
               </div>
               <p className={styles.hint}>These appear in the Unit dropdown when adding or editing a recipe.</p>

               <form className={styles.addForm} onSubmit={onSubmit} noValidate>
                  <label className={styles.field}>
                     <span className={styles.label}>Code</span>
                     <input
                        type="text"
                        name="name"
                        value={form.name}
                        onChange={updateField}
                        placeholder="tsp"
                        autoComplete="off"
                     />
                  </label>

                  <label className={styles.field}>
                     <span className={styles.label}>Description</span>
                     <input
                        type="text"
                        name="description"
                        value={form.description}
                        onChange={updateField}
                        placeholder="Teaspoon(s)"
                        autoComplete="off"
                     />
                  </label>

                  <button type="submit" className={styles.primaryBtn} disabled={adding}>
                     {adding ? 'Adding…' : '+ Add unit'}
                  </button>

                  {formError && <p className={`${styles.error} ${styles.formError}`} role="alert">{formError}</p>}
               </form>

               {loadStatus === 'loading' && <p className={styles.empty}>Loading units…</p>}
               {loadStatus === 'error' && <p className={styles.empty}>Could not load units. Check that the API is running.</p>}
               {loadStatus === 'ready' && rows.length === 0 && <p className={styles.empty}>No units yet.</p>}

               {rows.length > 0 && (
                  <div className={styles.table}>
                     <div className={`${styles.row} ${styles.headerRow}`} aria-hidden="true">
                        <span>Code</span>
                        <span>Description</span>
                        <span />
                     </div>

                     <ul className={styles.rows}>
                        {rows.map(r => (
                           <li key={r.id} className={`${styles.row} ${confirmId === r.id ? styles.confirming : ''}`}>
                              <span className={styles.code}>{r.name}</span>
                              <span className={styles.desc}>{r.description}</span>

                              <span className={styles.actions}>
                                 {confirmId === r.id ? (
                                    <>
                                       <span className={styles.confirmText}>Delete?</span>
                                       <button type="button" className={styles.ghostBtn} disabled={deletingId === r.id}
                                               onClick={() => { setConfirmId(null); setRowErrors(prev => ({ ...prev, [r.id]: '' })); }}>
                                          Cancel
                                       </button>
                                       <button type="button" className={styles.dangerBtn} disabled={deletingId === r.id}
                                               onClick={() => handleDelete(r.id)} autoFocus>
                                          {deletingId === r.id ? 'Deleting…' : 'Delete'}
                                       </button>
                                    </>
                                 ) : (
                                    <button type="button" className={styles.iconBtn} onClick={() => setConfirmId(r.id)}
                                            aria-label={`Delete ${r.name}`}>
                                       ✕
                                    </button>
                                 )}
                              </span>

                              {rowErrors[r.id] && <p className={`${styles.error} ${styles.rowError}`}>{rowErrors[r.id]}</p>}
                           </li>
                        ))}
                     </ul>
                  </div>
               )}
            </section>
         </div>
      </div>
   );
}
