// src/api.js  (works in prod '/myrecipes/api/' and dev '/api/' with Vite proxy)

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
 * getRecipeImages()
 * [{ id, url, alt, sort_order }] in display order
 *--------------------------------------*/
export async function getRecipeImages(recipeId) {

  const params = new URLSearchParams({ recipeId });

  const res = await fetch(`${apiPath('recipe-images')}?${params}`, { credentials: 'same-origin' });
  return jsonOrThrow(res);
}

/*--------------------------------------
 * saveRecipeImages()
 * Replaces a recipe's image list. images: [{ id, alt }] for saved images, [{ file, alt }] for new ones,
 * in display order. Saved images left out are deleted. Resolves to the new list
 *--------------------------------------*/
export async function saveRecipeImages(recipeId, images) {

  const body = new FormData();
  const manifest = [];

  for (const image of images) {
    if (image.file) {
      manifest.push({ upload: body.getAll('images').length, alt: image.alt });
      body.append('images', image.file);
    } else {
      manifest.push({ id: image.id, alt: image.alt });
    }
  }

  body.append('manifest', JSON.stringify(manifest));

  //No Content-Type header: the browser sets the multipart boundary itself
  const res = await fetch(apiPath(`recipes/${encodeURIComponent(recipeId)}/images`), {
    method: 'PUT',
    credentials: 'same-origin',
    body
  });

  if (res.ok) return res.json();

  let msg = res.status === 413 ? 'The photos are too large to upload together.' : (res.statusText || 'Upload failed');
  try { const data = await res.json(); if (data?.error) msg = data.error; } catch { /* no JSON body */ }
  throw new Error(msg);
}

/*--------------------------------------
 * imageSrc()
 * Turns a recipe_images.url ('images/<file>') into a URL the browser can load
 *--------------------------------------*/
export const imageSrc = (url) => apiPath(url);

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
 * Searches recipe names, keywords and ingredients
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
 * sendLookup()
 * Shared POST/PUT/DELETE for units and categories. Throws the server's
 * error message (e.g. 'A unit named "tsp" already exists.') instead of the raw status line
 *--------------------------------------*/
async function sendLookup(method, path, body) {

  const res = await fetch(apiPath(path), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'same-origin',
    body: body ? JSON.stringify(body) : undefined
  });

  if (res.status === 204) return true;
  if (res.ok) return res.json();

  let msg = res.statusText || 'Request failed';
  try { const data = await res.json(); if (data?.error) msg = data.error; } catch { /* no JSON body */ }
  throw new Error(msg);
}

const idPath = (base, id) => {
  const c = String(id ?? '').trim();
  if (!c) throw new Error('id is required');
  return `${base}/${encodeURIComponent(c)}`;
};

/*--------------------------------------
 * listUnits()
 * [{ id, name, description, recipe_count }]
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
  return sendLookup('POST', 'units', { name, description });
}

/*--------------------------------------
 * updateUnit()
 *
 *--------------------------------------*/
export async function updateUnit(id, { name, description }) {
  return sendLookup('PUT', idPath('units', id), { name, description });
}

/*--------------------------------------
 * deleteUnit()
 *
 *--------------------------------------*/
export async function deleteUnit(id) {
  return sendLookup('DELETE', idPath('units', id));
}

/*--------------------------------------
 * insertCategory()
 * { title, description, parent_code } -> the new category (code is generated by the server)
 *--------------------------------------*/
export async function insertCategory({ title, description, parent_code }) {
   return sendLookup('POST', 'categories', { title, description, parent_code });
}

/*--------------------------------------
 * updateCategory()
 *
 *--------------------------------------*/
export async function updateCategory(code, { title, description, parent_code }) {
   return sendLookup('PUT', idPath('categories', code), { title, description, parent_code });
}

/*--------------------------------------
 * deleteCategory()
 *
 *--------------------------------------*/
export async function deleteCategory(code) {
   return sendLookup('DELETE', idPath('categories', code));
}

/*--------------------------------------
 * apiHealth()
 *
 *--------------------------------------*/
export async function apiHealth() {
  const res = await fetch(apiPath('health'), { credentials: 'same-origin' });
  return jsonOrThrow(res);
}

