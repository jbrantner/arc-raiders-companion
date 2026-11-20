// Skill tree planner: rules, layout, rendering, saves and build codes.
(() => {
const {BRANCHES:BR, SLOTS, SKILLS:S, EXAMPLE} = ARC;
const SAVE_KEY = "arcPlanner2", NAMES_KEY = "arcPlannerNames";

const SK = {}; const ORDER = [];
for (const b of ["c","m","s"]) S[b].forEach((r,i)=>{
  const id=b+i; SK[id]={id,b,slot:SLOTS[i],name:r[0],max:r[1],desc:r[2],ranks:r[3]||null,note:r[4]||null,icon:r[5]};
  ORDER.push(id);
});
const bySlot = (b,slot)=>SK[b+SLOTS.indexOf(slot)];

let state = {}; let availMax = 86, isExample = false;
function load(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(raw){const d=JSON.parse(raw); state=d.state||{}; availMax=Math.max(86,d.availMax??86); isExample=!!d.isExample; return;}
  }catch(e){}
  state = {...EXAMPLE}; isExample = true;
}
function save(){ try{ localStorage.setItem(SAVE_KEY,JSON.stringify({state,availMax,isExample})); }catch(e){} }

/* ---------- rules ---------- */
const r = (s,id)=>s[id]||0;
const branchTotal = (s,b)=>ORDER.filter(id=>SK[id].b===b).reduce((a,id)=>a+r(s,id),0);
const total = s=>ORDER.reduce((a,id)=>a+r(s,id),0);
const g = (s,b,slot)=>r(s,bySlot(b,slot).id);
const nm = (b,slot)=>bySlot(b,slot).name;

function checkBranch(s,b){
  const N=BR[b].name;
  const early = ["st","eh0","et0","eh1","et1"].reduce((a,x)=>a+g(s,b,x),0);
  const endPicks = ["en0","en1","en2"].filter(x=>g(s,b,x)>0);
  const nonEnd = branchTotal(s,b) - endPicks.length;
  for (const slot of SLOTS){
    if(!g(s,b,slot)) continue;
    const n = nm(b,slot);
    if(slot.startsWith("eh") && !g(s,b,"st")) return `${n} needs a point in ${nm(b,"st")} first.`;
    if(slot.startsWith("et")){const h="eh"+slot[2]; if(!g(s,b,h)) return `${n} needs a point in ${nm(b,h)} first.`;}
    if(slot.startsWith("ch")){
      if(!g(s,b,"et0")&&!g(s,b,"et1")) return `${n} needs a point in ${nm(b,"et0")} or ${nm(b,"et1")}.`;
      if(early<10) return `${n} needs 10 points in ${N} below the fork (you have ${early}).`;
      if(g(s,b,"ch0")&&g(s,b,"ch1")) return `You can only keep one of ${nm(b,"ch0")} or ${nm(b,"ch1")}. Remove the other first.`;
    }
    if(slot.startsWith("lh") && !g(s,b,"ch0") && !g(s,b,"ch1")) return `${n} needs one of the fork skills first (${nm(b,"ch0")} or ${nm(b,"ch1")}).`;
    if(slot.startsWith("lt")){const h="lh"+slot[2]; if(!g(s,b,h)) return `${n} needs a point in ${nm(b,h)} first.`;}
    if(slot.startsWith("en")){
      if(!g(s,b,"lt0")&&!g(s,b,"lt1")&&!g(s,b,"lt2")) return `${n} needs a point in ${nm(b,"lt0")}, ${nm(b,"lt1")} or ${nm(b,"lt2")}.`;
      if(endPicks.length>2) return `Only two of the three top skills can be taken in ${N}.`;
      if(nonEnd<30) return `${n} needs 30 points in ${N} (you have ${nonEnd}).`;
      if(endPicks.length===2 && nonEnd+1<40) return `A second top skill needs 40 points in ${N} (you have ${nonEnd+1}).`;
    }
  }
  return null;
}
function tryChange(id,delta){
  const sk=SK[id]; const cur=r(state,id); const nv=cur+delta;
  if(nv>sk.max) return {err:`${sk.name} is already maxed.`};
  if(nv<0) return {err:`${sk.name} has no points to remove.`};
  const s={...state,[id]:nv};
  if(delta>0 && total(s)>availMax) return {err:`Out of points: you have ${availMax} skill points. Raise it or take points back.`};
  const e=checkBranch(s,sk.b);
  if(e) return {err: delta<0 ? `Can't remove that point. ${e}` : e};
  return {s};
}

/* ---------- layout: like the game, Mobility straight up the middle, Conditioning curving left, Survival right ---------- */
let W=1600, H=910;
const phoneMQ = matchMedia("(max-width: 760px)");
// phone layout: three upright branches side by side, same size, swiped like a carousel
const PW=430, PH=880, PBASE=800, PTOP=22;
const PCX={c:PW/2, m:PW*1.5, s:PW*2.5};
// local layout per branch: u = -1..1 across, v = 0..1 up the branch
const LOC_DESK = {st:[0,0],eh0:[-.72,.14],et0:[-.72,.28],eh1:[.72,.14],et1:[.72,.28],H1:[0,.36],ch0:[-.48,.47],ch1:[.48,.47],
  H2:[0,.56],lh0:[-1,.66],lt0:[-1,.79],lh1:[0,.66],lt1:[0,.79],lh2:[1,.66],lt2:[1,.79],H3:[0,.87],en0:[-.82,1],en1:[0,1],en2:[.82,1]};
const GEO_PHONE={
  c:{base:[PCX.c,PBASE],a:0,L:735,w:140,bend:0},
  m:{base:[PCX.m,PBASE],a:0,L:735,w:140,bend:0},
  s:{base:[PCX.s,PBASE],a:0,L:735,w:140,bend:0}
};
const GEO_DESK={
  c:{base:[640,750],a:-52,L:640,w:130,bend:.09},
  m:{base:[800,750],a:0,L:680,w:140,bend:0},
  s:{base:[960,750],a:52,L:640,w:130,bend:-.09}
};
const EDGES = [["st","eh0"],["st","eh1"],["eh0","et0"],["eh1","et1"],["et0","H1"],["et1","H1"],["H1","ch0"],["H1","ch1"],
  ["ch0","H2"],["ch1","H2"],["H2","lh0"],["H2","lh1"],["H2","lh2"],["lh0","lt0"],["lh1","lt1"],["lh2","lt2"],
  ["lt0","H3"],["lt1","H3"],["lt2","H3"],["H3","en0"],["H3","en1"],["H3","en2"]];
// phone rows are evenly spaced so the names under each skill have room (units up from the base / 735)
const pv=n=>n/735;
const LOC_PHONE = {st:[0,0],eh0:[-.72,pv(110)],et0:[-.72,pv(220)],eh1:[.72,pv(110)],et1:[.72,pv(220)],H1:[0,pv(282)],ch0:[-.65,pv(345)],ch1:[.65,pv(345)],
  H2:[0,pv(405)],lh0:[-1,pv(470)],lt0:[-1,pv(575)],lh1:[0,pv(470)],lt1:[0,pv(575)],lh2:[1,pv(470)],lt2:[1,pv(575)],H3:[0,pv(616)],en0:[-.82,1],en1:[0,1],en2:[.82,1]};
let GEO=GEO_DESK, LOC=LOC_DESK, isPhoneLayout=false;
function setLayout(){
  isPhoneLayout=phoneMQ.matches;
  GEO=isPhoneLayout?GEO_PHONE:GEO_DESK; LOC=isPhoneLayout?LOC_PHONE:LOC_DESK; W=isPhoneLayout?PW*3:1600; H=isPhoneLayout?PH:910;
}
function pt(b,u,v){
  const G=GEO[b]; const a=(G.a + G.bend*v*v*100)*Math.PI/180; // branches curl slightly outward as they rise
  return [G.base[0]+v*G.L*Math.sin(a)+u*G.w*Math.cos(a), G.base[1]-v*G.L*Math.cos(a)+u*G.w*Math.sin(a)];
}
const P=(b,slot)=>pt(b,...LOC[slot]);
function curve(b,a,z){
  const [ua,va]=LOC[a],[uz,vz]=LOC[z],dv=(vz-va)*.6;
  const p=[pt(b,ua,va),pt(b,ua,va+dv),pt(b,uz,vz-dv),pt(b,uz,vz)].map(q=>q.map(n=>n.toFixed(1)).join(","));
  return `M${p[0]} C${p[1]} ${p[2]} ${p[3]}`;
}
const pc=([x,y])=>`left:${x/W*100}%;top:${y/H*100}%`;

/* ---------- render ---------- */
const $=q=>document.querySelector(q);
const field=$("#field"); const tip=$("#tip");
const hoverMode = matchMedia("(hover: hover) and (pointer: fine)").matches;
let selected=null, hovering=null;
let showNames=false; try{showNames=localStorage.getItem(NAMES_KEY)==="1";}catch(e){}
const isGateSlot = slot => slot.startsWith("ch")||slot.startsWith("en");

function build(){
  setLayout();
  field.style.setProperty("--fw",W+"px"); field.style.setProperty("--fh",H+"px");
  let svg=`<svg class="wires" viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs><filter id="gl" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
  const trunkStart={c:[784,H+20],m:[800,H+20],s:[816,H+20]};
  for(const b of ["c","m","s"]){
    const [bx,by]=P(b,"st"), [rx,ry]=trunkStart[b];
    svg+= isPhoneLayout ? `<path class="e trunk ${b}" data-trunk="${b}" d="M${bx},${H+20} L${bx},${by}"/>`
      : `<path class="e trunk ${b}" data-trunk="${b}" d="M${rx},${ry} C${rx},${ry-70} ${bx+(b==="m"?0:(b==="c"?60:-60))},${by+60} ${bx},${by}"/>`;
    EDGES.forEach(([a,z],i)=>{
      const d = isPhoneLayout ? `M${P(b,a).map(n=>n.toFixed(1)).join(",")} L${P(b,z).map(n=>n.toFixed(1)).join(",")}` : curve(b,a,z);
      svg+=`<path class="e ${b}" data-e="${b}${i}" d="${d}"/>`;});
  }
  svg+="</svg>";
  let html=svg;
  const LAB=isPhoneLayout?{c:[PCX.c,PBASE-108],m:[PCX.m,PBASE-108],s:[PCX.s,PBASE-108]}:{c:[455,865],m:[800,642],s:[1145,865]};
  for(const b of ["c","m","s"]){
    html+=`<div class="blab" data-b="${b}" style="${pc(LAB[b])}"><span>${BR[b].name.toUpperCase()}</span><b data-bt="${b}">0</b><small data-bl="${b}"></small></div>`;
    const off=p=>p;
    html+=`<span class="gate" data-b="${b}" data-g10="${b}" style="${pc(off(P(b,"H1")))}">${isPhoneLayout?"10 pts":"10"}</span>`;
    html+=`<span class="gate" data-b="${b}" data-g30="${b}" style="${pc(off(P(b,"H3")))}">${isPhoneLayout?"30 · 40 pts":"30 · 40"}</span>`;
    ORDER.filter(id=>SK[id].b===b).forEach(id=>{
      const sk=SK[id]; const big=sk.slot==="st"||isGateSlot(sk.slot);
      html+=`<div class="node ${big?"xl":"sm"}${isGateSlot(sk.slot)?" gnode":""}" data-b="${b}" data-id="${id}" style="${pc(P(b,sk.slot))}"><button type="button" aria-label="${sk.name}">${ARC.icon(sk.icon)}<span class="cnt"></span></button>${sk.max>1?`<span class="pill"></span>`:""}<span class="lock" hidden>${ARC.LOCK}</span><span class="nm">${sk.name}</span></div>`;
    });
  }
  field.innerHTML=html;
  const sc=field.parentElement; requestAnimationFrame(()=>{if(!document.body.classList.contains("phone")) sc.scrollLeft=(sc.scrollWidth-sc.clientWidth)/2;});
  field.classList.toggle("shownames",showNames);
  $("#namesBtn").setAttribute("aria-pressed",showNames);
}

function render(){
  const T=total(state);
  $("#spent").textContent=T;
  const lm=availMax-T;
  const lmEl=$("#leftMax"); lmEl.textContent=lm; lmEl.className="num"+(lm<0?" neg":"");
  $("#availMax").value=availMax;
  for(const b of ["c","m","s"]){
    const bt=branchTotal(state,b);
    field.querySelector(`[data-bt="${b}"]`).textContent=bt;
    const tt=document.querySelector(`[data-tt="${b}"]`); if(tt) tt.textContent=bt;
    const early=["st","eh0","et0","eh1","et1"].reduce((a,x)=>a+g(state,b,x),0);
    const endN=["en0","en1","en2"].filter(x=>g(state,b,x)).length;
    field.querySelector(`[data-bl="${b}"]`).textContent= early<10?`${early}/10 to fork`:(bt-endN<30?`${bt-endN}/30 to top`:(bt-endN<40?`${bt-endN}/40 for 2nd top`:"all gates open"));
    field.querySelector(`[data-g10="${b}"]`).classList.toggle("hit",early>=10);
    field.querySelector(`[data-g30="${b}"]`).classList.toggle("hit",bt-endN>=30);
    field.querySelector(`[data-trunk="${b}"]`).classList.toggle("lit",g(state,b,"st")>0);
    const v=slot=>slot.startsWith("H")?null:g(state,b,slot);
    const any=(...sl)=>sl.some(x=>g(state,b,x)>0);
    EDGES.forEach(([a,z],i)=>{
      let lit;
      if(z==="H1") lit=v(a)>0&&any("ch0","ch1");
      else if(z==="H2") lit=v(a)>0&&any("lh0","lh1","lh2");
      else if(z==="H3") lit=v(a)>0&&any("en0","en1","en2");
      else lit=v(z)>0;
      field.querySelector(`[data-e="${b}${i}"]`).classList.toggle("lit",lit);
    });
    field.querySelectorAll(`.node[data-b="${b}"]`).forEach(n=>{
      const id=n.dataset.id, sk=SK[id], rk=r(state,id);
      const can=!tryChange(id,1).err;
      let cls="locked";
      if(rk>=sk.max) cls="maxed"; else if(rk>0) cls="partial"; else if(can) cls="open";
      let closed=false;
      if(rk===0){
        if(sk.slot.startsWith("ch")){const o=sk.slot==="ch0"?"ch1":"ch0"; if(g(state,b,o)) closed=true;}
        if(sk.slot.startsWith("en") && endN>=2) closed=true;
      }
      n.classList.remove("locked","open","partial","maxed","closed","sel");
      n.classList.add(cls); if(closed) n.classList.add("closed"); if(selected===id) n.classList.add("sel");
      n.querySelector(".lock").hidden=!(isGateSlot(sk.slot)&&cls==="locked"&&!closed);
      const p=n.querySelector(".pill"); if(p) p.textContent=`${rk}/${sk.max}`;
      n.querySelector(".cnt").textContent=`${rk}/${sk.max}`;
    });
  }
  $("#summary").innerHTML=["c","m","s"].map(b=>{
    const items=ORDER.filter(id=>SK[id].b===b&&r(state,id)>0);
    return `<div class="sumcol" style="--c:var(--${{c:"cond",m:"mob",s:"surv"}[b]})"><h2>${BR[b].name} · ${branchTotal(state,b)}</h2>${items.length?`<ul>${items.map(id=>`<li><span>${SK[id].name}</span><span>${r(state,id)}/${SK[id].max}</span></li>`).join("")}</ul>`:`<div class="none">No points yet</div>`}</div>`;
  }).join("");
  renderHead();
  $("#codeBox").value=encode();
  $("#exampleBox").hidden=!isExample;
  if(hovering) showTip(hovering); else if(selected) showTip(selected);
  save();
}

let msgTimer=null;
/* phone branch header: name, points / max and a progress bar with the 10 / 30 / 40 gates */
function branchMax(b){
  const sk=slot=>bySlot(b,slot).max;
  return ["st","eh0","et0","eh1","et1","lh0","lt0","lh1","lt1","lh2","lt2"].reduce((a,x)=>a+sk(x),0)+Math.max(sk("ch0"),sk("ch1"))+2;
}
function renderHead(){
  const el=$("#branchHead"); if(!el||!BR[view]) return;
  const b=view, bt=branchTotal(state,b), mx=branchMax(b);
  el.dataset.b=b;
  el.innerHTML=`<div class="bh-top"><h2>${BR[b].name}</h2><span class="bh-pts"><b>${bt}</b> / ${mx}</span></div>
    <div class="bh-bar"><i style="width:${Math.min(100,bt/mx*100).toFixed(1)}%"></i>${[10,30,40].map(t=>`<span class="tick${bt>=t?" hit":""}" style="left:${(t/mx*100).toFixed(1)}%"><em>${t}</em></span>`).join("")}</div>`;
}
function setMsg(t,ok){
  const m=$("#msg"); m.textContent=t||""; m.className="msg"+(ok?" ok":"");
  clearTimeout(msgTimer); if(t) msgTimer=setTimeout(()=>{m.textContent="";}, ok?2500:4500);
}
$("#msg").addEventListener("click",()=>{clearTimeout(msgTimer); $("#msg").textContent="";});
function change(id,delta){
  const res=tryChange(id,delta);
  if(res.err){
    if(!tip.hidden && tip.classList.contains("sheet")){ showTip(id); return; } // the open sheet already shows why
    setMsg(res.err,false); return;
  }
  state=res.s; isExample=false; setMsg("",true); render();
}

/* ---------- tooltip ---------- */
function tierTag(sk){
  if(sk.slot==="st") return "Starting skill";
  if(sk.slot.startsWith("ch")) return "Fork · pick 1 of 2 · 10 pts";
  if(sk.slot.startsWith("en")) return "Top · pick 2 of 3 · 30 / 40 pts";
  return BR[sk.b].name;
}
function showTip(id){
  const sk=SK[id], rk=r(state,id);
  tip.dataset.b=sk.b;
  let ranks="";
  if(sk.ranks) ranks=`<ol>${sk.ranks.map((v,i)=>`<li class="${i<rk?"on":""}${i===rk?" next":""}">${v}</li>`).join("")}</ol>`;
  const add=tryChange(id,1);
  let st;
  if(rk>=sk.max) st=`<div class="st">Maxed.${hoverMode?" Right-click to take a point back.":""}</div>`;
  else if(add.err) st=`<div class="st warn">${add.err}</div>`;
  else st=`<div class="st">${hoverMode?"Click to add a point"+(rk?" · right-click to remove":""):"Ready for a point."}</div>`;
  const cur = sk.ranks && rk ? ` · now ${sk.ranks[rk-1]}` : "";
  tip.innerHTML=`<div class="hd"><span class="ic">${ARC.icon(sk.icon)}</span><div><h3>${sk.name}</h3><div class="tag">${tierTag(sk)}</div></div></div><div class="rk">Rank ${rk} / ${sk.max}${cur}</div><p>${sk.desc}</p>${sk.note?`<p class="rk">${sk.note}</p>`:""}${ranks}${st}
    <div class="ctl"><button type="button" data-d="-1" aria-label="Remove a point">−</button><button type="button" data-d="1" aria-label="Add a point">+</button><button type="button" class="x" data-close>Close</button></div>`;
  tip.hidden=false;
  tip.classList.toggle("sheet",!hoverMode);
  if(hoverMode) place(id);
}
function place(id){
  const btn=document.querySelector(`.node[data-id="${id}"] button`); if(!btn) return;
  const b=btn.getBoundingClientRect(); const tw=tip.offsetWidth, th=tip.offsetHeight;
  let x=b.right+12, y=b.top+b.height/2-th/2;
  if(x+tw>innerWidth-12) x=b.left-tw-12;
  if(x<12) x=Math.max(12,Math.min(innerWidth-tw-12,b.left+b.width/2-tw/2));
  y=Math.max(12,Math.min(innerHeight-th-12,y));
  tip.style.left=x+"px"; tip.style.top=y+"px";
}
function hideTip(){tip.hidden=true;}

/* ---------- events ---------- */
field.addEventListener("click",e=>{
  const n=e.target.closest(".node"); if(!n) return;
  const id=n.dataset.id;
  if(hoverMode){ change(id, e.shiftKey?-1:1); }
  else { selected=id; render(); }
});
field.addEventListener("contextmenu",e=>{const n=e.target.closest(".node"); if(!n) return; e.preventDefault(); change(n.dataset.id,-1);});
field.addEventListener("keydown",e=>{
  const n=e.target.closest(".node"); if(!n) return;
  if(e.key==="Delete"||e.key==="Backspace"||e.key==="-"){e.preventDefault(); change(n.dataset.id,-1);}
  if(e.key==="+"||e.key==="="){e.preventDefault(); change(n.dataset.id,1);}
});
if(hoverMode){
  field.addEventListener("mouseover",e=>{const n=e.target.closest(".node"); if(n&&n.dataset.id!==hovering){hovering=n.dataset.id; showTip(hovering);}});
  field.addEventListener("mouseout",e=>{const n=e.target.closest(".node"); if(n && !n.contains(e.relatedTarget)){hovering=null; hideTip();}});
  field.addEventListener("focusin",e=>{const n=e.target.closest(".node"); if(n){hovering=n.dataset.id; showTip(hovering);}});
  field.addEventListener("focusout",()=>{hovering=null; hideTip();});
} else {
  tip.addEventListener("click",e=>{
    if(e.target.closest("[data-close]")){selected=null; hideTip(); render(); return;}
    const d=e.target.closest("[data-d]"); if(d&&selected) change(selected,+d.dataset.d);
  });
  $("#help").innerHTML='<strong>Tap</strong> a skill to see what it does, then use <strong>+</strong> and <strong>−</strong> to add or remove points. Swipe sideways to see the whole tree. Each branch\'s middle fork opens at 10 points (keep one of two), and its top three let you take two (first at 30 points, second at 40).';
}
addEventListener("scroll",()=>{if(hoverMode&&hovering) place(hovering);},{passive:true});
// touch: a tap anywhere that isn't a skill or the sheet closes the skill sheet
document.addEventListener("click",e=>{
  if(hoverMode||!selected) return;
  // composedPath is fixed at dispatch, so it still holds the sheet even after + / − re-render it
  if(e.composedPath().some(el=>el===tip||(el.classList&&el.classList.contains("node")))) return;
  selected=null; hideTip(); render();
});

$("#namesBtn").addEventListener("click",()=>{showNames=!showNames; try{localStorage.setItem(NAMES_KEY,showNames?"1":"0");}catch(e){} field.classList.toggle("shownames",showNames); $("#namesBtn").setAttribute("aria-pressed",showNames);});
$("#resetAll").addEventListener("click",()=>{state={}; isExample=false; selected=null; hideTip(); setMsg("All points cleared.",true); render();});
$("#clearExample").addEventListener("click",()=>{state={}; isExample=false; setMsg("Empty tree. Start with the bottom skill in any branch.",true); render();});
$("#availMax").addEventListener("change",e=>{
  const v=Math.max(0,Math.min(200,parseInt(e.target.value)||0));
  if(v<total(state)){setMsg(`Your plan already uses ${total(state)} points. Take some back before lowering the total.`,false); e.target.value=availMax; return;}
  availMax=v; render();
});

/* ---------- build codes: three groups of 16 digits (one per skill), same format as the old artifact ---------- */
function encode(){return ["c","m","s"].map(b=>ORDER.filter(id=>SK[id].b===b).map(id=>r(state,id)).join("")).join("-");}
function decode(v){
  const parts=v.replace(/\s/g,"").split("-");
  if(parts.length!==3||parts.some(p=>!/^\d{16}$/.test(p))) return {err:"That code doesn't look right. It should be three groups of 16 digits joined by dashes."};
  const s={};
  for(const [bi,b] of ["c","m","s"].entries()) for(const [i,id] of ORDER.filter(id=>SK[id].b===b).entries()){
    const n=+parts[bi][i]; if(n>SK[id].max) return {err:`${SK[id].name} can't have ${n} points.`}; if(n) s[id]=n;
  }
  for(const b of ["c","m","s"]){const e=checkBranch(s,b); if(e) return {err:e};}
  if(total(s)>availMax) return {err:`That build uses ${total(s)} points, more than your ${availMax} skill points.`};
  return {s};
}
$("#copyCode").addEventListener("click",()=>{
  const v=$("#codeBox").value;
  navigator.clipboard?.writeText(v).then(()=>setMsg("Build code copied.",true)).catch(()=>{$("#codeBox").select(); setMsg("Press Ctrl+C to copy the selected code.",true);});
});
$("#copyLink").addEventListener("click",()=>{
  const url=location.origin+location.pathname+"#b="+encode();
  navigator.clipboard?.writeText(url).then(()=>setMsg("Share link copied.",true)).catch(()=>setMsg(url,true));
});
$("#loadCode").addEventListener("click",()=>{
  const d=decode($("#codeBox").value);
  if(d.err){setMsg("Couldn't load: "+d.err,false);return;}
  state=d.s; isExample=false; setMsg("Build loaded.",true); render();
});

