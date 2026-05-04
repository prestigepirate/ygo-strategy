import { create } from 'zustand';

let nextId = 1;

const STORAGE_KEY = 'duel-realms-editor-objects';

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) {
        const maxId = Math.max(...arr.map(o => {
          const n = parseInt(String(o.id).replace(/\D/g, ''), 10);
          return Number.isNaN(n) ? 0 : n;
        }));
        nextId = maxId + 1;
        return arr;
      }
    }
  } catch { /* ignore */ }
  return [];
}

function persist(arr) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch { /* ignore */ }
}

export const TOOLS = {
  PLACE_TOWER: 'place-tower',
  PLACE_ASSET: 'place-asset',
  PLACE_HEX: 'place-hex',
  PLACE_KING_BASE: 'place-king-base',
  MOVE: 'move',
  SCALE: 'scale',
  DELETE: 'delete',
};

export const TERRAIN_TYPES = ['plains', 'forest', 'mountain', 'swamp', 'water', 'volcanic'];

export const useEditorStore = create((set, get) => ({
  editMode: false,
  activeTool: TOOLS.PLACE_TOWER,
  selectedAsset: null,
  selectedObjectId: null,
  placedObjects: loadSaved(),
  hexTerrain: 'plains',
  hexHeight: 0.5,
  kingBaseOwner: 'gold',

  toggleEditMode: () =>
    set(s => {
      if (s.editMode) {
        return { editMode: false, selectedObjectId: null };
      }
      return { editMode: true };
    }),

  setActiveTool: (tool) => set({ activeTool: tool }),

  setHexConfig: (terrain, height) => set({ hexTerrain: terrain, hexHeight: height }),

  setKingBaseOwner: (owner) => set({ kingBaseOwner: owner }),

  selectAsset: (asset) => set({ selectedAsset: asset, activeTool: TOOLS.PLACE_ASSET }),

  selectObject: (id) => {
    const { selectedObjectId } = get();
    set({ selectedObjectId: selectedObjectId === id ? null : id });
  },

  addObject: (obj) => {
    const id = `eobj-${nextId++}`;
    const newObj = { ...obj, id };
    set(s => {
      const updated = [...s.placedObjects, newObj];
      persist(updated);
      return { placedObjects: updated };
    });
    return id;
  },

  updateObject: (id, updates) =>
    set(s => {
      const updated = s.placedObjects.map(o => (o.id === id ? { ...o, ...updates } : o));
      persist(updated);
      return { placedObjects: updated };
    }),

  removeObject: (id) =>
    set(s => {
      const updated = s.placedObjects.filter(o => o.id !== id);
      persist(updated);
      return {
        placedObjects: updated,
        selectedObjectId: s.selectedObjectId === id ? null : s.selectedObjectId,
      };
    }),

  clearAllObjects: () => {
    set({ placedObjects: [], selectedObjectId: null });
    persist([]);
  },
}));
