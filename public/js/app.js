// Pattern Book: UI, state and the calls to this site's API.
import {ROLES,STAGES,$,esc,fstack,ensureFonts,fmtDate,normalize,lint,siteDoc,specimenDoc,tokensJson,specimenSvg} from "./core.js";
import {buildPrompt} from "./prompt.js";

const MAX_PHOTOS=6;
const ls=k=>{try{return localStorage.getItem(k)||""}catch{return ""}};
const lsSet=(k,v)=>{try{v?localStorage.setItem(k,v):localStorage.removeItem(k)}catch{}};
const S={view:"library",entries:[],current:null,theme:"a",tab:"site",vp:"fit",files:[],anchor:0,brief:"",revise:"",busy:false,stage:-1,thinking:false,err:"",note:"",
  dbState:"loading",dbErr:"",delArm:false,name:ls("pb-name"),pass:ls("pb-pass"),cfg:{passcodeRequired:false},urlDraft:"",urlBusy:false,urlErr:""};
let ctl=null;

/* ---------- API ---------- */
const ERR={passcode:"That passcode didn't work. Check it and try again.",rate_limited:"This site has reached its limit for now. Try again later.",too_large:"Those photos are too large together. Use fewer or smaller ones.",
  network:"Couldn't reach the server. Check your connection and try again.",invalid_json:"The answer didn't come back as a complete system. Try again, or with fewer photos.",cancelled:"Stopped.",truncated:"The answer ran out of room before it finished. Try again."};
const errText=e=>ERR[e?.code]||e?.message||"Something went wrong. Try again.";
async function api(path,opts={}){let r;
  try{r=await fetch(path,{...opts,headers:{"content-type":"application/json",...(S.pass?{"x-passcode":S.pass}:{})}})}
  catch(e){if(e?.name==="AbortError")throw {code:"cancelled"};throw {code:"network"}}
  if(!r.ok){let m="";try{m=(await r.json()).error||""}catch{}
    throw {code:r.status===401?"passcode":r.status===429?"rate_limited":r.status===413?"too_large":"server",message:m||`The server answered ${r.status}.`}}
  return r.status===204?null:r.json()}
function parseJson(text){const t=text.trim();try{return JSON.parse(t)}catch{}
  const f=t.match(/```(?:json)?\s*([\s\S]*?)```/);if(f){try{return JSON.parse(f[1])}catch{}}
  const a=t.indexOf("{"),b=t.lastIndexOf("}");if(a>=0&&b>a){try{return JSON.parse(t.slice(a,b+1))}catch{}}
  throw {code:"invalid_json"}}
async function claude(body,{signal,onText,onThinking}={}){let r;
  try{r=await fetch("/api/claude",{method:"POST",signal,headers:{"content-type":"application/json",...(S.pass?{"x-passcode":S.pass}:{})},body:JSON.stringify(body)})}
  catch(e){throw {code:e?.name==="AbortError"?"cancelled":"network"}}
  if(!r.ok){let m="";try{m=(await r.json()).error||""}catch{}throw {code:r.status===401?"passcode":r.status===429?"rate_limited":r.status===413?"too_large":"server",message:m}}
  const rd=r.body.getReader(),dec=new TextDecoder();let buf="",text="",stop="";
  try{for(;;){const {value,done}=await rd.read();if(done)break;buf+=dec.decode(value,{stream:true});let i;
    while((i=buf.indexOf("\n\n"))>=0){const ev=buf.slice(0,i);buf=buf.slice(i+2);const line=ev.split("\n").find(l=>l.startsWith("data:"));if(!line)continue;let d;try{d=JSON.parse(line.slice(5))}catch{continue}
      if(d.type==="content_block_start"&&d.content_block?.type==="thinking")onThinking?.();
      else if(d.type==="content_block_delta"&&d.delta?.type==="text_delta"){text+=d.delta.text;onText?.({text})}
      else if(d.type==="message_delta")stop=d.delta?.stop_reason||stop;
      else if(d.type==="error")throw {code:"server",message:"Claude API: "+(d.error?.message||"stream error")}}}}
  catch(e){if(e?.name==="AbortError")throw {code:"cancelled"};throw e}
  if(stop==="max_tokens")throw {code:"truncated"};
  return parseJson(text)}
