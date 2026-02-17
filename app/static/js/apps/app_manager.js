document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/apps/api/applications';
    const COMPONENTS_URL = '/apps/api/components';
    const SUBSTITUTES_URL = '/apps/api/substitutes';
    const ANNOTATIONS_URL = '/apps/api/ingress-annotations';
    const DASHBOARD_ICONS_CDN = 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/';

    const container = document.getElementById('appsContainer');
    const searchInput = document.getElementById('searchInput');
    const viewGridBtn = document.getElementById('viewGrid');
    const viewListBtn = document.getElementById('viewList');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const appCount = document.getElementById('appCount');

    const appDetailModal = new bootstrap.Modal(document.getElementById('appDetailModal'));
    const modalIcon = document.getElementById('modalIcon');
    const modalTitle = document.getElementById('modalTitle');
    const modalMeta = document.getElementById('modalMeta');
    const modalBody = document.getElementById('modalBody');
    const modalEditBtn = document.getElementById('modalEditBtn');
    const modalSaveBtn = document.getElementById('modalSaveBtn');

    let allApps = [];
    let currentView = 'grid';
    let isEditMode = false;
    let currentApp = null;

    // Known values for suggestions
    let knownComponents = [];
    let knownSubstitutes = [];
    let knownAnnotations = [];

    // ===== Resolve icon URL =====
    const resolveIconUrl = (iconValue) => {
        if (!iconValue) return null;
        if (iconValue.startsWith('http://') || iconValue.startsWith('https://')) return iconValue;
        const name = iconValue.replace(/\.(png|svg|jpg|jpeg|webp)$/i, '');
        return `${DASHBOARD_ICONS_CDN}${name}.png`;
    };

    // ===== Fetch all data =====
    const fetchAll = async () => {
        try {
            const [appsRes, compRes, subsRes, annotRes] = await Promise.all([
                fetch(API_URL),
                fetch(COMPONENTS_URL),
                fetch(SUBSTITUTES_URL),
                fetch(ANNOTATIONS_URL)
            ]);
            allApps = await appsRes.json();
            knownComponents = (await compRes.json()).map(c => c.nom || c);
            knownSubstitutes = (await subsRes.json()).map(s => s.nom || s);
            knownAnnotations = (await annotRes.json()).map(a => a.nom || a);

            populateDatalist('knownComponentsList', knownComponents);
            populateDatalist('knownSubstitutesList', knownSubstitutes);
            populateDatalist('knownAnnotationsList', knownAnnotations);

            // Build unique app names and namespaces for dependency suggestions
            const appNames = [...new Set(allApps.map(a => `${a.name}-${a.subapp_name}`))].sort();
            const namespaces = [...new Set(allApps.map(a => a.namespace))].sort();
            populateDatalist('knownAppsList', appNames);
            populateDatalist('knownNamespacesList', namespaces);

            render();
        } catch (error) {
            console.error('Failed to fetch data:', error);
            container.innerHTML = '<div class="alert alert-danger">Erreur lors du chargement.</div>';
        } finally {
            loadingSpinner.style.display = 'none';
        }
    };

    const populateDatalist = (id, values) => {
        const dl = document.getElementById(id);
        dl.innerHTML = values.map(v => `<option value="${v}">`).join('');
    };

    // ===== Render =====
    const render = () => {
        const query = searchInput.value.toLowerCase();
        const filtered = allApps.filter(app => {
            const fullName = `${app.name}-${app.subapp_name}`.toLowerCase();
            return fullName.includes(query) || app.namespace.toLowerCase().includes(query);
        });

        appCount.textContent = `${filtered.length} application${filtered.length > 1 ? 's' : ''}`;
        container.className = currentView === 'grid' ? 'am-grid' : 'am-list';
        container.innerHTML = '';
        filtered.forEach(app => container.appendChild(createCard(app)));
    };

    // ===== Create card =====
    const createCard = (app) => {
        const card = document.createElement('div');
        card.className = 'am-card';

        const annotations = app.ingress?.annotations || {};
        const iconValue = annotations['gethomepage.dev/icon'] || '';
        const iconUrl = resolveIconUrl(iconValue);
        const displayName = `${app.name}-${app.subapp_name}`;
        const isActive = app.active !== false;

        card.innerHTML = `
            <div class="am-card-header">
                <div class="am-icon-wrapper">
                    ${iconUrl ? `<img src="${iconUrl}" alt="" onerror="this.parentElement.innerHTML='<span class=\\'am-icon-placeholder\\'>?</span>'">` : '<span class="am-icon-placeholder">?</span>'}
                </div>
                <div class="am-card-info">
                    <div class="am-card-name">${displayName}</div>
                    <div class="am-card-meta">${app.namespace} / ${app.base}</div>
                </div>
                <span class="badge ${isActive ? 'bg-success' : 'bg-secondary'}">${isActive ? 'actif' : 'inactif'}</span>
            </div>
        `;

        card.addEventListener('click', () => openDetailModal(app));
        return card;
    };

    // ===== View toggle =====
    viewGridBtn.addEventListener('click', () => {
        currentView = 'grid';
        viewGridBtn.classList.add('active');
        viewListBtn.classList.remove('active');
        render();
    });

    viewListBtn.addEventListener('click', () => {
        currentView = 'list';
        viewListBtn.classList.add('active');
        viewGridBtn.classList.remove('active');
        render();
    });

    searchInput.addEventListener('input', render);

    // ===== Open detail modal =====
    const openDetailModal = (app) => {
        currentApp = app;
        isEditMode = false;

        const annotations = app.ingress?.annotations || {};
        const iconValue = annotations['gethomepage.dev/icon'] || '';
        const iconUrl = resolveIconUrl(iconValue);

        modalIcon.innerHTML = iconUrl
            ? `<img src="${iconUrl}" alt="" onerror="this.parentElement.innerHTML='<span class=\\'am-icon-placeholder\\'>?</span>'">`
            : '<span class="am-icon-placeholder">?</span>';
        modalTitle.textContent = `${app.name} - ${app.subapp_name}`;
        modalMeta.textContent = `${app.namespace} / ${app.base}`;

        modalEditBtn.classList.remove('d-none');
        modalEditBtn.textContent = 'Editer';
        modalSaveBtn.classList.add('d-none');

        renderModalBody(app, false);
        appDetailModal.show();
    };

    // ===== Toggle edit mode =====
    modalEditBtn.addEventListener('click', () => {
        if (!isEditMode) {
            isEditMode = true;
            modalEditBtn.classList.add('d-none');
            modalSaveBtn.classList.remove('d-none');
            renderModalBody(currentApp, true);
        }
    });

    modalSaveBtn.addEventListener('click', () => {
        saveApp();
    });

    // ===== Render modal body =====
    const renderModalBody = (app, editable) => {
        modalBody.innerHTML = '';
        const acc = document.createElement('div');
        acc.className = 'accordion';
        acc.id = 'appAccordion';

        acc.appendChild(buildConfigSection(app, editable));
        acc.appendChild(buildArraySection('Components', app.components || [], 'components', editable));
        acc.appendChild(buildDependsOnSection(app.dependsOn || [], editable));
        acc.appendChild(buildSubstituteSection(app.substitute || [], editable));
        acc.appendChild(buildIngressSection(app, editable));
        acc.appendChild(buildHelmSection(app, editable));

        modalBody.appendChild(acc);
    };

    // ===== Helper: accordion item =====
    const makeAccordionItem = (id, title, bodyContent, extraHeaderHtml = '') => {
        const item = document.createElement('div');
        item.className = 'accordion-item';
        item.innerHTML = `
            <h2 class="accordion-header">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${id}">
                    ${title}
                </button>
                ${extraHeaderHtml}
            </h2>
            <div id="collapse-${id}" class="accordion-collapse collapse show">
                <div class="accordion-body"></div>
            </div>
        `;
        item.querySelector('.accordion-body').appendChild(bodyContent);
        return item;
    };

    // ===== Helper: field row =====
    const fieldRow = (label, value, inputName, type = 'text', editable = false, datalistId = null) => {
        const row = document.createElement('div');
        row.className = 'am-field-row';
        if (!editable) {
            if (type === 'boolean') {
                row.innerHTML = `<label>${label}</label><span class="badge ${value ? 'bg-success' : 'bg-secondary'}">${value ? 'Oui' : 'Non'}</span>`;
            } else {
                row.innerHTML = `<label>${label}</label><span class="am-field-value">${value ?? '-'}</span>`;
            }
        } else {
            if (type === 'boolean') {
                row.innerHTML = `<label>${label}</label><div class="form-check form-switch"><input class="form-check-input" type="checkbox" data-field="${inputName}" ${value ? 'checked' : ''}></div>`;
            } else {
                const listAttr = datalistId ? `list="${datalistId}"` : '';
                row.innerHTML = `<label>${label}</label><input type="text" class="form-control form-control-sm" data-field="${inputName}" value="${value ?? ''}" ${listAttr}>`;
            }
        }
        return row;
    };

    // ===== Configuration section =====
    const buildConfigSection = (app, editable) => {
        const body = document.createElement('div');
        body.appendChild(fieldRow('Active', app.active, 'active', 'boolean', editable));
        body.appendChild(fieldRow('Prune', app.prune, 'prune', 'boolean', editable));
        body.appendChild(fieldRow('Retry Interval', app.retryInterval, 'retryInterval', 'text', editable));
        body.appendChild(fieldRow('Timeout', app.timeout, 'timeout', 'text', editable));
        body.appendChild(fieldRow('Interval', app.interval, 'interval', 'text', editable));
        return makeAccordionItem('config', 'Configuration', body);
    };

    // ===== Components section =====
    const buildArraySection = (title, items, fieldName, editable) => {
        const body = document.createElement('div');
        body.id = `section-${fieldName}`;

        const list = document.createElement('div');
        list.className = 'am-array-list';

        (items || []).forEach((item, idx) => {
            const val = typeof item === 'string' ? item : (item.path || item.nom || JSON.stringify(item));
            list.appendChild(createArrayItem(val, fieldName, idx, editable));
        });

        body.appendChild(list);

        if (editable) {
            const addRow = document.createElement('div');
            addRow.className = 'am-add-row';
            addRow.innerHTML = `
                <input type="text" class="form-control form-control-sm" placeholder="Ajouter..." list="knownComponentsList" id="addInput-${fieldName}">
                <button type="button" class="btn btn-outline-success btn-sm" title="Ajouter">+</button>
            `;
            addRow.querySelector('button').addEventListener('click', () => {
                const input = addRow.querySelector('input');
                const val = input.value.trim();
                if (!val) return;
                list.appendChild(createArrayItem(val, fieldName, list.children.length, true));
                input.value = '';
            });
            body.appendChild(addRow);
        }

        return makeAccordionItem(fieldName, title, body);
    };

    const createArrayItem = (value, fieldName, idx, editable) => {
        const el = document.createElement('div');
        el.className = 'am-array-item';
        if (editable) {
            el.innerHTML = `
                <input type="text" class="form-control form-control-sm" data-array="${fieldName}" value="${value}" list="knownComponentsList">
                <button type="button" class="btn btn-outline-danger btn-sm am-remove-btn" title="Supprimer">&times;</button>
            `;
            el.querySelector('.am-remove-btn').addEventListener('click', () => el.remove());
        } else {
            el.innerHTML = `<span class="badge bg-info text-dark">${value}</span>`;
        }
        return el;
    };

    // ===== DependsOn section =====
    const buildDependsOnSection = (deps, editable) => {
        const body = document.createElement('div');
        body.id = 'section-dependsOn';

        const list = document.createElement('div');
        list.className = 'am-array-list';

        (deps || []).forEach((dep, idx) => {
            list.appendChild(createDependsOnItem(dep, idx, editable));
        });

        body.appendChild(list);

        if (editable) {
            const addRow = document.createElement('div');
            addRow.className = 'am-add-row';
            addRow.innerHTML = `
                <input type="text" class="form-control form-control-sm" placeholder="name" list="knownAppsList" id="addDepName">
                <input type="text" class="form-control form-control-sm" placeholder="namespace" list="knownNamespacesList" id="addDepNs">
                <button type="button" class="btn btn-outline-success btn-sm" title="Ajouter">+</button>
            `;
            addRow.querySelector('button').addEventListener('click', () => {
                const nameInput = addRow.querySelector('#addDepName');
                const nsInput = addRow.querySelector('#addDepNs');
                const name = nameInput.value.trim();
                const ns = nsInput.value.trim();
                if (!name || !ns) return;
                list.appendChild(createDependsOnItem({ name, namespace: ns }, list.children.length, true));
                nameInput.value = '';
                nsInput.value = '';
            });
            body.appendChild(addRow);
        }

        return makeAccordionItem('dependsOn', 'Dependencies', body);
    };

    const createDependsOnItem = (dep, idx, editable) => {
        const el = document.createElement('div');
        el.className = 'am-array-item';
        if (editable) {
            el.innerHTML = `
                <input type="text" class="form-control form-control-sm" data-dep="name" value="${dep.name || ''}" list="knownAppsList" placeholder="name">
                <input type="text" class="form-control form-control-sm" data-dep="namespace" value="${dep.namespace || ''}" list="knownNamespacesList" placeholder="namespace">
                <button type="button" class="btn btn-outline-danger btn-sm am-remove-btn" title="Supprimer">&times;</button>
            `;
            el.querySelector('.am-remove-btn').addEventListener('click', () => el.remove());
        } else {
            el.innerHTML = `<span class="badge bg-warning text-dark">${dep.name}:${dep.namespace}</span>`;
        }
        return el;
    };

    // ===== Substitute section =====
    const buildSubstituteSection = (subs, editable) => {
        const body = document.createElement('div');
        body.id = 'section-substitute';

        const list = document.createElement('div');
        list.className = 'am-array-list';

        (subs || []).forEach((sub, idx) => {
            list.appendChild(createSubstituteItem(sub, idx, editable));
        });

        body.appendChild(list);

        if (editable) {
            const addRow = document.createElement('div');
            addRow.className = 'am-add-row';
            addRow.innerHTML = `
                <input type="text" class="form-control form-control-sm" placeholder="key" list="knownSubstitutesList" id="addSubKey">
                <input type="text" class="form-control form-control-sm" placeholder="value" id="addSubVal">
                <button type="button" class="btn btn-outline-success btn-sm" title="Ajouter">+</button>
            `;
            addRow.querySelector('button').addEventListener('click', () => {
                const keyInput = addRow.querySelector('#addSubKey');
                const valInput = addRow.querySelector('#addSubVal');
                const key = keyInput.value.trim();
                const val = valInput.value.trim();
                if (!key) return;
                list.appendChild(createSubstituteItem({ key, value: val }, list.children.length, true));
                keyInput.value = '';
                valInput.value = '';
            });
            body.appendChild(addRow);
        }

        return makeAccordionItem('substitute', 'Substitutions', body);
    };

    const createSubstituteItem = (sub, idx, editable) => {
        const el = document.createElement('div');
        el.className = 'am-array-item';
        if (editable) {
            el.innerHTML = `
                <input type="text" class="form-control form-control-sm" data-sub="key" value="${sub.key || ''}" list="knownSubstitutesList" placeholder="key">
                <span class="am-eq">=</span>
                <input type="text" class="form-control form-control-sm" data-sub="value" value="${sub.value || ''}" placeholder="value">
                <button type="button" class="btn btn-outline-danger btn-sm am-remove-btn" title="Supprimer">&times;</button>
            `;
            el.querySelector('.am-remove-btn').addEventListener('click', () => el.remove());
        } else {
            el.innerHTML = `<span class="badge bg-secondary">${sub.key} = ${sub.value || ''}</span>`;
        }
        return el;
    };

    // ===== Ingress section =====
    const buildIngressSection = (app, editable) => {
        const ingress = app.ingress || {};
        const annotations = ingress.annotations || {};
        const body = document.createElement('div');

        body.appendChild(fieldRow('Active', ingress.active, 'ingress.active', 'boolean', editable));
        body.appendChild(fieldRow('Class Name', ingress.className, 'ingress.className', 'text', editable));
        body.appendChild(fieldRow('Section Path', ingress.section_path, 'ingress.section_path', 'text', editable));
        body.appendChild(fieldRow('HelmRelease File', ingress.helmrelease_file, 'ingress.helmrelease_file', 'text', editable));

        // Annotations sub-section
        const annotTitle = document.createElement('h6');
        annotTitle.className = 'mt-3 mb-2';
        annotTitle.textContent = 'Annotations';
        body.appendChild(annotTitle);

        const annotList = document.createElement('div');
        annotList.className = 'am-array-list';
        annotList.id = 'section-annotations';

        Object.entries(annotations).forEach(([key, value], idx) => {
            annotList.appendChild(createAnnotationItem(key, value, idx, editable));
        });

        body.appendChild(annotList);

        if (editable) {
            const addRow = document.createElement('div');
            addRow.className = 'am-add-row';
            addRow.innerHTML = `
                <input type="text" class="form-control form-control-sm" placeholder="key" list="knownAnnotationsList" id="addAnnotKey">
                <input type="text" class="form-control form-control-sm" placeholder="value" id="addAnnotVal">
                <button type="button" class="btn btn-outline-success btn-sm" title="Ajouter">+</button>
            `;
            addRow.querySelector('button').addEventListener('click', () => {
                const keyInput = addRow.querySelector('#addAnnotKey');
                const valInput = addRow.querySelector('#addAnnotVal');
                const key = keyInput.value.trim();
                const val = valInput.value.trim();
                if (!key) return;
                annotList.appendChild(createAnnotationItem(key, val, annotList.children.length, true));
                keyInput.value = '';
                valInput.value = '';
            });
            body.appendChild(addRow);
        }

        return makeAccordionItem('ingress', 'Ingress', body);
    };

    const createAnnotationItem = (key, value, idx, editable) => {
        const el = document.createElement('div');
        el.className = 'am-array-item';
        if (editable) {
            el.innerHTML = `
                <input type="text" class="form-control form-control-sm" data-annot="key" value="${key}" list="knownAnnotationsList" placeholder="key">
                <span class="am-eq">=</span>
                <input type="text" class="form-control form-control-sm" data-annot="value" value="${value}" placeholder="value">
                <button type="button" class="btn btn-outline-danger btn-sm am-remove-btn" title="Supprimer">&times;</button>
            `;
            el.querySelector('.am-remove-btn').addEventListener('click', () => el.remove());
        } else {
            const shortKey = key.replace('gethomepage.dev/', 'ghp/').replace('hajimari.io/', 'haj/');
            el.innerHTML = `<span class="am-annot-key" title="${key}">${shortKey}</span><span class="am-annot-val">${value}</span>`;
        }
        return el;
    };

    // ===== Helm section =====
    const buildHelmSection = (app, editable) => {
        const helm = app.helm || {};
        const body = document.createElement('div');
        body.appendChild(fieldRow('Name', helm.name, 'helm.name', 'text', editable));
        body.appendChild(fieldRow('Health Checks', helm.healthChecks, 'helm.healthChecks', 'boolean', editable));
        return makeAccordionItem('helm', 'Helm', body);
    };

    // ===== Collect data from modal and save =====
    const saveApp = async () => {
        const app = currentApp;

        // Scalar fields
        const getVal = (name) => {
            const el = modalBody.querySelector(`[data-field="${name}"]`);
            if (!el) return undefined;
            if (el.type === 'checkbox') return el.checked;
            return el.value.trim() || undefined;
        };

        // Components
        const components = [];
        modalBody.querySelectorAll('[data-array="components"]').forEach(input => {
            const val = input.value.trim();
            if (val) components.push({ path: val });
        });

        // DependsOn
        const dependsOn = [];
        const depSection = modalBody.querySelector('#section-dependsOn');
        if (depSection) {
            depSection.querySelectorAll('.am-array-item').forEach(item => {
                const nameEl = item.querySelector('[data-dep="name"]');
                const nsEl = item.querySelector('[data-dep="namespace"]');
                if (nameEl && nsEl) {
                    const name = nameEl.value.trim();
                    const ns = nsEl.value.trim();
                    if (name && ns) dependsOn.push({ name, namespace: ns });
                }
            });
        }

        // Substitute
        const substitute = [];
        const subSection = modalBody.querySelector('#section-substitute');
        if (subSection) {
            subSection.querySelectorAll('.am-array-item').forEach(item => {
                const keyEl = item.querySelector('[data-sub="key"]');
                const valEl = item.querySelector('[data-sub="value"]');
                if (keyEl && valEl) {
                    const key = keyEl.value.trim();
                    const val = valEl.value.trim();
                    if (key) substitute.push({ key, value: val });
                }
            });
        }

        // Annotations
        const annotations = {};
        const annotSection = modalBody.querySelector('#section-annotations');
        if (annotSection) {
            annotSection.querySelectorAll('.am-array-item').forEach(item => {
                const keyEl = item.querySelector('[data-annot="key"]');
                const valEl = item.querySelector('[data-annot="value"]');
                if (keyEl && valEl) {
                    const key = keyEl.value.trim();
                    const val = valEl.value.trim();
                    if (key) annotations[key] = val;
                }
            });
        }

        // Build ingress
        const ingressActive = getVal('ingress.active');
        const ingress = {
            active: ingressActive,
            className: getVal('ingress.className'),
            section_path: getVal('ingress.section_path'),
            helmrelease_file: getVal('ingress.helmrelease_file'),
            annotations
        };

        // Build helm
        const helm = {
            name: getVal('helm.name'),
            healthChecks: getVal('helm.healthChecks')
        };

        const updatedData = {
            name: app.name,
            namespace: app.namespace,
            base: app.base,
            subapp_name: app.subapp_name,
            active: getVal('active'),
            prune: getVal('prune'),
            retryInterval: getVal('retryInterval'),
            timeout: getVal('timeout'),
            interval: getVal('interval'),
            components: components.length ? components : undefined,
            dependsOn: dependsOn.length ? dependsOn : undefined,
            substitute: substitute.length ? substitute : undefined,
            ingress,
            helm
        };

        const encodedNs = encodeURIComponent(app.namespace);
        const encodedName = encodeURIComponent(app.name);
        const encodedBase = encodeURIComponent(app.base);
        const encodedSubapp = encodeURIComponent(app.subapp_name);
        const url = `${API_URL}/${encodedNs}/${encodedName}/${encodedBase}/${encodedSubapp}`;

        modalSaveBtn.disabled = true;
        modalSaveBtn.textContent = 'Sauvegarde...';

        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });

            if (response.ok) {
                const updated = await response.json();
                // Update local cache
                const idx = allApps.findIndex(a => a.name === app.name && a.namespace === app.namespace && a.subapp_name === app.subapp_name);
                if (idx !== -1) {
                    allApps[idx] = { ...allApps[idx], ...updatedData };
                }
                appDetailModal.hide();
                render();
            } else {
                const err = await response.json();
                alert(`Erreur: ${err.error || response.statusText}`);
            }
        } catch (error) {
            console.error('Save failed:', error);
            alert('Erreur lors de la sauvegarde.');
        } finally {
            modalSaveBtn.disabled = false;
            modalSaveBtn.textContent = 'Sauvegarder';
        }
    };

    // ===== Init =====
    fetchAll();
});
