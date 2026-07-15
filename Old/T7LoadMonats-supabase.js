/* ============================================================
   T7LoadMonats — Supabase edition (replaces the Google Sheets version)
   ------------------------------------------------------------
   HOW TO INSTALL
   1. In t7-widget-engine.js, replace the whole existing
      `function T7LoadMonats(containerId, sheetsUrl){ ... }`
      with the function below.
   2. In Challenges.html, change the call from:
         T7.loadMonats('monats-container', 'https://docs.google.com/.../pubhtml?...');
      to simply:
         T7.loadMonats('monats-container');
   3. Run monthly_challenges.sql once in Supabase.
   No other changes needed — it reuses _T7FetchAll, _T7BuildDrills,
   T7_SB_URL/T7_SB_KEY and T7.challenge exactly like before.
============================================================ */
function T7LoadMonats(containerId){
  var cont=document.getElementById(containerId);if(!cont)return;
  var MONTHS=['Januar','Februar','M\xe4rz','April','Mai','Juni',
               'Juli','August','September','Oktober','November','Dezember'];
  var now=new Date();
  var mk=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  var ml=MONTHS[now.getMonth()]+' '+now.getFullYear();
  /* Set month label immediately so the tab chip is always current */
  var elLabel=document.getElementById('monatsLabel');
  if(elLabel)elLabel.textContent=ml;
  cont.innerHTML='<div style="padding:28px;text-align:center;color:var(--muted);font-size:13px">Lade Challenge des Monats…</div>';
  function hdr(){return{'apikey':T7_SB_KEY,'Authorization':'Bearer '+T7_SB_KEY};}

  fetch(T7_SB_URL+'/rest/v1/monthly_challenges?month=eq.'+encodeURIComponent(mk)+'&select=*&limit=1',{headers:hdr()})
    .then(function(r){
      if(!r.ok)throw new Error('HTTP '+r.status);
      return r.json();
    })
    .then(function(rows){
      var row=Array.isArray(rows)&&rows.length?rows[0]:null;
      if(!row){
        cont.innerHTML='<div class="monats-hint">Kein Eintrag f\xfcr <strong>'+ml+'</strong> gefunden.<br>'
          +'Lege den Monat im <strong>Challenge-des-Monats</strong>-Formular an.</div>';
        return;
      }
      var name     =(row.name||'').trim()      ||'Challenge des Monats';
      var modKey   =(row.module_key||'').trim();
      var badge    =(row.badge||'').trim()     ||'🔥';
      var heroText =(row.hero_text||'').trim();
      var unlockMsg=(row.unlock_msg||'').trim();
      var elName=document.getElementById('monatsName');
      if(elName)elName.textContent=name;
      cont.innerHTML='';
      if(!modKey){
        cont.innerHTML='<div class="monats-hint">F\xfcr diesen Monat ist kein Modul gesetzt.</div>';
        return;
      }
      _T7FetchAll(function(modules,videos){
        var mod=null;
        for(var i=0;i<modules.length;i++){if(modules[i].key===modKey){mod=modules[i];break;}}
        if(!mod){
          cont.innerHTML='<div class="monats-hint">Modul <code>'+modKey+'</code> nicht in Supabase gefunden.</div>';
          return;
        }
        var drills=_T7BuildDrills(mod,videos);
        /* Month-scoped moduleKey so each month has its own XP / localStorage bucket */
        T7.challenge({
          containerId:containerId,
          title:name||mod.label,
          badge:badge||mod.icon||'🔥',
          moduleKey:'monats_'+mk.replace('-','_'),
          heroText:heroText||mod.hero_text||'',
          unlockMsg:unlockMsg||mod.unlock_msg||'',
          drills:drills
        });
      });
    })
    .catch(function(e){
      console.error('[T7LoadMonats]',e);
      cont.innerHTML='<div class="monats-hint">Fehler beim Laden der Challenge des Monats.<br>'
        +'Details: '+e.message+'</div>';
    });
}
