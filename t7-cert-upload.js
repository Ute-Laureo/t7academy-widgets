/* ============================================================
   T7 ACADEMY · Certificate Video Upload Widget
   ------------------------------------------------------------
   Replaces the email-based final-video submission with a direct
   upload to a private Supabase Storage bucket.

   USAGE:
     <script src=".../t7-widget-engine.js"></script>   <!-- needed for T7Identity -->
     <script src=".../t7-cert-upload.js"></script>

     <button onclick="T7CertUpload(1)">
       Final-Video für 1-Stern Zertifikat hochladen
     </button>

   The widget:
     • Resolves the player via T7Identity (email + optional name)
     • Refuses upload if the player already has a pending submission
       for the same star tier
     • Requires a consent checkbox before the file picker activates
     • Validates file size (≤100 MB) and type (mp4 / mov / webm)
     • Uploads with a live progress bar (XMLHttpRequest)
     • Writes a row to certification_submissions
     • Shows a clear confirmation with deletion + privacy info
   ============================================================ */

(function(){
  // ── Config ───────────────────────────────────────────────
  var SB_URL = 'https://qajjuhjmrtuomwrbxmpz.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhamp1aGptcnR1b213cmJ4bXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTMzNTksImV4cCI6MjA5MDAyOTM1OX0.4tyFG-e2IIh0Iwze7TQorfRF7DqUQkGBpeRgCcMkFC4';
  var BUCKET = 'cert-submissions';
  var MAX_BYTES = 100 * 1024 * 1024;        // 100 MB
  var ALLOWED_TYPES = ['video/mp4','video/quicktime','video/webm','video/x-m4v'];

  // ── Public entry point ───────────────────────────────────
  window.T7CertUpload = function(stars){
    stars = parseInt(stars, 10);
    if (!(stars >= 1 && stars <= 5)) { console.error('T7CertUpload: stars must be 1–5'); return; }

    injectStyles();

    var email = null, name = null;
    if (window.T7Identity && typeof T7Identity.resolve === 'function') {
      T7Identity.resolve(function(e){ email = e; openModal(stars, email, name); });
    } else {
      openModal(stars, null, null);
    }
  };

  // ── Modal ────────────────────────────────────────────────
  function openModal(stars, email, name){
    closeModal();
    var ov = document.createElement('div');
    ov.className = 't7cu-overlay';
    ov.id = 't7cu-overlay';
    ov.innerHTML = renderModal(stars, email);
    document.body.appendChild(ov);

    // close on backdrop click
    ov.addEventListener('click', function(e){ if (e.target === ov) closeModal(); });
    document.getElementById('t7cu-close').onclick = closeModal;

    // pre-check: is there already a pending submission?
    if (email) checkExisting(stars, email);

    // wire up the consent checkbox to enable the file picker
    var consent = document.getElementById('t7cu-consent');
    var picker  = document.getElementById('t7cu-file');
    consent.addEventListener('change', function(){
      picker.disabled = !consent.checked;
      document.getElementById('t7cu-picker-wrap').classList.toggle('enabled', consent.checked);
    });

    picker.addEventListener('change', function(){
      var f = picker.files && picker.files[0];
      if (f) startUpload(f, stars, email);
    });
  }

  function closeModal(){
    var ov = document.getElementById('t7cu-overlay');
    if (ov) ov.remove();
  }

  function renderModal(stars, email){
    var starsTxt = stars + (stars === 1 ? '-Stern' : '-Sterne');
    return ''
      + '<div class="t7cu-modal" role="dialog" aria-modal="true">'
      +   '<button class="t7cu-close" id="t7cu-close" aria-label="Schliessen">×</button>'
      +   '<div class="t7cu-head">'
      +     '<div class="t7cu-stars">' + repeat('★', stars) + '</div>'
      +     '<h2>Final-Video · ' + starsTxt + ' Zertifikat</h2>'
      +     '<p class="t7cu-sub">' + (email ? ('Spieler: <strong>' + esc(email) + '</strong>') : 'Bitte zuerst auf der Challenges-Seite anmelden.') + '</p>'
      +   '</div>'

      +   '<div id="t7cu-status"></div>'

      +   '<div class="t7cu-rules">'
      +     '<div class="t7cu-rules-title">Bitte beim Drehen beachten:</div>'
      +     '<ul>'
      +       '<li>Drehe das Video <strong>draussen</strong> oder in einer neutralen Halle.</li>'
      +       '<li><strong>Keine anderen Personen</strong> sichtbar (auch nicht im Hintergrund).</li>'
      +       '<li>Keine Schul-, Vereins- oder Hausnummern-Logos erkennbar.</li>'
      +       '<li>Maximal <strong>2 Minuten</strong>, höchstens 100 MB (MP4, MOV oder WEBM).</li>'
      +     '</ul>'
      +   '</div>'

      +   '<label class="t7cu-consent">'
      +     '<input type="checkbox" id="t7cu-consent">'
      +     '<span>Ich bestätige, dass ich (oder bei unter 14-Jährigen meine Eltern/Erziehungsberechtigten) dem Upload zustimme. Das Video wird ausschliesslich vom T7-Experten geprüft und nach der Zertifizierung automatisch gelöscht (spätestens nach 14 Tagen).</span>'
      +   '</label>'

      +   '<div class="t7cu-picker-wrap" id="t7cu-picker-wrap">'
      +     '<input type="file" id="t7cu-file" accept="video/mp4,video/quicktime,video/webm" disabled>'
      +     '<label for="t7cu-file" class="t7cu-picker-btn">📹 Video auswählen</label>'
      +     '<div class="t7cu-picker-hint">Erst zustimmen, dann Video wählen.</div>'
      +   '</div>'

      +   '<div class="t7cu-progress-wrap" id="t7cu-progress-wrap" style="display:none">'
      +     '<div class="t7cu-progress"><div class="t7cu-progress-fill" id="t7cu-progress-fill"></div></div>'
      +     '<div class="t7cu-progress-txt" id="t7cu-progress-txt">0 %</div>'
      +   '</div>'

      +   '<div class="t7cu-footnote">Bei Fragen oder Problemen: <a href="mailto:support@laureo.at">support@laureo.at</a></div>'
      + '</div>';
  }

  // ── Pre-check: existing pending submission ───────────────
  function checkExisting(stars, email){
    var url = SB_URL + '/rest/v1/certification_submissions'
      + '?player_email=eq.' + encodeURIComponent(email)
      + '&stars=eq.' + stars
      + '&status=eq.pending'
      + '&select=id,submitted_at';
    fetch(url, { headers: anonHeaders() })
      .then(function(r){ return r.ok ? r.json() : []; })
      .then(function(rows){
        if (rows && rows.length) {
          var when = new Date(rows[0].submitted_at).toLocaleDateString('de-AT');
          showStatus('warn',
            'Du hast bereits ein Video für dieses Zertifikat eingereicht (' + when + '). '
            + 'Wir melden uns per E-Mail, sobald der Experte es geprüft hat.');
          // disable everything
          document.getElementById('t7cu-consent').disabled = true;
          document.getElementById('t7cu-file').disabled = true;
        }
      })
      .catch(function(){ /* non-fatal */ });
  }

  // ── Upload flow ──────────────────────────────────────────
  function startUpload(file, stars, email){
    // Validate
    if (!email) {
      showStatus('error', 'Wir konnten deinen Account nicht erkennen. Bitte zuerst auf der Challenges-Seite anmelden, dann neu versuchen.');
      return;
    }
    if (file.size > MAX_BYTES) {
      showStatus('error', 'Das Video ist zu gross (' + fmtMB(file.size) + ', max. ' + fmtMB(MAX_BYTES) + '). Bitte kürze oder reduziere die Qualität.');
      return;
    }
    if (ALLOWED_TYPES.indexOf(file.type) === -1) {
      showStatus('error', 'Dateityp ' + (file.type || 'unbekannt') + ' wird nicht unterstützt. Bitte MP4, MOV oder WEBM verwenden.');
      return;
    }

    // Path: <email>/<stars>/<timestamp>.<ext>
    var ts   = new Date().toISOString().replace(/[:.]/g, '-');
    var ext  = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '');
    var safeEmail = email.replace(/[^a-zA-Z0-9._-]/g, '_');
    var path = safeEmail + '/' + stars + '/' + ts + '.' + ext;

    // Hide picker, show progress
    document.getElementById('t7cu-picker-wrap').style.display = 'none';
    document.getElementById('t7cu-progress-wrap').style.display = 'block';

    var xhr = new XMLHttpRequest();
    xhr.open('POST', SB_URL + '/storage/v1/object/' + BUCKET + '/' + path);
    xhr.setRequestHeader('apikey', SB_KEY);
    xhr.setRequestHeader('Authorization', 'Bearer ' + SB_KEY);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.setRequestHeader('x-upsert', 'false');

    xhr.upload.onprogress = function(e){
      if (e.lengthComputable) {
        var pct = Math.round(e.loaded / e.total * 100);
        document.getElementById('t7cu-progress-fill').style.width = pct + '%';
        document.getElementById('t7cu-progress-txt').textContent =
          pct + ' %  ·  ' + fmtMB(e.loaded) + ' / ' + fmtMB(e.total);
      }
    };

    xhr.onerror = function(){
      showStatus('error', 'Netzwerkfehler beim Upload. Bitte später erneut versuchen.');
      resetPicker();
    };

    xhr.onload = function(){
      if (xhr.status >= 200 && xhr.status < 300) {
        // Storage upload OK — now write the submission row
        registerSubmission(path, stars, email, file);
      } else {
        var msg = 'Upload fehlgeschlagen (HTTP ' + xhr.status + ').';
        try { var b = JSON.parse(xhr.responseText); if (b.message) msg += ' ' + b.message; } catch(e){}
        showStatus('error', msg);
        resetPicker();
      }
    };

    xhr.send(file);
  }

  function registerSubmission(path, stars, email, file){
    fetch(SB_URL + '/rest/v1/certification_submissions', {
      method: 'POST',
      headers: Object.assign({}, anonHeaders(), {
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }),
      body: JSON.stringify({
        player_email:       email,
        stars:              stars,
        video_path:         path,
        consent_confirmed:  true,
        status:             'pending'
      })
    }).then(function(r){ return r.json().then(function(j){ return { ok: r.ok, body: j }; }); })
      .then(function(res){
        if (!res.ok) throw new Error(res.body && res.body.message || 'DB error');
        showSuccess(stars);
      })
      .catch(function(err){
        // We managed to upload but couldn't register. Tell the user; the
        // file will auto-expire from the bucket, no orphan harm done.
        showStatus('error', 'Upload erfolgreich, aber das Eintragen ist fehlgeschlagen. Bitte support@laureo.at kontaktieren.');
        console.error('Submission insert failed:', err);
      });
  }

  function showSuccess(stars){
    var modal = document.querySelector('.t7cu-modal');
    if (!modal) return;
    modal.innerHTML =
        '<button class="t7cu-close" onclick="document.getElementById(\'t7cu-overlay\').remove()" aria-label="Schliessen">×</button>'
      + '<div class="t7cu-success">'
      +   '<div class="t7cu-check">✓</div>'
      +   '<h2>Geschafft!</h2>'
      +   '<p>Dein Video für das <strong>' + stars + (stars===1?'-Stern':'-Sterne') + ' Zertifikat</strong> wurde sicher hochgeladen.</p>'
      +   '<p>Unser Experte prüft es in den nächsten <strong>2–3 Werktagen</strong>. Du bekommst per E-Mail Bescheid, sobald die Bewertung da ist.</p>'
      +   '<p class="t7cu-success-note">Das Video ist nur für unseren Experten sichtbar. Nach der Zertifizierung wird es automatisch gelöscht — spätestens nach 14 Tagen.</p>'
      +   '<button class="t7cu-btn" onclick="document.getElementById(\'t7cu-overlay\').remove()">Super, danke!</button>'
      + '</div>';
  }

  function resetPicker(){
    var fp = document.getElementById('t7cu-picker-wrap');
    var pw = document.getElementById('t7cu-progress-wrap');
    if (fp) fp.style.display = '';
    if (pw) pw.style.display = 'none';
    var file = document.getElementById('t7cu-file');
    if (file) file.value = '';
  }

  // ── Helpers ──────────────────────────────────────────────
  function showStatus(kind, msg){
    var el = document.getElementById('t7cu-status');
    if (!el) return;
    el.className = 't7cu-status ' + kind;
    el.textContent = msg;
  }
  function anonHeaders(){ return { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY }; }
  function repeat(s,n){ var r=''; for (var i=0;i<n;i++) r+=s; return r; }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];});}
  function fmtMB(b){ return (b / 1048576).toFixed(1) + ' MB'; }

  // ── Styles ───────────────────────────────────────────────
  function injectStyles(){
    if (document.getElementById('t7cu-styles')) return;
    var css = ''
      + '.t7cu-overlay{position:fixed;inset:0;background:rgba(8,15,30,.78);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;animation:t7cu-fade .2s ease}'
      + '@keyframes t7cu-fade{from{opacity:0}to{opacity:1}}'
      + '.t7cu-modal{position:relative;background:var(--surface,#0d1528);color:var(--text,#e0f0ff);border:1.5px solid transparent;background-image:linear-gradient(var(--surface,#0d1528),var(--surface,#0d1528)),linear-gradient(135deg,#FFD700,#FF8C00);background-origin:border-box;background-clip:padding-box,border-box;border-radius:16px;padding:28px 26px;max-width:540px;width:100%;max-height:90vh;overflow-y:auto;font-family:"Open Sans",system-ui,sans-serif;box-shadow:0 30px 80px rgba(0,0,0,.5)}'
      + '.t7cu-close{position:absolute;top:12px;right:14px;background:transparent;border:0;color:var(--muted,rgba(224,240,255,.6));font-size:28px;cursor:pointer;line-height:1;padding:4px 10px;border-radius:8px}'
      + '.t7cu-close:hover{color:var(--text,#e0f0ff);background:rgba(255,255,255,.06)}'
      + '.t7cu-head{text-align:center;margin-bottom:18px}'
      + '.t7cu-stars{font-size:28px;color:#FFD700;letter-spacing:4px;margin-bottom:6px;text-shadow:0 0 12px rgba(255,180,0,.4)}'
      + '.t7cu-head h2{margin:0;font-size:22px;font-weight:800;letter-spacing:-.01em}'
      + '.t7cu-sub{margin:6px 0 0;font-size:13px;color:var(--muted,rgba(224,240,255,.6))}'
      + '.t7cu-status{margin:0 0 16px;padding:12px 14px;border-radius:10px;font-size:13px;line-height:1.5;display:none}'
      + '.t7cu-status.warn{display:block;background:rgba(255,180,0,.08);border:1px solid rgba(255,180,0,.3);color:#FFD700}'
      + '.t7cu-status.error{display:block;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);color:#fca5a5}'
      + '.t7cu-rules{background:rgba(128,140,160,.06);border:1px solid var(--border,rgba(0,229,255,.12));border-radius:10px;padding:14px 16px;margin-bottom:18px}'
      + '.t7cu-rules-title{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--accent,#00E5FF);margin-bottom:8px}'
      + '.t7cu-rules ul{margin:0;padding-left:20px;font-size:13px;line-height:1.65}'
      + '.t7cu-rules li{margin-bottom:4px}'
      + '.t7cu-consent{display:flex;gap:10px;align-items:flex-start;background:rgba(128,140,160,.06);border:1px solid var(--border,rgba(0,229,255,.12));border-radius:10px;padding:12px 14px;margin-bottom:16px;cursor:pointer;font-size:12.5px;line-height:1.55}'
      + '.t7cu-consent input{margin-top:3px;flex-shrink:0;width:18px;height:18px;accent-color:#FFD700}'
      + '.t7cu-picker-wrap{text-align:center;padding:24px 16px;border:2px dashed var(--border,rgba(0,229,255,.18));border-radius:12px;opacity:.45;transition:all .2s}'
      + '.t7cu-picker-wrap.enabled{opacity:1;border-color:rgba(255,215,0,.45);background:rgba(255,215,0,.04)}'
      + '.t7cu-picker-wrap input[type=file]{display:none}'
      + '.t7cu-picker-btn{display:inline-block;background:linear-gradient(135deg,#FFD700,#FF8C00);color:#1a1100;padding:12px 24px;border-radius:10px;font-weight:800;cursor:pointer;font-size:14px;transition:transform .15s}'
      + '.t7cu-picker-wrap.enabled .t7cu-picker-btn:hover{transform:translateY(-1px)}'
      + '.t7cu-picker-wrap:not(.enabled) .t7cu-picker-btn{cursor:not-allowed}'
      + '.t7cu-picker-hint{font-size:11px;color:var(--muted,rgba(224,240,255,.6));margin-top:10px}'
      + '.t7cu-progress-wrap{padding:18px 0}'
      + '.t7cu-progress{height:10px;background:rgba(128,140,160,.18);border-radius:99px;overflow:hidden;margin-bottom:10px}'
      + '.t7cu-progress-fill{height:100%;width:0%;background:linear-gradient(90deg,#FFD700,#FF8C00);border-radius:99px;transition:width .2s}'
      + '.t7cu-progress-txt{text-align:center;font-size:13px;font-weight:700;color:var(--text,#e0f0ff)}'
      + '.t7cu-footnote{margin-top:18px;font-size:11px;color:var(--muted,rgba(224,240,255,.6));text-align:center}'
      + '.t7cu-footnote a{color:var(--accent,#00E5FF)}'
      + '.t7cu-success{text-align:center;padding:10px 0}'
      + '.t7cu-check{width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-size:36px;font-weight:900;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;box-shadow:0 0 24px rgba(16,185,129,.4)}'
      + '.t7cu-success h2{margin:0 0 12px;font-size:22px}'
      + '.t7cu-success p{margin:0 0 10px;font-size:14px;line-height:1.6;color:var(--text,#e0f0ff)}'
      + '.t7cu-success-note{font-size:12px !important;color:var(--muted,rgba(224,240,255,.6)) !important;margin-top:14px !important;padding-top:14px;border-top:1px solid var(--border,rgba(0,229,255,.12))}'
      + '.t7cu-btn{margin-top:18px;background:linear-gradient(135deg,#FFD700,#FF8C00);color:#1a1100;border:0;padding:12px 28px;border-radius:10px;font-weight:800;cursor:pointer;font-size:14px;font-family:inherit}';
    var s = document.createElement('style');
    s.id = 't7cu-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }
})();
