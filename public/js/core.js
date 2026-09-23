// Helpers, validation, the sample-site renderer and the exports.
/* ---------- constants ---------- */
const ROLES=["ground","surface","surface-2","ink","ink-muted","action","action-ink","accent","line","link","signal","success","fill-1","fill-2","fill-3","fill-4"];
const DEFAULT_HEX={"ground":["#f1f1ee","#17191b"],"surface":["#e2e3de","#23272a"],"surface-2":["#d2d4ce","#2e3337"],"ink":["#17191b","#eeeeea"],"ink-muted":["#575c60","#a7acb0"],"action":["#1f3fb8","#9fb2ff"],"action-ink":["#ffffff","#101320"],"accent":["#b8762a","#e0a15a"],"line":["#575c60","#a7acb0"],"link":["#1f3fb8","#9fb2ff"],"signal":["#a8302a","#ff8a80"],"success":["#2f6b3a","#8fd19b"],"fill-1":["#1f3fb8","#1f3fb8"],"fill-2":["#b8762a","#b8762a"],"fill-3":["#2f6b3a","#2f6b3a"],"fill-4":["#d2d4ce","#2e3337"]};
const BANNED_FONTS=["inter","roboto","open sans","lato","montserrat","poppins","geist","dm sans","manrope","plus jakarta sans","space grotesk","space mono","jetbrains mono","ibm plex sans","ibm plex mono","ibm plex serif","playfair display","fraunces","instrument serif","instrument sans","bricolage grotesque","syne","figtree","outfit","sora","work sans","lora","merriweather","nunito","raleway","source sans 3","noto sans","oswald","rubik","mulish"];
const STAGES=[["photos","Reading the photos"],["colors","Pulling colour from the pixels"],["type","Turning words into type"],["shape","Finding the one shape"],["line","Finding the one line"],["hero","Building the front page"],["site","Writing the sample site"],["audit","Auditing for defaults"]];
const PAIRS=[["ink","ground"],["ink","surface"],["ink-muted","ground"],["action-ink","action"],["link","ground"],["signal","ground"],["success","ground"]];

