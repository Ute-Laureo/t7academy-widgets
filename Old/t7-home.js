/* ============================================================
   T7 ACADEMY — t7-home.js
   ------------------------------------------------------------
   Single home-page script.  Absorbs what used to live in:
     - the inline <script> block on T7Academy_Home.html
       (progress cards: Sevens, Sterne, Challenges, Zertifikate)
     - loadNews.js                       (Google-Sheet news feed)
     - the inline theme + nav handler
   And adds three NEW personalization modules:
     - Avatar    (player photo, hero + nav)
     - Videos    (private match/training uploads)
     - Diary     (was lief gut / worauf achten)

   Vimeo watch-time tracking remains in its own file
   (t7-vimeo-tracker.js) because it is page-agnostic and used
   on the Sevens, Sterne and Minis pages too.

   ────────────────────────────────────────────────────────────
   REQUIRED SUPABASE SCHEMA
   Run once in the Supabase SQL editor before deploying:
   ────────────────────────────────────────────────────────────

     -- 1) Avatar URL on the existing player_profiles row
     alter table player_profiles
       add column if not exists avatar_url text;

     -- 2) Private player clips (match / training videos)
     create table if not exists player_clips (
       id            uuid primary key default gen_random_uuid(),
       profile_id    uuid not null references player_profiles(id) on delete cascade,
       title         text,
       storage_path  text not null,
       mime_type     text,
       size_bytes    bigint,
       created_at    timestamptz not null default now()
     );
     create index if not exists player_clips_profile_idx
       on player_clips(profile_id, created_at desc);

     -- 3) Diary entries (one per day per player, last write wins)
     create table if not exists player_diary (
       id           uuid primary key default gen_random_uuid(),
       profile_id   uuid not null references player_profiles(id) on delete cascade,
       entry_date   date not null,
       good_text    text,
       watch_text   text,
       updated_at   timestamptz not null default now(),
       unique (profile_id, entry_date)
     );
     create index if not exists player_diary_profile_idx
       on player_diary(profile_id, entry_date desc);

     -- 4) RLS — players see/edit only their own rows.  Adjust to
     --    match your auth model (these assume profile_id = auth.uid()
     --    via the same pattern as video_progress).
     alter table player_clips enable row level security;
     alter table player_diary enable row level security;

     create policy "clips_self_select" on player_clips for select
       using (profile_id = auth.uid());
     create policy "clips_self_insert" on player_clips for insert
       with check (profile_id = auth.uid());
     create policy "clips_self_delete" on player_clips for delete
       using (profile_id = auth.uid());

     create policy "diary_self_select" on player_diary for select
       using (profile_id = auth.uid());
     create policy "diary_self_upsert" on player_diary for insert
       with check (profile_id = auth.uid());
     create policy "diary_self_update" on player_diary for update
       using (profile_id = auth.uid());

   STORAGE BUCKETS (create via Supabase Storage UI):
     - "player-avatars"  → public read, authenticated write
     - "player-clips"    → private (signed URLs only), authenticated write

   For the anon-key flow used by these widgets, both buckets
   need an INSERT policy on storage.objects scoped to the
   profile_id path prefix.  Example for player-clips:

     create policy "clips_self_write" on storage.objects for insert
       with check (
         bucket_id = 'player-clips'
         and (storage.foldername(name))[1] = auth.uid()::text
       );
   ============================================================ */

