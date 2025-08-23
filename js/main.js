const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
const COOKIE_KEY = 'uk_degree_calc_v4_kpi_highlight';

let state = { modules: [], settings: { saveCookie: true, scheme: 'ug', ug_policy: 'before_2023' } };

// ---------- Level options per scheme ----------
function levelOptionsForScheme(){
    const s = state.settings.scheme;
    if (s === 'ug') return [5,6];
    if (s === 'im') return [6,7];
    if (s === 'masters') return [7];
    return [5,6];
}

function rowTemplate(mod, idx) {
    const opts = levelOptionsForScheme();
    const level = opts.includes(mod.level) ? mod.level : opts[0]; // side-effect free
    const optionsHtml = opts.map(v=>`<option value="${v}" ${level===v? 'selected' : ''}>${v}</option>`).join('');
    const disabled = (opts.length===1) ? 'disabled' : '';
    const code = (mod.code || '').toUpperCase();
    return `<tr data-idx="${idx}">
    <td><select aria-label="Level" ${disabled}>${optionsHtml}</select></td>
    <td><input type="text" class="code" placeholder="PWNZ1337" value="${code}"
                aria-label="Module code" minlength="7" maxlength="8" pattern="[A-Za-z]{3,4}\\d{4}"
                title="3–4 letters followed by 4 digits (e.g., PWNZ1337)" /></td>
    <td><input type="number" inputmode="numeric" min="0"  placeholder="15" value="${Number.isFinite(mod.credits) ? mod.credits : ''}" aria-label="Credits" /></td>
    <td><input type="number" inputmode="decimal" min="0" max="100" placeholder="65" value="${Number.isFinite(mod.mark) ? mod.mark : ''}" aria-label="Mark" /></td>
    <td class="row-actions">
        <button class="btn-duplicate" data-action="dup" title="Duplicate">⎘</button>
        <button class="btn-danger" data-action="del" title="Delete">✕</button>
    </td>
    </tr>`;
}

function renderTable(){
    const tbody = $('#rows');
    tbody.innerHTML = state.modules.map((m,i)=>rowTemplate(m,i)).join('');
    attachRowListeners();
    applyDuplicateHighlight();
}

function attachRowListeners() {
    $$('#rows tr').forEach(tr => {
        const idx = +tr.dataset.idx;
        const [selLevel, inpCode, inpCred, inpMark] = $$('select, input', tr);

        if (selLevel && !selLevel.disabled) {
            selLevel.addEventListener('change', () => {
                state.modules[idx].level = +selLevel.value;
                recompute(); // structural: re-render rows is fine
            });
        }

        // CODE: uppercase in-place, no re-render
        inpCode.addEventListener('input', () => {
            const up = inpCode.value.toUpperCase().slice(0, 8);
            if (up !== inpCode.value) inpCode.value = up;
            state.modules[idx].code = up;
            applyDuplicateHighlight();   // also triggers KPI refresh
            persistMaybe();
            // no recompute() here
        });

        // CREDITS: parse to number; empty => NaN; update KPIs only
        inpCred.addEventListener('input', () => {
            state.modules[idx].credits = (inpCred.value === '') ? NaN : inpCred.valueAsNumber;
            renderKPIsAndExplain();
            updateCreditHint();
            persistMaybe();
            // no recompute() here
        });

        // MARK: parse to number; empty => NaN; update KPIs only
        inpMark.addEventListener('input', () => {
            state.modules[idx].mark = (inpMark.value === '') ? NaN : inpMark.valueAsNumber;
            renderKPIsAndExplain();
            updateCreditHint();
            persistMaybe();
            // no recompute() here
        });

        tr.querySelector('[data-action="del"]').addEventListener('click', () => {
            state.modules.splice(idx,1);
            recompute(); // structural
        });

        tr.querySelector('[data-action="dup"]').addEventListener('click', () => {
            state.modules.splice(idx+1,0, {...state.modules[idx]} );
            recompute(); // structural
        });
    });
}

// ---------- Helpers ----------
const sumCredits = items => items.reduce((s,m)=> s + (Number.isFinite(m.credits)?m.credits:0), 0);
const sumCW = items => items.reduce((s,m)=> s + (Number.isFinite(m.credits)&&Number.isFinite(m.mark) ? m.credits * m.mark : 0), 0);
const weightedAverage = items => { const c=sumCredits(items); if(!c) return null; return sumCW(items)/c; };

