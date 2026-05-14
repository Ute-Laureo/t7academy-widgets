/* ============================================================
   T7 ACADEMY -- WIDGET FRAMEWORK
   Version 2.0 -- Modular / Multi-instance
   ============================================================ */

var T7_SB_URL='https://qajjuhjmrtuomwrbxmpz.supabase.co';
var T7_SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhamp1aGptcnR1b213cmJ4bXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTMzNTksImV4cCI6MjA5MDAyOTM1OX0.4tyFG-e2IIh0Iwze7TQorfRF7DqUQkGBpeRgCcMkFC4';

/* === SHARED IDENTITY MODULE ===
   Resolves once per page-load; all widgets share the result.
   Lookup chain: BM admin -> localStorage -> BM JWT -> page links -> name prompt
   Future Supabase player ID: swap T7Identity._fromSupabase() only. */
var T7Identity=(function(){
  var _email=null,_name=null,_done=false,_going=false,_q=[];
  function _hdr(){return{'apikey':T7_SB_KEY,'Authorization':'Bearer '+T7_SB_KEY};}
  function _fire(em,nm){
    _email=em;_name=nm;_done=true;
    try{if(em)localStorage.setItem('t7_player_identity',em);}catch(e){}
    var parts=(nm||em||'?').trim().split(/\s+/);
    var ini=parts.length>=2?(parts[0][0]+parts[parts.length-1][0]).toUpperCase():(nm||em||'?').slice(0,2).toUpperCase();
    var av=document.getElementById('navAvatar');if(av)av.textContent=ini;
    _q.forEach(function(cb){cb(em,nm);});_q=[];
  }
  function _wins(){
    var w=[window];
    try{if(window.parent&&window.parent!==window)w.push(window.parent);}catch(e){}
    try{if(window.top&&window.top!==window&&window.top!==window.parent)w.push(window.top);}catch(e){}
    return w;
  }
  function _bmEmail(){
    var ws=_wins();
    for(var i=0;i<ws.length;i++){
      try{var bm=ws[i].__BM_DATA__;if(bm&&bm.intercom&&bm.intercom.bootProps&&bm.intercom.bootProps.email)return{email:bm.intercom.bootProps.email,name:bm.intercom.bootProps.name||null};}catch(e){}
      try{var is=ws[i].intercomSettings;if(is&&is.email)return{email:is.email,name:is.name||null};}catch(e){}
    }
    return null;
  }
  function _bmJwtId(){
    var ws=_wins();
    for(var i=0;i<ws.length;i++){
      try{var bm=ws[i].__BM_DATA__;if(bm&&bm.accessToken){var p=JSON.parse(atob(bm.accessToken.split('.')[1]));if(p&&p.id)return p.id;}}catch(e){}
    }
    return null;
  }
  function _pageLinks(){
    var ws=_wins();
    for(var i=0;i<ws.length;i++){
      try{var links=ws[i].document.querySelectorAll('a[href*="/member/"]');for(var j=0;j<links.length;j++){var m=links[j].href.match(/\/member\/([A-Za-z0-9]{8,12})/);if(m)return m[1];}}catch(e){}
    }
    return null;
  }
  function _sbLookup(field,val,cb){
    fetch(T7_SB_URL+'/rest/v1/members?'+field+'=eq.'+encodeURIComponent(val)+'&select=email,name&limit=1',{headers:_hdr()})
    .then(function(r){return r.json();}).then(function(rows){cb(rows&&rows.length?rows[0]:null);}).catch(function(){cb(null);});
  }
  function _prompt(){
    var ov=document.getElementById('t7-id-overlay');if(ov)ov.style.display='flex';
    var inp=document.getElementById('t7-id-input');
    if(inp){inp.focus();inp.onkeydown=function(e){if(e.key==='Enter')T7Identity._submit();};}
  }
  function _go(){
    // 1. BM direct
    var bm=_bmEmail();if(bm){_fire(bm.email,bm.name);return;}
    // 2. localStorage
    var saved=null;try{saved=localStorage.getItem('t7_player_identity');}catch(e){}
    if(saved){_fire(saved,null);return;}
    // 3. BM JWT -> Supabase
    var jwtId=_bmJwtId();
    if(jwtId){_sbLookup('bm_id',jwtId,function(row){if(row&&row.email)_fire(row.email,row.name);else _tryLinks();});return;}
    _tryLinks();
  }
  function _tryLinks(){
    var linkId=_pageLinks();
    if(linkId){_sbLookup('bm_id',linkId,function(row){if(row&&row.email)_fire(row.email,row.name);else _prompt();});}
    else _prompt();
  }
  return{
    resolve:function(cb){
      if(_done){cb(_email,_name);return;}
      _q.push(cb);if(!_going){_going=true;_go();}
    },
    fire:function(em,nm){_fire(em,nm);},
    get:function(){return _done?{email:_email,name:_name}:null;},
    _submit:function(){
      var inp=document.getElementById('t7-id-input');if(!inp)return;
      var fn=inp.value.trim();if(!fn)return;
      var hint=document.getElementById('t7-id-hint');if(hint)hint.textContent='Suche...';
      fetch(T7_SB_URL+'/rest/v1/members?name=ilike.'+encodeURIComponent(fn+'%')+'&select=email,name&limit=5',{headers:{apikey:T7_SB_KEY,'Authorization':'Bearer '+T7_SB_KEY}})
      .then(function(r){return r.json();}).then(function(rows){
        if(rows&&rows.length&&rows[0].email){
          var ov=document.getElementById('t7-id-overlay');if(ov)ov.style.display='none';
          _fire(rows[0].email,rows[0].name);
        }else{
          if(hint){hint.textContent='Name nicht gefunden. Bitte wie in der App eingeben.';hint.style.color='#FF6B6B';}
          inp.value='';inp.focus();
        }
      }).catch(function(){if(hint)hint.textContent='Verbindungsfehler. Bitte nochmal.';});
    }
  };
})();

/* === SUPABASE HELPERS === */
var T7SB={
  _hdr:function(extra){return Object.assign({'apikey':T7_SB_KEY,'Authorization':'Bearer '+T7_SB_KEY,'Content-Type':'application/json'},extra||{});},
  getTotalXP:function(email,cb){
    fetch(T7_SB_URL+'/rest/v1/players?player_email=eq.'+encodeURIComponent(email)+'&select=total_xp',{headers:this._hdr()})
    .then(function(r){return r.json();}).then(function(rows){cb(rows&&rows.length&&typeof rows[0].total_xp==='number'?rows[0].total_xp:0);}).catch(function(){cb(0);});
  },
  getModuleXP:function(email,mk,cb){
    fetch(T7_SB_URL+'/rest/v1/completions?player_email=eq.'+encodeURIComponent(email)+'&module_key=eq.'+encodeURIComponent(mk)+'&select=challenge_idx,rating,xp&order=rating.desc',{headers:this._hdr()})
    .then(function(r){return r.json();}).then(function(rows){cb(rows||[]);}).catch(function(){cb([]);});
  },
  getCert:function(email,stars,cb){
    fetch(T7_SB_URL+'/rest/v1/certifications?player_email=eq.'+encodeURIComponent(email)+'&stars=eq.'+stars+'&select=stars,awarded_at&limit=1',{headers:this._hdr()})
    .then(function(r){return r.json();}).then(function(rows){cb(rows&&rows.length?rows[0]:null);}).catch(function(){cb(null);});
  },
  upsert:function(email,name,mk,ml,idx,rating,xp,ts,curTotal){
    if(!email||email==='unbekannt')return;
    var self=this;
    fetch(T7_SB_URL+'/rest/v1/completions',{method:'POST',headers:self._hdr({'Prefer':'resolution=merge-duplicates'}),
      body:JSON.stringify({player_email:email,player_name:name,module_key:mk,module_label:ml,challenge_idx:idx,rating:rating,xp:xp,completed_at:new Date(ts).toISOString()})}).catch(function(){});
    var newTotal=(curTotal||0)+xp;
    fetch(T7_SB_URL+'/rest/v1/players',{method:'POST',headers:self._hdr({'Prefer':'resolution=merge-duplicates'}),
      body:JSON.stringify({player_email:email,player_name:name,total_xp:newTotal})}).catch(function(){});
  }
};

/* ===========================================================
   TYPE A ENGINE -- T7Challenge
   Skill challenges with 4-step flow (Watch->Practice->Rate->Outcome)
   Unlock tiers: star:1 = always open; star:3 = needs star:1 rated >=4
   =========================================================== */
