// CategoryManager.jsx
// Tree view for adding / editing / moving / deleting the nested recipe categories.
// Lives on the Site Maintenance page next to the unit list.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deleteCategory, insertCategory, listCategories, updateCategory } from '../api';
import styles from '../css/SiteMaintenancePanel.module.css';

const ROOT = 'ALL';
const EMPTY_FORM = { title: '', description: '', parentCode: ROOT };

const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
const titleOf = (c) => (c.code === ROOT ? 'All recipes' : c.title);

export default function CategoryManager() {

   const [categories, setCategories] = useState([]);
   const [loadStatus, setLoadStatus] = useState('loading');   // loading | ready | error
   const [collapsed, setCollapsed] = useState(() => new Set());

   const [form, setForm] = useState(EMPTY_FORM);
   const [formError, setFormError] = useState('');
   const [adding, setAdding] = useState(false);
   const titleInputRef = useRef(null);

   const [editCode, setEditCode] = useState(null);
   const [editForm, setEditForm] = useState(EMPTY_FORM);
   const [savingEdit, setSavingEdit] = useState(false);

   const [confirmCode, setConfirmCode] = useState(null);
   const [deletingCode, setDeletingCode] = useState(null);
   const [rowErrors, setRowErrors] = useState({});   // code -> message

   //Reloaded after every change so counts and the tree shape always match the database
   const load = useCallback(async () => {
      try {
         setCategories(await listCategories());
         setLoadStatus('ready');
      } catch (err) {
         console.error("Failed to load categories:", err);
         setLoadStatus('error');
      }
   }, []);

   useEffect(() => { load(); }, [load]);

   const byCode = useMemo(() => new Map(categories.map(c => [c.code, c])), [categories]);

   const childrenOf = useMemo(() => {
      const map = new Map();
      for (const c of categories) {
         if (!map.has(c.parent_code)) map.set(c.parent_code, []);
         map.get(c.parent_code).push(c);
      }
      for (const list of map.values()) list.sort((a, b) => a.title.localeCompare(b.title));
      return map;
   }, [categories]);

   //"Breads › Quick Breads" style labels for the parent dropdowns
   const pathLabel = useCallback((code) => {
      const titles = [];
      for (let cur = byCode.get(code), depth = 0; cur && depth < 20; cur = byCode.get(cur.parent_code), depth++) {
         titles.unshift(titleOf(cur));
      }
      return titles.join(' › ');
   }, [byCode]);

   //Depth-first walk from the root(s) -> rows with their depth, skipping collapsed branches
   const treeRows = useMemo(() => {
      const rows = [];
      const walk = (parentCode, depth) => {
         for (const c of childrenOf.get(parentCode) ?? []) {
            rows.push({ category: c, depth });
            if (!collapsed.has(c.code) && depth < 20) walk(c.code, depth + 1);
         }
      };
      walk(null, 0);
      return rows;
   }, [childrenOf, collapsed]);

   //Every category, labeled by path, for the parent dropdowns
   const parentOptions = useMemo(() => (
      categories
         .map(c => ({ code: c.code, label: pathLabel(c.code) }))
         .sort((a, b) => (a.code === ROOT ? -1 : b.code === ROOT ? 1 : a.label.localeCompare(b.label)))
   ), [categories, pathLabel]);

   //A category can't be moved under itself or anything beneath it
   const descendantsOf = (code) => {
      const found = new Set([code]);
      const stack = [code];
      while (stack.length) {
         for (const child of childrenOf.get(stack.pop()) ?? []) {
            if (!found.has(child.code)) { found.add(child.code); stack.push(child.code); }
         }
      }
      return found;
   };

   const setRowError = (code, message) => setRowErrors(prev => ({ ...prev, [code]: message }));

   const toggle = (code) => setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
   });

   const expand = (code) => setCollapsed(prev => {
      if (!prev.has(code)) return prev;
      const next = new Set(prev);
      next.delete(code);
      return next;
   });

   //"+" on a row: pre-fill the add form's parent and jump to it
   function addUnder(code) {
      setForm(prev => ({ ...prev, parentCode: code }));
      setFormError('');
      titleInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      titleInputRef.current?.focus({ preventScroll: true });
   }

   async function onAdd(e) {

      e.preventDefault();

      if (!form.title.trim()) {
         setFormError('Title is required.');
         return;
      }

      setAdding(true);
      setFormError('');

      try {
         await insertCategory({ title: form.title.trim(), description: form.description.trim(), parent_code: form.parentCode });
         expand(form.parentCode);   // make sure the new category is visible
         setForm(prev => ({ ...EMPTY_FORM, parentCode: prev.parentCode }));   // keep the parent for adding several in a row
         await load();
      }
      catch (err) {
         setFormError(err.message || 'Failed to add the category.');
      }
      finally {
         setAdding(false);
      }
   }

   function startEdit(c) {
      setConfirmCode(null);
      setEditCode(c.code);
      setEditForm({ title: c.title, description: c.description ?? '', parentCode: c.parent_code ?? ROOT });
      setRowError(c.code, '');
   }

   function cancelEdit() {
      if (editCode) setRowError(editCode, '');
      setEditCode(null);
   }

   async function saveEdit(c) {

      if (!editForm.title.trim()) {
         setRowError(c.code, 'Title is required.');
         return;
      }

      setSavingEdit(true);
      setRowError(c.code, '');

      try {
         await updateCategory(c.code, {
            title: editForm.title.trim(),
            description: editForm.description.trim(),
            parent_code: editForm.parentCode
         });
         expand(editForm.parentCode);   // if it moved, show it in its new spot
         setEditCode(null);
         await load();
      }
      catch (err) {
         setRowError(c.code, err.message || 'Save failed.');
      }
      finally {
         setSavingEdit(false);
      }
   }

   async function handleDelete(code) {

      setDeletingCode(code);
      setRowError(code, '');

      try {
         await deleteCategory(code);
         setConfirmCode(null);
         await load();
      }
      catch (err) {
         setRowError(code, err.message || 'Delete failed.');
      }
      finally {
         setDeletingCode(null);
      }
   }

   const editKeys = (c) => (e) => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') saveEdit(c);
      if (e.key === 'Escape') cancelEdit();
   };

   return (
      <section className={styles.section}>

         <div className={styles.sectionHeader}>
            <div className={styles.sectionHeading}>
               <h2 className={styles.sectionTitle}>Categories</h2>
               {loadStatus === 'ready' && (
                  <span className={styles.count}>{plural(Math.max(categories.length - 1, 0), 'category', 'categories')}</span>
               )}
            </div>

            {loadStatus === 'ready' && categories.length > 1 && (
               <div className={styles.treeTools}>
                  <button type="button" className={styles.linkBtn} onClick={() => setCollapsed(new Set())}>Expand all</button>
                  <button type="button" className={styles.linkBtn}
                          onClick={() => setCollapsed(new Set(categories.filter(c => c.code !== ROOT && childrenOf.has(c.code)).map(c => c.code)))}>
                     Collapse all
                  </button>
               </div>
            )}
         </div>
         <p className={styles.hint}>
            Categories nest inside each other, like the drill-down on the Home page. Use <strong>+</strong> on a row to add a
            subcategory under it. A category can only be deleted once it has no recipes and no subcategories.
         </p>

         {/* ---------- Add ---------- */}
         <form className={`${styles.addForm} ${styles.categoryForm}`} onSubmit={onAdd} noValidate>
            <label className={styles.field}>
               <span className={styles.label}>Title</span>
               <input
                  ref={titleInputRef}
                  type="text"
                  value={form.title}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  maxLength={50}
                  placeholder="Muffins"
                  autoComplete="off"
               />
            </label>

            <label className={styles.field}>
               <span className={styles.label}>Inside</span>
               <select value={form.parentCode} onChange={e => setForm(prev => ({ ...prev, parentCode: e.target.value }))}>
                  {parentOptions.map(o => (
                     <option key={o.code} value={o.code}>{o.code === ROOT ? 'All recipes (top level)' : o.label}</option>
                  ))}
               </select>
            </label>

            <label className={styles.field}>
               <span className={styles.label}>Description <span className={styles.optional}>(optional)</span></span>
               <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Any type of muffins"
                  autoComplete="off"
               />
            </label>

            <button type="submit" className={styles.primaryBtn} disabled={adding || loadStatus !== 'ready'}>
               {adding ? 'Adding…' : '+ Add category'}
            </button>

            {formError && <p className={`${styles.error} ${styles.formError}`} role="alert">{formError}</p>}
         </form>

         {/* ---------- Tree ---------- */}
         {loadStatus === 'loading' && <p className={styles.empty}>Loading categories…</p>}
         {loadStatus === 'error' && <p className={styles.empty}>Could not load categories. Check that the API is running.</p>}

         {loadStatus === 'ready' && (
            <ul className={`${styles.rows} ${styles.tree}`} role="tree" aria-label="Categories">
               {treeRows.map(({ category: c, depth }) => {
                  const children = childrenOf.get(c.code) ?? [];
                  const isRoot = c.code === ROOT;
                  const editing = editCode === c.code;
                  const confirming = confirmCode === c.code;
                  const deletable = !isRoot && children.length === 0 && c.recipe_count === 0;
                  const open = !collapsed.has(c.code);

                  const meta = [
                     isRoot ? null : plural(c.recipe_count, 'recipe'),
                     children.length ? plural(children.length, 'subcategory', 'subcategories') : null
                  ].filter(Boolean).join(' · ');

                  return (
                     <li
                        key={c.code}
                        role="treeitem"
                        aria-expanded={children.length ? open : undefined}
                        className={`${styles.treeRow} ${editing ? styles.editing : ''} ${confirming ? styles.confirming : ''}`}
                        style={{ '--depth': depth }}
                     >
                        <div className={styles.treeMain}>
                           {children.length > 0 ? (
                              <button type="button" className={styles.toggle} onClick={() => toggle(c.code)}
                                      aria-label={`${open ? 'Collapse' : 'Expand'} ${titleOf(c)}`}>
                                 <span className={open ? styles.chevronOpen : styles.chevronClosed} aria-hidden="true">›</span>
                              </button>
                           ) : (
                              <span className={styles.toggleSpacer} aria-hidden="true" />
                           )}

                           <div className={styles.treeText}>
                              <span className={styles.treeTitle}>
                                 {titleOf(c)}
                                 <span className={styles.codeChip} title="Category code (generated, can't be changed)">{c.code}</span>
                              </span>
                              {c.description && !editing && <span className={styles.treeDesc}>{c.description}</span>}
                           </div>

                           {meta && <span className={styles.usage}>{meta}</span>}

                           <span className={styles.actions}>
                              {confirming ? (
                                 <>
                                    <span className={styles.confirmText}>Delete?</span>
                                    <button type="button" className={styles.ghostBtn} disabled={deletingCode === c.code}
                                            onClick={() => { setConfirmCode(null); setRowError(c.code, ''); }}>
                                       Cancel
                                    </button>
                                    <button type="button" className={styles.dangerBtn} disabled={deletingCode === c.code}
                                            onClick={() => handleDelete(c.code)} autoFocus>
                                       {deletingCode === c.code ? 'Deleting…' : 'Delete'}
                                    </button>
                                 </>
                              ) : !editing && (
                                 <>
                                    <button type="button" className={styles.iconBtn} onClick={() => addUnder(c.code)}
                                            aria-label={`Add a subcategory under ${titleOf(c)}`} title="Add subcategory">
                                       +
                                    </button>
                                    {isRoot ? (
                                       <span className={styles.iconPlaceholder} aria-hidden="true" />
                                    ) : (
                                       <button type="button" className={styles.iconBtn} onClick={() => startEdit(c)}
                                               aria-label={`Edit ${c.title}`} title="Edit">
                                          ✎
                                       </button>
                                    )}
                                    {deletable ? (
                                       <button type="button" className={`${styles.iconBtn} ${styles.removeBtn}`}
                                               onClick={() => { setEditCode(null); setConfirmCode(c.code); }}
                                               aria-label={`Delete ${c.title}`} title="Delete">
                                          ✕
                                       </button>
                                    ) : (
                                       <span className={styles.iconPlaceholder} aria-hidden="true" />
                                    )}
                                 </>
                              )}
                           </span>
                        </div>

                        {/* ---------- Inline edit ---------- */}
                        {editing && (
                           <div className={styles.editPanel} onKeyDown={editKeys(c)}>
                              <label className={styles.field}>
                                 <span className={styles.label}>Title</span>
                                 <input
                                    type="text"
                                    value={editForm.title}
                                    onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                                    maxLength={50}
                                    autoFocus
                                 />
                              </label>

                              <label className={styles.field}>
                                 <span className={styles.label}>Inside</span>
                                 <select value={editForm.parentCode} onChange={e => setEditForm(prev => ({ ...prev, parentCode: e.target.value }))}>
                                    {(() => {
                                       const blocked = descendantsOf(c.code);
                                       return parentOptions
                                          .filter(o => !blocked.has(o.code))
                                          .map(o => (
                                             <option key={o.code} value={o.code}>{o.code === ROOT ? 'All recipes (top level)' : o.label}</option>
                                          ));
                                    })()}
                                 </select>
                              </label>

                              <label className={`${styles.field} ${styles.editWide}`}>
                                 <span className={styles.label}>Description <span className={styles.optional}>(optional)</span></span>
                                 <input
                                    type="text"
                                    value={editForm.description}
                                    onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                 />
                              </label>

                              <div className={styles.editActions}>
                                 <button type="button" className={styles.ghostBtn} onClick={cancelEdit} disabled={savingEdit}>Cancel</button>
                                 <button type="button" className={styles.saveBtn} onClick={() => saveEdit(c)} disabled={savingEdit}>
                                    {savingEdit ? 'Saving…' : 'Save'}
                                 </button>
                              </div>
                           </div>
                        )}

                        {rowErrors[c.code] && <p className={`${styles.error} ${styles.treeNote}`}>{rowErrors[c.code]}</p>}
                     </li>
                  );
               })}
            </ul>
         )}
      </section>
   );
}
