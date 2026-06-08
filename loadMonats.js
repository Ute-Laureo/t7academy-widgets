/* ============================================================
   T7 ACADEMY - Challenge des Monats Loader
   ------------------------------------------------------------
   Loads the "Challenge des Monats" panel on the Challenges page
   from a published Google Sheet (CSV export). Admin updates
   each month by editing the sheet - no code changes needed.

   USAGE:
   ------
   1. Set CSV_URL below to the sheet's published-to-web CSV link.
      The URL MUST end in /pub?output=csv (NOT /pubhtml).
      For a multi-tab workbook, also add &gid=TAB_GID&single=true
      to target the specific tab.
   2. The sheet must have these column headers in row 1:
         month_key | month_label | challenge_name | hero_text | drill_order | drill_title | drill_meta | vimeo_url | xp | published

      Each ROW is one drill. Rows that share the same month_key
      belong to the same month. The first row of a month supplies
      the month_label / challenge_name / hero_text (copy these
      values down across all rows of that month for safety).

      Column reference:
      - month_key:      e.g. "2026-06" - groups rows into months,
                        and the lexicographically newest month_key
                        with published rows is shown.
      - month_label:    Human label shown on the card, e.g. "Juni 2026"
      - challenge_name: Title shown in the widget, e.g. "Double Seven"
      - hero_text:      Intro paragraph below the title (optional)
      - drill_order:    1, 2, 3 ... ordering inside the month
      - drill_title:    Name of the drill, e.g. "Reverse Elastico"
      - drill_meta:     Sub-label, e.g. "Mittel - Ginga Advanced"
      - vimeo_url:      Full Vimeo URL with id and hash, e.g.
                        https://vimeo.com/1130122092/9e2782b01e
      - xp:             XP per drill (optional, default 20)
      - published:      Leave blank or "yes" to show; "no" to hide

   The loader picks the newest published month_key, builds a
   T7.challenge() with the drills, and auto-expands the list so
   the drills are immediately visible.

   Open the browser Console to see step-by-step diagnostic logs
   prefixed with [Monats] - they show exactly what was fetched,
   parsed, filtered, and mounted.
   ============================================================ */

