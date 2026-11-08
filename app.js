/* Cay's Money Tracker — app.js
   Semua data disimpan lokal di perangkat (IndexedDB, cadangan: localStorage). */
(function () {
  'use strict';

  /* ================= Konstanta ================= */
  var APP_ID = 'cays-money-tracker';
  var BACKUP_FORMAT = 3;
  var FALLBACK_CAT = 'lainnya';
  var NBSP = ' ';
  var DEFAULT_CURRENCY = 'RUB';

  // after: simbol di belakang angka; group: pemisah ribuan (default titik)
  var CURRENCIES = {
    RUB: { symbol: '₽', name: 'Rubel Rusia', decimals: 2, after: true, group: NBSP },
    IDR: { symbol: 'Rp', name: 'Rupiah', decimals: 0 },
    USD: { symbol: '$', name: 'Dolar AS', decimals: 2 },
    EUR: { symbol: '€', name: 'Euro', decimals: 2 },
    SGD: { symbol: 'S$', name: 'Dolar Singapura', decimals: 2 },
    MYR: { symbol: 'RM', name: 'Ringgit Malaysia', decimals: 2 },
    JPY: { symbol: '¥', name: 'Yen Jepang', decimals: 0 },
    GBP: { symbol: '£', name: 'Pound Inggris', decimals: 2 },
    AUD: { symbol: 'A$', name: 'Dolar Australia', decimals: 2 },
    SAR: { symbol: 'SAR', name: 'Riyal Saudi', decimals: 2 }
  };

  var PALETTE = ['#f97316', '#0ea5e9', '#ec4899', '#eab308', '#8b5cf6', '#10b981',
    '#22c55e', '#94a3b8', '#ef4444', '#14b8a6', '#6366f1', '#a16207'];

  var DEFAULT_CATEGORIES = [
    { id: 'makanan', name: 'Makanan', type: 'expense', emoji: '🍜', color: '#f97316', order: 0 },
    { id: 'transportasi', name: 'Transportasi', type: 'expense', emoji: '🚌', color: '#0ea5e9', order: 1 },
    { id: 'belanja', name: 'Belanja', type: 'expense', emoji: '🛍️', color: '#ec4899', order: 2 },
    { id: 'tagihan', name: 'Tagihan', type: 'expense', emoji: '🧾', color: '#eab308', order: 3 },
    { id: 'hiburan', name: 'Hiburan', type: 'expense', emoji: '🎬', color: '#8b5cf6', order: 4 },
    { id: 'kesehatan', name: 'Kesehatan', type: 'expense', emoji: '💊', color: '#10b981', order: 5 },
    { id: 'gaji', name: 'Gaji', type: 'income', emoji: '💼', color: '#22c55e', order: 6 },
    { id: 'lainnya', name: 'Lainnya', type: 'both', emoji: '📦', color: '#94a3b8', order: 999 }
  ];

  var EMOJIS = ['🏷️', '🍜', '🍔', '☕', '🛒', '🛍️', '🚌', '🚗', '⛽', '🏠', '💡', '📱',
    '🧾', '🎬', '🎮', '🎵', '✈️', '💊', '🏥', '🎓', '📚', '🎁', '💼', '💰',
    '📦', '🐾', '👶', '💇', '🏋️', '🙏'];

  var DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  var MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
    'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  var TYPE_LABEL = { expense: 'Pengeluaran', income: 'Pemasukan', both: 'Pemasukan & pengeluaran' };

  var WISH_KINDS = [
    { id: 'elektronik', name: 'Elektronik', emoji: '💻' },
    { id: 'travelling', name: 'Travelling', emoji: '✈️' },
    { id: 'makanan', name: 'Makanan impian', emoji: '🍰' },
    { id: 'fashion', name: 'Fashion', emoji: '👟' },
    { id: 'kendaraan', name: 'Kendaraan', emoji: '🛵' },
    { id: 'lainnya', name: 'Lainnya', emoji: '🎁' }
  ];

  /* ================= State ================= */
  var state = {
    tx: [],
    cats: [],
    wish: [],
    settings: { currency: DEFAULT_CURRENCY, theme: 'system', lastBackup: null, openingBalance: 0, openingAsked: false }
  };
  var ui = { view: 'home', historyMonth: null, search: '' };

  var root = document.documentElement;
  function $(sel, scope) { return (scope || document).querySelector(sel); }
  function $all(sel, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(sel)); }

  /* ================= Utilitas ================= */
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }

  function uid() {
    if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toDateStr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function todayStr() { return toDateStr(new Date()); }
  function parseDate(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function monthOf(s) { return s.slice(0, 7); }
  function monthLabel(key) { var p = key.split('-'); return MONTHS[+p[1] - 1] + ' ' + p[0]; }
  function dateLong(s) { var d = parseDate(s); return DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function dateShort(s) {
    var d = parseDate(s);
    var out = d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3);
    if (d.getFullYear() !== new Date().getFullYear()) out += ' ' + d.getFullYear();
    return out;
  }
  function dayLabel(s) {
    var today = todayStr();
    if (s === today) return 'Hari ini';
    var y = new Date(); y.setDate(y.getDate() - 1);
    if (s === toDateStr(y)) return 'Kemarin';
    return dateLong(s);
  }

  function cur() { return CURRENCIES[state.settings.currency] || CURRENCIES[DEFAULT_CURRENCY]; }

  function roundTo(n, decimals) { var f = Math.pow(10, decimals); return Math.round(n * f) / f; }

  function groupThousands(intStr, sep) { return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, sep || '.'); }

  // Rupiah: 1250000 -> "1.250.000" ; Rubel: 1250000 -> "1 250 000", 89.9 -> "89,90"
  // Sen/kopek ",00" disembunyikan supaya angka tetap ringkas.
  function formatNumber(n, c) {
    var parts = Math.abs(n).toFixed(c.decimals).split('.');
    var s = groupThousands(parts[0], c.group);
    if (parts[1] && !/^0+$/.test(parts[1])) s += ',' + parts[1];
    return s;
  }

  // formatMoney(1250000) -> "1 250 000 ₽" (Rubel) atau "Rp 1.250.000" (Rupiah); negatif diawali "−"
  function formatMoney(n, withSign) {
    var c = cur();
    var v = roundTo(n || 0, c.decimals);
    var num = formatNumber(v, c);
    var body = c.after ? num + NBSP + c.symbol : c.symbol + ' ' + num;
    if (v < 0) return '−' + body;
    if (withSign && v > 0) return '+' + body;
    return body;
  }

  // Merapikan isi kolom nominal saat diketik: "1250000" -> "1 250 000" (Rubel) / "1.250.000" (Rupiah)
  function sanitizeAmount(value, c) {
    c = c || cur();
    var v = String(value || '');
    if (!c.decimals) {
      var digits = v.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 13);
      return digits ? groupThousands(digits, c.group) : '';
    }
    if (v.indexOf(',') === -1) {
      // Rubel memakai spasi untuk ribuan, jadi titik pasti tanda desimal (juga saat ditempel: "349.90").
      if (c.group && c.group !== '.') v = v.replace('.', ',');
      else if (/\.$/.test(v)) v = v.slice(0, -1) + ',';
    }
    var idx = v.indexOf(',');
    var intPart = (idx === -1 ? v : v.slice(0, idx)).replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 13);
    var frac = idx === -1 ? null : v.slice(idx + 1).replace(/\D/g, '').slice(0, c.decimals);
    var out = intPart ? groupThousands(intPart, c.group) : (frac !== null ? '0' : '');
    if (frac !== null) out += ',' + frac;
    return out;
  }

  // Koma selalu jadi pemisah desimal; titik/spasi ribuan diabaikan.
  function parseAmount(str) {
    if (!str) return 0;
    var n = Number(String(str).replace(/[^\d,]/g, '').replace(',', '.'));
    return isFinite(n) ? n : 0;
  }

  function amountForInput(n) {
    var c = cur();
    if (!n) return '';
    if (!c.decimals) return groupThousands(String(Math.round(n)), c.group);
    return formatNumber(n, c);
  }

  // Pasang simbol mata uang (depan/belakang) dan jenis keypad di semua kolom nominal.
  function applyCurrencyToFields() {
    var c = cur();
    $all('.cur-before').forEach(function (el) { el.textContent = c.symbol; el.hidden = !!c.after; });
    $all('.cur-after').forEach(function (el) { el.textContent = c.symbol; el.hidden = !c.after; });
    $all('.money-input').forEach(function (el) { el.setAttribute('inputmode', c.decimals ? 'decimal' : 'numeric'); });
  }

  /* ================= Penyimpanan ================= */
  var DB_NAME = 'cays-money-tracker';
  var DB_VERSION = 2;
  var STORES = ['transactions', 'categories', 'settings', 'wishlist'];
  var KEYS = { transactions: 'id', categories: 'id', settings: 'key', wishlist: 'id' };
  var db = null;

  function openDB() {
    return new Promise(function (resolve, reject) {
      if (!('indexedDB' in window) || !window.indexedDB) { reject(new Error('IndexedDB tidak tersedia')); return; }
      var req;
      try { req = indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { reject(e); return; }
      req.onupgradeneeded = function () {
        var d = req.result;
        STORES.forEach(function (name) {
          if (!d.objectStoreNames.contains(name)) d.createObjectStore(name, { keyPath: KEYS[name] });
        });
      };
      req.onsuccess = function () {
        var d = req.result;
        // Jika versi baru aplikasi dibuka di tab lain, lepaskan database lama lalu muat ulang.
        d.onversionchange = function () { d.close(); location.reload(); };
        resolve(d);
      };
      req.onerror = function () { reject(req.error); };
      req.onblocked = function () { toast('Tutup tab lain yang membuka aplikasi ini, lalu buka ulang.'); };
    });
  }

  function reqP(r) {
    return new Promise(function (resolve, reject) {
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
    });
  }

  function txDone(t) {
    return new Promise(function (resolve, reject) {
      t.oncomplete = function () { resolve(); };
      t.onerror = function () { reject(t.error); };
      t.onabort = function () { reject(t.error || new Error('Transaksi database dibatalkan')); };
    });
  }

  function lsKey(name) { return 'cmt-store-' + name; }
  function lsRead(name) {
    try { var v = JSON.parse(localStorage.getItem(lsKey(name))); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }
  function lsWrite(name, arr) { localStorage.setItem(lsKey(name), JSON.stringify(arr)); }

  var store = {
    all: function (name) {
      if (!db) return Promise.resolve(lsRead(name));
      return reqP(db.transaction(name, 'readonly').objectStore(name).getAll());
    },
    putMany: function (name, items) {
      if (!items.length) return Promise.resolve();
      if (!db) {
        try {
          var k = KEYS[name], arr = lsRead(name);
          items.forEach(function (it) {
            var i = arr.findIndex(function (x) { return x[k] === it[k]; });
            if (i >= 0) arr[i] = it; else arr.push(it);
          });
          lsWrite(name, arr);
          return Promise.resolve();
        } catch (e) { return Promise.reject(e); }
      }
      var t = db.transaction(name, 'readwrite');
      var s = t.objectStore(name);
      items.forEach(function (it) { s.put(it); });
      return txDone(t);
    },
    put: function (name, item) { return store.putMany(name, [item]); },
    removeMany: function (name, keys) {
      if (!keys.length) return Promise.resolve();
      if (!db) {
        try {
          var k = KEYS[name];
          lsWrite(name, lsRead(name).filter(function (x) { return keys.indexOf(x[k]) === -1; }));
          return Promise.resolve();
        } catch (e) { return Promise.reject(e); }
      }
      var t = db.transaction(name, 'readwrite');
      var st = t.objectStore(name);
      keys.forEach(function (key) { st.delete(key); });
      return txDone(t);
    },
    remove: function (name, key) {
      if (!db) {
        try {
          var k = KEYS[name];
          lsWrite(name, lsRead(name).filter(function (x) { return x[k] !== key; }));
          return Promise.resolve();
        } catch (e) { return Promise.reject(e); }
      }
      var t = db.transaction(name, 'readwrite');
      t.objectStore(name).delete(key);
      return txDone(t);
    },
    replaceAll: function (data) {
      if (!db) {
        try { STORES.forEach(function (n) { lsWrite(n, data[n] || []); }); return Promise.resolve(); }
        catch (e) { return Promise.reject(e); }
      }
      var t = db.transaction(STORES, 'readwrite');
      STORES.forEach(function (n) {
        var s = t.objectStore(n);
        s.clear();
        (data[n] || []).forEach(function (it) { s.put(it); });
      });
      return txDone(t);
    }
  };

  function setSetting(key, value) {
    state.settings[key] = value;
    return store.put('settings', { key: key, value: value }).catch(function (err) {
      console.warn('Gagal menyimpan pengaturan', err);
    });
  }

  var persistAsked = false;
  function requestPersist() {
    if (persistAsked) return;
    persistAsked = true;
    try {
      if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persisted().then(function (p) { if (!p) return navigator.storage.persist(); }).catch(function () {});
      }
    } catch (e) { /* abaikan */ }
  }

  /* ================= Kategori ================= */
  function fallbackCat() {
    return state.cats.find(function (c) { return c.id === FALLBACK_CAT; }) || DEFAULT_CATEGORIES[DEFAULT_CATEGORIES.length - 1];
  }
  function getCat(id) {
    return state.cats.find(function (c) { return c.id === id; }) || fallbackCat();
  }
  function sortedCats() {
    return state.cats.slice().sort(function (a, b) {
      var fa = a.id === FALLBACK_CAT ? 1 : 0, fb = b.id === FALLBACK_CAT ? 1 : 0;
      if (fa !== fb) return fa - fb;
      if ((a.order || 0) !== (b.order || 0)) return (a.order || 0) - (b.order || 0);
      return a.name.localeCompare(b.name);
    });
  }
  function catsForType(type) {
    return sortedCats().filter(function (c) { return c.type === 'both' || c.type === type; });
  }
  function catFits(id, type) {
    var c = state.cats.find(function (x) { return x.id === id; });
    return !!c && (c.type === 'both' || c.type === type);
  }
  function defaultCatFor(type) {
    var last = state.settings[type === 'income' ? 'lastCatIncome' : 'lastCatExpense'];
    if (last && catFits(last, type)) return last;
    var list = catsForType(type);
    return list.length ? list[0].id : FALLBACK_CAT;
  }
  function nextOrder() {
    var max = 0;
    state.cats.forEach(function (c) { if (c.id !== FALLBACK_CAT && (c.order || 0) > max) max = c.order || 0; });
    return max + 1;
  }

  /* ================= Tema ================= */
  var darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function applyTheme(theme) {
    if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
    else root.removeAttribute('data-theme');
    try { localStorage.setItem('cmt-theme', theme || 'system'); } catch (e) { /* abaikan */ }
    updateThemeColor();
  }
  function isDark() {
    var t = root.getAttribute('data-theme');
    if (t) return t === 'dark';
    return !!(darkQuery && darkQuery.matches);
  }
  function updateThemeColor() {
    var meta = $('#meta-theme');
    if (meta) meta.setAttribute('content', isDark() ? '#1d1b47' : '#4f46e5');
  }

  /* ================= Tampilan (render) ================= */
  function sortDesc(a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  }

  function emptyHTML(icon, text) {
    return '<div class="empty"><span class="empty-ico" aria-hidden="true">' + icon + '</span>' + esc(text) + '</div>';
  }

  function wishById(id) {
    return state.wish.find(function (w) { return w.id === id; }) || null;
  }

  // Saldo = saldo awal + pemasukan − pengeluaran − transfer ke tabungan.
  function computeBalance() {
    var bal = Number(state.settings.openingBalance) || 0;
    state.tx.forEach(function (t) { bal += t.type === 'income' ? t.amount : -t.amount; });
    return roundTo(bal, cur().decimals);
  }

  // Cara sebuah transaksi ditampilkan (transfer memakai nama impiannya).
  function txLook(t) {
    if (t.type === 'transfer') {
      var w = wishById(t.wishId);
      var k = w ? wishKind(w.kind) : WISH_KINDS[WISH_KINDS.length - 1];
      return { title: 'Ke tabungan: ' + (w ? w.name : 'impian dihapus'), emoji: k.emoji, color: '#6366f1', label: 'Transfer' };
    }
    var c = getCat(t.categoryId);
    return { title: c.name, emoji: c.emoji, color: c.color, label: t.type === 'income' ? 'Pemasukan' : 'Pengeluaran' };
  }

  function txItemHTML(t, showDate) {
    var look = txLook(t);
    var amt = (t.type === 'income' ? '+' : '−') + formatMoney(t.amount);
    var sub = [showDate ? dateShort(t.date) : '', t.note || ''].filter(Boolean).join(' · ');
    return '<li><button type="button" class="tx" data-id="' + esc(t.id) + '" aria-label="' +
      esc(look.label + ' ' + look.title + ' ' + formatMoney(t.amount) + (t.note ? ', ' + t.note : '') + '. Ketuk untuk mengubah') + '">' +
      '<span class="tx-icon" style="--c:' + esc(look.color) + '" aria-hidden="true">' + esc(look.emoji) + '</span>' +
      '<span class="tx-main"><span class="tx-cat">' + esc(look.title) + '</span>' +
      (sub ? '<span class="tx-note">' + esc(sub) + '</span>' : '') + '</span>' +
      '<span class="tx-amt ' + t.type + '">' + esc(amt) + '</span></button></li>';
  }

  function renderHome() {
    var today = todayStr();
    var mk = monthOf(today);
    var inc = 0, exp = 0, saved = 0, tInc = 0, tExp = 0, tSaved = 0;
    var byCat = new Map();
    state.tx.forEach(function (t) {
      var inMonth = monthOf(t.date) === mk;
      var isToday = t.date === today;
      if (t.type === 'income') {
        if (inMonth) inc += t.amount;
        if (isToday) tInc += t.amount;
      } else if (t.type === 'transfer') {
        if (inMonth) saved += t.amount;
        if (isToday) tSaved += t.amount;
      } else {
        if (inMonth) {
          exp += t.amount;
          var id = getCat(t.categoryId).id;
          byCat.set(id, (byCat.get(id) || 0) + t.amount);
        }
        if (isToday) tExp += t.amount;
      }
    });

    var opening = Number(state.settings.openingBalance) || 0;
    $('#home-balance').textContent = formatMoney(computeBalance());
    $('#home-balance-sub').textContent = opening
      ? 'Termasuk saldo awal ' + formatMoney(opening)
      : 'Pemasukan − pengeluaran − transfer ke tabungan';
    $('#home-month').textContent = 'Bulan ini · ' + monthLabel(mk);
    $('#home-income').textContent = formatMoney(inc);
    $('#home-expense').textContent = formatMoney(exp);
    var savedEl = $('#home-saved');
    savedEl.hidden = !(saved > 0);
    savedEl.textContent = 'Ditransfer ke tabungan impian bulan ini: ' + formatMoney(saved);

    // Hari ini
    var d = parseDate(today);
    $('#home-today-date').textContent = 'Pengeluaran hari ini · ' + DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
    $('#home-today-expense').textContent = formatMoney(tExp);
    var extra = [];
    if (tInc) extra.push('Pemasukan ' + formatMoney(tInc));
    if (tSaved) extra.push('Ke tabungan ' + formatMoney(tSaved));
    var extraEl = $('#home-today-extra');
    extraEl.textContent = extra.join(' · ');
    extraEl.hidden = !extra.length;
    var todays = state.tx.filter(function (t) { return t.date === today; }).sort(sortDesc);
    $('#home-today').innerHTML = todays.length
      ? '<ul class="tx-list">' + todays.map(function (t) { return txItemHTML(t, false); }).join('') + '</ul>'
      : emptyHTML('☀️', 'Belum ada transaksi hari ini. Ketuk tombol + untuk mencatat.');

    renderBudgets(byCat);
    renderChart(byCat, exp);
    fitHome();
  }

  /* ---------- Anggaran ---------- */
  function budgetCats() {
    return sortedCats().filter(function (c) { return c.budget > 0 && c.type !== 'income'; });
  }

  function renderBudgets(byCat) {
    var box = $('#home-budget');
    var list = budgetCats();
    if (!list.length) {
      box.innerHTML = '<div class="budget-empty"><p class="hint">Belum ada anggaran. Atur batas belanja per kategori, misalnya Internet ' +
        esc(formatMoney(970)) + ' dan Makanan ' + esc(formatMoney(1500)) + ' per bulan.</p>' +
        '<button type="button" class="btn btn-secondary btn-block" data-budget-open>Atur anggaran</button></div>';
      return;
    }
    var totalBudget = 0, totalUsed = 0;
    var rows = list.map(function (c) {
      var used = byCat.get(c.id) || 0;
      totalBudget += c.budget;
      totalUsed += used;
      var pct = used / c.budget * 100;
      var cls = pct > 100 ? ' over' : pct >= 80 ? ' warn' : '';
      var left = roundTo(c.budget - used, cur().decimals);
      return '<li class="budget' + cls + '">' +
        '<div class="budget-top"><span class="budget-name">' + esc(c.emoji) + ' ' + esc(c.name) + '</span>' +
        '<span class="budget-nums"><strong>' + esc(formatMoney(used)) + '</strong> / ' + esc(formatMoney(c.budget)) + '</span></div>' +
        '<div class="progress" role="progressbar" aria-label="' + esc('Anggaran ' + c.name + ' terpakai') + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
        Math.min(100, Math.round(pct)) + '"><span style="width:' + Math.min(100, pct).toFixed(1) + '%"></span></div>' +
        '<p class="budget-left">' + (left >= 0 ? 'Sisa ' + esc(formatMoney(left)) : 'Lebih ' + esc(formatMoney(-left))) +
        ' · ' + Math.round(pct) + '%</p></li>';
    });
    var now = new Date();
    var next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    box.innerHTML = '<p class="budget-total">Terpakai <strong>' + esc(formatMoney(totalUsed)) + '</strong> dari ' +
      esc(formatMoney(totalBudget)) + '</p><ul class="budget-list">' + rows.join('') + '</ul>' +
      '<p class="hint">Mulai dari nol lagi pada 1 ' + MONTHS[next.getMonth()] + '.</p>';
  }

  // Mengecilkan huruf nominal yang sangat panjang supaya tetap muat di layar sempit.
  function fitText(el, max, min) {
    if (!el) return;
    el.style.fontSize = max + 'px';
    el.style.whiteSpace = '';
    if (!el.clientWidth) return;
    var size = max;
    while (el.scrollWidth > el.clientWidth + 1 && size > min) {
      size -= 1;
      el.style.fontSize = size + 'px';
    }
    if (el.scrollWidth > el.clientWidth + 1) el.style.whiteSpace = 'normal';
  }

  function fitHome() {
    if ($('#view-home').hidden) return;
    fitText($('#home-balance'), 34, 20);
    fitText($('#home-income'), 17, 11);
    fitText($('#home-expense'), 17, 11);
    fitText($('#home-chart .donut-center strong'), 15, 10);
  }

  function renderChart(byCat, total) {
    var box = $('#home-chart');
    if (!(total > 0)) { box.innerHTML = emptyHTML('📊', 'Belum ada pengeluaran bulan ini.'); return; }

    var items = [];
    byCat.forEach(function (value, id) { items.push({ cat: getCat(id), value: value }); });
    items.sort(function (a, b) { return b.value - a.value; });

    var R = 54, C = 2 * Math.PI * R;
    var gap = items.length > 1 ? 1.6 : 0;
    var offset = 0, segs = '';
    items.forEach(function (it) {
      var len = it.value / total * C;
      var dash = Math.max(len - gap, 0.6);
      segs += '<circle cx="70" cy="70" r="' + R + '" fill="none" stroke="' + esc(it.cat.color) +
        '" stroke-width="20" stroke-dasharray="' + dash.toFixed(3) + ' ' + (C - dash).toFixed(3) +
        '" stroke-dashoffset="' + (-offset).toFixed(3) + '"/>';
      offset += len;
    });

    var totalStr = formatMoney(total);
    var legend = items.map(function (it) {
      var p = it.value / total * 100;
      var pct = p < 1 ? '<1%' : Math.round(p) + '%';
      return '<li><span class="dot" style="background:' + esc(it.cat.color) + '" aria-hidden="true"></span>' +
        '<span class="lg-name">' + esc(it.cat.emoji) + ' ' + esc(it.cat.name) + '</span>' +
        '<span class="lg-val"><strong>' + esc(formatMoney(it.value)) + '</strong><small>' + pct + '</small></span></li>';
    }).join('');

    box.innerHTML = '<div class="chart">' +
      '<div class="donut"><svg viewBox="0 0 140 140" role="img" aria-label="Grafik pengeluaran per kategori bulan ini">' +
      '<g transform="rotate(-90 70 70)"><circle class="donut-track" cx="70" cy="70" r="' + R + '" fill="none" stroke-width="20"/>' + segs + '</g></svg>' +
      '<div class="donut-center"><span>Total</span><strong>' + esc(totalStr) + '</strong></div></div>' +
      '<ul class="legend">' + legend + '</ul></div>';
  }

  function historyMonths() {
    var set = new Set(state.tx.map(function (t) { return monthOf(t.date); }));
    set.add(monthOf(todayStr()));
    return Array.from(set).sort().reverse();
  }

  function renderHistory() {
    var months = historyMonths();
    var current = monthOf(todayStr());
    if (!ui.historyMonth || (ui.historyMonth !== 'all' && months.indexOf(ui.historyMonth) === -1)) ui.historyMonth = current;

    var sel = $('#month-select');
    sel.innerHTML = '<option value="all">Semua bulan</option>' + months.map(function (m) {
      return '<option value="' + m + '">' + monthLabel(m) + '</option>';
    }).join('');
    sel.value = ui.historyMonth;

    var idx = months.indexOf(ui.historyMonth);
    $('#month-prev').disabled = ui.historyMonth === 'all' || idx >= months.length - 1;
    $('#month-next').disabled = ui.historyMonth === 'all' || idx <= 0;

    var q = ui.search.trim().toLowerCase();
    var items = state.tx.filter(function (t) { return ui.historyMonth === 'all' || monthOf(t.date) === ui.historyMonth; });
    if (q) {
      items = items.filter(function (t) {
        return (t.note || '').toLowerCase().indexOf(q) !== -1 || txLook(t).title.toLowerCase().indexOf(q) !== -1;
      });
    }
    items.sort(sortDesc);

    var inc = 0, exp = 0, moved = 0;
    items.forEach(function (t) {
      if (t.type === 'income') inc += t.amount;
      else if (t.type === 'expense') exp += t.amount;
      else moved += t.amount;
    });
    $('#history-summary').innerHTML =
      '<div class="pill income"><span>Pemasukan</span><strong>' + esc(formatMoney(inc)) + '</strong></div>' +
      '<div class="pill expense"><span>Pengeluaran</span><strong>' + esc(formatMoney(exp)) + '</strong></div>' +
      (moved ? '<div class="pill transfer wide"><span>Ditransfer ke tabungan impian</span><strong>' + esc(formatMoney(moved)) + '</strong></div>' : '');

    var list = $('#history-list');
    if (!items.length) {
      list.innerHTML = q
        ? emptyHTML('🔍', 'Tidak ada transaksi yang cocok dengan "' + ui.search.trim() + '".')
        : emptyHTML('🗓️', ui.historyMonth === 'all' ? 'Belum ada transaksi.' : 'Belum ada transaksi di bulan ini.');
      return;
    }

    var groups = [];
    items.forEach(function (t) {
      var g = groups[groups.length - 1];
      if (!g || g.date !== t.date) { g = { date: t.date, items: [], net: 0 }; groups.push(g); }
      g.items.push(t);
      g.net += t.type === 'income' ? t.amount : -t.amount;
    });

    list.innerHTML = groups.map(function (g) {
      return '<section class="day"><div class="day-head"><span>' + esc(dayLabel(g.date)) + '</span>' +
        '<span class="day-net">' + esc(formatMoney(g.net, true)) + '</span></div>' +
        '<ul class="tx-list day-list">' + g.items.map(function (t) { return txItemHTML(t, false); }).join('') + '</ul></section>';
    }).join('');
  }

  function renderSettings() {
    var sel = $('#set-currency');
    if (!sel.options.length) {
      sel.innerHTML = Object.keys(CURRENCIES).map(function (code) {
        var c = CURRENCIES[code];
        return '<option value="' + code + '">' + esc(c.name + ' (' + c.symbol + ')') + '</option>';
      }).join('');
    }
    sel.value = CURRENCIES[state.settings.currency] ? state.settings.currency : DEFAULT_CURRENCY;

    var theme = state.settings.theme || 'system';
    $all('input[name="theme"]').forEach(function (r) { r.checked = r.value === theme; });

    var chev = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
    $('#cat-list').innerHTML = sortedCats().map(function (c) {
      return '<li><button type="button" class="row-btn" data-cat="' + esc(c.id) + '">' +
        '<span class="tx-icon" style="--c:' + esc(c.color) + '" aria-hidden="true">' + esc(c.emoji) + '</span>' +
        '<span class="row-main"><span>' + esc(c.name) + '</span><small>' + TYPE_LABEL[c.type] + '</small></span>' + chev + '</button></li>';
    }).join('');

    $('#opening-value').textContent = formatMoney(Number(state.settings.openingBalance) || 0);
    var nb = budgetCats();
    $('#budget-count').textContent = nb.length
      ? nb.length + ' kategori · total ' + formatMoney(nb.reduce(function (a, c) { return a + c.budget; }, 0)) + '/bulan'
      : 'Belum diatur';

    var status = $('#backup-status');
    var lb = state.settings.lastBackup;
    if (!lb) {
      status.textContent = 'Belum pernah membuat backup.';
      status.classList.toggle('warn', state.tx.length > 0);
    } else {
      var d = new Date(lb);
      var days = Math.floor((Date.now() - d.getTime()) / 86400000);
      status.textContent = 'Backup terakhir: ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() +
        (days >= 30 ? ' (sudah lebih dari 30 hari)' : '');
      status.classList.toggle('warn', days >= 30);
    }
  }

  /* ================= Tabungan impian ================= */
  function wishKind(id) {
    return WISH_KINDS.find(function (k) { return k.id === id; }) || WISH_KINDS[WISH_KINDS.length - 1];
  }

  var MAX_PLAN_MONTHS = 1200; // 100 tahun

  function durationText(m) {
    if (m > MAX_PLAN_MONTHS) return 'lebih dari 100 tahun';
    if (m < 12) return m + ' bulan';
    var y = Math.floor(m / 12), r = m % 12;
    return y + ' tahun' + (r ? ' ' + r + ' bulan' : '');
  }

  // Sisa = harga − terkumpul. Lama = sisa ÷ tabungan per bulan, dibulatkan ke atas, dihitung mulai bulan ini.
  function wishPlan(price, monthly, saved) {
    var c = cur();
    if (!(price > 0)) return { remaining: 0, months: null, done: false };
    var remaining = Math.max(0, roundTo(price - (saved || 0), c.decimals));
    if (remaining <= 0) return { remaining: 0, months: 0, done: true };
    if (!(monthly > 0)) return { remaining: remaining, months: null, done: false };
    var months = Math.ceil(remaining / monthly - 1e-9);
    if (months > MAX_PLAN_MONTHS) return { remaining: remaining, months: months, done: false, target: null };
    var d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    return { remaining: remaining, months: months, done: false, target: MONTHS[d.getMonth()] + ' ' + d.getFullYear() };
  }

  // Total transfer dari saldo per impian.
  function transferTotals() {
    var m = new Map();
    state.tx.forEach(function (t) {
      if (t.type === 'transfer' && t.wishId) m.set(t.wishId, (m.get(t.wishId) || 0) + t.amount);
    });
    return m;
  }

  // Terkumpul = disisihkan di luar saldo + semua transfer dari saldo.
  function wishTotal(w, totals) {
    return roundTo((w.saved || 0) + ((totals || transferTotals()).get(w.id) || 0), cur().decimals);
  }

  function sortedWish(totals) {
    return state.wish.slice().sort(function (a, b) {
      var da = wishTotal(a, totals) >= a.price ? 1 : 0, db = wishTotal(b, totals) >= b.price ? 1 : 0;
      if (da !== db) return da - db;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  }

  function renderWishlist() {
    var summary = $('#wish-summary');
    var list = $('#wish-list');
    if (!state.wish.length) {
      summary.hidden = true;
      list.innerHTML = '<li>' + emptyHTML('🎯', 'Belum ada impian. Tambahkan barang elektronik, rencana jalan-jalan, makanan impian, atau apa pun, lalu lihat kira-kira berapa bulan sampai uangnya terkumpul.') + '</li>';
      return;
    }

    var totals = transferTotals();
    var totalSaved = 0, totalPrice = 0, totalMonthly = 0, done = 0;
    state.wish.forEach(function (w) {
      var got = wishTotal(w, totals);
      totalSaved += Math.min(got, w.price);
      totalPrice += w.price;
      if (got >= w.price) done++;
      else totalMonthly += w.monthly || 0;
    });
    var pctAll = totalPrice ? Math.min(100, Math.floor(totalSaved / totalPrice * 100)) : 0;
    summary.hidden = false;
    summary.innerHTML =
      '<p class="card-kicker">' + state.wish.length + ' impian' + (done ? ' · ' + done + ' sudah tercapai' : '') + '</p>' +
      '<p class="wish-total"><strong>' + esc(formatMoney(totalSaved)) + '</strong> terkumpul</p>' +
      '<p class="wish-of">dari total target ' + esc(formatMoney(totalPrice)) + '</p>' +
      '<div class="progress" role="progressbar" aria-label="Progres semua impian" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pctAll + '"><span style="width:' + pctAll + '%"></span></div>' +
      '<p class="wish-of">Rencana nabung: <b>' + esc(formatMoney(totalMonthly)) + '</b> per bulan</p>';

    var chev = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
    list.innerHTML = sortedWish(totals).map(function (w) {
      var k = wishKind(w.kind);
      var got = wishTotal(w, totals);
      var p = wishPlan(w.price, w.monthly, got);
      var pct = p.done ? 100 : Math.min(99, Math.floor(got / w.price * 100));
      var plan;
      if (p.done) plan = '<span class="ok">🎉 Dana sudah cukup untuk membelinya!</span>';
      else if (p.months === null) plan = 'Kurang ' + esc(formatMoney(p.remaining)) + '. Isi tabungan per bulan untuk melihat perkiraan.';
      else plan = 'Nabung ' + esc(formatMoney(w.monthly)) + '/bulan → <b>' + durationText(p.months) + ' lagi</b>' + (p.target ? ', sekitar ' + p.target : '');
      return '<li class="card wish' + (p.done ? ' done' : '') + '">' +
        '<button type="button" class="wish-main" data-wish="' + esc(w.id) + '" aria-label="' + esc('Ubah impian ' + w.name) + '">' +
        '<span class="wish-icon" aria-hidden="true">' + k.emoji + '</span>' +
        '<span class="wish-head"><span class="wish-name">' + esc(w.name) + '</span><small>' + esc(k.name) + '</small></span>' +
        '<span class="wish-pct">' + pct + '%</span>' + chev + '</button>' +
        '<div class="progress" role="progressbar" aria-label="' + esc('Progres ' + w.name) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><span style="width:' + pct + '%"></span></div>' +
        '<div class="wish-row"><p class="wish-amounts"><strong>' + esc(formatMoney(got)) + '</strong> dari ' + esc(formatMoney(w.price)) + '</p>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-transfer="' + esc(w.id) + '">Transfer</button></div>' +
        '<p class="wish-plan">' + plan + '</p></li>';
    }).join('');
  }

  function renderAll() { renderHome(); renderHistory(); renderWishlist(); renderSettings(); }

  function showView(name) {
    ui.view = name;
    ['home', 'history', 'wishlist', 'settings'].forEach(function (v) { $('#view-' + v).hidden = v !== name; });
    $all('.tab').forEach(function (b) {
      if (b.getAttribute('data-tab') === name) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    document.body.setAttribute('data-view', name);
    window.scrollTo(0, 0);
    if (name === 'home') fitHome();
  }

  /* ================= Urungkan (undo) / ulangi (redo) ================= */
  // Setiap perubahan data menyimpan kondisi sebelum & sesudahnya. Tema dan mata uang tidak ikut.
  var DATA_SETTINGS = ['openingBalance', 'openingAsked'];
  var HISTORY_MAX = 50;
  var undoStack = [];
  var redoStack = [];
  var historyBusy = false;

  function snapshot() {
    var s = {};
    DATA_SETTINGS.forEach(function (k) { s[k] = state.settings[k]; });
    return { tx: state.tx.slice(), cats: state.cats.slice(), wish: state.wish.slice(), settings: s };
  }

  function pushHistory(label, before) {
    undoStack.push({ label: label, before: before, after: snapshot() });
    if (undoStack.length > HISTORY_MAX) undoStack.shift();
    redoStack = [];
    updateHistoryButtons();
  }

  function applySnapshot(snap) {
    var settings = {};
    Object.keys(state.settings).forEach(function (k) { settings[k] = state.settings[k]; });
    DATA_SETTINGS.forEach(function (k) { settings[k] = snap.settings[k]; });
    var settingsArr = Object.keys(settings).map(function (k) { return { key: k, value: settings[k] }; });
    return store.replaceAll({ transactions: snap.tx, categories: snap.cats, wishlist: snap.wish, settings: settingsArr }).then(function () {
      state.tx = snap.tx.slice();
      state.cats = snap.cats.slice();
      state.wish = snap.wish.slice();
      state.settings = settings;
      renderAll();
    });
  }

  function stepHistory(from, to, useAfter, prefix) {
    if (historyBusy || !from.length || sheetStack.length) return;
    var entry = from.pop();
    historyBusy = true;
    applySnapshot(useAfter ? entry.after : entry.before).then(function () {
      to.push(entry);
      toast(prefix + entry.label);
    }).catch(function (err) {
      console.warn(err);
      from.push(entry);
      toast('Gagal, coba lagi.');
    }).then(function () {
      historyBusy = false;
      updateHistoryButtons();
    });
  }

  function undo() { stepHistory(undoStack, redoStack, false, 'Dibatalkan: '); }
  function redo() { stepHistory(redoStack, undoStack, true, 'Diulang: '); }

  function updateHistoryButtons() {
    var u = $('#btn-undo'), r = $('#btn-redo');
    var lu = undoStack.length ? undoStack[undoStack.length - 1].label : '';
    var lr = redoStack.length ? redoStack[redoStack.length - 1].label : '';
    u.disabled = !lu;
    r.disabled = !lr;
    u.title = lu ? 'Urungkan: ' + lu : 'Belum ada yang bisa diurungkan';
    r.title = lr ? 'Ulangi: ' + lr : 'Belum ada yang bisa diulang';
    u.setAttribute('aria-label', u.title);
    r.setAttribute('aria-label', r.title);
  }

  /* ================= Sheet & tombol kembali ================= */
  var sheetStack = [];
  var historyArmed = false;
  var ignoreNextPop = false;
  var pendingArm = false;
  var usingKeyboard = false;
  document.addEventListener('keydown', function (e) { if (e.key === 'Tab') usingKeyboard = true; }, true);
  document.addEventListener('pointerdown', function () { usingKeyboard = false; }, true);

  function openSheet(el) {
    el._returnFocus = document.activeElement;
    el.hidden = false;
    void el.offsetWidth; // paksa reflow supaya animasi jalan
    el.classList.add('open');
    sheetStack.push(el);
    el.style.zIndex = String(100 + sheetStack.length * 10);
    document.body.classList.add('modal-open');
    updateViewport();
    if (!historyArmed) {
      // Jika "kembali" dari sheet sebelumnya belum selesai diproses, tunggu dulu.
      if (ignoreNextPop) pendingArm = true;
      else armHistory();
    }
  }

  function armHistory() {
    try { history.pushState({ cmtSheet: true }, ''); historyArmed = true; } catch (e) { /* abaikan */ }
  }

  function hideSheet(el) {
    if (el.contains(document.activeElement)) document.activeElement.blur();
    el.classList.remove('open');
    setTimeout(function () { if (sheetStack.indexOf(el) === -1) el.hidden = true; }, 220);
    if (el.id === 'sheet-confirm' && confirmResolve) { var r = confirmResolve; confirmResolve = null; r(false); }
    var back = el._returnFocus;
    el._returnFocus = null;
    // Kembalikan fokus hanya untuk pengguna keyboard, supaya di HP tidak muncul garis fokus.
    if (usingKeyboard && back && back.focus && document.contains(back) && back.tagName !== 'INPUT') {
      try { back.focus({ preventScroll: true }); } catch (e) { /* abaikan */ }
    }
  }

  function closeTopSheet() {
    var el = sheetStack.pop();
    if (!el) return;
    hideSheet(el);
    if (!sheetStack.length) {
      document.body.classList.remove('modal-open');
      pendingArm = false;
      if (historyArmed) { historyArmed = false; ignoreNextPop = true; history.back(); }
    }
  }

  function onPopState() {
    if (ignoreNextPop) {
      ignoreNextPop = false;
      if (pendingArm) {
        pendingArm = false;
        if (sheetStack.length && !historyArmed) armHistory();
      }
      return;
    }
    if (!historyArmed) return;
    historyArmed = false;
    var el = sheetStack.pop();
    if (el) hideSheet(el);
    if (sheetStack.length) {
      try { history.pushState({ cmtSheet: true }, ''); historyArmed = true; } catch (e) { /* abaikan */ }
    } else {
      document.body.classList.remove('modal-open');
    }
  }

  // Menjaga form tetap terlihat di atas keyboard (terutama iPhone).
  function updateViewport() {
    var vv = window.visualViewport;
    if (!vv) return;
    var zoomed = vv.scale && Math.abs(vv.scale - 1) > 0.01;
    var kb = zoomed ? 0 : Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    var open = kb > 80;
    root.style.setProperty('--kb', open ? kb + 'px' : '0px');
    root.style.setProperty('--vvh', Math.round(zoomed ? window.innerHeight : vv.height) + 'px');
    root.classList.toggle('kb-open', open);
  }

  /* ================= Konfirmasi ================= */
  var confirmResolve = null;
  function confirmDialog(opts) {
    return new Promise(function (resolve) {
      $('#confirm-title').textContent = opts.title;
      $('#confirm-msg').textContent = opts.message || '';
      $('#confirm-ok').textContent = opts.okText || 'Hapus';
      confirmResolve = resolve;
      openSheet($('#sheet-confirm'));
      $('#confirm-cancel').focus({ preventScroll: true });
    });
  }

  /* ================= Toast ================= */
  var toastTimer = null;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  /* ================= Form transaksi (pengeluaran / pemasukan / transfer) ================= */
  var txEditId = null;
  var txType = 'expense';
  var txCat = null;
  var txWish = null;

  // Efek transaksi pada saldo: pemasukan menambah, pengeluaran & transfer mengurangi.
  function balanceEffect(t) { return t.type === 'income' ? t.amount : -t.amount; }

  // Saldo yang bisa dipakai untuk transfer (transaksi yang sedang diedit dianggap belum ada).
  function availableForTransfer() {
    var existing = txEditId ? state.tx.find(function (x) { return x.id === txEditId; }) : null;
    return roundTo(computeBalance() - (existing ? balanceEffect(existing) : 0), cur().decimals);
  }

  function defaultWish() {
    var totals = transferTotals();
    var list = sortedWish(totals);
    var open = list.filter(function (w) { return wishTotal(w, totals) < w.price; });
    var last = state.settings.lastWish;
    if (last && open.some(function (w) { return w.id === last; })) return last;
    if (open.length) return open[0].id;
    return list.length ? list[0].id : null;
  }

  function setTxType(type) {
    txType = type;
    $all('input[name="tx-type"]').forEach(function (r) { r.checked = r.value === type; });
    var isTransfer = type === 'transfer';
    $('#tx-cat-label').textContent = isTransfer ? 'Ke impian' : 'Kategori';
    $('#tx-cats').hidden = isTransfer;
    $('#tx-wishes').hidden = !isTransfer;
    $('#tx-transfer-info').hidden = !isTransfer;
    if (isTransfer) {
      if (!wishById(txWish)) txWish = defaultWish();
      renderTxWishes();
    } else {
      if (!catFits(txCat, type)) txCat = defaultCatFor(type);
      renderTxChips();
    }
  }

  function renderTxChips() {
    var list = catsForType(txType);
    if (txCat && !list.some(function (c) { return c.id === txCat; })) {
      var c = state.cats.find(function (x) { return x.id === txCat; });
      if (c) list = [c].concat(list);
    }
    $('#tx-cats').innerHTML = list.map(function (c) {
      var on = c.id === txCat;
      return '<button type="button" class="chip" role="radio" aria-checked="' + on + '" data-chip="' + esc(c.id) + '">' +
        '<span aria-hidden="true">' + esc(c.emoji) + '</span>' + esc(c.name) + '</button>';
    }).join('');
  }

  function renderTxWishes() {
    var totals = transferTotals();
    var list = sortedWish(totals);
    $('#tx-wishes').innerHTML = list.length
      ? list.map(function (w) {
          var k = wishKind(w.kind);
          return '<button type="button" class="chip" role="radio" aria-checked="' + (w.id === txWish) + '" data-wishchip="' + esc(w.id) + '">' +
            '<span aria-hidden="true">' + k.emoji + '</span>' + esc(w.name) + '</button>';
        }).join('')
      : '<div class="wish-inline-empty"><p class="hint">Belum ada impian sebagai tujuan transfer.</p>' +
        '<button type="button" class="btn btn-secondary" data-new-wish>+ Buat impian</button></div>';
    updateTransferInfo();
  }

  function updateTransferInfo() {
    if (txType !== 'transfer') return;
    var w = wishById(txWish);
    var text = 'Saldo tersedia: ' + formatMoney(availableForTransfer()) + '.';
    if (w) text += ' ' + w.name + ': terkumpul ' + formatMoney(wishTotal(w)) + ' dari ' + formatMoney(w.price) + '.';
    $('#tx-transfer-info').textContent = text + ' Transfer tercatat di Riwayat, tapi tidak dihitung sebagai pengeluaran.';
  }

  function showTxError(msg) {
    var e = $('#tx-error');
    e.textContent = msg;
    e.hidden = !msg;
  }

  // opts: { type: 'transfer', wishId } dipakai oleh tombol Transfer di kartu impian.
  function openTxSheet(id, opts) {
    opts = opts || {};
    var t = id ? state.tx.find(function (x) { return x.id === id; }) : null;
    txEditId = t ? t.id : null;
    var type = t ? t.type : (opts.type || 'expense');
    $('#tx-title').textContent = t ? (t.type === 'transfer' ? 'Edit Transfer' : 'Edit Transaksi') : (type === 'transfer' ? 'Transfer ke Tabungan' : 'Tambah Transaksi');
    txCat = t && t.type !== 'transfer' ? t.categoryId : defaultCatFor(type === 'income' ? 'income' : 'expense');
    txWish = t && t.type === 'transfer' ? t.wishId : (opts.wishId || null);

    applyCurrencyToFields();
    var amount = $('#tx-amount');
    amount.value = t ? amountForInput(t.amount) : '';
    if (!t && opts.wishId) {
      // Saran: tabungan per bulan, tapi tidak melebihi kekurangannya.
      var w = wishById(opts.wishId);
      if (w && w.monthly) {
        var remaining = Math.max(0, w.price - wishTotal(w));
        var suggest = Math.min(w.monthly, remaining || w.monthly);
        amount.value = amountForInput(roundTo(suggest, cur().decimals));
      }
    }
    $('#tx-date').value = t ? t.date : todayStr();
    $('#tx-note').value = t ? (t.note || '') : '';
    $('#tx-delete').hidden = !t;
    setTxType(type);
    showTxError('');
    $('#sheet-tx .sheet-body').scrollTop = 0;

    openSheet($('#sheet-tx'));
    // Fokus langsung ke nominal supaya keypad angka terbuka (tetap di dalam ketukan pengguna).
    if (!t && !amount.value) { try { amount.focus({ preventScroll: true }); } catch (e) { amount.focus(); } }
  }

  function saveTx(ev) {
    ev.preventDefault();
    var c = cur();
    var amount = roundTo(parseAmount($('#tx-amount').value), c.decimals);
    if (!(amount > 0)) {
      showTxError('Masukkan nominal lebih dari 0.');
      $('#tx-amount').focus();
      return;
    }
    var isTransfer = txType === 'transfer';
    if (isTransfer) {
      if (!wishById(txWish)) {
        showTxError(state.wish.length ? 'Pilih impian tujuan transfer.' : 'Buat impian dulu sebagai tujuan transfer.');
        return;
      }
      var avail = availableForTransfer();
      if (amount > avail) {
        showTxError('Saldo tidak cukup. Saldo tersedia: ' + formatMoney(avail) + '. Isi saldo awal di Pengaturan atau catat pemasukan dulu.');
        return;
      }
    }
    var date = $('#tx-date').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = todayStr();
    var catId = state.cats.some(function (x) { return x.id === txCat; }) ? txCat : FALLBACK_CAT;
    var note = $('#tx-note').value.trim().slice(0, 120);
    var now = Date.now();
    var existing = txEditId ? state.tx.find(function (x) { return x.id === txEditId; }) : null;

    var t = {
      id: existing ? existing.id : uid(),
      type: txType,
      amount: amount,
      categoryId: isTransfer ? null : catId,
      date: date,
      note: note,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now
    };
    if (isTransfer) t.wishId = txWish;

    var wasEdit = !!existing;
    var before = snapshot();
    store.put('transactions', t).then(function () {
      if (wasEdit) state.tx = state.tx.map(function (x) { return x.id === t.id ? t : x; });
      else state.tx = state.tx.concat([t]);
      pushHistory(isTransfer ? (wasEdit ? 'Ubah transfer' : 'Transfer ke tabungan') : (wasEdit ? 'Edit transaksi' : 'Tambah transaksi'), before);
      if (isTransfer) setSetting('lastWish', txWish);
      else setSetting(t.type === 'income' ? 'lastCatIncome' : 'lastCatExpense', catId);
      closeTopSheet();
      renderAll();
      if (isTransfer) {
        var w = wishById(t.wishId);
        if (wishTotal(w) >= w.price) toast('🎉 Dana untuk ' + w.name + ' sudah cukup!');
        else toast(formatMoney(amount) + ' ditransfer ke ' + w.name);
      } else {
        toast(wasEdit ? 'Perubahan disimpan' : 'Transaksi disimpan');
      }
      requestPersist();
    }).catch(function (err) {
      console.warn(err);
      showTxError('Gagal menyimpan. Coba lagi.');
    });
  }

  function deleteTx() {
    var t = state.tx.find(function (x) { return x.id === txEditId; });
    if (!t) return;
    var isTransfer = t.type === 'transfer';
    var w = isTransfer ? wishById(t.wishId) : null;
    confirmDialog({
      title: isTransfer ? 'Hapus transfer ini?' : 'Hapus transaksi ini?',
      message: isTransfer
        ? formatMoney(t.amount) + ' kembali ke saldo' + (w ? ' dan tabungan "' + w.name + '" berkurang' : '') + '. Masih bisa dibatalkan dengan tombol urungkan (↶).'
        : (t.type === 'income' ? 'Pemasukan ' : 'Pengeluaran ') + formatMoney(t.amount) + ' · ' +
          getCat(t.categoryId).name + ' · ' + dateLong(t.date) + '. Masih bisa dibatalkan dengan tombol urungkan (↶).',
      okText: 'Hapus'
    }).then(function (ok) {
      if (!ok) return;
      var before = snapshot();
      return store.remove('transactions', t.id).then(function () {
        state.tx = state.tx.filter(function (x) { return x.id !== t.id; });
        pushHistory(isTransfer ? 'Hapus transfer' : 'Hapus transaksi', before);
        closeTopSheet();
        renderAll();
        toast(isTransfer ? 'Transfer dihapus, uang kembali ke saldo' : 'Transaksi dihapus');
      });
    }).catch(function (err) {
      console.warn(err);
      toast('Gagal menghapus. Coba lagi.');
    });
  }

  /* ================= Form kategori ================= */
  var catEditId = null;
  var catType = 'expense';
  var catEmoji = EMOJIS[0];
  var catColor = PALETTE[0];

  function renderCatPickers() {
    var emojis = EMOJIS.slice();
    if (emojis.indexOf(catEmoji) === -1) emojis.unshift(catEmoji);
    $('#cat-emojis').innerHTML = emojis.map(function (e) {
      return '<button type="button" role="radio" aria-checked="' + (e === catEmoji) + '" data-emoji="' + esc(e) + '" aria-label="Ikon ' + esc(e) + '">' + esc(e) + '</button>';
    }).join('');
    var colors = PALETTE.slice();
    if (colors.indexOf(catColor) === -1) colors.unshift(catColor);
    $('#cat-colors').innerHTML = colors.map(function (c, i) {
      return '<button type="button" role="radio" aria-checked="' + (c === catColor) + '" data-color="' + esc(c) + '" aria-label="Warna ' + (i + 1) + '"><span style="--sw:' + esc(c) + '"></span></button>';
    }).join('');
  }

  function showCatError(msg) {
    var e = $('#cat-error');
    e.textContent = msg;
    e.hidden = !msg;
  }

  function openCatSheet(id) {
    var c = id ? state.cats.find(function (x) { return x.id === id; }) : null;
    catEditId = c ? c.id : null;
    var isFallback = !!c && c.id === FALLBACK_CAT;
    $('#cat-title').textContent = c ? 'Edit Kategori' : 'Kategori Baru';
    $('#cat-name').value = c ? c.name : '';
    catType = isFallback ? 'both' : (c ? c.type : 'expense');
    catEmoji = c ? c.emoji : '🏷️';
    if (!c) {
      var used = state.cats.map(function (x) { return x.color; });
      catColor = PALETTE.find(function (p) { return used.indexOf(p) === -1; }) || PALETTE[state.cats.length % PALETTE.length];
    } else {
      catColor = c.color;
    }
    $all('input[name="cat-type"]').forEach(function (r) { r.checked = r.value === catType; r.disabled = isFallback; });
    $('#cat-fallback-note').hidden = !isFallback;
    $('#cat-delete').hidden = !c || isFallback;
    showCatError('');
    renderCatPickers();
    $('#sheet-cat .sheet-body').scrollTop = 0;
    openSheet($('#sheet-cat'));
  }

  function saveCat(ev) {
    ev.preventDefault();
    var name = $('#cat-name').value.trim().replace(/\s+/g, ' ').slice(0, 24);
    if (!name) { showCatError('Nama kategori wajib diisi.'); $('#cat-name').focus(); return; }
    var dup = state.cats.some(function (c) { return c.id !== catEditId && c.name.toLowerCase() === name.toLowerCase(); });
    if (dup) { showCatError('Nama kategori ini sudah ada.'); $('#cat-name').focus(); return; }

    var existing = catEditId ? state.cats.find(function (c) { return c.id === catEditId; }) : null;
    var cat = {
      id: existing ? existing.id : uid(),
      name: name,
      type: existing && existing.id === FALLBACK_CAT ? 'both' : catType,
      emoji: catEmoji,
      color: catColor,
      order: existing ? (existing.order || 0) : nextOrder(),
      budget: existing ? (existing.budget || 0) : 0
    };
    var before = snapshot();
    store.put('categories', cat).then(function () {
      if (existing) state.cats = state.cats.map(function (c) { return c.id === cat.id ? cat : c; });
      else state.cats = state.cats.concat([cat]);
      pushHistory(existing ? 'Ubah kategori' : 'Tambah kategori', before);
      closeTopSheet();
      renderAll();
      // Kalau dibuat dari form anggaran, tampilkan kategori baru di sana tanpa menghapus isian lain.
      if (sheetStack[sheetStack.length - 1] === $('#sheet-budget')) renderBudgetRows(true);
      toast(existing ? 'Kategori diperbarui' : 'Kategori ditambahkan');
    }).catch(function (err) {
      console.warn(err);
      showCatError('Gagal menyimpan. Coba lagi.');
    });
  }

  function deleteCat() {
    var c = state.cats.find(function (x) { return x.id === catEditId; });
    if (!c || c.id === FALLBACK_CAT) return;
    var used = state.tx.filter(function (t) { return t.categoryId === c.id; });
    var fbName = fallbackCat().name;
    confirmDialog({
      title: 'Hapus kategori "' + c.name + '"?',
      message: used.length
        ? used.length + ' transaksi dengan kategori ini akan dipindah ke "' + fbName + '".'
        : 'Kategori ini belum dipakai transaksi apa pun.',
      okText: 'Hapus'
    }).then(function (ok) {
      if (!ok) return;
      var before = snapshot();
      var now = Date.now();
      var moved = used.map(function (t) {
        var copy = {};
        Object.keys(t).forEach(function (k) { copy[k] = t[k]; });
        copy.categoryId = FALLBACK_CAT;
        copy.updatedAt = now;
        return copy;
      });
      return store.putMany('transactions', moved).then(function () {
        return store.remove('categories', c.id);
      }).then(function () {
        var movedMap = new Map(moved.map(function (t) { return [t.id, t]; }));
        state.tx = state.tx.map(function (t) { return movedMap.get(t.id) || t; });
        state.cats = state.cats.filter(function (x) { return x.id !== c.id; });
        pushHistory('Hapus kategori', before);
        ['lastCatExpense', 'lastCatIncome'].forEach(function (k) { if (state.settings[k] === c.id) setSetting(k, null); });
        closeTopSheet();
        renderAll();
        toast('Kategori dihapus');
      });
    }).catch(function (err) {
      console.warn(err);
      toast('Gagal menghapus kategori. Coba lagi.');
    });
  }

  /* ================= Form impian ================= */
  var wishEditId = null;
  var wishKindSel = WISH_KINDS[0].id;

  function renderWishKinds() {
    $('#wish-kinds').innerHTML = WISH_KINDS.map(function (k) {
      return '<button type="button" class="chip" role="radio" aria-checked="' + (k.id === wishKindSel) + '" data-kind="' + k.id + '">' +
        '<span aria-hidden="true">' + k.emoji + '</span>' + esc(k.name) + '</button>';
    }).join('');
  }

  function showFieldError(sel, msg) {
    var e = $(sel);
    e.textContent = msg;
    e.hidden = !msg;
  }

  function updateWishEstimate() {
    var price = parseAmount($('#wish-price').value);
    var monthly = parseAmount($('#wish-monthly').value);
    var transferred = wishEditId ? (transferTotals().get(wishEditId) || 0) : 0;
    var saved = parseAmount($('#wish-saved').value) + transferred;
    var box = $('#wish-estimate');
    var p = wishPlan(price, monthly, saved);
    box.classList.toggle('ready', p.done || p.months !== null);
    var extra = transferred ? '<span>Sudah termasuk transfer dari saldo ' + esc(formatMoney(transferred)) + '.</span>' : '';
    if (!(price > 0)) {
      box.innerHTML = '<span class="est-label">Perkiraan</span><span>Isi harga dan tabungan per bulan, nanti kelihatan kira-kira berapa bulan sampai terbeli.</span>';
    } else if (p.done) {
      box.innerHTML = '<span class="est-label">Perkiraan</span><strong>🎉 Dana sudah cukup!</strong><span>Uang yang terkumpul sudah menutup harganya.</span>' + extra;
    } else if (p.months === null) {
      box.innerHTML = '<span class="est-label">Perkiraan</span><span>Kurang ' + esc(formatMoney(p.remaining)) + '. Isi tabungan per bulan untuk melihat berapa bulan lagi.</span>' + extra;
    } else {
      box.innerHTML = '<span class="est-label">Perkiraan</span><strong>' + durationText(p.months) + ' lagi</strong>' +
        '<span>' + (p.target ? 'Tercapai sekitar <b>' + p.target + '</b> · ' : 'Coba naikkan tabungan per bulan · ') +
        'kurang ' + esc(formatMoney(p.remaining)) + '</span>' + extra;
    }
  }

  function openWishSheet(id) {
    var w = id ? wishById(id) : null;
    wishEditId = w ? w.id : null;
    $('#wish-title').textContent = w ? 'Edit Impian' : 'Impian Baru';
    $('#wish-name').value = w ? w.name : '';
    wishKindSel = w ? w.kind : WISH_KINDS[0].id;
    renderWishKinds();
    applyCurrencyToFields();
    $('#wish-price').value = w ? amountForInput(w.price) : '';
    $('#wish-monthly').value = w ? amountForInput(w.monthly) : '';
    $('#wish-saved').value = w ? amountForInput(w.saved) : '';
    $('#wish-delete').hidden = !w;
    showFieldError('#wish-error', '');
    updateWishEstimate();
    $('#sheet-wish .sheet-body').scrollTop = 0;
    openSheet($('#sheet-wish'));
    if (!w) { try { $('#wish-name').focus({ preventScroll: true }); } catch (e) { /* abaikan */ } }
  }

  function saveWish(ev) {
    ev.preventDefault();
    var c = cur();
    var name = $('#wish-name').value.trim().replace(/\s+/g, ' ').slice(0, 40);
    var price = roundTo(parseAmount($('#wish-price').value), c.decimals);
    var monthly = roundTo(parseAmount($('#wish-monthly').value), c.decimals);
    var saved = roundTo(parseAmount($('#wish-saved').value), c.decimals);
    if (!name) { showFieldError('#wish-error', 'Nama impian wajib diisi.'); $('#wish-name').focus(); return; }
    if (!(price > 0)) { showFieldError('#wish-error', 'Isi harga atau target dana lebih dari 0.'); $('#wish-price').focus(); return; }

    var existing = wishEditId ? wishById(wishEditId) : null;
    var now = Date.now();
    var w = {
      id: existing ? existing.id : uid(),
      name: name,
      kind: wishKindSel,
      price: price,
      monthly: monthly > 0 ? monthly : 0,
      saved: saved > 0 ? saved : 0,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now
    };
    var before = snapshot();
    store.put('wishlist', w).then(function () {
      if (existing) state.wish = state.wish.map(function (x) { return x.id === w.id ? w : x; });
      else state.wish = state.wish.concat([w]);
      pushHistory(existing ? 'Ubah impian' : 'Tambah impian', before);
      closeTopSheet();
      renderAll();
      if (sheetStack[sheetStack.length - 1] === $('#sheet-tx') && txType === 'transfer') {
        if (!existing) txWish = w.id;
        renderTxWishes();
      }
      toast(existing ? 'Impian diperbarui' : 'Impian ditambahkan');
      requestPersist();
    }).catch(function (err) {
      console.warn(err);
      showFieldError('#wish-error', 'Gagal menyimpan. Coba lagi.');
    });
  }

  // Menghapus impian juga menghapus transfernya, jadi uang itu kembali ke saldo.
  function deleteWish() {
    var w = wishById(wishEditId);
    if (!w) return;
    var transfers = state.tx.filter(function (t) { return t.type === 'transfer' && t.wishId === w.id; });
    var back = transfers.reduce(function (a, t) { return a + t.amount; }, 0);
    confirmDialog({
      title: 'Hapus impian "' + w.name + '"?',
      message: (back
        ? formatMoney(back) + ' hasil transfer akan kembali ke saldo. Kalau barangnya sudah dibeli, catat pembeliannya sebagai pengeluaran.'
        : 'Catatan tabungan untuk impian ini akan dihapus.') + ' Bisa dibatalkan dengan tombol urungkan (↶).',
      okText: 'Hapus'
    }).then(function (ok) {
      if (!ok) return;
      var before = snapshot();
      var ids = transfers.map(function (t) { return t.id; });
      return store.removeMany('transactions', ids).then(function () {
        return store.remove('wishlist', w.id);
      }).then(function () {
        state.wish = state.wish.filter(function (x) { return x.id !== w.id; });
        state.tx = state.tx.filter(function (t) { return ids.indexOf(t.id) === -1; });
        pushHistory('Hapus impian', before);
        closeTopSheet();
        renderAll();
        toast(back ? 'Impian dihapus, ' + formatMoney(back) + ' kembali ke saldo' : 'Impian dihapus');
      });
    }).catch(function (err) {
      console.warn(err);
      toast('Gagal menghapus. Coba lagi.');
    });
  }

  /* ================= Anggaran bulanan ================= */
  function renderBudgetRows(keepValues) {
    var prev = {};
    if (keepValues) $all('#budget-rows input').forEach(function (i) { prev[i.getAttribute('data-budget')] = i.value; });
    var cats = sortedCats().filter(function (c) { return c.type !== 'income'; });
    $('#budget-rows').innerHTML = cats.map(function (c, i) {
      var val = Object.prototype.hasOwnProperty.call(prev, c.id) ? prev[c.id] : amountForInput(c.budget || 0);
      return '<div class="budget-row">' +
        '<label class="budget-row-name" for="bud-' + i + '"><span aria-hidden="true">' + esc(c.emoji) + '</span>' + esc(c.name) + '</label>' +
        '<label class="amount-field sm budget-input" for="bud-' + i + '">' +
        '<span class="amount-prefix cur-before" hidden></span>' +
        '<input id="bud-' + i + '" class="amount-input money-input" type="text" inputmode="decimal" placeholder="0" autocomplete="off" data-budget="' + esc(c.id) + '" value="' + esc(val) + '" aria-label="' + esc('Anggaran ' + c.name + ' per bulan') + '">' +
        '<span class="amount-prefix cur-after"></span></label></div>';
    }).join('');
    applyCurrencyToFields();
  }

  function openBudgetSheet() {
    renderBudgetRows(false);
    $('#sheet-budget .sheet-body').scrollTop = 0;
    openSheet($('#sheet-budget'));
  }

  function saveBudgets(ev) {
    ev.preventDefault();
    var c = cur();
    var changed = new Map();
    $all('#budget-rows input').forEach(function (input) {
      var cat = state.cats.find(function (x) { return x.id === input.getAttribute('data-budget'); });
      if (!cat) return;
      var v = Math.max(0, roundTo(parseAmount(input.value), c.decimals));
      if ((cat.budget || 0) === v) return;
      var copy = {};
      Object.keys(cat).forEach(function (k) { copy[k] = cat[k]; });
      copy.budget = v;
      changed.set(copy.id, copy);
    });
    if (!changed.size) { closeTopSheet(); return; }
    var before = snapshot();
    store.putMany('categories', Array.from(changed.values())).then(function () {
      state.cats = state.cats.map(function (x) { return changed.get(x.id) || x; });
      pushHistory('Ubah anggaran', before);
      closeTopSheet();
      renderAll();
      toast('Anggaran disimpan');
    }).catch(function (err) {
      console.warn(err);
      toast('Gagal menyimpan anggaran. Coba lagi.');
    });
  }

  /* ================= Saldo awal ================= */
  function openOpeningSheet(mode) {
    var welcome = mode === 'welcome';
    $('#opening-title').textContent = welcome ? (state.tx.length ? 'Fitur baru: saldo awal' : 'Selamat datang 👋') : 'Saldo awal';
    $('#opening-text').textContent = welcome && !state.tx.length
      ? 'Berapa uang yang kamu punya sekarang (tunai + rekening)? Angka ini jadi saldo awal. Bisa diubah kapan saja di Pengaturan.'
      : 'Uang yang kamu punya saat mulai mencatat di aplikasi ini. Saldo = saldo awal + pemasukan − pengeluaran − transfer ke tabungan.';
    $('#opening-skip').hidden = !welcome;
    applyCurrencyToFields();
    var v = Number(state.settings.openingBalance) || 0;
    $('#opening-amount').value = v ? amountForInput(v) : '';
    openSheet($('#sheet-opening'));
    if (welcome) setSetting('openingAsked', true); // hanya ditanyakan sekali
    if (!welcome) { try { $('#opening-amount').focus({ preventScroll: true }); } catch (e) { /* abaikan */ } }
  }

  function saveOpening(ev) {
    ev.preventDefault();
    var v = Math.max(0, roundTo(parseAmount($('#opening-amount').value), cur().decimals));
    if (v === (Number(state.settings.openingBalance) || 0)) { closeTopSheet(); renderAll(); return; }
    var before = snapshot();
    setSetting('openingBalance', v).then(function () {
      pushHistory('Ubah saldo awal', before);
      closeTopSheet();
      renderAll();
      toast('Saldo awal: ' + formatMoney(v));
    });
  }

  /* ================= Reset ================= */
  function resetAll() {
    confirmDialog({
      title: 'Reset semua data?',
      message: 'Semua transaksi, tabungan impian, anggaran, kategori buatan sendiri, dan saldo awal akan dihapus. ' +
        'Masih bisa dibatalkan dengan tombol urungkan (↶) selama aplikasi belum ditutup. Sebaiknya ekspor backup dulu.',
      okText: 'Reset'
    }).then(function (ok) {
      if (!ok) return;
      var before = snapshot();
      var cats = DEFAULT_CATEGORIES.map(function (d) {
        return { id: d.id, name: d.name, type: d.type, emoji: d.emoji, color: d.color, order: d.order, budget: 0 };
      });
      var settings = {};
      Object.keys(state.settings).forEach(function (k) { settings[k] = state.settings[k]; });
      settings.openingBalance = 0;
      settings.openingAsked = false;
      settings.lastCatExpense = null;
      settings.lastCatIncome = null;
      var settingsArr = Object.keys(settings).map(function (k) { return { key: k, value: settings[k] }; });
      return store.replaceAll({ transactions: [], categories: cats, wishlist: [], settings: settingsArr }).then(function () {
        state.tx = [];
        state.cats = cats;
        state.wish = [];
        state.settings = settings;
        ui.historyMonth = null;
        pushHistory('Reset semua data', before);
        renderAll();
        showView('home');
        toast('Semua data sudah direset');
        openOpeningSheet('welcome');
      });
    }).catch(function (err) {
      console.warn(err);
      toast('Gagal mereset. Coba lagi.');
    });
  }

  /* ================= Ekspor & impor ================= */
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  // Mengembalikan Promise<boolean>: true jika file sudah diserahkan ke pengguna.
  function saveFile(text, filename, mime) {
    var blob = new Blob([text], { type: mime });
    if (isIOS() && navigator.canShare && typeof File === 'function') {
      try {
        var file = new File([blob], filename, { type: mime });
        if (navigator.canShare({ files: [file] })) {
          return navigator.share({ files: [file], title: filename }).then(function () { return true; }, function (err) {
            if (err && err.name === 'AbortError') return false;
            downloadBlob(blob, filename);
            return true;
          });
        }
      } catch (e) { /* lanjut ke unduhan biasa */ }
    }
    downloadBlob(blob, filename);
    return Promise.resolve(true);
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 15000);
  }

  function buildBackup() {
    return {
      app: APP_ID,
      format: BACKUP_FORMAT,
      exportedAt: new Date().toISOString(),
      settings: { currency: state.settings.currency || DEFAULT_CURRENCY, theme: state.settings.theme || 'system', openingBalance: Number(state.settings.openingBalance) || 0 },
      categories: state.cats,
      transactions: state.tx.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt || 0) - (b.createdAt || 0); }),
      wishlist: state.wish
    };
  }

  function exportJSON() {
    var json = JSON.stringify(buildBackup(), null, 2);
    saveFile(json, 'cays-money-backup-' + todayStr() + '.json', 'application/json').then(function (ok) {
      if (!ok) return;
      setSetting('lastBackup', new Date().toISOString());
      renderSettings();
      toast('Backup diekspor (' + state.tx.length + ' transaksi)');
    });
  }

  function csvCell(v) {
    var s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function exportCSV() {
    var c = cur();
    var code = CURRENCIES[state.settings.currency] ? state.settings.currency : DEFAULT_CURRENCY;
    var rows = [['Tanggal', 'Jenis', 'Kategori', 'Nominal', 'Mata Uang', 'Catatan']];
    state.tx.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt || 0) - (b.createdAt || 0); })
      .forEach(function (t) {
        var w = t.type === 'transfer' ? wishById(t.wishId) : null;
        rows.push([t.date,
          t.type === 'income' ? 'Pemasukan' : t.type === 'transfer' ? 'Transfer ke tabungan' : 'Pengeluaran',
          t.type === 'transfer' ? (w ? w.name : 'Impian dihapus') : getCat(t.categoryId).name,
          String(roundTo(t.amount, c.decimals)), code, t.note || '']);
      });
    var csv = '﻿' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n';
    saveFile(csv, 'cays-money-' + todayStr() + '.csv', 'text/csv').then(function (ok) {
      if (ok) toast('CSV diekspor (' + state.tx.length + ' transaksi)');
    });
  }

  function normalizeBackup(data) {
    if (!data || typeof data !== 'object' || !Array.isArray(data.transactions) || !Array.isArray(data.categories)) return null;

    var cats = [], seen = new Set();
    data.categories.forEach(function (c, i) {
      if (!c || typeof c !== 'object' || typeof c.id !== 'string' || !c.id || seen.has(c.id)) return;
      var name = String(c.name == null ? '' : c.name).trim().slice(0, 24);
      if (!name) return;
      seen.add(c.id);
      var emoji = typeof c.emoji === 'string' && c.emoji.trim() ? Array.from(c.emoji.trim()).slice(0, 8).join('') : '📦';
      cats.push({
        id: c.id.slice(0, 64),
        name: name,
        type: c.id === FALLBACK_CAT ? 'both' : (['expense', 'income', 'both'].indexOf(c.type) !== -1 ? c.type : 'both'),
        emoji: emoji,
        color: /^#[0-9a-fA-F]{6}$/.test(c.color) ? c.color.toLowerCase() : PALETTE[i % PALETTE.length],
        order: typeof c.order === 'number' && isFinite(c.order) ? c.order : i,
        budget: typeof c.budget === 'number' && isFinite(c.budget) && c.budget > 0 ? c.budget : 0
      });
    });
    if (!seen.has(FALLBACK_CAT)) {
      var fb = DEFAULT_CATEGORIES[DEFAULT_CATEGORIES.length - 1];
      cats.push({ id: fb.id, name: fb.name, type: fb.type, emoji: fb.emoji, color: fb.color, order: fb.order, budget: 0 });
    }

    var catIds = new Set(cats.map(function (c) { return c.id; }));
    var txIds = new Set(), txs = [];
    data.transactions.forEach(function (t) {
      if (!t || typeof t !== 'object') return;
      var amount = Number(t.amount);
      if (!isFinite(amount) || amount <= 0) return;
      if (t.type !== 'income' && t.type !== 'expense' && t.type !== 'transfer') return;
      if (t.type === 'transfer' && (typeof t.wishId !== 'string' || !t.wishId)) return;
      if (typeof t.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t.date)) return;
      var id = typeof t.id === 'string' && t.id ? t.id.slice(0, 64) : uid();
      if (txIds.has(id)) id = uid();
      txIds.add(id);
      var created = typeof t.createdAt === 'number' && isFinite(t.createdAt) ? t.createdAt : Date.now();
      txs.push({
        id: id,
        type: t.type,
        amount: amount,
        categoryId: t.type === 'transfer' ? null : (catIds.has(t.categoryId) ? t.categoryId : FALLBACK_CAT),
        wishId: t.type === 'transfer' ? t.wishId.slice(0, 64) : undefined,
        date: t.date,
        note: typeof t.note === 'string' ? t.note.slice(0, 120) : '',
        createdAt: created,
        updatedAt: typeof t.updatedAt === 'number' && isFinite(t.updatedAt) ? t.updatedAt : created
      });
    });

    // Backup lama (sebelum ada fitur tabungan) tidak punya "wishlist": daftar impian yang ada dibiarkan.
    var wish = null;
    if (Array.isArray(data.wishlist)) {
      wish = [];
      var wishIds = new Set();
      var kinds = WISH_KINDS.map(function (k) { return k.id; });
      data.wishlist.forEach(function (w) {
        if (!w || typeof w !== 'object') return;
        var name = String(w.name == null ? '' : w.name).trim().slice(0, 40);
        var price = Number(w.price);
        if (!name || !isFinite(price) || price <= 0) return;
        var monthly = Number(w.monthly), saved = Number(w.saved);
        var id = typeof w.id === 'string' && w.id ? w.id.slice(0, 64) : uid();
        if (wishIds.has(id)) id = uid();
        wishIds.add(id);
        var created = typeof w.createdAt === 'number' && isFinite(w.createdAt) ? w.createdAt : Date.now();
        wish.push({
          id: id,
          name: name,
          kind: kinds.indexOf(w.kind) !== -1 ? w.kind : 'lainnya',
          price: price,
          monthly: isFinite(monthly) && monthly > 0 ? monthly : 0,
          saved: isFinite(saved) && saved > 0 ? saved : 0,
          createdAt: created,
          updatedAt: typeof w.updatedAt === 'number' && isFinite(w.updatedAt) ? w.updatedAt : created
        });
      });
    }

    var s = data.settings && typeof data.settings === 'object' ? data.settings : {};
    return {
      cats: cats,
      txs: txs,
      wish: wish,
      currency: CURRENCIES[s.currency] ? s.currency : null,
      theme: ['system', 'light', 'dark'].indexOf(s.theme) !== -1 ? s.theme : null,
      openingBalance: typeof s.openingBalance === 'number' && isFinite(s.openingBalance) && s.openingBalance >= 0 ? s.openingBalance : null,
      skipped: data.transactions.length - txs.length
    };
  }

  function readFileText(file) {
    if (file.text) return file.text();
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result)); };
      r.onerror = function () { reject(r.error); };
      r.readAsText(file);
    });
  }

  function importJSON(file) {
    readFileText(file).then(function (text) {
      var data;
      try { data = JSON.parse(text.replace(/^﻿/, '')); } catch (e) { toast('File ini bukan backup yang valid.'); return; }
      var parsed = normalizeBackup(data);
      if (!parsed) { toast('Format backup tidak dikenali.'); return; }
      return confirmDialog({
        title: 'Impor backup?',
        message: 'Semua data saat ini akan diganti dengan isi backup: ' + parsed.txs.length + ' transaksi, ' +
          parsed.cats.length + ' kategori' + (parsed.wish ? ', dan ' + parsed.wish.length + ' impian tabungan.' : '. Daftar tabungan impian yang ada tidak diubah.') +
          (parsed.skipped ? ' ' + parsed.skipped + ' baris rusak akan dilewati.' : ''),
        okText: 'Ganti data'
      }).then(function (ok) {
        if (!ok) return;
        var wish = parsed.wish || state.wish;
        var settings = {
          currency: parsed.currency || state.settings.currency || DEFAULT_CURRENCY,
          theme: parsed.theme || state.settings.theme || 'system',
          lastBackup: state.settings.lastBackup || null,
          lastCatExpense: null,
          lastCatIncome: null,
          openingBalance: parsed.openingBalance !== null ? parsed.openingBalance : (Number(state.settings.openingBalance) || 0),
          openingAsked: true,
          seeded: true
        };
        var settingsArr = Object.keys(settings).map(function (k) { return { key: k, value: settings[k] }; });
        var before = snapshot();
        return store.replaceAll({ transactions: parsed.txs, categories: parsed.cats, settings: settingsArr, wishlist: wish }).then(function () {
          state.tx = parsed.txs;
          state.cats = parsed.cats;
          state.wish = wish;
          state.settings = settings;
          pushHistory('Impor backup', before);
          applyTheme(settings.theme);
          ui.historyMonth = null;
          renderAll();
          toast('Impor berhasil: ' + parsed.txs.length + ' transaksi');
        });
      });
    }).catch(function (err) {
      console.warn(err);
      toast('Gagal membaca file backup.');
    });
  }

  /* ================= Event ================= */
  function bindEvents() {
    $all('.tab').forEach(function (b) {
      b.addEventListener('click', function () { showView(b.getAttribute('data-tab')); });
    });

    document.addEventListener('click', function (e) {
      var goto = e.target.closest('[data-goto]');
      if (goto) { showView(goto.getAttribute('data-goto')); return; }

      var txBtn = e.target.closest('.tx[data-id]');
      if (txBtn) { openTxSheet(txBtn.getAttribute('data-id')); return; }

      var catBtn = e.target.closest('[data-cat]');
      if (catBtn) { openCatSheet(catBtn.getAttribute('data-cat')); return; }

      var trBtn = e.target.closest('[data-transfer]');
      if (trBtn) { openTxSheet(null, { type: 'transfer', wishId: trBtn.getAttribute('data-transfer') }); return; }

      if (e.target.closest('[data-new-wish]')) { openWishSheet(null); return; }

      if (e.target.closest('[data-budget-open]')) { openBudgetSheet(); return; }

      var wishBtn = e.target.closest('[data-wish]');
      if (wishBtn) { openWishSheet(wishBtn.getAttribute('data-wish')); return; }

      var closer = e.target.closest('[data-close]');
      if (closer) {
        var sheet = closer.closest('.sheet');
        if (sheet && sheet === sheetStack[sheetStack.length - 1]) closeTopSheet();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sheetStack.length) { e.preventDefault(); closeTopSheet(); return; }
      // Ctrl/Cmd+Z = urungkan, Ctrl+Y atau Ctrl+Shift+Z = ulangi (di luar kolom isian)
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '');
      if (!(e.ctrlKey || e.metaKey) || typing || sheetStack.length) return;
      var k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    });

    $('#btn-undo').addEventListener('click', undo);
    $('#btn-redo').addEventListener('click', redo);

    window.addEventListener('popstate', onPopState);

    $('#fab').addEventListener('click', function () { openTxSheet(null); });

    // Riwayat
    $('#month-select').addEventListener('change', function (e) { ui.historyMonth = e.target.value; renderHistory(); });
    $('#month-prev').addEventListener('click', function () {
      var m = historyMonths(), i = m.indexOf(ui.historyMonth);
      if (i !== -1 && i < m.length - 1) { ui.historyMonth = m[i + 1]; renderHistory(); }
    });
    $('#month-next').addEventListener('click', function () {
      var m = historyMonths(), i = m.indexOf(ui.historyMonth);
      if (i > 0) { ui.historyMonth = m[i - 1]; renderHistory(); }
    });
    $('#search-input').addEventListener('input', function (e) { ui.search = e.target.value; renderHistory(); });

    // Form transaksi
    $all('input[name="tx-type"]').forEach(function (r) {
      r.addEventListener('change', function () {
        if (!r.checked) return;
        setTxType(r.value);
        showTxError('');
      });
    });
    $('#tx-wishes').addEventListener('click', function (e) {
      var b = e.target.closest('[data-wishchip]');
      if (!b) return;
      txWish = b.getAttribute('data-wishchip');
      $all('#tx-wishes .chip').forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); });
      updateTransferInfo();
      showTxError('');
      var a = $('#tx-amount');
      if (document.activeElement === a) a.blur();
    });
    // Semua kolom nominal: rapikan pemisah ribuan saat diketik.
    document.addEventListener('input', function (e) {
      var input = e.target;
      if (!input.classList || !input.classList.contains('money-input')) return;
      var clean = sanitizeAmount(input.value, cur());
      if (clean !== input.value) input.value = clean;
      if (input.id === 'tx-amount' && clean) showTxError('');
      if (input.closest('#wish-form')) updateWishEstimate();
    });

    // Tabungan impian
    $('#wish-add').addEventListener('click', function () { openWishSheet(null); });
    $('#wish-kinds').addEventListener('click', function (e) {
      var b = e.target.closest('[data-kind]');
      if (!b) return;
      wishKindSel = b.getAttribute('data-kind');
      $all('#wish-kinds .chip').forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); });
    });
    $('#wish-name').addEventListener('input', function () { showFieldError('#wish-error', ''); });
    $('#wish-form').addEventListener('submit', saveWish);
    $('#wish-delete').addEventListener('click', deleteWish);

    // Anggaran, saldo awal, reset
    $('#budget-edit').addEventListener('click', openBudgetSheet);
    $('#budget-edit-2').addEventListener('click', openBudgetSheet);
    $('#budget-form').addEventListener('submit', saveBudgets);
    $('#budget-add-cat').addEventListener('click', function () { openCatSheet(null); });
    $('#opening-edit').addEventListener('click', function () { openOpeningSheet('edit'); });
    $('#opening-form').addEventListener('submit', saveOpening);
    $('#opening-skip').addEventListener('click', closeTopSheet);
    $('#btn-reset').addEventListener('click', resetAll);
    $('#tx-cats').addEventListener('click', function (e) {
      var b = e.target.closest('[data-chip]');
      if (!b) return;
      txCat = b.getAttribute('data-chip');
      $all('#tx-cats .chip').forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); });
      var a = $('#tx-amount');
      if (document.activeElement === a) a.blur();
    });
    $('#tx-form').addEventListener('submit', saveTx);
    $('#tx-delete').addEventListener('click', deleteTx);

    // Form kategori
    $all('input[name="cat-type"]').forEach(function (r) {
      r.addEventListener('change', function () { if (r.checked) catType = r.value; });
    });
    $('#cat-emojis').addEventListener('click', function (e) {
      var b = e.target.closest('[data-emoji]');
      if (!b) return;
      catEmoji = b.getAttribute('data-emoji');
      $all('#cat-emojis button').forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); });
    });
    $('#cat-colors').addEventListener('click', function (e) {
      var b = e.target.closest('[data-color]');
      if (!b) return;
      catColor = b.getAttribute('data-color');
      $all('#cat-colors button').forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); });
    });
    $('#cat-form').addEventListener('submit', saveCat);
    $('#cat-delete').addEventListener('click', deleteCat);
    $('#cat-add').addEventListener('click', function () { openCatSheet(null); });

    // Konfirmasi
    $('#confirm-ok').addEventListener('click', function () {
      var r = confirmResolve;
      confirmResolve = null;
      closeTopSheet();
      if (r) r(true);
    });

    // Pengaturan
    $('#set-currency').addEventListener('change', function (e) {
      setSetting('currency', e.target.value);
      renderAll();
      toast('Mata uang: ' + CURRENCIES[e.target.value].name);
    });
    $all('input[name="theme"]').forEach(function (r) {
      r.addEventListener('change', function () {
        if (!r.checked) return;
        setSetting('theme', r.value);
        applyTheme(r.value);
      });
    });
    $('#btn-export').addEventListener('click', exportJSON);
    $('#btn-csv').addEventListener('click', exportCSV);
    $('#import-file').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (f) importJSON(f);
    });

    if (darkQuery) {
      if (darkQuery.addEventListener) darkQuery.addEventListener('change', updateThemeColor);
      else if (darkQuery.addListener) darkQuery.addListener(updateThemeColor);
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewport);
      window.visualViewport.addEventListener('scroll', updateViewport);
    }
    var fitQueued = false;
    window.addEventListener('resize', function () {
      updateViewport();
      if (fitQueued) return;
      fitQueued = true;
      requestAnimationFrame(function () { fitQueued = false; fitHome(); });
    });

    // Tanggal berganti saat aplikasi dibuka lagi (mis. besok pagi): segarkan tampilan.
    var lastDay = todayStr();
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && todayStr() !== lastDay) {
        lastDay = todayStr();
        renderAll();
      }
    });
  }

  /* ================= Service worker ================= */
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    var local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (location.protocol !== 'https:' && !local) return;
    navigator.serviceWorker.register('sw.js').catch(function (err) {
      console.warn('Service worker gagal didaftarkan:', err);
    });
  }

  /* ================= Mulai ================= */
  function loadAll() {
    return Promise.all(STORES.map(function (n) { return store.all(n); }));
  }

  function init() {
    if (history.state && history.state.cmtSheet) {
      try { history.replaceState(null, ''); } catch (e) { /* abaikan */ }
    }
    updateViewport();

    openDB().then(function (d) { db = d; }, function () { db = null; })
      .then(loadAll)
      .catch(function () { db = null; return loadAll(); })
      .then(function (res) {
        state.tx = res[0] || [];
        state.cats = res[1] || [];
        (res[2] || []).forEach(function (s) { state.settings[s.key] = s.value; });
        state.wish = res[3] || [];

        var tasks = [];
        if (!state.settings.seeded) {
          var add = DEFAULT_CATEGORIES.filter(function (d) {
            return !state.cats.some(function (c) { return c.id === d.id; });
          }).map(function (d) { return { id: d.id, name: d.name, type: d.type, emoji: d.emoji, color: d.color, order: d.order }; });
          state.cats = state.cats.concat(add);
          tasks.push(store.putMany('categories', add));
          tasks.push(setSetting('seeded', true));
        }
        if (!state.cats.some(function (c) { return c.id === FALLBACK_CAT; })) {
          var fb = DEFAULT_CATEGORIES[DEFAULT_CATEGORIES.length - 1];
          var fbCat = { id: fb.id, name: fb.name, type: fb.type, emoji: fb.emoji, color: fb.color, order: fb.order };
          state.cats.push(fbCat);
          tasks.push(store.put('categories', fbCat));
        }

        applyTheme(state.settings.theme || 'system');
        bindEvents();
        renderAll();
        updateHistoryButtons();
        root.setAttribute('data-ready', 'true');
        // Pertama kali dibuka: tanyakan saldo awal (sekali saja, bisa dilewati).
        if (!state.settings.openingAsked) openOpeningSheet('welcome');
        return Promise.all(tasks);
      })
      .catch(function (err) {
        console.warn('Gagal memuat data', err);
        toast('Gagal memuat data di perangkat ini.');
      });

    registerSW();
  }

  // Dipakai untuk pengujian otomatis; tidak memengaruhi aplikasi.
  window.__cmt = { formatMoney: formatMoney, sanitizeAmount: sanitizeAmount, parseAmount: parseAmount, wishPlan: wishPlan, state: state };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
