/* ============================================================
   T7 ACADEMY · News Feed Loader
   ------------------------------------------------------------
   Loads the homepage news feed from a published Google Sheet
   (CSV export). Admin updates news by editing the sheet — no
   code changes needed.

   USAGE:
   ------
   1. Set CSV_URL below to your published-to-web CSV link
      (File > Share > Publish to web > CSV > Publish link).
   2. Your sheet must have these column headers in row 1:
         date | title | excerpt | link | emoji | image | published
      - date: any format JS Date can parse (YYYY-MM-DD is safest)
      - title: required, otherwise the row is skipped
      - excerpt: short description (optional)
      - link: where the card links to (optional)
      - emoji: fallback icon if no image (optional)
      - image: thumbnail URL (optional, beats emoji if present)
      - published: leave blank or "yes" to show; "no" to hide

   The newest 4 published rows are shown, sorted by date desc.
   If the sheet can't be reached, falls back to whatever
   renderNewsFallback() is defined on the page (or a built-in
   minimal fallback if none exists).
   ============================================================ */

(function(){
  var CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQHWaswAJIeuF1xBh_yBGIDKcB58lya5y6NEJ-rLS_3pJ-7mEZruDXjo7uOj5s5DwtXSEuH7-iq-kYk/pub?output=csv';
  var MAX_ITEMS = 4;
  var FEED_ID = 'news-feed';

  function loadNews(){
    var el = document.getElementById(FEED_ID);
    if (!el) return;

    if (!CSV_URL || CSV_URL.indexOf('PASTE_') === 0) {
      fallback(el);
      return;
    }

    // cache-bust so admin edits show up fast
    var url = CSV_URL + (CSV_URL.indexOf('?') > -1 ? '&' : '?') + 't=' + Date.now();

    fetch(url).then(function(r){
      if (!r.ok) throw new Error('http ' + r.status);
      return r.text();
    }).then(function(csv){
      var items = parseCSV(csv)
        .filter(function(it){
          if (!it.title) return false;
          var p = (it.published || '').toLowerCase();
          return p !== 'no' && p !== 'false' && p !== '0';
        })
        .sort(function(a, b){ return (b.date || '').localeCompare(a.date || ''); })
        .slice(0, MAX_ITEMS);

      if (!items.length) { fallback(el); return; }

      el.innerHTML = items.map(renderCard).join('');
    }).catch(function(){
      fallback(el);
    });
  }

  function renderCard(it){
    var dateText = '';
    if (it.date) {
      var d = new Date(it.date);
      if (!isNaN(d)) dateText = d.toLocaleDateString('de-AT', { day:'2-digit', month:'short', year:'numeric' });
      else dateText = it.date;
    }
    var thumb = it.image
      ? '<div class="news-thumb"><img src="' + esc(it.image) + '" alt=""></div>'
      : '<div class="news-thumb">' + esc(it.emoji || '\u2728') + '</div>';
    return '<a href="' + esc(it.link || '#') + '" class="news-card">' +
        thumb +
        '<div class="news-body">' +
          '<div class="news-date">' + esc(dateText) + '</div>' +
          '<div class="news-title">' + esc(it.title) + '</div>' +
          (it.excerpt ? '<div class="news-excerpt">' + esc(it.excerpt) + '</div>' : '') +
        '</div>' +
      '</a>';
  }

  function fallback(el){
    // Use the page's existing renderNewsFallback if it exists.
    if (typeof renderNewsFallback === 'function') {
      try { renderNewsFallback(); return; } catch(e){}
    }
    el.innerHTML = '<div class="news-loading">Keine Neuigkeiten verf&uuml;gbar.</div>';
  }

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c];
    });
  }

  // Minimal CSV parser — handles quoted fields, escaped quotes, CRLF
  function parseCSV(text){
    var rows = [], row = [], field = '', inQ = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQ) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') { inQ = false; }
        else { field += c; }
      } else {
        if (c === '"') { inQ = true; }
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (c !== '\r') { field += c; }
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }

    var header = (rows.shift() || []).map(function(h){ return String(h).trim().toLowerCase(); });
    return rows
      .filter(function(r){ return r.some(function(v){ return v && String(v).trim(); }); })
      .map(function(r){
        var o = {};
        header.forEach(function(h, i){ o[h] = (r[i] == null ? '' : String(r[i])).trim(); });
        return o;
      });
  }

  // Auto-run when the DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadNews);
  } else {
    loadNews();
  }

  // Expose for manual refresh from the console / other scripts
  window.T7LoadNews = loadNews;
})();