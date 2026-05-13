/* ==========================================================================
   ConstructionIMS v2 — db.js
   Lightweight IndexedDB wrapper. All data lives 100% in the browser.
   ========================================================================== */

const DB_NAME = "ConstructionIMS_v2";
const DB_VERSION = 1;

const STORES = [
  // [storeName, keyPath, indexes...]
  ["company",        "id"],                                      // single record { id:1, ... }
  ["projects",       "id", ["name"]],
  ["sites",          "id", ["projectId"]],
  ["locations",      "id", ["siteId"]],
  ["equipment",      "id", ["siteId"]],
  ["items",          "id", ["sku","category"]],
  ["stockMovements", "id", ["itemId","siteId","date","type"]],   // type: IN|OUT
  ["toolIssues",     "id", ["itemId","status","issuedTo"]],      // status: ISSUED|RETURNED
  ["purchaseOrders", "id", ["status","supplier","date"]],
  ["settings",       "key"]
];

const db = {
  _db: null,

  async open(){
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const idb = e.target.result;
        STORES.forEach(([name, key, ...indexes]) => {
          if (!idb.objectStoreNames.contains(name)){
            const store = idb.createObjectStore(name, { keyPath: key, autoIncrement: key === "id" });
            (indexes[0] || []).forEach(idx => {
              if (Array.isArray(idx)) store.createIndex(idx[0], idx[0], idx[1] || {});
              else store.createIndex(idx, idx);
            });
          }
        });
      };
      req.onsuccess = e => { this._db = e.target.result; resolve(this._db); };
      req.onerror   = e => reject(e.target.error);
    });
  },

  _tx(store, mode = "readonly"){
    return this._db.transaction(store, mode).objectStore(store);
  },

  // ---------- generic CRUD ----------
  add(store, obj){
    return new Promise((res, rej) => {
      if (!obj.createdAt) obj.createdAt = Date.now();
      obj.updatedAt = Date.now();
      const req = this._tx(store, "readwrite").add(obj);
      req.onsuccess = e => res(e.target.result);
      req.onerror   = e => rej(e.target.error);
    });
  },
  put(store, obj){
    return new Promise((res, rej) => {
      obj.updatedAt = Date.now();
      const req = this._tx(store, "readwrite").put(obj);
      req.onsuccess = e => res(e.target.result);
      req.onerror   = e => rej(e.target.error);
    });
  },
  get(store, id){
    return new Promise((res, rej) => {
      const req = this._tx(store).get(id);
      req.onsuccess = e => res(e.target.result);
      req.onerror   = e => rej(e.target.error);
    });
  },
  delete(store, id){
    return new Promise((res, rej) => {
      const req = this._tx(store, "readwrite").delete(id);
      req.onsuccess = () => res(true);
      req.onerror   = e => rej(e.target.error);
    });
  },
  all(store){
    return new Promise((res, rej) => {
      const req = this._tx(store).getAll();
      req.onsuccess = e => res(e.target.result || []);
      req.onerror   = e => rej(e.target.error);
    });
  },
  clear(store){
    return new Promise((res, rej) => {
      const req = this._tx(store, "readwrite").clear();
      req.onsuccess = () => res(true);
      req.onerror   = e => rej(e.target.error);
    });
  },

  // ---------- settings ----------
  async getSetting(key, fallback = null){
    const row = await this.get("settings", key);
    return row ? row.value : fallback;
  },
  async setSetting(key, value){
    return this.put("settings", { key, value });
  },

  // ---------- backup / restore ----------
  async exportAll(){
    const dump = {};
    for (const [name] of STORES){
      dump[name] = await this.all(name);
    }
    return {
      app: DB_NAME, version: DB_VERSION,
      exportedAt: new Date().toISOString(),
      data: dump
    };
  },
  async importAll(payload, { merge = false } = {}){
    if (!payload || !payload.data) throw new Error("Invalid backup file");
    for (const [name] of STORES){
      if (!merge) await this.clear(name);
      const rows = payload.data[name] || [];
      for (const row of rows){
        // when merging we use put to overwrite by key
        await this.put(name, row);
      }
    }
    return true;
  },

  // ---------- seed defaults ----------
  async seedIfEmpty(){
    const company = await this.get("company", 1);
    if (!company){
      await this.put("company", {
        id: 1,
        name: "Your Construction Co.",
        address: "—",
        phone: "",
        email: "",
        gst: "",
        currency: "USD"
      });
    }
    // ensure at least one project + site exist so other pages don't feel empty
    const projects = await this.all("projects");
    if (projects.length === 0){
      const pid = await this.add("projects", {
        name: "Main Project",
        client: "—",
        startDate: new Date().toISOString().slice(0,10),
        status: "Active",
        notes: ""
      });
      const sid = await this.add("sites", {
        projectId: pid,
        name: "Central Store",
        code: "SITE-01",
        address: "—",
        manager: ""
      });
      await this.add("locations", { siteId: sid, name: "Rack A", code: "A", description: "Bulk goods" });
      await this.add("locations", { siteId: sid, name: "Rack B", code: "B", description: "Tools & small parts" });
    }
  }
};

window.db = db;