function T7Challenge(cfg){
  var uid=(Math.random().toString(36)+'00000').slice(2,7);
  var drills=cfg.drills||[];var nd=drills.length;
  var XMUL=[0,.2,.4,.6,.8,1];
  function aXP(r,max){return Math.round((XMUL[r]||0)*max);}
  function cXP(r,max){return r<4?0:Math.round((XMUL[r]||0)*max);}
  var S={expanded:false,drill:-1,rate:0,hits:0,ratings:drills.map(function(){return 0;}),bestHits:drills.map(function(){return 0;}),scXP:drills.map(function(){return 0;}),cumXP:0,cat:{},sk:'t7_'+cfg.moduleKey+'_g',ms:null,mr:null,ch:[],rec:false,inited:false,name:'Spieler',sbTotal:null,email:null};
  function isDone(i){var d=drills[i];return d.type==='hits'?(S.bestHits[i]||0)>=(d.maxHits||1):(S.ratings[i]||0)>=4;}
  function hXP(hits,d){return Math.min(d.xp,Math.round(((hits||0)/(d.maxHits||1))*d.xp));}
  var cont=document.getElementById(cfg.containerId||'ch-container');if(!cont)return;
  cont.insertAdjacentHTML('beforeend',_html());
  function el(id){return document.getElementById('t7a-'+id+'-'+uid);}
  function sv(){var e=el('cr');if(e)e.scrollIntoView({behavior:'smooth',block:'nearest'});}
  // Storage
  function save(){try{localStorage.setItem(S.sk,JSON.stringify({r:S.ratings,s:S.scXP,c:S.cumXP,at:S.cat,bh:S.bestHits}));}catch(e){}}
  function load(u){
    S.sk='t7_'+cfg.moduleKey+'_'+(u||'g').replace(/\s+/g,'_').toLowerCase();
    try{var raw=localStorage.getItem(S.sk);if(raw){var d=JSON.parse(raw);if(d.r)S.ratings=d.r;if(d.bh)S.bestHits=d.bh;if(d.s)S.scXP=d.s;else for(var i=0;i<nd;i++)S.scXP[i]=drills[i].type==='hits'?hXP(S.bestHits[i],drills[i]):cXP(S.ratings[i]||0,drills[i].xp);if(typeof d.c==='number')S.cumXP=d.c;if(d.at)S.cat=d.at;}}catch(e){}
    updXP();updProg();refresh();
  }
  // XP & progress
  function modXP(){var t=0;for(var i=0;i<nd;i++)t+=S.scXP[i];return t;}
  function updXP(){el('xp').textContent=modXP()+' XP';el('xpt').textContent=(typeof S.sbTotal==='number'?S.sbTotal:0)+' XP';}
  function updProg(){var done=0;for(var i=0;i<nd;i++)if(isDone(i))done++;el('pf').style.width=Math.round(done/nd*100)+'%';el('pl').textContent=done+' / '+nd;}
  // Unlock logic
  function canOpen(idx){
    if(!drills[idx]||drills[idx].star<=1)return true;
    for(var i=0;i<nd;i++){if(i!==idx&&drills[i].star<drills[idx].star&&!isDone(i))return false;}
    return true;
  }
  function refresh(){
    for(var i=0;i<nd;i++){
      var row=el('row-'+i),badge=el('badge-'+i),d=drills[i],lk=!canOpen(i);
      if(lk){row.className='prow plocked';badge.className='pbadge b-locked';badge.textContent='\uD83D\uDD12 Gesperrt';}
      else if(d.type==='hits'){
        var bh=S.bestHits[i]||0;
        if(bh===0){row.className='prow';badge.className='pbadge b-new';badge.textContent='Neu';}
        else if(bh<(d.maxHits||1)){row.className='prow';badge.className='pbadge b-retry';badge.textContent=bh+'x \u2197';}
        else{row.className='prow pdone';badge.className='pbadge b-done';badge.textContent='\u2605 Ziel!';}
      }else{
        var r=S.ratings[i];
        if(r===0){row.className='prow';badge.className='pbadge b-new';badge.textContent='Neu';}
        else if(r<=3){row.className='prow';badge.className='pbadge b-retry';badge.textContent='\u21A9 Verbessern';}
        else if(r===4){row.className='prow pdone';badge.className='pbadge b-inprog';badge.textContent='\u2713 Gut';}
        else{row.className='prow pdone';badge.className='pbadge b-done';badge.textContent='\u2605 Perfekt';}
      }
    }
    var allOpen=true;for(var i=0;i<nd;i++){if(!canOpen(i)){allOpen=false;break;}}
    el('unlock').style.display=allOpen?'none':'flex';
    updProg();
  }
  // Navigation
  function toggle(){
    S.expanded=!S.expanded;var cr=el('cr'),panel=el('panel');
    if(S.expanded){cr.classList.add('open');panel.classList.add('open');el('crb').textContent='Schlie\xdfen \u25b2';}
    else{cr.classList.remove('open');panel.classList.remove('open');el('crb').textContent='Starten \u25bc';goTrack();}
  }
  function goTrack(){el('embed').src='';el('drill').classList.remove('open');show('track');stopCam();refresh();sv();}
  function openDrill(idx){
    if(!canOpen(idx))return;
    S.drill=idx;S.rate=0;S.hits=0;var d=drills[idx];
    el('deye').textContent=d.eye;el('dh').textContent=d.title;el('dmeta').textContent=d.meta;
    el('embed').src='https://player.vimeo.com/video/'+d.vid+'?h='+d.hash+'&color=00E5FF&title=0&byline=0&portrait=0&dnt=1';
    [1,2,3,4,5].forEach(function(v){el('r'+v).className='rate-opt';});
    hide('rconf');resetCam();hide('track');el('drill').classList.add('open');goStep(1);sv();
  }
  function goStep(n){
    ['s1','s2','s3','s4'].forEach(function(id,i){el(id).style.display=(i===n-1)?'block':'none';});
    [1,2,3,4].forEach(function(i){var dot=el('d'+i);dot.className='step-dot';if(i<n)dot.classList.add('done-s');else if(i===n)dot.classList.add('curr-s');});
    if(n===3){
      var d=drills[S.drill];
      if(d.type==='hits'){
        el('hitsec').style.display='block';el('ratesec').style.display='none';
        var inp=el('hinp');inp.value=S.hits||0;
        el('htgt').textContent='Ziel: '+d.maxHits+'x f\xfcr volle '+d.xp+' XP';
        updHitXP();
      }else{el('hitsec').style.display='none';el('ratesec').style.display='block';}
    }
    if(n===4)showOut();
  }
  function show(id){var e=el(id);if(e)e.style.display='block';}
  function hide(id){var e=el(id);if(e)e.style.display='none';}
  // Rating & outcome
  function selRate(v){S.rate=v;[1,2,3,4,5].forEach(function(i){el('r'+i).className='rate-opt'+(i===v?' sel-'+v:'');});el('rconf').style.display='flex';}
  function updHitXP(){var d=drills[S.drill],h=parseInt(el('hinp').value)||0,xp=hXP(h,d),full=h>=(d.maxHits||1);var prev=el('hxprev');prev.textContent=xp+' XP';prev.className='hit-xp-prev'+(full?' full':'');}
  function showOut(){
    var d=drills[S.drill],idx=S.drill;
    var isHits=d.type==='hits';
    var earned,done;
    if(isHits){
      var h=parseInt(el('hinp').value)||0;S.hits=h;
      earned=hXP(h,d);done=h>=(d.maxHits||1);
      if(h>(S.bestHits[idx]||0)){S.bestHits[idx]=h;var newS=earned;if(newS>(S.scXP[idx]||0))S.scXP[idx]=newS;}
      if(done&&!S.cat[idx])S.cat[idx]=Date.now();
      var rateEq=done?5:h>0?3:1;
      if(S.email)T7SB.upsert(S.email,S.name,cfg.moduleKey,cfg.title,idx,rateEq,earned,S.cat[idx]||Date.now(),S.sbTotal);
    }else{
      earned=aXP(S.rate,d.xp);done=S.rate>=4;
      var prev=S.ratings[idx]||0,prevS=S.scXP[idx]||0,newS=cXP(S.rate,d.xp);
      if(newS>prevS)S.scXP[idx]=newS;
      if(S.rate>prev){S.ratings[idx]=S.rate;if(!S.cat[idx])S.cat[idx]=Date.now();}
      if(S.email)T7SB.upsert(S.email,S.name,cfg.moduleKey,cfg.title,idx,S.rate,earned,S.cat[idx]||Date.now(),S.sbTotal);
    }
    S.cumXP+=earned;updXP();save();
    if(S.email)setTimeout(function(){T7SB.getTotalXP(S.email,function(t){S.sbTotal=t;updXP();});try{window.dispatchEvent(new CustomEvent('t7xpupdate'));}catch(e){}},1500);
    var box=el('obox'),icon=el('oicon'),title=el('otitle'),sub=el('osub'),btns=el('obtns');
    el('oxp').textContent='+'+earned+' XP';el('oxpt').textContent='Gesamt: '+(typeof S.sbTotal==='number'?S.sbTotal:S.cumXP)+' XP';
    var ni=S.drill+1;
    if(isHits){
      var h2=S.hits,max=d.maxHits||1;
      if(h2>=max){box.className='outcome out-high';icon.textContent='\uD83E\uDD29';title.textContent='Ziel erreicht!';sub.textContent=d.next||'Challenge abgeschlossen!';}
      else if(h2>0){box.className='outcome out-mid';icon.textContent='\uD83D\uDE04';title.textContent=h2+'x geschafft!';sub.textContent='Noch '+( max-h2)+'x f\xfcr das volle Ziel!';}
      else{box.className='outcome out-low';icon.textContent='\uD83D\uDCAA';title.textContent='Weiter k\xe4mpfen!';sub.textContent='Probiere nochmal \u2014 du schaffst es!';}
    }else{
      if(S.rate<=3){box.className='outcome out-low';icon.textContent=S.rate<=2?'\uD83D\uDCAA':'\uD83E\uDD14';title.textContent=S.rate<=2?'Weiter k\xe4mpfen!':'Ganz gut!';sub.textContent='Noch ein Versuch f\xfcr Bewertung 4 oder 5!';}
      else{box.className=S.rate===5?'outcome out-high':'outcome out-mid';icon.textContent=S.rate===5?'\uD83E\uDD29':'\uD83D\uDE04';title.textContent=S.rate===5?'Perfekt!':'Richtig gut!';sub.textContent=(d.next||'Challenge abgeschlossen!');}
    }
    btns.innerHTML='';
    var nb=document.createElement('button');nb.className='btn btn-sm '+(done?'btn-acc':'');
    if(done&&ni<nd&&canOpen(ni)){nb.textContent='N\xe4chste \u2192';nb.onclick=function(){openDrill(ni);};}
    else{nb.textContent='Zur\xfcck zur Liste';nb.onclick=goTrack;}
    btns.appendChild(nb);
    refresh();
  }
  // Camera
  function startCam(){
    navigator.mediaDevices.getUserMedia({video:true,audio:true}).then(function(s){
      S.ms=s;var v=el('camv');v.srcObject=s;v.play();hide('camcard');el('camlive').style.display='block';hide('skiprow');
    }).catch(function(e){var er=el('camerr');if(er){er.style.display='block';er.textContent='Kamera: '+e.message;}});
  }
  function stopCam(){if(S.ms){S.ms.getTracks().forEach(function(t){t.stop();});S.ms=null;}if(S.mr&&S.mr.state!=='inactive')try{S.mr.stop();}catch(e){}S.mr=null;S.ch=[];S.rec=false;}
  function resetCam(){stopCam();var v=el('camv');if(v)v.srcObject=null;el('camlive').style.display='none';var pw=el('prevw');if(pw)pw.style.display='none';var pv=el('prev');if(pv){pv.pause();pv.src='';}show('camcard');el('skiprow').style.display='flex';}
  function toggleRec(){
    if(!S.ms)return;
    if(!S.rec){
      S.ch=[];var opt=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'].filter(function(t){return MediaRecorder.isTypeSupported(t);})[0]||'';
      S.mr=new MediaRecorder(S.ms,opt?{mimeType:opt}:{});
      S.mr.ondataavailable=function(e){if(e.data&&e.data.size>0)S.ch.push(e.data);};
      S.mr.onstop=function(){var blob=new Blob(S.ch,{type:S.mr.mimeType||'video/webm'});var pv=el('prev');pv.src=URL.createObjectURL(blob);pv.load();el('camlive').style.display='none';el('prevw').style.display='block';hide('skiprow');stopCam();};
      S.mr.start();S.rec=true;el('recbtn').textContent='\u2B1B Stopp';el('recbtn').style.background='#DC2626';el('rectim').style.display='block';
    }else{if(S.mr&&S.mr.state!=='inactive')S.mr.stop();S.rec=false;el('recbtn').textContent='\u25CF Aufnahme';el('rectim').style.display='none';}
  }
  // Init player
  function initPlayer(email,name){
    S.email=email;S.inited=true;
    var parts=(name||'Spieler').trim().split(/\s+/);
    var ini=parts.length>=2?(parts[0][0]+parts[parts.length-1][0]).toUpperCase():(name||'?').slice(0,2).toUpperCase();
    el('av').textContent=ini;S.name=parts[0]||'Spieler';
    load(name);
    T7SB.getTotalXP(email,function(t){S.sbTotal=t;updXP();});
    T7SB.getModuleXP(email,cfg.moduleKey,function(rows){
      var best={};rows.forEach(function(r){var i=r.challenge_idx;if(!(i in best)||r.rating>best[i])best[i]=r.rating;});
      var changed=false;Object.keys(best).forEach(function(i){var idx=parseInt(i);if(best[i]>=(S.ratings[idx]||0)){S.ratings[idx]=best[i];S.scXP[idx]=cXP(best[i],drills[idx]?drills[idx].xp:10);changed=true;}});
      if(changed){save();updXP();updProg();refresh();}
    });
    var ht=el('ht');if(ht&&cfg.heroText)ht.textContent='Hey '+S.name+'! '+cfg.heroText;
  }
  // Wire events
  function wire(){
    el('cr').addEventListener('click',toggle);
    el('crb').addEventListener('click',function(e){e.stopPropagation();toggle();});
    for(var i=0;i<nd;i++){(function(idx){var row=el('row-'+idx);if(row)row.addEventListener('click',function(){openDrill(idx);});})(i);}
    el('back').addEventListener('click',goTrack);
    el('s1next').addEventListener('click',function(){goStep(2);});
    el('s2next').addEventListener('click',function(){goStep(3);});
    el('skip').addEventListener('click',function(){goStep(3);});
    [1,2,3,4,5].forEach(function(v){el('r'+v).addEventListener('click',function(){selRate(v);});});
    el('rconfbtn').addEventListener('click',function(){if(S.rate)goStep(4);});
    // Hit counter
    el('hminus').addEventListener('click',function(){var inp=el('hinp');inp.value=Math.max(0,(parseInt(inp.value)||0)-1);updHitXP();});
    el('hplus').addEventListener('click',function(){var inp=el('hinp');inp.value=(parseInt(inp.value)||0)+1;updHitXP();});
    el('hinp').addEventListener('input',updHitXP);
    el('hconfirm').addEventListener('click',function(){goStep(4);});
    el('camopen').addEventListener('click',startCam);
    el('recbtn').addEventListener('click',toggleRec);
    el('camstop').addEventListener('click',function(){resetCam();el('skiprow').style.display='flex';show('camcard');});
    el('retrycam').addEventListener('click',resetCam);
    window.addEventListener('t7xpupdate',function(){if(S.email)T7SB.getTotalXP(S.email,function(t){S.sbTotal=t;updXP();});});
  }
  // Build HTML
  function _html(){
    var rows=drills.map(function(d,i){
      var lk=d.star>1;
      return '<div class="prow'+(lk?' plocked':'')+'" id="t7a-row-'+i+'-'+uid+'"><div class="prow-num">'+(i<9?'0':'')+(i+1)+'</div><div class="prow-body"><div class="prow-title">'+d.title+'</div><div class="prow-meta">'+d.meta+'</div></div><span class="pbadge '+(lk?'b-locked':'b-new')+'" id="t7a-badge-'+i+'-'+uid+'">'+(lk?'\uD83D\uDD12 Gesperrt':'Neu')+'</span></div>';
    }).join('');
    var steps=['Anschauen','Üben','Bewerten','Ergebnis'].map(function(n,i){
      return '<div class="step"><div class="step-dot" id="t7a-d'+(i+1)+'-'+uid+'">'+(i+1)+'</div><span class="step-name">'+n+'</span></div>'+(i<3?'<div class="step-line"></div>':'');
    }).join('');
    var rOpts=[['😩','Kaum'],['🤔','Fast'],['🙂','OK'],['😄','Gut'],['🤩','Perfekt']].map(function(r,i){
      return '<div class="rate-opt" id="t7a-r'+(i+1)+'-'+uid+'"><div class="rate-emoji">'+r[0]+'</div><div class="rate-text">'+r[1]+'</div></div>';
    }).join('');
    return '<div class="t7w t7a-wrap">'+
      '<div class="cr" id="t7a-cr-'+uid+'">'+
        '<div class="cr-badge">'+(cfg.badge||'\u26bd')+'</div>'+
        '<div class="cr-body"><div class="cr-title">'+(cfg.title||'Challenge')+'</div>'+
          '<div class="cr-sub"><span>Technik Challenge</span><div class="cr-prog"><div class="cr-prog-fill" id="t7a-pf-'+uid+'" style="width:0%"></div></div><span class="cr-prog-label" id="t7a-pl-'+uid+'">0 / '+nd+'</span></div></div>'+
        '<div class="cr-player"><div class="cr-avatar" id="t7a-av-'+uid+'">?</div>'+
          '<span class="cr-xp" id="t7a-xp-'+uid+'">0 XP</span><span class="cr-xp-total" id="t7a-xpt-'+uid+'">0 XP</span>'+
          '<button class="cr-btn" id="t7a-crb-'+uid+'">Starten \u25bc</button></div>'+
      '</div>'+
      '<div class="t7-panel" id="t7a-panel-'+uid+'">'+
        '<div id="t7a-track-'+uid+'">'+
          '<div class="ph"><div class="ph-title">'+(cfg.title||'Challenge')+'</div><div class="ph-body" id="t7a-ht-'+uid+'">'+(cfg.heroText||'')+'</div></div>'+
          '<div class="plist"><div class="plabel">Technik \xdcbungen</div>'+rows+'</div>'+
          '<div class="unlock-banner" id="t7a-unlock-'+uid+'" style="display:none"><div class="ub-icon">\u26a1</div><div><div class="ub-title">Weitere Challenges freischalten</div><div class="ub-body">'+(cfg.unlockMsg||'Erreiche Bewertung 4 oder 5 f\xfcr weitere Challenges!')+'</div></div></div>'+
        '</div>'+
        '<div class="drill-screen" id="t7a-drill-'+uid+'">'+
          '<button class="back-btn" id="t7a-back-'+uid+'">\u2190 Zur\xfcck</button>'+
          '<div class="steps">'+steps+'</div>'+
          '<div class="drill-eye" id="t7a-deye-'+uid+'"></div><div class="drill-h" id="t7a-dh-'+uid+'"></div><div class="drill-meta" id="t7a-dmeta-'+uid+'"></div>'+
          '<div id="t7a-s1-'+uid+'">'+
            '<div class="embed-wrap"><iframe id="t7a-embed-'+uid+'" src="" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>'+
            '<div class="nudge"><div class="nudge-t">Schau zuerst das ganze Video</div><div class="nudge-s">Achte auf Fu\xdfstellung, K\xf6rperhaltung und Rhythmus.</div></div>'+
            '<div class="btn-row"><button class="btn btn-white" id="t7a-s1next-'+uid+'">Angeschaut \u2014 weiter \u2192</button></div>'+
          '</div>'+
          '<div id="t7a-s2-'+uid+'" style="display:none">'+
            '<div class="nudge"><div class="nudge-t">Leg das Handy weg und \xfcb!</div><div class="nudge-s">Probiere mehrmals. Dann filme einen Versuch und schau ihn dir an.</div></div>'+
            '<div class="try-card" id="t7a-camcard-'+uid+'"><div class="try-icon">\uD83D\uDCF9</div><div class="try-title">Filme deinen Versuch</div><div class="try-sub">Nichts wird gespeichert oder hochgeladen.</div><button class="btn btn-sm btn-acc" id="t7a-camopen-'+uid+'">Kamera \xf6ffnen</button><div id="t7a-camerr-'+uid+'" style="display:none;margin-top:10px;font-size:11px;color:#FF3B3B"></div></div>'+
            '<div id="t7a-camlive-'+uid+'" style="display:none;margin-bottom:14px"><video id="t7a-camv-'+uid+'" autoplay playsinline muted></video><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center"><button class="btn btn-sm" id="t7a-recbtn-'+uid+'" style="background:#DC2626;color:#fff;border-color:#DC2626">\u25cf Aufnahme</button><button class="btn btn-sm" id="t7a-camstop-'+uid+'">Abbrechen</button></div><div id="t7a-rectim-'+uid+'" style="display:none;text-align:center;font-size:11px;font-weight:800;color:#FF3B3B;margin-top:8px;text-transform:uppercase">\u23fa Aufnahme l\xe4uft\u2026</div></div>'+
            '<div id="t7a-prevw-'+uid+'" style="display:none;margin-bottom:14px"><video id="t7a-prev-'+uid+'" controls playsinline></video><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-sm" id="t7a-retrycam-'+uid+'">\uD83D\uDCF9 Nochmal</button><button class="btn btn-sm btn-acc" id="t7a-s2next-'+uid+'">Jetzt bewerten \u2192</button></div></div>'+
            '<div class="btn-row" id="t7a-skiprow-'+uid+'" style="display:flex"><button class="btn btn-sm" id="t7a-skip-'+uid+'">Ohne Aufnahme bewerten \u2192</button></div>'+
          '</div>'+
          '<div id="t7a-s3-'+uid+'" style="display:none">'+
            '<div id="t7a-hitsec-'+uid+'" style="display:none">'+
              '<div class="nudge"><div class="nudge-t">Gib deine beste Anzahl ein</div><div class="nudge-s">Sei ehrlich \u2014 jeder Versuch z\xe4hlt!</div></div>'+
              '<div class="hit-card">'+
                '<div class="hit-title">Wie viele Male hast du es geschafft?</div>'+
                '<div class="hit-sub" id="t7a-hsub-'+uid+'"></div>'+
                '<div class="hit-row"><button class="hit-btn" id="t7a-hminus-'+uid+'">&#8722;</button><input class="hit-input" type="number" min="0" max="999" value="0" id="t7a-hinp-'+uid+'"><button class="hit-btn" id="t7a-hplus-'+uid+'">&#43;</button></div>'+
                '<div class="hit-target" id="t7a-htgt-'+uid+'"></div>'+
                '<div class="hit-xp-prev" id="t7a-hxprev-'+uid+'">0 XP</div>'+
              '</div>'+
              '<div class="btn-row"><button class="btn btn-acc" id="t7a-hconfirm-'+uid+'">Best\xe4tigen \u2192</button></div>'+
            '</div>'+
            '<div id="t7a-ratesec-'+uid+'" style="display:none">'+
              '<div class="nudge"><div class="nudge-t">Sei ehrlich zu dir selbst</div><div class="nudge-s">4 oder 5 schaltet die Challenge frei und bringt dir Score-XP!</div></div>'+
              '<div class="rate-intro">Wie lief dein Versuch?</div>'+
              '<div class="rate-opts">'+rOpts+'</div>'+
              '<div class="btn-row" id="t7a-rconf-'+uid+'" style="display:none"><button class="btn btn-acc" id="t7a-rconfbtn-'+uid+'">Bewertung best\xe4tigen \u2192</button></div>'+
            '</div>'+
          '</div>'+
          '<div id="t7a-s4-'+uid+'" style="display:none">'+
            '<div class="outcome out-low" id="t7a-obox-'+uid+'"><div class="outcome-icon" id="t7a-oicon-'+uid+'"></div><div class="outcome-title" id="t7a-otitle-'+uid+'"></div><div class="outcome-sub" id="t7a-osub-'+uid+'"></div><div><span class="xp-pill" id="t7a-oxp-'+uid+'"></span></div><div><span class="xp-total-pill" id="t7a-oxpt-'+uid+'"></span></div></div>'+
            '<div class="btn-row-c" id="t7a-obtns-'+uid+'"></div>'+
          '</div>'+
        '</div>'+
      '</div>'+
    '</div>';
  }
  wire();
  T7Identity.resolve(function(email,name){initPlayer(email,name);});
}

