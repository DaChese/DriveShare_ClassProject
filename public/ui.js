
export function qs(sel, root=document){ return root.querySelector(sel); }

export async function apiGet(url){
  const r = await fetch(url);
  return r.json();
}

export async function apiPost(url, body){
  const r = await fetch(url,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(body || {})
  });
  return r.json();
}

export function money(cents){
  return '$' + (Number(cents || 0)/100).toFixed(2);
}

export function toISODate(d){
  return d.toISOString().slice(0,10);
}

export function addDays(date, n){
  const x = new Date(date);
  x.setDate(x.getDate() + n);
  return x;
}

export function daysBetween(start, end){
  const ms = Date.parse(end) - Date.parse(start);
  return Math.max(1, Math.ceil(ms/(1000*60*60*24)));
}

export function setQueryParams(url, params){
  const u = new URL(url, location.origin);
  for(const [k,v] of Object.entries(params)){
    if(v == null || String(v).trim() === '') u.searchParams.delete(k);
    else u.searchParams.set(k, String(v));
  }
  return u.pathname + '?' + u.searchParams.toString();
}

export function readQueryParams(){
  const p = new URLSearchParams(location.search);
  const o = {};
  for(const [k,v] of p.entries()) o[k]=v;
  return o;
}

let _toastTimer = null;

export function showToast(title, sub=''){
  let t = document.getElementById('toast');
  if(!t){
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }

  t.innerHTML =
    `<div style="font-weight:950">${escapeHtml(String(title))}</div>` +
    (sub ? `<div class="toastSub">${escapeHtml(String(sub))}</div>` : '');

  t.classList.add('toastShow');

  if(_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(()=> t.classList.remove('toastShow'), 2400);
}

function escapeHtml(s){
  return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}

export function carPhotoUrl(car, w = 800, h = 600) {
  const make = String(car?.make || "car");
  const model = String(car?.model || "photo");
  const year = String(car?.year || "0000");

  const seed = `${make}-${model}-${year}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `https://picsum.photos/seed/${seed}/${w}/${h}`;
}