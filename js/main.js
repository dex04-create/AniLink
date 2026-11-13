(function () {
  "use strict";

  const data = window.AniLinkData;
  const app = document.getElementById("app");
  let toastTimer;
  let chartTimer;
  const state = { search: "", category: "All categories", municipality: "All municipalities", sort: "Featured", priceMin: "", priceMax: "", priceCategory: "All categories", priceLocation: "All municipalities", priceDate: "All dates", priceQuery: "" };

  const icon = {
    sprout: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21v-9m0 2c-5 0-8-3-8-8 5 0 8 3 8 8Zm0-3c0-5 3-8 8-8 0 5-3 8-8 8Z"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    leaf: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4c-9 0-15 4-15 11a5 5 0 0 0 5 5c7 0 11-6 10-16Z"/><path d="M4 21c3-5 7-8 12-11"/></svg>'
  };
  const image = (id, width) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width || 800}&q=85`;
  const productImage = (product, width) => product.photoUrl || image(product.image, width);
  const money = value => `₱${Number(value).toLocaleString("en-PH")}`;
  const path = () => decodeURIComponent(location.hash.slice(1) || "home").replace(/^\/+/, "");
  const link = (to, text, cls = "") => `<a class="${cls}" href="#${to}">${text}</a>`;
  const productCard = p => {
    const harvested = p.harvest && !Number.isNaN(Date.parse(p.harvest))
      ? new Date(`${p.harvest}T12:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })
      : "";
    const available = (p.status ? p.status === "active" : Number(p.quantity) > 0) && Number(p.quantity) > 0;
    return `<article class="product-card">
    <div class="product-photo"><a class="product-photo-link" href="#product/${encodeURIComponent(p.id)}"><img src="${productImage(p, 700)}" alt="${escapeHtml(p.name)}" loading="lazy"></a><span class="photo-tag">${escapeHtml(p.category)}</span><button class="save-button" type="button" aria-label="Save ${escapeHtml(p.name)}" data-save="${escapeHtml(p.id)}">♡</button></div>
    <div class="product-card-body"><div class="product-title-row"><h3>${escapeHtml(p.name)}</h3><span class="price">${money(p.price)}<small> / ${escapeHtml(p.unit)}</small></span></div>
    <p class="product-meta">${icon.pin} ${escapeHtml(p.location)} <span>·</span> ${p.quantity} ${escapeHtml(p.unit)} available</p><p class="farmer-line">Grown by <strong>${escapeHtml(p.farmer)}</strong></p>
    ${harvested ? `<div class="product-listing-meta"><span>Harvested ${escapeHtml(harvested)}</span><span class="status-pill ${available ? "active" : "inactive"}">${available ? "Available" : "Unavailable"}</span></div>` : ""}
    <div class="product-card-actions">${link(`product/${p.id}`, "View details", "text-link")}${link(`product/${p.id}?inquiry=1`, "Ask farmer", "button button-small button-outline")}</div></div></article>`;
  };

  function header() {
    const currentPage = path().split("?")[0].split("/")[0];
    const navLink = (to, label) => `<a class="${currentPage === to || (to === "marketplace" && currentPage === "product") ? "active" : ""}" href="#${to}"${currentPage === to || (to === "marketplace" && currentPage === "product") ? ' aria-current="page"' : ""}>${label}</a>`;
    return `<header class="site-header"><div class="header-inner">${link("home", `<span class="brand-mark">${icon.sprout}</span><span class="brand-name">ani<span>link</span><small>GROWN TOGETHER</small></span>`, "brand")}
      <button class="mobile-menu" aria-label="Open navigation" aria-expanded="false" data-menu>☰</button><nav class="main-nav" aria-label="Main navigation">
      ${navLink("home", "Home")}${navLink("marketplace", "Marketplace")}${navLink("prices", "Market prices")}${navLink("about", "About us")}${navLink("contact", "Contact")}</nav>
      <div class="header-actions">${link("login", "Log in", "header-login")}${link("register", "Join AniLink", "button button-small")}</div></div></header>`;
  }
  function footer() {
    return `<footer class="site-footer"><div class="footer-main"><div class="footer-brand"><a class="brand brand-light" href="#home"><span class="brand-mark">${icon.sprout}</span><span class="brand-name">ani<span>link</span><small>GROWN TOGETHER</small></span></a><p>A better connection between the people who grow our food and the people who bring it to the table.</p></div>
      <div><h4>Explore</h4>${link("marketplace", "Marketplace")}${link("prices", "Market information")}${link("about", "About AniLink")}</div>
      <div><h4>Get started</h4>${link("register", "Create an account")}${link("login", "Sign in")}${link("farmer/dashboard", "Farmer workspace")}</div>
      <div><h4>Say hello</h4><a href="mailto:hello@anilink.demo">hello@anilink.demo</a><p>Marinduque, Philippines</p></div></div><div class="footer-bottom"><span>© 2026 AniLink · Farm-to-market connections</span><span>Made for local agriculture in Marinduque</span></div></footer>`;
  }
  const wrap = (content, withFooter = true) => `${header()}<main>${content}</main>${withFooter ? footer() : ""}`;
  const sectionEyebrow = text => `<p class="eyebrow">${icon.leaf} ${text}</p>`;
  const sectionHeading = (eyebrow, title, copy, extra = "") => `<div class="section-heading">${sectionEyebrow(eyebrow)}<h2>${title}</h2><p>${copy}</p>${extra}</div>`;

  function homePage() {
    const featured = data.products.slice(0, 3).map(productCard).join("");
    return wrap(`<section class="hero"><div class="hero-inner"><div class="hero-copy">${sectionEyebrow("A MARKETPLACE ROOTED IN MARINDUQUE")}<h1>Connecting Farmers. <em>Empowering Communities.</em></h1><p>Discover fresh local produce and connect directly with agricultural producers across Marinduque.</p><div class="hero-actions">${link("marketplace", "Explore Marketplace " + icon.arrow, "button")}${link("register", "Become a Farmer", "button button-ghost")}</div><div class="hero-proof"><div class="avatar-stack"><span>LM</span><span>RS</span><span>MC</span></div><p><strong>Made for our island community</strong><br>Farmers and buyers, growing together.</p></div></div>
      <div class="hero-visual"><img src="assets/images/background/rice-fields-bg.jpg" alt="Aerial view of agricultural fields in Mimaropa, Philippines"><div class="hero-note"><span class="note-icon">${icon.sprout}</span><span><strong>From our island, for our island</strong><small>Local harvests. Real connections.</small></span></div><span class="hero-stamp">MARINDUQUE<br>PHILIPPINES</span></div></div><div class="hero-bottom"><span>LOCAL KNOWLEDGE</span><i></i><span>FARMER FIRST</span><i></i><span>COMMUNITY GROWN</span></div></section>
      <section class="section section-featured"><div class="container">${sectionHeading("FRESH FROM THE ISLAND", "A little taste of what's growing", "Browse recent listings from local growers. Reach out to a farmer to ask about availability and pickup.", link("marketplace", "See all products " + icon.arrow, "text-link heading-link"))}<div class="product-grid">${featured}</div></div></section>
      <section class="section how-section"><div class="container"><div class="how-intro">${sectionEyebrow("SIMPLE, BY DESIGN")}<h2>Local harvest.<br><em>Closer connections.</em></h2><p>AniLink makes it easier to find local produce, understand indicative prices, and start a conversation with a grower.</p>${link("about", "Get to know AniLink " + icon.arrow, "text-link")}</div><div class="steps"><article><span class="step-number">01</span><span class="step-icon">${icon.search}</span><h3>Find what's in season</h3><p>Explore produce listed by local farmers, with useful details about quantity, location, and harvest.</p></article><article><span class="step-number">02</span><span class="step-icon">↗</span><h3>Connect directly</h3><p>Send an inquiry to the farmer to ask a question or discuss an order. No middleman required.</p></article><article><span class="step-number">03</span><span class="step-icon">⌁</span><h3>Make informed choices</h3><p>Compare demonstration market references with asking prices to start a more informed conversation.</p></article></div></div></section>
      <section class="section price-preview"><div class="container price-preview-inner"><div>${sectionEyebrow("A CLEARER PICTURE")}<h2>Know the market.<br><em>Value the harvest.</em></h2><p>Explore indicative reference prices alongside farmer asking prices. Both are useful context—neither is a promise of what a sale will cost.</p>${link("prices", "Explore market information " + icon.arrow, "button")}</div><div class="price-preview-card"><div class="preview-card-head"><span>DEMO MARKET SNAPSHOT</span><span class="live-dot">SAMPLE</span></div><div class="preview-chart" aria-label="Illustrative market trend chart"><div class="chart-lines"><i></i><i></i><i></i><i></i></div><svg viewBox="0 0 400 145" preserveAspectRatio="none" aria-hidden="true"><path d="M0 112 C42 101 50 119 82 92 S130 104 156 72 210 94 236 52 278 77 310 45 354 57 400 15" fill="none" stroke="#39785a" stroke-width="3"/><path d="M0 130 C35 112 57 126 86 110 S141 111 164 93 214 108 240 80 285 91 318 68 359 74 400 51" fill="none" stroke="#e3a65c" stroke-width="2" stroke-dasharray="5 6"/></svg><div class="chart-months"><span>JUN</span><span>JUL</span><span>AUG</span><span>SEP</span><span>OCT</span><span>NOV</span></div></div><div class="chart-legend"><span><i></i> Reference price</span><span><i></i> Asking price</span></div><small>Illustrative trend, not official or live market data.</small></div></div></section>
      <section class="section benefits-section"><div class="container">${sectionHeading("A SHARED HARVEST", "A better way to meet in the middle", "Whether you're growing or sourcing, AniLink brings useful information and people a little closer.")}<div class="benefit-grid"><article class="benefit-card farmer-benefit"><span class="benefit-icon">✳</span><span class="card-kicker">FOR FARMERS</span><h3>Your harvest deserves<br>to be seen.</h3><p>Share your produce, reach potential buyers, and see market references that can help inform a fair conversation.</p>${link("register", "Start a farmer profile " + icon.arrow, "text-link")}</article><article class="benefit-card buyer-benefit"><span class="benefit-icon">⌂</span><span class="card-kicker">FOR BUYERS</span><h3>Source closer.<br>Know your growers.</h3><p>Find local products, connect with farmers, and explore current demonstration price references in one place.</p>${link("marketplace", "Find local produce " + icon.arrow, "text-link")}</article></div></div></section>
      <section class="section about-strip"><div class="container about-strip-inner"><div class="about-photo"><img src="${image("photo-1464226184884-fa280b87c399", 900)}" alt="Farmer tending a field"></div><div>${sectionEyebrow("ROOTED IN MARINDUQUE")}<h2>Built around the people<br>who make food possible.</h2><p>AniLink is a web-based farm-to-market concept for local producers and buyers in Marinduque. It brings listings, market information, and buyer connections together in a welcoming, easy-to-use space.</p>${link("about", "More about our mission " + icon.arrow, "text-link")}</div></div></section>
      <section class="cta-band"><div class="container cta-inner"><div><span>GOOD THINGS GROW TOGETHER</span><h2>Make your next connection<br>a local one.</h2></div><div>${link("marketplace", "Browse the marketplace " + icon.arrow, "button button-light")}${link("register", "Create a demo account", "button button-ghost")}</div></div></section>`);
  }
  function aboutPage() {
    return wrap(`<section class="page-hero"><div class="container">${sectionEyebrow("OUR STORY")}<h1>Rooted here.<br><em>Growing together.</em></h1><p>AniLink is a farm-to-market connection concept designed around local farmers, buyers, and agricultural communities in Marinduque.</p></div></section><section class="section"><div class="container about-story"><div>${sectionEyebrow("WHY ANILINK")}<h2>Good information can open doors.</h2><p>Small-scale producers and local buyers need simple ways to find one another. AniLink brings product listings, indicative market information, and buyer inquiries into one approachable online experience.</p><p>Our goal is to support local visibility and informed conversations—not to replace the relationships and local knowledge that already make Marinduque's agricultural community strong.</p></div><div class="mission-card"><span class="mission-icon">${icon.sprout}</span><h3>Our purpose</h3><p>Help local farmers promote their harvest, give buyers a way to discover local produce, and make agricultural price information easier to explore.</p><span class="demo-label">Concept demonstration · No transactions are processed</span></div></div></section><section class="section how-section"><div class="container">${sectionHeading("WHAT YOU'LL FIND", "Three useful tools, one local network", "AniLink brings the essentials together with clarity and care.")}<div class="steps"><article><span class="step-number">01</span><h3>Product listings</h3><p>Explore sample agricultural listings and connect with farmers about what is available.</p></article><article><span class="step-number">02</span><h3>Price information</h3><p>Compare clearly labeled demonstration references and asking prices—not verified official quotations.</p></article><article><span class="step-number">03</span><h3>Management tools</h3><p>See how farmer, buyer, and administrator workspaces might support the community.</p></article></div></div></section>`);
  }
  function contactPage() {
    return wrap(`<section class="page-hero"><div class="container">${sectionEyebrow("GET IN TOUCH")}<h1>Let's start a<br><em>conversation.</em></h1><p>Questions about this project demonstration? Send us a note.</p></div></section><section class="section"><div class="container contact-layout"><div><h2>We're happy to hear from you.</h2><p>AniLink is a frontend project demonstration. This contact form won't send data to a server, but you can reach the project team by email.</p><p><strong>Email</strong><br><a href="mailto:hello@anilink.demo">hello@anilink.demo</a></p><p><strong>Location</strong><br>Marinduque, Philippines</p></div><form class="form-card" data-local-form><label>Your name<input name="name" required placeholder="e.g. Ana Reyes"></label><label>Email address<input name="email" type="email" required placeholder="you@example.com"></label><label>Message<textarea name="message" rows="4" required placeholder="What would you like to ask?"></textarea></label><p class="form-note">Demo only: this message is not transmitted or stored.</p><button class="button" type="submit">Prepare message</button></form></div></section>`);
  }

  function marketplacePage() {
    const categories = ["All categories", ...new Set(data.products.map(p => p.category))];
    return wrap(`<section class="page-hero compact-hero"><div class="container">${sectionEyebrow("FROM LOCAL FARMS")}<h1>Discover what's <em>growing.</em></h1><p>Browse local harvests and connect directly with the people who grow them.</p></div></section><section class="section marketplace-section"><div class="container"><div class="market-tools"><label class="search-field">${icon.search}<input id="product-search" value="${escapeHtml(state.search)}" placeholder="Search products or farmers..." aria-label="Search products"></label><label class="select-field"><span>Category</span><select id="category-filter">${categories.map(c => `<option ${c === state.category ? "selected" : ""}>${c}</option>`).join("")}</select></label><label class="select-field"><span>Municipality</span><select id="location-filter">${["All municipalities", ...new Set(data.products.map(p => p.location))].map(c => `<option ${c === state.municipality ? "selected" : ""}>${c}</option>`).join("")}</select></label><label class="select-field"><span>Sort by</span><select id="sort-products">${["Featured", "Price: low to high", "Price: high to low", "Name: A to Z"].map(c => `<option ${c === state.sort ? "selected" : ""}>${c}</option>`).join("")}</select></label><label class="price-range-field"><span>Price range (₱)</span><div><input id="price-min" type="number" min="0" value="${escapeHtml(state.priceMin)}" placeholder="Min" aria-label="Minimum price"><i>–</i><input id="price-max" type="number" min="0" value="${escapeHtml(state.priceMax)}" placeholder="Max" aria-label="Maximum price"></div></label></div><div class="results-line"><span id="results-count"></span><span class="demo-label">Sample listings · Availability may change</span></div><div id="product-results" class="product-grid"></div><div class="marketplace-footnote">${icon.leaf}<p>These listings use demonstration profiles and sample information. Contact details and transactions are not connected to a live service.</p></div></div></section>`);
  }
  function renderProducts() {
    const term = state.search.toLowerCase();
    const min = state.priceMin === "" ? null : Number(state.priceMin);
    const max = state.priceMax === "" ? null : Number(state.priceMax);
    let rows = data.products.filter(p => (state.category === "All categories" || p.category === state.category) && (state.municipality === "All municipalities" || p.location === state.municipality) && (min === null || p.price >= min) && (max === null || p.price <= max) && `${p.name} ${p.category} ${p.farmer} ${p.location}`.toLowerCase().includes(term));
    if (state.sort === "Price: low to high") rows.sort((a, b) => a.price - b.price);
    if (state.sort === "Price: high to low") rows.sort((a, b) => b.price - a.price);
    if (state.sort === "Name: A to Z") rows.sort((a, b) => a.name.localeCompare(b.name));
    document.getElementById("product-results").innerHTML = rows.length ? rows.map(productCard).join("") : `<div class="empty-state"><span>${icon.search}</span><h3>No matching harvests yet</h3><p>Try a different search or clear one of the filters.</p></div>`;
    document.getElementById("results-count").textContent = `${rows.length} ${rows.length === 1 ? "listing" : "listings"}`;
  }
  function productPage(id) {
    const p = data.products.find(row => row.id === id);
    if (!p) return wrap(`<section class="section container"><div class="empty-state"><h2>Product not found</h2>${link("marketplace", "Back to marketplace", "button")}</div></section>`);
    return wrap(`<section class="section product-detail-section"><div class="container"><div class="breadcrumbs">${link("marketplace", "Marketplace")} <span>/</span> ${escapeHtml(p.category)} <span>/</span> ${escapeHtml(p.name)}</div><div class="product-detail"><div class="detail-image"><img src="${productImage(p, 1200)}" alt="${escapeHtml(p.name)}"><span class="photo-tag">${escapeHtml(p.category)}</span></div><div class="detail-copy">${sectionEyebrow("LOCAL HARVEST · DEMO LISTING")}<h1>${escapeHtml(p.name)}</h1><p class="detail-price">${money(p.price)} <span>/ ${escapeHtml(p.unit)}</span></p><p>${escapeHtml(p.description)}</p><div class="detail-facts"><div><span>AVAILABLE</span><strong>${p.quantity} ${escapeHtml(p.unit)}</strong></div><div><span>GROWN IN</span><strong>${escapeHtml(p.location)}, Marinduque</strong></div><div><span>HARVEST DATE</span><strong>${escapeHtml(p.harvest)}</strong></div></div><div class="farmer-profile-mini"><span class="farmer-avatar">${escapeHtml(p.farmer.split(" ").map(x => x[0]).join(""))}</span><span><small>LISTED BY</small><strong>${escapeHtml(p.farmer)}</strong><small>Local farmer · Demo profile</small></span></div><button class="button" type="button" data-inquiry="${escapeHtml(p.id)}">Send an inquiry ${icon.arrow}</button><p class="form-note">This demo does not contact the farmer or process a purchase.</p></div></div></div></section><section class="section section-featured"><div class="container">${sectionHeading("MORE TO EXPLORE", "Other local listings", "See what else is available from sample farms.")}<div class="product-grid">${data.products.filter(x => x.id !== p.id).slice(0, 3).map(productCard).join("")}</div></div></section>`);
  }

  function pricesPage() {
    const categories = ["All categories", ...new Set(data.prices.map(p => p.category))];
    const locations = ["All municipalities", ...new Set(data.prices.map(p => p.location))];
    return wrap(`<section class="page-hero compact-hero"><div class="container">${sectionEyebrow("INFORMATION FOR BETTER CONVERSATIONS")}<h1>Agricultural <em>market prices.</em></h1><p>Explore indicative sample references beside local farmer asking prices.</p></div></section><section class="section prices-section"><div class="container"><div class="notice-banner"><span>i</span><p><strong>Reference and asking prices are different.</strong> The figures below are clearly labeled demonstration data, not verified official prices or live market quotations. Always confirm current terms with the farmer.</p></div><div class="price-summary"><article><span>DEMO REFERENCES</span><strong>${data.prices.length}</strong><small>Sample product records</small></article><article><span>LAST SAMPLE UPDATE</span><strong>Nov 05</strong><small>2026 · Demonstration date</small></article><article><span>LOCATIONS</span><strong>${new Set(data.prices.map(p => p.location)).size}</strong><small>Marinduque municipalities</small></article></div><div class="price-chart-card"><div class="chart-card-heading"><div><span class="card-kicker">ILLUSTRATIVE TREND</span><h2>Sample rice price movement</h2><p>Illustrative values only · Not official market data</p></div><select id="chart-product" aria-label="Choose chart product">${data.prices.map((p, i) => `<option value="${i}">${p.product}</option>`).join("")}</select></div><div class="chart-wrap"><canvas id="price-chart" aria-label="Sample reference and asking price trend chart"></canvas></div><div class="chart-legend"><span><i></i> Reference price (sample)</span><span><i></i> Farmer asking price (sample)</span><small>Illustrative recent periods; not observed price history.</small></div></div><div class="market-tools price-tools"><label class="search-field">${icon.search}<input id="price-search" value="${escapeHtml(state.priceQuery)}" placeholder="Search agricultural products..." aria-label="Search prices"></label><label class="select-field"><span>Category</span><select id="price-category">${categories.map(c => `<option ${c === state.priceCategory ? "selected" : ""}>${c}</option>`).join("")}</select></label><label class="select-field"><span>Location</span><select id="price-location">${locations.map(c => `<option ${c === state.priceLocation ? "selected" : ""}>${c}</option>`).join("")}</select></label><label class="select-field"><span>Date updated</span><select id="price-date"><option>All dates</option>${[...new Set(data.prices.map(p => p.date))].map(d => `<option ${d === state.priceDate ? "selected" : ""}>${d}</option>`).join("")}</select></label></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Agricultural product</th><th>Reference price</th><th>Farmer asking price</th><th>Unit</th><th>Location</th><th>Source</th><th>Date updated</th></tr></thead><tbody id="price-rows"></tbody></table></div><div class="data-note">${icon.leaf}<p>Price values in this project are mock data to demonstrate the interface. They should not be used for buying, selling, or official reporting decisions.</p></div></div></section>`);
  }
  function renderPriceRows() {
    const q = state.priceQuery.toLowerCase();
    const rows = data.prices.filter(p => (state.priceCategory === "All categories" || p.category === state.priceCategory) && (state.priceLocation === "All municipalities" || p.location === state.priceLocation) && (state.priceDate === "All dates" || p.date === state.priceDate) && `${p.product} ${p.location} ${p.category}`.toLowerCase().includes(q));
    const tbody = document.getElementById("price-rows");
    if (tbody) tbody.innerHTML = rows.length ? rows.map(p => `<tr><td><strong>${p.product}</strong></td><td>${money(p.reference)}</td><td><span class="asking-price">${money(p.asking)}</span></td><td>${p.unit}</td><td>${p.location}</td><td><span class="source-pill">${p.source}</span></td><td>${p.date}</td></tr>`).join("") : `<tr><td colspan="7" class="table-empty">No sample price records match those filters.</td></tr>`;
  }
  function drawChart(index) {
    const canvas = document.getElementById("price-chart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const box = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = box.width * ratio;
    canvas.height = 270 * ratio;
    ctx.scale(ratio, ratio);
    const w = box.width, h = 270, pad = { left: 42, right: 15, top: 16, bottom: 30 };
    const p = data.prices[index] || data.prices[0];
    if (!p || !Array.isArray(p.trend) || p.trend.length < 2) return;
    const low = Math.min(...p.trend) * 0.75, high = Math.max(...p.trend) * 1.15;
    const x = i => pad.left + (w - pad.left - pad.right) * i / (p.trend.length - 1);
    const y = v => pad.top + (high - v) / (high - low) * (h - pad.top - pad.bottom);
    ctx.clearRect(0, 0, w, h);
    ctx.font = "11px DM Sans, sans-serif";
    for (let i = 0; i < 4; i++) {
      const yy = pad.top + i * (h - pad.top - pad.bottom) / 3;
      ctx.strokeStyle = "#e9eee8"; ctx.beginPath(); ctx.moveTo(pad.left, yy); ctx.lineTo(w - pad.right, yy); ctx.stroke();
      ctx.fillStyle = "#839087"; ctx.fillText(`₱${Math.round(high - (high - low) * i / 3)}`, 2, yy + 4);
    }
    const lines = [{ values: p.trend, color: "#39785a", offset: 1 }, { values: p.trend.map(v => v * p.asking / p.reference), color: "#e3a65c", offset: 0 }];
    lines.forEach(line => {
      ctx.beginPath();
      line.values.forEach((v, i) => {
        const px = x(i), py = y(v * (line.offset ? 1 : 0.92));
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.strokeStyle = line.color; ctx.lineWidth = 2.5; ctx.stroke();
      line.values.forEach((v, i) => { ctx.beginPath(); ctx.arc(x(i), y(v * (line.offset ? 1 : 0.92)), 3.5, 0, Math.PI * 2); ctx.fillStyle = line.color; ctx.fill(); });
    });
    ["PERIOD 1", "PERIOD 2", "PERIOD 3", "PERIOD 4", "PERIOD 5", "PERIOD 6"].forEach((label, i) => {
      ctx.fillStyle = "#839087"; ctx.fillText(label, x(i) - 18, h - 7);
    });
  }

  const roleNav = {
    farmer: [["dashboard", "Overview", "⌂"], ["products", "My products", "▤"], ["add-product", "Add product", "＋"], ["inquiries", "Buyer inquiries", "↗"], ["prices", "Market prices", "⌁"], ["profile", "My profile", "◉"]],
    buyer: [["dashboard", "Overview", "⌂"], ["browse-products", "Browse products", "⌕"], ["my-inquiries", "My inquiries", "↗"], ["prices", "Market prices", "⌁"], ["profile", "My profile", "◉"]],
    admin: [["dashboard", "Overview", "⌂"], ["users", "User management", "♙"], ["farmers", "Farmer accounts", "✳"], ["buyers", "Buyer accounts", "⌂"], ["products", "Product listings", "▤"], ["market-prices", "Market prices", "⌁"], ["reports", "Reported listings", "⚑"], ["announcements", "Announcements", "▣"], ["settings", "Settings", "⚙"]]
  };
  function dashboardShell(role, page, content) {
    const titles = { farmer: "Farmer workspace", buyer: "Buyer workspace", admin: "Admin workspace" };
    return `<div class="dashboard-layout"><aside class="dashboard-sidebar"><a class="brand" href="#home"><span class="brand-mark">${icon.sprout}</span><span class="brand-name">ani<span>link</span><small>GROWN TOGETHER</small></span></a><span class="workspace-label">${titles[role]}</span><nav aria-label="${role} dashboard">${roleNav[role].map(([slug, label, glyph]) => `<a class="${page === slug ? "active" : ""}" href="#${role}/${slug}"><span>${glyph}</span>${label}</a>`).join("")}</nav><div class="sidebar-bottom"><div class="demo-profile"><span class="farmer-avatar">${role === "farmer" ? "LM" : role === "buyer" ? "BF" : "AD"}</span><span><strong>${role === "farmer" ? "Liza Mendoza" : role === "buyer" ? "Boac Fresh Mart" : "Demo Admin"}</strong><small>${role[0].toUpperCase() + role.slice(1)} demo</small></span><span>⌄</span></div><a class="sidebar-logout" href="#home">↗ <span>Back to website</span></a></div></aside><div class="dashboard-main"><header class="dashboard-topbar"><button class="mobile-menu dash-menu" aria-label="Open dashboard navigation" data-dash-menu>☰</button><span>${titles[role]} <span class="demo-label">DEMO</span></span><div class="topbar-actions"><span class="topbar-date">November 2026</span><button class="icon-button" data-toast="You are all caught up in this demo." aria-label="Notifications">♧<i></i></button><span class="farmer-avatar small-avatar">${role === "farmer" ? "LM" : role === "buyer" ? "BF" : "AD"}</span></div></header><main class="dashboard-content">${content}</main></div></div>`;
  }
  const dashTitle = (eyebrow, title, text, action = "") => `<div class="dash-heading"><div><span class="card-kicker">${eyebrow}</span><h1>${title}</h1><p>${text}</p></div>${action}</div>`;
  const statCard = (label, value, note, iconText, color = "") => `<article class="stat-card"><span class="stat-icon ${color}">${iconText}</span><span class="stat-label">${label}</span><strong>${value}</strong><small>${note}</small></article>`;
  function productFormPage(product) {
    const categories = ["Fruit", "Vegetables", "Grains", "Coconut", "Root crops", "Other"];
    const units = ["kg", "piece", "sack", "bundle", "crate"];
    const municipalities = ["Boac", "Buenavista", "Gasan", "Mogpog", "Santa Cruz", "Torrijos"];
    const field = name => escapeHtml(product ? product[name] : "");
    const selected = (value, current) => value === current ? " selected" : "";
    const harvestDate = product ? new Date(product.harvest).toISOString().slice(0, 10) : "";
    const title = product ? "Edit product" : "Add a product";
    return `${dashTitle("YOUR FARM", title, product ? "Update listing details in this local demo session." : "Share a harvest with buyers looking for local produce.")}<form class="dash-panel product-form" id="product-form" ${product ? `data-edit-id="${escapeHtml(product.id)}"` : ""}><div class="form-section-title"><span>01</span><div><h2>Product details</h2><p>Tell buyers a little about your harvest.</p></div></div><div class="form-grid"><label>Product name<input name="name" required value="${field("name")}" placeholder="e.g. Fresh calamansi"></label><label>Category<select name="category" required><option value="">Choose category</option>${categories.map(c => `<option${selected(c, product && product.category)}>${c}</option>`).join("")}</select></label><label class="full-field">Description<textarea name="description" rows="3" required placeholder="Describe your product, how it was grown, and anything buyers should know.">${field("description")}</textarea></label><label>Available quantity<input name="quantity" type="number" min="1" required value="${field("quantity")}" placeholder="e.g. 50"></label><label>Unit<select name="unit">${units.map(u => `<option${selected(u, product && product.unit)}>${u}</option>`).join("")}</select></label><label>Asking price (₱)<input name="price" type="number" min="1" step="0.01" required value="${field("price")}" placeholder="e.g. 45"></label><label>Harvest date<input name="harvest" type="date" required value="${harvestDate}"></label><label>Municipality<select name="location" required><option value="">Choose municipality</option>${municipalities.map(l => `<option${selected(l, product && product.location)}>${l}</option>`).join("")}</select></label><label>Product image<input name="photo" id="product-photo" type="file" accept="image/*"><span class="input-hint">Choose an image from your device (preview only).</span></label></div><div id="image-preview" class="image-preview">${product ? `<img src="${productImage(product, 100)}" alt="Current product image preview"><span>Current listing image</span>` : ""}</div><div class="form-actions"><span class="form-note">Demo only. Changes stay in this browser session.</span><button class="button" type="submit">${product ? "Save demo changes" : "Add demo listing"} ${icon.arrow}</button></div></form>`;
  }
  function farmerPage(page, productId) {
    let content = "";
    if (page === "dashboard") content = `${dashTitle("WEDNESDAY, NOVEMBER 5", "Good morning, Liza 🌿", "Here’s a little snapshot of what’s happening with your farm.", link("farmer/add-product", "＋ Add a product", "button button-small"))}<div class="stats-grid">${statCard("Total listings", data.products.length, "Across all categories", "▤")}${statCard("Active listings", data.products.length, "Visible in marketplace", "✓", "stat-green")}${statCard("Pending inquiries", data.inquiries.length, "Demo inquiries", "↗", "stat-amber")}${statCard("Profile views", "24", "In the last 7 days", "◉", "stat-blue")}</div><div class="dash-grid-two"><section class="dash-panel"><div class="panel-heading"><div><span class="card-kicker">AT A GLANCE</span><h2>Recent activity</h2></div><button class="inline-button" data-toast="You’re viewing all recent demo activity.">View all ↗</button></div><div class="activity-list">${data.activities.map(a => `<div class="activity-item"><span>${a.icon}</span><p>${a.text}<small>${a.time}</small></p></div>`).join("")}</div></section><section class="dash-panel"><div class="panel-heading"><div><span class="card-kicker">DON'T MISS A THING</span><h2>Inquiries to follow up</h2></div>${link("farmer/inquiries", "See all", "inline-button")}</div>${data.inquiries.slice(0, 2).map(i => `<div class="inquiry-mini"><span class="farmer-avatar">${escapeHtml(i.buyer.slice(0, 2).toUpperCase())}</span><div><strong>${escapeHtml(i.buyer)}</strong><small>${escapeHtml(i.product)} · ${escapeHtml(i.date)}</small></div><span class="status-pill ${escapeHtml(i.status.toLowerCase())}">${escapeHtml(i.status)}</span></div>`).join("")}</section></div><section class="dash-panel"><div class="panel-heading"><div><span class="card-kicker">YOUR HARVESTS</span><h2>Recently listed products</h2></div>${link("farmer/products", "Manage products", "inline-button")}</div><div class="table-wrap"><table class="data-table"><thead><tr><th>Product</th><th>Quantity</th><th>Asking price</th><th>Status</th></tr></thead><tbody>${data.products.slice(0, 4).map(p => `<tr><td><div class="table-product"><img src="${productImage(p, 100)}" alt=""><strong>${escapeHtml(p.name)}</strong></div></td><td>${p.quantity} ${escapeHtml(p.unit)}</td><td>${money(p.price)} / ${escapeHtml(p.unit)}</td><td><span class="status-pill active">Active</span></td></tr>`).join("")}</tbody></table></div></section>`;
    else if (page === "products") content = `${dashTitle("YOUR FARM", "My products", "Keep your listings up to date so buyers know what’s available.", link("farmer/add-product", "＋ Add product", "button button-small"))}<div class="dash-panel"><div class="panel-heading"><h2>All listings <span class="count-badge">${data.products.length}</span></h2><button class="inline-button" data-toast="Showing all sample product listings.">All statuses⌄</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Product</th><th>Category</th><th>Quantity</th><th>Asking price</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead><tbody>${data.products.map(p => `<tr><td><div class="table-product"><img src="${productImage(p, 100)}" alt=""><strong>${escapeHtml(p.name)}</strong></div></td><td>${escapeHtml(p.category)}</td><td>${p.quantity} ${escapeHtml(p.unit)}</td><td>${money(p.price)} / ${escapeHtml(p.unit)}</td><td>${escapeHtml(p.location)}</td><td><span class="status-pill active">Active</span></td><td><button class="inline-button" data-edit="${escapeHtml(p.id)}">Edit</button> <button class="inline-button danger" data-delete="${escapeHtml(p.id)}">Delete</button></td></tr>`).join("")}</tbody></table></div></div>`;
    else if (page === "add-product" || page === "edit-product") {
      const product = page === "edit-product" ? data.products.find(p => p.id === productId) : null;
      content = productFormPage(product || null);
    }
    else if (page === "inquiries") content = `${dashTitle("BUYER CONNECTIONS", "Buyer inquiries", "Conversations that can help your harvest find a home.")}<div class="inquiry-cards">${data.inquiries.map(i => `<article class="dash-panel inquiry-card"><div class="inquiry-card-top"><span class="farmer-avatar">${escapeHtml(i.buyer.slice(0, 2).toUpperCase())}</span><span class="status-pill ${escapeHtml(i.status.toLowerCase())}">${escapeHtml(i.status)}</span></div><span class="card-kicker">ABOUT ${escapeHtml(i.product.toUpperCase())}</span><h2>${escapeHtml(i.buyer)}</h2><p>${escapeHtml(i.message)}</p><small>${escapeHtml(i.date)} · Demo inquiry</small><button class="button button-outline button-small" data-toast="Messaging is simulated in this frontend demonstration.">View conversation</button></article>`).join("")}</div>`;
    else if (page === "prices") content = `${dashTitle("MARKET INFORMATION", "Market prices", "Reference information to help you prepare for a conversation with buyers.", link("prices", "View full price table ↗", "inline-button"))}<div class="notice-banner"><span>i</span><p><strong>Demonstration values only.</strong> These references are not verified official prices. Your asking price is your own and may differ.</p></div><div class="price-preview-list">${data.prices.slice(0, 4).map(p => `<div class="price-row"><strong>${p.product}</strong><span>${p.location}</span><span>Reference <b>${money(p.reference)} / ${p.unit}</b></span><span>Your market <b>${money(p.asking)} / ${p.unit}</b></span></div>`).join("")}</div>`;
    else content = `${dashTitle("YOUR ACCOUNT", "My profile", "Manage your demo profile information.")}<div class="dash-panel profile-card"><span class="farmer-avatar profile-avatar">LM</span><div><h2>Liza Mendoza</h2><p>Farmer · Boac, Marinduque</p><p>liza@example.demo</p><span class="demo-label">Sample account · Changes are not saved</span></div><button class="button button-outline button-small" data-toast="Profile editing is a frontend demo only.">Edit profile</button></div>`;
    app.innerHTML = dashboardShell("farmer", page, content);
  }
  function buyerPage(page) {
    let content = "";
    if (page === "dashboard") content = `${dashTitle("WEDNESDAY, NOVEMBER 5", "Welcome, Boac Fresh Mart", "Find your next local supplier right here.", link("buyer/browse-products", "Browse products " + icon.arrow, "button button-small"))}<div class="stats-grid">${statCard("Available listings", data.products.length, "Across Marinduque", "▤")}${statCard("Your inquiries", "4", "1 new response", "↗", "stat-green")}${statCard("Saved products", "3", "Keep an eye on these", "♡", "stat-amber")}</div><div class="dash-panel"><div class="panel-heading"><div><span class="card-kicker">FRESH FINDS</span><h2>Recently viewed products</h2></div>${link("buyer/browse-products", "Browse all", "inline-button")}</div><p class="form-note">Sample browsing history for this demo account.</p><div class="product-grid">${data.products.slice(0, 3).map(productCard).join("")}</div></div><div class="dash-panel"><div class="panel-heading"><div><span class="card-kicker">KEEP THE CONVERSATION GOING</span><h2>Recent inquiries</h2></div>${link("buyer/my-inquiries", "See all", "inline-button")}</div>${data.inquiries.slice(0, 2).map(i => `<div class="inquiry-mini"><span class="farmer-avatar">${escapeHtml(i.buyer.slice(0, 2).toUpperCase())}</span><div><strong>${escapeHtml(i.product)}</strong><small>${escapeHtml(i.buyer)} · ${escapeHtml(i.date)}</small></div><span class="status-pill ${escapeHtml(i.status.toLowerCase())}">${escapeHtml(i.status)}</span></div>`).join("")}</div>`;
    else if (page === "browse-products") content = `${dashTitle("LOCAL MARKETPLACE", "Browse products", "Discover sample harvests from local farmers.", link("marketplace", "Open full marketplace ↗", "inline-button"))}<div class="product-grid">${data.products.map(productCard).join("")}</div>`;
    else if (page === "my-inquiries") content = `${dashTitle("YOUR CONVERSATIONS", "My inquiries", "Follow up on the products you have asked about.")}<div class="dash-panel">${data.inquiries.map(i => `<div class="inquiry-mini inquiry-wide"><span class="farmer-avatar">${escapeHtml(i.buyer.slice(0, 2).toUpperCase())}</span><div><strong>${escapeHtml(i.product)}</strong><small>To ${escapeHtml(i.buyer)} · ${escapeHtml(i.date)}<br>${escapeHtml(i.message)}</small></div><span class="status-pill ${escapeHtml(i.status.toLowerCase())}">${escapeHtml(i.status)}</span><button class="inline-button" data-toast="Inquiry status is sample data and messaging is not connected.">Details</button></div>`).join("")}</div>`;
    else if (page === "prices") content = `${dashTitle("MARKET INFORMATION", "Market prices", "Compare clearly labeled demonstration reference and asking prices.", link("prices", "Explore price information ↗", "inline-button"))}<div class="notice-banner"><span>i</span><p>All values on this page are sample demonstration data, not official market quotations.</p></div><div class="price-preview-list">${data.prices.slice(0, 5).map(p => `<div class="price-row"><strong>${p.product}</strong><span>${p.location}</span><span>Reference <b>${money(p.reference)} / ${p.unit}</b></span><span>Asking <b>${money(p.asking)} / ${p.unit}</b></span></div>`).join("")}</div>`;
    else content = `${dashTitle("YOUR ACCOUNT", "My profile", "Your sample buyer account information.")}<div class="dash-panel profile-card"><span class="farmer-avatar profile-avatar">BF</span><div><h2>Boac Fresh Mart</h2><p>Buyer · Boac, Marinduque</p><p>hello@example.demo</p><span class="demo-label">Sample account · Changes are not saved</span></div><button class="button button-outline button-small" data-toast="Profile editing is a frontend demo only.">Edit profile</button></div>`;
    app.innerHTML = dashboardShell("buyer", page, content);
  }
  function adminPage(page) {
    const listedUsers = data.users.filter(u => !["farmers", "buyers"].includes(page) || u.type.toLowerCase() === (page === "farmers" ? "farmer" : "buyer"));
    const userRows = listedUsers.map(u => `<tr><td><div class="table-person"><span class="farmer-avatar">${u.name.split(" ").map(x => x[0]).join("").slice(0, 2)}</span><span><strong>${u.name}</strong><small>${u.email}</small></span></div></td><td>${u.type}</td><td>${u.location}</td><td><span class="status-pill ${u.status.toLowerCase()}">${u.status}</span></td><td><button class="inline-button" data-user="${data.users.indexOf(u)}">Manage</button></td></tr>`).join("");
    let content = "";
    if (page === "dashboard") content = `${dashTitle("PLATFORM OVERVIEW", "Good morning, Admin", "Here’s a snapshot of the AniLink demo community.", `<button class="button button-small" data-toast="Report downloaded as a frontend demo only.">↓ Export report</button>`)}<div class="stats-grid admin-stats-grid">${statCard("Registered users", "248", "12 joined this month", "♙")}${statCard("Farmers", "186", "Demo accounts", "✳", "stat-green")}${statCard("Buyers", "62", "Demo accounts", "⌂", "stat-blue")}${statCard("Product listings", "94", "8 need review", "▤", "stat-amber")}${statCard("Total inquiries", "312", "Across the demo platform", "↗")}</div><div class="dash-grid-two"><section class="dash-panel"><div class="panel-heading"><div><span class="card-kicker">COMMUNITY GROWTH</span><h2>Platform activity</h2></div><span class="demo-label">SAMPLE STATS</span></div><div class="admin-bars" aria-label="Illustrative weekly signup chart">${[38, 55, 45, 70, 53, 82, 64].map((h, i) => `<div><span style="height:${h}%"></span><small>${["M", "T", "W", "T", "F", "S", "S"][i]}</small></div>`).join("")}</div></section><section class="dash-panel"><div class="panel-heading"><div><span class="card-kicker">NEEDS A LOOK</span><h2>Review queue</h2></div></div><div class="review-item"><span class="review-icon amber">!</span><p><strong>8 product listings</strong><small>Waiting for review</small></p>${link("admin/products", "Review", "inline-button")}</div><div class="review-item"><span class="review-icon blue">♙</span><p><strong>4 farmer accounts</strong><small>Pending verification</small></p>${link("admin/users", "Review", "inline-button")}</div><div class="review-item"><span class="review-icon rose">⚑</span><p><strong>2 reported listings</strong><small>Needs administrator review</small></p>${link("admin/reports", "Review", "inline-button")}</div></section></div><div class="dash-panel"><div class="panel-heading"><div><span class="card-kicker">RECENT ACTIVITY</span><h2>Latest platform updates</h2></div><button class="inline-button" data-toast="Showing the sample activity feed.">View activity ↗</button></div><div class="activity-list">${data.activities.map(a => `<div class="activity-item"><span>${a.icon}</span><p>${a.text}<small>${a.time}</small></p></div>`).join("")}</div></div>`;
    else if (["users", "farmers", "buyers"].includes(page)) {
      const title = page === "users" ? "User management" : page === "farmers" ? "Farmer accounts" : "Buyer accounts";
      const accountType = page === "farmers" ? "farmer" : "buyer";
      content = `${dashTitle("COMMUNITY", title, "Review sample farmer and buyer accounts.", `<button class="button button-small" data-toast="Invitations are simulated in this demo.">＋ Invite user</button>`)}${page === "users" ? `<div class="stats-grid">${statCard("All users", "248", "Across both account types", "♙")}${statCard("Farmers", "186", "75% of community", "✳")}${statCard("Buyers", "62", "25% of community", "⌂")}</div>` : ""}<div class="dash-panel"><div class="panel-heading"><h2>${page === "users" ? "All users" : accountType === "farmer" ? "Farmer accounts" : "Buyer accounts"} <span class="count-badge">${listedUsers.length} sample</span></h2><label class="search-field compact-search">${icon.search}<input id="user-search" placeholder="Search users..." aria-label="Search users"></label></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Account type</th><th>Municipality</th><th>Status</th><th>Actions</th></tr></thead><tbody id="user-rows">${userRows}</tbody></table></div></div>`;
    }
    else if (page === "products") content = `${dashTitle("CATALOG", "Product listings", "Review and manage sample listings across the platform.")}<div class="dash-panel"><div class="panel-heading"><h2>All listings <span class="count-badge">${data.products.length} sample</span></h2><button class="inline-button" data-toast="Showing all sample listing statuses.">All statuses⌄</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Product</th><th>Farmer</th><th>Location</th><th>Asking price</th><th>Status</th><th>Actions</th></tr></thead><tbody>${data.products.map(p => `<tr><td><div class="table-product"><img src="${productImage(p, 100)}" alt=""><strong>${escapeHtml(p.name)}</strong></div></td><td>${escapeHtml(p.farmer)}</td><td>${escapeHtml(p.location)}</td><td>${money(p.price)} / ${escapeHtml(p.unit)}</td><td><span class="status-pill active">Active</span></td><td><button class="inline-button" data-toast="Listing moderation is simulated.">Review</button></td></tr>`).join("")}</tbody></table></div></div>`;
    else if (page === "market-prices") content = `${dashTitle("MARKET INFORMATION", "Market price management", "Review the demonstration values displayed on AniLink.")}<div class="notice-banner"><span>i</span><p><strong>Demo records only.</strong> This interface does not publish or verify official market data.</p></div><div class="dash-panel"><div class="panel-heading"><h2>Price reference records</h2><button class="button button-small" data-toast="Price record editor is simulated in this demo.">＋ Add reference</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Product</th><th>Reference</th><th>Asking price</th><th>Location</th><th>Source</th><th>Actions</th></tr></thead><tbody>${data.prices.map(p => `<tr><td><strong>${p.product}</strong></td><td>${money(p.reference)} / ${p.unit}</td><td>${money(p.asking)} / ${p.unit}</td><td>${p.location}</td><td><span class="source-pill">${p.source}</span></td><td><button class="inline-button" data-toast="Price editing is simulated; source records are unchanged.">Edit</button></td></tr>`).join("")}</tbody></table></div></div>`;
    else if (page === "reports") content = `${dashTitle("COMMUNITY SAFETY", "Reported listings", "Review reports submitted about listings in the demo.")}<div class="dash-panel empty-panel"><span class="empty-illustration">⚑</span><h2>No open reports</h2><p>Reported items will appear here for administrator review.</p><span class="demo-label">Sample interface · No real reports are processed</span></div>`;
    else if (page === "announcements") content = `${dashTitle("COMMUNITY UPDATES", "Announcements", "Manage messages shown to the AniLink demo community.", `<button class="button button-small" data-toast="Announcement composer is simulated.">＋ New announcement</button>`)}<div class="dash-panel announcement-card"><span class="status-pill active">Published · Demo</span><h2>Welcome to the AniLink project demonstration</h2><p>Explore local sample listings and market information. All data is for demonstration purposes.</p><small>Posted Nov 05, 2026 · Demo Admin</small><button class="inline-button" data-toast="Announcement editing is simulated.">Edit announcement</button></div>`;
    else content = `${dashTitle("PLATFORM", "Settings", "Frontend demonstration settings. No changes are persisted.")}<div class="dash-panel settings-list"><div><div><strong>Marketplace demo mode</strong><p>Show clear labels wherever sample data is displayed.</p></div><span class="toggle-pill">ON</span></div><div><div><strong>New user registrations</strong><p>Registration is frontend-only; no account is created.</p></div><span class="toggle-pill">DEMO</span></div><div><div><strong>Market information</strong><p>All displayed prices are illustrative sample values.</p></div><span class="toggle-pill">SAMPLE</span></div></div>`;
    app.innerHTML = dashboardShell("admin", page, content);
  }

  function authPage(kind) {
    const login = kind === "login";
    return `<div class="auth-layout"><div class="auth-aside"><a class="brand brand-light" href="#home"><span class="brand-mark">${icon.sprout}</span><span class="brand-name">ani<span>link</span><small>GROWN TOGETHER</small></span></a><div class="auth-aside-copy">${sectionEyebrow("MARINDUQUE, PHILIPPINES")}<h2>Good things grow<br><em>when we connect.</em></h2><p>A frontend project demonstration for local growers, buyers, and the community.</p></div><img src="${image("photo-1500382017468-9049fed747ef", 1000)}" alt="Fields at golden hour"><span class="auth-aside-label">LOCAL HARVESTS · BETTER CONNECTIONS</span></div><div class="auth-content"><div class="auth-topline">Already exploring? ${link("home", "Back to AniLink")}</div><div class="auth-form-wrap"><span class="card-kicker">${login ? "WELCOME BACK" : "LET'S GROW TOGETHER"}</span><h1>${login ? "Sign in to AniLink" : "Create your account"}</h1><p>${login ? "Use a demo form to explore the AniLink experience." : "Join our local agriculture community demo."}</p><form class="auth-form" id="auth-form" data-auth="${kind}">${login ? `<label>Email or username<input name="identity" required autocomplete="username" placeholder="e.g. farmer@example.com"></label>` : `<label>Full name<input name="name" required autocomplete="name" placeholder="Your full name"></label><label>Email address<input name="email" type="email" required autocomplete="email" placeholder="you@example.com"></label><label>Contact number<input name="phone" type="tel" required placeholder="+63 9XX XXX XXXX"></label><label>Municipality / address<select name="location" required><option value="">Choose your municipality</option>${["Boac", "Buenavista", "Gasan", "Mogpog", "Santa Cruz", "Torrijos"].map(l => `<option>${l}</option>`).join("")}</select></label><label>Account type<select name="role" required><option value="">Choose account type</option><option value="farmer">Farmer</option><option value="buyer">Buyer</option></select></label>`}<label>Password<span class="password-wrap"><input name="password" type="password" required minlength="8" autocomplete="${login ? "current-password" : "new-password"}" placeholder="At least 8 characters"><button type="button" data-password aria-label="Show password">Show</button></span></label>${login ? `<div class="auth-options"><label class="checkbox-label"><input type="checkbox" name="remember"> Remember me</label><a href="#forgot-password">Forgot password?</a></div>` : `<label>Confirm password<input name="confirmPassword" type="password" required minlength="8" autocomplete="new-password" placeholder="Enter your password again"></label><label class="checkbox-label terms-label"><input type="checkbox" name="terms" required> I agree to the <a href="#about">terms and conditions</a> for this demonstration.</label>`}<p class="form-note">Demo only — forms do not create accounts or authenticate users.</p><button class="button auth-submit" type="submit">${login ? "Continue to demo" : "Create demo account"} ${icon.arrow}</button></form><p class="auth-switch">${login ? `New to AniLink? ${link("register", "Create an account")}` : `Already have an account? ${link("login", "Sign in")}`}</p></div><p class="auth-copyright">© 2026 AniLink · Frontend project demonstration</p></div></div>`;
  }
  function forgotPage() {
    return `<div class="auth-layout"><div class="auth-aside"><a class="brand brand-light" href="#home"><span class="brand-mark">${icon.sprout}</span><span class="brand-name">ani<span>link</span><small>GROWN TOGETHER</small></span></a><div class="auth-aside-copy">${sectionEyebrow("HERE TO HELP")}<h2>Every good connection<br>starts with a <em>hello.</em></h2></div><img src="${image("photo-1500382017468-9049fed747ef", 1000)}" alt="Farm landscape"></div><div class="auth-content"><div class="auth-topline">${link("login", "← Back to sign in")}</div><div class="auth-form-wrap"><span class="card-kicker">PASSWORD HELP</span><h1>Forgot your password?</h1><p>Password recovery isn't connected in this demo. Enter an email to preview the form.</p><form class="auth-form" data-local-form><label>Email address<input type="email" name="email" required placeholder="you@example.com"></label><p class="form-note">Demo only — no email will be sent.</p><button class="button auth-submit">Preview recovery request ${icon.arrow}</button></form></div></div></div>`;
  }
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }
  function toast(message) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
  }
  function openInquiry(productId) {
    const product = data.products.find(p => p.id === productId);
    if (!product) { toast("This sample listing is no longer available."); return; }
    document.getElementById("inquiry-dialog")?.remove();
    const dialog = document.createElement("dialog");
    dialog.id = "inquiry-dialog";
    dialog.className = "inquiry-dialog";
    dialog.innerHTML = `<form class="inquiry-dialog-card" data-inquiry-form data-product-id="${escapeHtml(product.id)}"><button class="modal-close" type="button" aria-label="Close inquiry form" data-close-dialog>×</button><span class="card-kicker">CONNECT WITH A LOCAL FARMER</span><h2>Ask about ${escapeHtml(product.name)}</h2><p class="form-note">Your inquiry will be added to this browser’s demo session only. It will not be sent to a farmer.</p><label>Your name<input name="buyer" required maxlength="80" placeholder="Your name or business"></label><label>Email address<input name="email" type="email" required maxlength="120" placeholder="you@example.com"></label><label>Quantity you’re interested in<input name="quantity" type="number" min="1" required placeholder="e.g. 25"></label><label>Message<textarea name="message" rows="4" required maxlength="1000" placeholder="Ask a question or share what you need."></textarea></label><div class="modal-actions"><button type="button" class="button button-outline" data-close-dialog>Cancel</button><button type="submit" class="button">Preview inquiry</button></div></form>`;
    document.body.append(dialog);
    dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    dialog.showModal();
  }

  function render() {
    clearTimeout(chartTimer);
    const current = path().split("?")[0];
    const parts = current.split("/");
    if (["marketplace", "prices", "login", "register"].includes(current) || ["farmer", "buyer", "admin", "product"].includes(parts[0])) {
      app.innerHTML = `<section class="section container"><div class="empty-state"><h2>Loading AniLink…</h2></div></section>`;
    }
    else if (current === "home" || !current) app.innerHTML = homePage();
    else if (current === "marketplace") { app.innerHTML = marketplacePage(); renderProducts(); }
    else if (parts[0] === "product") {
      app.innerHTML = productPage(parts[1]);
      if (location.hash.includes("?inquiry=1")) setTimeout(() => openInquiry(parts[1]), 0);
    }
    else if (current === "prices") { app.innerHTML = pricesPage(); renderPriceRows(); chartTimer = setTimeout(() => drawChart(0), 30); }
    else if (current === "about") app.innerHTML = aboutPage();
    else if (current === "contact") app.innerHTML = contactPage();
    else if (current === "login" || current === "register") app.innerHTML = authPage(current);
    else if (current === "forgot-password") app.innerHTML = forgotPage();
    else if (parts[0] === "farmer") farmerPage(parts[1] === "edit-product" ? "edit-product" : roleNav.farmer.some(item => item[0] === parts[1]) ? parts[1] : "dashboard", parts[2]);
    else if (parts[0] === "buyer") buyerPage(roleNav.buyer.some(item => item[0] === parts[1]) ? parts[1] : "dashboard");
    else if (parts[0] === "admin") adminPage(roleNav.admin.some(item => item[0] === parts[1]) ? parts[1] : "dashboard");
    else app.innerHTML = `<section class="section container"><div class="empty-state"><h2>Page not found</h2>${link("home", "Return home", "button")}</div></section>`;
    window.scrollTo(0, 0);
  }

  document.addEventListener("input", event => {
    if (event.target.id === "product-search") { state.search = event.target.value; renderProducts(); }
    if (event.target.id === "price-min") { state.priceMin = event.target.value; renderProducts(); }
    if (event.target.id === "price-max") { state.priceMax = event.target.value; renderProducts(); }
    if (event.target.id === "price-search") { state.priceQuery = event.target.value; renderPriceRows(); }
    if (event.target.id === "user-search") {
      const term = event.target.value.toLowerCase();
      document.querySelectorAll("#user-rows tr").forEach(row => row.hidden = !row.textContent.toLowerCase().includes(term));
    }
  });
  document.addEventListener("change", event => {
    if (event.target.id === "category-filter") { state.category = event.target.value; renderProducts(); }
    if (event.target.id === "location-filter") { state.municipality = event.target.value; renderProducts(); }
    if (event.target.id === "sort-products") { state.sort = event.target.value; renderProducts(); }
    if (event.target.id === "price-category") { state.priceCategory = event.target.value; renderPriceRows(); }
    if (event.target.id === "price-location") { state.priceLocation = event.target.value; renderPriceRows(); }
    if (event.target.id === "price-date") { state.priceDate = event.target.value; renderPriceRows(); }
    if (event.target.id === "chart-product") drawChart(Number(event.target.value));
    if (event.target.id === "product-photo" && event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (!file.type.startsWith("image/")) { toast("Please choose an image file."); event.target.value = ""; return; }
      const reader = new FileReader();
      reader.onload = () => { const preview = document.getElementById("image-preview"); if (preview) preview.innerHTML = `<img src="${reader.result}" alt="Selected product preview"><span>${escapeHtml(file.name)}</span>`; };
      reader.onerror = () => toast("The selected image could not be previewed.");
      reader.readAsDataURL(file);
    }
  });
  document.addEventListener("click", event => {
    const menu = event.target.closest("[data-menu]");
    if (menu) { const nav = document.querySelector(".main-nav"); const open = nav.classList.toggle("nav-open"); menu.setAttribute("aria-expanded", String(open)); }
    if (event.target.closest(".main-nav a")) {
      const nav = document.querySelector(".main-nav");
      const menuButton = document.querySelector("[data-menu]");
      nav?.classList.remove("nav-open");
      menuButton?.setAttribute("aria-expanded", "false");
    }
    const dashMenu = event.target.closest("[data-dash-menu]");
    if (dashMenu) document.querySelector(".dashboard-sidebar").classList.toggle("sidebar-open");
    const passwordToggle = event.target.closest("[data-password]");
    if (passwordToggle) {
      const input = passwordToggle.parentElement.querySelector("input");
      const showing = input.type === "password";
      input.type = showing ? "text" : "password";
      passwordToggle.textContent = showing ? "Hide" : "Show";
      passwordToggle.setAttribute("aria-label", showing ? "Hide password" : "Show password");
    }
    const toastButton = event.target.closest("[data-toast]");
    if (toastButton) toast(toastButton.dataset.toast);
    const save = event.target.closest("[data-save]");
    if (save) { event.preventDefault(); save.classList.toggle("saved"); save.textContent = save.classList.contains("saved") ? "♥" : "♡"; toast(save.classList.contains("saved") ? "Saved to your demo list." : "Removed from your demo list."); }
    const inquiry = event.target.closest("[data-inquiry]");
    if (inquiry) openInquiry(inquiry.dataset.inquiry);
    const closeDialog = event.target.closest("[data-close-dialog]");
    if (closeDialog) closeDialog.closest("dialog").close();
    const edit = event.target.closest("[data-edit]");
    if (edit) location.hash = `farmer/edit-product/${encodeURIComponent(edit.dataset.edit)}`;
    const del = event.target.closest("[data-delete]");
    if (del) { const p = data.products.find(x => x.id === del.dataset.delete); if (p && window.confirm(`Remove "${p.name}" from this local demo view?`)) { data.products.splice(data.products.indexOf(p), 1); render(); toast("Listing removed from this demo session."); } }
    const user = event.target.closest("[data-user]");
    if (user) toast(`Account management for ${data.users[Number(user.dataset.user)].name} is simulated.`);
  });
  document.addEventListener("submit", event => {
    const form = event.target;
    if (form.matches("[data-inquiry-form]")) {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const product = data.products.find(p => p.id === form.dataset.productId);
      if (product) {
        const values = Object.fromEntries(new FormData(form));
        data.inquiries.unshift({
          buyer: String(values.buyer).trim(),
          product: product.name,
          date: "Nov 05, 2026",
          message: `${String(values.message).trim()} (Interested in ${values.quantity} ${product.unit}.)`,
          status: "Pending"
        });
      }
      form.closest("dialog").close();
      toast("Inquiry added to this local demo session only. Nothing was sent.");
    }
    if (form.matches("[data-auth]")) {
      event.preventDefault();
      if (!form.reportValidity()) return;
      if (form.dataset.auth === "register") {
        form.elements.confirmPassword.setCustomValidity("");
        if (form.elements.password.value !== form.elements.confirmPassword.value) {
          form.elements.confirmPassword.setCustomValidity("Passwords do not match.");
          form.reportValidity();
          return;
        }
      }
      if (form.dataset.auth === "register") {
        const role = form.elements.role.value;
        toast(`Your ${role} demo form is valid. No account was created.`);
        setTimeout(() => { location.hash = `${role}/dashboard`; }, 800);
      } else toast("Demo sign-in is not connected. No authentication was performed.");
    }
    if (form.matches("#product-form")) {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const values = Object.fromEntries(new FormData(form));
      const existing = data.products.find(p => p.id === form.dataset.editId);
      const imagePreview = form.querySelector("#image-preview img");
      const photoUrl = imagePreview && imagePreview.src.startsWith("data:image/") ? imagePreview.src : existing && existing.photoUrl;
      const harvest = new Date(`${values.harvest}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const listing = {
        ...(existing || {}),
        id: existing ? existing.id : `demo-${Date.now()}`,
        name: String(values.name).trim(),
        category: values.category,
        description: String(values.description).trim(),
        quantity: Number(values.quantity),
        unit: values.unit,
        price: Number(values.price),
        harvest,
        location: values.location,
        farmer: "Liza Mendoza",
        image: existing ? existing.image : data.products[0].image,
        photoUrl
      };
      if (existing) Object.assign(existing, listing);
      else data.products.unshift(listing);
      location.hash = "farmer/products";
      toast(existing ? "Listing updated in this local demo session only." : "Listing added to this local demo session only.");
    }
    if (form.matches("[data-local-form]")) {
      event.preventDefault();
      if (!form.reportValidity()) return;
      toast("Form looks good. Demo only — nothing was sent or saved.");
      form.reset();
    }
  });
  window.addEventListener("hashchange", render);
  window.addEventListener("resize", () => { if (path() === "prices") drawChart(Number(document.getElementById("chart-product")?.value || 0)); });
  render();
})();