(function(){
  if (window.__T7_HOME_LOADED__) return;
  window.__T7_HOME_LOADED__ = true;


  /* ============================================================
     CONSTANTS
  ============================================================ */
  var SB_URL = window.T7_SB_URL || 'https://qajjuhjmrtuomwrbxmpz.supabase.co';
  var SB_KEY = window.T7_SB_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhamp1aGptcnR1b213cmJ4bXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTMzNTksImV4cCI6MjA5MDAyOTM1OX0.4tyFG-e2IIh0Iwze7TQorfRF7DqUQkGBpeRgCcMkFC4';

  var AVATAR_BUCKET = 'player-avatars';
  var CLIPS_BUCKET  = 'player-clips';

  /* Watch-time threshold for "Video gesehen" tile (matches what
     the old inline script used). */
  var SEEN_THRESHOLD_SEC = 30;

  /* Module metadata — must mirror the Challenges page configs */
  var CHALLENGE_MODULES = [
    { key: 'jong',  label: 'Jonglierschule',  total: 4 },
    { key: 'ft1',   label: 'First Touch',     total: 5 },
    { key: 'fta1',  label: 'First Touch Air', total: 6 },
    { key: 'gc0',   label: 'Ginga Basic',     total: 5 },
    { key: 'gc1',   label: 'Ginga Advanced',  total: 5 },
    { key: 'jong2', label: 'Ball in der Luft',total: 4 }
  ];
  var CERT_MODULES = [
    { key: 'sz1', label: '1 Stern',  stars: 1, total: 5 },
    { key: 'sz2', label: '2 Sterne', stars: 2, total: 5 },
    { key: 'sz3', label: '3 Sterne', stars: 3, total: 5 },
    { key: 'sz4', label: '4 Sterne', stars: 4, total: 5 },
    { key: 'sz5', label: '5 Sterne', stars: 5, total: 5 }
  ];

  /* News feed source (Google Sheets, published CSV) */
  var NEWS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQHWaswAJIeuF1xBh_yBGIDKcB58lya5y6NEJ-rLS_3pJ-7mEZruDXjo7uOj5s5DwtXSEuH7-iq-kYk/pub?output=csv';


  /* ============================================================
     HELPERS
  ============================================================ */
  function $(id){ return document.getElementById(id); }

  function sbHeaders(extra){
    var h = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };
    if (extra) Object.keys(extra).forEach(function(k){ h[k] = extra[k]; });
    return h;
  }

  function sbGet(path){
    return fetch(SB_URL + '/rest/v1/' + path, { headers: sbHeaders() })
      .then(function(r){ return r.ok ? r.json() : []; })
      .catch(function(){ return []; });
  }

  function sbUpsert(table, body, onConflict){
    var url = SB_URL + '/rest/v1/' + table + (onConflict ? '?on_conflict=' + encodeURIComponent(onConflict) : '');
    return fetch(url, {
      method: 'POST',
      headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' }),
      body: JSON.stringify(body)
    }).then(function(r){ return r.ok ? r.json() : null; });
  }

  function sbDelete(path){
    return fetch(SB_URL + '/rest/v1/' + path, { method: 'DELETE', headers: sbHeaders() });
  }

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c];
    });
  }

  function todayISO(){
    var d = new Date();
    var pad = function(n){ return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function fmtDate(s){
    if (!s) return '';
    var d = new Date(s);
    if (isNaN(d)) return s;
    return d.toLocaleDateString('de-AT', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function fmtWatchTime(seconds){
    var min = Math.round(seconds / 60);
    if (min < 60) return min + ' Min';
    return Math.floor(min / 60) + 'h ' + (min % 60) + 'm';
  }

  function renderEmpty(el, msg){
    el.innerHTML = '<div class="po-empty">' + esc(msg) + '</div>';
  }


  /* ============================================================
     THEME + NAV (was inline)
  ============================================================ */
  function initThemeAndNav(){
    var theme = localStorage.getItem('t7_theme') || 'dark';
    var MOON = '\u263E';
    var SUN  = '\u2600';
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    var tog = $('themeToggle');
    if (tog) {
      tog.innerHTML = theme === 'dark' ? MOON : SUN;
      tog.onclick = function(){
        theme = theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('t7_theme', theme);
        tog.innerHTML = theme === 'dark' ? MOON : SUN;
      };
    }

    /* WP admin bar offset + shrink-on-scroll */
    var nav = document.querySelector('.topnav');
    if (nav) {
      var adminBar = $('wpadminbar');
      var updateTop = function(){ nav.style.top = adminBar ? adminBar.offsetHeight + 'px' : '0'; };
      updateTop();
      window.addEventListener('resize', updateTop);
      window.addEventListener('scroll', function(){
        if (window.scrollY > 40) nav.classList.add('nav-shrunk');
        else nav.classList.remove('nav-shrunk');
      });
    }
  }


  /* ============================================================
     IDENTITY — wait for T7Identity to resolve, then call cb(id|null)
  ============================================================ */
  function whenIdentity(cb){
    function go(){ T7Identity.resolve(function(id){ cb(id || null); }); }
    if (window.T7Identity) go();
    else setTimeout(function(){
      if (window.T7Identity) go();
      else cb(null);
    }, 1500);
  }


  /* ============================================================
     AVATAR — hero photo + nav thumb
     Stored at:  player-avatars/{profile_id}.{ext}
     URL kept on player_profiles.avatar_url
  ============================================================ */
  var currentProfileId = null;

  function applyAvatar(url){
    var slot = $('avatarSlot');
    var navAv = $('navAvatar');
    if (url) {
      if (slot) {
        slot.style.backgroundImage = "url('" + url + "')";
        slot.style.backgroundSize  = 'cover';
        slot.style.backgroundPosition = 'center';
        slot.classList.remove('no-photo');
      }
      if (navAv) {
        navAv.style.backgroundImage = "url('" + url + "')";
        navAv.classList.add('has-photo');
      }
    } else {
      /* No photo set yet — keep default hero image, show overlay */
      if (slot) slot.classList.add('no-photo');
      if (navAv) {
        navAv.classList.remove('has-photo');
        navAv.style.backgroundImage = '';
        navAv.textContent = '?';
      }
    }
  }

  function initAvatar(profileId){
    var slot  = $('avatarSlot');
    var input = $('avatarInput');
    if (!slot || !input) return;

    /* Click / Enter / Space → open file picker */
    var openPicker = function(){ if (profileId) input.click(); };
    slot.addEventListener('click', openPicker);
    slot.addEventListener('keydown', function(e){
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); }
    });

    /* Pull existing avatar URL */
    if (!profileId) { applyAvatar(null); return; }
    sbGet('player_profiles?id=eq.' + encodeURIComponent(profileId) + '&select=avatar_url')
      .then(function(rows){ applyAvatar(rows && rows[0] && rows[0].avatar_url); });

    /* Upload on file pick */
    input.addEventListener('change', function(){
      var file = input.files && input.files[0];
      if (!file) return;
      if (file.size > 8 * 1024 * 1024) {
        alert('Das Bild ist zu groß (max. 8 MB).');
        return;
      }
      slot.classList.add('uploading');

      var ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      var path = profileId + '.' + ext;
      var uploadUrl = SB_URL + '/storage/v1/object/' + AVATAR_BUCKET + '/' + path;

      fetch(uploadUrl, {
        method: 'POST',
        headers: {
          apikey: SB_KEY,
          Authorization: 'Bearer ' + SB_KEY,
          'Content-Type': file.type || 'image/jpeg',
          'x-upsert': 'true'
        },
        body: file
      }).then(function(r){
        if (!r.ok) throw new Error('upload failed (' + r.status + ')');
        var publicUrl = SB_URL + '/storage/v1/object/public/' + AVATAR_BUCKET + '/' + path + '?t=' + Date.now();
        /* Persist URL on player_profiles */
        return fetch(SB_URL + '/rest/v1/player_profiles?id=eq.' + encodeURIComponent(profileId), {
          method: 'PATCH',
          headers: sbHeaders({ Prefer: 'return=minimal' }),
          body: JSON.stringify({ avatar_url: publicUrl })
        }).then(function(r2){
          if (!r2.ok) {
            /* The file is up but the URL didn't persist.  Warn so admin
               can check whether avatar_url exists on player_profiles. */
            console.warn('[T7 Home] avatar uploaded but PATCH player_profiles failed (' + r2.status + '). Did you add the avatar_url column?');
          }
          return publicUrl;
        });
      }).then(function(publicUrl){
        applyAvatar(publicUrl);
      }).catch(function(err){
        console.error('[T7 Home] avatar upload', err);
        alert('Upload fehlgeschlagen. Bitte später erneut versuchen.');
      }).then(function(){
        slot.classList.remove('uploading');
        input.value = '';
      });
    });
  }


  /* ============================================================
     PROGRESS CARDS — Sevens, Sterne, Challenges, Zertifikate
     (logic preserved from the previous inline script, only
     restructured into named functions and shared helpers.)
  ============================================================ */
  function renderVideoCard(el, profileId, kind){
    /* kind: 'sevens' or 'sterne' */
    if (!profileId) { renderEmpty(el, 'Anmelden, um Fortschritt zu sehen.'); return; }

    var videoFilter = kind === 'sevens' ? 'sevens=not.is.null' : 'stars=not.is.null';
    var numCls = kind === 'sterne' ? ' gold' : '';

    Promise.all([
      sbGet('videos?' + videoFilter + '&select=vimeo_code'),
      sbGet('video_progress?profile_id=eq.' + encodeURIComponent(profileId) + '&select=vimeo_id,total_seconds')
    ]).then(function(res){
      var videos = res[0] || [];
      var progress = res[1] || [];
      var ids = {};
      videos.forEach(function(v){ if (v.vimeo_code) ids[v.vimeo_code] = true; });
      var totalVideos = Object.keys(ids).length;

      var seen = 0, seconds = 0;
      progress.forEach(function(p){
        if (!ids[p.vimeo_id]) return;
        var s = Number(p.total_seconds || 0);
        seconds += s;
        if (s >= SEEN_THRESHOLD_SEC) seen++;
      });

      el.innerHTML =
        '<div class="po-stats-row">' +
          '<div class="po-stat-tile">' +
            '<div class="po-stat-num' + numCls + '">' + seen +
              (totalVideos ? '<span style="opacity:.4;font-weight:500">/' + totalVideos + '</span>' : '') +
            '</div>' +
            '<div class="po-stat-label">Videos gesehen</div>' +
          '</div>' +
          '<div class="po-stat-tile">' +
            '<div class="po-stat-num' + numCls + '">' + fmtWatchTime(seconds) + '</div>' +
            '<div class="po-stat-label">Watch Time</div>' +
          '</div>' +
        '</div>';

      /* Feed hero stats from Sevens+Sterne combined when both render */
      cumulativeHeroStats.seenVideos += seen;
      cumulativeHeroStats.seconds += seconds;
      flushHeroStats();
    }).catch(function(){ renderEmpty(el, 'Fehler beim Laden.'); });
  }

  function renderChallenges(el, profileId){
    if (!profileId) { renderEmpty(el, 'Anmelden, um Fortschritt zu sehen.'); return; }
    sbGet('drill_attempts?profile_id=eq.' + encodeURIComponent(profileId) + '&select=module_key,drill_idx,rating')
      .then(function(rows){
        var best = {};
        (rows || []).forEach(function(a){
          if (!best[a.module_key]) best[a.module_key] = {};
          var cur = best[a.module_key][a.drill_idx] || 0;
          if (a.rating > cur) best[a.module_key][a.drill_idx] = a.rating;
        });
        el.innerHTML = CHALLENGE_MODULES.map(function(m){
          var mb = best[m.key] || {};
          var done = Object.keys(mb).filter(function(k){ return mb[k] >= 4; }).length;
          var pct  = Math.round(done / m.total * 100);
          return '<div>' +
            '<div class="po-mod-row"><span class="po-mod-name">' + esc(m.label) + '</span>' +
              '<span class="po-mod-stat">' + done + '/' + m.total + '</span></div>' +
            '<div class="po-bar"><div class="po-bar-fill cyan" style="width:' + pct + '%"></div></div>' +
          '</div>';
        }).join('');
      }).catch(function(){ renderEmpty(el, 'Fehler beim Laden.'); });
  }

  function renderCerts(el, profileId){
    if (!profileId) { renderEmpty(el, 'Anmelden, um Fortschritt zu sehen.'); return; }
    Promise.all([
      sbGet('drill_attempts?profile_id=eq.' + encodeURIComponent(profileId) + '&select=module_key,drill_idx,rating'),
      sbGet('player_stats?id=eq.' + encodeURIComponent(profileId) + '&select=stars,xp')
    ]).then(function(res){
      var attempts = res[0] || [];
      var statsRow = (res[1] || [])[0] || {};
      var earnedStars = Number(statsRow.stars || 0);

      /* Feed hero XP */
      if (typeof statsRow.xp === 'number') {
        cumulativeHeroStats.xp = statsRow.xp;
        flushHeroStats();
      }

      var best = {};
      attempts.forEach(function(a){
        if (!best[a.module_key]) best[a.module_key] = {};
        var cur = best[a.module_key][a.drill_idx] || 0;
        if (a.rating > cur) best[a.module_key][a.drill_idx] = a.rating;
      });
      el.innerHTML = CERT_MODULES.map(function(m){
        var mb = best[m.key] || {};
        var done = Object.keys(mb).filter(function(k){ return mb[k] >= 4; }).length;
        var pct  = Math.round(done / m.total * 100);
        var cert = earnedStars >= m.stars
          ? ' <span style="color:var(--lp-gold);font-weight:800">★</span>' : '';
        return '<div>' +
          '<div class="po-mod-row"><span class="po-mod-name">' + esc(m.label) + cert + '</span>' +
            '<span class="po-mod-stat">' + done + '/' + m.total + '</span></div>' +
          '<div class="po-bar"><div class="po-bar-fill gold" style="width:' + pct + '%"></div></div>' +
        '</div>';
      }).join('');
    }).catch(function(){ renderEmpty(el, 'Fehler beim Laden.'); });
  }


  /* ============================================================
     HERO STATS — small aggregator that sums data from the four
     progress cards.  Each card calls flushHeroStats() when its
     data arrives.
  ============================================================ */
  var cumulativeHeroStats = { seenVideos: 0, seconds: 0, xp: null };

  function flushHeroStats(){
    var v = $('stat-videos');
    var w = $('stat-watchtime');
    var x = $('stat-xp');
    if (v) v.textContent = cumulativeHeroStats.seenVideos;
    if (w) w.textContent = fmtWatchTime(cumulativeHeroStats.seconds);
    if (x) x.textContent = cumulativeHeroStats.xp != null ? cumulativeHeroStats.xp : '—';
  }

  function resetHeroStats(){
    cumulativeHeroStats = { seenVideos: 0, seconds: 0, xp: null };
  }

  function initProgress(profileId){
    resetHeroStats();
    renderVideoCard($('po-sevens-body'), profileId, 'sevens');
    renderVideoCard($('po-sterne-body'), profileId, 'sterne');
    renderChallenges($('po-challenges-body'), profileId);
    renderCerts($('po-certs-body'), profileId);

    /* Refresh when XP is gained in any widget on the page */
    window.addEventListener('t7xpupdate', function(){
      var info = window.T7Identity && T7Identity.get();
      if (info && info.id) {
        renderChallenges($('po-challenges-body'), info.id);
        renderCerts($('po-certs-body'), info.id);
      }
    });
  }


  /* ============================================================
     MEINE VIDEOS — private clip uploads
     Bucket:  player-clips/{profile_id}/{uuid}.{ext}
     Table:   player_clips
  ============================================================ */
  function uuid(){
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function renderClips(profileId){
    var list = $('myvidsList');
    if (!list) return;
    if (!profileId) { list.innerHTML = '<div class="myvids-empty">Anmelden, um eigene Videos zu sehen.</div>'; return; }

    sbGet('player_clips?profile_id=eq.' + encodeURIComponent(profileId) + '&select=id,title,storage_path,mime_type,created_at&order=created_at.desc')
      .then(function(rows){
        if (!rows.length) {
          list.innerHTML = '<div class="myvids-empty">Noch keine Videos. Lade dein erstes Match oder Training hoch.</div>';
          return;
        }
        list.innerHTML = rows.map(function(c){
          var url = SB_URL + '/storage/v1/object/public/' + CLIPS_BUCKET + '/' + c.storage_path;
          return '' +
            '<div class="myvid-card" data-id="' + esc(c.id) + '">' +
              '<div class="myvid-thumb" data-url="' + esc(url) + '">' +
                '<video src="' + esc(url) + '#t=0.1" preload="metadata" muted playsinline></video>' +
                '<div class="myvid-play"></div>' +
              '</div>' +
              '<div class="myvid-meta">' +
                '<div class="myvid-title">' + esc(c.title || 'Eigenes Video') + '</div>' +
                '<div class="myvid-date">' + esc(fmtDate(c.created_at)) + '</div>' +
              '</div>' +
              '<button class="myvid-del" data-id="' + esc(c.id) + '" data-path="' + esc(c.storage_path) + '" title="Löschen">✕ Löschen</button>' +
            '</div>';
        }).join('');

        /* Tap thumb → open lightbox player */
        Array.prototype.forEach.call(list.querySelectorAll('.myvid-thumb'), function(t){
          t.addEventListener('click', function(){ openClipPlayer(t.dataset.url); });
        });
        /* Tap delete */
        Array.prototype.forEach.call(list.querySelectorAll('.myvid-del'), function(b){
          b.addEventListener('click', function(){
            if (!confirm('Dieses Video wirklich löschen?')) return;
            deleteClip(b.dataset.id, b.dataset.path).then(function(){ renderClips(profileId); });
          });
        });
      });
  }

  function openClipPlayer(url){
    var ov = document.createElement('div');
    ov.className = 'myvid-overlay';
    ov.innerHTML =
      '<button class="myvid-overlay-close" aria-label="Schließen">✕</button>' +
      '<video src="' + esc(url) + '" controls autoplay playsinline></video>';
    var close = function(){ document.body.removeChild(ov); };
    ov.addEventListener('click', function(e){ if (e.target === ov) close(); });
    ov.querySelector('.myvid-overlay-close').addEventListener('click', close);
    document.addEventListener('keydown', function esc(e){
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
    document.body.appendChild(ov);
  }

  function uploadClip(profileId, file){
    var progressWrap = $('myvidsProgress');
    var progressFill = $('myvidsProgressFill');
    var progressLbl  = $('myvidsProgressLabel');
    progressWrap.hidden = false;
    progressFill.style.width = '0%';
    progressLbl.textContent = 'Hochladen…';

    var ext  = (file.name.split('.').pop() || 'mp4').toLowerCase();
    var path = profileId + '/' + uuid() + '.' + ext;

    return new Promise(function(resolve, reject){
      /* Use XHR for upload progress (fetch has no native progress) */
      var xhr = new XMLHttpRequest();
      xhr.open('POST', SB_URL + '/storage/v1/object/' + CLIPS_BUCKET + '/' + path);
      xhr.setRequestHeader('apikey', SB_KEY);
      xhr.setRequestHeader('Authorization', 'Bearer ' + SB_KEY);
      xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
      xhr.upload.onprogress = function(e){
        if (!e.lengthComputable) return;
        var pct = Math.round(e.loaded / e.total * 100);
        progressFill.style.width = pct + '%';
        progressLbl.textContent = 'Hochladen… ' + pct + '%';
      };
      xhr.onload = function(){
        if (xhr.status >= 200 && xhr.status < 300) resolve(path);
        else reject(new Error('upload failed (' + xhr.status + ')'));
      };
      xhr.onerror = function(){ reject(new Error('network error')); };
      xhr.send(file);
    }).then(function(storagePath){
      progressLbl.textContent = 'Speichern…';
      var title = file.name.replace(/\.[^.]+$/, '').slice(0, 80);
      return sbUpsert('player_clips', {
        profile_id:   profileId,
        title:        title,
        storage_path: storagePath,
        mime_type:    file.type || 'video/mp4',
        size_bytes:   file.size
      });
    });
  }

  function deleteClip(id, storagePath){
    /* Delete the row, then the storage object.  We swallow errors
       on the storage side — orphaned files aren't user-facing. */
    return sbDelete('player_clips?id=eq.' + encodeURIComponent(id))
      .then(function(){
        return fetch(SB_URL + '/storage/v1/object/' + CLIPS_BUCKET + '/' + storagePath, {
          method: 'DELETE',
          headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
        }).catch(function(){});
      });
  }

  function initMyVideos(profileId){
    var input = $('myvidsInput');
    var wrap  = $('myvidsUpload');
    if (!input || !wrap) return;

    renderClips(profileId);

    if (!profileId) {
      wrap.style.opacity = .5;
      wrap.style.pointerEvents = 'none';
      return;
    }

    /* The <label> already triggers the file input on click;
       the change handler does the work. */
    input.addEventListener('change', function(){
      var file = input.files && input.files[0];
      if (!file) return;
      if (file.size > 200 * 1024 * 1024) {
        alert('Das Video ist zu groß (max. 200 MB).');
        input.value = '';
        return;
      }
      uploadClip(profileId, file).then(function(){
        $('myvidsProgress').hidden = true;
        renderClips(profileId);
      }).catch(function(err){
        console.error('[T7 Home] clip upload', err);
        $('myvidsProgressLabel').textContent = 'Upload fehlgeschlagen.';
        setTimeout(function(){ $('myvidsProgress').hidden = true; }, 2500);
      }).then(function(){ input.value = ''; });
    });
  }


  /* ============================================================
     TAGEBUCH — diary entries
     Table:  player_diary  (unique on profile_id + entry_date)
  ============================================================ */
  function formatDiaryDate(s){
    if (!s) return '';
    var d = new Date(s);
    if (isNaN(d)) return s;
    var months = ['Jan.','Feb.','März','Apr.','Mai','Juni','Juli','Aug.','Sept.','Okt.','Nov.','Dez.'];
    var weekdays = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
    return {
      pretty: d.getDate() + '. ' + months[d.getMonth()] + ' ' + d.getFullYear(),
      weekday: weekdays[d.getDay()]
    };
  }

  function renderDiaryFeed(profileId){
    var feed = $('diaryFeed');
    if (!feed) return;
    if (!profileId) { feed.innerHTML = '<div class="diary-empty">Anmelden, um dein Tagebuch zu sehen.</div>'; return; }

    sbGet('player_diary?profile_id=eq.' + encodeURIComponent(profileId) +
          '&select=entry_date,good_text,watch_text&order=entry_date.desc&limit=30')
      .then(function(rows){
        var today = todayISO();
        /* Hide today's entry from the feed — it's already visible in the input row above. */
        var past = rows.filter(function(r){ return r.entry_date !== today; });

        if (!past.length) {
          feed.innerHTML = '<div class="diary-empty">Noch keine früheren Einträge. Fang heute an.</div>';
          return;
        }
        feed.innerHTML = past.map(function(r){
          var d = formatDiaryDate(r.entry_date);
          var good  = (r.good_text || '').trim();
          var watch = (r.watch_text || '').trim();
          return '' +
            '<div class="diary-entry">' +
              '<div class="diary-entry-date">' + esc(d.pretty) +
                '<span class="weekday">' + esc(d.weekday) + '</span>' +
              '</div>' +
              '<div class="diary-entry-cols">' +
                '<div class="diary-entry-col good">' +
                  '<div class="diary-entry-col-label">Was lief gut</div>' +
                  '<div class="diary-entry-col-text' + (good ? '' : ' empty') + '">' +
                    esc(good || '— kein Eintrag —') +
                  '</div>' +
                '</div>' +
                '<div class="diary-entry-col watch">' +
                  '<div class="diary-entry-col-label">Worauf achten</div>' +
                  '<div class="diary-entry-col-text' + (watch ? '' : ' empty') + '">' +
                    esc(watch || '— kein Eintrag —') +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>';
        }).join('');
      });
  }

  function loadTodayDiary(profileId){
    if (!profileId) return;
    sbGet('player_diary?profile_id=eq.' + encodeURIComponent(profileId) +
          '&entry_date=eq.' + todayISO() + '&select=good_text,watch_text')
      .then(function(rows){
        if (!rows.length) return;
        var r = rows[0];
        if (r.good_text)  $('diaryGood').value  = r.good_text;
        if (r.watch_text) $('diaryWatch').value = r.watch_text;
      });
  }

  function saveDiary(profileId){
    var btn = $('diarySave');
    var status = $('diarySaveStatus');
    var good  = $('diaryGood').value.trim();
    var watch = $('diaryWatch').value.trim();
    if (!good && !watch) {
      status.textContent = 'Schreib zuerst etwas auf.';
      status.classList.add('show', 'error');
      setTimeout(function(){ status.classList.remove('show', 'error'); }, 2200);
      return;
    }
    btn.disabled = true;
    status.classList.remove('error');
    status.textContent = 'Speichere…';
    status.classList.add('show');

    sbUpsert('player_diary', {
      profile_id: profileId,
      entry_date: todayISO(),
      good_text:  good || null,
      watch_text: watch || null,
      updated_at: new Date().toISOString()
    }, 'profile_id,entry_date').then(function(res){
      if (!res) throw new Error('save failed');
      status.textContent = 'Gespeichert.';
      setTimeout(function(){ status.classList.remove('show'); }, 1800);
      renderDiaryFeed(profileId);
    }).catch(function(err){
      console.error('[T7 Home] diary save', err);
      status.textContent = 'Speichern fehlgeschlagen.';
      status.classList.add('error');
    }).then(function(){ btn.disabled = false; });
  }

  function initDiary(profileId){
    var dateEl = $('diaryDate');
    if (dateEl) {
      var d = formatDiaryDate(todayISO());
      dateEl.innerHTML = 'Heute · <span style="font-style:normal;font-family:Antonio,sans-serif;font-weight:500;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--lp-faint)">' + esc(d.pretty) + '</span>';
    }
    if (!profileId) {
      $('diarySave').disabled = true;
      $('diaryGood').disabled = true;
      $('diaryWatch').disabled = true;
      $('diaryFeed').innerHTML = '<div class="diary-empty">Anmelden, um dein Tagebuch zu nutzen.</div>';
      return;
    }
    loadTodayDiary(profileId);
    renderDiaryFeed(profileId);
    $('diarySave').addEventListener('click', function(){ saveDiary(profileId); });
  }


  /* ============================================================
     NEWS FEED — Google Sheet CSV (absorbed from loadNews.js)
     Falls back to a built-in placeholder if the sheet is
     unreachable or empty.
  ============================================================ */
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

  function parseDate(s){
    if (!s) return 0;
    s = String(s).trim();
    var iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]).getTime();
    var de = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (de) return new Date(+de[3], +de[2] - 1, +de[1]).getTime();
    var d = new Date(s);
    return isNaN(d) ? 0 : d.getTime();
  }

  function renderNewsCard(it){
    var dateText = '';
    if (it.date) {
      var t = parseDate(it.date);
      dateText = t ? new Date(t).toLocaleDateString('de-AT', { day: '2-digit', month: 'short', year: 'numeric' }) : it.date;
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

  function renderNewsFallback(el){
    var items = [
      { date: '14. Mai 2026', title: 'Neue Challenges sind online!',      excerpt: 'Schau dir die brandneuen First Touch Air und Ginga Advanced Challenges an.', link: 'https://www.laureo.at/challenges/', emoji: '\u26A1' },
      { date: '10. Mai 2026', title: '1-Sterne Zertifikate verfügbar',     excerpt: 'Vom 1-Stern bis zum 5-Sterne Zertifikat — zeige was du wirklich drauf hast.',   link: 'https://www.laureo.at/challenges/', emoji: '\u2B50' },
      { date: '5. Mai 2026',  title: 'Wochen-Streak Belohnungen',          excerpt: 'Sammle XP und steige in der Rangliste auf — jede Woche zählt.',                link: 'https://www.laureo.at/challenges/', emoji: '🔥' },
      { date: '1. Mai 2026',  title: 'Willkommen zur T7 Academy',          excerpt: 'Werde der beste Spieler, der du sein kannst — mit Plan und Leidenschaft.',    link: 'https://www.laureo.at/',           emoji: '⚽' }
    ];
    el.innerHTML = items.map(renderNewsCard).join('');
  }

  function loadNews(){
    var el = $('news-feed');
    if (!el) return;
    if (!NEWS_CSV_URL || NEWS_CSV_URL.indexOf('PASTE_') === 0) {
      renderNewsFallback(el);
      return;
    }
    var url = NEWS_CSV_URL + (NEWS_CSV_URL.indexOf('?') > -1 ? '&' : '?') + 't=' + Date.now();
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
        .sort(function(a, b){ return parseDate(b.date) - parseDate(a.date); });
      if (!items.length) { renderNewsFallback(el); return; }
      el.innerHTML = items.map(renderNewsCard).join('');
    }).catch(function(){ renderNewsFallback(el); });
  }


  /* ============================================================
     BOOT
  ============================================================ */
  function boot(){
    initThemeAndNav();
    loadNews();

    whenIdentity(function(profileId){
      currentProfileId = profileId;
      initAvatar(profileId);
      initProgress(profileId);
      initMyVideos(profileId);
      initDiary(profileId);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* Public hook for debugging / manual refresh */
  window.T7Home = {
    reloadProgress: function(){
      if (currentProfileId) initProgress(currentProfileId);
    },
    reloadNews: loadNews
  };
})();