/* ===========================================================
   TYPE B ENGINE -- T7Cert
   Star certificates: 5 drills, then submit final video to expert
   All drills must be rated >=4 to unlock the submission row
   =========================================================== */
function T7Cert(cfg){
  var uid=(Math.random().toString(36)+'00000').slice(2,7);
  var drills=cfg.drills||[];var nd=drills.length;
  var XMUL=[0,.2,.4,.6,.8,1];
  function aXP(r,max){return Math.round((XMUL[r]||0)*max);}
  function cXP(r,max){return r<4?0:Math.round((XMUL[r]||0)*max);}
  var S={expanded:false,drill:-1,rate:0,ratings:drills.map(function(){return 0;}),scXP:drills.map(function(){return 0;}),cumXP:0,cat:{},sk:'t7_'+cfg.instanceKey+'_g',ms:null,mr:null,ch:[],rec:false,fms:null,fmr:null,fch:[],frec:false,fblob:null,inited:false,name:'Spieler',sbTotal:null,email:null,submitted:false};
  var cont=document.getElementById(cfg.containerId||'cert-container');if(!cont)return;
  cont.insertAdjacentHTML('beforeend',_html());
  function el(id){return document.getElementById('t7b-'+id+'-'+uid);}
  function sv(){var e=el('cr');if(e)e.scrollIntoView({behavior:'smooth',block:'nearest'});}
  function show(id){var e=el(id);if(e)e.style.display='block';}
  function hide(id){var e=el(id);if(e)e.style.display='none';}
  // Storage
  function save(){try{localStorage.setItem(S.sk,JSON.stringify({r:S.ratings,s:S.scXP,c:S.cumXP,at:S.cat,sub:S.submitted}));}catch(e){}}
  function load(u){
    S.sk='t7_'+cfg.instanceKey+'_'+(u||'g').replace(/\s+/g,'_').toLowerCase();
    try{var raw=localStorage.getItem(S.sk);if(raw){var d=JSON.parse(raw);if(d.r)S.ratings=d.r;if(d.s)S.scXP=d.s;else for(var i=0;i<nd;i++)S.scXP[i]=cXP(S.ratings[i]||0,drills[i].xp);if(typeof d.c==='number')S.cumXP=d.c;if(d.at)S.cat=d.at;if(d.sub)S.submitted=d.sub;}}catch(e){}
    updXP();updProg();refresh();
  }
  function modXP(){var t=0;for(var i=0;i<nd;i++)t+=S.scXP[i];return t;}
  function updXP(){el('xp').textContent=modXP()+' XP';el('xpt').textContent=(typeof S.sbTotal==='number'?S.sbTotal:0)+' XP';}
  function updProg(){var done=S.ratings.filter(function(r){return r>=4;}).length;el('pf').style.width=Math.round(done/nd*100)+'%';el('pl').textContent=done+' / '+nd;}
  function allDone(){return S.ratings.filter(function(r){return r>=4;}).length===nd;}
  function refresh(){
    for(var i=0;i<nd;i++){
      var row=el('row-'+i),badge=el('badge-'+i),r=S.ratings[i];
      row.className='prow'+(r>=4?' pdone':'');
      if(r===0){badge.className='pbadge b-new';badge.textContent='Neu';}
      else if(r<=3){badge.className='pbadge b-retry';badge.textContent='\u21a9 Verbessern';}
      else if(r===4){badge.className='pbadge b-inprog';badge.textContent='\u2713 Gut';}
      else{badge.className='pbadge b-done';badge.textContent='\u2605 Perfekt';}
    }
    var fr=el('rowfinal'),fb=el('badfinal'),done=allDone();
    if(done){fr.classList.remove('plocked');fb.className='pbadge '+(S.submitted?'b-done':'b-submit');fb.textContent=S.submitted?'\u2713 Eingereicht':'\u2605 Einreichen';}
    else{fr.classList.add('plocked');fb.className='pbadge b-locked';fb.textContent='\uD83D\uDD12 Gesperrt';}
    updProg();
  }
  // Navigation
  function toggle(){
    S.expanded=!S.expanded;var cr=el('cr'),panel=el('panel');
    if(S.expanded){cr.classList.add('open');panel.classList.add('open');el('crb').textContent='Schlie\xdfen \u25b2';}
    else{cr.classList.remove('open');panel.classList.remove('open');el('crb').textContent='Starten \u25bc';goTrack();}
  }
  function goTrack(){el('embed').src='';el('drill').classList.remove('open');el('submit').classList.remove('open');show('track');stopCam();stopFCam();refresh();sv();}
  function openDrill(idx){
    S.drill=idx;S.rate=0;var d=drills[idx];
    el('deye').textContent=d.eye;el('dh').textContent=d.title;el('dmeta').textContent=d.meta;
    el('embed').src='https://player.vimeo.com/video/'+d.vid+'?h='+d.hash+'&color=FFD700&title=0&byline=0&portrait=0&dnt=1';
    [1,2,3,4,5].forEach(function(v){el('r'+v).className='rate-opt';});
    hide('rconf');resetCam();hide('track');el('drill').classList.add('open');goStep(1);sv();
  }
  function openSubmit(){
    if(!allDone())return;
    hide('track');el('drill').classList.remove('open');el('submit').classList.add('open');
    var cl=el('checklist');
    if(cl)cl.innerHTML=drills.map(function(d,i){var r=S.ratings[i]||0,done=r>=4;return'<div class="ci'+(done?' done':'')+'"><div class="ci-check">'+(done?'\u2713':r>0?r:'')+'</div><div class="ci-name">'+d.title+'</div><div class="ci-score">'+(r===5?'\u2605 Perfekt':r===4?'\u2713 Gut':r>0?r+'/5':'')+'</div></div>';}).join('');
    var mob=/iphone|ipad|ipod|android/i.test(navigator.userAgent);
    el('mob').style.display=mob?'block':'none';el('desk').style.display=mob?'none':'block';
    if(mob&&S.submitted)el('mobsent').style.display='flex';
    if(!mob&&S.submitted){hide('fcamcard');hide('fcam');hide('fprevw');show('sent');}
    sv();
  }
  function goStep(n){
    ['s1','s2','s3','s4'].forEach(function(id,i){el(id).style.display=(i===n-1)?'block':'none';});
    [1,2,3,4].forEach(function(i){var dot=el('d'+i);dot.className='step-dot';if(i<n)dot.classList.add('done-s');else if(i===n)dot.classList.add('curr-s');});
    if(n===4)showOut();
  }
  // Rating & outcome
  function selRate(v){S.rate=v;[1,2,3,4,5].forEach(function(i){el('r'+i).className='rate-opt'+(i===v?' sel-'+v:'');});el('rconf').style.display='flex';}
  function showOut(){
    var d=drills[S.drill],idx=S.drill,prev=S.ratings[idx]||0;
    var earned=aXP(S.rate,d.xp),prevS=S.scXP[idx]||0,newS=cXP(S.rate,d.xp);
    S.cumXP+=earned;if(newS>prevS)S.scXP[idx]=newS;
    if(S.rate>prev){S.ratings[idx]=S.rate;if(!S.cat[idx])S.cat[idx]=Date.now();}
    if(S.email)T7SB.upsert(S.email,S.name,cfg.instanceKey,cfg.title,idx,S.rate,earned,S.cat[idx]||Date.now(),S.sbTotal);
    updXP();save();
    if(S.email)setTimeout(function(){T7SB.getTotalXP(S.email,function(t){S.sbTotal=t;updXP();});try{window.dispatchEvent(new CustomEvent('t7xpupdate'));}catch(e){}},1500);
    var box=el('obox'),icon=el('oicon'),title=el('otitle'),sub=el('osub'),btns=el('obtns');
    el('oxp').textContent='+'+earned+' XP';el('oxpt').textContent='Gesamt: '+(typeof S.sbTotal==='number'?S.sbTotal:S.cumXP)+' XP';
    var ni=idx+1,ad=allDone();
    if(S.rate<=3){box.className='outcome out-low';icon.textContent=S.rate<=2?'\uD83D\uDCAA':'\uD83E\uDD14';title.textContent=S.rate<=2?'Weiter k\xe4mpfen!':'Ganz gut!';sub.textContent='Noch ein Versuch f\xfcr Bewertung 4 oder 5!';}
    else{box.className=S.rate===5?'outcome out-high':'outcome out-mid';icon.textContent=S.rate===5?'\uD83E\uDD29':'\uD83D\uDE04';title.textContent=S.rate===5?'Perfekt!':'Richtig gut!';sub.textContent=ad?'Alle Challenges abgeschlossen! Jetzt einreichen!':(drills[idx].next||'Weiter so!');}
    btns.innerHTML='';
    if(ad&&S.rate>=4){var sb=document.createElement('button');sb.className='btn btn-gold';sb.textContent='\u2605 Zertifikat einreichen';sb.onclick=openSubmit;btns.appendChild(sb);}
    var nb=document.createElement('button');nb.className='btn btn-sm';
    if(ni<nd){nb.textContent='N\xe4chste \u2192';nb.onclick=function(){openDrill(ni);};}
    else{nb.textContent='Zur\xfcck zur Liste';nb.onclick=goTrack;}
    btns.appendChild(nb);
    refresh();
  }
  // Drill camera
  function startCam(){navigator.mediaDevices.getUserMedia({video:true,audio:true}).then(function(s){S.ms=s;var v=el('camv');v.srcObject=s;v.play();hide('camcard');el('camlive').style.display='block';hide('skiprow');}).catch(function(e){var er=el('camerr');if(er){er.style.display='block';er.textContent='Kamera: '+e.message;}});}
  function stopCam(){if(S.ms){S.ms.getTracks().forEach(function(t){t.stop();});S.ms=null;}if(S.mr&&S.mr.state!=='inactive')try{S.mr.stop();}catch(e){}S.mr=null;S.ch=[];S.rec=false;}
  function resetCam(){stopCam();var v=el('camv');if(v)v.srcObject=null;el('camlive').style.display='none';var pw=el('prevw');if(pw)pw.style.display='none';var pv=el('prev');if(pv){pv.pause();pv.src='';}show('camcard');el('skiprow').style.display='flex';}
  function toggleRec(){
    if(!S.ms)return;
    if(!S.rec){S.ch=[];var opt=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'].filter(function(t){return MediaRecorder.isTypeSupported(t);})[0]||'';S.mr=new MediaRecorder(S.ms,opt?{mimeType:opt}:{});S.mr.ondataavailable=function(e){if(e.data&&e.data.size>0)S.ch.push(e.data);};S.mr.onstop=function(){var blob=new Blob(S.ch,{type:S.mr.mimeType||'video/webm'});var pv=el('prev');pv.src=URL.createObjectURL(blob);pv.load();el('camlive').style.display='none';el('prevw').style.display='block';hide('skiprow');stopCam();};S.mr.start();S.rec=true;el('recbtn').textContent='\u2B1B Stopp';el('recbtn').style.background='#DC2626';el('rectim').style.display='block';}
    else{if(S.mr&&S.mr.state!=='inactive')S.mr.stop();S.rec=false;el('recbtn').textContent='\u25cf Aufnahme';el('rectim').style.display='none';}
  }
  // Final camera (desktop)
  function startFCam(){navigator.mediaDevices.getUserMedia({video:true,audio:true}).then(function(s){S.fms=s;var v=el('fcamv');v.srcObject=s;v.play();hide('fcamcard');el('fcam').style.display='block';}).catch(function(){});}
  function stopFCam(){if(S.fms){S.fms.getTracks().forEach(function(t){t.stop();});S.fms=null;}if(S.fmr&&S.fmr.state!=='inactive')try{S.fmr.stop();}catch(e){}S.fmr=null;S.fch=[];S.frec=false;}
  function toggleFRec(){
    if(!S.fms)return;
    if(!S.frec){S.fch=[];var opt=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'].filter(function(t){return MediaRecorder.isTypeSupported(t);})[0]||'';S.fmr=new MediaRecorder(S.fms,opt?{mimeType:opt}:{});S.fmr.ondataavailable=function(e){if(e.data&&e.data.size>0)S.fch.push(e.data);};S.fmr.onstop=function(){S.fblob=new Blob(S.fch,{type:S.fmr.mimeType||'video/webm'});var pv=el('fprev');pv.src=URL.createObjectURL(S.fblob);pv.load();el('fcam').style.display='none';el('fprevw').style.display='block';stopFCam();};S.fmr.start();S.frec=true;el('frecbtn').textContent='\u2B1B Stopp';el('frectim').style.display='block';}
    else{if(S.fmr&&S.fmr.state!=='inactive')S.fmr.stop();S.frec=false;el('frecbtn').textContent='\u25cf Aufnahme';el('frectim').style.display='none';}
  }
  function autoDownload(blob,fname){var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download=fname;document.body.appendChild(a);a.click();setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(url);},1000);}
  function mailto(){
    var rows=drills.map(function(d,i){var r=S.ratings[i]||0;return 'Challenge '+(i+1)+' '+d.title+': '+(r===5?'Perfekt':r===4?'Gut ('+r+'/5)':r>0?r+'/5':'--');}).join('\n');
    var body='Hallo,\n\nIch m\xf6chte mein '+cfg.title+' einreichen.\n\nSpieler: '+S.name+'\nE-Mail: '+(S.email||'')+'\n\nErgebnisse:\n'+rows+'\n\nKurs-XP: '+modXP()+'\nGesamt-XP: '+(typeof S.sbTotal==='number'?S.sbTotal:0);
    window.location.href='mailto:'+(cfg.expertEmail||'expert@t7academy.com')+'?subject='+encodeURIComponent(cfg.title+' \u2013 Einreichung von '+S.name)+'&body='+encodeURIComponent(body);
  }
  // Init player
  function initPlayer(email,name){
    S.email=email;S.inited=true;
    var parts=(name||'Spieler').trim().split(/\s+/);
    var ini=parts.length>=2?(parts[0][0]+parts[parts.length-1][0]).toUpperCase():(name||'?').slice(0,2).toUpperCase();
    el('av').textContent=ini;S.name=parts[0]||'Spieler';
    load(name);
    T7SB.getTotalXP(email,function(t){S.sbTotal=t;updXP();});
    T7SB.getModuleXP(email,cfg.instanceKey,function(rows){
      var best={};rows.forEach(function(r){var i=r.challenge_idx;if(!(i in best)||r.rating>best[i])best[i]=r.rating;});
      var changed=false;Object.keys(best).forEach(function(i){var idx=parseInt(i);if(best[i]>=(S.ratings[idx]||0)){S.ratings[idx]=best[i];S.scXP[idx]=cXP(best[i],drills[idx]?drills[idx].xp:10);changed=true;}});
      if(changed){save();updXP();updProg();refresh();}
    });
    T7SB.getCert(email,cfg.stars,function(cert){
      if(cert){var wrap=document.querySelector('.t7b-wrap[data-uid="'+uid+'"]');if(wrap)wrap.classList.add('certified');}
    });
    var ht=el('ht');if(ht&&cfg.heroText)ht.textContent='Hey '+S.name+'! '+cfg.heroText;
  }
  // Wire events
  function wire(){
    el('cr').addEventListener('click',toggle);
    el('crb').addEventListener('click',function(e){e.stopPropagation();toggle();});
    for(var i=0;i<nd;i++){(function(idx){var row=el('row-'+idx);if(row)row.addEventListener('click',function(){openDrill(idx);});})(i);}
    el('rowfinal').addEventListener('click',function(){if(allDone())openSubmit();});
    el('back').addEventListener('click',goTrack);el('suback').addEventListener('click',goTrack);
    el('s1next').addEventListener('click',function(){goStep(2);});
    el('s2next').addEventListener('click',function(){goStep(3);});
    el('skip').addEventListener('click',function(){goStep(3);});
    [1,2,3,4,5].forEach(function(v){el('r'+v).addEventListener('click',function(){selRate(v);});});
    el('rconfbtn').addEventListener('click',function(){if(S.rate)goStep(4);});
    el('camopen').addEventListener('click',startCam);el('recbtn').addEventListener('click',toggleRec);
    el('camstop').addEventListener('click',function(){resetCam();el('skiprow').style.display='flex';show('camcard');});
    el('retrycam').addEventListener('click',resetCam);
    // Submit - mobile
    el('mobbtn').addEventListener('click',function(){mailto();S.submitted=true;save();refresh();el('mobsent').style.display='flex';});
    // Submit - desktop
    el('fcamopen').addEventListener('click',startFCam);el('frecbtn').addEventListener('click',toggleFRec);
    el('fcamstop').addEventListener('click',function(){stopFCam();show('fcamcard');});
    el('fretry').addEventListener('click',function(){var pv=el('fprev');if(pv){pv.pause();pv.src='';}hide('fprevw');S.fblob=null;S.fch=[];show('fcamcard');});
    el('dlbtn').addEventListener('click',function(){if(!S.fblob)return;var ext=S.fblob.type&&S.fblob.type.indexOf('mp4')>-1?'mp4':'webm';autoDownload(S.fblob,'final-'+(S.name||'player').toLowerCase()+'.'+ext);el('dlok').style.display='flex';setTimeout(function(){el('stepsend').style.display='block';},700);});
    el('sendbtn').addEventListener('click',function(){mailto();S.submitted=true;save();hide('fprevw');show('sent');refresh();});
    el('dirsend').addEventListener('click',function(){mailto();S.submitted=true;save();hide('fcamcard');show('sent');refresh();});
    el('retakebtn').addEventListener('click',function(){S.submitted=false;save();hide('sent');show('fcamcard');stopFCam();var pv=el('fprev');if(pv){pv.pause();pv.src='';}hide('fprevw');S.fblob=null;S.fch=[];refresh();});
    el('reopenbtn').addEventListener('click',mailto);
    window.addEventListener('t7xpupdate',function(){if(S.email)T7SB.getTotalXP(S.email,function(t){S.sbTotal=t;updXP();});});
  }
  // Build HTML
  function _html(){
    var rows=drills.map(function(d,i){
      return '<div class="prow" id="t7b-row-'+i+'-'+uid+'"><div class="prow-num">'+(i<9?'0':'')+(i+1)+'</div><div class="prow-body"><div class="prow-title">'+d.title+'</div><div class="prow-meta">'+d.meta+'</div></div><span class="pbadge b-new" id="t7b-badge-'+i+'-'+uid+'">Neu</span></div>';
    }).join('');
    var steps=['Anschauen','Üben','Bewerten','Ergebnis'].map(function(n,i){
      return '<div class="step"><div class="step-dot" id="t7b-d'+(i+1)+'-'+uid+'">'+(i+1)+'</div><span class="step-name">'+n+'</span></div>'+(i<3?'<div class="step-line"></div>':'');
    }).join('');
    var rOpts=[['😩','Kaum'],['🤔','Fast'],['🙂','OK'],['😄','Gut'],['🤩','Perfekt']].map(function(r,i){
      return '<div class="rate-opt" id="t7b-r'+(i+1)+'-'+uid+'"><div class="rate-emoji">'+r[0]+'</div><div class="rate-text">'+r[1]+'</div></div>';
    }).join('');
    return '<div class="t7w t7b-wrap" data-uid="'+uid+'">'+
      '<div class="cr" id="t7b-cr-'+uid+'">'+
        '<div class="cr-badge" style="background:linear-gradient(135deg,#8B6914,#5C4A0A);box-shadow:0 0 14px rgba(139,105,20,.4)"><span style="font-size:22px;line-height:1;color:#FFD700;font-weight:900;text-shadow:0 0 6px rgba(255,215,0,.7),0 2px 3px rgba(0,0,0,.5)">\u2605</span></div>'+
        '<div class="cr-body"><div class="cr-title">'+(cfg.title||'Zertifikat')+'</div>'+
          '<div class="cr-sub"><span>Stern Zertifikat</span><div class="cr-prog"><div class="cr-prog-fill" id="t7b-pf-'+uid+'" style="width:0%"></div></div><span class="cr-prog-label" id="t7b-pl-'+uid+'">0 / '+nd+'</span></div></div>'+
        '<div class="cr-player"><div class="cr-avatar" id="t7b-av-'+uid+'">?</div>'+
          '<span class="cr-xp" id="t7b-xp-'+uid+'">0 XP</span><span class="cr-xp-total" id="t7b-xpt-'+uid+'">0 XP</span>'+
          '<span class="cr-certified" id="t7b-certbdg-'+uid+'">\u2b50 Zertifiziert</span>'+
          '<button class="cr-btn" id="t7b-crb-'+uid+'">Starten \u25bc</button></div>'+
      '</div>'+
      '<div class="t7-panel" id="t7b-panel-'+uid+'">'+
        '<div id="t7b-track-'+uid+'">'+
          '<div class="ph"><div class="ph-title">'+(cfg.title||'Zertifikat')+'</div><div class="ph-body" id="t7b-ht-'+uid+'">'+(cfg.heroText||'')+'</div></div>'+
          '<div class="plist"><div class="plabel">Technik Challenges</div>'+rows+
            '<div class="prow plocked" id="t7b-rowfinal-'+uid+'"><div class="prow-num">\uD83C\uDFAC</div><div class="prow-body"><div class="prow-title">Final-Video einreichen</div><div class="prow-meta">Alle 5 Challenges meistern -> Zertifikat erhalten</div></div><span class="pbadge b-locked" id="t7b-badfinal-'+uid+'">\uD83D\uDD12 Gesperrt</span></div>'+
          '</div>'+
        '</div>'+
        '<div class="drill-screen" id="t7b-drill-'+uid+'">'+
          '<button class="back-btn" id="t7b-back-'+uid+'">\u2190 Zur\xfcck</button>'+
          '<div class="steps">'+steps+'</div>'+
          '<div class="drill-eye" id="t7b-deye-'+uid+'"></div><div class="drill-h" id="t7b-dh-'+uid+'"></div><div class="drill-meta" id="t7b-dmeta-'+uid+'"></div>'+
          '<div id="t7b-s1-'+uid+'"><div class="embed-wrap"><iframe id="t7b-embed-'+uid+'" src="" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div><div class="nudge"><div class="nudge-t">Schau zuerst das ganze Video</div><div class="nudge-s">Achte auf Fu\xdfstellung, K\xf6rperhaltung und Rhythmus.</div></div><div class="btn-row"><button class="btn btn-white" id="t7b-s1next-'+uid+'">Angeschaut \u2014 weiter \u2192</button></div></div>'+
          '<div id="t7b-s2-'+uid+'" style="display:none"><div class="nudge"><div class="nudge-t">Leg das Handy weg und \xfcb!</div><div class="nudge-s">Probiere mehrmals. Dann filme einen Versuch.</div></div><div class="try-card" id="t7b-camcard-'+uid+'"><div class="try-icon">\uD83D\uDCF9</div><div class="try-title">Filme deinen Versuch</div><div class="try-sub">Nichts wird gespeichert oder hochgeladen.</div><button class="btn btn-sm btn-acc" id="t7b-camopen-'+uid+'">Kamera \xf6ffnen</button><div id="t7b-camerr-'+uid+'" style="display:none;margin-top:10px;font-size:11px;color:#FF3B3B"></div></div><div id="t7b-camlive-'+uid+'" style="display:none;margin-bottom:14px"><video id="t7b-camv-'+uid+'" autoplay playsinline muted></video><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center"><button class="btn btn-sm" id="t7b-recbtn-'+uid+'" style="background:#DC2626;color:#fff;border-color:#DC2626">\u25cf Aufnahme</button><button class="btn btn-sm" id="t7b-camstop-'+uid+'">Abbrechen</button></div><div id="t7b-rectim-'+uid+'" style="display:none;text-align:center;font-size:11px;font-weight:800;color:#FF3B3B;margin-top:8px;text-transform:uppercase">\u23fa L\xe4uft\u2026</div></div><div id="t7b-prevw-'+uid+'" style="display:none;margin-bottom:14px"><video id="t7b-prev-'+uid+'" controls playsinline></video><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-sm" id="t7b-retrycam-'+uid+'">\uD83D\uDCF9 Nochmal</button><button class="btn btn-sm btn-acc" id="t7b-s2next-'+uid+'">Jetzt bewerten \u2192</button></div></div><div class="btn-row" id="t7b-skiprow-'+uid+'" style="display:flex"><button class="btn btn-sm" id="t7b-skip-'+uid+'">Ohne Aufnahme \u2192</button></div></div>'+
          '<div id="t7b-s3-'+uid+'" style="display:none"><div class="nudge"><div class="nudge-t">Sei ehrlich zu dir selbst</div><div class="nudge-s">4 oder 5 z\xe4hlt f\xfcr das Zertifikat!</div></div><div class="rate-intro">Wie lief dein Versuch?</div><div class="rate-opts">'+rOpts+'</div><div class="btn-row" id="t7b-rconf-'+uid+'" style="display:none"><button class="btn btn-acc" id="t7b-rconfbtn-'+uid+'">Best\xe4tigen \u2192</button></div></div>'+
          '<div id="t7b-s4-'+uid+'" style="display:none"><div class="outcome out-low" id="t7b-obox-'+uid+'"><div class="outcome-icon" id="t7b-oicon-'+uid+'"></div><div class="outcome-title" id="t7b-otitle-'+uid+'"></div><div class="outcome-sub" id="t7b-osub-'+uid+'"></div><div><span class="xp-pill" id="t7b-oxp-'+uid+'"></span></div><div><span class="xp-total-pill" id="t7b-oxpt-'+uid+'"></span></div></div><div class="btn-row-c" id="t7b-obtns-'+uid+'"></div></div>'+
        '</div>'+
        '<div class="submit-screen" id="t7b-submit-'+uid+'">'+
          '<button class="back-btn" id="t7b-suback-'+uid+'">\u2190 Zur\xfcck</button>'+
          '<div class="submit-hero"><div class="sh-eye">ZERTIFIKAT EINREICHEN</div><div class="sh-title">'+(cfg.title||'Zertifikat')+'</div><div class="sh-body">Alle '+(cfg.stars||1)+' Stern'+(cfg.stars>1?'e':'')+' gemeistert! Reiche dein Final-Video ein.</div></div>'+
          '<div class="ss-label">Deine Ergebnisse</div><div class="checklist" id="t7b-checklist-'+uid+'"></div>'+
          // Mobile path
          '<div id="t7b-mob-'+uid+'" style="display:none"><div class="nudge"><div class="nudge-t">Schritt 1 \u2014 Video aufnehmen</div><div class="nudge-s">Nimm ein kurzes Video auf, das deine Skills zeigt, und h\xe4nge es an die E-Mail an.</div></div><button class="btn btn-gold" id="t7b-mobbtn-'+uid+'" style="width:100%;justify-content:center;padding:13px;font-size:13px;border-radius:14px">\u2709\ufe0f E-Mail an Experten \xf6ffnen</button><div id="t7b-mobsent-'+uid+'" style="display:none;align-items:center;gap:10px;margin-top:12px;background:rgba(255,215,0,.1);border:1px solid rgba(255,215,0,.28);border-radius:12px;padding:12px"><div style="font-size:20px">\u2b50</div><div><div style="font-weight:800;font-size:13px;color:#FFD700">E-Mail ge\xf6ffnet!</div><div style="font-size:11px;color:rgba(255,255,255,.55)">H\xe4nge dein Video an und sende die Mail.</div></div></div></div>'+
          // Desktop path
          '<div id="t7b-desk-'+uid+'" style="display:none">'+
            '<div class="try-card" id="t7b-fcamcard-'+uid+'"><div class="try-icon">\uD83C\uDFAC</div><div class="try-title">Final-Video aufnehmen</div><div class="try-sub">Zeige deine besten Skills. Wird lokal gespeichert.</div><button class="btn btn-sm btn-acc" id="t7b-fcamopen-'+uid+'">Kamera \xf6ffnen</button><div style="margin-top:10px"><button class="btn btn-sm" id="t7b-dirsend-'+uid+'">\u2709\ufe0f Direkt per E-Mail (ohne Video)</button></div></div>'+
            '<div id="t7b-fcam-'+uid+'" style="display:none;margin-bottom:14px"><video id="t7b-fcamv-'+uid+'" autoplay playsinline muted></video><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center"><button class="btn btn-sm" id="t7b-frecbtn-'+uid+'" style="background:#DC2626;color:#fff;border-color:#DC2626">\u25cf Aufnahme</button><button class="btn btn-sm" id="t7b-fcamstop-'+uid+'">Abbrechen</button></div><div id="t7b-frectim-'+uid+'" style="display:none;text-align:center;font-size:11px;font-weight:800;color:#FF3B3B;margin-top:8px;text-transform:uppercase">\u23fa L\xe4uft\u2026</div></div>'+
            '<div id="t7b-fprevw-'+uid+'" style="display:none;margin-bottom:14px"><video id="t7b-fprev-'+uid+'" controls playsinline></video><div style="display:flex;align-items:center;gap:8px;background:rgba(0,229,255,.07);border:1px solid rgba(0,229,255,.18);border-radius:12px;padding:10px 13px;margin-bottom:8px"><span>1\ufe0f\u20e3</span><span style="font-weight:700;font-size:12px;color:#00E5FF">Video herunterladen</span></div><button class="btn btn-acc" id="t7b-dlbtn-'+uid+'" style="width:100%;justify-content:center;margin-bottom:8px">\u2b07\ufe0f Video herunterladen</button><div id="t7b-dlok-'+uid+'" style="display:none;align-items:center;gap:8px;background:rgba(204,255,0,.09);border:1px solid rgba(204,255,0,.25);border-radius:12px;padding:10px 13px;margin-bottom:8px"><span>\u2705</span><span style="font-weight:700;font-size:12px;color:#CCFF00">Gespeichert! Jetzt Schritt 2.</span></div><div id="t7b-stepsend-'+uid+'" style="display:none"><div style="display:flex;align-items:center;gap:8px;background:rgba(255,215,0,.09);border:1px solid rgba(255,215,0,.25);border-radius:12px;padding:10px 13px;margin-bottom:10px"><span>2\ufe0f\u20e3</span><span style="font-weight:700;font-size:12px;color:#FFD700">E-Mail senden</span></div><button class="btn btn-gold" id="t7b-sendbtn-'+uid+'" style="width:100%;justify-content:center;padding:13px;font-size:13px;border-radius:14px">\u2709\ufe0f E-Mail an Experten \xf6ffnen</button></div><div style="text-align:center;margin-top:12px"><button class="btn btn-sm" id="t7b-fretry-'+uid+'">\uD83D\uDCF9 Neu aufnehmen</button></div></div>'+
            '<div class="sent-card" id="t7b-sent-'+uid+'" style="display:none"><div class="sent-icon">\uD83C\uDFC6</div><div class="sent-title">E-Mail gesendet!</div><div class="sent-body">Super! Dein '+cfg.title+' ist auf dem Weg. Wir melden uns bald. \u2b50</div><div class="btn-row-c" style="margin-top:14px"><button class="btn btn-sm btn-acc" id="t7b-retakebtn-'+uid+'">\uD83D\uDCF9 Neues Video</button><button class="btn btn-sm btn-acc" id="t7b-reopenbtn-'+uid+'">\u2709\ufe0f Mail nochmal</button></div></div>'+
          '</div>'+
        '</div>'+
      '</div>'+
    '</div>';
  }
  wire();
  T7Identity.resolve(function(email,name){initPlayer(email,name);});
}

