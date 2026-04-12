(function(){
/* ── MERGVS Contact Modal ── */
const CSS = `
#mgv-overlay{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:1.5rem;opacity:0;pointer-events:none;transition:opacity 0.45s ease}
#mgv-overlay.open{opacity:1;pointer-events:all}
#mgv-backdrop{position:fixed;inset:0;background:rgba(22,32,18,0.92);backdrop-filter:blur(12px);display:none}
#mgv-box{position:relative;z-index:1;background:#F2EDDF;width:100%;max-width:720px;max-height:90vh;overflow-y:auto;padding:3.5rem;transform:translateY(28px) scale(0.97);transition:transform 0.45s cubic-bezier(0.16,1,0.3,1);scrollbar-width:thin;scrollbar-color:var(--ecru,#D8CDB8) transparent}
#mgv-overlay.open #mgv-box{transform:translateY(0) scale(1)}
#mgv-close{position:absolute;top:1.5rem;right:1.5rem;background:none;border:none;cursor:none;color:#5C4A32;font-size:1.4rem;line-height:1;padding:0.3rem 0.6rem;opacity:0.5;transition:opacity 0.2s;font-family:sans-serif}
#mgv-close:hover{opacity:1}
.mgv-eyebrow{font-family:'Raleway',sans-serif;font-size:0.58rem;font-weight:300;letter-spacing:0.32em;text-transform:uppercase;color:#4A5C40;margin-bottom:0.8rem;display:flex;align-items:center;gap:0.8rem}
.mgv-eyebrow::before{content:'';width:18px;height:1px;background:#4A5C40;flex-shrink:0}
.mgv-title{font-family:'IM Fell English',serif;font-size:clamp(1.6rem,3.5vw,2.6rem);font-weight:400;line-height:1.1;color:#2E3D28;margin-bottom:0.6rem}
.mgv-title em{font-style:italic;color:#8B4A2A}
.mgv-sub{font-family:'Lora',serif;font-style:italic;font-size:0.85rem;line-height:1.8;color:#7A5C3E;margin-bottom:2.5rem}
.mgv-step{display:none}.mgv-step.active{display:block}
.mgv-progress{display:flex;align-items:center;gap:0;margin-bottom:2.5rem;border-bottom:1px solid #D8CDB8;padding-bottom:1.5rem}
.mgv-step-dot{display:flex;align-items:center;gap:0.6rem;flex:1;position:relative}
.mgv-step-dot:not(:last-child)::after{content:'';flex:1;height:1px;background:#D8CDB8;margin:0 0.5rem}
.mgv-dot-num{width:26px;height:26px;border-radius:50%;border:1px solid #D8CDB8;display:flex;align-items:center;justify-content:center;font-family:'Cinzel',serif;font-size:0.55rem;color:#8A8070;transition:all 0.3s;flex-shrink:0}
.mgv-dot-label{font-family:'Raleway',sans-serif;font-size:0.5rem;font-weight:300;letter-spacing:0.18em;text-transform:uppercase;color:#8A8070;transition:color 0.3s}
.mgv-step-dot.active .mgv-dot-num{border-color:#4A5C40;background:#4A5C40;color:#F7F3EB}
.mgv-step-dot.active .mgv-dot-label{color:#2E3D28}
.mgv-step-dot.done .mgv-dot-num{border-color:#4A5C40;background:#EAE2CE;color:#4A5C40}

/* PANELS */
.mgv-panel{display:none}.mgv-panel.active{display:block}
.mgv-section-label{font-family:'Raleway',sans-serif;font-size:0.55rem;font-weight:300;letter-spacing:0.28em;text-transform:uppercase;color:#8A8070;margin-bottom:1rem;margin-top:2rem}
.mgv-section-label:first-child{margin-top:0}

/* CHECKBOX CARDS */
.mgv-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:0.6rem;margin-bottom:0.5rem}
.mgv-card{border:1px solid #D8CDB8;padding:1rem 1.1rem;cursor:pointer;transition:all 0.25s;position:relative;background:#F7F3EB}
.mgv-card:hover{border-color:#8A9C7A;background:#EAE2CE}
.mgv-card.selected{border-color:#4A5C40;background:rgba(74,92,64,0.06)}
.mgv-card.selected::after{content:'✓';position:absolute;top:0.5rem;right:0.6rem;font-size:0.65rem;color:#4A5C40;font-family:sans-serif}
.mgv-card-title{font-family:'IM Fell English',serif;font-size:0.95rem;color:#2E3D28;margin-bottom:0.2rem}
.mgv-card-sub{font-family:'Lora',serif;font-size:0.68rem;color:#8A8070;font-style:italic}
.mgv-cards-2{grid-template-columns:repeat(2,1fr)}
.mgv-card-label{font-family:'Raleway',sans-serif;font-size:0.58rem;font-weight:300;letter-spacing:0.14em;text-transform:uppercase;color:#4A3C28;display:block;margin-top:0.2rem}
.mgv-card-icon{font-size:1.3rem;display:block;margin-bottom:0.4rem;color:#4A5C40}

/* SLIDER */
.mgv-slider-wrap{margin:1rem 0 0.5rem;padding:0 0.2rem}
.mgv-slider-labels{display:flex;justify-content:space-between;margin-bottom:0.8rem}
.mgv-slider-val{font-family:'IM Fell English',serif;font-size:1.8rem;color:#2E3D28;line-height:1}
.mgv-slider-hint{font-family:'Raleway',sans-serif;font-size:0.5rem;letter-spacing:0.18em;text-transform:uppercase;color:#8A8070;margin-top:0.2rem}
input[type=range].mgv-range{width:100%;-webkit-appearance:none;appearance:none;height:2px;background:linear-gradient(to right,#4A5C40 var(--pct,30%),#D8CDB8 var(--pct,30%));border:none;outline:none;cursor:pointer}
input[type=range].mgv-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:20px;height:20px;border-radius:50%;background:#2E3D28;border:2px solid #F2EDDF;box-shadow:0 0 0 1px #4A5C40;cursor:pointer}
input[type=range].mgv-range::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:#2E3D28;border:2px solid #F2EDDF;box-shadow:0 0 0 1px #4A5C40;cursor:pointer}

/* TEXT INPUTS */
.mgv-fields{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem}
.mgv-field{display:flex;flex-direction:column;gap:0.4rem}
.mgv-field.full{grid-column:1/-1}
.mgv-label{font-family:'Raleway',sans-serif;font-size:0.52rem;font-weight:300;letter-spacing:0.22em;text-transform:uppercase;color:#8A8070}
.mgv-input{font-family:'Lora',serif;font-size:0.85rem;color:#2E3D28;background:transparent;border:none;border-bottom:1px solid #D8CDB8;padding:0.6rem 0;outline:none;transition:border-color 0.3s;width:100%}
.mgv-input:focus{border-color:#4A5C40}
.mgv-input::placeholder{color:#C8BEA8}
select.mgv-input{appearance:none;cursor:pointer}

/* BUTTONS */
.mgv-btns{display:flex;align-items:center;justify-content:space-between;margin-top:2.5rem;padding-top:2rem;border-top:1px solid #D8CDB8}
.mgv-btn-next{font-family:'Raleway',sans-serif;font-size:0.62rem;font-weight:300;letter-spacing:0.22em;text-transform:uppercase;background:#2E3D28;color:#F7F3EB;border:none;padding:1rem 2.5rem;cursor:pointer;transition:all 0.3s}
.mgv-btn-next:hover{background:#4A5C40;transform:translateY(-1px)}
.mgv-btn-back{font-family:'Lora',serif;font-style:italic;font-size:0.82rem;color:#8A8070;background:none;border:none;cursor:pointer;transition:color 0.3s;display:flex;align-items:center;gap:0.5rem}
.mgv-btn-back:hover{color:#2E3D28}
.mgv-btn-back::before{content:'←';font-style:normal}

/* SUCCESS */
#mgv-success{display:none;text-align:center;padding:3rem 0}
#mgv-success .mgv-s-icon{width:60px;height:60px;margin:0 auto 2rem}
#mgv-success .mgv-s-title{font-family:'IM Fell English',serif;font-size:2rem;color:#2E3D28;margin-bottom:1rem}
#mgv-success .mgv-s-title em{font-style:italic;color:#8B4A2A}
#mgv-success .mgv-s-sub{font-family:'Lora',serif;font-style:italic;font-size:0.88rem;line-height:1.9;color:#7A5C3E;max-width:380px;margin:0 auto}

/* FLOAT BTN */
#mgv-float{position:fixed;bottom:2.2rem;right:2.2rem;z-index:5000;display:flex;flex-direction:column;align-items:flex-end;gap:0.6rem;pointer-events:none}
#mgv-float-btn{pointer-events:all;background:#2E3D28;color:#F7F3EB;border:none;font-family:'Raleway',sans-serif;font-size:0.58rem;font-weight:300;letter-spacing:0.2em;text-transform:uppercase;padding:0.85rem 1.5rem;cursor:pointer;transition:all 0.3s;display:flex;align-items:center;gap:0.7rem;box-shadow:0 4px 24px rgba(22,32,18,0.28)}
#mgv-float-btn:hover{background:#4A5C40;transform:translateY(-2px);box-shadow:0 8px 32px rgba(22,32,18,0.35)}
#mgv-float-pulse{width:8px;height:8px;border-radius:50%;background:#B8C9A8;animation:mgvPulse 2s ease-in-out infinite}
#mgv-float-tip{pointer-events:none;font-family:'Lora',serif;font-style:italic;font-size:0.72rem;color:#F7F3EB;background:rgba(46,61,40,0.92);padding:0.4rem 0.8rem;opacity:0;transform:translateX(8px);transition:all 0.3s;white-space:nowrap}
#mgv-float:hover #mgv-float-tip{opacity:1;transform:translateX(0)}
@keyframes mgvPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.7)}}
@media(max-width:768px){
  #mgv-box{padding:2rem 1.4rem}
  .mgv-cards{grid-template-columns:1fr 1fr}
  .mgv-fields{grid-template-columns:1fr}
  .mgv-progress{display:none}
  #mgv-float{bottom:1.2rem;right:1.2rem}
}
@media(max-width:480px){.mgv-cards{grid-template-columns:1fr}}
`;

/* ── HTML TEMPLATE ── */
const HTML = `
<div id="mgv-backdrop"></div>
<div id="mgv-overlay" role="dialog" aria-modal="true" aria-label="Contact MERGVS">
  <button id="mgv-close" aria-label="Close">✕</button>
  <div id="mgv-box">

    <!-- PROGRESS -->
    <div class="mgv-progress" aria-hidden="true">
      <div class="mgv-step-dot active" data-step="0">
        <span class="mgv-dot-num">1</span>
        <span class="mgv-dot-label">Property</span>
      </div>
      <div class="mgv-step-dot" data-step="1">
        <span class="mgv-dot-num">2</span>
        <span class="mgv-dot-label">Services</span>
      </div>
      <div class="mgv-step-dot" data-step="2">
        <span class="mgv-dot-num">3</span>
        <span class="mgv-dot-label">Contact</span>
      </div>
    </div>

    <!-- STEP 1: PROPERTY -->
    <div class="mgv-step active" data-step="0">
      <p class="mgv-eyebrow">Step 1 of 3</p>
      <h2 class="mgv-title">Tell us about<br>your <em>property</em></h2>
      <p class="mgv-sub">We'll tailor our approach to your specific asset.</p>

      <div style="margin-bottom:1.8rem">
        <p style="font-family:'Raleway',sans-serif;font-size:0.6rem;font-weight:300;letter-spacing:0.18em;text-transform:uppercase;color:#7A5C3E;margin-bottom:0.9rem">I am</p>
        <div class="mgv-cards" style="grid-template-columns:repeat(2,1fr)">
          <label class="mgv-card">
            <input type="radio" name="mgv-role" value="Agent / Estate Professional" hidden>
            <span class="mgv-card-icon" style="font-size:1.1rem">◇</span>
            <span class="mgv-card-label">Agent / Professional</span>
            <span style="font-family:'Lora',serif;font-size:0.66rem;color:#8A8070;font-style:italic;display:block;margin-top:0.3rem">No cost · commission model</span>
          </label>
          <label class="mgv-card">
            <input type="radio" name="mgv-role" value="Private Owner / Seller" hidden>
            <span class="mgv-card-icon" style="font-size:1.1rem">◈</span>
            <span class="mgv-card-label">Private Owner / Seller</span>
            <span style="font-family:'Lora',serif;font-size:0.66rem;color:#8A8070;font-style:italic;display:block;margin-top:0.3rem">Fixed production packages</span>
          </label>
        </div>
      </div>

      <div style="margin-top:1.8rem">
        <p style="font-family:'Raleway',sans-serif;font-size:0.6rem;font-weight:300;letter-spacing:0.18em;text-transform:uppercase;color:#7A5C3E;margin-bottom:0.9rem">City</p>
        <div class="mgv-cards" style="grid-template-columns:repeat(4,1fr)">
          <label class="mgv-card">
            <input type="radio" name="mgv-city" value="Luxembourg" hidden>
            <span style="font-size:1.4rem;display:block;margin-bottom:0.4rem">🇱🇺</span>
            <span class="mgv-card-label">Luxembourg</span>
          </label>
          <label class="mgv-card">
            <input type="radio" name="mgv-city" value="Milan" hidden>
            <span style="font-size:1.4rem;display:block;margin-bottom:0.4rem">🇮🇹</span>
            <span class="mgv-card-label">Milan</span>
          </label>
          <label class="mgv-card">
            <input type="radio" name="mgv-city" value="Istanbul" hidden>
            <span style="font-size:1.4rem;display:block;margin-bottom:0.4rem">🇹🇷</span>
            <span class="mgv-card-label">Istanbul</span>
          </label>
          <label class="mgv-card">
            <input type="radio" name="mgv-city" value="Other" hidden>
            <span style="font-size:1.4rem;display:block;margin-bottom:0.4rem">🌍</span>
            <span class="mgv-card-label">Other</span>
          </label>
        </div>
      </div>

      <div style="margin-top:1.6rem">
        <p style="font-family:'Raleway',sans-serif;font-size:0.6rem;font-weight:300;letter-spacing:0.18em;text-transform:uppercase;color:#7A5C3E;margin-bottom:0.9rem">Property Type</p>
        <div class="mgv-cards">
          <label class="mgv-card">
            <input type="radio" name="mgv-type" value="Apartment" hidden>
            <span class="mgv-card-icon">⬜</span>
            <span class="mgv-card-label">Apartment</span>
          </label>
          <label class="mgv-card">
            <input type="radio" name="mgv-type" value="Villa" hidden>
            <span class="mgv-card-icon">🏛</span>
            <span class="mgv-card-label">Villa</span>
          </label>
          <label class="mgv-card">
            <input type="radio" name="mgv-type" value="Penthouse" hidden>
            <span class="mgv-card-icon">◈</span>
            <span class="mgv-card-label">Penthouse</span>
          </label>
          <label class="mgv-card">
            <input type="radio" name="mgv-type" value="Commercial" hidden>
            <span class="mgv-card-icon">▦</span>
            <span class="mgv-card-label">Commercial</span>
          </label>
        </div>
      </div>

      <div style="margin-top:1.8rem">
        <div class="mgv-slider-wrap">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:0.6rem">
            <p style="font-family:'Raleway',sans-serif;font-size:0.6rem;font-weight:300;letter-spacing:0.18em;text-transform:uppercase;color:#7A5C3E;margin:0">Listing Price</p>
            <span id="mgv-price-display" style="font-family:'Lora',serif;font-size:1rem;color:#2E3D28;font-weight:400">€2,000,000</span>
          </div>
          <input type="range" class="mgv-range" id="mgv-price-slider" min="0" max="100" value="25" step="1">
          <div style="display:flex;justify-content:space-between;margin-top:0.3rem">
            <span style="font-family:'Raleway',sans-serif;font-size:0.58rem;letter-spacing:0.1em;color:#B0A090">€500K</span>
            <span style="font-family:'Raleway',sans-serif;font-size:0.58rem;letter-spacing:0.1em;color:#B0A090">€20M+</span>
          </div>
        </div>
      </div>

      <div class="mgv-btns">
        <button class="mgv-btn-next" id="mgv-next-1">Continue →</button>
      </div>
    </div>

    <!-- STEP 2: SERVICES -->
    <div class="mgv-step" data-step="1">
      <p class="mgv-eyebrow">Step 2 of 3</p>
      <h2 class="mgv-title">What do you<br>need <em>created</em>?</h2>
      <p class="mgv-sub">Select all that apply. We'll build a tailored proposal.</p>

      <div class="mgv-cards" style="margin-top:1.8rem;grid-template-columns:repeat(2,1fr)">
        <label class="mgv-card">
          <input type="checkbox" name="mgv-svc" value="3D Immersive Tour" hidden>
          <span class="mgv-card-icon" style="font-size:1.1rem">⟐</span>
          <span class="mgv-card-label">3D Immersive Tour</span>
        </label>
        <label class="mgv-card">
          <input type="checkbox" name="mgv-svc" value="Cinematic Video" hidden>
          <span class="mgv-card-icon" style="font-size:1.1rem">▶</span>
          <span class="mgv-card-label">Cinematic Video</span>
        </label>
        <label class="mgv-card">
          <input type="checkbox" name="mgv-svc" value="Photography Editing" hidden>
          <span class="mgv-card-icon" style="font-size:1.1rem">◎</span>
          <span class="mgv-card-label">Photo Editing</span>
        </label>
        <label class="mgv-card">
          <input type="checkbox" name="mgv-svc" value="Virtual Staging" hidden>
          <span class="mgv-card-icon" style="font-size:1.1rem">□</span>
          <span class="mgv-card-label">Virtual Staging</span>
        </label>
        <label class="mgv-card">
          <input type="checkbox" name="mgv-svc" value="Presentation Boards" hidden>
          <span class="mgv-card-icon" style="font-size:1.1rem">≡</span>
          <span class="mgv-card-label">Presentation Boards</span>
        </label>
        <label class="mgv-card">
          <input type="checkbox" name="mgv-svc" value="Full Package" hidden>
          <span class="mgv-card-icon" style="font-size:1.1rem">◈</span>
          <span class="mgv-card-label">Full Package</span>
        </label>
      </div>

      <div class="mgv-btns">
        <button class="mgv-btn-back" id="mgv-back-2">← Back</button>
        <button class="mgv-btn-next" id="mgv-next-2">Continue →</button>
      </div>
    </div>

    <!-- STEP 3: CONTACT -->
    <div class="mgv-step" data-step="2">
      <p class="mgv-eyebrow">Step 3 of 3</p>
      <h2 class="mgv-title">How should<br>we <em>reach you</em>?</h2>
      <p class="mgv-sub">We respond within 24 hours, always personally.</p>

      <div class="mgv-fields" style="margin-top:1.8rem">
        <div class="mgv-field">
          <label class="mgv-label" for="mgv-name">Full Name</label>
          <input class="mgv-input" type="text" id="mgv-name" placeholder="Your name" autocomplete="name">
        </div>
        <div class="mgv-field">
          <label class="mgv-label" for="mgv-email">Email Address</label>
          <input class="mgv-input" type="email" id="mgv-email" placeholder="your@email.com" autocomplete="email">
        </div>
        <div class="mgv-field">
          <label class="mgv-label" for="mgv-phone">Phone (optional)</label>
          <input class="mgv-input" type="tel" id="mgv-phone" placeholder="+352 …" autocomplete="tel">
        </div>
        <div class="mgv-field">
          <label class="mgv-label" for="mgv-timeline">Timeline</label>
          <select class="mgv-input" id="mgv-timeline" style="appearance:none;cursor:pointer">
            <option value="">Select…</option>
            <option value="This month">This month</option>
            <option value="1-3 months">1–3 months</option>
            <option value="3-6 months">3–6 months</option>
            <option value="Just exploring">Just exploring</option>
          </select>
        </div>
      </div>

      <div class="mgv-btns">
        <button class="mgv-btn-back" id="mgv-back-3">← Back</button>
        <button class="mgv-btn-next" id="mgv-submit" style="background:#2E3D28">Send Request →</button>
      </div>
    </div>

    <!-- SUCCESS -->
    <div id="mgv-success">
      <img src="https://mergvs.com/mergvs-son.png" alt="MERGVS" style="width:60px;height:60px;object-fit:contain;opacity:0.8;margin-bottom:1.2rem">
      <h2 class="mgv-s-title">Your request<br>has been <em>received</em>.</h2>
      <p class="mgv-s-sub">We'll be in touch within 24 hours to discuss<br>your property and what we can create together.</p>
    </div>

  </div>
</div>

<!-- FLOAT BUTTON -->
<div id="mgv-float">
  <span id="mgv-float-tip">Request a presentation</span>
  <button id="mgv-float-btn">
    <span id="mgv-float-pulse"></span>
    Begin your story
  </button>
</div>
`;

/* ── PRICE SCALE ── */
const PRICE_SCALE = [
  500000,700000,900000,1100000,1300000,1500000,1800000,2100000,2500000,3000000,
  3500000,4000000,4500000,5000000,5500000,6000000,6500000,7000000,7500000,8000000,
  8500000,9000000,9500000,10000000,11000000,12000000,13000000,14000000,15000000,
  16000000,17000000,18000000,19000000,20000000
];

function fmtPrice(v){
  if(v>=1000000) return '€'+(v/1000000).toLocaleString('en',{minimumFractionDigits:v%1000000===0?0:1,maximumFractionDigits:1})+'M';
  return '€'+(v/1000).toFixed(0)+'K';
}

/* ── INJECT ── */
function inject(){
  const style=document.createElement('style');
  style.textContent=CSS;
  document.head.appendChild(style);

  const wrap=document.createElement('div');
  wrap.innerHTML=HTML;
  document.body.appendChild(wrap);

  init();
}

/* ── INIT ── */
function init(){
  let currentStep=0;
  const steps=document.querySelectorAll('.mgv-step');
  const dots=document.querySelectorAll('.mgv-step-dot');
  const overlay=document.getElementById('mgv-overlay');
  const backdrop=document.getElementById('mgv-backdrop');

  /* Open / close */
  function open(){
    overlay.classList.add('open');
    backdrop.style.display='block';
    document.body.style.overflow='hidden';
    goTo(0);
  }
  function close(){
    overlay.classList.remove('open');
    backdrop.style.display='none';
    document.body.style.overflow='';
  }

  document.getElementById('mgv-close').addEventListener('click',close);
  backdrop.addEventListener('click',close);
  document.getElementById('mgv-float-btn').addEventListener('click',open);

  /* Wire all [data-mgv-open] triggers */
  document.querySelectorAll('[data-mgv-open]').forEach(el=>{
    el.addEventListener('click',function(e){e.preventDefault();open();});
  });

  /* Step nav */
  function goTo(n){
    steps.forEach((s,i)=>{
      s.classList.toggle('active',i===n);
    });
    dots.forEach((d,i)=>{
      d.classList.toggle('active',i===n);
      d.classList.toggle('done',i<n);
    });
    currentStep=n;
    overlay.scrollTop=0;
  }

  document.getElementById('mgv-next-1').addEventListener('click',function(){goTo(1);});
  document.getElementById('mgv-next-2').addEventListener('click',function(){goTo(2);});
  document.getElementById('mgv-back-2').addEventListener('click',function(){goTo(0);});
  document.getElementById('mgv-back-3').addEventListener('click',function(){goTo(1);});

  /* Radio/checkbox card toggle */
  document.querySelectorAll('.mgv-card input[type="radio"]').forEach(function(inp){
    inp.addEventListener('change',function(){
      const name=this.name;
      document.querySelectorAll('.mgv-card input[name="'+name+'"]').forEach(function(r){
        r.closest('.mgv-card').classList.toggle('selected',r.checked);
      });
    });
  });
  document.querySelectorAll('.mgv-card input[type="checkbox"]').forEach(function(inp){
    inp.addEventListener('change',function(){
      this.closest('.mgv-card').classList.toggle('selected',this.checked);
    });
  });

  /* Price slider */
  const slider=document.getElementById('mgv-price-slider');
  const display=document.getElementById('mgv-price-display');
  if(slider){
    slider.max=PRICE_SCALE.length-1;
    slider.value=Math.floor(PRICE_SCALE.length*0.25);
    function updateSlider(){
      const idx=parseInt(slider.value);
      const price=PRICE_SCALE[idx];
      const isMax=idx===PRICE_SCALE.length-1;
      display.textContent=(isMax?'':'') + fmtPrice(price) + (isMax?'+':'');
      const pct=(idx/(PRICE_SCALE.length-1))*100;
      slider.style.setProperty('--pct',pct+'%');
    }
    slider.addEventListener('input',updateSlider);
    updateSlider();
  }

  /* Submit */
  document.getElementById('mgv-submit').addEventListener('click',function(){
    const name=document.getElementById('mgv-name').value.trim();
    const email=document.getElementById('mgv-email').value.trim();
    if(!name||!email){
      document.getElementById('mgv-email').focus();
      document.getElementById('mgv-email').style.borderColor='#8B4A2A';
      setTimeout(function(){document.getElementById('mgv-email').style.borderColor='';},2000);
      return;
    }

    /* Gather data */
    const role=(document.querySelector('input[name="mgv-role"]:checked')||{}).value||'Not specified';
    const city=(document.querySelector('input[name="mgv-city"]:checked')||{}).value||'Not specified';
    const type=(document.querySelector('input[name="mgv-type"]:checked')||{}).value||'Not specified';
    const priceIdx=document.getElementById('mgv-price-slider').value;
    const price=fmtPrice(PRICE_SCALE[parseInt(priceIdx)])+(parseInt(priceIdx)===PRICE_SCALE.length-1?'+':'');
    const svcs=Array.from(document.querySelectorAll('input[name="mgv-svc"]:checked')).map(function(i){return i.value;}).join(', ')||'Not specified';
    const phone=document.getElementById('mgv-phone').value.trim();
    const timeline=document.getElementById('mgv-timeline').value||'Not specified';

    /* Send to Formspree */
    var btn=document.getElementById('mgv-submit');
    btn.disabled=true;
    btn.textContent='Sending…';

    fetch('https://formspree.io/f/xeepddyq',{
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify({
        name:name,
        email:email,
        phone:phone||'—',
        role:role,
        city:city,
        property_type:type,
        listing_price:price,
        services:svcs,
        timeline:timeline,
        _subject:'MERGVS Inquiry — '+role+' · '+city+' / '+price,
        _replyto:email
      })
    }).then(function(res){
      if(res.ok){
        steps.forEach(function(s){s.style.display='none';});
        document.querySelector('.mgv-progress').style.display='none';
        document.getElementById('mgv-success').style.display='flex';
      }else{
        btn.disabled=false;
        btn.textContent='Send Request →';
        btn.style.background='#8B4A2A';
        setTimeout(function(){btn.style.background='#2E3D28';},2000);
      }
    }).catch(function(){
      btn.disabled=false;
      btn.textContent='Send Request →';
      btn.style.background='#8B4A2A';
      setTimeout(function(){btn.style.background='#2E3D28';},2000);
    });
  });

  /* Keyboard close */
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape') close();
  });
}

/* ── BOOT ── */
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',inject);
}else{
  inject();
}

})();