function selectBestCredits(mods, CAP){
    const n = mods.length, cap = CAP;
    const W = mods.map(m=>m.credits|0), V = mods.map(m=> (m.credits|0) * (m.mark||0));
    const dp = Array.from({length: n+1}, ()=> Array(cap+1).fill(0));
    const take = Array.from({length: n+1}, ()=> Array(cap+1).fill(false));
    for (let i=1;i<=n;i++){
        for (let c=0;c<=cap;c++){
            dp[i][c] = dp[i-1][c];
            if (W[i-1] <= c) {
                const alt = dp[i-1][c-W[i-1]] + V[i-1];
                if (alt > dp[i][c]) { dp[i][c] = alt; take[i][c] = true; }
            }
        }
    }
    let c = cap; const picked = [];
    for (let i=n;i>=1;i--){ if (take[i][c]) { picked.push(mods[i-1]); c -= W[i-1]; } }
    return { picked, pickedCredits: sumCredits(picked) };
}

// ---------- Schemes (levels only: 5,6,7) ----------
function computeUG(mods){
    const l5 = mods.filter(m=>m.level===5 && Number.isFinite(m.credits) && Number.isFinite(m.mark));
    const l6 = mods.filter(m=>m.level===6 && Number.isFinite(m.credits) && Number.isFinite(m.mark));
    const totalL5 = sumCredits(l5); let l5avg=null;
    if (totalL5>0){ if (totalL5<=120) l5avg = weightedAverage(l5); else { const {picked, pickedCredits} = selectBestCredits(l5,120); if(pickedCredits>0) l5avg = sumCW(picked)/pickedCredits; } }
    const totalL6 = sumCredits(l6); let best90Avg=null;
    if (totalL6>0){ const {picked, pickedCredits} = selectBestCredits(l6,90); if(pickedCredits>0) best90Avg = sumCW(picked)/pickedCredits; }
    const oldAlgo = (l5avg==null || best90Avg==null)? null : (0.2*l5avg + 0.8*best90Avg);
    const newAlgo = (l5avg==null || best90Avg==null)? null : (0.1*l5avg + 0.9*best90Avg);
    return { l5avg, best90Avg, totalL5, totalL6, oldAlgo, newAlgo };
}

function computeIM(mods){ // Integrated Masters: L6 (20%) + L7 (80%), full spreads capped at 120 each
    const l6 = mods.filter(m=>m.level===6 && Number.isFinite(m.credits) && Number.isFinite(m.mark));
    const l7 = mods.filter(m=>m.level===7 && Number.isFinite(m.credits) && Number.isFinite(m.mark));
    function avgCap120(list){ const t=sumCredits(list); if(!t) return null; if(t<=120) return weightedAverage(list); const {picked, pickedCredits} = selectBestCredits(list,120); return pickedCredits? sumCW(picked)/pickedCredits : null; }
    const l6avg = avgCap120(l6), l7avg = avgCap120(l7);
    const final = (l6avg==null || l7avg==null)? null : (0.2*l6avg + 0.8*l7avg);
    return { l6avg, l7avg, totalL6: sumCredits(l6), totalL7: sumCredits(l7), final };
}

function computeMasters(mods){ // Level 7 average of all
    const l7 = mods.filter(m=>m.level===7 && Number.isFinite(m.credits) && Number.isFinite(m.mark));
    const avg = weightedAverage(l7);
    return { avg, total: sumCredits(l7) };
}

// ---------- Classification ----------
function classifyUG(mark){ if (mark==null) return { cls:'—', badge:'bad' }; if (mark>=70) return {cls:'First Class Honours', badge:'ok'}; if (mark>=60) return {cls:'Upper Second (2:1)', badge:'ok'}; if (mark>=50) return {cls:'Lower Second (2:2)', badge:'warn'}; if (mark>=40) return {cls:'Third Class', badge:'warn'}; return {cls:'Fail', badge:'bad'}; }
function classifyIM_M(mark){ if (mark==null) return { cls:'—', badge:'bad' }; if (mark>=70) return {cls:'First Class Honours', badge:'ok'}; if (mark>=60) return {cls:'Upper Second (2:1)', badge:'ok'}; if (mark>=50) return {cls:'Lower Second (2:2)', badge:'warn'}; return {cls:'Fail', badge:'bad'}; }

const fmt = n => n==null? '—' : (Math.round(n*10)/10).toFixed(1);

