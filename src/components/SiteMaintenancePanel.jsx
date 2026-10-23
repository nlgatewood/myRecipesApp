// SiteMaintenancePanel.jsx
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiHealth, listUnits, insertUnits, updateUnit, deleteUnit } from '../api';
import LookupManager from './LookupManager';
import CategoryManager from './CategoryManager';
import styles from '../css/SiteMaintenancePanel.module.css';

//Defined once at module level so LookupManager's load effect doesn't re-run on every render
const TABS = [
   {
      key: 'units',
      label: 'Measurement units',
      props: {
         noun: 'unit',
         nounPlural: 'units',
         hint: 'These appear in the Unit dropdown when adding or editing a recipe. Units used by a recipe can’t be deleted.',
         nameLabel: 'Code',
         namePlaceholder: 'tsp',
         descLabel: 'Description',
         descPlaceholder: 'Teaspoon(s)',
         descRequired: true,
         monoName: true,
         api: { list: listUnits, insert: insertUnits, update: updateUnit, remove: deleteUnit }
      }
   },
   {
      //Nested, so it gets its own tree editor instead of the flat LookupManager list
      key: 'categories',
      label: 'Categories',
      Component: CategoryManager
   }
];

export default function SiteMaintenancePanel() {

   //Selected tab lives in the URL (?tab=units) so a reload keeps you on the same list
   const [searchParams, setSearchParams] = useSearchParams();
   const activeKey = TABS.some(t => t.key === searchParams.get('tab')) ? searchParams.get('tab') : TABS[0].key;
   const activeTab = TABS.find(t => t.key === activeKey);

   const [health, setHealth] = useState('checking');   // checking | ok | down

   useEffect(() => {
      apiHealth()
         .then(data => setHealth(data?.ok ? 'ok' : 'down'))
         .catch(() => setHealth('down'));
   }, []);

   const healthLabel = { checking: 'Checking API…', ok: 'API connected', down: 'API unreachable' }[health];

   return (
      <div className={styles.page}>
         <div className={styles.card}>

            <header className={styles.header}>
               <div>
                  <h1 className={styles.title}>Site maintenance</h1>
                  <p className={styles.subtitle}>Manage the shared lists used across the site.</p>
               </div>

               <span className={`${styles.status} ${styles[health]}`} role="status">
                  <span className={styles.dot} aria-hidden="true" />
                  {healthLabel}
               </span>
            </header>

            <div className={styles.tabs} role="tablist" aria-label="Lists">
               {TABS.map(tab => (
                  <button
                     key={tab.key}
                     type="button"
                     role="tab"
                     aria-selected={tab.key === activeKey}
                     className={`${styles.tab} ${tab.key === activeKey ? styles.activeTab : ''}`}
                     onClick={() => setSearchParams(tab.key === TABS[0].key ? {} : { tab: tab.key }, { replace: true })}
                  >
                     {tab.label}
                  </button>
               ))}
            </div>

            {/* key remounts the manager so each tab starts with a fresh form and list */}
            <div role="tabpanel">
               {activeTab.Component
                  ? <activeTab.Component key={activeTab.key} />
                  : <LookupManager key={activeTab.key} {...activeTab.props} />}
            </div>
         </div>
      </div>
   );
}
