(function () {
    'use strict';

    const modalEl = document.getElementById('appDetailModal');
    const modal = new bootstrap.Modal(modalEl);
    const modalTitle = document.getElementById('appDetailModalLabel');
    const modalIcon = document.getElementById('modal-icon');
    const modalNsBadge = document.getElementById('modal-ns-badge');
    const modalActiveBadge = document.getElementById('modal-active-badge');
    const modalLoading = document.getElementById('modal-loading');
    const modalError = document.getElementById('modal-error');
    const modalContent = document.getElementById('modal-content');
    const subappTabs = document.getElementById('subappTabs');
    const subappTabContent = document.getElementById('subappTabContent');
    const editBtn = document.getElementById('modal-edit-btn');
    const saveBtn = document.getElementById('modal-save-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');

    let currentApp = null;
    let editMode = false;
    let annotationSuggestions = null; // {key: [values]} loaded once
    let dependencySuggestions = null; // [{name, namespace}] loaded once
    let substituteSuggestions = null; // {key: [values]} loaded once
    let componentSuggestions = null; // [string] loaded once

    window.openAppDetail = function (namespace, name, displayName, iconSrc) {
        editMode = false;
        toggleEditUI(false);
        modalLoading.classList.remove('d-none');
        modalError.classList.add('d-none');
        modalContent.classList.add('d-none');
        editBtn.classList.add('d-none');

        modalTitle.textContent = displayName || name;
        if (iconSrc) {
            modalIcon.src = iconSrc;
            modalIcon.classList.remove('d-none');
        } else {
            modalIcon.classList.add('d-none');
        }
        modalNsBadge.textContent = '';
        modalActiveBadge.textContent = '';

        modal.show();

        // Load suggestions once, then detail
        const annotPromise = annotationSuggestions
            ? Promise.resolve(annotationSuggestions)
            : fetch('/api/annotations/suggestions').then(r => r.json()).then(s => { annotationSuggestions = s; return s; });
        const depPromise = dependencySuggestions
            ? Promise.resolve(dependencySuggestions)
            : fetch('/api/dependencies/suggestions').then(r => r.json()).then(s => { dependencySuggestions = s; return s; });
        const subPromise = substituteSuggestions
            ? Promise.resolve(substituteSuggestions)
            : fetch('/api/substitutes/suggestions').then(r => r.json()).then(s => { substituteSuggestions = s; return s; });
        const compPromise = componentSuggestions
            ? Promise.resolve(componentSuggestions)
            : fetch('/api/components/suggestions').then(r => r.json()).then(s => { componentSuggestions = s; return s; });

        Promise.all([
            fetch(`/api/apps/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`)
                .then(r => { if (!r.ok) throw new Error(`Erreur ${r.status}`); return r.json(); }),
            annotPromise,
            depPromise,
            subPromise,
            compPromise
        ])
            .then(([data]) => {
                currentApp = data;
                renderDetail(data);
                modalLoading.classList.add('d-none');
                modalContent.classList.remove('d-none');
                editBtn.classList.remove('d-none');
            })
            .catch(err => {
                modalLoading.classList.add('d-none');
                modalError.textContent = `Erreur: ${err.message}`;
                modalError.classList.remove('d-none');
            });
    };

    function renderDetail(data) {
        modalNsBadge.textContent = data.namespace;
        if (data.active) {
            modalActiveBadge.textContent = 'Active';
            modalActiveBadge.className = 'badge bg-success ms-1';
        } else {
            modalActiveBadge.textContent = 'Inactive';
            modalActiveBadge.className = 'badge bg-secondary ms-1';
        }

        const subapps = data.subapps || [];

        // Tabs
        if (subapps.length <= 1) {
            subappTabs.classList.add('d-none');
        } else {
            subappTabs.classList.remove('d-none');
        }

        subappTabs.innerHTML = subapps.map((sa, i) => `
            <li class="nav-item" role="presentation">
                <button class="nav-link ${i === 0 ? 'active' : ''}"
                        id="tab-${slugify(sa.name)}" data-bs-toggle="tab"
                        data-bs-target="#pane-${slugify(sa.name)}" type="button"
                        role="tab">${esc(sa.full_name)}</button>
            </li>
        `).join('');

        subappTabContent.innerHTML = subapps.map((sa, i) => `
            <div class="tab-pane fade ${i === 0 ? 'show active' : ''}"
                 id="pane-${slugify(sa.name)}" role="tabpanel">
                ${buildSubappHtml(sa)}
            </div>
        `).join('');
    }

    function buildSubappHtml(sa) {
        let html = '';
        const ks = sa.ks || {};
        const hr = sa.helmrelease || {};

        // ── Kustomization ──
        html += sectionTitle('Kustomization', 'fa-layer-group');
        html += '<div class="row g-2 mb-3">';
        for (const field of ['interval', 'retryInterval', 'timeout']) {
            const val = ks[field] || '-';
            html += `
                <div class="col-md-2">
                    <label class="form-label text-muted small mb-0">${field}</label>
                    <div class="ks-field">
                        <span class="ks-display">${esc(String(val))}</span>
                        <input type="text" class="form-control form-control-sm ks-edit d-none"
                               value="${esc(String(val))}" data-subapp="${esc(sa.full_name)}" data-field="${field}">
                    </div>
                </div>`;
        }
        html += `
            <div class="col-md-1">
                <label class="form-label text-muted small mb-0">wait</label>
                <div class="ks-field">
                    <span class="ks-display">${ks.wait ? 'true' : 'false'}</span>
                    <select class="form-select form-select-sm ks-edit d-none"
                            data-subapp="${esc(sa.full_name)}" data-field="wait">
                        <option value="true" ${ks.wait ? 'selected' : ''}>true</option>
                        <option value="false" ${!ks.wait ? 'selected' : ''}>false</option>
                    </select>
                </div>
            </div>
            <div class="col-md-1">
                <label class="form-label text-muted small mb-0">prune</label>
                <div class="ks-field">
                    <span class="ks-display">${ks.prune ? 'true' : 'false'}</span>
                    <select class="form-select form-select-sm ks-edit d-none"
                            data-subapp="${esc(sa.full_name)}" data-field="prune">
                        <option value="true" ${ks.prune ? 'selected' : ''}>true</option>
                        <option value="false" ${!ks.prune ? 'selected' : ''}>false</option>
                    </select>
                </div>
            </div>`;
        if (ks.path) {
            html += `<div class="col-md-5"><label class="form-label text-muted small mb-0">path</label>
                      <div><code class="small">${esc(ks.path)}</code></div></div>`;
        }
        html += '</div>';

        // ── Substitutes ──
        const subs = ks.substitute || {};
        const subEntries = Object.entries(subs);
        html += sectionTitle('Substitutes (postBuild)', 'fa-key');
        html += `<div class="subs-section" data-subapp="${esc(sa.full_name)}">`;

        // Read-only view
        html += '<div class="subs-display">';
        if (subEntries.length > 0) {
            html += '<table class="table table-sm table-bordered mb-3"><thead><tr><th style="width:30%">Cle</th><th>Valeur</th></tr></thead><tbody>';
            for (const [k, v] of subEntries) {
                html += `<tr><td><code>${esc(k)}</code></td><td>${esc(String(v))}</td></tr>`;
            }
            html += '</tbody></table>';
        } else {
            html += '<div class="small text-muted mb-3">Aucun substitute</div>';
        }
        html += '</div>';

        // Edit view
        html += '<div class="subs-edit d-none">';
        html += '<table class="table table-sm table-bordered mb-1"><thead><tr><th style="width:35%">Cle</th><th>Valeur</th><th style="width:40px"></th></tr></thead>';
        html += '<tbody class="subs-rows">';
        for (const [k, v] of subEntries) {
            html += subsRow(k, String(v));
        }
        html += '</tbody></table>';
        html += '<button type="button" class="btn btn-sm btn-outline-primary subs-add-btn"><i class="fas fa-plus me-1"></i>Ajouter</button>';
        html += '</div>';

        html += '</div>';

        // ── SubstituteFrom ──
        const subFrom = ks.substitute_from || [];
        if (subFrom.length > 0) {
            html += sectionTitle('SubstituteFrom', 'fa-link');
            html += '<div class="mb-3">';
            for (const sf of subFrom) {
                const cls = sf.kind === 'Secret' ? 'bg-warning text-dark' : 'bg-info';
                html += `<span class="badge ${cls} me-1"><i class="fas fa-${sf.kind === 'Secret' ? 'lock' : 'gear'} me-1"></i>${esc(sf.kind)}: ${esc(sf.name)}</span>`;
            }
            html += '</div>';
        }

        // ── Composants ──
        const comps = ks.components || [];
        html += sectionTitle('Composants', 'fa-puzzle-piece');
        html += `<div class="comp-section" data-subapp="${esc(sa.full_name)}">`;

        // Read-only view
        html += '<div class="comp-display">';
        if (comps.length > 0) {
            html += '<div class="mb-3">';
            for (const c of comps) {
                html += `<span class="badge ${compColor(c)} me-1 mb-1">${esc(c)}</span>`;
            }
            html += '</div>';
        } else {
            html += '<div class="small text-muted mb-3">Aucun composant</div>';
        }
        html += '</div>';

        // Edit view
        html += '<div class="comp-edit d-none">';
        html += '<table class="table table-sm table-bordered mb-1"><thead><tr><th>Composant</th><th style="width:40px"></th></tr></thead>';
        html += '<tbody class="comp-rows">';
        for (const c of comps) {
            html += compRow(c);
        }
        html += '</tbody></table>';
        html += '<button type="button" class="btn btn-sm btn-outline-primary comp-add-btn"><i class="fas fa-plus me-1"></i>Ajouter</button>';
        html += '</div>';

        html += '</div>';

        // ── Dependances ──
        const deps = ks.depends_on || [];
        html += sectionTitle('Dependances', 'fa-sitemap');
        html += `<div class="dep-section" data-subapp="${esc(sa.full_name)}">`;

        // Read-only view
        html += '<div class="dep-display">';
        if (deps.length > 0) {
            html += '<table class="table table-sm table-bordered mb-3"><thead><tr><th>Nom</th><th>Namespace</th></tr></thead><tbody>';
            for (const d of deps) {
                html += `<tr><td>${esc(d.name)}</td><td><span class="badge bg-primary">${esc(d.namespace)}</span></td></tr>`;
            }
            html += '</tbody></table>';
        } else {
            html += '<div class="small text-muted mb-3">Aucune dependance</div>';
        }
        html += '</div>';

        // Edit view
        html += '<div class="dep-edit d-none">';
        html += '<table class="table table-sm table-bordered mb-1"><thead><tr><th>Nom</th><th>Namespace</th><th style="width:40px"></th></tr></thead>';
        html += '<tbody class="dep-rows">';
        for (const d of deps) {
            html += depRow(d.name, d.namespace);
        }
        html += '</tbody></table>';
        html += '<button type="button" class="btn btn-sm btn-outline-primary dep-add-btn"><i class="fas fa-plus me-1"></i>Ajouter</button>';
        html += '</div>';

        html += '</div>';

        // ── Health Checks ──
        const hcs = ks.health_checks || [];
        if (hcs.length > 0) {
            html += sectionTitle('Health Checks', 'fa-heartbeat');
            html += '<div class="mb-3">';
            for (const hc of hcs) {
                html += `<span class="badge bg-outline-secondary border me-1">${esc(hc.kind)}: ${esc(hc.name)}</span>`;
            }
            html += '</div>';
        }

        // ── HelmRelease ──
        if (hr) {
            // Ingress
            if (hr.ingress && Object.keys(hr.ingress).length > 0) {
                html += sectionTitle('Ingress', 'fa-globe');
                for (const [ingName, ingDef] of Object.entries(hr.ingress)) {
                    const saPath = (sa.ks || {}).path || '';
                    html += `<div class="card mb-2 annot-card" data-subapp-path="${esc(saPath)}" data-ingress="${esc(ingName)}"><div class="card-body p-2">`;
                    html += `<strong>${esc(ingName)}</strong> &mdash; className: <code>${esc(ingDef.className || '-')}</code>`;
                    if (ingDef.hosts && ingDef.hosts.length) {
                        html += ` &mdash; Host: <code>${esc(ingDef.hosts[0].host || '-')}</code>`;
                    }
                    const annots = ingDef.annotations || {};
                    const annotKeys = Object.keys(annots);

                    // Read-only view
                    html += `<div class="annot-display">`;
                    if (annotKeys.length > 0) {
                        html += `<details class="mt-1" open><summary class="small text-muted">Annotations (${annotKeys.length})</summary>`;
                        html += '<table class="table table-sm mb-0"><tbody>';
                        for (const [ak, av] of Object.entries(annots)) {
                            html += `<tr><td class="text-nowrap"><small><code>${esc(ak)}</code></small></td><td><small>${esc(String(av))}</small></td></tr>`;
                        }
                        html += '</tbody></table></details>';
                    } else {
                        html += '<div class="small text-muted mt-1">Aucune annotation</div>';
                    }
                    html += '</div>';

                    // Edit view
                    html += `<div class="annot-edit d-none mt-2">`;
                    html += `<table class="table table-sm table-bordered mb-1"><thead><tr><th>Cle</th><th>Valeur</th><th style="width:40px"></th></tr></thead>`;
                    html += `<tbody class="annot-rows">`;
                    for (const [ak, av] of Object.entries(annots)) {
                        html += annotationRow(ak, String(av));
                    }
                    html += `</tbody></table>`;
                    html += `<button type="button" class="btn btn-sm btn-outline-primary annot-add-btn"><i class="fas fa-plus me-1"></i>Ajouter</button>`;
                    html += '</div>';

                    html += '</div></div>';
                }
            }

            // Containers
            if (hr.controllers && Object.keys(hr.controllers).length > 0) {
                html += sectionTitle('Containers', 'fa-box');
                for (const [ctrlName, ctrl] of Object.entries(hr.controllers)) {
                    for (const [cntName, cnt] of Object.entries(ctrl.containers || {})) {
                        html += '<div class="card mb-2"><div class="card-body p-2">';
                        html += `<strong>${esc(ctrlName)}</strong> / ${esc(cntName)}: `;
                        if (cnt.image) {
                            html += `<code>${esc(cnt.image)}:${esc(cnt.tag || '?')}</code>`;
                        }
                        if (cnt.resources) {
                            const req = cnt.resources.requests || {};
                            const lim = cnt.resources.limits || {};
                            html += `<br><small class="text-muted">Requests: ${req.cpu || '?'} CPU, ${req.memory || '?'} mem | Limits: ${lim.cpu || '?'} CPU, ${lim.memory || '?'} mem</small>`;
                        }
                        // Env vars
                        if (cnt.env && cnt.env.length > 0) {
                            html += `<details class="mt-1"><summary class="small text-muted">Variables d'env (${cnt.env.length})</summary>`;
                            html += '<table class="table table-sm mb-0"><tbody>';
                            for (const ev of cnt.env) {
                                html += `<tr><td><code>${esc(ev.key)}</code></td><td>`;
                                if (ev.secret) {
                                    html += '<span class="badge bg-warning text-dark"><i class="fas fa-lock"></i> secret</span>';
                                } else {
                                    html += `<small>${esc(ev.value)}</small>`;
                                }
                                html += '</td></tr>';
                            }
                            html += '</tbody></table></details>';
                        }
                        html += '</div></div>';
                    }
                }
            }

            // Persistence
            if (hr.persistence && Object.keys(hr.persistence).length > 0) {
                html += sectionTitle('Persistence', 'fa-database');
                html += '<div class="mb-3">';
                for (const [pName, pDef] of Object.entries(hr.persistence)) {
                    const info = [];
                    if (pDef.type) info.push(`type: ${pDef.type}`);
                    if (pDef.existingClaim) info.push(`claim: ${pDef.existingClaim}`);
                    if (pDef.size) info.push(`size: ${pDef.size}`);
                    html += `<span class="badge bg-info text-dark me-1 mb-1">${esc(pName)}: ${esc(info.join(', ') || '-')}</span>`;
                }
                html += '</div>';
            }
        }

        return html;
    }

    // ── Edit mode ──
    editBtn.addEventListener('click', () => toggleEditUI(true));
    cancelBtn.addEventListener('click', () => {
        toggleEditUI(false);
        if (currentApp) renderDetail(currentApp);
    });

    function toggleEditUI(editing) {
        editMode = editing;
        editBtn.classList.toggle('d-none', editing);
        saveBtn.classList.toggle('d-none', !editing);
        cancelBtn.classList.toggle('d-none', !editing);
        modalEl.querySelectorAll('.ks-display').forEach(el => el.classList.toggle('d-none', editing));
        modalEl.querySelectorAll('.ks-edit').forEach(el => el.classList.toggle('d-none', !editing));
        modalEl.querySelectorAll('.subs-display').forEach(el => el.classList.toggle('d-none', editing));
        modalEl.querySelectorAll('.subs-edit').forEach(el => el.classList.toggle('d-none', !editing));
        modalEl.querySelectorAll('.annot-display').forEach(el => el.classList.toggle('d-none', editing));
        modalEl.querySelectorAll('.annot-edit').forEach(el => el.classList.toggle('d-none', !editing));
        modalEl.querySelectorAll('.dep-display').forEach(el => el.classList.toggle('d-none', editing));
        modalEl.querySelectorAll('.dep-edit').forEach(el => el.classList.toggle('d-none', !editing));
        modalEl.querySelectorAll('.comp-display').forEach(el => el.classList.toggle('d-none', editing));
        modalEl.querySelectorAll('.comp-edit').forEach(el => el.classList.toggle('d-none', !editing));
    }

    // ── Save ──
    saveBtn.addEventListener('click', async () => {
        if (!currentApp) return;
        saveBtn.disabled = true;

        for (const sa of (currentApp.subapps || [])) {
            const changes = {};

            // Substitutes
            const subsSection = modalEl.querySelector(`.subs-section[data-subapp="${sa.full_name}"]`);
            if (subsSection) {
                const subsRows = subsSection.querySelectorAll('.subs-rows tr');
                const newSubs = {};
                for (const row of subsRows) {
                    const keyInput = row.querySelector('.sub-key');
                    const valInput = row.querySelector('.sub-val');
                    if (keyInput && valInput && keyInput.value.trim()) {
                        newSubs[keyInput.value.trim()] = valInput.value;
                    }
                }
                const origSubs = sa.ks.substitute || {};
                const origStr = Object.keys(origSubs).sort().map(k => `${k}=${origSubs[k]}`).join('|');
                const newStr = Object.keys(newSubs).sort().map(k => `${k}=${newSubs[k]}`).join('|');
                if (origStr !== newStr) {
                    changes.substitute = newSubs;
                }
            }

            // KS fields
            const ksEdits = modalEl.querySelectorAll(`.ks-edit[data-subapp="${sa.full_name}"]`);
            ksEdits.forEach(input => {
                const field = input.dataset.field;
                const val = input.value;
                const orig = sa.ks[field];
                if (String(orig) !== val) changes[field] = val;
            });

            // Components
            const compSection = modalEl.querySelector(`.comp-section[data-subapp="${sa.full_name}"]`);
            if (compSection) {
                const compRows = compSection.querySelectorAll('.comp-rows tr');
                const newComps = [];
                for (const row of compRows) {
                    const nameInput = row.querySelector('.comp-name');
                    if (nameInput && nameInput.value.trim()) {
                        newComps.push(nameInput.value.trim());
                    }
                }
                const origComps = (sa.ks.components || []).slice().sort().join(',');
                const newCompsStr = newComps.slice().sort().join(',');
                if (origComps !== newCompsStr) {
                    changes.components = newComps;
                }
            }

            // Dependencies
            const depSection = modalEl.querySelector(`.dep-section[data-subapp="${sa.full_name}"]`);
            if (depSection) {
                const depRows = depSection.querySelectorAll('.dep-rows tr');
                const newDeps = [];
                for (const row of depRows) {
                    const nameInput = row.querySelector('.dep-name');
                    const nsInput = row.querySelector('.dep-ns');
                    if (nameInput && nsInput && nameInput.value.trim()) {
                        newDeps.push({ name: nameInput.value.trim(), namespace: nsInput.value.trim() });
                    }
                }
                const origDeps = (sa.ks.depends_on || []).map(d => `${d.name}|${d.namespace}`).sort().join(',');
                const newDepsStr = newDeps.map(d => `${d.name}|${d.namespace}`).sort().join(',');
                if (origDeps !== newDepsStr) {
                    changes.dependsOn = newDeps;
                }
            }

            if (Object.keys(changes).length === 0) continue;

            try {
                const resp = await fetch(`/api/apps/${encodeURIComponent(currentApp.namespace)}/${encodeURIComponent(currentApp.name)}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subapp_full_name: sa.full_name, changes })
                });
                if (!resp.ok) {
                    const err = await resp.json();
                    showToast(`Erreur: ${err.error}`, 'danger');
                    saveBtn.disabled = false;
                    return;
                }
            } catch (e) {
                showToast(`Erreur reseau: ${e.message}`, 'danger');
                saveBtn.disabled = false;
                return;
            }
        }

        // Save annotation changes
        const annotCards = modalEl.querySelectorAll('.annot-card');
        for (const card of annotCards) {
            const subappPath = card.dataset.subappPath;
            const ingressName = card.dataset.ingress;
            if (!subappPath || !ingressName) continue;

            const rows = card.querySelectorAll('.annot-rows tr');
            const newAnnots = {};
            for (const row of rows) {
                const keyInput = row.querySelector('.annot-key');
                const valInput = row.querySelector('.annot-val');
                if (keyInput && valInput && keyInput.value.trim()) {
                    newAnnots[keyInput.value.trim()] = valInput.value;
                }
            }

            // Compare with original
            const origCard = (currentApp.subapps || []).find(sa => (sa.ks || {}).path === subappPath);
            const origAnnots = origCard?.helmrelease?.ingress?.[ingressName]?.annotations || {};
            const origKeys = Object.keys(origAnnots).sort().join('|');
            const origVals = Object.keys(origAnnots).sort().map(k => origAnnots[k]).join('|');
            const newKeys = Object.keys(newAnnots).sort().join('|');
            const newVals = Object.keys(newAnnots).sort().map(k => newAnnots[k]).join('|');
            if (origKeys === newKeys && origVals === newVals) continue;

            try {
                const resp = await fetch(`/api/apps/${encodeURIComponent(currentApp.namespace)}/${encodeURIComponent(currentApp.name)}/annotations`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subapp_path: subappPath, ingress_name: ingressName, annotations: newAnnots })
                });
                if (!resp.ok) {
                    const err = await resp.json();
                    showToast(`Erreur annotations: ${err.error}`, 'danger');
                    saveBtn.disabled = false;
                    return;
                }
            } catch (e) {
                showToast(`Erreur reseau: ${e.message}`, 'danger');
                saveBtn.disabled = false;
                return;
            }
        }

        saveBtn.disabled = false;
        toggleEditUI(false);
        showToast('Modifications enregistrees. Allez sur Sync pour commiter et pousser.', 'success');

        // Refresh detail
        window.openAppDetail(currentApp.namespace, currentApp.name,
            modalTitle.textContent, modalIcon.src);
    });

    // ── Toast ──
    function showToast(msg, type) {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            container.style.zIndex = '1100';
            document.body.appendChild(container);
        }
        const id = 'toast-' + Date.now();
        container.insertAdjacentHTML('beforeend', `
            <div id="${id}" class="toast align-items-center text-bg-${type} border-0" role="alert">
                <div class="d-flex">
                    <div class="toast-body">${esc(msg)}</div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            </div>
        `);
        const toastEl = document.getElementById(id);
        new bootstrap.Toast(toastEl, { delay: 5000 }).show();
        toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
    }

    // ── Component row + autocomplete ──
    function compRow(name) {
        return `<tr>
            <td><div class="position-relative">
                <input type="text" class="form-control form-control-sm comp-name" value="${esc(name)}" autocomplete="off" placeholder="composant...">
                <div class="comp-suggest list-group position-absolute w-100 d-none" style="z-index:1050;max-height:200px;overflow-y:auto"></div>
            </div></td>
            <td><button type="button" class="btn btn-sm btn-outline-danger comp-del-btn"><i class="fas fa-trash"></i></button></td>
        </tr>`;
    }

    // ── Substitute row + autocomplete ──
    function subsRow(key, value) {
        return `<tr>
            <td><div class="position-relative">
                <input type="text" class="form-control form-control-sm sub-key" value="${esc(key)}" autocomplete="off" placeholder="cle...">
                <div class="sub-suggest list-group position-absolute w-100 d-none" style="z-index:1050;max-height:200px;overflow-y:auto"></div>
            </div></td>
            <td><div class="position-relative">
                <input type="text" class="form-control form-control-sm sub-val" value="${esc(value)}" autocomplete="off" placeholder="valeur...">
                <div class="sub-suggest-val list-group position-absolute w-100 d-none" style="z-index:1050;max-height:200px;overflow-y:auto"></div>
            </div></td>
            <td><button type="button" class="btn btn-sm btn-outline-danger subs-del-btn"><i class="fas fa-trash"></i></button></td>
        </tr>`;
    }

    // ── Dependency row + autocomplete ──
    function depRow(name, namespace) {
        return `<tr>
            <td><div class="position-relative">
                <input type="text" class="form-control form-control-sm dep-name" value="${esc(name)}" autocomplete="off" placeholder="nom...">
                <div class="dep-suggest list-group position-absolute w-100 d-none" style="z-index:1050;max-height:200px;overflow-y:auto"></div>
            </div></td>
            <td><input type="text" class="form-control form-control-sm dep-ns" value="${esc(namespace)}" autocomplete="off" placeholder="namespace..."></td>
            <td><button type="button" class="btn btn-sm btn-outline-danger dep-del-btn"><i class="fas fa-trash"></i></button></td>
        </tr>`;
    }

    // ── Annotation row + autocomplete ──
    function annotationRow(key, value) {
        return `<tr>
            <td><div class="position-relative">
                <input type="text" class="form-control form-control-sm annot-key" value="${esc(key)}" autocomplete="off">
                <div class="annot-suggest list-group position-absolute w-100 d-none" style="z-index:1050;max-height:200px;overflow-y:auto"></div>
            </div></td>
            <td><div class="position-relative">
                <input type="text" class="form-control form-control-sm annot-val" value="${esc(value)}" autocomplete="off">
                <div class="annot-suggest-val list-group position-absolute w-100 d-none" style="z-index:1050;max-height:200px;overflow-y:auto"></div>
            </div></td>
            <td><button type="button" class="btn btn-sm btn-outline-danger annot-del-btn"><i class="fas fa-trash"></i></button></td>
        </tr>`;
    }

    // Event delegation for annotation & dependency editing
    modalEl.addEventListener('click', (e) => {
        // Delete annotation row
        const delBtn = e.target.closest('.annot-del-btn');
        if (delBtn) {
            delBtn.closest('tr').remove();
            return;
        }
        // Add annotation row
        const addBtn = e.target.closest('.annot-add-btn');
        if (addBtn) {
            const tbody = addBtn.previousElementSibling.querySelector('.annot-rows');
            tbody.insertAdjacentHTML('beforeend', annotationRow('', ''));
            const newRow = tbody.lastElementChild;
            newRow.querySelector('.annot-key').focus();
            return;
        }
        // Delete component row
        const compDelBtn = e.target.closest('.comp-del-btn');
        if (compDelBtn) {
            compDelBtn.closest('tr').remove();
            return;
        }
        // Add component row
        const compAddBtn = e.target.closest('.comp-add-btn');
        if (compAddBtn) {
            const tbody = compAddBtn.previousElementSibling.querySelector('.comp-rows');
            tbody.insertAdjacentHTML('beforeend', compRow(''));
            const newRow = tbody.lastElementChild;
            newRow.querySelector('.comp-name').focus();
            return;
        }
        // Delete substitute row
        const subsDelBtn = e.target.closest('.subs-del-btn');
        if (subsDelBtn) {
            subsDelBtn.closest('tr').remove();
            return;
        }
        // Add substitute row
        const subsAddBtn = e.target.closest('.subs-add-btn');
        if (subsAddBtn) {
            const tbody = subsAddBtn.previousElementSibling.querySelector('.subs-rows');
            tbody.insertAdjacentHTML('beforeend', subsRow('', ''));
            const newRow = tbody.lastElementChild;
            newRow.querySelector('.sub-key').focus();
            return;
        }
        // Delete dependency row
        const depDelBtn = e.target.closest('.dep-del-btn');
        if (depDelBtn) {
            depDelBtn.closest('tr').remove();
            return;
        }
        // Add dependency row
        const depAddBtn = e.target.closest('.dep-add-btn');
        if (depAddBtn) {
            const tbody = depAddBtn.previousElementSibling.querySelector('.dep-rows');
            tbody.insertAdjacentHTML('beforeend', depRow('', ''));
            const newRow = tbody.lastElementChild;
            newRow.querySelector('.dep-name').focus();
            return;
        }
    });

    // Autocomplete for annotation keys, dependency names, substitute keys, component names
    modalEl.addEventListener('input', (e) => {
        if (e.target.classList.contains('annot-key')) showKeySuggestions(e.target);
        if (e.target.classList.contains('annot-val')) showValSuggestions(e.target);
        if (e.target.classList.contains('dep-name')) showDepSuggestions(e.target);
        if (e.target.classList.contains('sub-key')) showSubKeySuggestions(e.target);
        if (e.target.classList.contains('sub-val')) showSubValSuggestions(e.target);
        if (e.target.classList.contains('comp-name')) showCompSuggestions(e.target);
    });

    modalEl.addEventListener('focusin', (e) => {
        if (e.target.classList.contains('annot-key')) showKeySuggestions(e.target);
        if (e.target.classList.contains('annot-val')) showValSuggestions(e.target);
        if (e.target.classList.contains('dep-name')) showDepSuggestions(e.target);
        if (e.target.classList.contains('sub-key')) showSubKeySuggestions(e.target);
        if (e.target.classList.contains('sub-val')) showSubValSuggestions(e.target);
        if (e.target.classList.contains('comp-name')) showCompSuggestions(e.target);
    });

    modalEl.addEventListener('focusout', (e) => {
        // Delay to allow click on suggestion
        setTimeout(() => {
            if (e.target.classList.contains('annot-key')) {
                const dropdown = e.target.parentElement.querySelector('.annot-suggest');
                if (dropdown) dropdown.classList.add('d-none');
            }
            if (e.target.classList.contains('annot-val')) {
                const dropdown = e.target.parentElement.querySelector('.annot-suggest-val');
                if (dropdown) dropdown.classList.add('d-none');
            }
            if (e.target.classList.contains('dep-name')) {
                const dropdown = e.target.parentElement.querySelector('.dep-suggest');
                if (dropdown) dropdown.classList.add('d-none');
            }
            if (e.target.classList.contains('sub-key')) {
                const dropdown = e.target.parentElement.querySelector('.sub-suggest');
                if (dropdown) dropdown.classList.add('d-none');
            }
            if (e.target.classList.contains('sub-val')) {
                const dropdown = e.target.parentElement.querySelector('.sub-suggest-val');
                if (dropdown) dropdown.classList.add('d-none');
            }
            if (e.target.classList.contains('comp-name')) {
                const dropdown = e.target.parentElement.querySelector('.comp-suggest');
                if (dropdown) dropdown.classList.add('d-none');
            }
        }, 200);
    });

    function showKeySuggestions(input) {
        const dropdown = input.parentElement.querySelector('.annot-suggest');
        if (!dropdown || !annotationSuggestions) return;
        const q = input.value.toLowerCase();
        const keys = Object.keys(annotationSuggestions).filter(k => k.toLowerCase().includes(q));
        if (keys.length === 0 || (keys.length === 1 && keys[0] === input.value)) {
            dropdown.classList.add('d-none');
            return;
        }
        dropdown.innerHTML = keys.slice(0, 15).map(k =>
            `<button type="button" class="list-group-item list-group-item-action py-1 px-2 small annot-suggest-item" data-value="${esc(k)}">${esc(k)}</button>`
        ).join('');
        dropdown.classList.remove('d-none');

        dropdown.querySelectorAll('.annot-suggest-item').forEach(item => {
            item.addEventListener('mousedown', (ev) => {
                ev.preventDefault();
                input.value = item.dataset.value;
                dropdown.classList.add('d-none');
                // Auto-fill value if there's only one common value
                const vals = annotationSuggestions[item.dataset.value] || [];
                const valInput = input.closest('tr').querySelector('.annot-val');
                if (vals.length === 1 && valInput && !valInput.value) {
                    valInput.value = vals[0];
                }
                input.dispatchEvent(new Event('input'));
            });
        });
    }

    function showValSuggestions(input) {
        const dropdown = input.parentElement.querySelector('.annot-suggest-val');
        if (!dropdown || !annotationSuggestions) return;
        const keyInput = input.closest('tr').querySelector('.annot-key');
        if (!keyInput) return;
        const vals = annotationSuggestions[keyInput.value] || [];
        const q = input.value.toLowerCase();
        const filtered = vals.filter(v => v.toLowerCase().includes(q));
        if (filtered.length === 0 || (filtered.length === 1 && filtered[0] === input.value)) {
            dropdown.classList.add('d-none');
            return;
        }
        dropdown.innerHTML = filtered.slice(0, 10).map(v =>
            `<button type="button" class="list-group-item list-group-item-action py-1 px-2 small annot-suggest-val-item" data-value="${esc(v)}">${esc(v)}</button>`
        ).join('');
        dropdown.classList.remove('d-none');

        dropdown.querySelectorAll('.annot-suggest-val-item').forEach(item => {
            item.addEventListener('mousedown', (ev) => {
                ev.preventDefault();
                input.value = item.dataset.value;
                dropdown.classList.add('d-none');
            });
        });
    }

    function showSubKeySuggestions(input) {
        const dropdown = input.parentElement.querySelector('.sub-suggest');
        if (!dropdown || !substituteSuggestions) return;
        const q = input.value.toLowerCase();
        const keys = Object.keys(substituteSuggestions).filter(k => k.toLowerCase().includes(q));
        if (keys.length === 0 || (keys.length === 1 && keys[0] === input.value)) {
            dropdown.classList.add('d-none');
            return;
        }
        dropdown.innerHTML = keys.slice(0, 15).map(k =>
            `<button type="button" class="list-group-item list-group-item-action py-1 px-2 small sub-suggest-item" data-value="${esc(k)}">${esc(k)}</button>`
        ).join('');
        dropdown.classList.remove('d-none');

        dropdown.querySelectorAll('.sub-suggest-item').forEach(item => {
            item.addEventListener('mousedown', (ev) => {
                ev.preventDefault();
                input.value = item.dataset.value;
                dropdown.classList.add('d-none');
                // Auto-fill value if there's only one common value
                const vals = substituteSuggestions[item.dataset.value] || [];
                const valInput = input.closest('tr').querySelector('.sub-val');
                if (vals.length === 1 && valInput && !valInput.value) {
                    valInput.value = vals[0];
                }
                input.dispatchEvent(new Event('input'));
            });
        });
    }

    function showSubValSuggestions(input) {
        const dropdown = input.parentElement.querySelector('.sub-suggest-val');
        if (!dropdown || !substituteSuggestions) return;
        const keyInput = input.closest('tr').querySelector('.sub-key');
        if (!keyInput) return;
        const vals = substituteSuggestions[keyInput.value] || [];
        const q = input.value.toLowerCase();
        const filtered = vals.filter(v => v.toLowerCase().includes(q));
        if (filtered.length === 0 || (filtered.length === 1 && filtered[0] === input.value)) {
            dropdown.classList.add('d-none');
            return;
        }
        dropdown.innerHTML = filtered.slice(0, 10).map(v =>
            `<button type="button" class="list-group-item list-group-item-action py-1 px-2 small sub-suggest-val-item" data-value="${esc(v)}">${esc(v)}</button>`
        ).join('');
        dropdown.classList.remove('d-none');

        dropdown.querySelectorAll('.sub-suggest-val-item').forEach(item => {
            item.addEventListener('mousedown', (ev) => {
                ev.preventDefault();
                input.value = item.dataset.value;
                dropdown.classList.add('d-none');
            });
        });
    }

    function showCompSuggestions(input) {
        const dropdown = input.parentElement.querySelector('.comp-suggest');
        if (!dropdown || !componentSuggestions) return;
        const q = input.value.toLowerCase();
        const filtered = componentSuggestions.filter(c => c.toLowerCase().includes(q));
        if (filtered.length === 0 || (filtered.length === 1 && filtered[0] === input.value)) {
            dropdown.classList.add('d-none');
            return;
        }
        dropdown.innerHTML = filtered.slice(0, 15).map(c =>
            `<button type="button" class="list-group-item list-group-item-action py-1 px-2 small comp-suggest-item" data-value="${esc(c)}">
                <span class="badge ${compColor(c)} me-1">${esc(c)}</span>
            </button>`
        ).join('');
        dropdown.classList.remove('d-none');

        dropdown.querySelectorAll('.comp-suggest-item').forEach(item => {
            item.addEventListener('mousedown', (ev) => {
                ev.preventDefault();
                input.value = item.dataset.value;
                dropdown.classList.add('d-none');
            });
        });
    }

    function showDepSuggestions(input) {
        const dropdown = input.parentElement.querySelector('.dep-suggest');
        if (!dropdown || !dependencySuggestions) return;
        const q = input.value.toLowerCase();
        const filtered = dependencySuggestions.filter(d => d.name.toLowerCase().includes(q));
        if (filtered.length === 0 || (filtered.length === 1 && filtered[0].name === input.value)) {
            dropdown.classList.add('d-none');
            return;
        }
        dropdown.innerHTML = filtered.slice(0, 15).map(d =>
            `<button type="button" class="list-group-item list-group-item-action py-1 px-2 small dep-suggest-item" data-name="${esc(d.name)}" data-ns="${esc(d.namespace)}">
                <span>${esc(d.name)}</span> <span class="badge bg-primary ms-1">${esc(d.namespace)}</span>
            </button>`
        ).join('');
        dropdown.classList.remove('d-none');

        dropdown.querySelectorAll('.dep-suggest-item').forEach(item => {
            item.addEventListener('mousedown', (ev) => {
                ev.preventDefault();
                input.value = item.dataset.name;
                const nsInput = input.closest('tr').querySelector('.dep-ns');
                if (nsInput) nsInput.value = item.dataset.ns;
                dropdown.classList.add('d-none');
            });
        });
    }

    // ── Helpers ──
    function sectionTitle(title, icon) {
        return `<h6 class="mt-3 mb-2 text-muted"><i class="fas ${icon} me-1"></i>${title}</h6>`;
    }

    function compColor(c) {
        if (c.includes('cnpg')) return 'bg-danger';
        if (c.includes('gatus')) return 'bg-success';
        if (c.includes('pvc') || c.includes('volsync')) return 'bg-info text-dark';
        if (c.includes('redis') || c.includes('valkey') || c.includes('dragonfly')) return 'bg-warning text-dark';
        if (c.includes('alert')) return 'bg-dark';
        return 'bg-secondary';
    }

    function slugify(s) {
        return (s || '').replace(/[^a-zA-Z0-9]/g, '-');
    }

    function esc(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }
})();
