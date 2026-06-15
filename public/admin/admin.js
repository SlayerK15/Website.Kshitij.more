// admin.js — login, upload, caption editing, drag-reorder, delete.
(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const loginView = $("#loginView");
  const dashView = $("#dashView");
  const loginForm = $("#loginForm");
  const loginError = $("#loginError");
  const grid = $("#grid");
  const dropZone = $("#dropZone");
  const fileInput = $("#fileInput");
  const dropLabel = $("#dropLabel");

  // Smaller than the original camera file, but plenty for a masonry grid
  // and lightbox — keeps uploads and page loads fast.
  const MAX_DIM = 1600;
  const JPEG_QUALITY = 0.78;

  // ---- auth ----
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    const password = $("#password").value;
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      loginError.textContent = data.error || "Login failed";
      loginError.hidden = false;
      return;
    }
    showDashboard();
  });

  $("#logoutBtn").addEventListener("click", async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    loginView.hidden = false;
    dashView.hidden = true;
    $("#password").value = "";
  });

  async function showDashboard() {
    loginView.hidden = true;
    dashView.hidden = false;
    await loadPhotos();
  }

  // If already logged in (valid cookie), skip the login form.
  (async () => {
    const res = await fetch("/api/admin/photos");
    if (res.ok) showDashboard();
  })();

  // ---- load + render ----
  let photos = [];

  async function loadPhotos() {
    const res = await fetch("/api/admin/photos");
    if (res.status === 401) {
      loginView.hidden = false;
      dashView.hidden = true;
      return;
    }
    const data = await res.json();
    photos = data.photos || [];
    render();
  }

  function render() {
    grid.innerHTML = "";
    if (!photos.length) {
      grid.innerHTML = `<p class="admin-empty">No photos yet — add some above.</p>`;
      return;
    }
    photos.forEach((p) => {
      const tile = document.createElement("div");
      tile.className = "admin-tile";
      tile.draggable = true;
      tile.dataset.id = p.id;
      tile.innerHTML = `
        <img src="${p.src}" alt="" loading="lazy" />
        <div class="admin-tile__body">
          <textarea class="admin-tile__cap" rows="2" placeholder="Caption">${escapeHtml(p.caption || "")}</textarea>
          <div class="admin-tile__row">
            <span></span>
            <button class="admin-tile__del" title="Delete" aria-label="Delete">&times;</button>
          </div>
        </div>`;
      grid.appendChild(tile);

      const cap = tile.querySelector(".admin-tile__cap");
      cap.addEventListener("change", () => updateCaption(p.id, cap.value));

      tile.querySelector(".admin-tile__del").addEventListener("click", () => deletePhoto(p.id));

      tile.addEventListener("dragstart", () => tile.classList.add("dragging"));
      tile.addEventListener("dragend", () => { tile.classList.remove("dragging"); persistOrder(); });
    });

    grid.addEventListener("dragover", (e) => {
      e.preventDefault();
      const dragging = grid.querySelector(".dragging");
      if (!dragging) return;
      const after = [...grid.querySelectorAll(".admin-tile:not(.dragging)")].find((el) => {
        const r = el.getBoundingClientRect();
        return e.clientY < r.top + r.height / 2;
      });
      if (after) grid.insertBefore(dragging, after);
      else grid.appendChild(dragging);
    });
  }

  // ---- mutations ----
  async function updateCaption(id, caption) {
    await fetch("/api/admin/photos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, caption }),
    });
  }

  async function persistOrder() {
    const order = [...grid.querySelectorAll(".admin-tile")].map((t) => t.dataset.id);
    const res = await fetch("/api/admin/photos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order }),
    });
    const data = await res.json();
    photos = data.photos || photos;
  }

  async function deletePhoto(id) {
    if (!confirm("Delete this photo?")) return;
    const res = await fetch("/api/admin/photos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Delete failed");
      return;
    }
    photos = data.photos || [];
    render();
  }

  // ---- upload ----
  // dropZone is a <label> for fileInput, so clicking it already opens the
  // picker natively — no extra fileInput.click() needed here.
  fileInput.addEventListener("change", () => handleFiles(fileInput.files));

  ["dragenter", "dragover"].forEach((evt) =>
    dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.add("drag"); })
  );
  ["dragleave", "drop"].forEach((evt) =>
    dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.remove("drag"); })
  );
  dropZone.addEventListener("drop", (e) => handleFiles(e.dataTransfer.files));

  async function handleFiles(fileList) {
    const files = [...fileList].filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    for (let i = 0; i < files.length; i++) {
      dropLabel.textContent = `Uploading ${i + 1} / ${files.length}…`;
      try {
        const dataUrl = await resizeImage(files[i]);
        const res = await fetch("/api/admin/photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: files[i].name, dataUrl }),
        });
        if (res.ok) {
          const { photo } = await res.json();
          photos = [photo, ...photos];
        }
      } catch {
        /* skip files that fail to process */
      }
    }
    dropLabel.textContent = "+ Add photos";
    fileInput.value = "";
    render();
  }

  // Downscale + re-encode as JPEG so uploads stay small and consistent.
  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = () => { img.src = reader.result; };
      reader.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          const scale = MAX_DIM / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
})();
