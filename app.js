/* ==========================================================================
   ConstructionIMS v2 — app.js
   Entire application logic: auth, routing, CRUD pages, reports, settings.
   ========================================================================== */

const app = {
  state: {
    user: null,
    currentPage: "dashboard"
  },

  /* =========================================================
     INIT
  ========================================================= */
  async init(){
    try {
      await db.open();
      await db.seedIfEmpty();
    } catch (e){
      console.error(e);
      alert("Failed to open IndexedDB. Use a modern browser (Chrome, Edge, Firefox).");
      return;
    }
    this.bindLogin();
    this.bindGlobal();

    // auto-login if a session is stored
    const session = sessionStorage.getItem("cims_user");
    if (session){
      this.state.user = JSON.parse(session);
      this.showApp();
    }
  },

  /* =========================================================
     AUTH (hard-coded admin/admin123; password also stored
     in settings store so it can be changed)
  ========================================================= */
  bindLogin(){
    const form = document.getElementById("login-form");
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(form);
      const u = fd.get("username").trim();
      const p = fd.get("password");

      const stored = await db.getSetting("auth", { username: "admin", password: "admin123" });
      if (u === stored.username && p === stored.password){
        this.state.user = { username: u, role: "Admin", name: "Administrator" };
        sessionStorage.setItem("cims_user", JSON.stringify(this.state.user));
        document.getElementById("login-error").textContent = "";
        this.showApp();
      } else {
        document.getElementById("login-error").textContent = "Invalid credentials.";
      }
    });
  },

  showApp(){
    document.getElementById("login-overlay").style.display = "none";
    document.getElementById("app").style.display = "flex";
    document.getElementById("user-name").textContent = this.state.user.name;
    document.getElementById("user-role").textContent = this.state.user.role;
    document.querySelector(".user-avatar").textContent = this.state.user.name[0].toUpperCase();
    this.go("dashboard");
  },

  logout(){
    sessionStorage.removeItem("cims_user");
    this.state.user = null;
    document.getElementById("app").style.display = "none";
    document.getElementById("login-overlay").style.display = "flex";
  },

  /* =========================================================
     GLOBAL BINDS
  ========================================================= */
  bindGlobal(){
    document.getElementById("btn-logout").addEventListener("click", () => this.logout());
    document.getElementById("hamburger").addEventListener("click", () => {
      document.getElementById("sidebar").classList.toggle("open");
    });
    document.querySelectorAll(".sidebar-nav a").forEach(a => {
      a.addEventListener("click", () => {
        this.go(a.dataset.page);
        document.getElementById("sidebar").classList.remove("open");
      });
    });
    // close modal on backdrop click
    document.getElementById("modal-overlay").addEventListener("click", e => {
      if (e.target.id === "modal-overlay") this.closeModal();
    });
    // ESC closes modal
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") this.closeModal();
    });
  },

  /* =========================================================
     ROUTER
  ========================================================= */
  go(page){
    this.state.currentPage = page;
    document.querySelectorAll(".sidebar-nav a").forEach(a => {
      a.classList.toggle("active", a.dataset.page === page);
    });
    const titles = {
      dashboard:        "Dashboard",
      "company-project": "Company & Projects",
      sites:            "Sites & Locations",
      equipment:        "Equipment Register",
      items:            "Item Master",
      "stock-in":       "Stock IN",
      "stock-out":      "Stock OUT",
      "tool-tracker":   "Tool Tracker",
      "po-generator":   "Purchase Order Generator",
      "purchase-orders":"Purchase Orders",
      reports:          "Reports",
      settings:         "Settings"
    };
    document.getElementById("page-title").textContent = titles[page] || "Dashboard";
    const main = document.getElementById("main-content");
    main.innerHTML = `<div class="loading"><div class="loader"></div> Loading…</div>`;
    const renderers = {
      dashboard:         () => this.renderDashboard(),
      "company-project": () => this.renderCompanyProject(),
      sites:             () => this.renderSites(),
      equipment:         () => this.renderEquipment(),
      items:             () => this.renderItems(),
      "stock-in":        () => this.renderStockIn(),
      "stock-out":       () => this.renderStockOut(),
      "tool-tracker":    () => this.renderToolTracker(),
      "po-generator":    () => this.renderPOGenerator(),
      "purchase-orders": () => this.renderPurchaseOrders(),
      reports:           () => this.renderReports(),
      settings:          () => this.renderSettings()
    };
    (renderers[page] || renderers.dashboard)();
  },

  /* =========================================================
     UI HELPERS
  ========================================================= */
  toast(msg, kind = "success"){
    const c = document.getElementById("toast-container");
    const t = document.createElement("div");
    t.className = "toast " + kind;
    const icon = kind === "error" ? "✕" : kind === "warn" ? "⚠" : kind === "info" ? "ℹ" : "✓";
    t.innerHTML = `<span>${icon}</span> ${msg}`;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .2s"; }, 2400);
    setTimeout(() => t.remove(), 2700);
  },

  openModal(title, bodyHtml, { wide = false } = {}){
    document.getElementById("modal-title").textContent = title;
    document.getElementById("modal-body").innerHTML = bodyHtml;
    document.getElementById("modal-box").classList.toggle("wide", wide);
    document.getElementById("modal-overlay").classList.add("active");
  },
  closeModal(){
    document.getElementById("modal-overlay").classList.remove("active");
  },

  confirm(message, onYes, title = "Confirm"){
    this.openModal(title, `
      <p style="margin-bottom:18px; color:var(--ink-2);">${message}</p>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
        <button class="btn btn-danger" id="confirm-yes">Yes, proceed</button>
      </div>
    `);
    document.getElementById("confirm-yes").addEventListener("click", () => {
      this.closeModal();
      onYes();
    });
  },

  fmtDate(ts){
    if (!ts) return "—";
    const d = (typeof ts === "number") ? new Date(ts) : new Date(ts);
    return d.toLocaleDateString();
  },
  fmtMoney(n, currency){
    const cur = currency || "USD";
    const symbols = { USD:"$", EUR:"€", GBP:"£", INR:"₹", NPR:"₨", AED:"د.إ", SAR:"﷼" };
    const s = symbols[cur] || (cur + " ");
    return s + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  // current stock for an item = sum IN - sum OUT
  async stockOf(itemId, allMovements){
    const movs = allMovements || await db.all("stockMovements");
    return movs
      .filter(m => m.itemId === itemId)
      .reduce((acc, m) => acc + (m.type === "IN" ? m.qty : -m.qty), 0);
  },

  /* =========================================================
     DASHBOARD
  ========================================================= */
  async renderDashboard(){
    const [items, movs, pos, tools, sites, projects, company] = await Promise.all([
      db.all("items"), db.all("stockMovements"),
      db.all("purchaseOrders"), db.all("toolIssues"),
      db.all("sites"), db.all("projects"),
      db.get("company", 1)
    ]);
    const cur = company?.currency || "USD";

    // metrics
    const stockMap = new Map();
    movs.forEach(m => {
      stockMap.set(m.itemId, (stockMap.get(m.itemId) || 0) + (m.type === "IN" ? m.qty : -m.qty));
    });
    let totalValue = 0;
    let lowStockCount = 0;
    items.forEach(it => {
      const s = stockMap.get(it.id) || 0;
      totalValue += s * (it.costPrice || 0);
      if (s <= (it.reorderLevel || 0)) lowStockCount++;
    });
    const pendingPOs = pos.filter(p => p.status === "DRAFT" || p.status === "SENT").length;
    const toolsOut = tools.filter(t => t.status === "ISSUED").length;

    // recent movements
    const recent = [...movs].sort((a,b)=> (b.date||0)-(a.date||0)).slice(0,7);
    const itemMap = Object.fromEntries(items.map(i => [i.id, i]));
    const siteMap = Object.fromEntries(sites.map(s => [s.id, s]));

    document.getElementById("main-content").innerHTML = `
      <div class="page-header">
        <div>
          <h2>Welcome back, ${this.state.user.name}</h2>
          <p>${company?.name || ""} · ${projects.length} project${projects.length!==1?'s':''} · ${sites.length} site${sites.length!==1?'s':''}</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" onclick="app.go('stock-in')">📥 New Stock IN</button>
          <button class="btn btn-primary" onclick="app.go('stock-out')">📤 New Stock OUT</button>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">🗂️</div>
          <div class="stat-label">Total Items</div>
          <div class="stat-value">${items.length}</div>
          <div class="stat-meta">Master catalog</div>
        </div>
        <div class="stat-card stat-blue">
          <div class="stat-icon">💰</div>
          <div class="stat-label">Stock Value</div>
          <div class="stat-value">${this.fmtMoney(totalValue, cur)}</div>
          <div class="stat-meta">Across all sites</div>
        </div>
        <div class="stat-card stat-red">
          <div class="stat-icon">⚠️</div>
          <div class="stat-label">Low Stock</div>
          <div class="stat-value">${lowStockCount}</div>
          <div class="stat-meta">At/below reorder level</div>
        </div>
        <div class="stat-card stat-purple">
          <div class="stat-icon">📋</div>
          <div class="stat-label">Pending POs</div>
          <div class="stat-value">${pendingPOs}</div>
          <div class="stat-meta">Draft or sent</div>
        </div>
        <div class="stat-card stat-green">
          <div class="stat-icon">🔨</div>
          <div class="stat-label">Tools Issued</div>
          <div class="stat-value">${toolsOut}</div>
          <div class="stat-meta">Currently out</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🔁</div>
          <div class="stat-label">Movements</div>
          <div class="stat-value">${movs.length}</div>
          <div class="stat-meta">Total IN + OUT</div>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="card">
          <div class="card-title">📈 Recent Movements</div>
          ${recent.length === 0 ? `<div style="color:var(--ink-3);font-size:13px;">No movements yet.</div>` :
            `<table class="data-table">
              <thead><tr><th>Date</th><th>Type</th><th>Item</th><th>Qty</th><th>Site</th></tr></thead>
              <tbody>${recent.map(m => `
                <tr>
                  <td>${this.fmtDate(m.date)}</td>
                  <td><span class="badge badge-${m.type==='IN'?'green':'red'}">${m.type}</span></td>
                  <td>${itemMap[m.itemId]?.name || "—"}</td>
                  <td>${m.qty} ${itemMap[m.itemId]?.unit || ""}</td>
                  <td>${siteMap[m.siteId]?.name || "—"}</td>
                </tr>`).join("")}
              </tbody>
            </table>`}
        </div>

        <div class="card">
          <div class="card-title">⚠️ Items Needing Reorder</div>
          ${(() => {
            const low = items
              .map(it => ({ it, stock: stockMap.get(it.id) || 0 }))
              .filter(x => x.stock <= (x.it.reorderLevel || 0))
              .slice(0, 8);
            if (low.length === 0) return `<div style="color:var(--ink-3);font-size:13px;">All items are well-stocked. 👍</div>`;
            return `<table class="data-table">
              <thead><tr><th>Item</th><th>SKU</th><th>Stock</th><th>Reorder</th></tr></thead>
              <tbody>${low.map(({it,stock}) => `
                <tr>
                  <td>${it.name}</td>
                  <td><code style="font-size:11px;color:var(--ink-3);">${it.sku||"—"}</code></td>
                  <td><strong style="color:${stock<=0?'var(--red)':'var(--amber-2)'};">${stock}</strong> ${it.unit||""}</td>
                  <td>${it.reorderLevel||0}</td>
                </tr>`).join("")}
              </tbody>
            </table>
            <div style="margin-top:12px;text-align:right;">
              <button class="btn btn-sm btn-secondary" onclick="app.go('po-generator')">Generate POs →</button>
            </div>`;
          })()}
        </div>
      </div>
    `;
  },

  /* =========================================================
     COMPANY & PROJECTS
  ========================================================= */
  async renderCompanyProject(){
    const company = await db.get("company", 1);
    const projects = await db.all("projects");

    document.getElementById("main-content").innerHTML = `
      <div class="tabs">
        <button class="tab-btn active" data-tab="company">Company Info</button>
        <button class="tab-btn" data-tab="projects">Projects (${projects.length})</button>
      </div>
      <div id="tab-content"></div>
    `;
    const setTab = name => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
      if (name === "company") this._renderCompanyTab();
      else this._renderProjectsTab();
    };
    document.querySelectorAll(".tab-btn").forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));
    setTab("company");
  },

  async _renderCompanyTab(){
    const c = await db.get("company", 1) || { id: 1 };
    document.getElementById("tab-content").innerHTML = `
      <div class="card" style="max-width:720px;">
        <div class="card-title">🏢 Company Information</div>
        <form id="company-form">
          <div class="form-row">
            <div class="form-group"><label>Company Name</label><input name="name" value="${c.name||''}" required></div>
            <div class="form-group"><label>Currency</label>
              <select name="currency">
                ${["USD","EUR","GBP","INR","NPR","AED","SAR"].map(x =>
                  `<option ${c.currency===x?'selected':''}>${x}</option>`).join("")}
              </select>
            </div>
          </div>
          <div class="form-group"><label>Address</label><textarea name="address">${c.address||''}</textarea></div>
          <div class="form-row">
            <div class="form-group"><label>Phone</label><input name="phone" value="${c.phone||''}"></div>
            <div class="form-group"><label>Email</label><input type="email" name="email" value="${c.email||''}"></div>
          </div>
          <div class="form-group"><label>Tax / GST Number</label><input name="gst" value="${c.gst||''}"></div>
          <div class="modal-actions"><button type="submit" class="btn btn-primary">💾 Save Changes</button></div>
        </form>
      </div>
    `;
    document.getElementById("company-form").addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const obj = { id: 1 };
      fd.forEach((v,k) => obj[k] = v);
      await db.put("company", obj);
      this.toast("Company info saved.");
    });
  },

  async _renderProjectsTab(){
    const projects = await db.all("projects");
    document.getElementById("tab-content").innerHTML = `
      <div class="page-header" style="margin-bottom:14px;">
        <p style="color:var(--ink-3);">Manage your active and historical construction projects.</p>
        <button class="btn btn-primary" onclick="app.editProject()">+ New Project</button>
      </div>
      <div class="table-wrap">
        ${projects.length === 0 ? `
          <div class="empty-state"><span class="emoji">🏢</span>
            <h3>No projects yet</h3>
            <p>Create your first project to start tracking inventory.</p>
          </div>` : `
          <table class="data-table">
            <thead><tr><th>Name</th><th>Client</th><th>Start Date</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>${projects.map(p => `
              <tr>
                <td><strong>${p.name}</strong></td>
                <td>${p.client||"—"}</td>
                <td>${p.startDate||"—"}</td>
                <td><span class="badge badge-${p.status==='Active'?'green':p.status==='Completed'?'blue':'gray'}">${p.status||"—"}</span></td>
                <td class="actions">
                  <button class="btn-icon" onclick="app.editProject(${p.id})">✏️</button>
                  <button class="btn-icon danger" onclick="app.deleteProject(${p.id})">🗑️</button>
                </td>
              </tr>`).join("")}
            </tbody>
          </table>`}
      </div>
    `;
  },

  async editProject(id){
    const p = id ? await db.get("projects", id) : { name:"", client:"", startDate:new Date().toISOString().slice(0,10), status:"Active", notes:"" };
    this.openModal(id ? "Edit Project" : "New Project", `
      <form id="project-form">
        <div class="form-group"><label>Project Name *</label><input name="name" value="${p.name||''}" required></div>
        <div class="form-row">
          <div class="form-group"><label>Client</label><input name="client" value="${p.client||''}"></div>
          <div class="form-group"><label>Start Date</label><input type="date" name="startDate" value="${p.startDate||''}"></div>
        </div>
        <div class="form-group"><label>Status</label>
          <select name="status">
            ${["Active","Planning","On Hold","Completed"].map(s => `<option ${p.status===s?'selected':''}>${s}</option>`).join("")}
          </select>
        </div>
        <div class="form-group"><label>Notes</label><textarea name="notes">${p.notes||''}</textarea></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${id?"Save Changes":"Create Project"}</button>
        </div>
      </form>
    `);
    document.getElementById("project-form").addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(e.target); const obj = id ? { ...p } : {};
      fd.forEach((v,k) => obj[k] = v);
      if (id){ obj.id = id; await db.put("projects", obj); } else { await db.add("projects", obj); }
      this.closeModal(); this.toast(id?"Project updated":"Project created"); this._renderProjectsTab();
    });
  },

  async deleteProject(id){
    this.confirm("Delete this project? Linked sites/locations stay but will lose their parent reference.", async () => {
      await db.delete("projects", id);
      this.toast("Project deleted", "warn");
      this._renderProjectsTab();
    });
  },

  /* =========================================================
     SITES & LOCATIONS
  ========================================================= */
  async renderSites(){
    const projects = await db.all("projects");
    const sites = await db.all("sites");
    const locations = await db.all("locations");

    const projMap = Object.fromEntries(projects.map(p => [p.id, p]));

    document.getElementById("main-content").innerHTML = `
      <div class="page-header">
        <p style="color:var(--ink-3);">Sites are physical storage locations on each project. Each site has racks/bins.</p>
        <div class="page-actions">
          <button class="btn btn-secondary" onclick="app.editLocation()">+ New Location</button>
          <button class="btn btn-primary" onclick="app.editSite()">+ New Site</button>
        </div>
      </div>

      <div class="card" style="margin-bottom:18px;">
        <div class="card-title">📍 Sites (${sites.length})</div>
        ${sites.length === 0 ? `<div style="color:var(--ink-3);font-size:13px;">No sites yet — add your first one above.</div>` :
        `<table class="data-table">
          <thead><tr><th>Code</th><th>Name</th><th>Project</th><th>Manager</th><th>Address</th><th>Actions</th></tr></thead>
          <tbody>${sites.map(s => `
            <tr>
              <td><code>${s.code||"—"}</code></td>
              <td><strong>${s.name}</strong></td>
              <td>${projMap[s.projectId]?.name||"—"}</td>
              <td>${s.manager||"—"}</td>
              <td>${s.address||"—"}</td>
              <td class="actions">
                <button class="btn-icon" onclick="app.editSite(${s.id})">✏️</button>
                <button class="btn-icon danger" onclick="app.deleteSite(${s.id})">🗑️</button>
              </td>
            </tr>`).join("")}
          </tbody>
        </table>`}
      </div>

      <div class="card">
        <div class="card-title">🗄️ Locations / Racks (${locations.length})</div>
        ${locations.length === 0 ? `<div style="color:var(--ink-3);font-size:13px;">No storage locations yet.</div>` :
        `<table class="data-table">
          <thead><tr><th>Code</th><th>Name</th><th>Site</th><th>Description</th><th>Actions</th></tr></thead>
          <tbody>${locations.map(l => {
            const s = sites.find(x => x.id === l.siteId);
            return `
            <tr>
              <td><code>${l.code||"—"}</code></td>
              <td><strong>${l.name}</strong></td>
              <td>${s?.name||"—"}</td>
              <td>${l.description||"—"}</td>
              <td class="actions">
                <button class="btn-icon" onclick="app.editLocation(${l.id})">✏️</button>
                <button class="btn-icon danger" onclick="app.deleteLocation(${l.id})">🗑️</button>
              </td>
            </tr>`;
          }).join("")}
          </tbody>
        </table>`}
      </div>
    `;
  },

  async editSite(id){
    const projects = await db.all("projects");
    if (projects.length === 0){
      this.toast("Create a project first.", "warn");
      return;
    }
    const s = id ? await db.get("sites", id) : { name:"", code:"", projectId: projects[0].id, manager:"", address:"" };
    this.openModal(id ? "Edit Site" : "New Site", `
      <form id="site-form">
        <div class="form-row">
          <div class="form-group"><label>Site Code</label><input name="code" value="${s.code||''}" placeholder="e.g. SITE-01"></div>
          <div class="form-group"><label>Site Name *</label><input name="name" value="${s.name||''}" required></div>
        </div>
        <div class="form-group"><label>Project *</label>
          <select name="projectId" required>
            ${projects.map(p => `<option value="${p.id}" ${s.projectId===p.id?'selected':''}>${p.name}</option>`).join("")}
          </select>
        </div>
        <div class="form-group"><label>Site Manager</label><input name="manager" value="${s.manager||''}"></div>
        <div class="form-group"><label>Address</label><textarea name="address">${s.address||''}</textarea></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${id?"Save Changes":"Create Site"}</button>
        </div>
      </form>
    `);
    document.getElementById("site-form").addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(e.target); const obj = id ? { ...s } : {};
      fd.forEach((v,k) => obj[k] = v);
      obj.projectId = Number(obj.projectId);
      if (id){ obj.id = id; await db.put("sites", obj); } else { await db.add("sites", obj); }
      this.closeModal(); this.toast(id?"Site updated":"Site created"); this.renderSites();
    });
  },

  async deleteSite(id){
    this.confirm("Delete this site? Stock movements at this site will remain but reference a missing site.", async () => {
      await db.delete("sites", id);
      this.toast("Site deleted", "warn"); this.renderSites();
    });
  },

  async editLocation(id){
    const sites = await db.all("sites");
    if (sites.length === 0){ this.toast("Create a site first.", "warn"); return; }
    const l = id ? await db.get("locations", id) : { siteId: sites[0].id, code:"", name:"", description:"" };
    this.openModal(id ? "Edit Location" : "New Location", `
      <form id="location-form">
        <div class="form-group"><label>Site *</label>
          <select name="siteId" required>${sites.map(s => `<option value="${s.id}" ${l.siteId===s.id?'selected':''}>${s.name}</option>`).join("")}</select>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Code</label><input name="code" value="${l.code||''}" placeholder="e.g. A, B-1"></div>
          <div class="form-group"><label>Name *</label><input name="name" value="${l.name||''}" required></div>
        </div>
        <div class="form-group"><label>Description</label><textarea name="description">${l.description||''}</textarea></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${id?"Save Changes":"Create"}</button>
        </div>
      </form>
    `);
    document.getElementById("location-form").addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(e.target); const obj = id ? { ...l } : {};
      fd.forEach((v,k) => obj[k] = v);
      obj.siteId = Number(obj.siteId);
      if (id){ obj.id = id; await db.put("locations", obj); } else { await db.add("locations", obj); }
      this.closeModal(); this.toast(id?"Location updated":"Location created"); this.renderSites();
    });
  },

  async deleteLocation(id){
    this.confirm("Delete this location?", async () => {
      await db.delete("locations", id);
      this.toast("Location deleted", "warn"); this.renderSites();
    });
  },

  /* =========================================================
     EQUIPMENT REGISTER
  ========================================================= */
  async renderEquipment(){
    const equipment = await db.all("equipment");
    const sites = await db.all("sites");

    document.getElementById("main-content").innerHTML = `
      <div class="page-header">
        <p style="color:var(--ink-3);">Track heavy equipment, vehicles, and serial-numbered machinery.</p>
        <button class="btn btn-primary" onclick="app.editEquipment()">+ New Equipment</button>
      </div>
      <div class="table-wrap">
        ${equipment.length === 0 ? `
          <div class="empty-state"><span class="emoji">⚙️</span>
            <h3>No equipment registered</h3><p>Add your first machine, vehicle, or tool above.</p>
          </div>` : `
          <table class="data-table">
            <thead><tr><th>Asset Tag</th><th>Name</th><th>Type</th><th>Site</th><th>Serial</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>${equipment.map(e => {
              const s = sites.find(x => x.id === e.siteId);
              return `<tr>
                <td><code>${e.tag||"—"}</code></td>
                <td><strong>${e.name}</strong></td>
                <td>${e.type||"—"}</td>
                <td>${s?.name||"—"}</td>
                <td>${e.serial||"—"}</td>
                <td><span class="badge badge-${e.status==='Operational'?'green':e.status==='Under Maintenance'?'amber':'red'}">${e.status||"—"}</span></td>
                <td class="actions">
                  <button class="btn-icon" onclick="app.editEquipment(${e.id})">✏️</button>
                  <button class="btn-icon danger" onclick="app.deleteEquipment(${e.id})">🗑️</button>
                </td>
              </tr>`;
            }).join("")}
            </tbody>
          </table>`}
      </div>
    `;
  },

  async editEquipment(id){
    const sites = await db.all("sites");
    const e = id ? await db.get("equipment", id) : { tag:"", name:"", type:"", siteId: sites[0]?.id || null, serial:"", status:"Operational", notes:"" };
    this.openModal(id ? "Edit Equipment" : "New Equipment", `
      <form id="eq-form">
        <div class="form-row">
          <div class="form-group"><label>Asset Tag</label><input name="tag" value="${e.tag||''}" placeholder="EQ-001"></div>
          <div class="form-group"><label>Name *</label><input name="name" value="${e.name||''}" required></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Type</label>
            <select name="type">
              ${["Vehicle","Heavy Machine","Power Tool","Generator","Lifting Equipment","Other"].map(x => `<option ${e.type===x?'selected':''}>${x}</option>`).join("")}
            </select>
          </div>
          <div class="form-group"><label>Site</label>
            <select name="siteId">${sites.map(s => `<option value="${s.id}" ${e.siteId===s.id?'selected':''}>${s.name}</option>`).join("")}</select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Serial Number</label><input name="serial" value="${e.serial||''}"></div>
          <div class="form-group"><label>Status</label>
            <select name="status">
              ${["Operational","Under Maintenance","Out of Service","Disposed"].map(x => `<option ${e.status===x?'selected':''}>${x}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="form-group"><label>Notes</label><textarea name="notes">${e.notes||''}</textarea></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${id?"Save Changes":"Create"}</button>
        </div>
      </form>
    `);
    document.getElementById("eq-form").addEventListener("submit", async ev => {
      ev.preventDefault();
      const fd = new FormData(ev.target); const obj = id ? { ...e } : {};
      fd.forEach((v,k) => obj[k] = v);
      obj.siteId = obj.siteId ? Number(obj.siteId) : null;
      if (id){ obj.id = id; await db.put("equipment", obj); } else { await db.add("equipment", obj); }
      this.closeModal(); this.toast(id?"Equipment updated":"Equipment added"); this.renderEquipment();
    });
  },
  async deleteEquipment(id){
    this.confirm("Delete this equipment record?", async () => {
      await db.delete("equipment", id);
      this.toast("Equipment removed", "warn"); this.renderEquipment();
    });
  },

  /* =========================================================
     ITEM MASTER
  ========================================================= */
  async renderItems(){
    const items = await db.all("items");
    const movs = await db.all("stockMovements");
    const stockMap = new Map();
    movs.forEach(m => stockMap.set(m.itemId, (stockMap.get(m.itemId)||0) + (m.type==="IN"?m.qty:-m.qty)));

    document.getElementById("main-content").innerHTML = `
      <div class="page-header">
        <p style="color:var(--ink-3);">All materials, consumables, and tracked tools live here. ${items.length} item${items.length!==1?'s':''}.</p>
        <button class="btn btn-primary" onclick="app.editItem()">+ New Item</button>
      </div>
      <div class="table-wrap">
        <div class="table-toolbar">
          <input id="items-search" class="table-search" placeholder="Search by name, SKU, or category…">
        </div>
        ${items.length === 0 ? `
          <div class="empty-state"><span class="emoji">🗂️</span>
            <h3>No items yet</h3><p>Build your material catalog by adding items above.</p>
          </div>` : `
          <table class="data-table" id="items-table">
            <thead><tr><th>SKU</th><th>Name</th><th>Category</th><th>Unit</th><th>Stock</th><th>Reorder</th><th>Cost</th><th>Actions</th></tr></thead>
            <tbody>${items.map(it => {
              const s = stockMap.get(it.id) || 0;
              const low = s <= (it.reorderLevel || 0);
              return `<tr data-search="${(it.sku+' '+it.name+' '+(it.category||'')).toLowerCase()}">
                <td><code>${it.sku||"—"}</code></td>
                <td><strong>${it.name}</strong></td>
                <td>${it.category||"—"}</td>
                <td>${it.unit||"—"}</td>
                <td><strong style="color:${low?'var(--red)':'var(--ink)'};">${s}</strong></td>
                <td>${it.reorderLevel||0}</td>
                <td>${this.fmtMoney(it.costPrice||0)}</td>
                <td class="actions">
                  <button class="btn-icon" onclick="app.editItem(${it.id})">✏️</button>
                  <button class="btn-icon danger" onclick="app.deleteItem(${it.id})">🗑️</button>
                </td>
              </tr>`;
            }).join("")}
            </tbody>
          </table>`}
      </div>
    `;
    const search = document.getElementById("items-search");
    if (search){
      search.addEventListener("input", () => {
        const q = search.value.toLowerCase();
        document.querySelectorAll("#items-table tbody tr").forEach(tr => {
          tr.style.display = tr.dataset.search.includes(q) ? "" : "none";
        });
      });
    }
  },

  async editItem(id){
    const it = id ? await db.get("items", id) : { sku:"", name:"", category:"", unit:"pcs", reorderLevel:0, costPrice:0, supplier:"", notes:"" };
    this.openModal(id ? "Edit Item" : "New Item", `
      <form id="item-form">
        <div class="form-row">
          <div class="form-group"><label>SKU / Code</label><input name="sku" value="${it.sku||''}" placeholder="e.g. CEM-001"></div>
          <div class="form-group"><label>Name *</label><input name="name" value="${it.name||''}" required></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Category</label>
            <input name="category" list="categories" value="${it.category||''}" placeholder="e.g. Cement">
            <datalist id="categories">
              <option>Cement</option><option>Steel & Rebar</option><option>Aggregates</option>
              <option>Bricks & Blocks</option><option>Lumber</option><option>Electrical</option>
              <option>Plumbing</option><option>Tools</option><option>Safety</option><option>Consumables</option>
            </datalist>
          </div>
          <div class="form-group"><label>Unit *</label>
            <input name="unit" list="units" value="${it.unit||'pcs'}" required>
            <datalist id="units"><option>pcs</option><option>bag</option><option>kg</option><option>ton</option><option>m</option><option>m²</option><option>m³</option><option>L</option><option>roll</option><option>box</option></datalist>
          </div>
        </div>
        <div class="form-row-3">
          <div class="form-group"><label>Reorder Level</label><input type="number" name="reorderLevel" min="0" step="1" value="${it.reorderLevel||0}"></div>
          <div class="form-group"><label>Cost Price</label><input type="number" name="costPrice" min="0" step="0.01" value="${it.costPrice||0}"></div>
          <div class="form-group"><label>Default Supplier</label><input name="supplier" value="${it.supplier||''}"></div>
        </div>
        <div class="form-group"><label>Notes</label><textarea name="notes">${it.notes||''}</textarea></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${id?"Save Changes":"Create Item"}</button>
        </div>
      </form>
    `, { wide: true });
    document.getElementById("item-form").addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(e.target); const obj = id ? { ...it } : {};
      fd.forEach((v,k) => obj[k] = v);
      obj.reorderLevel = Number(obj.reorderLevel||0);
      obj.costPrice = Number(obj.costPrice||0);
      if (id){ obj.id = id; await db.put("items", obj); } else { await db.add("items", obj); }
      this.closeModal(); this.toast(id?"Item updated":"Item created"); this.renderItems();
    });
  },
  async deleteItem(id){
    this.confirm("Delete this item? Existing stock movements will remain but reference a missing item.", async () => {
      await db.delete("items", id);
      this.toast("Item deleted", "warn"); this.renderItems();
    });
  },

  /* =========================================================
     STOCK IN
  ========================================================= */
  async renderStockIn(){
    const movs = (await db.all("stockMovements")).filter(m => m.type === "IN").sort((a,b)=>(b.date||0)-(a.date||0));
    const items = await db.all("items");
    const sites = await db.all("sites");
    const itemMap = Object.fromEntries(items.map(i => [i.id, i]));
    const siteMap = Object.fromEntries(sites.map(s => [s.id, s]));

    document.getElementById("main-content").innerHTML = `
      <div class="page-header">
        <p style="color:var(--ink-3);">${movs.length} stock-in transaction${movs.length!==1?'s':''}. Each entry adds to current stock.</p>
        <button class="btn btn-primary" onclick="app.editMovement('IN')">+ New Stock IN</button>
      </div>
      <div class="table-wrap">
        ${movs.length === 0 ? `
          <div class="empty-state"><span class="emoji">📥</span>
            <h3>No stock-in entries yet</h3><p>Record received deliveries and goods above.</p>
          </div>` : `
          <table class="data-table">
            <thead><tr><th>Date</th><th>Ref No.</th><th>Item</th><th>Qty</th><th>Site</th><th>Supplier</th><th>Actions</th></tr></thead>
            <tbody>${movs.map(m => `
              <tr>
                <td>${this.fmtDate(m.date)}</td>
                <td><code>${m.refNo||"—"}</code></td>
                <td><strong>${itemMap[m.itemId]?.name||"—"}</strong></td>
                <td>${m.qty} ${itemMap[m.itemId]?.unit||""}</td>
                <td>${siteMap[m.siteId]?.name||"—"}</td>
                <td>${m.supplier||"—"}</td>
                <td class="actions">
                  <button class="btn-icon" onclick="app.editMovement('IN',${m.id})">✏️</button>
                  <button class="btn-icon danger" onclick="app.deleteMovement(${m.id},'IN')">🗑️</button>
                </td>
              </tr>`).join("")}
            </tbody>
          </table>`}
      </div>
    `;
  },

  /* =========================================================
     STOCK OUT
  ========================================================= */
  async renderStockOut(){
    const movs = (await db.all("stockMovements")).filter(m => m.type === "OUT").sort((a,b)=>(b.date||0)-(a.date||0));
    const items = await db.all("items");
    const sites = await db.all("sites");
    const itemMap = Object.fromEntries(items.map(i => [i.id, i]));
    const siteMap = Object.fromEntries(sites.map(s => [s.id, s]));

    document.getElementById("main-content").innerHTML = `
      <div class="page-header">
        <p style="color:var(--ink-3);">${movs.length} stock-out transaction${movs.length!==1?'s':''}. Each entry deducts from stock.</p>
        <button class="btn btn-primary" onclick="app.editMovement('OUT')">+ New Stock OUT</button>
      </div>
      <div class="table-wrap">
        ${movs.length === 0 ? `
          <div class="empty-state"><span class="emoji">📤</span>
            <h3>No stock-out entries yet</h3><p>Record issued/consumed materials above.</p>
          </div>` : `
          <table class="data-table">
            <thead><tr><th>Date</th><th>Ref No.</th><th>Item</th><th>Qty</th><th>Site</th><th>Issued To</th><th>Purpose</th><th>Actions</th></tr></thead>
            <tbody>${movs.map(m => `
              <tr>
                <td>${this.fmtDate(m.date)}</td>
                <td><code>${m.refNo||"—"}</code></td>
                <td><strong>${itemMap[m.itemId]?.name||"—"}</strong></td>
                <td>${m.qty} ${itemMap[m.itemId]?.unit||""}</td>
                <td>${siteMap[m.siteId]?.name||"—"}</td>
                <td>${m.issuedTo||"—"}</td>
                <td>${m.purpose||"—"}</td>
                <td class="actions">
                  <button class="btn-icon" onclick="app.editMovement('OUT',${m.id})">✏️</button>
                  <button class="btn-icon danger" onclick="app.deleteMovement(${m.id},'OUT')">🗑️</button>
                </td>
              </tr>`).join("")}
            </tbody>
          </table>`}
      </div>
    `;
  },

  async editMovement(type, id){
    const items = await db.all("items");
    const sites = await db.all("sites");
    if (items.length === 0){ this.toast("Create an item first.","warn"); return; }
    if (sites.length === 0){ this.toast("Create a site first.","warn"); return; }
    const m = id ? await db.get("stockMovements", id) : {
      type, itemId: items[0].id, siteId: sites[0].id,
      qty: 1, date: Date.now(), refNo:"",
      supplier:"", issuedTo:"", purpose:"", notes:""
    };
    const dateStr = m.date ? new Date(m.date).toISOString().slice(0,10) : new Date().toISOString().slice(0,10);

    this.openModal(id ? `Edit Stock ${type}` : `New Stock ${type}`, `
      <form id="mov-form">
        <div class="form-row">
          <div class="form-group"><label>Date *</label><input type="date" name="date" value="${dateStr}" required></div>
          <div class="form-group"><label>Reference No.</label><input name="refNo" value="${m.refNo||''}" placeholder="DC/Invoice/MR No."></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Item *</label>
            <select name="itemId" required>${items.map(i => `<option value="${i.id}" ${m.itemId===i.id?'selected':''}>${i.name} (${i.unit||'pcs'})</option>`).join("")}</select>
          </div>
          <div class="form-group"><label>Quantity *</label><input type="number" name="qty" min="0.01" step="0.01" value="${m.qty}" required></div>
        </div>
        <div class="form-group"><label>Site *</label>
          <select name="siteId" required>${sites.map(s => `<option value="${s.id}" ${m.siteId===s.id?'selected':''}>${s.name}</option>`).join("")}</select>
        </div>
        ${type === "IN" ? `
          <div class="form-group"><label>Supplier</label><input name="supplier" value="${m.supplier||''}"></div>
        ` : `
          <div class="form-row">
            <div class="form-group"><label>Issued To</label><input name="issuedTo" value="${m.issuedTo||''}" placeholder="Person / team"></div>
            <div class="form-group"><label>Purpose</label><input name="purpose" value="${m.purpose||''}" placeholder="e.g. Foundation work"></div>
          </div>
        `}
        <div class="form-group"><label>Notes</label><textarea name="notes">${m.notes||''}</textarea></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
          <button type="submit" class="btn ${type==='IN'?'btn-success':'btn-primary'}">${id?"Save Changes":(type==='IN'?'Receive':'Issue')}</button>
        </div>
      </form>
    `, { wide: true });
    document.getElementById("mov-form").addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(e.target); const obj = id ? { ...m } : { type };
      fd.forEach((v,k) => obj[k] = v);
      obj.itemId = Number(obj.itemId);
      obj.siteId = Number(obj.siteId);
      obj.qty = Number(obj.qty);
      obj.date = new Date(obj.date).getTime();
      if (type === "OUT"){
        const currentStock = await this.stockOf(obj.itemId);
        const original = id ? m.qty : 0;
        const effective = currentStock + (id ? original : 0); // adding back the original on edit
        if (obj.qty > effective){
          if (!confirm(`Stock will go negative (available: ${effective}, issuing: ${obj.qty}). Proceed?`)) return;
        }
      }
      if (id){ obj.id = id; await db.put("stockMovements", obj); } else { await db.add("stockMovements", obj); }
      this.closeModal();
      this.toast(`Stock ${type} ${id?"updated":"recorded"}`);
      type === "IN" ? this.renderStockIn() : this.renderStockOut();
    });
  },

  async deleteMovement(id, type){
    this.confirm("Delete this movement? Stock balances will be recalculated.", async () => {
      await db.delete("stockMovements", id);
      this.toast("Movement deleted", "warn");
      type === "IN" ? this.renderStockIn() : this.renderStockOut();
    });
  },

  /* =========================================================
     TOOL TRACKER
  ========================================================= */
  async renderToolTracker(){
    const issues = (await db.all("toolIssues")).sort((a,b)=>(b.issueDate||0)-(a.issueDate||0));
    const items = await db.all("items");
    const itemMap = Object.fromEntries(items.map(i => [i.id, i]));

    const issued = issues.filter(i => i.status === "ISSUED");
    const returned = issues.filter(i => i.status === "RETURNED");

    document.getElementById("main-content").innerHTML = `
      <div class="page-header">
        <p style="color:var(--ink-3);">Track tools and equipment issued to workers. ${issued.length} currently out.</p>
        <button class="btn btn-primary" onclick="app.editToolIssue()">+ Issue Tool</button>
      </div>

      <div class="stats-grid">
        <div class="stat-card stat-red">
          <div class="stat-icon">🔨</div>
          <div class="stat-label">Currently Out</div>
          <div class="stat-value">${issued.length}</div>
        </div>
        <div class="stat-card stat-green">
          <div class="stat-icon">✅</div>
          <div class="stat-label">Returned</div>
          <div class="stat-value">${returned.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📋</div>
          <div class="stat-label">Total Records</div>
          <div class="stat-value">${issues.length}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">🔨 All Tool Issues</div>
        ${issues.length === 0 ? `<div style="color:var(--ink-3);font-size:13px;">No tool issues recorded yet.</div>` : `
        <table class="data-table">
          <thead><tr><th>Issue Date</th><th>Tool</th><th>Qty</th><th>Issued To</th><th>Expected Return</th><th>Return Date</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${issues.map(t => `
            <tr>
              <td>${this.fmtDate(t.issueDate)}</td>
              <td><strong>${itemMap[t.itemId]?.name||"—"}</strong></td>
              <td>${t.qty}</td>
              <td>${t.issuedTo||"—"}</td>
              <td>${t.expectedReturn||"—"}</td>
              <td>${t.returnDate?this.fmtDate(t.returnDate):"—"}</td>
              <td><span class="badge badge-${t.status==='ISSUED'?'amber':'green'}">${t.status}</span></td>
              <td class="actions">
                ${t.status === "ISSUED" ? `<button class="btn btn-sm btn-success" onclick="app.returnTool(${t.id})">Return</button>` : ""}
                <button class="btn-icon danger" onclick="app.deleteToolIssue(${t.id})">🗑️</button>
              </td>
            </tr>`).join("")}
          </tbody>
        </table>`}
      </div>
    `;
  },

  async editToolIssue(){
    const items = await db.all("items");
    const tools = items.filter(i => (i.category||"").toLowerCase().includes("tool"));
    const list = tools.length > 0 ? tools : items;
    if (list.length === 0){ this.toast("Add at least one item to the master first.","warn"); return; }
    const today = new Date().toISOString().slice(0,10);

    this.openModal("Issue Tool", `
      <form id="tool-form">
        <div class="form-row">
          <div class="form-group"><label>Tool / Item *</label>
            <select name="itemId" required>${list.map(i => `<option value="${i.id}">${i.name}</option>`).join("")}</select>
          </div>
          <div class="form-group"><label>Quantity *</label><input type="number" name="qty" min="1" value="1" required></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Issue Date *</label><input type="date" name="issueDate" value="${today}" required></div>
          <div class="form-group"><label>Expected Return</label><input type="date" name="expectedReturn"></div>
        </div>
        <div class="form-group"><label>Issued To *</label><input name="issuedTo" required placeholder="Worker name / ID"></div>
        <div class="form-group"><label>Notes</label><textarea name="notes"></textarea></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Issue Tool</button>
        </div>
      </form>
    `);
    document.getElementById("tool-form").addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(e.target); const obj = { status: "ISSUED" };
      fd.forEach((v,k) => obj[k] = v);
      obj.itemId = Number(obj.itemId);
      obj.qty = Number(obj.qty);
      obj.issueDate = new Date(obj.issueDate).getTime();
      await db.add("toolIssues", obj);
      this.closeModal(); this.toast("Tool issued"); this.renderToolTracker();
    });
  },

  async returnTool(id){
    const t = await db.get("toolIssues", id);
    t.status = "RETURNED";
    t.returnDate = Date.now();
    await db.put("toolIssues", t);
    this.toast("Tool returned");
    this.renderToolTracker();
  },

  async deleteToolIssue(id){
    this.confirm("Delete this tool record?", async () => {
      await db.delete("toolIssues", id);
      this.toast("Record deleted","warn"); this.renderToolTracker();
    });
  },

  /* =========================================================
     PO GENERATOR
  ========================================================= */
  async renderPOGenerator(){
    const items = await db.all("items");
    const movs = await db.all("stockMovements");
    const stockMap = new Map();
    movs.forEach(m => stockMap.set(m.itemId, (stockMap.get(m.itemId)||0) + (m.type==="IN"?m.qty:-m.qty)));

    const low = items.map(it => {
      const stock = stockMap.get(it.id) || 0;
      const deficit = (it.reorderLevel || 0) - stock;
      return { it, stock, deficit };
    }).filter(x => x.deficit > 0).sort((a,b) => b.deficit - a.deficit);

    // group by supplier
    const grouped = {};
    low.forEach(({it, stock, deficit}) => {
      const sup = it.supplier || "Unassigned";
      if (!grouped[sup]) grouped[sup] = [];
      grouped[sup].push({ it, stock, deficit });
    });

    document.getElementById("main-content").innerHTML = `
      <div class="page-header">
        <div>
          <h2>Auto-generate POs from low stock</h2>
          <p style="color:var(--ink-3);">Items below their reorder level, grouped by default supplier.</p>
        </div>
        ${low.length>0 ? `<button class="btn btn-primary" onclick="app.generateAllPOs()">⚡ Generate All POs</button>` : ""}
      </div>

      ${low.length === 0 ? `
        <div class="card">
          <div class="empty-state"><span class="emoji">✅</span>
            <h3>Everything in stock</h3><p>No items are below their reorder levels right now.</p>
          </div>
        </div>` : Object.entries(grouped).map(([supplier, rows]) => `
        <div class="card" style="margin-bottom:16px;">
          <div class="card-title">
            🏭 ${supplier}
            <span style="margin-left:auto;font-size:12px;color:var(--ink-3);font-weight:400;">${rows.length} item${rows.length>1?'s':''}</span>
          </div>
          <table class="data-table">
            <thead><tr><th>Item</th><th>Current Stock</th><th>Reorder Level</th><th>Suggested Qty</th><th>Cost</th><th>Subtotal</th></tr></thead>
            <tbody>${rows.map(({it,stock,deficit}) => `
              <tr>
                <td><strong>${it.name}</strong> <span class="row-tag">${it.sku||""}</span></td>
                <td style="color:${stock<=0?'var(--red)':'var(--amber-2)'};">${stock} ${it.unit||""}</td>
                <td>${it.reorderLevel||0}</td>
                <td><strong>${deficit}</strong> ${it.unit||""}</td>
                <td>${this.fmtMoney(it.costPrice||0)}</td>
                <td><strong>${this.fmtMoney((it.costPrice||0) * deficit)}</strong></td>
              </tr>`).join("")}
            </tbody>
          </table>
          <div style="margin-top:14px;text-align:right;">
            <button class="btn btn-success po-gen-btn" data-supplier-idx="${Object.keys(grouped).indexOf(supplier)}">
              📋 Create PO for ${supplier}
            </button>
          </div>
        </div>
      `).join("")}
    `;
    // attach handlers using a stashed lookup so supplier names with quotes are safe
    this._poGenGroups = grouped;
    document.querySelectorAll(".po-gen-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const supplier = Object.keys(this._poGenGroups)[Number(btn.dataset.supplierIdx)];
        const rows = this._poGenGroups[supplier];
        const lines = rows.map(r => ({ itemId: r.it.id, qty: r.deficit, rate: r.it.costPrice || 0, name: r.it.name }));
        this.createPOForSupplier(supplier, lines);
      });
    });
  },

  async createPOForSupplier(supplier, lines){
    const company = await db.get("company", 1);
    const total = lines.reduce((acc, l) => acc + l.qty * l.rate, 0);
    const all = await db.all("purchaseOrders");
    const poNo = `PO-${String(all.length + 1).padStart(4,"0")}`;
    await db.add("purchaseOrders", {
      poNo, supplier, date: Date.now(),
      items: lines.map(l => ({ itemId: l.itemId, name: l.name, qty: l.qty, rate: l.rate, total: l.qty * l.rate })),
      total, status: "DRAFT", notes: "Auto-generated from low stock"
    });
    this.toast(`PO ${poNo} created for ${supplier}`);
    this.renderPOGenerator();
  },

  async generateAllPOs(){
    const items = await db.all("items");
    const movs = await db.all("stockMovements");
    const stockMap = new Map();
    movs.forEach(m => stockMap.set(m.itemId, (stockMap.get(m.itemId)||0) + (m.type==="IN"?m.qty:-m.qty)));

    const grouped = {};
    items.forEach(it => {
      const stock = stockMap.get(it.id) || 0;
      const deficit = (it.reorderLevel || 0) - stock;
      if (deficit > 0){
        const sup = it.supplier || "Unassigned";
        if (!grouped[sup]) grouped[sup] = [];
        grouped[sup].push({ itemId: it.id, name: it.name, qty: deficit, rate: it.costPrice||0 });
      }
    });

    let count = 0;
    const all = await db.all("purchaseOrders");
    for (const [supplier, lines] of Object.entries(grouped)){
      count++;
      const poNo = `PO-${String(all.length + count).padStart(4,"0")}`;
      const total = lines.reduce((acc,l) => acc + l.qty * l.rate, 0);
      await db.add("purchaseOrders", {
        poNo, supplier, date: Date.now(),
        items: lines.map(l => ({ ...l, total: l.qty * l.rate })),
        total, status: "DRAFT", notes: "Auto-generated from low stock"
      });
    }
    this.toast(`${count} PO${count!==1?'s':''} created`);
    this.go("purchase-orders");
  },

  /* =========================================================
     PURCHASE ORDERS
  ========================================================= */
  async renderPurchaseOrders(){
    const pos = (await db.all("purchaseOrders")).sort((a,b)=>(b.date||0)-(a.date||0));
    const company = await db.get("company", 1);
    const cur = company?.currency || "USD";

    document.getElementById("main-content").innerHTML = `
      <div class="page-header">
        <p style="color:var(--ink-3);">${pos.length} purchase order${pos.length!==1?'s':''} on record.</p>
        <button class="btn btn-primary" onclick="app.editPO()">+ New PO</button>
      </div>
      <div class="table-wrap">
        ${pos.length === 0 ? `
          <div class="empty-state"><span class="emoji">📋</span>
            <h3>No purchase orders</h3><p>Create one manually or use the PO Generator.</p>
          </div>` : `
          <table class="data-table">
            <thead><tr><th>PO No.</th><th>Date</th><th>Supplier</th><th>Items</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>${pos.map(p => `
              <tr>
                <td><strong>${p.poNo}</strong></td>
                <td>${this.fmtDate(p.date)}</td>
                <td>${p.supplier||"—"}</td>
                <td>${(p.items||[]).length} line${(p.items||[]).length!==1?'s':''}</td>
                <td><strong>${this.fmtMoney(p.total||0, cur)}</strong></td>
                <td><span class="badge badge-${p.status==='DRAFT'?'amber':p.status==='SENT'?'blue':p.status==='RECEIVED'?'green':'red'}">${p.status}</span></td>
                <td class="actions">
                  <button class="btn-icon" onclick="app.viewPO(${p.id})" title="View">👁️</button>
                  <button class="btn-icon" onclick="app.editPO(${p.id})" title="Edit">✏️</button>
                  ${p.status==='SENT'?`<button class="btn-icon" onclick="app.receivePO(${p.id})" title="Mark received">📥</button>`:""}
                  <button class="btn-icon danger" onclick="app.deletePO(${p.id})">🗑️</button>
                </td>
              </tr>`).join("")}
            </tbody>
          </table>`}
      </div>
    `;
  },

  async viewPO(id){
    const p = await db.get("purchaseOrders", id);
    const company = await db.get("company", 1);
    const cur = company?.currency || "USD";
    this.openModal(`Purchase Order — ${p.poNo}`, `
      <div style="display:flex;justify-content:space-between;margin-bottom:14px;">
        <div>
          <div style="font-weight:600;font-size:15px;">${company?.name||""}</div>
          <div style="font-size:12px;color:var(--ink-3);">${company?.address||""}</div>
        </div>
        <div style="text-align:right;">
          <div><strong>Date:</strong> ${this.fmtDate(p.date)}</div>
          <div><strong>Status:</strong> <span class="badge badge-${p.status==='DRAFT'?'amber':p.status==='SENT'?'blue':p.status==='RECEIVED'?'green':'red'}">${p.status}</span></div>
        </div>
      </div>
      <div style="background:var(--bg-elev);padding:12px;border-radius:6px;margin-bottom:14px;">
        <div style="font-size:11px;color:var(--ink-3);text-transform:uppercase;letter-spacing:.5px;">Supplier</div>
        <div style="font-weight:600;font-size:15px;">${p.supplier||"—"}</div>
      </div>
      <table class="data-table">
        <thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead>
        <tbody>${(p.items||[]).map((l,i) => `
          <tr>
            <td>${i+1}</td>
            <td>${l.name}</td>
            <td>${l.qty}</td>
            <td>${this.fmtMoney(l.rate, cur)}</td>
            <td><strong>${this.fmtMoney(l.total, cur)}</strong></td>
          </tr>`).join("")}
          <tr style="background:var(--bg-elev);"><td colspan="4" style="text-align:right;font-weight:600;">Grand Total</td><td><strong style="font-size:15px;">${this.fmtMoney(p.total, cur)}</strong></td></tr>
        </tbody>
      </table>
      ${p.notes?`<div style="margin-top:12px;font-size:13px;"><strong>Notes:</strong> ${p.notes}</div>`:""}
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="window.print()">🖨️ Print</button>
        ${p.status==='DRAFT'?`<button class="btn btn-primary" onclick="app.sendPO(${p.id})">📤 Mark as Sent</button>`:""}
        ${p.status==='SENT'?`<button class="btn btn-success" onclick="app.receivePO(${p.id})">📥 Mark as Received</button>`:""}
        <button class="btn btn-secondary" onclick="app.closeModal()">Close</button>
      </div>
    `, { wide: true });
  },

  async sendPO(id){
    const p = await db.get("purchaseOrders", id);
    p.status = "SENT";
    await db.put("purchaseOrders", p);
    this.closeModal(); this.toast("PO marked as sent"); this.renderPurchaseOrders();
  },

  async receivePO(id){
    const p = await db.get("purchaseOrders", id);
    const sites = await db.all("sites");
    if (sites.length === 0){ this.toast("No site available to receive into.","error"); return; }
    this.confirm(`This will create Stock IN entries for ${p.items.length} item line(s) at ${sites[0].name}. Continue?`, async () => {
      for (const line of (p.items || [])){
        await db.add("stockMovements", {
          type: "IN",
          itemId: line.itemId,
          siteId: sites[0].id,
          qty: line.qty,
          date: Date.now(),
          refNo: p.poNo,
          supplier: p.supplier,
          notes: `Auto-received from PO ${p.poNo}`,
          poId: p.id
        });
      }
      p.status = "RECEIVED";
      await db.put("purchaseOrders", p);
      this.toast(`PO received — ${p.items.length} stock-in entries created`);
      this.closeModal();
      this.renderPurchaseOrders();
    });
  },

  async editPO(id){
    const p = id ? await db.get("purchaseOrders", id) : {
      poNo: "", supplier: "", date: Date.now(),
      items: [], total: 0, status: "DRAFT", notes: ""
    };
    if (!id){
      const all = await db.all("purchaseOrders");
      p.poNo = `PO-${String(all.length + 1).padStart(4, "0")}`;
    }
    const items = await db.all("items");
    const dateStr = new Date(p.date).toISOString().slice(0,10);

    const renderLines = (lines) => lines.map((l,i) => `
      <div class="form-row-3" style="align-items:end;margin-bottom:8px;">
        <div class="form-group" style="margin:0;"><label>${i===0?'Item':''}</label>
          <select class="po-item" data-idx="${i}">${items.map(it => `<option value="${it.id}" ${l.itemId===it.id?'selected':''}>${it.name}</option>`).join("")}</select>
        </div>
        <div class="form-group" style="margin:0;"><label>${i===0?'Qty':''}</label><input type="number" class="po-qty" data-idx="${i}" min="0" step="0.01" value="${l.qty}"></div>
        <div class="form-group" style="margin:0;display:flex;gap:6px;align-items:end;">
          <input type="number" class="po-rate" data-idx="${i}" min="0" step="0.01" value="${l.rate}" placeholder="Rate" style="flex:1;">
          <button type="button" class="btn-icon danger" onclick="app._poRemoveLine(${i})">✕</button>
        </div>
      </div>
    `).join("");

    this.openModal(id ? `Edit ${p.poNo}` : "New Purchase Order", `
      <form id="po-form">
        <div class="form-row">
          <div class="form-group"><label>PO Number *</label><input name="poNo" value="${p.poNo}" required></div>
          <div class="form-group"><label>Date *</label><input type="date" name="date" value="${dateStr}" required></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Supplier *</label><input name="supplier" value="${p.supplier||''}" required></div>
          <div class="form-group"><label>Status</label>
            <select name="status">${["DRAFT","SENT","RECEIVED","CANCELLED"].map(s => `<option ${p.status===s?'selected':''}>${s}</option>`).join("")}</select>
          </div>
        </div>
        <div style="margin-top:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <label style="font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.5px;">Line Items</label>
            <button type="button" class="btn btn-sm btn-secondary" onclick="app._poAddLine()">+ Add Line</button>
          </div>
          <div id="po-lines">${renderLines(p.items || [])}</div>
          <div id="po-total" style="text-align:right;font-weight:600;margin-top:10px;font-size:15px;">Total: ${this.fmtMoney(p.total||0)}</div>
        </div>
        <div class="form-group" style="margin-top:14px;"><label>Notes</label><textarea name="notes">${p.notes||''}</textarea></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${id?"Save Changes":"Create PO"}</button>
        </div>
      </form>
    `, { wide: true });

    this._poLines = p.items ? [...p.items] : [];
    if (this._poLines.length === 0) this._poAddLine();
    this._poItemsCache = items;
    this._poRefreshTotal();

    document.getElementById("po-form").addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const lines = this._poCollectLines();
      const total = lines.reduce((a,l) => a + l.total, 0);
      const obj = id ? { ...p } : {};
      fd.forEach((v,k) => obj[k] = v);
      obj.date = new Date(obj.date).getTime();
      obj.items = lines;
      obj.total = total;
      if (id){ obj.id = id; await db.put("purchaseOrders", obj); } else { await db.add("purchaseOrders", obj); }
      this.closeModal(); this.toast(id?"PO updated":"PO created"); this.renderPurchaseOrders();
    });

    // dynamic listeners
    document.getElementById("po-lines").addEventListener("input", () => this._poRefreshTotal());
    document.getElementById("po-lines").addEventListener("change", () => this._poRefreshTotal());
  },

  _poCollectLines(){
    const lines = [];
    const itemMap = Object.fromEntries(this._poItemsCache.map(i => [i.id, i]));
    document.querySelectorAll(".po-item").forEach((sel, idx) => {
      const itemId = Number(sel.value);
      const qty = Number(document.querySelector(`.po-qty[data-idx="${idx}"]`).value || 0);
      const rate = Number(document.querySelector(`.po-rate[data-idx="${idx}"]`).value || 0);
      if (qty > 0){
        lines.push({ itemId, name: itemMap[itemId]?.name || "—", qty, rate, total: qty * rate });
      }
    });
    return lines;
  },
  _poRefreshTotal(){
    const lines = this._poCollectLines();
    const total = lines.reduce((a,l) => a + l.total, 0);
    document.getElementById("po-total").textContent = "Total: " + this.fmtMoney(total);
  },
  _poAddLine(){
    this._poLines = this._poCollectLines();
    this._poLines.push({ itemId: this._poItemsCache[0]?.id || 0, qty: 1, rate: 0, total: 0, name: this._poItemsCache[0]?.name || "" });
    this._poRenderLines();
  },
  _poRemoveLine(i){
    this._poLines = this._poCollectLines();
    this._poLines.splice(i, 1);
    this._poRenderLines();
  },
  _poRenderLines(){
    const items = this._poItemsCache;
    const html = this._poLines.map((l,i) => `
      <div class="form-row-3" style="align-items:end;margin-bottom:8px;">
        <div class="form-group" style="margin:0;"><label>${i===0?'Item':''}</label>
          <select class="po-item" data-idx="${i}">${items.map(it => `<option value="${it.id}" ${l.itemId===it.id?'selected':''}>${it.name}</option>`).join("")}</select>
        </div>
        <div class="form-group" style="margin:0;"><label>${i===0?'Qty':''}</label><input type="number" class="po-qty" data-idx="${i}" min="0" step="0.01" value="${l.qty}"></div>
        <div class="form-group" style="margin:0;display:flex;gap:6px;align-items:end;">
          <input type="number" class="po-rate" data-idx="${i}" min="0" step="0.01" value="${l.rate}" placeholder="Rate" style="flex:1;">
          <button type="button" class="btn-icon danger" onclick="app._poRemoveLine(${i})">✕</button>
        </div>
      </div>`).join("");
    document.getElementById("po-lines").innerHTML = html;
    this._poRefreshTotal();
  },

  async deletePO(id){
    this.confirm("Delete this PO?", async () => {
      await db.delete("purchaseOrders", id);
      this.toast("PO deleted","warn"); this.renderPurchaseOrders();
    });
  },

  /* =========================================================
     REPORTS
  ========================================================= */
  async renderReports(){
    const [items, movs, pos, tools, sites, company] = await Promise.all([
      db.all("items"), db.all("stockMovements"),
      db.all("purchaseOrders"), db.all("toolIssues"),
      db.all("sites"), db.get("company", 1)
    ]);
    const cur = company?.currency || "USD";
    const stockMap = new Map();
    movs.forEach(m => stockMap.set(m.itemId, (stockMap.get(m.itemId)||0) + (m.type==="IN"?m.qty:-m.qty)));

    // current stock report
    const stockRows = items.map(it => {
      const s = stockMap.get(it.id) || 0;
      return { it, stock: s, value: s * (it.costPrice || 0) };
    });
    const totalValue = stockRows.reduce((a,r) => a + r.value, 0);
    const lowStock = stockRows.filter(r => r.stock <= (r.it.reorderLevel || 0));
    const negativeStock = stockRows.filter(r => r.stock < 0);

    document.getElementById("main-content").innerHTML = `
      <div class="tabs">
        <button class="tab-btn active" data-tab="stock">Stock Levels</button>
        <button class="tab-btn" data-tab="low">Low Stock</button>
        <button class="tab-btn" data-tab="movements">Movements</button>
        <button class="tab-btn" data-tab="tools-out">Tools Out</button>
        <button class="tab-btn" data-tab="po-summary">PO Summary</button>
      </div>
      <div id="report-content"></div>
    `;

    const renderStock = () => {
      document.getElementById("report-content").innerHTML = `
        <div class="page-header">
          <div><h2>Current Stock Levels</h2><p>${items.length} items · Total value <strong>${this.fmtMoney(totalValue, cur)}</strong></p></div>
          <div class="page-actions">
            <button class="btn btn-secondary" onclick="app.exportCSV('stock')">⬇ Export CSV</button>
            <button class="btn btn-secondary" onclick="window.print()">🖨️ Print</button>
          </div>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>SKU</th><th>Name</th><th>Category</th><th>Unit</th><th>Stock</th><th>Reorder</th><th>Cost</th><th>Value</th></tr></thead>
            <tbody>${stockRows.map(({it,stock,value}) => {
              const low = stock <= (it.reorderLevel||0);
              return `<tr>
                <td><code>${it.sku||"—"}</code></td>
                <td>${it.name}</td>
                <td>${it.category||"—"}</td>
                <td>${it.unit||"—"}</td>
                <td><strong style="color:${stock<0?'var(--red)':low?'var(--amber-2)':'var(--ink)'};">${stock}</strong></td>
                <td>${it.reorderLevel||0}</td>
                <td>${this.fmtMoney(it.costPrice||0, cur)}</td>
                <td><strong>${this.fmtMoney(value, cur)}</strong></td>
              </tr>`;
            }).join("")}
            <tr style="background:var(--bg-elev);"><td colspan="7" style="text-align:right;font-weight:600;">Grand Total</td><td><strong style="font-size:15px;">${this.fmtMoney(totalValue, cur)}</strong></td></tr>
            </tbody>
          </table>
        </div>
      `;
    };

    const renderLow = () => {
      document.getElementById("report-content").innerHTML = `
        <div class="page-header">
          <div><h2>Low Stock Report</h2><p>${lowStock.length} items at or below reorder level · ${negativeStock.length} negative</p></div>
          <button class="btn btn-secondary" onclick="app.exportCSV('low')">⬇ Export CSV</button>
        </div>
        <div class="table-wrap">
          ${lowStock.length === 0 ? `<div class="empty-state"><span class="emoji">✅</span><h3>All items in stock</h3></div>` : `
          <table class="data-table">
            <thead><tr><th>Item</th><th>Stock</th><th>Reorder</th><th>Suggested PO Qty</th><th>Supplier</th></tr></thead>
            <tbody>${lowStock.map(({it,stock}) => `
              <tr>
                <td><strong>${it.name}</strong> <span class="row-tag">${it.sku||""}</span></td>
                <td style="color:${stock<0?'var(--red)':'var(--amber-2)'};"><strong>${stock}</strong> ${it.unit||""}</td>
                <td>${it.reorderLevel||0}</td>
                <td><strong>${Math.max(0, (it.reorderLevel||0) - stock)}</strong></td>
                <td>${it.supplier||"—"}</td>
              </tr>`).join("")}
            </tbody>
          </table>`}
        </div>
      `;
    };

    const renderMovements = () => {
      const itemMap = Object.fromEntries(items.map(i => [i.id, i]));
      const siteMap = Object.fromEntries(sites.map(s => [s.id, s]));
      const sorted = [...movs].sort((a,b) => (b.date||0)-(a.date||0));
      document.getElementById("report-content").innerHTML = `
        <div class="page-header">
          <div><h2>All Movements</h2><p>${movs.length} total transactions</p></div>
          <button class="btn btn-secondary" onclick="app.exportCSV('movements')">⬇ Export CSV</button>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Date</th><th>Type</th><th>Item</th><th>Qty</th><th>Site</th><th>Ref</th><th>Party</th></tr></thead>
            <tbody>${sorted.map(m => `
              <tr>
                <td>${this.fmtDate(m.date)}</td>
                <td><span class="badge badge-${m.type==='IN'?'green':'red'}">${m.type}</span></td>
                <td>${itemMap[m.itemId]?.name||"—"}</td>
                <td>${m.qty} ${itemMap[m.itemId]?.unit||""}</td>
                <td>${siteMap[m.siteId]?.name||"—"}</td>
                <td><code>${m.refNo||"—"}</code></td>
                <td>${m.supplier || m.issuedTo || "—"}</td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>
      `;
    };

    const renderToolsOut = () => {
      const itemMap = Object.fromEntries(items.map(i => [i.id, i]));
      const outNow = tools.filter(t => t.status === "ISSUED");
      document.getElementById("report-content").innerHTML = `
        <div class="page-header"><div><h2>Tools Currently Out</h2><p>${outNow.length} unreturned items</p></div></div>
        <div class="table-wrap">
          ${outNow.length === 0 ? `<div class="empty-state"><span class="emoji">✅</span><h3>All tools returned</h3></div>` : `
          <table class="data-table">
            <thead><tr><th>Tool</th><th>Qty</th><th>Issued To</th><th>Issue Date</th><th>Expected Return</th><th>Overdue?</th></tr></thead>
            <tbody>${outNow.map(t => {
              const today = new Date(); today.setHours(0,0,0,0);
              const exp = t.expectedReturn ? new Date(t.expectedReturn) : null;
              const overdue = exp && exp < today;
              return `<tr>
                <td><strong>${itemMap[t.itemId]?.name||"—"}</strong></td>
                <td>${t.qty}</td>
                <td>${t.issuedTo||"—"}</td>
                <td>${this.fmtDate(t.issueDate)}</td>
                <td>${t.expectedReturn||"—"}</td>
                <td>${overdue?'<span class="badge badge-red">OVERDUE</span>':'<span class="badge badge-gray">OK</span>'}</td>
              </tr>`;
            }).join("")}
            </tbody>
          </table>`}
        </div>
      `;
    };

    const renderPOSummary = () => {
      const byStatus = pos.reduce((acc, p) => {
        acc[p.status] = (acc[p.status]||0) + 1;
        return acc;
      }, {});
      const totalSpend = pos.filter(p => p.status === "RECEIVED").reduce((a,p) => a + (p.total||0), 0);
      const pending = pos.filter(p => p.status === "DRAFT" || p.status === "SENT").reduce((a,p) => a + (p.total||0), 0);

      document.getElementById("report-content").innerHTML = `
        <div class="page-header"><div><h2>Purchase Order Summary</h2><p>${pos.length} total POs</p></div></div>
        <div class="stats-grid">
          <div class="stat-card stat-blue"><div class="stat-label">Total POs</div><div class="stat-value">${pos.length}</div></div>
          <div class="stat-card stat-green"><div class="stat-label">Received Value</div><div class="stat-value">${this.fmtMoney(totalSpend, cur)}</div></div>
          <div class="stat-card stat-purple"><div class="stat-label">Pending Value</div><div class="stat-value">${this.fmtMoney(pending, cur)}</div></div>
        </div>
        <div class="card">
          <div class="card-title">📊 By Status</div>
          <div class="kpi-list">
            ${["DRAFT","SENT","RECEIVED","CANCELLED"].map(s => `<div class="kpi-row"><span class="lbl">${s}</span><span class="val">${byStatus[s]||0}</span></div>`).join("")}
          </div>
        </div>
      `;
    };

    const tabRenderers = {
      stock: renderStock, low: renderLow,
      movements: renderMovements, "tools-out": renderToolsOut,
      "po-summary": renderPOSummary
    };
    document.querySelectorAll(".tab-btn").forEach(b => b.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(x => x.classList.toggle("active", x === b));
      tabRenderers[b.dataset.tab]();
    }));
    renderStock();
  },

  async exportCSV(kind){
    const items = await db.all("items");
    const movs = await db.all("stockMovements");
    const sites = await db.all("sites");
    const stockMap = new Map();
    movs.forEach(m => stockMap.set(m.itemId, (stockMap.get(m.itemId)||0) + (m.type==="IN"?m.qty:-m.qty)));

    let csv = "";
    if (kind === "stock"){
      csv = "SKU,Name,Category,Unit,Stock,Reorder Level,Cost Price,Value\n";
      items.forEach(it => {
        const s = stockMap.get(it.id) || 0;
        csv += `"${it.sku||""}","${it.name}","${it.category||""}","${it.unit||""}",${s},${it.reorderLevel||0},${it.costPrice||0},${(s*(it.costPrice||0)).toFixed(2)}\n`;
      });
    } else if (kind === "low"){
      csv = "SKU,Name,Stock,Reorder Level,Suggested Qty,Supplier\n";
      items.forEach(it => {
        const s = stockMap.get(it.id) || 0;
        if (s <= (it.reorderLevel || 0)){
          csv += `"${it.sku||""}","${it.name}",${s},${it.reorderLevel||0},${Math.max(0,(it.reorderLevel||0)-s)},"${it.supplier||""}"\n`;
        }
      });
    } else if (kind === "movements"){
      const itemMap = Object.fromEntries(items.map(i => [i.id, i]));
      const siteMap = Object.fromEntries(sites.map(s => [s.id, s]));
      csv = "Date,Type,Item,Qty,Unit,Site,Ref,Party,Notes\n";
      [...movs].sort((a,b)=>(b.date||0)-(a.date||0)).forEach(m => {
        csv += `${this.fmtDate(m.date)},${m.type},"${itemMap[m.itemId]?.name||""}",${m.qty},"${itemMap[m.itemId]?.unit||""}","${siteMap[m.siteId]?.name||""}","${m.refNo||""}","${m.supplier||m.issuedTo||""}","${(m.notes||"").replace(/"/g,'""')}"\n`;
      });
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `cims-${kind}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast("CSV downloaded");
  },

  /* =========================================================
     SETTINGS
  ========================================================= */
  async renderSettings(){
    const auth = await db.getSetting("auth", { username: "admin", password: "admin123" });
    document.getElementById("main-content").innerHTML = `
      <div class="settings-grid">

        <div class="setting-card">
          <h3>💾 Backup Data</h3>
          <p>Export your entire database as a single JSON file. Keep this safe — it contains everything.</p>
          <button class="btn btn-primary" onclick="app.exportBackup()">Download Backup</button>
        </div>

        <div class="setting-card">
          <h3>♻️ Restore Data</h3>
          <p>Replace current data with the contents of a backup file. <strong>This overwrites everything.</strong></p>
          <input type="file" id="restore-file" accept=".json" style="display:none;">
          <button class="btn btn-secondary" onclick="document.getElementById('restore-file').click()">Choose File…</button>
        </div>

        <div class="setting-card">
          <h3>🔑 Change Password</h3>
          <p>Current username: <code>${auth.username}</code></p>
          <form id="pw-form">
            <div class="form-group"><label>Current Password</label><input type="password" name="current" required></div>
            <div class="form-group"><label>New Password</label><input type="password" name="next" required minlength="4"></div>
            <button type="submit" class="btn btn-primary">Update Password</button>
          </form>
        </div>

        <div class="setting-card" style="border-color:var(--red);">
          <h3 style="color:var(--red);">⚠️ Danger Zone</h3>
          <p>Wipe all data and start fresh. This cannot be undone.</p>
          <button class="btn btn-danger" onclick="app.factoryReset()">Reset Everything</button>
        </div>

      </div>

      <div class="card" style="margin-top:18px;">
        <div class="card-title">ℹ️ About</div>
        <div class="kpi-list">
          <div class="kpi-row"><span class="lbl">Application</span><span class="val">ConstructionIMS v2</span></div>
          <div class="kpi-row"><span class="lbl">Storage</span><span class="val">Browser IndexedDB (offline)</span></div>
          <div class="kpi-row"><span class="lbl">Database</span><span class="val">${DB_NAME} (v${DB_VERSION})</span></div>
          <div class="kpi-row"><span class="lbl">Session User</span><span class="val">${this.state.user.name}</span></div>
        </div>
      </div>
    `;

    document.getElementById("restore-file").addEventListener("change", async e => {
      const file = e.target.files[0];
      if (!file) return;
      this.confirm(`This will REPLACE all current data with the contents of ${file.name}. Proceed?`, async () => {
        try {
          const text = await file.text();
          const payload = JSON.parse(text);
          await db.importAll(payload, { merge: false });
          this.toast("Backup restored successfully");
          this.renderSettings();
        } catch (err){
          this.toast("Restore failed: " + err.message, "error");
        }
      });
    });

    document.getElementById("pw-form").addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const auth = await db.getSetting("auth", { username:"admin", password:"admin123" });
      if (fd.get("current") !== auth.password){
        this.toast("Current password is incorrect","error");
        return;
      }
      auth.password = fd.get("next");
      await db.setSetting("auth", auth);
      this.toast("Password updated");
      e.target.reset();
    });
  },

  async exportBackup(){
    const payload = await db.exportAll();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cims-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast("Backup downloaded");
  },

  factoryReset(){
    this.confirm("Wipe ALL data — items, movements, sites, projects, POs, tools, settings. This cannot be undone.", async () => {
      for (const [name] of STORES) await db.clear(name);
      await db.seedIfEmpty();
      sessionStorage.removeItem("cims_user");
      this.toast("Reset complete. Please log in again.","warn");
      setTimeout(() => location.reload(), 800);
    });
  }
};

window.app = app;
window.addEventListener("DOMContentLoaded", () => app.init());