function renderKPIsAndExplain(){
    const area = $('#kpiArea'); const exp = $('#explain'); const thresh = $('#thresholdsText');
    const scheme = state.settings.scheme; const ugPolicy = state.settings.ug_policy; const warnings = [];
    let finalMark = null;

    if (scheme==='ug'){
        const r = computeUG(state.modules);
        const tiles = [];
        tiles.push(`<div class="tile"><div class="label">L5 avg</div><div class="value">${fmt(r.l5avg)}</div></div>`);
        tiles.push(`<div class="tile"><div class="label">L6 avg</div><div class="value">${fmt(r.best90Avg)}</div></div>`);
        if (ugPolicy==='before_2023'){
            const oldV = r.oldAlgo, newV = r.newAlgo;
            const oldGood = (oldV!=null && newV!=null && oldV>newV);
            const newGood = (oldV!=null && newV!=null && newV>=oldV);
            tiles.push(`<div class="tile ${oldGood?'good':''}"><div class="label">Before 2023 (20/80)</div><div class="value">${fmt(oldV)}</div></div>`);
            tiles.push(`<div class="tile ${newGood?'good':''}"><div class="label">On or after 2023 (10/90)</div><div class="value">${fmt(newV)}</div></div>`);
            finalMark = (oldV==null||newV==null) ? null : Math.max(oldV,newV);
            exp.innerHTML = `
        <ul>
            <li><strong>L5 average:</strong> credit-weighted mean across L5 modules, capped at 120 total credits (if exceeded, best 120 by value).</li>
            <li><strong>L6 best 90:</strong> selection up to 90 credits by highest credit-weighted value; overall L6 entry should not exceed 120.</li>
            <li><strong>before_2023 policy:</strong> we compute both <span class="mono">0.2×L5 + 0.8×L6best90</span> and <span class="mono">0.1×L5 + 0.9×L6best90</span> and take the higher.</li>
        </ul>`;
        } else { // ugPolicy === 'new'
            tiles.push(`<div class="tile good"><div class="label">Final (10/90)</div><div class="value">${fmt(r.newAlgo)}</div></div>`);
            finalMark = r.newAlgo;
            exp.innerHTML = `
        <ul>
            <li><strong>L5 average:</strong> credit-weighted mean across L5 modules, capped at 120 total credits.</li>
            <li><strong>L6 best 90:</strong> selection up to 90 credits by highest credit-weighted value.</li>
            <li><strong>Policy:</strong> Starters in or after 2023/24+ use <span class="mono"> Only use (10/90) with best of 90 credits at level 6</span>.</li>
        </ul>`;
        }
        area.innerHTML = tiles.join('');
        if (r.totalL6 < 90 && r.totalL6>0) warnings.push(`Only ${r.totalL6} L6 credits entered; using all for L6 average.`);
        if (r.totalL5>120) warnings.push(`L5 exceeds 120 credits; using best 120 for L5 avg.`);
        if (r.totalL6>120) warnings.push(`L6 exceeds 120 credits; overall cap is 120 for validity.`);
        thresh.innerHTML = '<strong>Undergraduate classes:</strong> 1st ≥ 70 · 2:1 ≥ 60 · 2:2 ≥ 50 · 3rd ≥ 40 · Fail &lt; 40';
    }
    else if (scheme==='im'){
        const r = computeIM(state.modules);
        area.innerHTML = `
        <div class="tile"><div class="label">L6 avg</div><div class="value">${fmt(r.l6avg)}</div></div>
        <div class="tile"><div class="label">L7 avg</div><div class="value">${fmt(r.l7avg)}</div></div>
        <div class="tile good"><div class="label">Final (20/80)</div><div class="value">${fmt(r.final)}</div></div>`;
        if (r.totalL6>120) warnings.push('Level 6 exceeds 120 credits; using best 120.');
        if (r.totalL7>120) warnings.push('Level 7 exceeds 120 credits; using best 120.');
        finalMark = r.final;
        exp.innerHTML = `
        <ul>
        <li><strong>Level 6 (20%):</strong> average of all L6 modules (capped at 120 credits).</li>
        <li><strong>Level 7 (80%):</strong> average of all L7 modules (capped at 120 credits).</li>
        <li><strong>Final:</strong> <span class="mono">0.2×L6 + 0.8×L7</span></li>
        </ul>`;
        thresh.innerHTML = '<strong>Integrated Masters classes:</strong> 1st ≥ 70 · 2:1 ≥ 60 · 2:2 ≥ 50 · Fail &lt; 50';
    }
    else { // masters
        const r = computeMasters(state.modules);
        area.innerHTML = `
        <div class="tile"><div class="label">Level 7 total credits</div><div class="value">${r.total||0}</div></div>
        <div class="tile good"><div class="label">Level 7 avg</div><div class="value">${fmt(r.avg)}</div></div>`;
        finalMark = r.avg;
        exp.innerHTML = `<ul><li><strong>Average of all Level 7 modules</strong> (credit-weighted mean across everything entered).</li></ul>`;
        thresh.innerHTML = '<strong>Masters classes:</strong> First ≥ 70 · 2:1 ≥ 60 · 2:2 ≥ 50 · Fail &lt; 50';
    }

    const clsEl = $('#classification');
    const classifier = (state.settings.scheme==='ug') ? classifyUG : classifyIM_M;
    if (finalMark==null) { clsEl.textContent = 'Enter modules to see your classification.'; }
    else { const c = classifier(finalMark); clsEl.innerHTML = `<strong>Final classification:</strong> ${c.cls}`; }

    const w = $('#warnings'); w.style.display = warnings.length? 'block':'none';
    const dups = findDuplicateCodes(); if (dups.length){ warnings.push(`Duplicate module codes detected: ${dups.join(', ')}`); }
    w.textContent = warnings.join(' ');
}

