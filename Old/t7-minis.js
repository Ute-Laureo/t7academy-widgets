/* T7 Minis page logic — load this after t7-widget-engine.js */
(function(){

/* === AVATAR CONFIG === */
var AVATAR = {
  name: 'Keon',
  imgPath: 'https://ute-laureo.github.io/t7academy-widgets/Assets/cheetah_yip_avatar.png'
};
function applyAvatar(){
  document.querySelectorAll('[data-avatar-name]').forEach(function(el){ el.textContent = AVATAR.name; });
  document.querySelectorAll('[data-avatar-img]').forEach(function(el){ el.src = AVATAR.imgPath; });
}
applyAvatar();

/* === Modules data === */
var KID_MODULES = {
  jong: { label:'Ball jonglieren', emoji:'\u26BD',
    drills:[
      {idx:0, title:'Ball hochhalten (sitzend)', emoji:'\uD83D\uDC36', meta:'einfach',  vid:'1124934705', hash:'6a71a27daf', sticker:'\uD83E\uDD84'},
      {idx:1, title:'Mit Fuss und Kopf',         emoji:'\u26BD', meta:'einfach',  vid:'1124935347', hash:'c8977c5fb4', sticker:'\uD83D\uDC06'}
    ]},
  gc0: { label:'Ginga Tanz', emoji:'\uD83C\uDDE7\uD83C\uDDF7',
    drills:[
      {idx:0, title:'Das V',             emoji:'\uD83D\uDC38', meta:'super einfach', vid:'1110048776', hash:'3990db7901', sticker:'\uD83C\uDF1F'},
      {idx:1, title:'Sole Links Rechts', emoji:'\uD83E\uDD93', meta:'einfach',       vid:'1111311105', hash:'b285a5a081', sticker:'\uD83D\uDE80'},
      {idx:2, title:'Drag Back',         emoji:'\uD83D\uDC22', meta:'mittel',        vid:'1110029532', hash:'c98afbe376', sticker:'\uD83D\uDD25'},
      {idx:3, title:'Step Over',         emoji:'\uD83D\uDC30', meta:'mittel',        vid:'1110029715', hash:'8757b6279f', sticker:'\uD83C\uDF88'},
      {idx:4, title:'La Croqueta',       emoji:'\uD83D\uDC19', meta:'mittel',        vid:'1110029615', hash:'d558930be0', sticker:'\uD83C\uDFC6'}
    ]}
};

var DRILL_SEQUENCE = [];
Object.keys(KID_MODULES).forEach(function(mk){
  KID_MODULES[mk].drills.forEach(function(d){
    DRILL_SEQUENCE.push({
      modKey: mk, moduleLabel: KID_MODULES[mk].label,
      idx: d.idx, title: d.title, emoji: d.emoji, meta: d.meta,
      vid: d.vid, hash: d.hash, sticker: d.sticker
    });
  });
});
var TOTAL_DRILLS = DRILL_SEQUENCE.length;
var TOTAL_STICKERS = 7;

var STATE = { email:null, name:'Champion', ratings:{}, curMod:null, curDrill:null, muted:false, totalXP:0, weekXP:0, viewMode:'chooser' };
try { STATE.muted = localStorage.getItem('t7kid_muted') === '1'; } catch(e){}

/* === AUDIO === */
var audioCtx = null;
function getCtx(){ if(!audioCtx){try{audioCtx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}} return audioCtx; }
function beep(freq, duration, type, gain){
  if (STATE.muted) return;
  var ctx = getCtx(); if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  var osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = type || 'triangle'; osc.frequency.value = freq;
  g.gain.setValueAtTime(0, ctx.currentTime);
  g.gain.linearRampToValueAtTime(gain || 0.18, ctx.currentTime + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime + duration);
}
function playFanfare(){ [523,659,784,1047,1319].forEach(function(f,i){ setTimeout(function(){beep(f,0.2,'triangle',0.2);}, i*90); }); }

/* === THEME + MUTE === */
(function(){
  var theme='dark'; try{theme=localStorage.getItem('t7_theme')||'dark';}catch(e){}
  document.body.setAttribute('data-theme', theme); document.documentElement.setAttribute('data-theme', theme);
  var tb = document.getElementById('themeToggle');
  if (tb) {
    tb.textContent = theme==='dark' ? '\uD83C\uDF19' : '\u2600';
    tb.onclick = function(){
      theme = theme==='dark'?'light':'dark';
      document.body.setAttribute('data-theme',theme); document.documentElement.setAttribute('data-theme',theme);
      try{localStorage.setItem('t7_theme',theme);}catch(e){}
      tb.textContent = theme==='dark' ? '\uD83C\uDF19' : '\u2600';
    };
  }
  var mb = document.getElementById('muteBtn');
  if (mb) {
    function syncMute(){ mb.textContent = STATE.muted ? '\uD83D\uDD07' : '\uD83D\uDD0A'; mb.classList.toggle('muted', STATE.muted); }
    syncMute();
    mb.onclick = function(){ STATE.muted=!STATE.muted; try{localStorage.setItem('t7kid_muted',STATE.muted?'1':'0');}catch(e){} syncMute(); };
  }
})();

/* === VIEW SWITCHER (exposed globally) === */
window.minisSwitchView = function(mode){
  STATE.viewMode = mode;
  ['chooser','spielplatz','pfad'].forEach(function(v){
    var el = document.getElementById('view-' + v);
    if (el) el.classList.toggle('active', v === mode);
  });
  window.scrollTo({top: 0, behavior: 'smooth'});
  if (mode === 'pfad') renderPfad();
  if (mode === 'chooser') updateChooserStats();
};
function switchView(mode){ window.minisSwitchView(mode); }
document.querySelectorAll('.choice-card').forEach(function(card){
  card.addEventListener('click', function(){ switchView(card.getAttribute('data-mode')); });
});
document.querySelectorAll('[data-back]').forEach(function(btn){
  btn.addEventListener('click', function(){ switchView('chooser'); });
});

/* === Stickers === */
function renderStickers(){
  var grid = document.getElementById('sticker-grid');
  if (!grid) return;
  var earnedStickers = [];
  Object.keys(KID_MODULES).forEach(function(mk){
    KID_MODULES[mk].drills.forEach(function(d){
      var key = mk + '_' + d.idx;
      if ((STATE.ratings[key] || 0) >= 4) earnedStickers.push(d.sticker);
    });
  });
  var html = '';
  for (var i = 0; i < TOTAL_STICKERS; i++) {
    var isEarned = i < earnedStickers.length;
    html += '<div class="sticker' + (isEarned ? ' earned' : '') + '">' + (isEarned ? earnedStickers[i] : '<span style="opacity:.3;font-size:18px">?</span>') + '</div>';
  }
  grid.innerHTML = html;
  var cnt = document.getElementById('sticker-count');
  if (cnt) cnt.textContent = earnedStickers.length + ' / ' + TOTAL_STICKERS + ' Sticker';
}
function countDone(modKey){ var c=0; KID_MODULES[modKey].drills.forEach(function(d){ if((STATE.ratings[modKey+'_'+d.idx]||0)>=4) c++; }); return c; }
function countAllDone(){ return Object.keys(KID_MODULES).reduce(function(s,k){return s+countDone(k);}, 0); }

/* === Chooser stats === */
function updateChooserStats(){
  var doneCount = countAllDone();
  var sp = document.getElementById('stats-spielplatz');
  if (sp) sp.textContent = doneCount + ' / ' + TOTAL_DRILLS;
  var curIdx = 0;
  for (var i = 0; i < DRILL_SEQUENCE.length; i++) {
    var d = DRILL_SEQUENCE[i];
    if ((STATE.ratings[d.modKey + '_' + d.idx] || 0) < 4) { curIdx = i; break; }
    if (i === DRILL_SEQUENCE.length - 1) curIdx = i;
  }
  var allDone = doneCount === TOTAL_DRILLS;
  var pf = document.getElementById('stats-pfad');
  if (pf) pf.textContent = allDone ? 'Geschafft!' : ('Trick ' + (curIdx + 1));
}

/* === Module rendering === */
function renderModule(modKey){
  var mod = KID_MODULES[modKey];
  var container = document.getElementById('drills-' + modKey);
  if (!container) return;
  container.innerHTML = mod.drills.map(function(d){
    var rating = STATE.ratings[modKey + '_' + d.idx] || 0;
    var done = rating >= 4;
    var badge = done ? (rating === 5 ? '\uD83C\uDF1F' : '\u2705') : '\u25B6\uFE0F';
    return '<div class="prow' + (done ? ' pdone' : '') + '" data-mod="' + modKey + '" data-idx="' + d.idx + '" style="margin-bottom:8px"><div class="prow-emoji">' + d.emoji + '</div><div class="prow-body"><div class="prow-title">' + d.title + '</div><div class="prow-meta">' + d.meta + '</div></div><div class="prow-badge">' + badge + '</div></div>';
  }).join('');
  container.querySelectorAll('.prow').forEach(function(row){
    row.addEventListener('click', function(){ openDrill(row.getAttribute('data-mod'), parseInt(row.getAttribute('data-idx'), 10)); });
  });
  var done = countDone(modKey), total = mod.drills.length;
  var pf = document.querySelector('[data-prog="' + modKey + '"]');
  if (pf) pf.style.width = Math.round(done / total * 100) + '%';
  var pl = document.querySelector('[data-proglabel="' + modKey + '"]');
  if (pl) pl.textContent = done + '/' + total;
}

function toggleModule(modKey){
  var card = document.querySelector('.km-wrap[data-module="' + modKey + '"]');
  if (!card) return;
  var cr = card.querySelector('.cr');
  var panel = document.getElementById('panel-' + modKey);
  var btn = card.querySelector('.cr-btn');
  var open = panel.classList.contains('open');
  if (open) { panel.classList.remove('open'); cr.classList.remove('open'); btn.textContent = "Los geht's \u2728"; }
  else { panel.classList.add('open'); cr.classList.add('open'); btn.textContent = 'Schliessen \u25B2'; }
}
document.querySelectorAll('[data-toggle]').forEach(function(el){
  el.addEventListener('click', function(e){
    if (e.target.classList.contains('cr-btn')) return;
    toggleModule(el.getAttribute('data-toggle'));
  });
});
document.querySelectorAll('[data-cta]').forEach(function(btn){
  btn.addEventListener('click', function(e){ e.stopPropagation(); toggleModule(btn.getAttribute('data-cta')); });
});

/* === Trick-Pfad === */
function getSeqRating(seqIdx){
  var d = DRILL_SEQUENCE[seqIdx];
  return STATE.ratings[d.modKey + '_' + d.idx] || 0;
}
function firstAvailableSeq(){
  for (var i = 0; i < DRILL_SEQUENCE.length; i++) {
    if (getSeqRating(i) < 4) return i;
  }
  return -1;
}
function getNodeState(seqIdx){
  var r = getSeqRating(seqIdx);
  if (r >= 5) return 'done-star';
  if (r >= 4) return 'done';
  var firstAvail = firstAvailableSeq();
  if (seqIdx === firstAvail) return 'available';
  return 'locked';
}
function renderPfad(){
  var path = document.getElementById('pfad-path');
  if (!path) return;
  var totalDone = countAllDone();
  var html = '<div class="path-marker path-start">\uD83D\uDEA6 Los geht\'s!</div>';
  DRILL_SEQUENCE.forEach(function(d, i){
    var state = getNodeState(i);
    var side = i % 2 === 0 ? 'left' : 'right';
    var num = i + 1;
    var dataAttrs = (state === 'locked') ? '' : ' data-mod="' + d.modKey + '" data-idx="' + d.idx + '"';
    var emojiContent = (state === 'locked') ? '\uD83D\uDD12' : d.emoji;
    var numContent = (state === 'done' || state === 'done-star') ? '\u2713' : num;
    html += '<div class="path-node ' + side + ' ' + state + '"' + dataAttrs + '>';
    html += '  <div class="node-num">' + numContent + '</div>';
    html += '  <div class="node-emoji">' + emojiContent + '</div>';
    html += '  <div class="node-title">' + d.title + '</div>';
    html += '</div>';
  });
  var allDone = totalDone === TOTAL_DRILLS;
  html += '<div class="path-marker path-end' + (allDone ? '' : ' locked') + '">\uD83C\uDFC1 ' + (allDone ? 'Geschafft!' : 'Ziel') + '</div>';
  path.innerHTML = html;
  path.querySelectorAll('.path-node:not(.locked)').forEach(function(node){
    node.addEventListener('click', function(){
      openDrill(node.getAttribute('data-mod'), parseInt(node.getAttribute('data-idx'), 10));
    });
  });
}

/* === Modal flow === */
function openDrill(modKey, idx){
  STATE.curMod = modKey; STATE.curDrill = idx;
  var d = KID_MODULES[modKey].drills.find(function(x){ return x.idx === idx; });
  if (!d) return;
  document.getElementById('kmodal-title').textContent = d.title;
  document.getElementById('kembed').src = 'https://player.vimeo.com/video/' + d.vid + '?h=' + d.hash + '&color=FFD700&title=0&byline=0&portrait=0';
  showStep('watch');
  document.getElementById('kmodal').classList.add('open');
}
function closeModal(){ document.getElementById('kmodal').classList.remove('open'); document.getElementById('kembed').src = ''; }
function showStep(name){
  ['watch','rate','success','tryagain'].forEach(function(s){ document.getElementById('kstep-' + s).classList.toggle('active', s === name); });
  if (name === 'rate') document.querySelectorAll('.krate').forEach(function(r){ r.className = 'krate'; });
}
document.getElementById('kmodal-close').onclick = closeModal;
document.getElementById('kmodal').addEventListener('click', function(e){ if (e.target.id === 'kmodal') closeModal(); });
document.getElementById('kbtn-tried').onclick = function(){ showStep('rate'); };
document.querySelectorAll('.krate').forEach(function(r){
  r.addEventListener('click', function(){
    var rating = parseInt(r.getAttribute('data-rate'), 10);
    document.querySelectorAll('.krate').forEach(function(x){ x.className = 'krate'; });
    var clsMap = {2:'sel-thumbsdown', 3:'sel-thinking', 4:'sel-thumbsup', 5:'sel-star'};
    r.className = 'krate sel ' + clsMap[rating];
    setTimeout(function(){ resolveOutcome(rating); }, 600);
  });
});
function resolveOutcome(rating){
  var modKey = STATE.curMod, idx = STATE.curDrill;
  var d = KID_MODULES[modKey].drills.find(function(x){ return x.idx === idx; });
  if (!d) return;
  var key = modKey + '_' + idx;
  var prev = STATE.ratings[key] || 0;
  if (rating > prev) STATE.ratings[key] = rating;
  saveLocal();
  if (STATE.email && window.T7SB) {
    var moduleLabel = KID_MODULES[modKey].label;
    var XP_BY_RATING = {2:4, 3:6, 4:8, 5:10};
    var xp = XP_BY_RATING[rating] || 0;
    T7SB.upsert(STATE.email, STATE.name, modKey, moduleLabel, idx, rating, xp, Date.now(), null);
    try { window.dispatchEvent(new CustomEvent('t7xpupdate')); } catch(e){}
    setTimeout(refreshFortschritt, 1500);
  }
  if (rating >= 4) {
    document.getElementById('ksuccess-title').textContent = rating === 5 ? 'WOW! Perfekt!' : 'Super gemacht!';
    document.getElementById('ksticker-reveal').textContent = d.sticker;
    var wasNew = prev < 4;
    document.getElementById('ksuccess-msg').textContent = wasNew ? 'Du hast einen neuen Sticker bekommen! \uD83C\uDF1F' : 'Du wirst immer besser! \uD83C\uDF89';
    showStep('success'); confettiBurst();
    if (wasNew) playFanfare();
  } else {
    showStep('tryagain');
  }
  renderModule(modKey);
  if (STATE.viewMode === 'pfad') renderPfad();
  renderStickers();
}
document.getElementById('kbtn-continue').onclick = function(){
  closeModal();
  if (STATE.viewMode === 'pfad') {
    var curSeqIdx = DRILL_SEQUENCE.findIndex(function(d){ return d.modKey === STATE.curMod && d.idx === STATE.curDrill; });
    if (curSeqIdx >= 0 && curSeqIdx + 1 < DRILL_SEQUENCE.length) {
      var next = DRILL_SEQUENCE[curSeqIdx + 1];
      setTimeout(function(){ openDrill(next.modKey, next.idx); }, 400);
    }
  } else {
    var mod = KID_MODULES[STATE.curMod];
    var next = mod.drills.find(function(x){ return x.idx === STATE.curDrill + 1; });
    if (next) setTimeout(function(){ openDrill(STATE.curMod, next.idx); }, 400);
  }
};
document.getElementById('kbtn-retry').onclick = function(){ showStep('watch'); };
document.getElementById('kbtn-skip').onclick = function(){ closeModal(); };

function confettiBurst(){
  var colors = ['#FFD700','#FF8C00','#00E5FF','#34D399','#EC4899','#A855F7'];
  var container = document.createElement('div');
  container.className = 'confetti-container';
  document.body.appendChild(container);
  for (var i = 0; i < 60; i++) {
    var p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.left = Math.random() * 100 + '%';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.animationDelay = Math.random() * 0.4 + 's';
    p.style.animationDuration = (1.5 + Math.random() * 1.5) + 's';
    p.style.transform = 'rotate(' + (Math.random() * 360) + 'deg)';
    container.appendChild(p);
  }
  setTimeout(function(){ container.remove(); }, 3500);
}

function saveLocal(){ try{ var key='t7kid_'+(STATE.name||'guest').toLowerCase(); localStorage.setItem(key, JSON.stringify({r:STATE.ratings})); }catch(e){} }
function loadLocal(){ try{ var key='t7kid_'+(STATE.name||'guest').toLowerCase(); var raw=localStorage.getItem(key); if(raw){var d=JSON.parse(raw); if(d.r)STATE.ratings=d.r;} }catch(e){} }

function hydrateFromSupabase(){
  if (!STATE.email || !window.T7SB) return;
  Object.keys(KID_MODULES).forEach(function(mk){
    T7SB.getModuleXP(STATE.email, mk, function(rows){
      var changed = false;
      rows.forEach(function(r){
        var key = mk + '_' + r.challenge_idx;
        if ((r.rating || 0) > (STATE.ratings[key] || 0)) { STATE.ratings[key] = r.rating; changed = true; }
      });
      if (changed) {
        saveLocal();
        renderModule(mk);
        if (STATE.viewMode === 'pfad') renderPfad();
        renderStickers();
        updateChooserStats();
      }
    });
  });
}

function refreshFortschritt(){
  if (!STATE.email) return;
  if (window.T7SB) {
    T7SB.getTotalXP(STATE.email, function(total){
      STATE.totalXP = total || 0;
      var el = document.getElementById('kf-total');
      if (el) el.textContent = STATE.totalXP.toLocaleString('de-AT');
    });
  }
  var SB_URL = 'https://qajjuhjmrtuomwrbxmpz.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhamp1aGptcnR1b213cmJ4bXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTMzNTksImV4cCI6MjA5MDAyOTM1OX0.4tyFG-e2IIh0Iwze7TQorfRF7DqUQkGBpeRgCcMkFC4';
  fetch(SB_URL+'/rest/v1/attempts?player_email=eq.'+encodeURIComponent(STATE.email)+'&select=attempted_at,xp',{headers:{apikey:SB_KEY,'Authorization':'Bearer '+SB_KEY}})
  .then(function(r){return r.json();}).then(function(rows){
    var now=new Date(),sw=new Date(now);sw.setHours(0,0,0,0);sw.setDate(now.getDate()-((now.getDay()+6)%7));
    var t0=sw.getTime(),xp=0;
    (rows||[]).forEach(function(a){var ts=typeof a.attempted_at==='number'?a.attempted_at:parseInt(a.attempted_at)||0; if(ts>=t0)xp+=Number(a.xp||0);});
    STATE.weekXP=xp;
    var el = document.getElementById('kf-week');
    if (el) el.textContent = xp;
  }).catch(function(){});
}

function boot(email, name){
  STATE.email = email;
  STATE.name = (name || '').split(' ')[0] || 'Champion';
  var kn = document.getElementById('kid-name'); if (kn) kn.textContent = STATE.name;
  var kf = document.getElementById('kf-name'); if (kf) kf.textContent = STATE.name;
  loadLocal();
  Object.keys(KID_MODULES).forEach(renderModule);
  renderStickers();
  updateChooserStats();
  hydrateFromSupabase();
  refreshFortschritt();
}

if (window.T7Identity) { T7Identity.resolve(function(email, name){ boot(email, name); }); }
else { setTimeout(function(){ if (window.T7Identity) T7Identity.resolve(function(email, name){ boot(email, name); }); else boot(null, null); }, 1500); }
})();