/* === SIDEBAR: FORTSCHRITT === */
function T7Fortschritt(containerId){
  var cont=document.getElementById(containerId);
  if(!cont)return;
  cont.innerHTML='<div class="t7f-loading">Lade\u2026</div>';
  function getWeekKey(date){
    var d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
    var day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-day);
    var yearStart=new Date(Date.UTC(d.getUTCFullYear(),0,1));
    var week=Math.ceil((((d-yearStart)/86400000)+1)/7);
    return d.getUTCFullYear()+'-W'+week;
  }
  function computeStreak(attempts){
    var weekSet={};
    (attempts||[]).forEach(function(row){
      var ts=typeof row.attempted_at==='number'?row.attempted_at:parseInt(row.attempted_at)||0;
      if(ts)weekSet[getWeekKey(new Date(ts))]=true;
    });
    var weeks=Object.keys(weekSet).sort().reverse();
    if(!weeks.length)return 0;
    var thisW=getWeekKey(new Date()),lastW=getWeekKey(new Date(Date.now()-7*86400000));
    if(weeks[0]!==thisW&&weeks[0]!==lastW)return 0;
    var streak=1;
    for(var i=1;i<weeks.length;i++){
      var py=parseInt(weeks[i-1].split('-W')[0]),pw=parseInt(weeks[i-1].split('-W')[1]);
      var cy=parseInt(weeks[i].split('-W')[0]),cw=parseInt(weeks[i].split('-W')[1]);
      if((py===cy&&pw-cw===1)||(py-cy===1&&pw===1&&cw>=52))streak++;else break;
    }
    return streak;
  }
  function getWeeklyXP(attempts){
    var now=new Date();
    var startOfWeek=new Date(now);startOfWeek.setHours(0,0,0,0);
    startOfWeek.setDate(now.getDate()-((now.getDay()+6)%7));
    var t0=startOfWeek.getTime(),tw=0;
    (attempts||[]).forEach(function(row){
      var raw=row.attempted_at;
      var ts=typeof raw==='number'?raw:parseInt(raw)||0;
      if(ts>=t0)tw+=Number(row.xp||0);
    });
    return tw;
  }
  function render(email,name){
    Promise.all([
      fetch(T7_SB_URL+'/rest/v1/players?player_email=eq.'+encodeURIComponent(email)+'&select=total_xp',{headers:{apikey:T7_SB_KEY,'Authorization':'Bearer '+T7_SB_KEY}}).then(function(r){return r.json();}),
      fetch(T7_SB_URL+'/rest/v1/attempts?player_email=eq.'+encodeURIComponent(email)+'&select=attempted_at,xp&order=attempted_at.asc',{headers:{apikey:T7_SB_KEY,'Authorization':'Bearer '+T7_SB_KEY}}).then(function(r){return r.json();})
    ]).then(function(res){
      var players=res[0]||[],attempts=res[1]||[];
      var totalXP=players.length?Number(players[0].total_xp||0):0;
      var weekXP=getWeeklyXP(attempts);
      var streak=computeStreak(attempts);
      var parts=(name||email||'?').trim().split(/\s+/);
      var dispName=parts[0]||'Spieler';
      var ini=parts.length>=2?(parts[0][0]+parts[parts.length-1][0]).toUpperCase():dispName.slice(0,2).toUpperCase();
      var daysHtml='';
      for(var d=0;d<8;d++){daysHtml+='<div class="t7f-streak-day'+(d<streak?' on':'')+'"></div>';}
      cont.innerHTML=
        '<div class="t7f-hero">'+
          '<div class="t7f-hero-top">'+
            '<div class="t7f-avatar">'+ini+'</div>'+
            '<div><div class="t7f-pname">'+dispName+'</div><div class="t7f-sub">Mein Fortschritt</div></div>'+
          '</div>'+
        '</div>'+
        '<div class="t7f-stat-row">'+
          '<div class="t7f-stat-card"><div class="t7f-stat-num">'+totalXP.toLocaleString('de-AT')+'</div><div class="t7f-stat-label">Gesamt XP</div></div>'+
          '<div class="t7f-stat-card"><div class="t7f-stat-num">+'+weekXP+'</div><div class="t7f-stat-label">Diese Woche</div></div>'+
        '</div>'+
        '<div class="t7f-streak"><div class="t7f-streak-val">'+streak+' Woche'+(streak===1?'':'n')+' Streak</div><div class="t7f-streak-days">'+daysHtml+'</div></div>';
    }).catch(function(){cont.innerHTML='<div class="t7f-empty">Fehler beim Laden.</div>';});
  }
  T7Identity.resolve(function(email,name){
    if(!email){cont.innerHTML='<div class="t7f-empty">Kein Spieler erkannt.</div>';return;}
    render(email,name);
  });
  window.addEventListener('t7xpupdate',function(){var id=T7Identity.get();if(id&&id.email)render(id.email,id.name);});
}

