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

export async function listGenderCodes() {
  const res = await fetch(apiPath('gender_codes'), { credentials: 'same-origin' });
  return jsonOrThrow(res);
}

export async function upsertGenderCode({ gender_code, gender_desc, gender_long_desc }) {
  const res = await fetch(apiPath('gender_codes'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ gender_code, gender_desc, gender_long_desc })
  });
  return jsonOrThrow(res);
}

export async function apiHealth() {
  const res = await fetch(apiPath('health'), { credentials: 'same-origin' });
  return jsonOrThrow(res);
}

