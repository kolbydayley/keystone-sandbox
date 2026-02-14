const STORAGE_KEY = 'consulting_os_v1';
const defaultState = {
  checklist: {
    writtenPolicyReviewed: false,
    managerOrComplianceApproval: false,
    noCompetitorOrVendorOverlap: false,
    separateDevicesAndAccounts: false,
    outsideWorkHoursOnly: false,
    signedClientMSAAndSOW: false,
    insuredAndEntityFormed: false,
  },
  structure: {
    ownerSide: 'you',
    legalStyle: 'separate-llc',
    subPct: 35,
    riskTolerance: 'low'
  },
  leads: [],
  projects: []
};

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaultState, ...JSON.parse(raw) } : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); render(); }

function fmtUSD(n=0) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n||0)); }
function uid() { return Math.random().toString(36).slice(2,9); }

function renderTabs() {
  document.querySelectorAll('#tabs button').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('#tabs button').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    };
  });
}

function renderChecklist() {
  const container = document.getElementById('checklist');
  const items = [
    ['writtenPolicyReviewed', 'I reviewed written conflict-of-interest + moonlighting policy'],
    ['managerOrComplianceApproval', 'I have written approval/clearance (or equivalent required step)'],
    ['noCompetitorOrVendorOverlap', 'Target client is not a competitor, vendor, or policy-prohibited category'],
    ['separateDevicesAndAccounts', 'I will use separate personal devices/accounts/tools only'],
    ['outsideWorkHoursOnly', 'All consulting done outside work hours'],
    ['signedClientMSAAndSOW', 'MSA + SOW templates prepared and required before starting'],
    ['insuredAndEntityFormed', 'Entity + insurance + banking set up']
  ];

  container.innerHTML = items.map(([k,label]) => `
    <label><input type="checkbox" data-check="${k}" ${state.checklist[k] ? 'checked':''}/> ${label}</label>
  `).join('');

  container.querySelectorAll('input[data-check]').forEach(input => {
    input.onchange = () => { state.checklist[input.dataset.check] = input.checked; save(); };
  });

  const allGood = Object.values(state.checklist).every(Boolean);
  const status = document.getElementById('complianceStatus');
  status.innerHTML = allGood
    ? `<span class='pill good'>CLEARED</span> You can pursue clients (still run conflict check per lead).`
    : `<span class='pill bad'>BLOCKED</span> Finish all gates before taking on work.`;
}

function renderStructure() {
  ['ownerSide','legalStyle','subPct','riskTolerance'].forEach(k => {
    const el = document.getElementById(k);
    if (!el) return;
    el.value = state.structure[k];
    el.onchange = () => { state.structure[k] = el.value; save(); };
  });

  document.getElementById('generateModel').onclick = () => {
    const s = state.structure;
    const model = [];
    model.push(`<b>Recommended core model:</b> Separate LLCs + per-engagement prime/subcontract agreement.`);
    model.push(`<b>Prime owner:</b> ${s.ownerSide === 'per-project' ? 'Decide per project; prime owns client contract and payment collection.' : s.ownerSide === 'you' ? 'You' : 'Your friend'}.`);
    model.push(`<b>Revenue flow:</b> Prime invoices client, subcontractor invoices prime for ${s.subPct}% or milestone-based fixed fee.`);
    model.push(`<b>Contracts:</b> Client MSA+SOW with prime; Subcontractor MSA between you and friend with IP assignment + confidentiality + non-solicit + work acceptance.`);
    model.push(`<b>Decision rights:</b> Prime controls scope/client comms; subcontractor controls implementation details within SOW.`);
    model.push(`<b>Risk control:</b> ${s.riskTolerance === 'low' ? 'Use fixed-scope phases + change orders only.' : s.riskTolerance === 'med' ? 'Use milestone-based billing and capped revision rounds.' : 'Use value-based pricing with upside bonus clauses.'}`);
    document.getElementById('modelOutput').innerHTML = `<ul>${model.map(x=>`<li>${x}</li>`).join('')}</ul>`;
  };

  if (!document.getElementById('modelOutput').innerHTML) document.getElementById('generateModel').click();
}