// ---------- Credit hint ----------
function updateCreditHint(){
    const s = state.settings.scheme;
    let hint = '';
    if (s==='ug'){
        const l5 = sumCredits(state.modules.filter(m=>m.level===5));
        const l6 = sumCredits(state.modules.filter(m=>m.level===6));
        hint = `(L5: ${l5} credits, L6: ${l6} credits)`;
    } else if (s==='im'){
        const l6 = sumCredits(state.modules.filter(m=>m.level===6));
        const l7 = sumCredits(state.modules.filter(m=>m.level===7));
        hint = `(L6: ${l6} credits, L7: ${l7} credits)`;
    } else {
        const l7 = sumCredits(state.modules.filter(m=>m.level===7));
        hint = `(L7: ${l7} credits)`;
    }
    $('#creditHint').textContent = hint;
    $('#ugPolicyWrap').style.display = (s==='ug') ? 'inline-flex' : 'none';
}

// ---------- Duplicate module code detection ----------
function normalizedCode(m){ return (m.code||'').toUpperCase().trim(); }
function findDuplicateCodes(){
    const map = new Map(); const dups = new Set();
    state.modules.forEach(m=>{ const c = normalizedCode(m); if(!c) return; if(map.has(c)) dups.add(c); else map.set(c,true); });
    return Array.from(dups);
}
function applyDuplicateHighlight(){
    const dups = new Set(findDuplicateCodes());
    $$('#rows tr').forEach(tr=>{
        const codeInput = tr.querySelector('input.code');
        const val = codeInput.value.toUpperCase().trim();
        codeInput.classList.toggle('dup', dups.has(val) && val.length>0);
    });
    renderKPIsAndExplain();
}

