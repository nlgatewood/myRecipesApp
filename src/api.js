// src/api.js  (works in prod '/gwfamilytree/api/' and dev '/api/' with Vite proxy)

// Build API base safely from Vite's path-like BASE_URL
const BASE = (import.meta?.env?.BASE_URL ?? '/');
const API_BASE = (BASE.endsWith('/') ? BASE : BASE + '/') + 'api/';
const apiPath = (p = '') => API_BASE + String(p).replace(/^\/+/, ''); // strip any leading '/'

async function jsonOrThrow(res) {
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!res.ok) {
    const msg = data && typeof data !== 'string' ? JSON.stringify(data) : (data || '');
    throw new Error(`${res.status} ${res.statusText}${msg ? ` - ${msg}` : ''}`);
  }
  return data;
}

export async function listUnits() {
  const res = await fetch(apiPath('units'), { credentials: 'same-origin' });
  return jsonOrThrow(res);
}

export async function insertUnits({ name, description }) {
  const res = await fetch(apiPath('units'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ name, description })
  });
  return jsonOrThrow(res);
}

// src/api.js
export async function deleteUnit(id) {
  const c = String(id || '').trim();
  if (!c) throw new Error('id is required');

  const res = await fetch(`${API_BASE}/units/${encodeURIComponent(c)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  if (res.status === 204) return true;

  let msg = res.statusText || 'Delete failed';
  try { const data = await res.json(); if (data?.error) msg = data.error; } catch {}
  throw new Error(msg);
}

/*--------------------------------------
 * listIngredients()
 *
 *--------------------------------------*/
export async function listIngredients() {

   const res = await fetch(apiPath('ingredients'), { credentials: 'same-origin' });
   return jsonOrThrow(res);
}

/*--------------------------------------
 * insertIngredient()
 *
 *--------------------------------------*/
export async function insertIngredient({ name, description }) {

   const res = await fetch(apiPath('ingredients'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ name, description })
   });

   return jsonOrThrow(res);
}

/*--------------------------------------
 * deleteIngredient()
 *
 *--------------------------------------*/
export async function deleteIngredient(id) {

   const c = Number(id);
   if (!c) throw new Error('id is required');

   const res = await fetch(`${API_BASE}/ingredients/${encodeURIComponent(c)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
   });

   if (res.status === 204) return true;

   let msg = res.statusText || 'Delete failed';

   try { 
      const data = await res.json(); if (data?.error) msg = data.error; 
   } 
   catch {
   }
   throw new Error(msg);
}



export async function apiHealth() {
  const res = await fetch(apiPath('health'), { credentials: 'same-origin' });
  return jsonOrThrow(res);
}

