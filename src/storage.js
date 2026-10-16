const DB = 'architecture-studio';
const VERSION = 1;

export function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('projects', { keyPath: 'id' });
      db.createObjectStore('snapshots', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
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
