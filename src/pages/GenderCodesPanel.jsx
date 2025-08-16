// /var/www/gwfamilytreeapp/src/GenderCodesPanel.jsx
import { useEffect, useState } from 'react';
import { apiHealth, listGenderCodes, upsertGenderCode } from '../api';

export default function GenderCodesPanel() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ gender_code: '', gender_desc: '', gender_long_desc: '' });
  const [err, setErr] = useState('');
  const [health, setHealth] = useState('…');

  useEffect(() => {
    (async () => {
      try {
        setHealth((await apiHealth()).ok ? 'ok' : 'down');
        setRows(await listGenderCodes());
      } catch (e) { setErr(String(e)); }
    })();
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    try {
      const saved = await upsertGenderCode(form);
      // Update in place (upsert behavior)
      setRows(prev => {
        const i = prev.findIndex(r => r.gender_code === saved.gender_code);
        if (i >= 0) { const copy = prev.slice(); copy[i] = saved; return copy; }
        return [saved, ...prev];
      });
      setForm({ gender_code: '', gender_desc: '', gender_long_desc: '' });
    } catch (e) { setErr(String(e)); }
  }

  return (
    <div style={{ maxWidth: 640, margin: '2rem auto' }}>
      <h2>Gender Codes <small>api: {health}</small></h2>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 8 }}>
        <input placeholder="Code (e.g. M)" value={form.gender_code}
               onChange={e=>setForm({...form, gender_code: e.target.value})} required />
        <input placeholder="Short description (e.g. Male)" value={form.gender_desc}
               onChange={e=>setForm({...form, gender_desc: e.target.value})} required />
        <input placeholder="Long description" value={form.gender_long_desc}
               onChange={e=>setForm({...form, gender_long_desc: e.target.value})} required />
        <button type="submit">Save</button>
      </form>
      {err && <div style={{color:'crimson', marginTop: 8}}>Error: {err}</div>}
      <ul style={{ marginTop: 16 }}>
        {rows.map(r => (
          <li key={r.gender_code}>
            <strong>{r.gender_code}</strong> — {r.gender_desc}
            <div style={{ fontSize: 12, color: '#666' }}>{r.gender_long_desc}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