/* ---------- phones: one screen, branches side by side at one size, swipe between them ---------- */
const VIEW_KEY = "arcPlannerView";
let view = "m"; try{ view = localStorage.getItem(VIEW_KEY) || "m"; }catch(e){}
const tabs = $("#tabs");
let cur={tx:0,ty:0,k:1};
const extras=$("#extras"), extrasTools=$("#extrasTools"), header=$(".bar");
const movable=[$("#availMax").closest(".stat"), $(".tools")];
const homes=movable.map(el=>({el,parent:el.parentNode,next:el.nextSibling}));
function placeTools(phone){
  if(phone){ movable.forEach(el=>extrasTools.appendChild(el)); }
  else homes.forEach(h=>h.parent.insertBefore(h.el,h.next&&h.next.parentNode===h.parent?h.next:null));
}
let wasPhone=null;
function applyView(){
  const phone = phoneMQ.matches;
  if(phone!==wasPhone){
    wasPhone=phone;
    document.body.classList.toggle("phone", phone);
    tabs.hidden = !phone; $("#branchHead").hidden = !phone; placeTools(phone); setMenu(false);
    selected=null; hideTip(); build(); render();
  }
  document.documentElement.style.setProperty("--barh", header.offsetHeight+"px");
  if(!phone){ delete document.body.dataset.focus; field.style.removeProperty("--tf"); return; }
  if(!PCX[view]) view="m";
  const sc=field.parentElement, w=sc.clientWidth||innerWidth, h=sc.clientHeight||innerHeight*.7;
  const k=Math.min(w/455, h/(PH-PTOP));
  cur={tx:w/2-PCX[view]*k, ty:-PTOP*k+Math.max(0,(h-(PH-PTOP)*k)/2), k};
  field.style.setProperty("--tf", `translate(${cur.tx.toFixed(1)}px,${cur.ty.toFixed(1)}px) scale(${k.toFixed(4)})`);
  document.body.dataset.focus=view;
  renderHead();
  tabs.querySelectorAll("button").forEach(b=>b.setAttribute("aria-selected", b.dataset.v===view));
}
function setView(v){
  view=v; try{localStorage.setItem(VIEW_KEY,v);}catch(e){}
  if(selected && SK[selected].b!==v){ selected=null; hideTip(); render(); }
  applyView();
}
tabs.addEventListener("click",e=>{const b=e.target.closest("[data-v]"); if(b) setView(b.dataset.v);});
function setMenu(open){
  document.body.classList.toggle("menu-open",open);
  $("#menuBtn").setAttribute("aria-expanded",open);
  if(open){ selected=null; hideTip(); render(); }
}
$("#menuBtn").addEventListener("click",()=>setMenu(!document.body.classList.contains("menu-open")));
$("#menuDone").addEventListener("click",()=>setMenu(false));
// tapping a dimmed neighbour branch brings it into focus instead of changing points
field.addEventListener("click",e=>{
  if(!phoneMQ.matches) return; const n=e.target.closest(".node");
  if(n && n.dataset.b!==view){ e.stopImmediatePropagation(); setView(n.dataset.b); }
},true);
// carousel swipe: the tree follows your finger, then snaps to the next branch (or back)
const ORDERV=["c","m","s"];
let drag=null;
const sc0=field.parentElement;
sc0.addEventListener("touchstart",e=>{
  if(!phoneMQ.matches||e.touches.length!==1){drag=null;return;}
  const t=e.touches[0]; drag={x:t.clientX,y:t.clientY,at:Date.now(),dx:0,lock:null};
},{passive:true});
sc0.addEventListener("touchmove",e=>{
  if(!drag) return; const t=e.touches[0], dx=t.clientX-drag.x, dy=t.clientY-drag.y;
  if(!drag.lock){ if(Math.abs(dx)<8&&Math.abs(dy)<8) return; drag.lock=Math.abs(dx)>Math.abs(dy)?"x":"y"; if(drag.lock==="x") field.classList.add("dragging"); }
  if(drag.lock!=="x") return;
  e.preventDefault();
  const i=ORDERV.indexOf(view), hasNext=ORDERV[i+(dx<0?1:-1)];
  drag.dx = hasNext ? dx : dx*.3;          // rubber band at the ends
  field.style.setProperty("--tf",`translate(${(cur.tx+drag.dx).toFixed(1)}px,${cur.ty.toFixed(1)}px) scale(${cur.k.toFixed(4)})`);
  const p=Math.min(1,Math.abs(drag.dx)/(sc0.clientWidth*.6));
  field.style.setProperty("--peek",p.toFixed(3));
},{passive:false});
function endDrag(){
  if(!drag) return; const d=drag; drag=null;
  field.classList.remove("dragging"); field.style.removeProperty("--peek");
  if(d.lock!=="x") return;
  const v=Math.abs(d.dx)/Math.max(1,Date.now()-d.at), i=ORDERV.indexOf(view);
  const n=ORDERV[i+(d.dx<0?1:-1)];
  if(n && (Math.abs(d.dx)>sc0.clientWidth*.25 || v>.4)) setView(n); else applyView();
}
sc0.addEventListener("touchend",endDrag,{passive:true});
sc0.addEventListener("touchcancel",endDrag,{passive:true});
phoneMQ.addEventListener?.("change",applyView);
addEventListener("resize",applyView);
if(!hoverMode){
  $("#help").innerHTML='<strong>Tap</strong> a skill, then use <strong>+</strong> and <strong>−</strong>. Swipe or use the tabs to switch branches. Forks open at 10 points (keep one of two); top skills at 30 and 40 (take two of three).';
}

load();
const hash=location.hash.match(/^#b=([\d-]+)$/);
if(hash){const d=decode(hash[1]); if(!d.err){state=d.s; isExample=false; history.replaceState(null,"",location.pathname); setTimeout(()=>setMsg("Build loaded from link.",true));}}
applyView();
})();
