/* ============================================================
   T7 ACADEMY - Challenge des Monats Loader
   ------------------------------------------------------------
   Loads the "Challenge des Monats" panel on the Challenges page
   from a published Google Sheet (CSV export). Admin updates
   each month by editing the sheet - no code changes needed.

   USAGE:
   ------
   1. Set CSV_URL below to the sheet's published-to-web CSV link
      (File > Share > Publish to web > pick the tab > CSV > Publish).
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
   ============================================================ */

(function(){
  /* PASTE the published-to-web CSV URL of your Monats sheet here.
     Looks like: https://docs.google.com/spreadsheets/d/e/2PACX-1v.../pub?output=csv */
  var CSV_URL = 'var CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1v.../pub?output=csv&gid=987654321&single=true';
  var MOUNT_ID = 'monats-container';
  var LABEL_ID = 'monatsLabel';
  var NAME_ID  = 'monatsName';

  function loadMonats(){
    if(!CSV_URL || CSV_URL.indexOf('PASTE_')===0){
      fallback('Setze CSV_URL in loadMonats.js.');
      return;
    }
    /* cache-bust so admin edits show up fast */
    var url = CSV_URL + (CSV_URL.indexOf('?')>-1 ? '&' : '?') + 't=' + Date.now();
    fetch(url).then(function(r){
      if(!r.ok) throw new Error('http '+r.status);
      return r.text();
    }).then(function(csv){
      var rows = parseCSV(csv).filter(function(r){
        if(!r.month_key || !r.drill_title || !r.vimeo_url) return false;
        var p = (r.published||'').toLowerCase();
        return p !== 'no' && p !== 'false' && p !== '0';
      });
      if(!rows.length){ fallback('Keine veroeffentlichten Eintraege gefunden.'); return; }

      /* Group by month_key, then pick the newest (lexicographic sort works for YYYY-MM) */
      var byMonth = {};
      rows.forEach(function(r){
        (byMonth[r.month_key] = byMonth[r.month_key] || []).push(r);
      });
      var keys = Object.keys(byMonth).sort();
      var newestKey = keys[keys.length-1];
      var monthRows = byMonth[newestKey].sort(function(a,b){
        return (parseInt(a.drill_order,10)||0) - (parseInt(b.drill_order,10)||0);
      });

      mountChallenge(newestKey, monthRows);
    }).catch(function(e){
      console.warn('[loadMonats] failed:',e);
      fallback('Konnte das Google Sheet nicht laden.');
    });
  }

  function mountChallenge(monthKey, monthRows){
    /* First row's metadata is the month metadata */
    var head = monthRows[0];
    var monthLabel = head.month_label || monthKey;
    var name = head.challenge_name || 'Challenge des Monats';
    var hero = head.hero_text || ('Diesen Monat: ' + name + '. Zeig was du drauf hast!');

    /* Update top labels on the section header */
    var lbl = document.getElementById(LABEL_ID);
    var nm  = document.getElementById(NAME_ID);
    if(lbl) lbl.textContent = monthLabel;
    if(nm)  nm.textContent  = name;

    /* Build drills from rows */
    var drills = monthRows.map(function(r,i){
      var vh = parseVidHash(r.vimeo_url);
      return {
        title: r.drill_title,
        eye:   'Challenge ' + String(i+1).padStart(2,'0'),
        meta:  r.drill_meta || 'Challenge des Monats',
        vid:   vh.vid,
        hash:  vh.hash,
        type:  'rate',
        xp:    parseInt(r.xp,10) || 20,
        star:  1,  /* always open - no progressive unlock for monthly */
        next:  i === monthRows.length-1
                 ? 'Stark! Challenge des Monats gemeistert!'
                 : 'Weiter zur naechsten Aufgabe!'
      };
    });

    /* Mount when T7 engine is ready (engine.js may still be loading) */
    function mount(){
      if(typeof T7 === 'undefined' || !T7.challenge){
        setTimeout(mount, 150);
        return;
      }
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

  /* CSV parser - same as loadNews.js: handles quoted fields, escaped quotes, CRLF */
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
