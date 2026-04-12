/*
 * Author: Aldo Medina and Rania Dayekh
 * Created on: January 11, 2026
 * Last updated: April 12, 2026
 * Purpose: Shares small frontend helpers for requests, dates, money, and toasts.
 */

// =============================================
// QUERY STRING HELPERS
// =============================================

export function readQueryParams() {
  const out = {};
  const p = new URLSearchParams(location.search);
  for (const [k, v] of p.entries()) out[k] = v;
  return out;
}

export function setQueryParams(basePath, params = {}) {
  const url = new URL(basePath, location.origin);

  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s === "") continue;
    url.searchParams.set(k, s);
  }

  return url.pathname + (url.search ? url.search : "");
}

// =============================================
// API HELPERS
// =============================================

async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}

export async function apiGet(path) {
  try {
    const res = await fetch(path, { credentials: "include" });
    const data = await safeJson(res);

    if (!res.ok) {
      return {
        ok: false,
        error: (data && (data.error || data.message)) || `Request failed (${res.status})`,
        status: res.status,
      };
    }
    return data || { ok: true };
  } catch {
    return { ok: false, error: "Network error." };
  }
}

export async function apiPost(path, body) {
  try {
    const res = await fetch(path, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });

    const data = await safeJson(res);

    if (!res.ok) {
      return {
        ok: false,
        error: (data && (data.error || data.message)) || `Request failed (${res.status})`,
        status: res.status,
      };
    }
    return data || { ok: true };
  } catch {
    return { ok: false, error: "Network error." };
  }
}

// =============================================
// FORMATTERS AND DATE HELPERS
// =============================================

export function money(cents) {
  const n = Number(cents);
  if (!Number.isFinite(n)) return "$0.00";
  return `$${(n / 100).toFixed(2)}`;
}

export function daysBetween(startISO, endISO) {
  const s = Date.parse(startISO + "T00:00:00");
  const e = Date.parse(endISO + "T00:00:00");
  if (Number.isNaN(s) || Number.isNaN(e)) return 0;
  return Math.max(0, Math.round((e - s) / (1000 * 60 * 60 * 24)));
}

export function toISODate(d) {
  const dt = (d instanceof Date) ? d : new Date(d);
  return dt.toISOString().slice(0, 10);
}

export function addDays(dateObj, n) {
  const d = (dateObj instanceof Date) ? new Date(dateObj) : new Date(dateObj);
  d.setDate(d.getDate() + Number(n || 0));
  return d;
}

export function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return toISODate(d);
}

export function addDaysISO(isoDate, n) {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + Number(n || 0));
  return toISODate(d);
}

// =============================================
// TOAST HELPERS
// =============================================

let _toastTimer = null;

export function showToast(title, sub = "") {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    document.body.appendChild(t);
  }

  t.innerHTML =
    `<div style="font-weight:950">${escapeHtml(String(title))}</div>` +
    (sub ? `<div class="toastSub">${escapeHtml(String(sub))}</div>` : "");

  t.classList.add("toastShow");

  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove("toastShow"), 2400);
}

function escapeHtml(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// =============================================
// PHOTO HELPERS
// =============================================

// This goes through the backend route so the browser never calls Unsplash directly.
export async function getUnsplashPhotoForCar(car) {
  const q = `${car.year} ${car.make} ${car.model} car`;
  const r = await apiGet(`/api/photos/unsplash?query=${encodeURIComponent(q)}`);
  return r.ok ? r.photo : null;
}
