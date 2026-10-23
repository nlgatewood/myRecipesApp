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

/*--------------------------------------
 * getRecipeDetails()
 *
 *--------------------------------------*/
export async function getRecipeDetails(recipeId) {

  const params = new URLSearchParams();

  if (recipeId) {
    params.set('recipeId', recipeId);
  }

  const url = `${apiPath('recipe-details')}${
    params.toString() ? `?${params}` : ''
  }`;

  const res = await fetch(url, {credentials: 'same-origin'});

  return jsonOrThrow(res);
}

/*--------------------------------------
 * getRecipeIngredients()
 *
 *--------------------------------------*/
export async function getRecipeIngredients(recipeId) {

  const params = new URLSearchParams();

  if (recipeId) {
    params.set('recipeId', recipeId);
  }

  const url = `${apiPath('recipe-ingredients')}${
    params.toString() ? `?${params}` : ''
  }`;

  const res = await fetch(url, {credentials: 'same-origin'});

  return jsonOrThrow(res);
}

/*--------------------------------------
 * getRecipeSteps()
 *
 *--------------------------------------*/
export async function getRecipeSteps(recipeId) {

  const params = new URLSearchParams();

  if (recipeId) {
    params.set('recipeId', recipeId);
  }

  const url = `${apiPath('recipe-steps')}${
    params.toString() ? `?${params}` : ''
  }`;

  const res = await fetch(url, {credentials: 'same-origin'});

  return jsonOrThrow(res);
}

/*--------------------------------------
 * insertRecipe()
 * Saves a recipe with its ingredients and steps. Resolves to { id }
 *--------------------------------------*/
export async function insertRecipe(recipe) {

  const res = await fetch(apiPath('recipes'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(recipe)
  });

  if (res.ok) return res.json();

  // Surface the server's error message instead of the raw status line
  let msg = res.statusText || 'Save failed';
  try { const data = await res.json(); if (data?.error) msg = data.error; } catch { /* no JSON body */ }
  throw new Error(msg);
}

/*--------------------------------------
 * updateRecipe()
 * Replaces a recipe's details, ingredients and steps. Resolves to { id }
 *--------------------------------------*/
export async function updateRecipe(id, recipe) {

  const res = await fetch(apiPath(`recipes/${encodeURIComponent(id)}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(recipe)
  });

  if (res.ok) return res.json();

  let msg = res.statusText || 'Save failed';
  try { const data = await res.json(); if (data?.error) msg = data.error; } catch { /* no JSON body */ }
  throw new Error(msg);
}

/*--------------------------------------
 * deleteRecipe()
 *
 *--------------------------------------*/
export async function deleteRecipe(id) {

  const res = await fetch(apiPath(`recipes/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    credentials: 'same-origin',
  });

  if (res.status === 204) return true;

  let msg = res.statusText || 'Delete failed';
  try { const data = await res.json(); if (data?.error) msg = data.error; } catch { /* no JSON body */ }
  throw new Error(msg);
}

/*--------------------------------------
 * searchRecipes()
 * Searches recipe names and keywords
 *--------------------------------------*/
export async function searchRecipes(q) {

  const params = new URLSearchParams({ q });

  const res = await fetch(`${apiPath('recipe-search')}?${params}`, { credentials: 'same-origin' });
  return jsonOrThrow(res);
}

/*--------------------------------------
 * getRecipeCounts()
 * Recipes filed directly under each category: [{ category_code, count }]
 *--------------------------------------*/
export async function getRecipeCounts() {

  const res = await fetch(apiPath('recipe-counts'), { credentials: 'same-origin' });
  return jsonOrThrow(res);
}

/*--------------------------------------
 * listCategories()
 *
 *--------------------------------------*/
export async function listCategories() {

  const res = await fetch(apiPath('categories'), { credentials: 'same-origin' });
  return jsonOrThrow(res);
}

/*--------------------------------------
 * getCategoriesByParent()
 *
 *--------------------------------------*/
export async function getCategoriesByParent(parentCode) {

  const params = new URLSearchParams();

  if (parentCode) {
    params.set('parentCode', parentCode);
  }

  const url = `${apiPath('categories-by-parent')}${
    params.toString() ? `?${params}` : ''
  }`;

  const res = await fetch(url, {credentials: 'same-origin'});

  return jsonOrThrow(res);
}

/*--------------------------------------
 * getRecipesByCategory()
 *
 *--------------------------------------*/
export async function getRecipesByCategory(categoryCode, { includeSubcategories = false } = {}) {

  const params = new URLSearchParams();

  if (categoryCode) {
    params.set('categoryCode', categoryCode);
  }

  if (includeSubcategories) {
    params.set('includeSubcategories', 'true');
  }

  const url = `${apiPath('recipes-by-category')}${
    params.toString() ? `?${params}` : ''
  }`;

  const res = await fetch(url, {credentials: 'same-origin'});

  return jsonOrThrow(res);
}

/*--------------------------------------
 * listUnits()
 *
 *--------------------------------------*/
export async function listUnits() {
  const res = await fetch(apiPath('units'), { credentials: 'same-origin' });
  return jsonOrThrow(res);
}

/*--------------------------------------
 * insertUnits()
 *
 *--------------------------------------*/
export async function insertUnits({ name, description }) {
  const res = await fetch(apiPath('units'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ name, description })
  });

  if (res.ok) return res.json();

  // Surface the server's error message (e.g. duplicate name) instead of the raw status line
  let msg = res.statusText || 'Save failed';
  try { const data = await res.json(); if (data?.error) msg = data.error; } catch { /* no JSON body */ }
  throw new Error(msg);
}

/*--------------------------------------
 * deleteUnit()
 *
 *--------------------------------------*/
export async function deleteUnit(id) {
  const c = String(id || '').trim();
  if (!c) throw new Error('id is required');

  const res = await fetch(apiPath(`units/${encodeURIComponent(c)}`), {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  if (res.status === 204) return true;

  let msg = res.statusText || 'Delete failed';
  try { const data = await res.json(); if (data?.error) msg = data.error; } catch { /* no JSON body */ }
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