(function(){
  /* The Monats data lives in the Monthly_Challenge tab (gid=861911345)
     of the same workbook as the News feed. Same publish ID, just a
     different tab targeted via &gid=...&single=true. */
  var CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQHWaswAJIeuF1xBh_yBGIDKcB58lya5y6NEJ-rLS_3pJ-7mEZruDXjo7uOj5s5DwtXSEuH7-iq-kYk/pub?output=csv&gid=861911345&single=true';

  var MOUNT_ID = 'monats-container';
  var LABEL_ID = 'monatsLabel';
  var NAME_ID  = 'monatsName';

  /* Diagnostic helper - prefixes every log so they're easy to find */
  function log(){
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[Monats]');
    console.log.apply(console, args);
  }

  function loadMonats(){
    log('Loader starting. CSV_URL =', CSV_URL);
    if(!CSV_URL || CSV_URL.indexOf('PASTE_')===0){
      fallback('CSV_URL ist nicht gesetzt in loadMonats.js.');
      return;
    }
    /* Sanity check the URL format - the most common mistake */
    if(CSV_URL.indexOf('/pubhtml') !== -1){
      console.warn('[Monats] CSV_URL ends in /pubhtml - that returns HTML, not CSV. Change to /pub?output=csv');
      fallback('CSV_URL endet auf /pubhtml. Aendere zu /pub?output=csv.');
      return;
    }
    if(CSV_URL.indexOf('output=csv') === -1){
      console.warn('[Monats] CSV_URL does not contain output=csv - the loader needs CSV format');
      fallback('CSV_URL braucht output=csv.');
      return;
    }

    /* cache-bust so admin edits show up fast */
    var url = CSV_URL + (CSV_URL.indexOf('?')>-1 ? '&' : '?') + 't=' + Date.now();
    log('Fetching:', url);

    fetch(url).then(function(r){
      log('HTTP status:', r.status, r.statusText);
      if(!r.ok) throw new Error('http '+r.status);
      return r.text();
    }).then(function(csv){
      log('Got', csv.length, 'chars of CSV');
      log('First 300 chars:', csv.slice(0,300));

      /* Defensive: detect HTML response masquerading as CSV
         (happens if the URL is /pubhtml or the sheet isn't published) */
      var lead = csv.trim().slice(0,200).toLowerCase();
      if(lead.indexOf('<!doctype') === 0 || lead.indexOf('<html') !== -1){
        console.warn('[Monats] Response looks like HTML, not CSV. URL or publish setting is wrong.');
        fallback('Antwort ist HTML, nicht CSV. URL pruefen.');
        return;
      }

      var parsed = parseCSV(csv);
      log('Parsed', parsed.length, 'data rows');
      if(parsed.length){
        log('Detected columns:', Object.keys(parsed[0]));
        log('First row:', parsed[0]);
      }

      var rows = parsed.filter(function(r, idx){
        var why = null;
        if(!r.month_key)        why = 'no month_key';
        else if(!r.drill_title) why = 'no drill_title';
        else if(!r.vimeo_url)   why = 'no vimeo_url';
        else {
          var p = (r.published||'').toLowerCase();
          if(p === 'no' || p === 'false' || p === '0') why = 'published=' + p;
        }
        if(why){ log('Row', idx, 'skipped:', why, r); return false; }
        return true;
      });
      log(rows.length, 'rows passed the filter');

      if(!rows.length){
        var hint = parsed.length
          ? 'CSV hat ' + parsed.length + ' Zeilen, aber keine erfuellt month_key + drill_title + vimeo_url + published<>no. Siehe Console.'
          : 'CSV ist leer. Pruefe Sheet & Publish-Einstellungen.';
        fallback(hint);
        return;
      }

      /* Group by month_key, pick the lexicographically newest one */
      var byMonth = {};
      rows.forEach(function(r){ (byMonth[r.month_key] = byMonth[r.month_key] || []).push(r); });
      var keys = Object.keys(byMonth).sort();
      var newestKey = keys[keys.length-1];
      var monthRows = byMonth[newestKey].sort(function(a,b){
        return (parseInt(a.drill_order,10)||0) - (parseInt(b.drill_order,10)||0);
      });
      log('Picked month_key:', newestKey, 'with', monthRows.length, 'drill(s)');

      mountChallenge(newestKey, monthRows);
    }).catch(function(e){
      console.warn('[Monats] fetch/parse failed:', e);
      fallback('Konnte das Google Sheet nicht laden: ' + (e && e.message || e));
    });
  }

  function mountChallenge(monthKey, monthRows){
    var head = monthRows[0];
    var monthLabel = head.month_label || monthKey;
    var name = head.challenge_name || 'Challenge des Monats';
    var hero = head.hero_text || ('Diesen Monat: ' + name + '. Zeig was du drauf hast!');

    var lbl = document.getElementById(LABEL_ID);
    var nm  = document.getElementById(NAME_ID);
    if(lbl) lbl.textContent = monthLabel;
    if(nm)  nm.textContent  = name;

    var drills = monthRows.map(function(r,i){
      var vh = parseVidHash(r.vimeo_url);
      if(!vh.vid || !vh.hash){
        console.warn('[Monats] Drill', i+1, 'has bad vimeo_url:', r.vimeo_url, '-> vid='+vh.vid+', hash='+vh.hash);
      }
      return {
        title: r.drill_title,
        eye:   'Challenge ' + String(i+1).padStart(2,'0'),
        meta:  r.drill_meta || 'Challenge des Monats',
        vid:   vh.vid,
        hash:  vh.hash,
        type:  'rate',
        xp:    parseInt(r.xp,10) || 20,
        star:  1,
        next:  i === monthRows.length-1
                 ? 'Stark! Challenge des Monats gemeistert!'
                 : 'Weiter zur naechsten Aufgabe!'
      };
    });
    log('Built', drills.length, 'drill(s). Mounting widget...');

    function mount(){
      if(typeof T7 === 'undefined' || !T7.challenge){ setTimeout(mount, 150); return; }
      var c = document.getElementById(MOUNT_ID);
      if(!c) return;
      c.innerHTML = '';
      var moduleKey = 'monats_' + monthKey.replace(/[^0-9]/g,'_');
      T7.challenge({
        containerId: MOUNT_ID,
        title: name,
        badge: '\ud83d\udd25',
        moduleKey: moduleKey,
        heroText: hero,
        unlockMsg: '',
        drills: drills
      });
      log('Widget mounted under moduleKey =', moduleKey);

      /* Auto-expand the drill list (don't auto-open the video) */
      var tries = 0;
      var poll = setInterval(function(){
        tries++;
        var crb = c.querySelector('[id^="t7a-crb-"]');
        if(crb){ clearInterval(poll); crb.click(); }
        else if(tries > 40){ clearInterval(poll); }
      }, 100);
    }
    mount();
  }

  function fallback(reason){
    var c = document.getElementById(MOUNT_ID);
    if(!c) return;
    c.innerHTML =
      '<div style="background:rgba(255,107,53,.08);border:1px dashed rgba(255,107,53,.4);'+
      'border-radius:10px;padding:14px;font-size:12px;color:rgba(255,255,255,.65);line-height:1.6">'+
      '<strong style="color:#FF6B35">Challenge des Monats nicht verfuegbar.</strong><br>'+
      esc(reason||'')+
      '<br><span style="color:rgba(255,255,255,.4);font-size:11px">Details in der Browser-Console (Web Inspector &gt; Console, Filter: <code>[Monats]</code>).</span>'+
      '</div>';
  }

  /* Parse vid + hash from a Vimeo URL like
       https://vimeo.com/1130122092/9e2782b01e
       https://vimeo.com/1130122092?h=9e2782b01e
       https://player.vimeo.com/video/1130122092?h=9e2782b01e */
  function parseVidHash(url){
    if(!url) return {vid:'',hash:''};
    var s = String(url).trim();
    var m = s.match(/vimeo\.com\/(?:video\/)?(\d+)\/([a-zA-Z0-9]+)/);
    if(m) return {vid:m[1], hash:m[2]};
    m = s.match(/vimeo\.com\/(?:video\/)?(\d+)[^a-zA-Z0-9]*?[?&]h=([a-zA-Z0-9]+)/);
    if(m) return {vid:m[1], hash:m[2]};
    m = s.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if(m) return {vid:m[1], hash:''};
    return {vid:'',hash:''};
  }

  function esc(s){
    return String(s==null?'':s).replace(/[&<>"']/g, function(c){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
    });
  }

  /* CSV parser - handles quoted fields, escaped quotes, CRLF */
  function parseCSV(text){
    var rows = [], row = [], field = '', inQ = false;
    for(var i = 0; i < text.length; i++){
      var c = text[i];
      if(inQ){
        if(c === '"' && text[i+1] === '"'){ field += '"'; i++; }
        else if(c === '"'){ inQ = false; }
        else { field += c; }
      } else {
        if(c === '"'){ inQ = true; }
        else if(c === ','){ row.push(field); field = ''; }
        else if(c === '\n'){ row.push(field); rows.push(row); row = []; field = ''; }
        else if(c !== '\r'){ field += c; }
      }
    }
    if(field.length || row.length){ row.push(field); rows.push(row); }

    var header = (rows.shift() || []).map(function(h){ return String(h).trim().toLowerCase(); });
    return rows
      .filter(function(r){ return r.some(function(v){ return v && String(v).trim(); }); })
      .map(function(r){
        var o = {};
        header.forEach(function(h,i){ o[h] = (r[i]==null ? '' : String(r[i])).trim(); });
        return o;
      });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', loadMonats);
  } else {
    loadMonats();
  }

  /* Expose for manual refresh from the console */
  window.T7LoadMonats = loadMonats;
})();
