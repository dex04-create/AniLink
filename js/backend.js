(function () {
  "use strict";

  const apiUrl = "backend/api.php";
  const app = document.getElementById("app");
  const shared = window.AniLinkData || {};
  const state = { user: null, csrf: "", error: "", products: [], prices: [], inquiries: [], conversations: [], messages: [], notifications: [], users: [], reports: [], announcements: [], stats: {}, activities: [], skipHash: false, refresh: 0 };
  let searchTimer;
  let priceSearchTimer;
  let messagePollTimer;
  const escapeHtml = value => String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const money = value => `₱${Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const route = () => decodeURIComponent(location.hash.slice(1).split("?")[0] || "home");
  const notify = message => {
    const toast = document.getElementById("toast");
    if (toast) {
      toast.textContent = message;
      toast.classList.add("show");
      window.setTimeout(() => toast.classList.remove("show"), 3200);
    }
  };
  const api = async (action, options = {}) => {
    const headers = new Headers(options.headers || {});
    if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
    if (options.method && options.method !== "GET" && state.csrf) headers.set("X-CSRF-Token", state.csrf);
    const response = await fetch(`${apiUrl}?action=${encodeURIComponent(action)}${options.query || ""}`, {
      method: options.method || "GET",
      credentials: "same-origin",
      headers,
      body: options.body ? (options.body instanceof FormData ? options.body : JSON.stringify(options.body)) : undefined
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
    if (result.csrfToken) state.csrf = result.csrfToken;
    if (Object.prototype.hasOwnProperty.call(result, "user")) state.user = result.user;
    return result;
  };
  const defaultPhoto = category => ({
    Fruit: "photo-1553279768-865429fa0078",
    Vegetables: "photo-1546094096-0df4bcaaa337",
    Grains: "photo-1586201375761-83865001e31c",
    Coconut: "photo-1559181567-c3190ca9959b",
    "Root crops": "photo-1518977676601-b53f82aba655"
  }[category] || "photo-1464226184884-fa280b87c399");
  const fallbackPhoto = "assets/images/products/fallback.jpg";

  function setSharedData() {
    shared.products = state.products;
    shared.prices = state.prices;
    shared.inquiries = state.inquiries;
    shared.users = state.users;
    shared.activities = state.activities.map(activity => ({
      icon: "↗",
      text: [activity.action, activity.details].filter(Boolean).join(" · "),
      time: new Date(activity.createdAt).toLocaleString()
    }));
    window.AniLinkData = shared;
  }

  async function loadRouteData() {
    const currentRoute = route();
    const role = currentRoute.split("/")[0];
    const requests = [
      api("products", { query: state.user && state.user.role === "admin" && role === "admin" ? "&all=1" : state.user && state.user.role === "farmer" && role === "farmer" ? "&mine=1" : "" }),
      api("prices")
    ];
    if (state.user && ["farmer", "buyer", "admin"].includes(state.user.role) && ["farmer", "buyer", "admin"].includes(role)) {
      requests.push(api("inquiries"));
    } else {
      state.inquiries = [];
    }
    if (state.user && ["farmer", "buyer"].includes(state.user.role) && role === state.user.role) {
      requests.push(api("conversations"), api("notifications"));
    } else {
      state.conversations = [];
      state.messages = [];
      state.notifications = [];
    }
    if (state.user && state.user.role === "admin" && role === "admin") {
      requests.push(api("admin-stats"), api("admin-users"), api("admin-reports"), api("admin-announcements"), api("admin-activity"));
    } else {
      state.stats = {};
      state.users = [];
      state.reports = [];
      state.announcements = [];
      state.activities = [];
    }
    const responses = await Promise.all(requests);
    state.products = responses[0].data.map(product => ({
      ...product,
      id: String(product.id),
      quantity: Number(product.quantity),
      price: Number(product.price),
      image: defaultPhoto(product.category),
      harvest: product.harvest,
      location: product.location,
      photoUrl: product.photoUrl || ""
    }));
    state.prices = responses[1].data.map(price => ({
      ...price,
      id: String(price.id),
      reference: Number(price.reference),
      source: price.source,
      sample: Boolean(Number(price.is_sample)),
      rawDate: price.date,
      date: new Date(`${price.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
    }));
    let responseIndex = 2;
    if (requests.length > 2 && state.user && ["farmer", "buyer", "admin"].includes(state.user.role) && ["farmer", "buyer", "admin"].includes(role)) {
      state.inquiries = responses[responseIndex++].data.map(inquiry => ({
        ...inquiry,
        id: String(inquiry.id),
        conversationId: inquiry.conversationId == null ? "" : String(inquiry.conversationId),
        date: new Date(inquiry.createdAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
        buyer: inquiry.buyer || inquiry.farmer || "Buyer"
      }));
    }
    if (state.user && ["farmer", "buyer"].includes(state.user.role) && role === state.user.role) {
      state.conversations = responses[responseIndex++].data;
      state.notifications = responses[responseIndex++].data;
      const routeParts = currentRoute.split("/");
      state.messages = [];
      state.messageError = "";
      if (routeParts[1] === "messages" && routeParts[2]) {
        try {
          const result = await api("conversation-messages", { query: `&id=${encodeURIComponent(routeParts[2])}` });
          state.messages = result.data;
          state.conversations = state.conversations.map(item =>
            String(item.id) === routeParts[2] ? { ...item, unreadCount: 0 } : item
          );
          state.notifications = state.notifications.map(item =>
            String(item.conversationId) === routeParts[2] ? { ...item, isRead: 1 } : item
          );
        } catch (error) {
          state.messageError = error.message;
        }
      }
    }
    if (state.user && state.user.role === "admin" && role === "admin") {
      state.stats = responses[responseIndex++].data;
      state.users = responses[responseIndex++].data;
      state.reports = responses[responseIndex++].data;
      state.announcements = responses[responseIndex++].data;
      state.activities = responses[responseIndex].data;
    }
    setSharedData();
  }

  function nudgeMainRender() {
    state.skipHash = true;
    const hash = location.hash || "#home";
    location.hash = `${hash}${hash.includes("?") ? "&" : "?"}refresh=${++state.refresh}`;
  }

  const link = (to, text, cls = "") => `<a class="${cls}" href="#${to}">${text}</a>`;
  const icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21v-9m0 2c-5 0-8-3-8-8 5 0 8 3 8 8Zm0-3c0-5 3-8 8-8 0 5-3 8-8 8Z"/></svg>';
  function header() {
    const currentPage = route().split("/")[0];
    const navLink = (to, label) => {
      const active = currentPage === to || (to === "marketplace" && currentPage === "product");
      return `<a class="${active ? "active" : ""}" href="#${to}"${active ? ' aria-current="page"' : ""}>${label}</a>`;
    };
    return `<header class="site-header"><div class="header-inner">${link("home", `<span class="brand-mark">${icon}</span><span class="brand-name">ani<span>link</span><small>GROWN TOGETHER</small></span>`, "brand")}<button class="mobile-menu" data-backend-menu aria-label="Open navigation" aria-expanded="false">☰</button><nav class="main-nav" aria-label="Main navigation">${navLink("home", "Home")}${navLink("marketplace", "Marketplace")}${navLink("prices", "Market prices")}${navLink("about", "About us")}${navLink("contact", "Contact")}</nav><div class="header-actions">${state.user ? link(`${state.user.role}/dashboard`, "My workspace", "header-login") : link("login", "Log in", "header-login")}${state.user ? `<button class="button button-small" data-logout>Log out</button>` : link("register", "Join AniLink", "button button-small")}</div></div></header>`;
  }
  function footer() {
    return `<footer class="site-footer"><div class="footer-main"><div class="footer-brand"><a class="brand brand-light" href="#home"><span class="brand-mark">${icon}</span><span class="brand-name">ani<span>link</span><small>GROWN TOGETHER</small></span></a><p>A better connection between the people who grow our food and the people who bring it to the table.</p></div><div><h4>Explore</h4>${link("marketplace", "Marketplace")}${link("prices", "Market information")}${link("about", "About AniLink")}</div><div><h4>Get started</h4>${link("register", "Create an account")}${link("login", "Sign in")}</div><div><h4>Say hello</h4><a href="mailto:hello@anilink.demo">hello@anilink.demo</a><p>Marinduque, Philippines</p></div></div><div class="footer-bottom"><span>© 2026 AniLink · Local agriculture in Marinduque</span><span>Sample prices are clearly labeled</span></div></footer>`;
  }
  const pageWrap = content => `${header()}<main>${content}</main>${footer()}`;
  const pageTitle = (eyebrow, title, copy, action = "") => `<div class="dash-heading"><div><span class="card-kicker">${escapeHtml(eyebrow)}</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(copy)}</p></div>${action}</div>`;
  const status = value => `<span class="status-pill ${escapeHtml(String(value).toLowerCase())}">${escapeHtml(value)}</span>`;
  const initials = name => escapeHtml(String(name || "").split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase());
  const productCard = product => {
    const harvested = new Date(`${product.harvest}T12:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
    const available = product.status === "active" && Number(product.quantity) > 0;
    return `<article class="product-card"><div class="product-photo"><a class="product-photo-link" href="#product/${encodeURIComponent(product.id)}"><img src="${escapeHtml(product.photoUrl || fallbackPhoto)}" onerror="this.onerror=null;this.src='${fallbackPhoto}'" alt="${escapeHtml(product.name)}" loading="lazy"></a><span class="photo-tag">${escapeHtml(product.category)}</span><button class="save-button" type="button" title="Save ${escapeHtml(product.name)}" data-save="${escapeHtml(product.id)}">♡</button></div><div class="product-card-body"><div class="product-title-row"><h3>${escapeHtml(product.name)}</h3><span class="price">${money(product.price)}<small> / ${escapeHtml(product.unit)}</small></span></div><p class="product-meta">${escapeHtml(product.location)}, Marinduque · ${Number(product.quantity)} ${escapeHtml(product.unit)} available</p><p class="farmer-line">Grown by <strong>${escapeHtml(product.farmer)}</strong></p><div class="product-listing-meta"><span>Harvested ${escapeHtml(harvested)}</span><span class="status-pill ${available ? "active" : "inactive"}">${available ? "Available" : "Unavailable"}</span></div><div class="product-card-actions">${link(`product/${product.id}`, "View details", "text-link")}<button class="button button-small button-outline" data-inquiry="${escapeHtml(product.id)}">Send inquiry</button></div></div></article>`;
  };

  function renderPrices() {
    const categories = [...new Set(state.prices.map(price => price.category))];
    const locations = [...new Set(state.prices.map(price => price.location))];
    app.innerHTML = pageWrap(`<section class="page-hero compact-hero"><div class="container"><p class="eyebrow">INFORMATION FOR BETTER CONVERSATIONS</p><h1>Agricultural <em>market prices.</em></h1><p>Browse dated price references with their sources. Sample values are not verified or official quotations.</p></div></section><section class="section prices-section"><div class="container">${state.error ? `<div class="notice-banner"><span>!</span><p>${escapeHtml(state.error)}</p></div>` : ""}<div class="notice-banner"><span>i</span><p><strong>Check the source and date.</strong> Sample records are explicitly identified; confirm prices with a verified source before making decisions.</p></div><div class="price-summary"><article><span>PRICE RECORDS</span><strong>${state.prices.length}</strong><small>Database records</small></article><article><span>LOCATIONS</span><strong>${locations.length}</strong><small>Market areas</small></article><article><span>SAMPLE RECORDS</span><strong>${state.prices.filter(price => price.sample).length}</strong><small>Illustrative, unverified values</small></article></div><div class="market-tools price-tools"><label class="search-field"><input id="backend-price-search" placeholder="Search products..." aria-label="Search prices"></label><label class="select-field"><span>Category</span><select id="backend-price-category"><option value="">All categories</option>${categories.map(item => `<option>${escapeHtml(item)}</option>`).join("")}</select></label><label class="select-field"><span>Location</span><select id="backend-price-location"><option value="">All municipalities</option>${locations.map(item => `<option>${escapeHtml(item)}</option>`).join("")}</select></label></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Agricultural product</th><th>Price per unit</th><th>Unit</th><th>Location</th><th>Source</th><th>Date recorded</th></tr></thead><tbody id="backend-price-rows">${priceRows()}</tbody></table></div></div></section>`);
  }
  function renderMarketplace() {
    const categories = [...new Set(state.products.map(product => product.category))];
    const locations = [...new Set(state.products.map(product => product.location))];
    app.innerHTML = pageWrap(`<section class="page-hero compact-hero"><div class="container"><p class="eyebrow">FROM LOCAL FARMS</p><h1>Discover what's <em>growing.</em></h1><p>Browse active harvest listings and connect directly with farmers.</p></div></section><section class="section marketplace-section"><div class="container">${state.error ? `<div class="notice-banner"><span>!</span><p>${escapeHtml(state.error)}</p></div>` : ""}<div class="notice-banner"><span>i</span><p><strong>Demonstration listings.</strong> Sample prices and quantities are fictional and are not current or verified market quotations.</p></div><div class="market-tools"><label class="search-field"><input id="product-search" placeholder="Search products or farmers..." aria-label="Search products"></label><label class="select-field"><span>Category</span><select id="category-filter"><option>All categories</option>${categories.map(item => `<option>${escapeHtml(item)}</option>`).join("")}</select></label><label class="select-field"><span>Municipality</span><select id="location-filter"><option>All municipalities</option>${locations.map(item => `<option>${escapeHtml(item)}</option>`).join("")}</select></label><label class="select-field"><span>Sort by</span><select id="sort-products"><option>Featured</option><option>Price: low to high</option><option>Price: high to low</option><option>Name: A to Z</option></select></label><label class="price-range-field"><span>Price range (₱)</span><div><input id="price-min" type="number" min="0" placeholder="Min" aria-label="Minimum price"><i>–</i><input id="price-max" type="number" min="0" placeholder="Max" aria-label="Maximum price"></div></label></div><div class="results-line"><span id="results-count">${state.products.length} listings</span></div><div id="product-results" class="product-grid">${state.products.map(productCard).join("") || '<div class="empty-state"><h3>No active listings yet</h3><p>Check again later or join as a farmer to post a harvest.</p></div>'}</div></div></section>`);
  }
  function renderProductDetail(id) {
    const product = state.products.find(item => item.id === String(id));
    if (!product) {
      app.innerHTML = pageWrap(`<section class="section container"><div class="empty-state"><h2>${state.error ? "Product information is unavailable" : "Product not found"}</h2><p>${escapeHtml(state.error)}</p>${link("marketplace", "Back to marketplace", "button")}</div></section>`);
      return;
    }
    const harvest = new Date(`${product.harvest}T12:00:00`).toLocaleDateString();
    app.innerHTML = pageWrap(`<section class="section product-detail-section"><div class="container"><div class="breadcrumbs">${link("marketplace", "Marketplace")} <span>/</span> ${escapeHtml(product.category)} <span>/</span> ${escapeHtml(product.name)}</div><div class="product-detail"><div class="detail-image"><img src="${escapeHtml(product.photoUrl || fallbackPhoto)}" onerror="this.onerror=null;this.src='${fallbackPhoto}'" alt="${escapeHtml(product.name)}"></div><div class="detail-copy"><p class="eyebrow">LOCAL HARVEST · DEMO LISTING</p><h1>${escapeHtml(product.name)}</h1><p class="detail-price">${money(product.price)} <span>/ ${escapeHtml(product.unit)}</span></p><p>${escapeHtml(product.description)}</p><div class="detail-facts"><div><span>AVAILABLE</span><strong>${product.quantity} ${escapeHtml(product.unit)}</strong></div><div><span>GROWN IN</span><strong>${escapeHtml(product.location)}, Marinduque</strong></div><div><span>HARVEST DATE</span><strong>${escapeHtml(harvest)}</strong></div></div><div class="farmer-profile-mini"><span class="farmer-avatar">${initials(product.farmer)}</span><span><small>LISTED BY</small><strong>${escapeHtml(product.farmer)}</strong><small>Local farmer</small></span></div><div class="product-card-actions"><button class="button" type="button" data-inquiry="${escapeHtml(product.id)}">Send an inquiry</button><button class="button button-outline" type="button" data-report-product="${escapeHtml(product.id)}">Report listing</button></div><p class="form-note">The demonstration prices are fictional, not verified market rates.</p></div></div></div></section>`);
    if (location.hash.includes("inquiry=1")) {
      document.getElementById("inquiry-dialog")?.remove();
      window.setTimeout(() => showInquiry(product.id), 0);
    }
  }
  function renderAuth(kind) {
    const login = kind === "login";
    app.innerHTML = `<div class="auth-layout"><div class="auth-aside"><a class="brand brand-light" href="#home"><span class="brand-mark">${icon}</span><span class="brand-name">ani<span>link</span><small>GROWN TOGETHER</small></span></a><div class="auth-aside-copy"><p class="eyebrow">MARINDUQUE, PHILIPPINES</p><h2>Good things grow<br><em>when we connect.</em></h2><p>Connect local farmers, buyers, and agricultural communities.</p></div><img src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1000&q=85" alt="Fields at golden hour"><span class="auth-aside-label">LOCAL HARVESTS · BETTER CONNECTIONS</span></div><div class="auth-content"><div class="auth-topline">Ready to explore? ${link("home", "Back to AniLink")}</div><div class="auth-form-wrap"><span class="card-kicker">${login ? "WELCOME BACK" : "LET'S GROW TOGETHER"}</span><h1>${login ? "Sign in to AniLink" : "Create your account"}</h1><p>${login ? "Sign in to open your workspace." : "Create a Farmer or Buyer account."}</p><form class="auth-form" id="auth-form" data-auth="${kind}">${login ? '<label>Email address<input name="identity" type="email" required autocomplete="username" placeholder="you@example.com"></label>' : `<label>Full name<input name="name" required maxlength="120" autocomplete="name"></label><label>Email address<input name="email" type="email" required autocomplete="email"></label><label>Contact number<input name="phone" type="tel" required></label><label>Municipality<select name="location" required><option value="">Choose your municipality</option>${["Boac", "Buenavista", "Gasan", "Mogpog", "Santa Cruz", "Torrijos"].map(item => `<option>${item}</option>`).join("")}</select></label><label>Account type<select name="role" required><option value="">Choose account type</option><option value="farmer">Farmer</option><option value="buyer">Buyer</option></select></label>`}<label>Password<input name="password" type="password" required minlength="8" maxlength="72" autocomplete="${login ? "current-password" : "new-password"}"></label>${login ? `<div class="auth-options"><a href="#forgot-password">Forgot password?</a></div>` : '<label>Confirm password<input name="confirmPassword" type="password" required minlength="8" maxlength="72" autocomplete="new-password"></label><label class="checkbox-label terms-label"><input type="checkbox" name="terms" required> I agree to the terms and conditions.</label>'}<button class="button auth-submit" type="submit">${login ? "Sign in" : "Create account"}</button></form><p class="auth-switch">${login ? `New to AniLink? ${link("register", "Create an account")}` : `Already have an account? ${link("login", "Sign in")}`}</p></div><p class="auth-copyright">© 2026 AniLink · Local agriculture in Marinduque</p></div></div>`;
  }
  function updateExistingHeader() {
    const actions = document.querySelector(".header-actions");
    if (actions) {
      actions.innerHTML = state.user
        ? `${link(`${state.user.role}/dashboard`, "My workspace", "header-login")}<button class="button button-small" data-logout>Log out</button>`
        : `${link("login", "Log in", "header-login")}${link("register", "Join AniLink", "button button-small")}`;
    }
    const farmerLink = document.querySelector('.site-footer a[href="#farmer/dashboard"]');
    if (farmerLink && state.user) {
      farmerLink.href = `#${state.user.role}/dashboard`;
      farmerLink.textContent = "Open my workspace";
    }
  }
  function priceRows() {
    const query = (document.getElementById("backend-price-search")?.value || "").toLowerCase();
    const category = document.getElementById("backend-price-category")?.value || "";
    const location = document.getElementById("backend-price-location")?.value || "";
    const rows = state.prices.filter(price => (!category || price.category === category) && (!location || price.location === location)
      && `${price.product} ${price.category} ${price.location} ${price.source}`.toLowerCase().includes(query));
    return rows.length ? rows.map(price => `<tr><td><strong>${escapeHtml(price.product)}</strong>${price.sample ? ' <span class="source-pill">Sample</span>' : ""}</td><td>${money(price.reference)}</td><td>${escapeHtml(price.unit)}</td><td>${escapeHtml(price.location)}</td><td>${escapeHtml(price.source)}</td><td>${escapeHtml(price.date)}</td></tr>`).join("") : '<tr><td colspan="6" class="table-empty">No price records match those filters.</td></tr>';
  }

  const farmerNav = [["dashboard", "Overview"], ["products", "My products"], ["add-product", "Add product"], ["inquiries", "Buyer inquiries"], ["messages", "Messages"], ["notifications", "Notifications"], ["prices", "Market prices"], ["profile", "My profile"]];
  const buyerNav = [["dashboard", "Overview"], ["browse-products", "Browse products"], ["my-inquiries", "My inquiries"], ["messages", "Messages"], ["notifications", "Notifications"], ["prices", "Market prices"], ["profile", "My profile"]];
  const adminNav = [["dashboard", "Overview"], ["users", "User management"], ["products", "Product listings"], ["reports", "Reported content"], ["announcements", "Announcements"], ["market-prices", "Market prices"], ["settings", "Settings"]];
  function workspace(role, page, content) {
    const menus = role === "farmer" ? farmerNav : role === "buyer" ? buyerNav : adminNav;
    const menuIcons = { dashboard: "⌂", products: "▦", "add-product": "+", inquiries: "↗", "my-inquiries": "↗", messages: "✉", notifications: "♧", prices: "◷", profile: "♙", "browse-products": "⌕", users: "♙", reports: "⚑", announcements: "▤", "market-prices": "◷", settings: "⚙" };
    const label = `${role[0].toUpperCase()}${role.slice(1)} workspace`;
    const unreadMessages = state.conversations.reduce((total, item) => total + Number(item.unreadCount || 0), 0);
    const unreadNotifications = state.notifications.filter(item => !Number(item.isRead)).length;
    const profilePage = role === "admin" ? "settings" : "profile";
    app.innerHTML = `<div class="dashboard-layout"><aside class="dashboard-sidebar"><a class="brand" href="#home"><span class="brand-mark">${icon}</span><span class="brand-name">ani<span>link</span><small>GROWN TOGETHER</small></span></a><span class="workspace-label">${escapeHtml(label)}</span><nav aria-label="${escapeHtml(role)} dashboard">${menus.map(([slug, title]) => { const count = slug === "messages" ? unreadMessages : slug === "notifications" ? unreadNotifications : 0; const active = page === slug; return `<a class="${active ? "active" : ""}" href="#${role}/${slug}"${active ? ' aria-current="page"' : ""}><span aria-hidden="true">${menuIcons[slug] || "·"}</span>${escapeHtml(title)}${count ? `<small class="nav-unread" data-nav-count="${slug}" aria-label="${count} unread">${count}</small>` : ""}</a>`; }).join("")}</nav><div class="sidebar-bottom"><div class="demo-profile"><span class="farmer-avatar">${initials(state.user.name)}</span><span><strong>${escapeHtml(state.user.name)}</strong><small>${escapeHtml(role)}</small></span></div><a class="sidebar-logout" href="#home">↗ <span>Back to website</span></a><button class="sidebar-logout" data-logout>↗ <span>Log out</span></button></div></aside><button class="sidebar-overlay" type="button" aria-label="Close dashboard navigation"></button><div class="dashboard-main"><header class="dashboard-topbar"><button class="mobile-menu dash-menu" data-backend-dash-menu aria-label="Open dashboard navigation" aria-expanded="false">☰</button><span>${escapeHtml(label)}</span><div class="topbar-actions"><a class="notification-shortcut" href="#${role}/notifications" aria-label="Notifications${unreadNotifications ? `, ${unreadNotifications} unread` : ""}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4" /></svg>${unreadNotifications ? `<small>${unreadNotifications}</small>` : ""}</a><a class="topbar-profile" href="#${role}/${profilePage}" aria-label="${escapeHtml(state.user.name)} profile"><span class="farmer-avatar small-avatar">${initials(state.user.name)}</span><span class="topbar-profile-copy"><strong>${escapeHtml(state.user.name)}</strong><small>${escapeHtml(role)}</small></span></a></div></header><main class="dashboard-content">${content}</main></div></div>`;
  }
  function farmerWorkspace(page) {
    const products = state.products;
    const active = products.filter(product => product.status === "active");
    const inquiries = state.inquiries;
    let content = "";
    if (page === "dashboard") {
      content = `${pageTitle("YOUR FARM", `Welcome, ${state.user.name}`, "Manage your listings and keep up with buyer inquiries.", link("farmer/add-product", "＋ Add a product", "button button-small"))}<div class="stats-grid">${stat("Total listings", products.length)}${stat("Active listings", active.length)}${stat("Inactive listings", products.length - active.length)}${stat("Pending inquiries", inquiries.filter(item => item.status === "Pending").length)}</div><section class="dash-panel"><div class="panel-heading"><h2>Recent inquiries</h2>${link("farmer/inquiries", "See all", "inline-button")}</div>${inquiries.slice(0, 5).map(inquiryRow).join("") || empty("No buyer inquiries yet.")}</section><section class="dash-panel"><div class="panel-heading"><h2>Your listings</h2>${link("farmer/products", "Manage products", "inline-button")}</div>${productTable(products, false)}</section>`;
    } else if (page === "products") {
      content = `${pageTitle("YOUR FARM", "My products", "Edit your listings or deactivate products that are no longer available.", link("farmer/add-product", "＋ Add product", "button button-small"))}<section class="dash-panel">${productTable(products, true)}</section>`;
    } else if (page === "add-product" || page === "edit-product") {
      const editing = page === "edit-product" ? products.find(product => product.id === location.hash.split("/")[2]?.split("?")[0]) : null;
      content = `${pageTitle("YOUR FARM", editing ? "Edit product" : "Add a product", "Share accurate details about your harvest.")}${editing || page === "add-product" ? productForm(editing) : empty("This listing was not found or is not yours.")}`;
    } else if (page === "inquiries") {
      content = `${pageTitle("BUYER CONNECTIONS", "Buyer inquiries", "Review inquiries for your product listings.")}<section class="dash-panel">${inquiries.map(inquiryRow).join("") || empty("No buyer inquiries yet.")}</section>`;
    } else if (page === "messages") {
      content = messagingPage();
    } else if (page === "notifications") {
      content = notificationsPage();
    } else if (page === "prices") {
      content = `${pageTitle("MARKET INFORMATION", "Market prices", "View sourced references; sample rows are not verified market data.")}${marketPriceList()}`;
    } else {
      content = `${pageTitle("YOUR ACCOUNT", "My profile", "Account details associated with your signed-in account.")}<section class="dash-panel profile-card"><span class="farmer-avatar profile-avatar">${initials(state.user.name)}</span><div><h2>${escapeHtml(state.user.name)}</h2><p>${escapeHtml(state.user.role)} · ${escapeHtml(state.user.location)}</p><p>${escapeHtml(state.user.email)}</p></div></section>`;
    }
    workspace("farmer", page, content);
  }
  function buyerWorkspace(page) {
    let content = "";
    if (page === "dashboard") {
      content = `${pageTitle("YOUR ACCOUNT", `Welcome, ${state.user.name}`, "Find local suppliers and follow the status of your inquiries.", link("buyer/browse-products", "Browse products", "button button-small"))}<div class="stats-grid">${stat("Available listings", state.products.length)}${stat("Your inquiries", state.inquiries.length)}${stat("Pending replies", state.inquiries.filter(item => item.status === "Pending").length)}</div><section class="dash-panel"><div class="panel-heading"><h2>Recently listed products</h2>${link("buyer/browse-products", "Browse all", "inline-button")}</div><div class="product-grid">${state.products.slice(0, 3).map(productCard).join("") || empty("No active products are listed yet.")}</div></section><section class="dash-panel"><div class="panel-heading"><h2>Recent inquiries</h2>${link("buyer/my-inquiries", "See all", "inline-button")}</div>${state.inquiries.slice(0, 4).map(inquiryRow).join("") || empty("You have not sent any inquiries yet.")}</section>`;
    } else if (page === "browse-products") {
      content = `${pageTitle("LOCAL MARKETPLACE", "Browse products", "Browse currently active farm listings.")}<div class="product-grid">${state.products.map(productCard).join("") || empty("No active products are listed yet.")}</div>`;
    } else if (page === "my-inquiries") {
      content = `${pageTitle("YOUR CONVERSATIONS", "My inquiries", "Track responses from farmers.")}<section class="dash-panel">${state.inquiries.map(inquiryRow).join("") || empty("You have not sent any inquiries yet.")}</section>`;
    } else if (page === "messages") {
      content = messagingPage();
    } else if (page === "notifications") {
      content = notificationsPage();
    } else if (page === "prices") {
      content = `${pageTitle("MARKET INFORMATION", "Market prices", "View sourced references; sample rows are not verified market data.")}${marketPriceList()}`;
    } else {
      content = `${pageTitle("YOUR ACCOUNT", "My profile", "Account details associated with your signed-in account.")}<section class="dash-panel profile-card"><span class="farmer-avatar profile-avatar">${initials(state.user.name)}</span><div><h2>${escapeHtml(state.user.name)}</h2><p>${escapeHtml(state.user.role)} · ${escapeHtml(state.user.location)}</p><p>${escapeHtml(state.user.email)}</p></div></section>`;
    }
    workspace("buyer", page, content);
  }
  function adminWorkspace(page) {
    let content = "";
    if (page === "dashboard") {
      const stats = state.stats;
      const pendingReports = Number(stats.reported_content || state.reports.filter(item => ["Pending", "Under Review"].includes(item.status)).length);
      const publishedAnnouncements = Number(stats.published_announcements || state.announcements.filter(item => item.status === "Published").length);
      const pendingProducts = Number(stats.pending_products || 0);
      const unreadInquiries = Number(stats.unread_inquiries || state.inquiries.filter(item => item.status === "Pending").length);
      content = `${pageTitle("PLATFORM OVERVIEW", "Administrator dashboard", "Live totals from the AniLink database.")}<div class="stats-grid admin-stats-grid">${stat("Registered users", stats.users || 0)}${stat("Farmers", stats.farmers || 0)}${stat("Buyers", stats.buyers || 0)}${stat("Product listings", stats.products || 0)}${stat("Pending reviews", pendingProducts)}${stat("Reported content", pendingReports)}${stat("Unread inquiries", unreadInquiries)}${stat("Published announcements", publishedAnnouncements)}</div><section class="dash-panel"><div class="panel-heading"><h2>Recent activity</h2></div><div class="activity-list">${state.activities.slice(0, 10).map(item => `<div class="activity-item"><span>↗</span><p>${escapeHtml(item.actor || "System")} · ${escapeHtml(item.action)} ${escapeHtml(item.details)}<small>${escapeHtml(new Date(item.createdAt).toLocaleString())}</small></p></div>`).join("") || empty("No activity recorded yet.")}</div></section>`;
    } else if (page === "users") {
      content = `${pageTitle("COMMUNITY", "User management", "Activate or deactivate Farmer and Buyer accounts.")}<section class="dash-panel"><label class="search-field compact-search"><input id="backend-user-search" placeholder="Search users..." aria-label="Search users"></label>${userTable(state.users)}</section>`;
    } else if (page === "products") {
      content = `${pageTitle("CATALOG", "Product listings", "Moderate listings across the platform.")}<section class="dash-panel">${adminProductTable(state.products)}</section>`;
    } else if (page === "reports") {
      content = `${pageTitle("COMMUNITY SAFETY", "Reported content", "Review submissions, investigate concerns, and record resolution outcomes.")}<section class="dash-panel">${reportTable(state.reports)}</section>`;
    } else if (page === "announcements") {
      content = `${pageTitle("COMMUNITY UPDATES", "Announcements", "Create, edit, publish, and archive important notices.", `<button class="button button-small" data-announcement-new>＋ New announcement</button>`)}<section class="dash-panel">${announcementTable(state.announcements)}</section>`;
    } else if (page === "settings") {
      content = `${pageTitle("ADMIN SETTINGS", "Administrator profile", "Review your access, role protections, and session status.")}<section class="dash-panel profile-card"><span class="farmer-avatar profile-avatar">${initials(state.user.name)}</span><div><h2>${escapeHtml(state.user.name)}</h2><p>${escapeHtml(state.user.role)} · Administrator</p><p>${escapeHtml(state.user.email)}</p><p class="form-note">Session-based authorization is enforced on the PHP backend. Administrative actions require a valid CSRF token and role verification.</p></div></section>`;
    } else {
      content = `${pageTitle("MARKET INFORMATION", "Market price management", "Maintain sourced, dated price references. Mark illustrative records as samples.", `<button class="button button-small" data-price-edit>＋ Add price</button>`)}<div class="notice-banner"><span>i</span><p>Do not publish unverified market data as factual. Always record the source and date.</p></div><section class="dash-panel">${adminPriceTable()}</section>`;
    }
    workspace("admin", page, content);
  }
  const stat = (label, value) => `<article class="stat-card"><span class="stat-label">${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`;
  const empty = text => `<div class="empty-state"><p>${escapeHtml(text)}</p></div>`;
  function productTable(products, controls) {
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Product</th><th>Category</th><th>Quantity</th><th>Asking price</th><th>Location</th><th>Status</th>${controls ? "<th>Actions</th>" : ""}</tr></thead><tbody>${products.map(product => `<tr><td><strong>${escapeHtml(product.name)}</strong></td><td>${escapeHtml(product.category)}</td><td>${product.quantity} ${escapeHtml(product.unit)}</td><td>${money(product.price)} / ${escapeHtml(product.unit)}</td><td>${escapeHtml(product.location)}</td><td>${status(product.status)}</td>${controls ? `<td><button class="inline-button" data-product-edit="${escapeHtml(product.id)}">Edit</button> <button class="inline-button danger" data-product-delete="${escapeHtml(product.id)}">Deactivate</button></td>` : ""}</tr>`).join("")}</tbody></table></div>`;
  }
  function adminProductTable(products) {
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Product</th><th>Farmer</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead><tbody>${products.map(product => `<tr><td>${escapeHtml(product.name)}</td><td>${escapeHtml(product.farmer)}</td><td>${escapeHtml(product.location)}</td><td>${status(product.status)}</td><td>${product.status === "active" ? `<button class="inline-button danger" data-admin-product="${escapeHtml(product.id)}" data-status="removed">Remove</button>` : `<button class="inline-button" data-admin-product="${escapeHtml(product.id)}" data-status="active">Reactivate</button>`}</td></tr>`).join("") || '<tr><td colspan="5">No listings found.</td></tr>'}</tbody></table></div>`;
  }
  function userTable(users) {
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Location</th><th>Status</th><th>Action</th></tr></thead><tbody>${users.map(user => `<tr><td>${escapeHtml(user.name)}</td><td>${escapeHtml(user.email)}</td><td>${escapeHtml(user.type)}</td><td>${escapeHtml(user.location)}</td><td>${status(user.status)}</td><td>${user.type !== "admin" ? `<button class="inline-button" data-user-status="${user.id}" data-active="${user.status !== "Active"}">${user.status === "Active" ? "Deactivate" : "Activate"}</button>` : "—"}</td></tr>`).join("")}</tbody></table></div>`;
  }
  function reportTable(reports) {
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Reporter</th><th>Title</th><th>Category</th><th>Product</th><th>Status</th><th>Action</th></tr></thead><tbody>${reports.map(report => `<tr><td>${escapeHtml(report.reporter || "Unknown")}</td><td><strong>${escapeHtml(report.title)}</strong><br><small>${escapeHtml(report.description)}</small></td><td>${escapeHtml(report.category)}</td><td>${escapeHtml(report.productName || "—")}</td><td>${status(report.status)}</td><td><label class="select-field compact-select"><select data-report-status="${escapeHtml(report.id)}">${["Pending", "Under Review", "Resolved", "Dismissed"].map(value => `<option ${report.status === value ? "selected" : ""}>${value}</option>`).join("")}</select></label></td></tr>`).join("") || '<tr><td colspan="6">No reports recorded yet.</td></tr>'}</tbody></table></div>`;
  }
  function announcementTable(announcements) {
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Title</th><th>Category</th><th>Audience</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead><tbody>${announcements.map(item => `<tr><td><strong>${escapeHtml(item.title)}</strong><br><small>${escapeHtml(item.content.slice(0, 90))}${item.content.length > 90 ? "…" : ""}</small></td><td>${escapeHtml(item.category)}</td><td>${escapeHtml(item.audience)}</td><td>${status(item.status)}</td><td>${escapeHtml(new Date(item.createdAt || item.publishedAt || Date.now()).toLocaleDateString())}</td><td><button class="inline-button" data-announcement-edit="${escapeHtml(item.id)}">Edit</button> <button class="inline-button danger" data-announcement-delete="${escapeHtml(item.id)}">Delete</button></td></tr>`).join("") || '<tr><td colspan="6">No announcements saved yet.</td></tr>'}</tbody></table></div>`;
  }
  function inquiryRow(inquiry) {
    const contact = state.user.role === "farmer" ? `Buyer: ${inquiry.buyer}` : `Farmer: ${inquiry.farmer || "Local farmer"}`;
    const quantity = inquiry.quantity == null ? "Quantity not specified" : `${escapeHtml(inquiry.quantity)} ${escapeHtml(inquiry.unit)}`;
    const controls = state.user.role === "farmer" ? `<label class="select-field"><span>Update status</span><select data-inquiry-status="${escapeHtml(inquiry.id)}">${["Pending", "Responded", "Accepted", "Declined", "Closed"].map(value => `<option ${inquiry.status === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>` : "";
    const conversation = inquiry.conversationId
      ? link(`${state.user.role}/messages/${encodeURIComponent(inquiry.conversationId)}`, "Open conversation", "inline-button")
      : "";
    return `<div class="inquiry-mini inquiry-wide"><span class="farmer-avatar">${initials(state.user.role === "farmer" ? inquiry.buyer : inquiry.farmer)}</span><div><strong>${escapeHtml(inquiry.subject || inquiry.product)}</strong><small>${escapeHtml(inquiry.product)} · ${escapeHtml(contact)} · ${escapeHtml(inquiry.date)}<br>${quantity} · ${escapeHtml(inquiry.message)}</small></div>${status(inquiry.status)}${controls}${conversation}</div>`;
  }
  const dateTime = value => {
    const date = new Date(String(value || "").replace(" ", "T"));
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
  };
  function conversationList() {
    const selectedId = route().split("/")[2] || "";
    const query = (document.getElementById("conversation-search")?.value || "").trim().toLowerCase();
    const rows = state.conversations.filter(item =>
      `${item.participant} ${item.product} ${item.subject} ${item.lastMessage}`.toLowerCase().includes(query)
    );
    if (!rows.length) return `<div class="conversation-list-empty">${empty(state.conversations.length ? "No conversations match your search." : "No conversations yet. Send a product inquiry to connect with a farmer.")}</div>`;
    return rows.map(item => {
      const unread = Number(item.unreadCount || 0);
      return `<a class="conversation-item ${String(item.id) === selectedId ? "selected" : ""}" href="#${state.user.role}/messages/${encodeURIComponent(item.id)}" data-conversation-id="${escapeHtml(item.id)}"><span class="farmer-avatar conversation-avatar" aria-hidden="true">${initials(item.participant)}</span><span class="conversation-summary"><strong>${escapeHtml(item.participant)}</strong><small>${escapeHtml(item.product)} · ${escapeHtml(item.subject)}</small><span>${escapeHtml(item.lastMessage || "")}</span></span><span class="conversation-meta">${unread ? `<b aria-label="${unread} unread messages">${unread}</b>` : ""}<small>${escapeHtml(dateTime(item.lastMessageAt))}</small></span></a>`;
    }).join("");
  }
  function messageHistory() {
    if (state.messageError) return empty(state.messageError);
    if (!state.messages.length) return empty("No messages in this conversation yet.");
    return state.messages.map(message => {
      const own = Number(message.senderId) === Number(state.user.id);
      return `<article class="message-bubble ${own ? "sent" : "received"}"><strong>${escapeHtml(message.sender)} <span>${own ? "· You" : ""}</span></strong><p>${escapeHtml(message.body)}</p><small>${escapeHtml(dateTime(message.createdAt))}</small></article>`;
    }).join("");
  }
  function messagingPage() {
    const selectedId = route().split("/")[2] || "";
    const selected = state.conversations.find(item => String(item.id) === selectedId);
    const peerRole = state.user.role === "buyer" ? "Farmer" : "Buyer";
    const backLink = `<a class="conversation-back" href="#${state.user.role}/messages" aria-label="Back to conversations"><span aria-hidden="true">←</span> Conversations</a>`;
    if (!state.conversations.length) {
      const emptyMessage = state.user.role === "buyer"
        ? "You don't have any conversations yet. Browse agricultural products and send an inquiry to connect with farmers."
        : "You don't have any buyer conversations yet. New product inquiries will appear here.";
      const browseLink = state.user.role === "buyer" ? link("buyer/browse-products", "Browse products", "button button-small") : "";
      return `${pageTitle("PRIVATE MESSAGES", "Messages", "Keep product inquiries and replies together.")}<section class="dash-panel">${empty(emptyMessage)}${browseLink}</section>`;
    }
    return `${pageTitle("PRIVATE MESSAGES", "Messages", `Signed in as ${escapeHtml(state.user.name)} · ${escapeHtml(state.user.role === "buyer" ? "Buyer" : "Farmer")}. Keep product inquiries and replies together.`)}<section class="messages-layout ${selected ? "has-active" : ""}"><aside class="messages-panel conversation-sidebar"><div class="conversation-list-heading"><div><strong>Your conversations</strong><small>${state.conversations.length} ${state.conversations.length === 1 ? "conversation" : "conversations"}</small></div></div><label class="search-field conversation-search"><input id="conversation-search" type="search" placeholder="Search people or products..." aria-label="Search conversations"></label><div id="conversation-list">${conversationList()}</div></aside><section class="messages-panel conversation-detail">${selected ? `<header class="conversation-header"><div class="conversation-person"><span class="farmer-avatar conversation-avatar" aria-hidden="true">${initials(selected.participant)}</span><div><strong>${escapeHtml(selected.participant)}</strong><small>${peerRole} · ${escapeHtml(selected.subject)}</small></div></div><div class="conversation-header-actions">${status(selected.status)}<a class="conversation-product-link" href="#product/${encodeURIComponent(selected.productId)}" aria-label="View ${escapeHtml(selected.product)} listing"><span aria-hidden="true">▧</span> ${escapeHtml(selected.product)} <span aria-hidden="true">↗</span></a>${backLink}</div></header><div class="message-history" id="message-history" aria-live="polite">${messageHistory()}</div><form class="message-composer" id="message-form" data-conversation-id="${escapeHtml(selected.id)}"><label class="visually-hidden" for="message-input">Write a message</label><textarea id="message-input" name="message" rows="1" maxlength="2000" required placeholder="Message ${escapeHtml(selected.participant)}..." aria-label="Write a message"></textarea><button class="button button-small message-send-button" type="submit" aria-label="Send message"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 4l-5 16-3-7-8-1Zm8 1 8-9" /></svg><span>Send</span></button><small class="composer-hint">Enter to send · Shift + Enter for a new line</small></form>` : `<div class="conversation-placeholder"><span>↗</span><h2>Select a conversation</h2><p>Choose an inquiry to view its message history and reply.</p></div>`}</section></section>`;
  }
  function notificationsPage() {
    const unread = state.notifications.filter(item => !Number(item.isRead)).length;
    const action = unread ? `<button class="button button-outline button-small" data-notifications-read-all>Mark all as read</button>` : "";
    return `${pageTitle("UPDATES", "Notifications", "Inquiry, reply, and status updates from your conversations.", action)}<section class="dash-panel notification-list"><div id="notification-items">${notificationRows()}</div></section>`;
  }
  function notificationRows() {
    return state.notifications.map(item => `<article class="notification-item ${Number(item.isRead) ? "" : "unread"}"><span class="notification-type">${item.type === "message" ? "↗" : item.type === "status" ? "✓" : "✳"}</span><div><strong>${escapeHtml(item.content)}</strong><small>${escapeHtml(dateTime(item.createdAt))}</small></div>${item.conversationId ? `<button class="inline-button" data-notification-id="${escapeHtml(item.id)}" data-conversation-id="${escapeHtml(item.conversationId)}">${Number(item.isRead) ? "Open" : "Read & open"}</button>` : ""}</article>`).join("") || empty("You don't have any notifications yet. New inquiries and replies will appear here.");
  }
  function updateMessageBadges() {
    const unreadMessages = state.conversations.reduce((total, item) => total + Number(item.unreadCount || 0), 0);
    const unreadNotifications = state.notifications.filter(item => !Number(item.isRead)).length;
    for (const [slug, count] of [["messages", unreadMessages], ["notifications", unreadNotifications]]) {
      const linkElement = document.querySelector(`.dashboard-sidebar nav a[href="#${state.user.role}/${slug}"]`);
      if (!linkElement) continue;
      let badge = linkElement.querySelector(".nav-unread");
      if (!count) {
        badge?.remove();
      } else if (badge) {
        badge.textContent = String(count);
      } else {
        badge = document.createElement("small");
        badge.className = "nav-unread";
        badge.textContent = String(count);
        linkElement.append(badge);
      }
    }
    const shortcut = document.querySelector(".notification-shortcut");
    if (shortcut) {
      let badge = shortcut.querySelector("small");
      if (!unreadNotifications) {
        badge?.remove();
      } else if (badge) {
        badge.textContent = String(unreadNotifications);
      } else {
        badge = document.createElement("small");
        badge.textContent = String(unreadNotifications);
        shortcut.append(badge);
      }
    }
  }
  async function pollMessages() {
    const currentRoute = route().split("/");
    if (!state.user || currentRoute[0] !== state.user.role || !["buyer", "farmer"].includes(state.user.role)) return;
    try {
      const [conversations, notifications] = await Promise.all([
        api("conversations"),
        api("notifications")
      ]);
      state.conversations = conversations.data;
      state.notifications = notifications.data;
      const conversationId = currentRoute[1] === "messages" ? currentRoute[2] : "";
      if (conversationId) {
        const messages = await api("conversation-messages", { query: `&id=${encodeURIComponent(conversationId)}` });
        if (route().split("/").slice(0, 3).join("/") !== currentRoute.slice(0, 3).join("/")) return;
        state.messages = messages.data;
        const updatedNotifications = await api("notifications");
        state.notifications = updatedNotifications.data;
        state.conversations = state.conversations.map(item =>
          String(item.id) === conversationId ? { ...item, unreadCount: 0 } : item
        );
        const history = document.getElementById("message-history");
        if (history) {
          const atBottom = history.scrollHeight - history.scrollTop - history.clientHeight < 80;
          history.innerHTML = messageHistory();
          if (atBottom) history.scrollTop = history.scrollHeight;
        }
      }
      const list = document.getElementById("conversation-list");
      if (list) list.innerHTML = conversationList();
      const selectedConversation = state.conversations.find(item => String(item.id) === conversationId);
      const conversationStatus = document.querySelector(".conversation-header-actions .status-pill");
      if (selectedConversation && conversationStatus) {
        conversationStatus.className = `status-pill ${String(selectedConversation.status).toLowerCase()}`;
        conversationStatus.textContent = selectedConversation.status;
      }
      const notificationList = document.getElementById("notification-items");
      if (notificationList) notificationList.innerHTML = notificationRows();
      updateMessageBadges();
    } catch (error) {
      notify(error.message);
    }
  }
  function productForm(product) {
    const categories = ["Fruit", "Vegetables", "Grains", "Coconut", "Root crops", "Other"];
    const municipalities = ["Boac", "Buenavista", "Gasan", "Mogpog", "Santa Cruz", "Torrijos"];
    const units = ["kg", "piece", "sack", "bundle", "crate"];
    return `<form class="dash-panel product-form" id="backend-product-form" data-id="${product ? escapeHtml(product.id) : ""}" enctype="multipart/form-data"><div class="form-grid"><label>Product name<input name="name" required maxlength="120" value="${product ? escapeHtml(product.name) : ""}"></label><label>Category<select name="category" required>${categories.map(item => `<option ${product && product.category === item ? "selected" : ""}>${item}</option>`).join("")}</select></label><label class="full-field">Description<textarea name="description" rows="3" required maxlength="3000">${product ? escapeHtml(product.description) : ""}</textarea></label><label>Available quantity<input name="quantity" type="number" min="0.01" step="0.01" required value="${product ? product.quantity : ""}"></label><label>Unit<select name="unit">${units.map(item => `<option ${product && product.unit === item ? "selected" : ""}>${item}</option>`).join("")}</select></label><label>Asking price (₱)<input name="price" type="number" min="0.01" step="0.01" required value="${product ? product.price : ""}"></label><label>Harvest date<input name="harvest" type="date" required value="${product ? escapeHtml(product.harvest) : ""}"></label><label>Municipality<select name="location" required>${municipalities.map(item => `<option ${product && product.location === item ? "selected" : ""}>${item}</option>`).join("")}</select></label><label>Product image<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"><span class="input-hint">JPEG, PNG, or WebP; maximum 5 MB.</span></label></div><div class="form-actions"><span class="form-note">Your listing will be stored in AniLink.</span><button class="button" type="submit">${product ? "Save changes" : "Add product"}</button></div></form>`;
  }
  function marketPriceList() {
    return `<div class="notice-banner"><span>i</span><p>Sample records are illustrative and unverified. Refer to the listed source and date before relying on any value.</p></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Product</th><th>Price per unit</th><th>Location</th><th>Source</th><th>Date</th></tr></thead><tbody>${state.prices.map(item => `<tr><td>${escapeHtml(item.product)}${item.sample ? " (Sample)" : ""}</td><td>${money(item.reference)} / ${escapeHtml(item.unit)}</td><td>${escapeHtml(item.location)}</td><td>${escapeHtml(item.source)}</td><td>${escapeHtml(item.date)}</td></tr>`).join("")}</tbody></table></div>`;
  }
  function adminPriceTable() {
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Product</th><th>Price/unit</th><th>Location</th><th>Source</th><th>Date</th><th>Actions</th></tr></thead><tbody>${state.prices.map(item => `<tr><td>${escapeHtml(item.product)}${item.sample ? " (Sample)" : ""}</td><td>${money(item.reference)} / ${escapeHtml(item.unit)}</td><td>${escapeHtml(item.location)}</td><td>${escapeHtml(item.source)}</td><td>${escapeHtml(item.date)}</td><td><button class="inline-button" data-price-edit="${escapeHtml(item.id)}">Edit</button> <button class="inline-button danger" data-price-delete="${escapeHtml(item.id)}">Delete</button></td></tr>`).join("")}</tbody></table></div>`;
  }
  function openAnnouncementEditor(announcement) {
    document.getElementById("backend-announcement-dialog")?.remove();
    const dialog = document.createElement("dialog");
    dialog.id = "backend-announcement-dialog";
    dialog.className = "inquiry-dialog";
    dialog.innerHTML = `<form class="inquiry-dialog-card" id="backend-announcement-form" data-id="${announcement ? escapeHtml(announcement.id) : ""}"><button type="button" class="modal-close" data-dialog-close aria-label="Close">×</button><h2>${announcement ? "Edit" : "Create"} announcement</h2><label>Title<input name="title" required maxlength="150" value="${announcement ? escapeHtml(announcement.title) : ""}"></label><label>Category<select name="category" required>${["General Announcement", "Agricultural Updates", "Market Information", "System Maintenance", "Important Notices", "Farmer Information"].map(item => `<option ${announcement && announcement.category === item ? "selected" : ""}>${item}</option>`).join("")}</select></label><label>Audience<select name="audience" required>${["All Users", "Farmers Only", "Buyers Only"].map(item => `<option ${announcement && announcement.audience === item ? "selected" : ""}>${item}</option>`).join("")}</select></label><label>Status<select name="status" required>${["Draft", "Published", "Archived"].map(item => `<option ${announcement && announcement.status === item ? "selected" : ""}>${item}</option>`).join("")}</select></label><label>Expiration date<input name="expiresAt" type="date" value="${announcement && announcement.expiresAt ? escapeHtml(announcement.expiresAt.slice(0, 10)) : ""}"></label><label>Featured image URL<input name="featuredImage" maxlength="255" value="${announcement && announcement.featuredImage ? escapeHtml(announcement.featuredImage) : ""}"></label><label>Content<textarea name="content" rows="6" required maxlength="5000">${announcement ? escapeHtml(announcement.content) : ""}</textarea></label><div class="modal-actions"><button type="button" class="button button-outline" data-dialog-close>Cancel</button><button type="submit" class="button">Save announcement</button></div></form>`;
    document.body.append(dialog);
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    dialog.showModal();
  }
  function showWorkspace() {
    const [role, requested = "dashboard"] = route().split("/");
    const user = state.user;
    if (!user || user.role !== role) {
      location.hash = "login";
      notify("Please sign in with the appropriate account to continue.");
      return;
    }
    if (role === "farmer") farmerWorkspace(requested);
    else if (role === "buyer") buyerWorkspace(requested);
    else if (role === "admin") adminWorkspace(requested);
  }

  async function showInquiry(productId) {
    if (!state.user) {
      location.hash = "login";
      notify("Sign in as a Buyer to contact a farmer.");
      return;
    }
    if (state.user.role !== "buyer") {
      notify("Only buyer accounts can send product inquiries.");
      return;
    }
    const product = state.products.find(item => item.id === String(productId));
    if (!product) {
      notify("That product is no longer available.");
      return;
    }
    document.getElementById("backend-inquiry-dialog")?.remove();
    const dialog = document.createElement("dialog");
    dialog.id = "backend-inquiry-dialog";
    dialog.className = "inquiry-dialog";
    dialog.innerHTML = `<form class="inquiry-dialog-card" id="backend-inquiry-form" data-product-id="${escapeHtml(product.id)}"><button class="modal-close" type="button" data-dialog-close aria-label="Close">×</button><span class="card-kicker">CONNECT WITH A LOCAL FARMER</span><h2>Ask about ${escapeHtml(product.name)}</h2><p class="form-note">Your inquiry will start a private conversation with ${escapeHtml(product.farmer)}. Sending as ${escapeHtml(state.user.name)}.</p><label>Product<input value="${escapeHtml(product.name)}" readonly></label><label>Farmer<input value="${escapeHtml(product.farmer)}" readonly></label><label>Subject<input name="subject" maxlength="150" required placeholder="e.g. Availability this week"></label><label>Quantity (optional)<input name="quantity" type="number" min="0.01" step="0.01"></label><label>Message<textarea name="message" rows="4" maxlength="1000" required></textarea></label><div class="modal-actions"><button type="button" class="button button-outline" data-dialog-close>Cancel</button><button type="submit" class="button">Send inquiry</button></div></form>`;
    document.body.append(dialog);
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    dialog.showModal();
  }

  async function openReportDialog(productId) {
    if (!state.user) {
      location.hash = "login";
      notify("Sign in to report a listing.");
      return;
    }
    const product = state.products.find(item => item.id === String(productId));
    if (!product) {
      notify("That product is no longer available for reporting.");
      return;
    }
    document.getElementById("backend-report-dialog")?.remove();
    const dialog = document.createElement("dialog");
    dialog.id = "backend-report-dialog";
    dialog.className = "inquiry-dialog";
    dialog.innerHTML = `<form class="inquiry-dialog-card" id="backend-report-form" data-product-id="${escapeHtml(product.id)}"><button type="button" class="modal-close" data-dialog-close aria-label="Close">×</button><span class="card-kicker">COMMUNITY SAFETY</span><h2>Report ${escapeHtml(product.name)}</h2><label>Reason<select name="category" required><option>Misleading product information</option><option>Incorrect product photograph</option><option>Suspicious listing</option><option>Inappropriate description</option><option>Misleading price</option><option>Spam listing</option></select></label><label>Title<input name="title" required maxlength="150" value="Report: ${escapeHtml(product.name)}"></label><label>Details<textarea name="description" rows="5" maxlength="2000" required></textarea></label><div class="modal-actions"><button type="button" class="button button-outline" data-dialog-close>Cancel</button><button type="submit" class="button">Submit report</button></div></form>`;
    document.body.append(dialog);
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    dialog.showModal();
  }

  function openPriceEditor(price) {
    document.getElementById("backend-price-dialog")?.remove();
    const dialog = document.createElement("dialog");
    dialog.id = "backend-price-dialog";
    dialog.className = "inquiry-dialog";
    dialog.innerHTML = `<form class="inquiry-dialog-card" id="backend-price-form" data-id="${price ? escapeHtml(price.id) : ""}"><button type="button" class="modal-close" data-dialog-close aria-label="Close">×</button><h2>${price ? "Edit" : "Add"} market price</h2><label>Product<input name="product" required maxlength="120" value="${price ? escapeHtml(price.product) : ""}"></label><label>Category<input name="category" required maxlength="80" value="${price ? escapeHtml(price.category) : ""}"></label><label>Market location<input name="location" required maxlength="120" value="${price ? escapeHtml(price.location) : ""}"></label><label>Price per unit (₱)<input name="reference" type="number" step="0.01" min="0.01" required value="${price ? price.reference : ""}"></label><label>Unit<input name="unit" required maxlength="30" value="${price ? escapeHtml(price.unit) : ""}"></label><label>Source<input name="source" required maxlength="190" value="${price ? escapeHtml(price.source) : ""}"></label><label>Date recorded<input name="date" type="date" required value="${price ? escapeHtml(price.rawDate) : new Date().toISOString().slice(0, 10)}"></label><label class="checkbox-label"><input type="checkbox" name="isSample" ${price && price.sample ? "checked" : ""}> Illustrative sample (unverified)</label><div class="modal-actions"><button type="button" class="button button-outline" data-dialog-close>Cancel</button><button type="submit" class="button">Save price</button></div></form>`;
    document.body.append(dialog);
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    dialog.showModal();
  }

  async function paint() {
    window.clearInterval(messagePollTimer);
    messagePollTimer = null;
    const currentRoute = route();
    const role = currentRoute.split("/")[0];
    if (["farmer", "buyer", "admin"].includes(role)) {
      if (!state.user) {
        location.hash = "login";
        notify("Sign in to open your workspace.");
        return;
      }
      if (state.user.role !== role) {
        location.hash = `${state.user.role}/dashboard`;
        notify("That workspace is not available to your account.");
        return;
      }
      showWorkspace();
      if (["buyer", "farmer"].includes(role)) {
        const history = document.getElementById("message-history");
        if (history) history.scrollTop = history.scrollHeight;
        messagePollTimer = window.setInterval(pollMessages, 5000);
      }
    } else if (currentRoute === "prices") {
      renderPrices();
    } else if (currentRoute === "marketplace") {
      renderMarketplace();
    } else if (currentRoute.startsWith("product/")) {
      renderProductDetail(currentRoute.split("/")[1]);
    } else if (currentRoute === "login" || currentRoute === "register") {
      renderAuth(currentRoute);
    } else {
      updateExistingHeader();
    }
  }

  async function refreshRoute(nudge) {
    const currentRoute = route();
    const role = currentRoute.split("/")[0];
    if (["farmer", "buyer", "admin"].includes(role) && (!state.user || state.user.role !== role)) {
      await paint();
      return;
    }
    try {
      await loadRouteData();
      state.error = "";
      await paint();
      if (nudge && !["prices", "farmer", "buyer", "admin"].includes(route().split("/")[0])) nudgeMainRender();
    } catch (error) {
      state.products = [];
      state.prices = [];
      state.inquiries = [];
      state.error = error.message;
      setSharedData();
      notify(error.message);
      const currentRoute = route();
      if (["farmer", "buyer", "admin"].includes(currentRoute.split("/")[0])) {
        app.innerHTML = `<main class="section container"><div class="empty-state"><h2>Unable to load AniLink</h2><p>${escapeHtml(error.message)}</p><p>Check that XAMPP Apache and MySQL are running and the database has been imported.</p></div></main>`;
      } else if (["prices", "marketplace", "login", "register"].includes(currentRoute) || currentRoute.startsWith("product/")) {
        await paint();
      } else {
        nudgeMainRender();
      }
    }
  }

  window.addEventListener("hashchange", () => {
    if (state.skipHash) {
      state.skipHash = false;
      paint();
      return;
    }
    refreshRoute(false);
  });
  document.addEventListener("input", event => {
    if (event.target.id === "backend-price-search" || event.target.id === "backend-price-category" || event.target.id === "backend-price-location") {
      const rows = document.getElementById("backend-price-rows");
      if (rows) rows.innerHTML = priceRows();
    }
    if (event.target.id === "backend-user-search") {
      const term = event.target.value.toLowerCase();
      document.querySelectorAll(".data-table tbody tr").forEach(row => row.hidden = !row.textContent.toLowerCase().includes(term));
    }
    if (event.target.id === "conversation-search") {
      const list = document.getElementById("conversation-list");
      if (list) list.innerHTML = conversationList();
    }
    if (event.target.id === "backend-price-search") {
      window.clearTimeout(priceSearchTimer);
      priceSearchTimer = window.setTimeout(searchMarketPrices, 220);
    }
    if (["product-search", "price-min", "price-max"].includes(event.target.id)) {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(searchMarketplace, 220);
    }
  });
  document.addEventListener("keydown", event => {
    if (event.target.id !== "message-input" || event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    const form = event.target.form;
    if (form && form.dataset.submitting !== "true") form.requestSubmit();
  });
  document.addEventListener("change", event => {
    if (["category-filter", "location-filter", "sort-products"].includes(event.target.id)) searchMarketplace();
    if (["backend-price-category", "backend-price-location"].includes(event.target.id)) searchMarketPrices();
    const reportStatus = event.target.closest("[data-report-status]");
    if (reportStatus) {
      api("admin-report-status", { method: "POST", body: { id: reportStatus.dataset.reportStatus, status: reportStatus.value } })
        .then(() => { notify("Report status updated."); refreshRoute(false); })
        .catch(error => { notify(error.message); refreshRoute(false); });
    }
    const select = event.target.closest("[data-inquiry-status]");
    if (select) {
      api("inquiry-status", { method: "POST", body: { id: select.dataset.inquiryStatus, status: select.value } })
        .then(() => { notify("Inquiry status updated."); refreshRoute(false); })
        .catch(error => { notify(error.message); refreshRoute(false); });
    }
  });
  async function searchMarketplace() {
    const form = new URLSearchParams();
    const fields = {
      q: document.getElementById("product-search")?.value,
      category: document.getElementById("category-filter")?.value,
      location: document.getElementById("location-filter")?.value,
      min: document.getElementById("price-min")?.value,
      max: document.getElementById("price-max")?.value
    };
    Object.entries(fields).forEach(([key, value]) => {
      if (value && !value.startsWith("All ")) form.set(key, value);
    });
    const order = document.getElementById("sort-products")?.value;
    if (order === "Price: low to high") form.set("sort", "price-asc");
    else if (order === "Price: high to low") form.set("sort", "price-desc");
    else if (order === "Name: A to Z") form.set("sort", "name");
    try {
      const result = await api("products", { query: `&${form.toString()}` });
      state.products = result.data.map(product => ({
        ...product, id: String(product.id), quantity: Number(product.quantity), price: Number(product.price),
        image: defaultPhoto(product.category), photoUrl: product.photoUrl || ""
      }));
      setSharedData();
      const results = document.getElementById("product-results");
      const count = document.getElementById("results-count");
      if (results) results.innerHTML = state.products.length ? state.products.map(productCard).join("") : '<div class="empty-state"><h3>No matching harvests yet</h3><p>Try changing a search or filter.</p></div>';
      if (count) count.textContent = `${state.products.length} ${state.products.length === 1 ? "listing" : "listings"}`;
    } catch (error) {
      notify(error.message);
    }
  }
  async function searchMarketPrices() {
    const params = new URLSearchParams();
    const query = document.getElementById("backend-price-search")?.value;
    const category = document.getElementById("backend-price-category")?.value;
    const location = document.getElementById("backend-price-location")?.value;
    if (query) params.set("q", query);
    if (category) params.set("category", category);
    if (location) params.set("location", location);
    try {
      const result = await api("prices", { query: `&${params.toString()}` });
      state.prices = result.data.map(price => ({
        ...price, id: String(price.id), reference: Number(price.reference),
        sample: Boolean(Number(price.is_sample)),
        rawDate: price.date,
        date: new Date(`${price.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
      }));
      const rows = document.getElementById("backend-price-rows");
      if (rows) rows.innerHTML = priceRows();
    } catch (error) {
      notify(error.message);
    }
  }
  document.addEventListener("click", event => {
    const inquiry = event.target.closest("[data-inquiry]");
    if (inquiry) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showInquiry(inquiry.dataset.inquiry);
    }
    const report = event.target.closest("[data-report-product]");
    if (report) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openReportDialog(report.dataset.reportProduct);
    }
  }, true);
  document.addEventListener("click", async event => {
    const menu = event.target.closest("[data-backend-menu]");
    if (menu) {
      const nav = document.querySelector(".main-nav");
      const open = nav?.classList.toggle("nav-open") || false;
      menu.setAttribute("aria-expanded", String(open));
    }
    const dashMenu = event.target.closest("[data-backend-dash-menu]");
    if (dashMenu) {
      const sidebar = document.querySelector(".dashboard-sidebar");
      const open = sidebar?.classList.toggle("sidebar-open") || false;
      dashMenu.setAttribute("aria-expanded", String(open));
    }
    if (event.target.closest(".sidebar-overlay") || event.target.closest(".dashboard-sidebar nav a")) {
      document.querySelector(".dashboard-sidebar")?.classList.remove("sidebar-open");
      document.querySelector("[data-backend-dash-menu]")?.setAttribute("aria-expanded", "false");
    }
    if (event.target.closest(".main-nav a")) {
      document.querySelector(".main-nav")?.classList.remove("nav-open");
      document.querySelector("[data-backend-menu]")?.setAttribute("aria-expanded", "false");
    }
    const close = event.target.closest("[data-dialog-close]");
    if (close) close.closest("dialog")?.close();
    const notification = event.target.closest("[data-notification-id]");
    if (notification) {
      try {
        await api("notification-read", { method: "POST", body: { id: notification.dataset.notificationId } });
        location.hash = `${state.user.role}/messages/${encodeURIComponent(notification.dataset.conversationId)}`;
      } catch (error) {
        notify(error.message);
      }
    }
    if (event.target.closest("[data-notifications-read-all]")) {
      try {
        await api("notification-read-all", { method: "POST", body: {} });
        await refreshRoute(false);
      } catch (error) {
        notify(error.message);
      }
    }
    const edit = event.target.closest("[data-product-edit]");
    if (edit) location.hash = `farmer/edit-product/${encodeURIComponent(edit.dataset.productEdit)}`;
    const deactivate = event.target.closest("[data-product-delete]");
    if (deactivate && window.confirm("Deactivate this product listing?")) {
      try {
        await api("product-delete", { method: "POST", body: { id: deactivate.dataset.productDelete } });
        notify("Product listing deactivated.");
        await refreshRoute(false);
      } catch (error) { notify(error.message); }
    }
    const adminProduct = event.target.closest("[data-admin-product]");
    if (adminProduct) {
      try {
        await api("admin-product-status", { method: "POST", body: { id: adminProduct.dataset.adminProduct, status: adminProduct.dataset.status } });
        notify("Listing status updated.");
        await refreshRoute(false);
      } catch (error) { notify(error.message); }
    }
    const userStatus = event.target.closest("[data-user-status]");
    if (userStatus) {
      try {
        await api("admin-user-status", { method: "POST", body: { id: userStatus.dataset.userStatus, active: userStatus.dataset.active === "true" } });
        notify("Account status updated.");
        await refreshRoute(false);
      } catch (error) { notify(error.message); }
    }
    const priceEdit = event.target.closest("[data-price-edit]");
    if (priceEdit) openPriceEditor(state.prices.find(item => item.id === priceEdit.dataset.priceEdit) || null);
    const priceDelete = event.target.closest("[data-price-delete]");
    if (priceDelete && window.confirm("Delete this price record?")) {
      try {
        await api("admin-price-delete", { method: "POST", body: { id: priceDelete.dataset.priceDelete } });
        notify("Price record deleted.");
        await refreshRoute(false);
      } catch (error) { notify(error.message); }
    }
    const announcementNew = event.target.closest("[data-announcement-new]");
    if (announcementNew) openAnnouncementEditor(null);
    const announcementEdit = event.target.closest("[data-announcement-edit]");
    if (announcementEdit) {
      const item = state.announcements.find(entry => String(entry.id) === String(announcementEdit.dataset.announcementEdit));
      openAnnouncementEditor(item || null);
    }
    const announcementDelete = event.target.closest("[data-announcement-delete]");
    if (announcementDelete && window.confirm("Delete this announcement?")) {
      try {
        await api("admin-announcement-delete", { method: "POST", body: { id: announcementDelete.dataset.announcementDelete } });
        notify("Announcement deleted.");
        await refreshRoute(false);
      } catch (error) { notify(error.message); }
    }
    if (event.target.closest("[data-logout]")) {
      try {
        await api("logout", { method: "POST", body: {} });
        state.user = null;
        state.csrf = "";
        location.hash = "home";
        notify("You have signed out.");
      } catch (error) { notify(error.message); }
    }
  });
  document.addEventListener("submit", async event => {
    const form = event.target;
    if (form.matches("#message-form")) {
      event.preventDefault();
      if (form.dataset.submitting === "true") return;
      const message = String(new FormData(form).get("message") || "").trim();
      if (!message) {
        notify("Write a message before sending.");
        form.elements.message.focus();
        return;
      }
      const button = form.querySelector('button[type="submit"]');
      form.dataset.submitting = "true";
      if (button) button.disabled = true;
      try {
        await api("message-send", {
          method: "POST",
          body: { conversationId: form.dataset.conversationId, message }
        });
        form.reset();
        notify("Message sent.");
        await pollMessages();
      } catch (error) {
        notify(error.message);
      } finally {
        form.dataset.submitting = "false";
        if (button) button.disabled = false;
      }
      return;
    }
    if (form.matches("#auth-form")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const values = Object.fromEntries(new FormData(form));
      try {
        if (form.dataset.auth === "register") {
          if (values.password !== values.confirmPassword) throw new Error("Passwords do not match.");
          const result = await api("register", { method: "POST", body: values });
          state.user = result.user;
          state.csrf = result.csrfToken;
        } else {
          const result = await api("login", { method: "POST", body: values });
          state.user = result.user;
          state.csrf = result.csrfToken;
        }
        notify("You are signed in.");
        location.hash = `${state.user.role}/dashboard`;
      } catch (error) { notify(error.message); }
      return;
    }
    if (form.matches("#backend-product-form")) {
      event.preventDefault();
      const formData = new FormData(form);
      const editing = Boolean(form.dataset.id);
      if (editing) formData.set("id", form.dataset.id);
      try {
        await api(editing ? "product-update" : "product-create", { method: "POST", body: formData });
        notify(editing ? "Product updated." : "Product added.");
        location.hash = "farmer/products";
      } catch (error) { notify(error.message); }
      return;
    }
    if (form.matches("#backend-inquiry-form")) {
      event.preventDefault();
      if (form.dataset.submitting === "true") return;
      form.dataset.submitting = "true";
      const button = form.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      const values = Object.fromEntries(new FormData(form));
      try {
        await api("inquiry-create", { method: "POST", body: { ...values, productId: form.dataset.productId } });
        form.closest("dialog").close();
        notify("Inquiry sent. Your private conversation is ready.");
        await refreshRoute(false);
      } catch (error) {
        form.dataset.submitting = "false";
        if (button) button.disabled = false;
        notify(error.message);
      }
      return;
    }
    if (form.matches("#backend-report-form")) {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      try {
        await api("report-create", { method: "POST", body: { ...values, productId: form.dataset.productId } });
        form.closest("dialog").close();
        notify("Report submitted to administration.");
      } catch (error) { notify(error.message); }
      return;
    }
    if (form.matches("#backend-price-form")) {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      values.isSample = form.elements.isSample.checked;
      const editing = Boolean(form.dataset.id);
      if (editing) values.id = form.dataset.id;
      try {
        await api(editing ? "admin-price-update" : "admin-price-create", { method: "POST", body: values });
        form.closest("dialog").close();
        notify("Market price saved.");
        await refreshRoute(false);
      } catch (error) { notify(error.message); }
      return;
    }
    if (form.matches("#backend-announcement-form")) {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      const editing = Boolean(form.dataset.id);
      if (editing) values.id = form.dataset.id;
      try {
        await api("admin-announcement-save", { method: "POST", body: values });
        form.closest("dialog").close();
        notify(editing ? "Announcement updated." : "Announcement created.");
        await refreshRoute(false);
      } catch (error) { notify(error.message); }
    }
  }, true);

  async function initialize() {
    try {
      const session = await api("session");
      state.user = session.user;
      state.csrf = session.csrfToken;
      await refreshRoute(true);
    } catch (error) {
      shared.products = [];
      shared.prices = [];
      notify(error.message);
      nudgeMainRender();
    }
  }
  initialize();
})();
