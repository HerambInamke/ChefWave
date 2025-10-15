// IndexedDB layer for ChefWave

const DB_NAME = 'chefwave';
const DB_VERSION = 1;
const STORE_RECIPES = 'recipes';
const STORE_SETTINGS = 'settings';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_RECIPES)) {
        const recipes = db.createObjectStore(STORE_RECIPES, { keyPath: 'id', autoIncrement: true });
        recipes.createIndex('title', 'title', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(storeName, mode, fn) {
  const db = await openDb();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = fn(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function addRecipe(recipe) {
  return await withStore(STORE_RECIPES, 'readwrite', (store) => store.add(recipe));
}

export async function updateRecipe(recipe) {
  return await withStore(STORE_RECIPES, 'readwrite', (store) => store.put(recipe));
}

export async function deleteRecipe(id) {
  return await withStore(STORE_RECIPES, 'readwrite', (store) => store.delete(Number(id)));
}

export async function getRecipe(id) {
  return await withStore(STORE_RECIPES, 'readonly', (store) => store.get(Number(id)));
}

export async function listRecipes() {
  return await withStore(STORE_RECIPES, 'readonly', (store) => store.getAll());
}

export async function setSetting(key, value) {
  return await withStore(STORE_SETTINGS, 'readwrite', (store) => store.put(value, key));
}

export async function getSetting(key) {
  return await withStore(STORE_SETTINGS, 'readonly', (store) => store.get(key));
}

export async function exportAll() {
  const recipes = await listRecipes();
  const settings = await withStore(STORE_SETTINGS, 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const data = {};
      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          data[cursor.key] = cursor.value;
          cursor.continue();
        } else {
          resolve(data);
        }
      };
      req.onerror = () => reject(req.error);
    });
  });
  return { recipes, settings, meta: { exportedAt: new Date().toISOString(), version: DB_VERSION } };
}

export async function importAll(data) {
  if (!data || typeof data !== 'object') return;
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_RECIPES, STORE_SETTINGS], 'readwrite');
    const recipes = tx.objectStore(STORE_RECIPES);
    const settings = tx.objectStore(STORE_SETTINGS);
    recipes.clear();
    settings.clear();
    (data.recipes || []).forEach((r) => recipes.add(r));
    Object.entries(data.settings || {}).forEach(([k, v]) => settings.put(v, k));
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}