/* ---------- helpers ---------- */
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clampN=(v,lo,hi,d)=>{v=Number(v);return Number.isFinite(v)?Math.min(hi,Math.max(lo,v)):d};
const str=(v,n=400)=>String(v??"").slice(0,n);
function hex(v,d){if(typeof v!=="string")return d;v=v.trim().toLowerCase();if(/^#[0-9a-f]{3}$/.test(v))return "#"+v.slice(1).split("").map(c=>c+c).join("");if(/^#[0-9a-f]{6}([0-9a-f]{2})?$/.test(v))return v.slice(0,7);return d}
function lum(h){const n=h.slice(1);const c=[0,2,4].map(i=>parseInt(n.slice(i,i+2),16)/255).map(x=>x<=.03928?x/12.92:((x+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]}
function ratio(a,b){const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
function famOk(f){return typeof f==="string"&&/^[A-Za-z0-9 ]{2,40}$/.test(f.trim())?f.trim():""}
function fstack(f,g){return f?`"${f}", ${g}`:g}
function fontLinks(fams){return [...new Set(fams.filter(Boolean))].map(f=>{const q=encodeURIComponent(f).replace(/%20/g,"+");return `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${q}&display=swap"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${q}:wght@600;700&display=swap">`}).join("")}
function ensureFonts(fams){for(const f of fams){if(!f)continue;const id="gf-"+f.replace(/\s/g,"-");if(document.getElementById(id))continue;const q=encodeURIComponent(f).replace(/%20/g,"+");const l=document.createElement("link");l.id=id;l.rel="stylesheet";l.href=`https://fonts.googleapis.com/css2?family=${q}&display=swap`;document.head.appendChild(l)}}
const LAYOUT_PROPS=/^(width|height|min-|max-|margin|padding|display|position|top|left|right|bottom|inset|float|z-index|transform|translate|scale|rotate|content|overflow|grid|flex|order|font|line-height|letter-spacing|text-|color$|visibility|pointer-events|cursor|animation|transition)/;
function cleanCss(s,kind){s=String(s||"").slice(0,1600).replace(/url\s*\([^)]*\)/gi,"").replace(/[{}<>@\\]/g,"").replace(/expression|javascript:|import/gi,"");
  return s.split(";").map(d=>d.trim()).filter(d=>{const i=d.indexOf(":");if(i<1)return false;const p=d.slice(0,i).trim().toLowerCase();
    if(!/^-?[a-z-]+$/.test(p))return false;
    if(kind==="line"&&p==="height")return true;
    if(LAYOUT_PROPS.test(p))return false;
    if(kind==="shape"&&/^(background|box-shadow|border$|border-(top|right|bottom|left|width|style|color)$|outline|opacity)/.test(p))return false;
    if(kind==="line"&&/^(border|box-shadow|outline)/.test(p))return false;
    return true}).join(";")}
function cleanPath(p){p=String(p||"");return /^[MmLlHhVvCcSsQqTtAaZz0-9 ,.\-]{4,2400}$/.test(p)?p:""}
function fmtDate(iso){try{return new Date(iso).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})}catch{return ""}}

/* ---------- normalize model output ---------- */
function normalize(x){x=x&&typeof x==="object"?x:{};const o={};
  o.name=str(x.name,40)||"Untitled";o.tagline=str(x.tagline,160);
  o.photos=(Array.isArray(x.photos)?x.photos:[]).slice(0,12).map(p=>({n:clampN(p?.n,1,12,1),desc:str(p?.desc,200),role:str(p?.role,20),note:str(p?.note,240)}));
  o.anchor=clampN(x.anchor,1,12,1);
  o.words=(Array.isArray(x.words)?x.words:[]).slice(0,8).map(w=>str(w,30));
  const th=Array.isArray(x.themes)?x.themes:[];o.themes=[{id:"a",name:str(th[0]?.name,24)||"Primary"},{id:"b",name:str(th[1]?.name,24)||"Alternate"}];
  o.colors={};const c=x.colors&&typeof x.colors==="object"?x.colors:{};
  for(const r of ROLES){const v=c[r]||{};o.colors[r]={label:str(v.label,30)||r,a:hex(v.a,DEFAULT_HEX[r][0]),b:hex(v.b,DEFAULT_HEX[r][1]),usage:str(v.usage,300),source:str(v.source,160)}}
  const t=x.type||{};const face=(k,g)=>({family:famOk(t[k]?.family)||"",word:str(t[k]?.word,30),why:str(t[k]?.why,300),generic:g});
  o.type={display:face("display","Georgia, serif"),body:face("body","system-ui, sans-serif"),label:face("label","system-ui, sans-serif"),
    display_size:clampN(t.display_size,48,180,88),display_leading:clampN(t.display_leading,.8,1.3,.95),display_weight:clampN(t.display_weight,100,900,400),
    display_case:t.display_case==="upper"?"uppercase":"none",body_size:clampN(t.body_size,14,21,17),label_case:t.label_case==="upper"?"uppercase":"none",label_tracking:clampN(t.label_tracking,-.02,.2,.02)};
  const sp=Array.isArray(x.spacing)?x.spacing:[];o.spacing=[4,8,14,24,40,72].map((d,i)=>Math.round(clampN(sp[i],2,180,d)));
  const s=x.shape||{};o.shape={name:str(s.name,40)||"Shape",source:str(s.source,160),why:str(s.why,300),small_css:cleanCss(s.small_css,"shape"),large_css:cleanCss(s.large_css,"shape"),svg_path:cleanPath(s.svg_path)};
  const l=x.line||{};o.line={name:str(l.name,40)||"Line",source:str(l.source,160),css:cleanCss(l.css,"line"),svg_rects:(Array.isArray(l.svg_rects)?l.svg_rects:[]).slice(0,8).map(r=>[clampN(r?.[0],0,16,0),clampN(r?.[1],.5,16,1)])};
  if(!o.line.svg_rects.length)o.line.svg_rects=[[0,2]];
  const pt=x.pattern||{};o.pattern={name:str(pt.name,40),css:cleanCss(pt.css,"pattern")};
  const h=x.hero||{};o.hero={layout:["centered","offset","stacked","banded"].includes(h.layout)?h.layout:"centered",eyebrow:str(h.eyebrow,40),headline:str(h.headline,90)||o.name,sub:str(h.sub,220),cta:str(h.cta,28)||"Get started",secondary_cta:str(h.secondary_cta,28)};
  const si=x.site||{};const f=si.form||{};const li=si.list||{};
  o.site={brand:str(si.brand,40)||o.name,nav:(Array.isArray(si.nav)?si.nav:[]).slice(0,4).map(n=>str(n,20)),
    features:(Array.isArray(si.features)?si.features:[]).slice(0,3).map(q=>({title:str(q?.title,60),body:str(q?.body,240)})),
    form:{title:str(f.title,60)||"Stay in touch",body:str(f.body,240),label:str(f.label,30)||"Email",placeholder:str(f.placeholder,40),cta:str(f.cta,28)||"Send",error:str(f.error,120)||"Check this field."},
    list:{title:str(li.title,60),rows:(Array.isArray(li.rows)?li.rows:[]).slice(0,6).map(r=>(Array.isArray(r)?r:[]).slice(0,3).map(c=>str(c,60)))},
    footer:str(si.footer,200)};
  while(o.site.features.length<3)o.site.features.push({title:"",body:""});
  o.rules=(Array.isArray(x.rules)?x.rules:[]).slice(0,10).map(r=>str(r,300));
  const a=x.audit||{};o.audit={generic_description:str(a.generic_description,600),changes:(Array.isArray(a.changes)?a.changes:[]).slice(0,8).map(c=>({was:str(c?.was,240),now:str(c?.now,240)})),industry_cliches:(Array.isArray(a.industry_cliches)?a.industry_cliches:[]).slice(0,5).map(c=>str(c,120)),interchangeable_check:str(a.interchangeable_check,400),dropped_photos:(Array.isArray(a.dropped_photos)?a.dropped_photos:[]).slice(0,8).map(d=>({n:clampN(d?.n,1,12,1),why:str(d?.why,200)}))};
  return o}

/* ---------- lint: the prompt's rules, checked ---------- */
function lint(sp){const out=[];
  for(const k of ["display","body","label"]){const f=sp.type[k].family;if(!f)out.push({bad:true,t:`No usable ${k} font; a fallback is showing.`});else if(BANNED_FONTS.includes(f.toLowerCase()))out.push({bad:true,t:`${f} (${k}) is on the excluded list.`})}
  const all=sp.shape.small_css+";"+sp.shape.large_css;
  const m=[...all.matchAll(/border-radius\s*:\s*([^;]+)/gi)].map(x=>x[1].trim());
  for(const v of m){const nums=v.split(/[\s/]+/).map(parseFloat).filter(Number.isFinite);if(nums.length&&nums.every(n=>n>=4&&n<=16&&n===nums[0]))out.push({bad:true,t:`Uniform ${nums[0]}px radius: a template default.`})}
  if(!sp.shape.small_css&&!sp.shape.large_css)out.push({bad:true,t:"The shape came back empty; boxes are plain rectangles."});
  for(const th of ["a","b"])for(const [f,g] of PAIRS){const r=ratio(sp.colors[f][th],sp.colors[g][th]);if(r<4.5)out.push({bad:true,t:`${sp.themes[th==="a"?0:1].name}: ${f} on ${g} is ${r.toFixed(2)}:1 (needs 4.5).`})}
  const sps=sp.spacing;if(sps.every(v=>v%4===0))out.push({bad:true,t:"Spacing sits on a 4px grid."});
  if(!out.length)out.push({bad:false,t:"Fonts, radii, spacing and all text contrast pairs pass."});
  return out}
/* ---------- sample site + specimen renderers ---------- */
function varsCss(sp){let a=":root{",b='[data-theme="b"]{';
  for(const r of ROLES){a+=`--${r}:${sp.colors[r].a};`;b+=`--${r}:${sp.colors[r].b};`}
  sp.spacing.forEach((v,i)=>a+=`--s${i+1}:${v}px;`);const t=sp.type;
  a+=`--f-display:${fstack(t.display.family,t.display.generic)};--f-body:${fstack(t.body.family,t.body.generic)};--f-label:${fstack(t.label.family,t.label.generic)};--d-size:${t.display_size}px;--d-lead:${t.display_leading};--d-weight:${t.display_weight};--d-case:${t.display_case};--b-size:${t.body_size}px;--l-track:${t.label_tracking}em;--l-case:${t.label_case};`;
  return a+"}"+b+"}"}
function motifCss(sp){return `.shape-s{${sp.shape.small_css}}.shape-l{${sp.shape.large_css}}.ln{display:block;width:100%;height:3px;background:var(--line)}.ln{${sp.line.css}}.pat{position:absolute;inset:0;pointer-events:none}.pat{${sp.pattern.css}}`}
const SITE_CSS=`*{box-sizing:border-box}html,body{margin:0}
body{background:var(--ground);color:var(--ink);font:400 var(--b-size)/1.6 var(--f-body);-webkit-font-smoothing:antialiased;overflow-x:hidden}
.wrap{max-width:1160px;margin:0 auto;padding:0 var(--s5)}
@media(max-width:640px){.wrap{padding:0 var(--s4)}}
.lbl{font-family:var(--f-label);letter-spacing:var(--l-track);text-transform:var(--l-case);font-size:14px;font-weight:600}
h1,h2,h3{font-family:var(--f-display);font-weight:var(--d-weight);text-transform:var(--d-case);margin:0;text-wrap:balance}
h1{font-size:clamp(44px,9vw,var(--d-size));line-height:var(--d-lead);letter-spacing:-.01em}
h2{font-size:clamp(30px,5vw,calc(var(--d-size) * .52));line-height:1.02}
h3{font-size:clamp(22px,3vw,28px);line-height:1.12}
p{margin:0;max-width:62ch}
nav.top{display:flex;align-items:center;justify-content:space-between;gap:var(--s4);padding:var(--s4) 0}
.brand{font:var(--d-weight) 26px/1 var(--f-display);text-transform:var(--d-case)}
.links{display:flex;gap:var(--s4);color:var(--ink-muted)}
@media(max-width:700px){.links{display:none}}
.btnw{display:inline-flex;flex-direction:column;gap:5px;vertical-align:top}
.btn{appearance:none;border:0;cursor:pointer;background:var(--action);color:var(--action-ink);font:600 15px/20px var(--f-label);letter-spacing:var(--l-track);text-transform:var(--l-case);padding:var(--s3) var(--s4);min-height:48px;transition:filter .15s ease}
.btn.sec{background:var(--surface-2);color:var(--ink)}
.btn:hover{filter:brightness(.9)}
.btn:focus{outline:none}
.go{transition:color .15s ease}.go:hover{text-decoration:underline}
.btnw .ln.f{visibility:hidden;--line:var(--ink)}
.btnw:focus-within .ln.f{visibility:visible}
.hero{position:relative;padding:var(--s6) 0}
.hero .ey{color:var(--ink-muted);margin-bottom:var(--s3)}
.hero .sub{font-size:calc(var(--b-size) * 1.15);color:var(--ink-muted);margin-top:var(--s4)}
.hero .acts{display:flex;flex-wrap:wrap;gap:var(--s3);margin-top:var(--s5);align-items:flex-start}
.k1{background:var(--fill-1)}.k2{background:var(--fill-2)}.k3{background:var(--fill-3)}.k4{background:var(--fill-4)}.ka{background:var(--action)}
.blk,.side i,.band i,.opening i,.sw i{position:relative;overflow:hidden;display:block}
.h-centered{text-align:center}
.h-centered .mid{position:relative;z-index:1;max-width:calc(780px + 2 * clamp(40px,11vw,150px));margin:0 auto;padding:var(--s5) calc(clamp(40px,11vw,150px) + var(--s4))}
@media(max-width:760px){.h-centered .mid{padding:0}}
.h-centered .sub{margin-left:auto;margin-right:auto}.h-centered .acts{justify-content:center}
.h-centered .side{position:absolute;top:0;bottom:0;width:clamp(40px,11vw,150px);display:flex;flex-direction:column}
.h-centered .side.l{left:var(--s5)}.h-centered .side.r{right:var(--s5)}
@media(max-width:640px){.h-centered .side.l{left:var(--s4)}.h-centered .side.r{right:var(--s4)}}
.side .k1{flex:5}.side .k2{flex:3}.side .k3{flex:2}.side .k4{flex:1}
@media(max-width:760px){.h-centered .side{display:none}}
.h-offset .grid{display:grid;grid-template-columns:repeat(12,1fr);gap:var(--s4);align-items:end}
.h-offset .t{grid-column:1/10;grid-row:1}.h-offset .aside{grid-column:7/13;grid-row:2}
.h-offset .blk{grid-column:10/13;grid-row:1;align-self:stretch;min-height:220px}
@media(max-width:760px){.h-offset .t,.h-offset .aside{grid-column:1/-1}.h-offset .blk{grid-column:1/-1;grid-row:auto;min-height:120px}}
.h-stacked h1{font-size:clamp(52px,12vw,calc(var(--d-size) * 1.3))}
.h-stacked .ln{margin-top:var(--s4)}
.h-stacked .row3{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:var(--s5);margin-top:var(--s4);align-items:start}
.h-stacked .sw{display:flex;gap:var(--s2)}.h-stacked .sw i{flex:1;height:84px}
@media(max-width:760px){.h-stacked .row3{grid-template-columns:1fr}}
.h-banded .band{display:flex;gap:var(--s2);height:clamp(96px,16vw,180px);margin-bottom:var(--s5)}
.h-banded .band .k1{flex:4}.h-banded .band .k2{flex:2}.h-banded .band .k3{flex:3}.h-banded .band .k4{flex:1}
section{padding:var(--s6) 0 0}
.sec-h{display:flex;flex-direction:column;gap:var(--s3);margin-bottom:var(--s5)}
.feats{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s4)}
@media(max-width:860px){.feats{grid-template-columns:1fr}}
.panel{background:var(--surface);padding:var(--s5)}
.panel h3{margin-bottom:var(--s3)}
.panel .opening{height:96px;display:flex;margin-bottom:var(--s4)}.opening i{flex:1}
.panel .ln{margin:var(--s4) 0 var(--s3)}
.panel .go{color:var(--link)}
.formgrid{display:grid;grid-template-columns:1fr 1fr;gap:var(--s5);align-items:start}
@media(max-width:760px){.formgrid{grid-template-columns:1fr}}
.formgrid p{color:var(--ink-muted);margin-top:var(--s3)}
.field{display:flex;flex-direction:column;gap:var(--s2);margin-bottom:var(--s4)}
.field label{color:var(--ink-muted)}
.field input{appearance:none;border:0;outline:0;background:var(--surface);color:var(--ink);font:400 var(--b-size)/1.5 var(--f-body);padding:var(--s3) var(--s4);min-height:50px;width:100%}
.field input::placeholder{color:var(--ink-muted)}
.field .ln{visibility:hidden;--line:var(--ink)}
.field:focus-within .ln{visibility:visible}
.field.err .ln{visibility:visible;--line:var(--signal)}
.field .msg{color:var(--signal);font-size:14px}
.list .r{display:grid;grid-template-columns:2fr 1fr 1fr;gap:var(--s4);padding:var(--s3) var(--s4)}
.list .r:nth-child(odd){background:var(--surface)}
.list .r span:first-child{font-weight:600}.list .r span:not(:first-child){color:var(--ink-muted)}
@media(max-width:600px){.list .r{grid-template-columns:1fr 1fr}.list .r span:last-child{display:none}}
footer{background:var(--surface-2);padding:var(--s5) 0 var(--s6);margin-top:var(--s6)}
footer .brand{display:block;margin:var(--s4) 0 var(--s3)}footer p{color:var(--ink-muted)}`;
function btn(t,cls=""){return t?`<span class="btnw"><button class="btn shape-s ${cls}">${esc(t)}</button><i class="ln f"></i></span>`:""}
function heroHtml(sp){const h=sp.hero;const ey=h.eyebrow?`<div class="ey lbl">${esc(h.eyebrow)}</div>`:"";
  const acts=`<div class="acts">${btn(h.cta)}${btn(h.secondary_cta,"sec")}</div>`;const sub=h.sub?`<p class="sub">${esc(h.sub)}</p>`:"";
  if(h.layout==="offset")return `<div class="hero h-offset"><div class="wrap grid"><div class="t">${ey}<h1>${esc(h.headline)}</h1></div><i class="blk k1 shape-l"><b class="pat"></b></i><div class="aside">${sub}${acts}</div></div></div>`;
  if(h.layout==="stacked")return `<div class="hero h-stacked"><div class="wrap">${ey}<h1>${esc(h.headline)}</h1><i class="ln"></i><div class="row3"><div>${sub}</div><div>${acts}</div><div class="sw"><i class="k1 shape-s"><b class="pat"></b></i><i class="k2 shape-s"></i><i class="k3 shape-s"></i></div></div></div></div>`;
  if(h.layout==="banded")return `<div class="hero h-banded"><div class="wrap"><div class="band"><i class="k1 shape-l"><b class="pat"></b></i><i class="k2 shape-l"></i><i class="k3 shape-l"><b class="pat"></b></i><i class="k4 shape-l"></i></div>${ey}<h1>${esc(h.headline)}</h1>${sub}${acts}</div></div>`;
  const side=c=>`<div class="side ${c} shape-l"><i class="k1"><b class="pat"></b></i><i class="k2"></i><i class="k3"></i><i class="k4"></i></div>`;
  return `<div class="hero h-centered"><div class="wrap" style="position:relative">${side("l")}${side("r")}<div class="mid">${ey}<h1>${esc(h.headline)}</h1>${sub}${acts}</div></div></div>`}
function siteBody(sp){const s=sp.site;
  const feats=s.features.map((f,i)=>`<div class="panel shape-l">${i===0?`<div class="opening shape-s"><i class="k1"><b class="pat"></b></i><i class="k2"></i><i class="k3"></i></div>`:""}<h3>${esc(f.title)}</h3><p>${esc(f.body)}</p><i class="ln"></i><span class="go lbl">${i===0?"Read more":"Details"}</span></div>`).join("");
  const rows=s.list.rows.map(r=>`<div class="r">${r.map(c=>`<span>${esc(c)}</span>`).join("")}</div>`).join("");
  return `<div class="wrap"><nav class="top"><span class="brand">${esc(s.brand)}</span><span class="links lbl">${s.nav.map(n=>`<span>${esc(n)}</span>`).join("")}</span>${btn(sp.hero.secondary_cta||sp.hero.cta,"sec")}</nav><i class="ln"></i></div>
${heroHtml(sp)}
<section><div class="wrap"><i class="ln"></i><div class="feats" style="margin-top:var(--s5)">${feats}</div></div></section>
<section><div class="wrap formgrid"><div><h2>${esc(s.form.title)}</h2>${s.form.body?`<p>${esc(s.form.body)}</p>`:""}</div><div>
<div class="field"><label class="lbl" for="f1">${esc(s.form.label)}</label><input id="f1" class="shape-s" placeholder="${esc(s.form.placeholder)}"><i class="ln"></i></div>
<div class="field err"><label class="lbl" for="f2">${esc(s.form.label)} (error state)</label><input id="f2" class="shape-s" value="${esc(s.form.placeholder)}"><i class="ln"></i><span class="msg">${esc(s.form.error)}</span></div>
${btn(s.form.cta)}</div></div></section>
${rows?`<section class="list"><div class="wrap"><div class="sec-h"><h2>${esc(s.list.title)}</h2></div><i class="ln"></i><div style="margin-top:var(--s3)">${rows}</div></div></section>`:""}
<footer><div class="wrap"><i class="ln"></i><span class="brand">${esc(s.brand)}</span><p>${esc(s.footer||sp.tagline)}</p></div></footer>`}
function docShell(sp,theme,body,extraCss=""){const t=sp.type;
  return `<!doctype html><html data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(sp.name)}</title>${fontLinks([t.display.family,t.body.family,t.label.family])}<style>${varsCss(sp)}${SITE_CSS}${motifCss(sp)}${extraCss}</style></head><body>${body}</body></html>`}
function siteDoc(sp,theme){return docShell(sp,theme,siteBody(sp))}
const SPEC_CSS=`.spec{padding:var(--s5) 0 var(--s6)}.spec h2{margin:var(--s6) 0 var(--s4)}.spec h2:first-child{margin-top:0}
.sw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:var(--s4)}
.sw-c .chip{height:88px;margin-bottom:var(--s2)}.sw-c b{display:block;font-weight:600}.sw-c small{display:block;color:var(--ink-muted);font-size:13px;line-height:1.4}
.ck{display:grid;gap:6px;margin-top:var(--s4);font-size:14px}.ck span.bad{color:var(--signal)}.ck span.ok{color:var(--success)}
.ty{display:grid;gap:var(--s5)}.ty .meta{color:var(--ink-muted);font-size:14px;margin-top:var(--s2)}
.sh{display:grid;grid-template-columns:1fr 2fr;gap:var(--s5);align-items:end}.sh .s{height:52px;background:var(--action)}.sh .l{height:240px;background:var(--surface-2)}
@media(max-width:700px){.sh{grid-template-columns:1fr}}
.lines{display:grid;gap:var(--s4)}.lines .x{display:grid;gap:var(--s2)}.lines small{color:var(--ink-muted)}
.lines .fo{--line:var(--ink)}.lines .er{--line:var(--signal)}
.patb{height:160px;position:relative;overflow:hidden}
.sp{display:grid;gap:var(--s2)}.sp div{display:flex;align-items:center;gap:var(--s3);font-size:14px;color:var(--ink-muted)}.sp i{display:block;height:14px;background:var(--accent)}
.note{color:var(--ink-muted);font-size:14px;max-width:70ch}`;
function specimenDoc(sp,theme){const th=theme;const c=sp.colors;const tn=sp.themes[th==="a"?0:1].name;
  const sw=ROLES.map(r=>`<div class="sw-c"><div class="chip shape-l" style="background:var(--${r})"></div><b>${esc(c[r].label)}</b><small>--${r} · ${c[r][th]}</small><small>${esc(c[r].source)}</small></div>`).join("");
  const ck=PAIRS.map(([f,g])=>{const r=ratio(c[f][th],c[g][th]);return `<span class="${r>=4.5?"ok":"bad"}">${r>=4.5?"Pass":"Fail"} ${r.toFixed(2)}:1 · ${f} on ${g}</span>`}).join("");
  const t=sp.type;const face=(k,label)=>`<div class="meta">${label}: ${esc(t[k].family||"fallback")}${t[k].word?` · from “${esc(t[k].word)}”`:""}. ${esc(t[k].why)}</div>`;
  const body=`<div class="wrap spec">
<h2>Colour · ${esc(tn)}</h2><div class="sw-grid">${sw}</div><div class="ck">${ck}</div>
<h2>Type</h2><div class="ty"><div><h1>${esc(sp.hero.headline)}</h1>${face("display","Display")}</div><div><p>${esc(sp.site.features[0].body||sp.tagline)}</p>${face("body","Body")}</div><div><span class="lbl">${esc(sp.site.nav.join("   ")||"Label sample")}</span>${face("label","Label")}</div></div>
<h2>Shape · ${esc(sp.shape.name)}</h2><div class="sh"><div><div class="s shape-s"></div><p class="note">Small: buttons, fields, chips.</p></div><div><div class="l shape-l"></div><p class="note">Large: panels, frames. ${esc(sp.shape.source)}. ${esc(sp.shape.why)}</p></div></div>
<h2>Line · ${esc(sp.line.name)}</h2><div class="lines"><div class="x"><i class="ln"></i><small>Default. ${esc(sp.line.source)}</small></div><div class="x"><i class="ln fo"></i><small>Focus (ink)</small></div><div class="x"><i class="ln er"></i><small>Error (signal)</small></div></div>
${sp.pattern.css?`<h2>Pattern${sp.pattern.name?" · "+esc(sp.pattern.name):""}</h2><div class="patb k1 shape-l"><b class="pat"></b></div><p class="note" style="margin-top:var(--s3)">Only inside colour blocks, never behind text.</p>`:""}
<h2>Spacing</h2><div class="sp">${sp.spacing.map((v,i)=>`<div><i style="width:${v}px"></i>--s${i+1} · ${v}px</div>`).join("")}</div>
</div>`;return docShell(sp,theme,body,SPEC_CSS)}

/* ---------- exports ---------- */
function tokensJson(sp){const set=th=>{const o={};for(const r of ROLES)o[r]={"$type":"color","$value":sp.colors[r][th],"$description":`${sp.colors[r].label}. ${sp.colors[r].usage}`.trim()};return {color:o}};
  const t=sp.type;const g={font:{display:{"$type":"fontFamily","$value":t.display.family||"serif"},body:{"$type":"fontFamily","$value":t.body.family||"sans-serif"},label:{"$type":"fontFamily","$value":t.label.family||"sans-serif"}},
    fontSize:{display:{"$type":"dimension","$value":t.display_size+"px"},body:{"$type":"dimension","$value":t.body_size+"px"}},
    lineHeight:{display:{"$type":"number","$value":t.display_leading}},fontWeight:{display:{"$type":"fontWeight","$value":t.display_weight}},
    space:Object.fromEntries(sp.spacing.map((v,i)=>["s"+(i+1),{"$type":"dimension","$value":v+"px"}])),
    motif:{shape:{"$type":"other","$value":sp.shape.large_css,"$description":`${sp.shape.name}. ${sp.shape.source}`},line:{"$type":"other","$value":sp.line.css,"$description":`${sp.line.name}. ${sp.line.source}`}}};
  const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"theme";
  const a="theme/"+slug(sp.themes[0].name),b="theme/"+slug(sp.themes[1].name);
  return JSON.stringify({global:g,[a]:set("a"),[b]:set("b"),"$themes":[{name:sp.themes[0].name,selectedTokenSets:{global:"source",[a]:"enabled"}},{name:sp.themes[1].name,selectedTokenSets:{global:"source",[b]:"enabled"}}],"$metadata":{tokenSetOrder:["global",a,b]}},null,2)}
function specimenSvg(sp){const W=1200,x0=60;let y=0;const out=[];const t=sp.type;const c=sp.colors;
  const txt=(x,yy,s,size,fam,fill,weight=400)=>`<text x="${x}" y="${yy}" font-family="${esc(fam||"sans-serif")}" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(s)}</text>`;
  y=110;out.push(txt(x0,y,sp.name,72,t.display.family,c.ink.a));y+=40;out.push(txt(x0,y,sp.tagline,18,t.body.family,c["ink-muted"].a));
  for(const th of ["a","b"]){y+=70;out.push(txt(x0,y,`Colour · ${sp.themes[th==="a"?0:1].name}`,22,t.label.family,c.ink.a,600));y+=20;
    ROLES.forEach((r,i)=>{const col=i%8,row=Math.floor(i/8);const x=x0+col*135,yy=y+row*150;out.push(`<g id="${r}-${th}"><rect x="${x}" y="${yy}" width="120" height="80" fill="${c[r][th]}"/>`+txt(x,yy+102,c[r].label,13,t.body.family,c.ink.a,600)+txt(x,yy+120,`${r} ${c[r][th]}`,11,t.body.family,c["ink-muted"].a)+`</g>`)});y+=300}
  y+=30;out.push(txt(x0,y,"Type",22,t.label.family,c.ink.a,600));y+=90;out.push(txt(x0,y,sp.hero.headline.slice(0,40),Math.min(72,t.display_size),t.display.family,c.ink.a,t.display_weight));
  y+=30;out.push(txt(x0,y,`Display · ${t.display.family}`,13,t.body.family,c["ink-muted"].a));y+=44;out.push(txt(x0,y,(sp.site.features[0].body||sp.tagline).slice(0,90),t.body_size,t.body.family,c.ink.a));
  y+=26;out.push(txt(x0,y,`Body · ${t.body.family}`,13,t.body.family,c["ink-muted"].a));y+=40;out.push(txt(x0,y,sp.hero.cta,15,t.label.family,c.ink.a,600));y+=26;out.push(txt(x0,y,`Label · ${t.label.family}`,13,t.body.family,c["ink-muted"].a));
  y+=70;out.push(txt(x0,y,`Shape · ${sp.shape.name}`,22,t.label.family,c.ink.a,600));y+=20;
  if(sp.shape.svg_path)out.push(`<g id="shape" transform="translate(${x0} ${y})"><path d="${sp.shape.svg_path}" fill="${c.action.a}"/></g>`);else out.push(`<rect x="${x0}" y="${y}" width="240" height="160" fill="${c.action.a}"/>`);
  out.push(txt(x0+280,y+30,sp.shape.source,13,t.body.family,c["ink-muted"].a));y+=200;
  out.push(txt(x0,y,`Line · ${sp.line.name}`,22,t.label.family,c.ink.a,600));y+=20;out.push(`<g id="line" transform="translate(${x0} ${y})">`+sp.line.svg_rects.map(([ry,rh])=>`<rect x="0" y="${ry}" width="600" height="${rh}" fill="${c.line.a}"/>`).join("")+`</g>`);y+=60;
  out.push(txt(x0,y,"Spacing",22,t.label.family,c.ink.a,600));y+=20;sp.spacing.forEach((v,i)=>{out.push(`<rect x="${x0}" y="${y+i*24}" width="${v}" height="12" fill="${c.accent.a}"/>`+txt(x0+v+12,y+i*24+11,`s${i+1} ${v}px`,12,t.body.family,c["ink-muted"].a))});y+=180;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y}" viewBox="0 0 ${W} ${y}"><rect width="${W}" height="${y}" fill="${c.ground.a}"/>${out.join("")}</svg>`}

export {ROLES,DEFAULT_HEX,BANNED_FONTS,STAGES,PAIRS,$,esc,hex,ratio,famOk,fstack,fontLinks,ensureFonts,fmtDate,cleanCss,normalize,lint,varsCss,motifCss,siteBody,siteDoc,specimenDoc,tokensJson,specimenSvg};