/* === SIDEBAR: RANGLISTE === */
function T7Rangliste(containerId){
  var cont=document.getElementById(containerId);if(!cont)return;
  var LIMIT=20,AC=[['#003d5c','#00E5FF'],['#064e3b','#34d399'],['#3b1e5f','#c4b5fd'],['#1e3a5f','#93c5fd'],['#7f1d1d','#fca5a5'],['#1c3a2e','#86efac'],['#4a1d2f','#f9a8d4'],['#1e3a1e','#bbf7d0'],['#2d2000','#fde68a'],['#1a1a3e','#a5b4fc']];
  var allP=[],view='xp';
  function ini(n){if(!n)return'?';return n.split(/\s+/).map(function(w){return w[0];}).join('').toUpperCase().slice(0,2);}
  function ai(n){return n?(n.charCodeAt(0)+n.length)%AC.length:0;}
  cont.innerHTML='<div class="rl-header"><div class="rl-title">\uD83C\uDFC6 Rangliste</div><div class="rl-sub">Top Members \u00b7 T7 Academy</div></div><div class="vt-wrap"><button class="vt-btn active" id="t7rl-xp-'+containerId+'">&#9889; XP Rangliste</button><button class="vt-btn" id="t7rl-wk-'+containerId+'">&#128197; Wochen Mitglied</button></div><div id="t7rl-list-'+containerId+'"><div class="rl-loading">Lade\u2026</div></div>';
  var listEl=document.getElementById('t7rl-list-'+containerId);
  var btnXP=document.getElementById('t7rl-xp-'+containerId);
  var btnWk=document.getElementById('t7rl-wk-'+containerId);
  function setView(v){view=v;btnXP.className='vt-btn'+(v==='xp'?' active':'');btnWk.className='vt-btn'+(v==='weeks'?' active':'');if(allP.length)renderList();}
  btnXP.onclick=function(){setView('xp');};btnWk.onclick=function(){setView('weeks');};
  function renderList(){
    var isW=view==='weeks';
    var sorted=allP.slice().sort(function(a,b){return isW?b.weeks-a.weeks:b.xp-a.xp;});
    var med=['\uD83E\uDD47','\uD83E\uDD48','\uD83E\uDD49'];
    listEl.innerHTML='<div class="rank-list">'+sorted.map(function(p,i){
      var r=i+1,c=AC[ai(p.name)],val=isW?p.weeks+' Woche'+(p.weeks===1?'':'n'):(p.xp||0).toLocaleString('de-AT')+' XP';
      return '<div class="rank-row"><div class="rank-num" style="color:'+(r===1?'#00E5FF':r===2?'rgba(200,200,220,.75)':r===3?'#FF9500':'rgba(255,255,255,.18)')+'">'+(r<=3?med[r-1]:r)+'</div><div class="r-avatar" style="background:'+c[0]+';color:'+c[1]+';border:2px solid '+(r===1?'#00E5FF':r===2?'rgba(200,200,220,.55)':r===3?'rgba(255,149,0,.55)':c[1]+'55')+'">'+ini(p.name)+'</div><div class="rank-name">'+p.name+'</div><div class="rank-val">'+val+'</div></div>';
    }).join('')+'</div>';
  }
  function load(){
    var nowMs=Date.now();
    Promise.all([
      fetch(T7_SB_URL+'/rest/v1/players?select=player_name,total_xp&order=total_xp.desc&limit='+LIMIT,{headers:{apikey:T7_SB_KEY,'Authorization':'Bearer '+T7_SB_KEY}}).then(function(r){return r.json();}).catch(function(){return[];}),
      fetch(T7_SB_URL+'/rest/v1/members?select=name,bm_joined_at&limit=200',{headers:{apikey:T7_SB_KEY,'Authorization':'Bearer '+T7_SB_KEY}}).then(function(r){return r.json();}).catch(function(){return[];})
    ]).then(function(res){
      var players=res[0]||[],members=res[1]||[];
      var joinMap={};members.forEach(function(m){if(m.name&&m.bm_joined_at)joinMap[m.name]=m.bm_joined_at;});
      allP=players.map(function(p){
        var nm=p.player_name||'Unbekannt',jt=joinMap[nm]||null;
        return{name:nm,xp:Number(p.total_xp||0),weeks:jt?Math.floor((nowMs-jt)/(7*86400000)):0};
      });
      if(!allP.length){listEl.innerHTML='<div class="rl-loading">Noch keine Eintr\xe4ge.</div>';return;}
      renderList();
    }).catch(function(){listEl.innerHTML='<div class="rl-loading">Fehler beim Laden.</div>';});
  }
  load();
  window.addEventListener('t7xpupdate',load);
  setInterval(load,60000);
}