// ---------- Persistence ----------
function setCookie(name, value, days = 180) { const expires = new Date(Date.now() + days*864e5).toUTCString(); document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`; }
function getCookie(name) { const m = document.cookie.match('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'); return m ? decodeURIComponent(m[1]) : null; }
function deleteCookie(name) { setCookie(name, '', -1); }

function persistMaybe(){ if (!state.settings.saveCookie) return; try { setCookie(COOKIE_KEY, JSON.stringify(state)); } catch(e){} }
function loadFromCookie(){ try { const v = getCookie(COOKIE_KEY); if(!v) return false; const data = JSON.parse(v); if (data && Array.isArray(data.modules)) { state = { modules: data.modules, settings: Object.assign({ saveCookie:true, scheme:'ug', ug_policy:'before_2023' }, data.settings||{}) }; return true; } } catch(e){} return false; }

function setSwitch(on){ const sw = $('#cookieSwitch'); sw.classList.toggle('on', !!on); sw.setAttribute('aria-checked', !!on); }

// ---------- Export / Import ----------
function exportJSON(){ const blob = new Blob([JSON.stringify(state, null, 2)], { type:'application/json' }); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='degree_calc.json'; a.click(); URL.revokeObjectURL(url); }
function importJSON(file){ const reader = new FileReader(); reader.onload = ev => { try { const data = JSON.parse(ev.target.result); if (!Array.isArray(data.modules)) throw new Error('Invalid'); state = { modules: data.modules, settings: Object.assign({ saveCookie:true, scheme:'ug', ug_policy:'before_2023' }, data.settings||{}) }; fullRender(); showToast('Imported'); } catch(e){ showToast('Import failed'); } }; reader.readAsText(file); }

function updateSchemaDialog(){
    const schema = {
        modules: [{ level: '5|6|7', code: 'AAA9999 or AAAA9999', credits: 'number', mark: '0..100' }],
        settings: { saveCookie: 'bool', scheme: 'ug | im | masters', ug_policy: 'before_2023 | on_or_after_2023' }
    };
    $('#schemaText').textContent = JSON.stringify(schema, null, 2);
}

// ---------- App wiring ----------
function addRow(){
    const opts = levelOptionsForScheme();
    state.modules.push({ level: opts[opts.length-1], code: '', credits: 15, mark: 60 });
    fullRender();
}

function recompute(){ renderTable(); updateCreditHint(); persistMaybe(); }
function fullRender(){ renderTable(); renderKPIsAndExplain(); updateCreditHint(); setSwitch(state.settings.saveCookie); persistMaybe(); }

function init(){
    loadFromCookie();
    fullRender();

    $('#addRowBtn').addEventListener('click', addRow);
    $('#sampleBtn').addEventListener('click', ()=>{
        const s = state.settings.scheme;
        if (s==='ug'){
            state.modules = [
                { level:5, code:'COMP2101', credits:30, mark:62 },
                { level:5, code:'DBMS2010', credits:15, mark:58 },
                { level:5, code:'SOFT2068', credits:15, mark:68 },
                { level:5, code:'OSYS2077', credits:30, mark:64 },
                { level:6, code:'PROJ3154', credits:45, mark:72 },
                { level:6, code:'NETS3110', credits:30, mark:66 },
                { level:6, code:'CYBR3142', credits:15, mark:74 },
                { level:6, code:'CLOUD3161', credits:15, mark:63 },
            ];
        } else if (s==='im'){
            state.modules = [
                { level:6, code:'INTR6001', credits:30, mark:65 },
                { level:6, code:'CORE6010', credits:30, mark:62 },
                { level:6, code:'OPTI6030', credits:30, mark:68 },
                { level:6, code:'LABS6040', credits:30, mark:64 },
                { level:7, code:'PROJ7001', credits:60, mark:72 },
                { level:7, code:'ADVN7030', credits:30, mark:66 },
                { level:7, code:'ELEC7040', credits:30, mark:70 },
            ];
        } else {
            state.modules = [
                { level:7, code:'PROJ7001', credits:60, mark:72 },
                { level:7, code:'RESM7005', credits:30, mark:65 },
                { level:7, code:'ADVT7012', credits:30, mark:68 },
                { level:7, code:'ELECT7031', credits:30, mark:62 },
            ];
        }
        fullRender();
        showToast('Example loaded');
    });
    $('#clearBtn').addEventListener('click', ()=>{ state.modules = []; fullRender(); });

    $('#exportBtn').addEventListener('click', exportJSON);
    $('#importBtn').addEventListener('click', ()=> $('#importFile').click());
    $('#importFile').addEventListener('change', e=>{ const f=e.target.files[0]; if(f) importJSON(f); e.target.value=''; });
    $('#resetCookieBtn').addEventListener('click', ()=>{ deleteCookie(COOKIE_KEY); showToast('Cookie deleted'); });

    const sw = $('#cookieSwitch');
    const toggle = ()=>{ state.settings.saveCookie = !state.settings.saveCookie; setSwitch(state.settings.saveCookie); persistMaybe(); };
    sw.addEventListener('click', toggle);
    sw.addEventListener('keydown', (e)=>{ if(e.key===' '||e.key==='Enter'){ e.preventDefault(); toggle(); }});

    const sel = $('#schemeSelect');
    sel.value = state.settings.scheme;
    sel.addEventListener('change', ()=>{
        state.settings.scheme = sel.value;
        const allowed = new Set(levelOptionsForScheme());
        state.modules = state.modules.map(m=> allowed.has(m.level) ? m : { ...m, level: [...allowed][0] });
        fullRender();
    });

    const ugSel = $('#ugPolicy');
    ugSel.value = state.settings.ug_policy;
    ugSel.addEventListener('change', ()=>{ state.settings.ug_policy = ugSel.value; fullRender(); });

    const dlg = $('#schemaDialog');
    $('#showSchema').addEventListener('click', (e)=>{ e.preventDefault(); updateSchemaDialog(); dlg.showModal(); });
    $('#closeSchema').addEventListener('click', ()=> dlg.close());

    document.addEventListener('visibilitychange', ()=> renderKPIsAndExplain());
}

function showToast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); setTimeout(()=> t.classList.remove('show'), 1600); }

document.addEventListener('DOMContentLoaded', init);
