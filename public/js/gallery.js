// gallery.js — fetches the synced gallery, renders it, wires the lightbox.
(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const masonry = $("#masonry");
  const empty = $("#empty");
  const syncState = $("#syncState");
  const heroStage = $("#heroStage");
  const heroMeta = $("#heroMeta");
  $("#year").textContent = new Date().getFullYear();

  let photos = [];

  // ---- load ----
  async function load() {
    try {
      const res = await fetch("/api/gallery", { headers: { Accept: "application/json" } });
      const data = await res.json();
      photos = (data.photos || []).filter((p) => p && p.src);
      setSyncBadge(data.source);
    } catch {
      // Hard fallback: bundled assets, if even the API is unreachable.
      photos = Array.from({ length: 16 }, (_, i) => ({
        id: `local-${i + 1}`,
        src: `/assets/${i + 1}.jpg`,
        thumb: `/assets/${i + 1}.jpg`,
        caption: "",
      }));
      setSyncBadge("local");
    }
    render();
  }

  function setSyncBadge(source) {
    const map = {
      live:  ['<i class="ri-film-line"></i>', "latest frames", true],
      local: ['<i class="ri-folder-image-line"></i>', "local archive", false],
    };
    const [icon, label, live] = map[source] || map.local;
    syncState.innerHTML = `${icon} ${label}`;
    syncState.classList.toggle("live", !!live);
  }

  // ---- render ----
  function render() {
    masonry.innerHTML = "";
    if (!photos.length) { empty.hidden = false; return; }
    empty.hidden = true;

    // Hero shows the most recent frame.
    const first = photos[0];
    heroStage.style.backgroundImage = `url("${first.thumb || first.src}")`;
    rotateHero();

    photos.forEach((p, i) => {
      const tile = document.createElement("button");
      tile.className = "tile";
      tile.setAttribute("aria-label", `Open frame ${i + 1}`);
      const num = String(i + 1).padStart(2, "0");
      const cap = p.caption ? escapeHtml(firstLine(p.caption)) : "";
      tile.innerHTML = `
        <img loading="lazy" src="${p.thumb || p.src}" alt="${cap || `Frame ${num}`}" />
        <div class="tile__meta">
          <span class="tile__cap">${cap}</span>
          <span class="tile__no">${num}</span>
        </div>`;
      tile.addEventListener("click", () => openLightbox(i));
      masonry.appendChild(tile);
    });

    revealOnScroll();
  }

  // Slowly cycle the hero through the first handful of frames.
  let heroIdx = 0, heroTimer = null;
  function rotateHero() {
    if (heroTimer) clearInterval(heroTimer);
    const pool = photos.slice(0, Math.min(8, photos.length));
    if (pool.length < 2) return;
    heroTimer = setInterval(() => {
      heroIdx = (heroIdx + 1) % pool.length;
      const p = pool[heroIdx];
      heroStage.style.backgroundImage = `url("${p.thumb || p.src}")`;
      heroMeta.textContent = `FRAME ${String(heroIdx + 1).padStart(2, "0")} · 24fps`;
    }, 6000);
  }

  // ---- scroll reveal ----
  function revealOnScroll() {
    const tiles = [...document.querySelectorAll(".tile")];
    if (!("IntersectionObserver" in window)) {
      tiles.forEach((t) => t.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      }),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );
    tiles.forEach((t, i) => { t.style.transitionDelay = `${(i % 3) * 60}ms`; io.observe(t); });
  }

  // ---- lightbox ----
  const lb = $("#lightbox"), lbImg = $("#lbImg"), lbCap = $("#lbCap"), lbCounter = $("#lbCounter");
  let lbIndex = 0;

  function openLightbox(i) {
    lbIndex = i; showLb(); lb.hidden = false;
    requestAnimationFrame(() => lb.classList.add("open"));
    document.body.style.overflow = "hidden";
  }
  function closeLightbox() {
    lb.classList.remove("open");
    document.body.style.overflow = "";
    setTimeout(() => (lb.hidden = true), 300);
  }
  function showLb() {
    const p = photos[lbIndex];
    lbImg.src = p.src;
    lbImg.alt = p.caption ? firstLine(p.caption) : `Frame ${lbIndex + 1}`;
    lbCap.textContent = p.caption ? firstLine(p.caption) : "";
    lbCounter.textContent = `${String(lbIndex + 1).padStart(2, "0")} / ${String(photos.length).padStart(2, "0")}`;
  }
  const step = (d) => { lbIndex = (lbIndex + d + photos.length) % photos.length; showLb(); };

  $("#lbClose").addEventListener("click", closeLightbox);
  $("#lbPrev").addEventListener("click", () => step(-1));
  $("#lbNext").addEventListener("click", () => step(1));
  lb.addEventListener("click", (e) => { if (e.target === lb) closeLightbox(); });
  document.addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowRight") step(1);
    if (e.key === "ArrowLeft") step(-1);
  });

  // ---- utils ----
  function firstLine(s) { return String(s).split("\n")[0].slice(0, 120); }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  load();
})();