/* === SIDEBAR: BADGE (Sterne Zertifikat) === */
function T7Badge(containerId){
  var cont=document.getElementById(containerId);if(!cont)return;
  cont.innerHTML='<div class="t7f-loading">Lade\u2026</div>';
  function starsHtml(n){if(n<=3)return'\u2b50'.repeat(n);var h=Math.ceil(n/2);return'\u2b50'.repeat(h)+'<br>'+'\u2b50'.repeat(n-h);}
  function fmtDate(ts){if(!ts)return'';var d=new Date(typeof ts==='number'?ts:parseInt(ts));return d.toLocaleDateString('de-AT',{day:'2-digit',month:'long',year:'numeric'});}
  function showBadge(n,at,nm){
    cont.innerHTML='<div class="t7-cert">'+
      '<div class="t7-cert-top"></div>'+
      '<div class="t7-cert-bottom"></div>'+
      '<div class="t7-cert-brand">T7 Academy Zertifikat</div>'+
      '<div class="t7-cert-line"></div>'+
      '<div class="t7-cert-star-block">'+
        '<div class="t7-cert-num">'+n+'</div>'+
        '<div class="t7-cert-stars">'+starsHtml(n)+'</div>'+
      '</div>'+
      '<div class="t7-cert-line"></div>'+
      (nm?'<div class="t7-cert-name">'+nm+'</div>':'')+
      '<div class="t7-cert-official">Zertifiziert von <strong>T7 Academy Expert</strong>'+(at?' \u00b7 '+fmtDate(at):'')+'</div>'+
    '</div>';
  }
  function fetchBadge(email){
    fetch(T7_SB_URL+'/rest/v1/certifications?player_email=eq.'+encodeURIComponent(email)+'&select=stars,awarded_at,player_name&order=stars.desc&limit=1',{headers:{apikey:T7_SB_KEY,'Authorization':'Bearer '+T7_SB_KEY}})
    .then(function(r){return r.json();}).then(function(rows){
      if(rows&&rows.length&&rows[0].stars)showBadge(rows[0].stars,rows[0].awarded_at,rows[0].player_name);
      else cont.innerHTML='<div class="t7f-empty">Noch kein Zertifikat.</div>';
    }).catch(function(){cont.innerHTML='<div class="t7f-empty">Fehler beim Laden.</div>';});
  }
  T7Identity.resolve(function(email){if(email)fetchBadge(email);else cont.innerHTML='<div class="t7f-empty">Kein Spieler erkannt.</div>';});
  window.addEventListener('t7xpupdate',function(){var id=T7Identity.get();if(id&&id.email)fetchBadge(id.email);});
}

