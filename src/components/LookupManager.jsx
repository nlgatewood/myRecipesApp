// LookupManager.jsx
// Add / edit / delete for a simple { id, name, description, recipe_count } lookup list.
// Used by the Site Maintenance page for measurement units.
import { useEffect, useState } from 'react';
import styles from '../css/SiteMaintenancePanel.module.css';

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
const EMPTY = { name: '', description: '' };
const FILTER_THRESHOLD = 8;   // only show the filter box once the list is long enough to need it

const usedIn = (n) => (n === 1 ? 'Used in 1 recipe' : `Used in ${n} recipes`);

export default function LookupManager({
   noun,                   // 'unit'
   nounPlural,             // 'units'
   hint,
   nameLabel,
   namePlaceholder,
   descLabel,
   descPlaceholder,
   descRequired = false,
   monoName = false,       // show names in a code font (units like "tsp")
   api                     // { list, insert, update, remove }
}) {

   const [rows, setRows] = useState([]);
   const [loadStatus, setLoadStatus] = useState('loading');   // loading | ready | error
   const [filter, setFilter] = useState('');

   const [form, setForm] = useState(EMPTY);
   const [formError, setFormError] = useState('');
   const [adding, setAdding] = useState(false);

   const [editId, setEditId] = useState(null);
   const [editForm, setEditForm] = useState(EMPTY);
   const [savingEdit, setSavingEdit] = useState(false);

   const [confirmId, setConfirmId] = useState(null);   // row showing the "Delete?" confirmation
   const [deletingId, setDeletingId] = useState(null);
   const [rowErrors, setRowErrors] = useState({});     // id -> message

   useEffect(() => {

      api.list()
         .then(data => {
            setRows([...data].sort(byName));
            setLoadStatus('ready');
         })
         .catch(err => {
            console.error(`Failed to load ${nounPlural}:`, err);
            setLoadStatus('error');
         });
   }, [api, nounPlural]);

   const setRowError = (id, message) => setRowErrors(prev => ({ ...prev, [id]: message }));

   //Client-side check so obvious mistakes don't need a round trip (the server checks too)
   function validate(values) {
      if (!values.name.trim()) return `${nameLabel} is required.`;
      if (descRequired && !values.description.trim()) return `${descLabel} is required.`;
      return '';
   }

   async function onAdd(e) {

      e.preventDefault();

      const problem = validate(form);
      setFormError(problem);
      if (problem) return;

      setAdding(true);

      try {
         const saved = await api.insert({ name: form.name.trim(), description: form.description.trim() });
         setRows(prev => [...prev, saved].sort(byName));
         setForm(EMPTY);
      }
      catch (err) {
         setFormError(err.message || `Failed to add the ${noun}.`);
      }
      finally {
         setAdding(false);
      }
   }

   function startEdit(row) {
      setConfirmId(null);
      setEditId(row.id);
      setEditForm({ name: row.name, description: row.description ?? '' });
      setRowError(row.id, '');
   }

   function cancelEdit() {
      if (editId) setRowError(editId, '');
      setEditId(null);
   }

   async function saveEdit(row) {

      const problem = validate(editForm);
      if (problem) {
         setRowError(row.id, problem);
         return;
      }

      setSavingEdit(true);
      setRowError(row.id, '');

      try {
         const saved = await api.update(row.id, { name: editForm.name.trim(), description: editForm.description.trim() });
         setRows(prev => prev.map(r => (r.id === row.id ? { ...r, ...saved } : r)).sort(byName));
         setEditId(null);
      }
      catch (err) {
         setRowError(row.id, err.message || 'Save failed.');
      }
      finally {
         setSavingEdit(false);
      }
   }

   async function handleDelete(id) {

      setDeletingId(id);
      setRowError(id, '');

      try {
         await api.remove(id);
         setRows(prev => prev.filter(r => r.id !== id));
         setConfirmId(null);
      }
      catch (err) {
         setRowError(id, err.message || 'Delete failed.');
      }
      finally {
         setDeletingId(null);
      }
   }

   const search = filter.trim().toLowerCase();
   const visibleRows = search
      ? rows.filter(r => `${r.name} ${r.description ?? ''}`.toLowerCase().includes(search))
      : rows;

   const showFilter = rows.length > FILTER_THRESHOLD;

   return (
      <section className={styles.section}>

         <div className={styles.sectionHeader}>
            <div className={styles.sectionHeading}>
               <h2 className={styles.sectionTitle}>{nounPlural[0].toUpperCase() + nounPlural.slice(1)}</h2>
               {loadStatus === 'ready' && (
                  <span className={styles.count}>
                     {search ? `${visibleRows.length} of ${rows.length}` : rows.length} {rows.length === 1 ? noun : nounPlural}
                  </span>
               )}
            </div>

            {showFilter && (
               <label className={styles.filter}>
                  <span className={styles.srOnly}>Filter {nounPlural}</span>
                  <input
                     type="search"
                     value={filter}
                     onChange={e => setFilter(e.target.value)}
                     placeholder={`Filter ${nounPlural}…`}
                  />
               </label>
            )}
         </div>
         <p className={styles.hint}>{hint}</p>

         {/* ---------- Add ---------- */}
         <form className={styles.addForm} onSubmit={onAdd} noValidate>
            <label className={styles.field}>
               <span className={styles.label}>{nameLabel}</span>
               <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={namePlaceholder}
                  autoComplete="off"
               />
            </label>

            <label className={styles.field}>
               <span className={styles.label}>
                  {descLabel} {!descRequired && <span className={styles.optional}>(optional)</span>}
               </span>
               <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={descPlaceholder}
                  autoComplete="off"
               />
            </label>

            <button type="submit" className={styles.primaryBtn} disabled={adding}>
               {adding ? 'Adding…' : `+ Add ${noun}`}
            </button>

            {formError && <p className={`${styles.error} ${styles.formError}`} role="alert">{formError}</p>}
         </form>

         {/* ---------- List ---------- */}
         {loadStatus === 'loading' && <p className={styles.empty}>Loading {nounPlural}…</p>}
         {loadStatus === 'error' && <p className={styles.empty}>Could not load {nounPlural}. Check that the API is running.</p>}
         {loadStatus === 'ready' && rows.length === 0 && <p className={styles.empty}>No {nounPlural} yet.</p>}
         {rows.length > 0 && visibleRows.length === 0 && <p className={styles.empty}>No {nounPlural} match “{filter.trim()}”.</p>}

         {visibleRows.length > 0 && (
            <div className={styles.table}>
               <div className={`${styles.row} ${styles.headerRow}`} aria-hidden="true">
                  <span>{nameLabel}</span>
                  <span>{descLabel}</span>
                  <span>Usage</span>
                  <span />
               </div>

               <ul className={styles.rows}>
                  {visibleRows.map(r => {
                     const editing = editId === r.id;
                     const confirming = confirmId === r.id;
                     const inUse = r.recipe_count > 0;

                     return (
                        <li key={r.id} className={`${styles.row} ${editing ? styles.editing : ''} ${confirming ? styles.confirming : ''}`}>
                           {editing ? (
                              <>
                                 <input
                                    className={styles.cellInput}
                                    type="text"
                                    value={editForm.name}
                                    onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                    onKeyDown={e => {
                                       if (e.key === 'Enter') saveEdit(r);
                                       if (e.key === 'Escape') cancelEdit();
                                    }}
                                    aria-label={nameLabel}
                                    autoFocus
                                 />
                                 <input
                                    className={styles.cellInput}
                                    type="text"
                                    value={editForm.description}
                                    onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                    onKeyDown={e => {
                                       if (e.key === 'Enter') saveEdit(r);
                                       if (e.key === 'Escape') cancelEdit();
                                    }}
                                    aria-label={descLabel}
                                    placeholder={descRequired ? '' : '(optional)'}
                                 />
                              </>
                           ) : (
                              <>
                                 <span className={monoName ? styles.code : styles.name}>{r.name}</span>
                                 <span className={styles.desc}>{r.description || <span className={styles.muted}>—</span>}</span>
                              </>
                           )}

                           <span className={styles.usage}>{inUse ? usedIn(r.recipe_count) : 'Unused'}</span>

                           <span className={styles.actions}>
                              {editing && (
                                 <>
                                    <button type="button" className={styles.ghostBtn} onClick={cancelEdit} disabled={savingEdit}>Cancel</button>
                                    <button type="button" className={styles.saveBtn} onClick={() => saveEdit(r)} disabled={savingEdit}>
                                       {savingEdit ? 'Saving…' : 'Save'}
                                    </button>
                                 </>
                              )}

                              {confirming && (
                                 <>
                                    <span className={styles.confirmText}>Delete?</span>
                                    <button type="button" className={styles.ghostBtn} disabled={deletingId === r.id}
                                            onClick={() => { setConfirmId(null); setRowError(r.id, ''); }}>
                                       Cancel
                                    </button>
                                    <button type="button" className={styles.dangerBtn} disabled={deletingId === r.id}
                                            onClick={() => handleDelete(r.id)} autoFocus>
                                       {deletingId === r.id ? 'Deleting…' : 'Delete'}
                                    </button>
                                 </>
                              )}

                              {!editing && !confirming && (
                                 <>
                                    <button type="button" className={styles.iconBtn} onClick={() => startEdit(r)}
                                            aria-label={`Edit ${r.name}`} title="Edit">
                                       ✎
                                    </button>
                                    {/* Items used by a recipe can't be deleted, so don't offer it */}
                                    {inUse ? (
                                       <span className={styles.iconPlaceholder} aria-hidden="true" />
                                    ) : (
                                       <button type="button" className={`${styles.iconBtn} ${styles.removeBtn}`}
                                               onClick={() => { setEditId(null); setConfirmId(r.id); }}
                                               aria-label={`Delete ${r.name}`} title="Delete">
                                          ✕
                                       </button>
                                    )}
                                 </>
                              )}
                           </span>

                           {editing && inUse && !rowErrors[r.id] && (
                              <p className={`${styles.hint} ${styles.rowNote}`}>
                                 Changes apply to all {r.recipe_count === 1 ? '1 recipe' : `${r.recipe_count} recipes`} that use this {noun}.
                              </p>
                           )}
                           {rowErrors[r.id] && <p className={`${styles.error} ${styles.rowNote}`}>{rowErrors[r.id]}</p>}
                        </li>
                     );
                  })}
               </ul>
            </div>
         )}
      </section>
   );
}