function renderOffers() {
  const libs = [
    'AI Opportunity Audit (2 weeks): map 3-7 high-ROI use cases + execution blueprint',
    'AI Workflow Build Sprint (4-6 weeks): ship 1-2 automations with measurable ROI',
    'Exec/Leadership Retainer: weekly decision support + roadmap + vendor/tool governance'
  ];
  document.getElementById('offerLibrary').innerHTML = libs.map(x => `<li>${x}</li>`).join('');

  document.getElementById('calcPrice').onclick = () => {
    const type = document.getElementById('engagementType').value;
    const rev = Number(document.getElementById('clientRevenue').value || 0);
    const value = Number(document.getElementById('valueCreated').value || 0);
    const fun = Number(document.getElementById('funMultiplier').value || 1);
    const urg = Number(document.getElementById('urgencyMultiplier').value || 1);

    const floor = type === 'audit' ? 15000 : type === 'sprint' ? 45000 : 8000;
    const valueBased = value * (type === 'audit' ? 0.12 : type === 'sprint' ? 0.18 : 0.06);
    const scaleAdj = rev > 100_000_000 ? 1.35 : rev > 20_000_000 ? 1.15 : 1;
    const recommended = Math.max(floor, valueBased) * fun * urg * scaleAdj;

    document.getElementById('priceOutput').innerHTML = `
      <div><b>Floor:</b> ${fmtUSD(floor)}</div>
      <div><b>Value-based anchor:</b> ${fmtUSD(valueBased)}</div>
      <div><b>Recommended ask:</b> <b>${fmtUSD(recommended)}</b></div>
      <div><b>Good/Better/Best:</b> ${fmtUSD(recommended*0.85)} / ${fmtUSD(recommended)} / ${fmtUSD(recommended*1.35)}</div>
    `;
  };
}

function leadScore(lead) {
  return ((+lead.fun||0)*0.3 + (+lead.value||0)*0.3 + (+lead.conflict||0)*0.25 + (+lead.budget||0)*0.15).toFixed(2);
}

function renderPipeline() {
  document.getElementById('addLead').onclick = () => {
    const lead = {
      id: uid(),
      name: document.getElementById('leadName').value.trim(),
      champion: document.getElementById('leadChampion').value.trim(),
      stage: document.getElementById('leadStage').value,
      potential: Number(document.getElementById('leadPotential').value||0),
      fun: Number(document.getElementById('leadFun').value||0),
      value: Number(document.getElementById('leadValue').value||0),
      conflict: Number(document.getElementById('leadConflict').value||0),
      budget: Number(document.getElementById('leadBudget').value||0)
    };
    if (!lead.name) return;
    state.leads.push(lead);
    save();
    ['leadName','leadChampion','leadPotential','leadFun','leadValue','leadConflict','leadBudget'].forEach(id=>document.getElementById(id).value='');
  };

  const body = document.getElementById('leadTable');
  body.innerHTML = state.leads.map(l => `
    <tr>
      <td>${l.name}</td>
      <td>${l.stage}</td>
      <td>${fmtUSD(l.potential)}</td>
      <td>${leadScore(l)}</td>
      <td><button data-del-lead="${l.id}">Delete</button></td>
    </tr>
  `).join('');
  body.querySelectorAll('button[data-del-lead]').forEach(btn => {
    btn.onclick = () => { state.leads = state.leads.filter(l=>l.id!==btn.dataset.delLead); save(); };
  });
}

