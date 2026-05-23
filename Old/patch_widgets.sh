#!/bin/bash
# Patches all widget index.html files with the JWT identity fix

WIDGETS_DIR="$HOME/Documents/GitHub/t7academy-widgets/widgets"

OLD_GETBMID='function getBMId(){
  var wins=[window];
  try{if(window.parent&&window.parent!==window)wins.push(window.parent);}catch(e){}
  try{if(window.top&&window.top!==window&&window.top!==window.parent)wins.push(window.top);}catch(e){}
  for(var wi=0;wi<wins.length;wi++){try{var w=wins[wi],bm=w.__BM_DATA__;if(bm&&bm.intercom&&bm.intercom.bootProps){var bp=bm.intercom.bootProps;if(bp.email)return bp.email;if(bp.userId)return bp.userId;}if(w.intercomSettings&&w.intercomSettings.email)return w.intercomSettings.email;}catch(e){}}
  return null;
}'

NEW_GETBMID='function getBMId(){
  var wins=[window];
  try{if(window.parent&&window.parent!==window)wins.push(window.parent);}catch(e){}
  try{if(window.top&&window.top!==window&&window.top!==window.parent)wins.push(window.top);}catch(e){}
  for(var wi=0;wi<wins.length;wi++){
    try{
      var w=wins[wi],bm=w.__BM_DATA__;
      if(bm&&bm.intercom&&bm.intercom.bootProps){
        var bp=bm.intercom.bootProps;
        if(bp.email)return bp.email;
        if(bp.userId)return bp.userId;
      }
      if(w.intercomSettings&&w.intercomSettings.email)return w.intercomSettings.email;
      if(bm&&bm.accessToken){
        try{
          var payload=JSON.parse(atob(bm.accessToken.split('"'"'.'"'"')[1]));
          if(payload&&payload.id&&payload.tokenType==='"'"'USER'"'"')return '"'"'__BMID__:'"'"'+payload.id;
        }catch(e){}
      }
    }catch(e){}
  }
  return null;
}
function lookupEmailByBMIdDirect(bmId,cb){
  fetch(SB_URL+'"'"'/rest/v1/members?bm_id=eq.'"'"'+encodeURIComponent(bmId)+'"'"'&select=email,name&limit=1'"'"',{
    headers:{'"'"'apikey'"'"':SB_KEY,'"'"'Authorization'"'"':'"'"'Bearer '"'"'+SB_KEY}
  }).then(function(r){return r.json();})
  .then(function(rows){
    if(rows&&rows.length&&rows[0].email)cb(rows[0].email,rows[0].name);
    else cb(null,null);
  }).catch(function(){cb(null,null);});
}'

OLD_TRYINIT='function tryInit(){
  /* Step 1: BM __BM_DATA__ (admins) */
  var bmEmail=typeof getBMId==='"'"'function'"'"'?getBMId():null;
  if(bmEmail&&bmEmail!=='"'"'unbekannt'"'"'){saveIdentity(bmEmail);initFromEmail(bmEmail);return true;}
  /* Step 2: Saved email in localStorage */
  var savedEmail=loadIdentity();
  if(savedEmail){initFromEmail(savedEmail);return true;}
  /* Step 3: BM member ID from page links */
  lookupByBMId(function(email,name){
    if(email&&!state.playerInited){saveIdentity(email);initFromEmail(email);}
  });
  return false;
}'

NEW_TRYINIT='function tryInit(){
  /* Step 1: BM __BM_DATA__ email (admins/intercom) or JWT token BM ID */
  var bmResult=typeof getBMId==='"'"'function'"'"'?getBMId():null;
  if(bmResult&&bmResult!=='"'"'unbekannt'"'"'){
    if(bmResult.indexOf('"'"'__BMID__:'"'"')===0){
      var bmId=bmResult.replace('"'"'__BMID__:'"'"','"'"''"'"');
      var savedEmail=loadIdentity();
      if(savedEmail){initFromEmail(savedEmail);return true;}
      lookupEmailByBMIdDirect(bmId,function(email,name){
        if(email&&!state.playerInited){saveIdentity(email);initFromEmail(email);}
      });
      return false;
    }
    saveIdentity(bmResult);initFromEmail(bmResult);return true;
  }
  /* Step 2: Saved email in localStorage */
  var savedEmail=loadIdentity();
  if(savedEmail){initFromEmail(savedEmail);return true;}
  /* Step 3: BM member ID from page links */
  lookupByBMId(function(email,name){
    if(email&&!state.playerInited){saveIdentity(email);initFromEmail(email);}
  });
  return false;
}'

patched=0
skipped=0

for f in "$WIDGETS_DIR"/*/index.html; do
  if grep -q '__BMID__' "$f"; then
    echo "⏭️  Already patched: $f"
    ((skipped++))
    continue
  fi
  if grep -q 'function getBMId' "$f"; then
    python3 - "$f" "$NEW_GETBMID" "$NEW_TRYINIT" << 'PYEOF'
import sys, re

filepath = sys.argv[1]
new_getbmid = sys.argv[2]
new_tryinit = sys.argv[3]

with open(filepath, 'r') as file:
    content = file.read()

# Replace getBMId function
old_getbmid_pattern = r'function getBMId\(\)\{[^}]+var wins=\[window\];.*?return null;\n\}'
content = re.sub(old_getbmid_pattern, new_getbmid, content, flags=re.DOTALL)

# Replace tryInit function  
old_tryinit_pattern = r'function tryInit\(\)\{.*?return false;\n\}'
content = re.sub(old_tryinit_pattern, new_tryinit, content, flags=re.DOTALL)

with open(filepath, 'w') as file:
    file.write(content)

print(f"✅ Patched: {filepath}")
PYEOF
    ((patched++))
  else
    echo "⚠️  No getBMId found: $f"
    ((skipped++))
  fi
done

echo ""
echo "Done! Patched: $patched, Skipped: $skipped"