async function load(){try{const r=await api("/api/systems");S.entries=(r.systems||[]).map(v=>({...v,thumbs:(v.thumbs||[]).filter(t=>typeof t==="string"&&t.startsWith("data:image/jpeg;base64,")),spec:normalize(v.spec)}));S.dbState="ok";
    if(S.current?.id){const c=S.entries.find(e=>e.id===S.current.id);if(c)S.current=c}}
  catch(e){S.dbState="none";S.dbErr=errText(e)}
  if(!(S.busy&&S.view==="new"))render()}

/* ---------- images ---------- */
async function scaled(file,side,type,q){const bmp=await createImageBitmap(file);const k=Math.min(1,side/Math.max(bmp.width,bmp.height));const cv=document.createElement("canvas");cv.width=Math.round(bmp.width*k);cv.height=Math.round(bmp.height*k);cv.getContext("2d").drawImage(bmp,0,0,cv.width,cv.height);return cv.toDataURL(type,q)}
async function forClaude(file){const url=await scaled(file,1568,"image/jpeg",.86);return {media_type:"image/jpeg",data:url.split(",")[1]}}
async function addFromUrl(){const raw=S.urlDraft.trim();if(!raw||S.urlBusy||S.files.length>=MAX_PHOTOS)return;
  let u;try{u=new URL(raw)}catch{S.urlErr="That doesn't look like a URL.";render();return}
  S.urlBusy=true;S.urlErr="";render();
  try{const r=await fetch("/api/fetch-image?url="+encodeURIComponent(u.href),{headers:S.pass?{"x-passcode":S.pass}:{}});
    if(!r.ok){let m="";try{m=(await r.json()).error||""}catch{}throw new Error(r.status===401?"That passcode didn't work.":m||"Couldn't fetch that image.")}
    const blob=await r.blob();if(!/^image\/(jpeg|png|webp)$/.test(blob.type))throw new Error("That URL isn't a JPEG, PNG or WebP image.");
    S.files.push({file:blob,url:URL.createObjectURL(blob)});S.urlDraft=""}
  catch(e){S.urlErr=e.message||"Couldn't fetch that image."}
  finally{S.urlBusy=false;render()}}

/* ---------- views ---------- */
function coverHtml(e){const sp=e.spec;const c=sp.colors;const vars=ROLES.map(r=>`--${r}:${c[r].a}`).join(";");
  return `<div class="cover" style="${vars};background:${c.ground.a}"><div class="cv-blocks"><i class="shp-${e.id}" style="background:${c["fill-1"].a}"></i><i class="shp-${e.id}" style="background:${c.action.a}"></i><i class="shp-${e.id}" style="background:${c["fill-2"].a}"></i></div><span class="cv-name" style="color:${c.ink.a};font-family:${esc(fstack(sp.type.display.family,sp.type.display.generic))};font-weight:${sp.type.display_weight};text-transform:${sp.type.display_case}">${esc(sp.name)}</span></div>`}
function whoWhen(e){return [e.author?"by "+esc(e.author):"",fmtDate(e.createdAt),e.rev>1?`rev ${e.rev}`:""].filter(Boolean).join(", ")}
function vLibrary(){let body;
  if(S.dbState==="loading")body=`<p class="muted pad">Opening the library…</p>`;
  else if(S.dbState==="none")body=`<div class="empty"><h2>The library didn't load.</h2><p>${esc(S.dbErr)}</p><button class="t-btn ghost" data-act="reload">Try again</button></div>`;
  else if(!S.entries.length)body=`<div class="empty"><h2>No systems yet.</h2><p>Start with one photo or a set of them: a place, a material, a product, a working floor. Each run is kept here.</p><button class="t-btn" data-act="new">Make the first one</button></div>`;
  else body=`<div class="lib">${S.entries.map(e=>`<button class="card" data-act="open" data-id="${esc(e.id)}">${coverHtml(e)}<span class="meta"><span class="tl">${esc(e.spec.tagline)}</span><span class="thumbs">${(e.thumbs||[]).slice(0,6).map(t=>`<img src="${t}" alt="">`).join("")}</span><span class="muted sm">${whoWhen(e)}</span></span></button>`).join("")}</div>`;
  return `<header class="bar"><div><h1 class="t-title">Pattern Book</h1><p class="muted">Photos in, design systems out.</p></div><button class="t-btn" data-act="new">New system</button></header>${body}`}