/* === MOBILE BOTTOM SHEET (FAB + Fortschritt/Rangliste/Zertifikat) === */
function T7MobileSheet(){
  if(document.getElementById('t7-fab'))return; // already injected
  var sheetHTML=
    '<button id="t7-fab" type="button">'+
      '<span id="t7-fab-stars" style="display:none">\u2b50<span id="t7-fab-stars-num"></span></span>'+
      '<span id="t7-fab-stars-sep" style="display:none;opacity:.5"> | </span>'+
      '<span>\u26a1</span>'+
      '<span id="t7-fab-xp">0 XP</span>'+
      '<span style="opacity:.5"> | </span>'+
      '<span id="t7-fab-streak">0 Wochen</span>'+
    '</button>'+
    '<div id="t7-sheet-overlay"></div>'+
    '<div id="t7-sheet">'+
      '<div class="t7-sheet-handle"></div>'+
      '<div class="t7-sheet-header">'+
        '<div class="t7-sheet-title" id="t7-sheet-title">Mein Fortschritt</div>'+
        '<button class="t7-sheet-close" id="t7-sheet-close" type="button">\u2715</button>'+
      '</div>'+
      '<div class="t7-sheet-tabs">'+
        '<button class="t7-sheet-tab active" id="t7-tab-fort" type="button">\ud83d\udcca Fortschritt</button>'+
        '<button class="t7-sheet-tab" id="t7-tab-rang" type="button">\ud83c\udfc6 Rangliste</button>'+
        '<button class="t7-sheet-tab" id="t7-tab-cert" type="button">\u2b50 Zertifikat</button>'+
      '</div>'+
      '<div class="t7-sheet-content" id="t7-sheet-content"><div class="t7m-loading">Lade\u2026</div></div>'+
    '</div>';
  var wrap=document.createElement('div');wrap.innerHTML=sheetHTML;
  while(wrap.firstChild)document.body.appendChild(wrap.firstChild);

  var st={open:false,tab:'fort',email:null,name:'Spieler',totalXP:0,weekXP:0,streak:0,joinedAt:null,joinedWeeks:0,stars:0,starsAt:null,players:[],joinMap:{},fortLoaded:false,rangLoaded:false,certLoaded:false};
  function $(id){return document.getElementById(id);}
  function getWeekKey(d){var x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));var day=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-day);var ys=new Date(Date.UTC(x.getUTCFullYear(),0,1));return x.getUTCFullYear()+'-W'+Math.ceil((((x-ys)/86400000)+1)/7);}
  function calcStreak(att){var wk={};(att||[]).forEach(function(a){var ts=typeof a.attempted_at==='number'?a.attempted_at:parseInt(a.attempted_at)||0;if(ts)wk[getWeekKey(new Date(ts))]=true;});var now=new Date(),s=0;for(var i=0;i<52;i++){var k=getWeekKey(new Date(now-i*7*86400000));if(wk[k])s++;else if(i>0)break;}return s;}
  function calcWeekXP(att){var now=new Date(),sw=new Date(now);sw.setHours(0,0,0,0);sw.setDate(now.getDate()-((now.getDay()+6)%7));var t0=sw.getTime(),xp=0;(att||[]).forEach(function(a){var ts=typeof a.attempted_at==='number'?a.attempted_at:parseInt(a.attempted_at)||0;if(ts>=t0)xp+=Number(a.xp||0);});return xp;}
  function ini(n){if(!n)return'?';return n.split(/\s+/).map(function(w){return w[0]||'';}).join('').slice(0,2).toUpperCase();}

  function loadFort(){
    Promise.all([
      fetch(T7_SB_URL+'/rest/v1/players?player_email=eq.'+encodeURIComponent(st.email)+'&select=total_xp',{headers:{apikey:T7_SB_KEY,'Authorization':'Bearer '+T7_SB_KEY}}).then(function(r){return r.json();}).catch(function(){return[];}),
      fetch(T7_SB_URL+'/rest/v1/attempts?player_email=eq.'+encodeURIComponent(st.email)+'&select=attempted_at,xp&order=attempted_at.asc',{headers:{apikey:T7_SB_KEY,'Authorization':'Bearer '+T7_SB_KEY}}).then(function(r){return r.json();}).catch(function(){return[];}),
      fetch(T7_SB_URL+'/rest/v1/members?email=eq.'+encodeURIComponent(st.email)+'&select=bm_joined_at&limit=1',{headers:{apikey:T7_SB_KEY,'Authorization':'Bearer '+T7_SB_KEY}}).then(function(r){return r.json();}).catch(function(){return[];})
    ]).then(function(res){
      st.totalXP=res[0]&&res[0].length?Number(res[0][0].total_xp||0):0;
      st.weekXP=calcWeekXP(res[1]);
      st.streak=calcStreak(res[1]);
      st.joinedAt=res[2]&&res[2].length?res[2][0].bm_joined_at||null:null;
      st.joinedWeeks=st.joinedAt?Math.floor((Date.now()-st.joinedAt)/(7*86400000)):0;
      st.fortLoaded=true;updateFAB();
      if(st.open&&st.tab==='fort')$('t7-sheet-content').innerHTML=renderFort();
    });
  }
  function loadRang(){
    Promise.all([
      fetch(T7_SB_URL+'/rest/v1/players?select=player_name,total_xp&order=total_xp.desc&limit=20',{headers:{apikey:T7_SB_KEY,'Authorization':'Bearer '+T7_SB_KEY}}).then(function(r){return r.json();}).catch(function(){return[];}),
      fetch(T7_SB_URL+'/rest/v1/members?select=name,bm_joined_at&limit=200',{headers:{apikey:T7_SB_KEY,'Authorization':'Bearer '+T7_SB_KEY}}).then(function(r){return r.json();}).catch(function(){return[];})
    ]).then(function(res){
      var jm={};(res[1]||[]).forEach(function(m){if(m.name&&m.bm_joined_at)jm[m.name]=m.bm_joined_at;});
      st.joinMap=jm;st.players=(res[0]||[]).map(function(p){return{name:p.player_name||'Unbekannt',xp:Number(p.total_xp||0)};});
      st.rangLoaded=true;
      if(st.open&&st.tab==='rang')$('t7-sheet-content').innerHTML=renderRang('xp');
    });
  }
  function loadCert(){
    fetch(T7_SB_URL+'/rest/v1/certifications?player_email=eq.'+encodeURIComponent(st.email)+'&select=stars,awarded_at,player_name&order=stars.desc&limit=1',{headers:{apikey:T7_SB_KEY,'Authorization':'Bearer '+T7_SB_KEY}}).then(function(r){return r.json();}).then(function(rows){
      if(rows&&rows.length&&rows[0].stars){st.stars=rows[0].stars;st.starsAt=rows[0].awarded_at;}
      st.certLoaded=true;updateFAB();
      if(st.open&&st.tab==='cert')$('t7-sheet-content').innerHTML=renderCert();
    }).catch(function(){st.certLoaded=true;if(st.open&&st.tab==='cert')$('t7-sheet-content').innerHTML='<div class="t7m-empty">Fehler beim Laden.</div>';});
  }
  function updateFAB(){
    $('t7-fab-xp').textContent=st.totalXP.toLocaleString('de-AT')+' XP';
    $('t7-fab-streak').textContent=st.joinedWeeks+' Woche'+(st.joinedWeeks===1?'':'n');
    if(st.stars){$('t7-fab-stars-num').textContent=st.stars;$('t7-fab-stars').style.display='inline';$('t7-fab-stars-sep').style.display='inline';}
  }
  function renderFort(){
    if(!st.fortLoaded)return '<div class="t7m-loading">Lade\u2026</div>';
    var days='';
    for(var i=0;i<8;i++)days+='<div class="t7f-streak-day'+(i<st.streak?' on':'')+'"></div>';
    return '<div class="t7f-stat-row">'+
      '<div class="t7f-stat-card"><div class="t7f-stat-num">'+st.totalXP.toLocaleString('de-AT')+'</div><div class="t7f-stat-label">Gesamt XP</div></div>'+
      '<div class="t7f-stat-card"><div class="t7f-stat-num">+'+st.weekXP+'</div><div class="t7f-stat-label">Diese Woche</div></div>'+
    '</div>'+
    '<div class="t7f-streak"><div class="t7f-streak-val">'+st.streak+' Woche'+(st.streak===1?'':'n')+' Streak</div><div class="t7f-streak-days">'+days+'</div></div>';
  }
  function renderRang(mode){
    if(!st.rangLoaded)return '<div class="t7m-loading">Lade\u2026</div>';
    var isW=(mode==='weeks');
    var items=st.players.map(function(p){var jt=st.joinMap[p.name]||null;return{name:p.name,xp:p.xp,weeks:jt?Math.floor((Date.now()-jt)/(7*86400000)):0};});
    items.sort(function(a,b){return isW?b.weeks-a.weeks:b.xp-a.xp;});
    var tabs='<div class="t7m-rl-tabs"><button class="t7m-rl-tab'+(isW?'':' active')+'" data-mode="xp" type="button">\u26a1 XP</button><button class="t7m-rl-tab'+(isW?' active':'')+'" data-mode="weeks" type="button">\ud83d\udcc5 Wochen</button></div>';
    var med=['\ud83e\udd47','\ud83e\udd48','\ud83e\udd49'];
    var firstName=(st.name||'').split(' ')[0];
    var rows=items.map(function(p,i){
      var r=i+1,isMe=firstName&&p.name.split(' ')[0]===firstName;
      var val=isW?p.weeks+' Woche'+(p.weeks===1?'':'n'):p.xp.toLocaleString('de-AT')+' XP';
      var posCls=r===1?' gold':r===2?' silver':r===3?' bronze':'';
      return '<div class="t7m-rank'+(isMe?' me':'')+'"><div class="t7m-rank-pos'+posCls+'">'+(r<=3?med[r-1]:r)+'</div><div class="t7m-rank-av'+(isMe?' me':'')+'">'+ini(p.name)+'</div><div class="t7m-rank-name">'+p.name+'</div><div class="t7m-rank-val">'+val+'</div></div>';
    }).join('');
    return tabs+'<div>'+rows+'</div>';
  }
  function renderCert(){
    if(!st.certLoaded)return '<div class="t7m-loading">Lade\u2026</div>';
    if(!st.stars)return '<div class="t7m-empty">Noch kein Zertifikat. \u00dcbe weiter und reiche dein Final-Video ein!</div>';
    function starsHtml(n){if(n<=3)return'\u2b50'.repeat(n);var h=Math.ceil(n/2);return'\u2b50'.repeat(h)+'<br>'+'\u2b50'.repeat(n-h);}
    function fmtDate(ts){if(!ts)return'';var d=new Date(typeof ts==='number'?ts:parseInt(ts));return d.toLocaleDateString('de-AT',{day:'2-digit',month:'long',year:'numeric'});}
    return '<div class="t7-cert">'+
      '<div class="t7-cert-top"></div><div class="t7-cert-bottom"></div>'+
      '<div class="t7-cert-brand">T7 Academy Zertifikat</div>'+
      '<div class="t7-cert-line"></div>'+
      '<div class="t7-cert-star-block">'+
        '<div class="t7-cert-num">'+st.stars+'</div>'+
        '<div class="t7-cert-stars">'+starsHtml(st.stars)+'</div>'+
      '</div>'+
      '<div class="t7-cert-line"></div>'+
      '<div class="t7-cert-name">'+(st.name||'Spieler')+'</div>'+
      '<div class="t7-cert-official">Zertifiziert von <strong>T7 Academy Expert</strong>'+(st.starsAt?' \u00b7 '+fmtDate(st.starsAt):'')+'</div>'+
    '</div>';
  }

  function openSheet(){st.open=true;$('t7-sheet').classList.add('open');$('t7-sheet-overlay').classList.add('open');renderActive();}
  function closeSheet(){st.open=false;$('t7-sheet').classList.remove('open');$('t7-sheet-overlay').classList.remove('open');}
  function switchTab(t){
    st.tab=t;
    $('t7-tab-fort').className='t7-sheet-tab'+(t==='fort'?' active':'');
    $('t7-tab-rang').className='t7-sheet-tab'+(t==='rang'?' active':'');
    $('t7-tab-cert').className='t7-sheet-tab'+(t==='cert'?' active':'');
    $('t7-sheet-title').textContent=t==='fort'?'Mein Fortschritt':t==='rang'?'Rangliste':'Mein Zertifikat';
    renderActive();
  }
  function renderActive(){
    if(st.tab==='fort'){if(!st.fortLoaded&&st.email)loadFort();$('t7-sheet-content').innerHTML=renderFort();}
    else if(st.tab==='rang'){if(!st.rangLoaded)loadRang();$('t7-sheet-content').innerHTML=renderRang('xp');}
    else{if(!st.certLoaded&&st.email)loadCert();$('t7-sheet-content').innerHTML=renderCert();}
  }

  $('t7-fab').onclick=openSheet;
  $('t7-sheet-close').onclick=closeSheet;
  $('t7-sheet-overlay').onclick=closeSheet;
  $('t7-tab-fort').onclick=function(){switchTab('fort');};
  $('t7-tab-rang').onclick=function(){switchTab('rang');};
  $('t7-tab-cert').onclick=function(){switchTab('cert');};
  $('t7-sheet-content').addEventListener('click',function(e){var t=e.target;if(t&&t.classList&&t.classList.contains('t7m-rl-tab')){$('t7-sheet-content').innerHTML=renderRang(t.dataset.mode);}});
  var ts=0,sheet=$('t7-sheet');
  sheet.addEventListener('touchstart',function(e){ts=e.touches[0].clientY;},{passive:true});
  sheet.addEventListener('touchend',function(e){if(e.changedTouches[0].clientY-ts>80)closeSheet();},{passive:true});

  T7Identity.resolve(function(email,name){
    if(!email)return;
    st.email=email;st.name=name||(email.split('@')[0]);
    loadFort();loadCert();
  });
  window.addEventListener('t7xpupdate',function(){if(st.email){st.fortLoaded=false;loadFort();if(st.rangLoaded){st.rangLoaded=false;loadRang();}}});
}

/* === PUBLIC API === */
var T7={
  challenge:function(cfg){cfg.containerId=cfg.containerId||'ch-container';new T7Challenge(cfg);},
  certificate:function(cfg){cfg.containerId=cfg.containerId||'cert-container';new T7Cert(cfg);}
};