function renderProjects() {
  document.getElementById('addProject').onclick = () => {
    const p = {
      id: uid(),
      name: document.getElementById('projName').value.trim(),
      client: document.getElementById('projClient').value.trim(),
      contract: Number(document.getElementById('projContract').value||0),
      hours: Number(document.getElementById('projHours').value||0),
      used: Number(document.getElementById('projHoursUsed').value||0),
      status: document.getElementById('projStatus').value
    };
    if (!p.name) return;
    state.projects.push(p);
    save();
    ['projName','projClient','projContract','projHours','projHoursUsed'].forEach(id=>document.getElementById(id).value='');
  };

  const body = document.getElementById('projectTable');
  body.innerHTML = state.projects.map(p => {
    const burn = p.hours > 0 ? (p.used/p.hours) : 0;
    const signal = burn > 1 ? 'Overrun risk' : burn > 0.8 ? 'Watch closely' : 'Healthy';
    return `
      <tr>
        <td>${p.name}</td>
        <td>${p.client}</td>
        <td>${p.status}</td>
        <td>${signal}</td>
        <td><button data-del-project="${p.id}">Delete</button></td>
      </tr>
    `;
  }).join('');
  body.querySelectorAll('button[data-del-project]').forEach(btn => {
    btn.onclick = () => { state.projects = state.projects.filter(p=>p.id!==btn.dataset.delProject); save(); };
  });
}

function renderDashboard() {
  const pipelineValue = state.leads.filter(l=>l.stage!=='Lost').reduce((a,b)=>a+(+b.potential||0),0);
  const won = state.leads.filter(l=>l.stage==='Won').reduce((a,b)=>a+(+b.potential||0),0);
  const avgScore = state.leads.length ? (state.leads.reduce((a,l)=>a+Number(leadScore(l)),0) / state.leads.length) : 0;
  const activeProjects = state.projects.filter(p=>['Planned','In Progress','Blocked'].includes(p.status)).length;
  const totalHours = state.projects.reduce((a,p)=>a+(+p.hours||0),0);
  const totalUsed = state.projects.reduce((a,p)=>a+(+p.used||0),0);
  const burn = totalHours>0 ? Math.round((totalUsed/totalHours)*100) : 0;
  const compliant = Object.values(state.checklist).every(Boolean);

  document.getElementById('kpiPipeline').textContent = fmtUSD(pipelineValue);
  document.getElementById('kpiWon').textContent = fmtUSD(won);
  document.getElementById('kpiScore').textContent = avgScore.toFixed(2);
  document.getElementById('kpiProjects').textContent = String(activeProjects);
  document.getElementById('kpiBurn').textContent = `${burn}%`;
  document.getElementById('kpiCompliance').textContent = compliant ? 'Cleared' : 'Blocked';

  const actions = [];
  if (!compliant) actions.push('Complete conflict/compliance setup before taking clients.');
  const highScoreLead = [...state.leads].sort((a,b)=>Number(leadScore(b))-Number(leadScore(a)))[0];
  if (highScoreLead) actions.push(`Prioritize ${highScoreLead.name} (score ${leadScore(highScoreLead)}).`);
  if (burn > 85) actions.push('Project hours burn is high — tighten scope / issue change orders.');
  if (!state.leads.length) actions.push('Add at least 5 leads and score them for fun/value/fit.');

  document.getElementById('nextActions').innerHTML = actions.map(a=>`<li>${a}</li>`).join('') || '<li>All clear. Keep execution tight.</li>';
}

function bindDataOps() {
  document.getElementById('exportBtn').onclick = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `consulting-os-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  document.getElementById('importInput').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      state = { ...defaultState, ...JSON.parse(text) };
      save();
    } catch {
      alert('Invalid JSON file');
    }
  };

  document.getElementById('resetBtn').onclick = () => {
    if (!confirm('Reset all Consulting OS data?')) return;
    state = structuredClone(defaultState);
    save();
  };
}

function render() {
  renderChecklist();
  renderStructure();
  renderOffers();
  renderPipeline();
  renderProjects();
  renderDashboard();
}

renderTabs();
bindDataOps();
render();