function vNew(){const th=S.files.map((f,i)=>`<div class="ph ${S.anchor===i+1?"is-anchor":""}"><button class="ph-img" data-act="anchor" data-i="${i}" aria-pressed="${S.anchor===i+1}" aria-label="Photo ${i+1}${S.anchor===i+1?", anchor":""}. Tap to ${S.anchor===i+1?"unset":"set as"} anchor"><img src="${f.url}" alt=""></button><span class="ph-cap"><span>${i+1}${S.anchor===i+1?" · Anchor":""}</span>${S.busy?"":`<button class="x" data-act="rm" data-i="${i}" aria-label="Remove photo ${i+1}">Remove</button>`}</span></div>`).join("");
  const pct=Math.round(((S.stage<0?0:S.stage+1)/STAGES.length)*100)||6;
  const prog=S.busy?`<div class="prog" aria-live="polite"><p class="prog-head">Turning your photos into a unique design system.</p><div class="prog-bar"><i style="width:${pct}%"></i></div><p class="muted sm" id="pmsg">${S.stage>=0?"Writing the system. A full run takes one to three minutes.":S.thinking?"Claude is studying the photos. This part is silent and can take a minute or two.":"Sending the photos."}</p><button class="t-btn ghost" data-act="stop">Stop</button></div>`:"";
  const needPass=S.cfg.passcodeRequired;
  return `<header class="bar"><button class="back" data-act="lib">Library</button></header>
<h1 class="t-title">New system</h1>
<div class="step"><h2 class="t-h2">Photos</h2><p class="muted">One photo works. Several work better when they share a subject: a site, a product line, an operation. Up to ${MAX_PHOTOS}. Tap a photo to make it the anchor, or leave it to Claude.</p>
<div class="phs">${th}${S.files.length<MAX_PHOTOS&&!S.busy?`<label class="drop"><input type="file" accept="image/jpeg,image/png,image/webp" multiple data-act="files"><span>Add photos</span></label>`:""}</div>
${S.files.length<MAX_PHOTOS&&!S.busy?`<div class="urlrow"><label class="sr" for="imgurl">Image URL</label><input id="imgurl" type="url" placeholder="Or paste an image URL, e.g. from a Pinterest pin" value="${esc(S.urlDraft)}" ${S.urlBusy?"disabled":""}><button class="t-btn ghost" data-act="addurl" ${S.urlBusy?"disabled":""}>${S.urlBusy?"Fetching…":"Add"}</button></div>${S.urlErr?`<p class="warn sm">${esc(S.urlErr)}</p>`:""}`:""}</div>
<div class="step"><h2 class="t-h2">Brief <span class="muted">(optional)</span></h2><label class="sr" for="brief">Brief</label><textarea id="brief" rows="3" placeholder="What is it for, and who is it for? For example: a booking site for a Garden District house tour." ${S.busy?"disabled":""}>${esc(S.brief)}</textarea></div>
<div class="step fields"><div><label for="nm">Your name <span class="muted">(shown on the entry)</span></label><input id="nm" autocomplete="name" value="${esc(S.name)}" ${S.busy?"disabled":""}></div>
${needPass?`<div><label for="pw">Passcode</label><input id="pw" type="password" autocomplete="current-password" value="${esc(S.pass)}" ${S.busy?"disabled":""}></div>`:""}</div>
${S.err?`<p class="warn" role="alert">${esc(S.err)}</p>`:""}
${prog||`<button class="t-btn" data-act="gen" ${!S.files.length||(needPass&&!S.pass)?"disabled":""}>Make the system</button>`}`}
function vEntry(){const e=S.current;const sp=e.spec;
  const tabs=[["site","Site"],["spec","Specimen"],["method","Method"],["export","Export"]].map(([k,l])=>`<button role="tab" aria-selected="${S.tab===k}" class="tab" data-act="tab" data-k="${k}">${l}</button>`).join("");
  const themes=sp.themes.map(t=>`<button class="seg ${S.theme===t.id?"on":""}" aria-pressed="${S.theme===t.id}" data-act="theme" data-k="${t.id}">${esc(t.name)}</button>`).join("");
  let panel="";
  if(S.tab==="site")panel=`<div class="tools"><div class="segs" aria-label="Preview width"><button class="seg ${S.vp==="fit"?"on":""}" aria-pressed="${S.vp==="fit"}" data-act="vp" data-k="fit">Fit</button><button class="seg ${S.vp==="desk"?"on":""}" aria-pressed="${S.vp==="desk"}" data-act="vp" data-k="desk">Desktop</button></div></div><div class="frame" id="fw"><iframe id="fr" title="Sample site for ${esc(sp.name)}"></iframe></div>${vRevise()}`;
  else if(S.tab==="spec")panel=`<div class="frame" id="fw"><iframe id="fr" title="Specimen for ${esc(sp.name)}"></iframe></div>`;
  else if(S.tab==="method")panel=vMethod(e);else panel=vExport(e);
  return `<header class="bar"><button class="back" data-act="lib">Library</button><div class="segs" aria-label="Theme">${themes}</div></header>
<div class="ent-h"><h1 class="ent-name" style="font-family:${esc(fstack(sp.type.display.family,sp.type.display.generic))};font-weight:${sp.type.display_weight};text-transform:${sp.type.display_case}">${esc(sp.name)}</h1><p>${esc(sp.tagline)}</p><p class="muted sm">${whoWhen(e)}${e.id?"":" · not saved"}</p></div>
<div class="tabs" role="tablist">${tabs}</div>${S.note?`<p class="ok-note" role="status">${esc(S.note)}</p>`:""}<div class="panel-w">${panel}</div>`}
function vRevise(){const needPass=S.cfg.passcodeRequired;
  return `<div class="revise"><h2 class="t-h2">Revise</h2><p class="muted">Say what's off, the way you'd tell a designer. The system is rebuilt with everything else kept, and the previous version is saved.</p><label class="sr" for="rev">Feedback</label><textarea id="rev" rows="3" placeholder="The corner radius doesn't match the buttons. Borders feel like a template." ${S.busy?"disabled":""}>${esc(S.revise)}</textarea>
${needPass&&!S.pass?`<div class="fields" style="margin-bottom:14px"><div><label for="pw">Passcode</label><input id="pw" type="password" autocomplete="current-password" value=""></div></div>`:""}
${S.err?`<p class="warn" role="alert">${esc(S.err)}</p>`:""}
${S.busy?`<div class="prog"><p class="muted sm">Revising. This takes one to two minutes.</p><button class="t-btn ghost" data-act="stop">Stop</button></div>`:`<button class="t-btn" data-act="revise" ${S.revise.trim()?"":"disabled"}>Revise</button>`}</div>`}
function vMethod(e){const sp=e.spec;const L=lint(sp);
  const ph=sp.photos.map(p=>{const t=(e.thumbs||[])[p.n-1];return `<div class="mrow">${t?`<img src="${t}" alt="">`:`<span class="nothumb"></span>`}<div><b>Photo ${p.n}${p.role?` · ${esc(p.role)}`:""}${sp.anchor===p.n?" (anchor)":""}</b><p>${esc(p.desc)}</p>${p.note?`<p class="muted sm">${esc(p.note)}</p>`:""}</div></div>`}).join("");
  const a=sp.audit;
  return `<div class="method">
<section><h2 class="t-h2">Checks against the prompt</h2><ul class="checks">${L.map(x=>`<li class="${x.bad?"bad":"good"}">${esc(x.t)}</li>`).join("")}</ul></section>
<section><h2 class="t-h2">Photos</h2>${ph||`<p class="muted">No photo notes.</p>`}</section>
<section><h2 class="t-h2">Six words</h2><p class="words">${sp.words.map(esc).join(", ")}</p>
<dl class="faces">${["display","body","label"].map(k=>`<dt>${k}</dt><dd><b>${esc(sp.type[k].family||"fallback")}</b>${sp.type[k].word?` from “${esc(sp.type[k].word)}”`:""}. ${esc(sp.type[k].why)}</dd>`).join("")}</dl></section>
<section><h2 class="t-h2">Shape and line</h2><p><b>${esc(sp.shape.name)}</b>, from ${esc(sp.shape.source)}. ${esc(sp.shape.why)}</p><p><b>${esc(sp.line.name)}</b>, from ${esc(sp.line.source)}.</p></section>
${sp.rules.length?`<section><h2 class="t-h2">Rules</h2><ul class="rules">${sp.rules.map(r=>`<li>${esc(r)}</li>`).join("")}</ul></section>`:""}
<section><h2 class="t-h2">Audit</h2>${a.generic_description?`<p class="quote">“${esc(a.generic_description)}”</p><p class="muted sm">How a default tool's version would be described. What was true got changed:</p>`:""}
<ul class="changes">${a.changes.map(c=>`<li><span class="was">${esc(c.was)}</span><span class="now">${esc(c.now)}</span></li>`).join("")}</ul>
${a.industry_cliches.length?`<p><b>Industry clichés avoided:</b> ${a.industry_cliches.map(esc).join("; ")}.</p>`:""}
${a.interchangeable_check?`<p><b>Could other photos make this?</b> ${esc(a.interchangeable_check)}</p>`:""}
${a.dropped_photos.filter(d=>d.why).map(d=>`<p class="muted sm">Photo ${d.n} dropped: ${esc(d.why)}</p>`).join("")}</section>
${e.brief?`<section><h2 class="t-h2">Brief</h2><p>${esc(e.brief)}</p></section>`:""}
${e.id?`<section>${S.err?`<p class="warn" role="alert">${esc(S.err)}</p>`:""}<button class="t-btn danger" data-act="del">${S.delArm?"Tap again to delete for everyone":"Delete this system"}</button></section>`:""}</div>`}
function vExport(e){return `<div class="exports">
<div class="ex"><h2 class="t-h2">Figma variables</h2><p>Colour for both themes, type, spacing and the motif as a tokens JSON file. Load it with the Tokens Studio plugin (Load from file), which turns the two themes into variable modes.</p><button class="t-btn" data-act="x-tokens">Download tokens JSON</button></div>
<div class="ex"><h2 class="t-h2">Figma specimen board</h2><p>An SVG of the palette, type, shape, line and spacing. Drag it onto a Figma canvas and it arrives as editable vectors and text layers with the real font names.</p><button class="t-btn" data-act="x-svg">Download specimen SVG</button></div>
<div class="ex"><h2 class="t-h2">Sample site</h2><p>The sample site as one HTML file, in the ${esc(e.spec.themes[S.theme==="a"?0:1].name)} theme. Open it in a browser, or bring it into Figma with an HTML-to-Figma plugin such as html.to.design.</p><button class="t-btn" data-act="x-site">Download site HTML</button></div>
<div class="ex"><h2 class="t-h2">The prompt</h2><p>The method this tool runs, as plain text, to reuse anywhere.</p><button class="t-btn" data-act="x-prompt">Download prompt</button></div></div>`}

/* ---------- render ---------- */
function render(){const root=$("#app");const sel=document.activeElement?.id;
  if(S.view==="entry"&&!S.current)S.view="library";
  root.innerHTML=S.view==="new"?vNew():S.view==="entry"?vEntry():vLibrary();
  $("#dyn").textContent=S.entries.map(e=>`.shp-${e.id}{${e.spec.shape.large_css}}`).join("\n");
  ensureFonts(S.entries.map(e=>e.spec.type.display.family).concat(S.current?[S.current.spec.type.display.family]:[]));
  if(S.view==="entry"&&(S.tab==="site"||S.tab==="spec"))loadFrame();
  if(sel&&$("#"+sel)){const el=$("#"+sel);el.focus();try{if(el.value)el.setSelectionRange(el.value.length,el.value.length)}catch{}}}
function loadFrame(){const fr=$("#fr");if(!fr)return;const sp=S.current.spec;
  fr.srcdoc=S.tab==="spec"?specimenDoc(sp,S.theme):siteDoc(sp,S.theme);
  fr.onload=()=>{fit();try{fr.contentDocument.fonts.ready.then(fit)}catch{}setTimeout(fit,900)}}
function fit(){const fr=$("#fr"),fw=$("#fw");if(!fr||!fw)return;let h=900;try{h=fr.contentDocument.documentElement.scrollHeight}catch{}
  if(S.tab==="site"&&S.vp==="desk"){const s=Math.min(1,fw.clientWidth/1280);fr.style.width="1280px";fr.style.height=h+"px";fr.style.transform=`scale(${s})`;fr.style.transformOrigin="0 0";
    try{h=fr.contentDocument.documentElement.scrollHeight;fr.style.height=h+"px"}catch{}fw.style.height=Math.ceil(h*s)+"px"}
  else{fr.style.width="100%";fr.style.transform="";fr.style.height=h+"px";fw.style.height=""}}
addEventListener("resize",()=>{clearTimeout(fit.t);fit.t=setTimeout(fit,150)});
addEventListener("focus",()=>{if(S.view==="library"&&!S.busy)load()});

/* ---------- actions ---------- */
document.addEventListener("click",async ev=>{const a=ev.target.closest("[data-act]");if(!a||a.tagName==="INPUT")return;const act=a.dataset.act;
  if(act!=="del")S.delArm=false;
  if(act==="new"){S.view="new";S.err="";render();scrollTo(0,0)}
  else if(act==="lib"){if(S.busy)ctl?.abort();S.view="library";S.current=null;S.err="";S.note="";render();scrollTo(0,0);load()}
  else if(act==="reload"){S.dbState="loading";render();load()}
  else if(act==="open"){const e=S.entries.find(x=>x.id===a.dataset.id);if(e){S.current=e;S.view="entry";S.tab="site";S.theme="a";S.err="";S.note="";S.revise="";render();scrollTo(0,0)}}
  else if(act==="tab"){S.tab=a.dataset.k;S.note="";S.err="";render()}
  else if(act==="theme"){S.theme=a.dataset.k;render()}
  else if(act==="vp"){S.vp=a.dataset.k;render()}
  else if(act==="anchor"){if(S.busy)return;const i=+a.dataset.i+1;S.anchor=S.anchor===i?0:i;render()}
  else if(act==="rm"){const i=+a.dataset.i;URL.revokeObjectURL(S.files[i].url);S.files.splice(i,1);if(S.anchor===i+1)S.anchor=0;else if(S.anchor>i+1)S.anchor--;render()}
  else if(act==="gen")generate();
  else if(act==="revise")revise();
  else if(act==="stop")ctl?.abort();
  else if(act==="del")remove();
  else if(act==="addurl")addFromUrl();
  else if(act.startsWith("x-"))exportIt(act)});
document.addEventListener("input",ev=>{const t=ev.target;
  if(t.id==="brief")S.brief=t.value;
  else if(t.id==="nm"){S.name=t.value.slice(0,40);lsSet("pb-name",S.name.trim())}
  else if(t.id==="pw"){const had=!!S.pass;S.pass=t.value;lsSet("pb-pass",S.pass);if(had!==!!S.pass&&S.view==="new")render()}
  else if(t.id==="rev"){const had=!!S.revise.trim();S.revise=t.value;if(had!==!!S.revise.trim())render()}
  else if(t.id==="imgurl")S.urlDraft=t.value});
document.addEventListener("keydown",ev=>{if(ev.target.id==="imgurl"&&ev.key==="Enter"){ev.preventDefault();addFromUrl()}});
document.addEventListener("change",ev=>{if(ev.target.dataset?.act!=="files")return;
  for(const f of ev.target.files){if(S.files.length>=MAX_PHOTOS)break;if(!/^image\/(jpeg|png|webp)$/.test(f.type))continue;S.files.push({file:f,url:URL.createObjectURL(f)})}render()});

function setStage(text){let s=-1;STAGES.forEach(([k],i)=>{if(text.includes('"'+k+'"'))s=i});if(s===S.stage)return;S.stage=s;
  const bar=$(".prog-bar i");if(bar)bar.style.width=Math.round(((s+1)/STAGES.length)*100)+"%";const p=$("#pmsg");if(p)p.textContent="Writing the system. A full run takes one to three minutes."}
function onThinking(){if(S.thinking)return;S.thinking=true;const p=$("#pmsg");if(p&&S.stage<0)p.textContent="Claude is studying the photos. This part is silent and can take a minute or two."}
function authFail(e){if(e?.code==="passcode"){S.pass="";lsSet("pb-pass","")}}
async function generate(){if(S.busy||!S.files.length)return;S.busy=true;S.err="";S.stage=-1;S.thinking=false;render();ctl=new AbortController();
  try{const files=S.files.map(f=>f.file);const images=await Promise.all(files.map(forClaude));
    const raw=await claude({mode:"create",anchor:S.anchor,brief:S.brief.trim(),images},{signal:ctl.signal,onText:({text})=>setStage(text),onThinking});
    const spec=normalize(raw);let thumbs=[];
    for(const [side,q] of [[320,.72],[220,.6],[140,.5]]){thumbs=await Promise.all(files.map(f=>scaled(f,side,"image/jpeg",q).catch(()=>"")));if(thumbs.join("").length<220000)break}
    const brief=S.brief.trim();let id=null;
    try{const r=await api("/api/systems",{method:"POST",body:JSON.stringify({spec,thumbs,brief,author:S.name.trim()})});id=r.id}catch(e){authFail(e);S.note="Made, but not saved to the library. "+errText(e)}
    S.files.forEach(f=>URL.revokeObjectURL(f.url));S.files=[];S.anchor=0;S.brief="";
    S.current={id,name:spec.name,tagline:spec.tagline,createdAt:new Date().toISOString(),author:S.name.trim(),thumbs,spec,rev:1,brief};S.view="entry";S.tab="site";S.theme="a";scrollTo(0,0);load()}
  catch(e){authFail(e);S.err=errText(e)}
  finally{S.busy=false;render()}}
async function revise(){const e=S.current;if(S.busy||!S.revise.trim())return;S.busy=true;S.err="";render();ctl=new AbortController();
  try{const fb=S.revise.trim();const raw=await claude({mode:"revise",spec:e.spec,feedback:fb},{signal:ctl.signal});const spec=normalize(raw);let rev=(e.rev||1)+1;
    if(e.id){try{const r=await api("/api/systems/"+encodeURIComponent(e.id),{method:"PATCH",body:JSON.stringify({spec,feedback:fb})});rev=r.rev;S.note=`Revised and saved as rev ${rev}. The previous version is kept.`}catch(x){authFail(x);S.note="Revised here, but not saved. "+errText(x)}}
    S.current={...e,spec,name:spec.name,tagline:spec.tagline,rev};S.revise="";load()}
  catch(x){authFail(x);S.err=errText(x)}
  finally{S.busy=false;render()}}
async function remove(){if(!S.delArm){S.delArm=true;render();return}S.delArm=false;S.err="";
  try{await api("/api/systems/"+encodeURIComponent(S.current.id),{method:"DELETE"});S.view="library";S.current=null;await load()}
  catch(e){authFail(e);S.err=e.code==="passcode"?"Deleting needs the passcode. Enter it on the New system screen, then try again.":errText(e);render()}}
function download(filename,data,type){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000)}
function exportIt(act){const sp=S.current.spec;const slug=sp.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"system";
  if(act==="x-tokens")download(`${slug}.tokens.json`,tokensJson(sp),"application/json");
  else if(act==="x-svg")download(`${slug}-specimen.svg`,specimenSvg(sp),"image/svg+xml");
  else if(act==="x-site")download(`${slug}-site.html`,siteDoc(sp,S.theme),"text/html");
  else if(act==="x-prompt")download("pattern-book-prompt.txt",buildPrompt(1,0,"").replace(/^You are[^\n]*\n/,"You are a design lead extracting a brand design system from the attached photos, numbered in order.\n"),"text/plain")}

/* ---------- boot ---------- */
render();
fetch("/api/config").then(r=>r.ok?r.json():null).then(c=>{if(c){S.cfg=c;render()}}).catch(()=>{});
load();
