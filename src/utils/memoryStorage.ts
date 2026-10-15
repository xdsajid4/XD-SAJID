import type { SessionMemoryItem, MemoryCategory } from '../types';

const DB_NAME = 'MyraaCompanionDB';
const DB_VERSION = 1;
const STORE_NAME = 'persistent_memories';

// Sensitive data patterns that should NEVER be saved as conversational memories
const SENSITIVE_PATTERNS = [
  /password/i,
  /api[_-]?key/i,
  /secret/i,
  /token/i,
  /bearer\s+[a-zA-Z0-9_\-\.]+/i,
  /private[_-]?key/i,
  /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/, // Credit card pattern
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN
];

export function isContentSensitive(text: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text));
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('category', 'category', { unique: false });
        store.createIndex('key', 'key', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Initial helpful default memories
const DEFAULT_INITIAL_MEMORIES: Omit<SessionMemoryItem, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    category: 'preference',
    key: 'Communication Style',
    detail: 'Enjoys natural, warm, thoughtful pacing with occasional humor. Appreciates English, Bangla, and natural Banglish.',
    emotionalTone: 'warm',
    isConfirmedByUser: true,
  },
  {
    category: 'personal',
    key: 'Companion Bond',
    detail: 'Prefers an intelligent, supportive confidant who respects interruptions and holds conversational context.',
    emotionalTone: 'attuned',
    isConfirmedByUser: true,
  },
];

export async function loadAllMemories(): Promise<SessionMemoryItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = async () => {
        const results: SessionMemoryItem[] = req.result || [];
        if (results.length === 0) {
          // Preload initial helpful memories if empty
          const seeded: SessionMemoryItem[] = [];
          for (const item of DEFAULT_INITIAL_MEMORIES) {
            const saved = await saveMemory(item);
            seeded.push(saved);
          }
          resolve(seeded);
        } else {
          // Sort by updatedAt descending
          results.sort((a, b) => b.updatedAt - a.updatedAt);
          resolve(results);
        }
      };

      req.onerror = () => {
        resolve([]);
      };
    });
  } catch (err) {
    console.warn('Failed to load memories from IndexedDB:', err);
    return [];
  }
}

export async function saveMemory(
  item: Omit<SessionMemoryItem, 'id' | 'createdAt' | 'updatedAt'>
): Promise<SessionMemoryItem> {
  // Reject sensitive secrets
  if (isContentSensitive(item.key) || isContentSensitive(item.detail)) {
    throw new Error('Security policy: Passwords, tokens, and private secrets cannot be saved to memory.');
  }

  const db = await openDB();
  const all = await loadAllMemories();

  // Deduplication check: Match identical or normalized keys
  const normalizedKey = item.key.toLowerCase().trim();
  const existing = all.find(
    (m) =>
      m.key.toLowerCase().trim() === normalizedKey ||
      m.detail.toLowerCase().trim() === item.detail.toLowerCase().trim()
  );

  const now = Date.now();
  const memoryToSave: SessionMemoryItem = existing
    ? {
        ...existing,
        category: item.category || existing.category,
        key: item.key,
        detail: item.detail,
        emotionalTone: item.emotionalTone || existing.emotionalTone,
        updatedAt: now,
      }
    : {
        id: `mem-${now}-${Math.random().toString(36).substring(2, 8)}`,
        category: item.category,
        key: item.key,
        detail: item.detail,
        emotionalTone: item.emotionalTone,
        isConfirmedByUser: item.isConfirmedByUser ?? false,
        createdAt: now,
        updatedAt: now,
      };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(memoryToSave);

    req.onsuccess = () => resolve(memoryToSave);
    req.onerror = () => reject(req.error);
  });
}

export async function updateMemory(
  id: string,
  updates: Partial<SessionMemoryItem>
): Promise<SessionMemoryItem> {
  if (updates.detail && isContentSensitive(updates.detail)) {
    throw new Error('Security policy: Passwords and tokens cannot be saved.');
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const existing = getReq.result as SessionMemoryItem;
      if (!existing) {
        reject(new Error(`Memory with ID ${id} not found.`));
        return;
      }

      const updated: SessionMemoryItem = {
        ...existing,
        ...updates,
        updatedAt: Date.now(),
      };

      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve(updated);
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

export async function deleteMemory(id: string): Promise<boolean> {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);

    req.onsuccess = () => resolve(true);
    req.onerror = () => resolve(false);
  });
}

export async function clearAllMemories(): Promise<boolean> {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();

    req.onsuccess = () => resolve(true);
    req.onerror = () => resolve(false);
  });
}

export async function exportMemoriesJSON(): Promise<string> {
  const memories = await loadAllMemories();
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      companion: 'Myraa',
      totalMemories: memories.length,
      memories,
    },
    null,
    2
  );
}

export async function importMemoriesJSON(jsonString: string): Promise<number> {
  try {
    const parsed = JSON.parse(jsonString);
    const items: SessionMemoryItem[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.memories)
      ? parsed.memories
      : [];

    let count = 0;
    for (const item of items) {
      if (item && item.key && item.detail) {
        await saveMemory({
          category: item.category || 'context',
          key: item.key,
          detail: item.detail,
          emotionalTone: item.emotionalTone,
          isConfirmedByUser: true,
        });
        count++;
      }
    }
    return count;
  } catch (e: any) {
    throw new Error(`Failed to parse memory JSON: ${e.message}`);
  }
}
