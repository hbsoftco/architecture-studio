const DB = 'architecture-studio';
const VERSION = 2;

export function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('snapshots')) db.createObjectStore('snapshots', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('templates')) db.createObjectStore('templates', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function allTemplates(db) {
  return new Promise((resolve, reject) => {
    const request = db.transaction('templates').objectStore('templates').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function saveTemplate(db, template) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('templates', 'readwrite');
    transaction.objectStore('templates').put(template);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export function saveTemplates(db, templates) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('templates', 'readwrite');
    const store = transaction.objectStore('templates');
    for (const template of templates) store.put(template);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export function removeTemplate(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('templates', 'readwrite');
    transaction.objectStore('templates').delete(id);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function allProjects(db) {
  return new Promise((resolve, reject) => {
    const req = db.transaction('projects').objectStore('projects').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveProject(db, project, snapshot = false) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(snapshot ? ['projects', 'snapshots'] : ['projects'], 'readwrite');
    transaction.objectStore('projects').put(project);
    if (snapshot) transaction.objectStore('snapshots').put({ id: crypto.randomUUID(), projectId: project.id, createdAt: new Date().toISOString(), value: structuredClone(project) });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function deleteProject(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['projects', 'snapshots'], 'readwrite');
    transaction.objectStore('projects').delete(id);
    const snapshots = transaction.objectStore('snapshots');
    const cursor = snapshots.openCursor();
    cursor.onsuccess = () => { if (cursor.result) { if (cursor.result.value.projectId === id) cursor.result.delete(); cursor.result.continue(); } };
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function history(db, projectId) {
  return new Promise((resolve, reject) => {
    const req = db.transaction('snapshots').objectStore('snapshots').getAll();
    req.onsuccess = () => resolve(req.result.filter(item => item.projectId === projectId).sort((a,b) => b.createdAt.localeCompare(a.createdAt)));
    req.onerror = () => reject(req.error);
  });
}
