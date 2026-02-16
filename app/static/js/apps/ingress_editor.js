document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/apps/api/applications';
    const DASHBOARD_ICONS_TREE = 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/tree.json';
    const DASHBOARD_ICONS_CDN = 'https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/';
    const SELFHST_ICONS_CDN = 'https://cdn.jsdelivr.net/gh/selfhst/icons@main/png/';

    const container = document.getElementById('appsContainer');
    const searchInput = document.getElementById('searchInput');
    const viewGridBtn = document.getElementById('viewGrid');
    const viewListBtn = document.getElementById('viewList');
    const expandAllBtn = document.getElementById('expandAllBtn');
    const collapseAllBtn = document.getElementById('collapseAllBtn');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const appCount = document.getElementById('appCount');

    // Icon picker elements
    const iconPickerModal = new bootstrap.Modal(document.getElementById('iconPickerModal'));
    const dashboardIconSearch = document.getElementById('dashboardIconSearch');
    const dashboardIconGrid = document.getElementById('dashboardIconGrid');
    const selfhstIconSearch = document.getElementById('selfhstIconSearch');
    const selfhstIconGrid = document.getElementById('selfhstIconGrid');
    const customIconUrl = document.getElementById('customIconUrl');
    const customIconPreview = document.getElementById('customIconPreview');
    const customIconConfirm = document.getElementById('customIconConfirm');

    let allApps = [];
    let currentView = 'grid'; // 'grid' or 'list'
    let dashboardIconsList = []; // Cached list of dashboard icon names
    let currentIconTarget = null; // {appId, inputElement}

    // ===== Resolve icon URL for display =====
    const resolveIconUrl = (iconValue) => {
        if (!iconValue) return null;
        if (iconValue.startsWith('http://') || iconValue.startsWith('https://')) {
            return iconValue;
        }
        // Simple name like "homepage.png" -> dashboard-icons CDN
        const name = iconValue.replace(/\.(png|svg|jpg|jpeg|webp)$/i, '');
        return `${DASHBOARD_ICONS_CDN}${name}.png`;
    };

    // ===== Fetch applications =====
    const fetchApplications = async () => {
        try {
            const response = await fetch(API_URL);
            const data = await response.json();
            // Filter only apps that have ingress with annotations
            allApps = data.filter(app => app.ingress && app.ingress.active);
            render();
        } catch (error) {
            console.error('Failed to fetch applications:', error);
            container.innerHTML = '<div class="alert alert-danger">Erreur lors du chargement des applications.</div>';
        } finally {
            loadingSpinner.style.display = 'none';
        }
    };

    // ===== Render =====
    const render = () => {
        const query = searchInput.value.toLowerCase();
        const filtered = allApps.filter(app => {
            const fullName = `${app.name}-${app.subapp_name}`.toLowerCase();
            return fullName.includes(query) || app.namespace.toLowerCase().includes(query);
        });

        appCount.textContent = `${filtered.length} application${filtered.length > 1 ? 's' : ''}`;

        container.className = currentView === 'grid' ? 'ie-grid' : 'ie-list';
        container.innerHTML = '';

        filtered.forEach(app => {
            container.appendChild(createCard(app));
        });
    };

    // ===== Create a card for an app =====
    const createCard = (app) => {
        const card = document.createElement('div');
        card.className = 'ie-card';
        const appId = `${app.name}-${app.subapp_name}-${app.namespace}`;
        card.dataset.appId = appId;

        const annotations = app.ingress?.annotations || {};
        const iconValue = annotations['gethomepage.dev/icon'] || '';
        const iconUrl = resolveIconUrl(iconValue);
        const appDisplayName = annotations['gethomepage.dev/name'] || `${app.name}-${app.subapp_name}`;
        const group = annotations['gethomepage.dev/group'] || '';
        const description = annotations['gethomepage.dev/description'] || '';

        // Header
        const header = document.createElement('div');
        header.className = 'ie-card-header';
        header.innerHTML = `
            <div class="ie-icon-wrapper">
                ${iconUrl ? `<img src="${iconUrl}" alt="" onerror="this.parentElement.innerHTML='<span class=\\'ie-icon-placeholder\\'>?</span>'">` : '<span class="ie-icon-placeholder">?</span>'}
            </div>
            <div class="ie-card-info">
                <div class="ie-card-name">${appDisplayName}</div>
                <div class="ie-card-meta">${app.namespace} ${group ? '/ ' + group : ''}</div>
                ${description ? `<div class="ie-card-meta">${description}</div>` : ''}
            </div>
            <span class="ie-card-chevron">&#9654;</span>
        `;
        header.addEventListener('click', () => toggleCard(card));

        // Body (expandable)
        const body = document.createElement('div');
        body.className = 'ie-card-body';

        const bodyInner = document.createElement('div');
        bodyInner.className = 'ie-card-body-inner';

        // Annotation fields
        const annotationKeys = Object.keys(annotations);
        const allKnownKeys = [
            'gethomepage.dev/enabled',
            'gethomepage.dev/name',
            'gethomepage.dev/description',
            'gethomepage.dev/group',
            'gethomepage.dev/icon',
            'gethomepage.dev/pod-selector',
            'gethomepage.dev/widget.type',
            'gethomepage.dev/widget.url',
            'gethomepage.dev/widget.key',
            'gethomepage.dev/widget.username',
            'gethomepage.dev/widget.password',
            'hajimari.io/appName',
            'hajimari.io/icon',
            'hajimari.io/instance',
            'hajimari.io/enable',
            'hajimari.io/group',
        ];

        // Show existing annotations + any missing known keys that exist
        const keysToShow = [...new Set([...annotationKeys])];

        keysToShow.forEach(key => {
            const row = document.createElement('div');
            row.className = 'ie-annotation-row';

            const shortKey = key.replace('gethomepage.dev/', 'ghp/').replace('hajimari.io/', 'haj/');

            row.innerHTML = `
                <label title="${key}">${shortKey}</label>
                <input type="text" class="form-control form-control-sm" data-annotation-key="${key}" value="${annotations[key] || ''}">
            `;

            // Add icon picker button for icon fields
            if (key === 'gethomepage.dev/icon' || key === 'hajimari.io/icon') {
                const pickerBtn = document.createElement('button');
                pickerBtn.type = 'button';
                pickerBtn.className = 'btn btn-outline-secondary btn-sm btn-icon-picker';
                pickerBtn.textContent = '...';
                pickerBtn.title = 'Choisir une icône';
                pickerBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const input = row.querySelector('input');
                    openIconPicker(input);
                });
                row.appendChild(pickerBtn);
            }

            bodyInner.appendChild(row);
        });

        // Save button
        const saveDiv = document.createElement('div');
        saveDiv.className = 'ie-save-btn';
        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'btn btn-primary btn-sm';
        saveBtn.textContent = 'Sauvegarder';
        saveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            saveAnnotations(app, bodyInner, saveBtn);
        });
        saveDiv.appendChild(saveBtn);
        bodyInner.appendChild(saveDiv);

        body.appendChild(bodyInner);
        card.appendChild(header);
        card.appendChild(body);

        return card;
    };

    // ===== Toggle card expand/collapse =====
    const toggleCard = (card) => {
        card.classList.toggle('expanded');
    };

    // ===== Expand All / Collapse All =====
    expandAllBtn.addEventListener('click', () => {
        container.querySelectorAll('.ie-card').forEach(card => card.classList.add('expanded'));
    });

    collapseAllBtn.addEventListener('click', () => {
        container.querySelectorAll('.ie-card').forEach(card => card.classList.remove('expanded'));
    });

    // ===== View Toggle =====
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

    // ===== Search =====
    searchInput.addEventListener('input', render);

    // ===== Save annotations for an app =====
    const saveAnnotations = async (app, bodyInner, saveBtn) => {
        const inputs = bodyInner.querySelectorAll('input[data-annotation-key]');
        const newAnnotations = {};
        inputs.forEach(input => {
            const val = input.value.trim();
            if (val) {
                newAnnotations[input.dataset.annotationKey] = val;
            }
        });

        // Build updated app data (only modify ingress annotations)
        const updatedData = {
            name: app.name,
            namespace: app.namespace,
            base: app.base,
            subapp_name: app.subapp_name,
            active: app.active,
            prune: app.prune,
            retryInterval: app.retryInterval,
            timeout: app.timeout,
            interval: app.interval,
            components: app.components,
            dependsOn: app.dependsOn,
            helm: app.helm,
            substitute: app.substitute,
            ingress: {
                ...app.ingress,
                annotations: newAnnotations
            }
        };

        const encodedNs = encodeURIComponent(app.namespace);
        const encodedName = encodeURIComponent(app.name);
        const encodedBase = encodeURIComponent(app.base);
        const encodedSubapp = encodeURIComponent(app.subapp_name);
        const url = `${API_URL}/${encodedNs}/${encodedName}/${encodedBase}/${encodedSubapp}`;

        saveBtn.disabled = true;
        saveBtn.textContent = 'Sauvegarde...';

        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });

            if (response.ok) {
                saveBtn.textContent = 'Sauvegardé !';
                saveBtn.className = 'btn btn-success btn-sm';
                // Update the local cache
                const idx = allApps.findIndex(a => a.name === app.name && a.namespace === app.namespace && a.subapp_name === app.subapp_name);
                if (idx !== -1) {
                    allApps[idx].ingress.annotations = newAnnotations;
                }
                setTimeout(() => {
                    saveBtn.textContent = 'Sauvegarder';
                    saveBtn.className = 'btn btn-primary btn-sm';
                    saveBtn.disabled = false;
                }, 2000);
            } else {
                const err = await response.json();
                alert(`Erreur: ${err.error || response.statusText}`);
                saveBtn.textContent = 'Sauvegarder';
                saveBtn.disabled = false;
            }
        } catch (error) {
            console.error('Save failed:', error);
            alert('Erreur lors de la sauvegarde.');
            saveBtn.textContent = 'Sauvegarder';
            saveBtn.disabled = false;
        }
    };

    // ===== Icon Picker =====
    const openIconPicker = (inputElement) => {
        currentIconTarget = inputElement;
        iconPickerModal.show();
        loadDashboardIcons();
    };

    // ===== Dashboard Icons =====
    const loadDashboardIcons = async () => {
        if (dashboardIconsList.length > 0) {
            renderDashboardIcons('');
            return;
        }

        dashboardIconGrid.innerHTML = '<div class="text-center text-muted p-3">Chargement...</div>';

        try {
            const response = await fetch(DASHBOARD_ICONS_TREE);
            const tree = await response.json();
            // Extract PNG filenames from the tree
            dashboardIconsList = extractIconNames(tree);
            renderDashboardIcons('');
        } catch (error) {
            console.error('Failed to load dashboard icons:', error);
            dashboardIconGrid.innerHTML = '<div class="text-center text-danger p-3">Erreur de chargement</div>';
        }
    };

    const extractIconNames = (tree) => {
        // tree.json is a nested object. PNG icons are under "png/" folder
        const names = [];
        const walk = (node, path) => {
            if (Array.isArray(node)) {
                node.forEach(item => walk(item, path));
            } else if (typeof node === 'object' && node !== null) {
                for (const key in node) {
                    walk(node[key], path + key);
                }
            } else if (typeof node === 'string') {
                if (node.endsWith('.png')) {
                    names.push(node.replace('.png', ''));
                }
            }
        };

        // Try direct array of filenames or nested structure
        if (Array.isArray(tree)) {
            tree.forEach(item => {
                if (typeof item === 'string' && item.endsWith('.png')) {
                    names.push(item.replace('.png', ''));
                } else if (typeof item === 'object' && item.png) {
                    names.push(item.png.replace('.png', ''));
                }
            });
        } else if (typeof tree === 'object') {
            // Nested: look for png folder
            const pngFolder = tree.png || tree;
            if (Array.isArray(pngFolder)) {
                pngFolder.forEach(name => {
                    if (typeof name === 'string') {
                        names.push(name.replace('.png', ''));
                    }
                });
            } else {
                walk(tree, '');
            }
        }

        return [...new Set(names)].sort();
    };

    const renderDashboardIcons = (query) => {
        const filtered = query
            ? dashboardIconsList.filter(name => name.toLowerCase().includes(query.toLowerCase()))
            : dashboardIconsList;

        // Limit to 200 to avoid performance issues
        const limited = filtered.slice(0, 200);

        dashboardIconGrid.innerHTML = '';

        if (limited.length === 0) {
            dashboardIconGrid.innerHTML = '<div class="text-center text-muted p-3">Aucune icône trouvée</div>';
            return;
        }

        limited.forEach(name => {
            const item = document.createElement('div');
            item.className = 'ie-icon-item';
            item.innerHTML = `
                <img src="${DASHBOARD_ICONS_CDN}${name}.png" alt="${name}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22/>'">
                <span title="${name}">${name}</span>
            `;
            item.addEventListener('click', () => {
                selectIcon(`${name}.png`);
            });
            dashboardIconGrid.appendChild(item);
        });

        if (filtered.length > 200) {
            const more = document.createElement('div');
            more.className = 'text-center text-muted p-2';
            more.textContent = `${filtered.length - 200} icônes supplémentaires masquées. Affinez votre recherche.`;
            dashboardIconGrid.appendChild(more);
        }
    };

    dashboardIconSearch.addEventListener('input', () => {
        renderDashboardIcons(dashboardIconSearch.value);
    });

    // ===== selfh.st Icons =====
    let selfhstDebounce = null;

    selfhstIconSearch.addEventListener('input', () => {
        clearTimeout(selfhstDebounce);
        const query = selfhstIconSearch.value.trim();
        if (!query) {
            selfhstIconGrid.innerHTML = '<div class="text-center text-muted p-3">Tapez un nom pour rechercher</div>';
            return;
        }
        selfhstDebounce = setTimeout(() => renderSelfhstIcons(query), 300);
    });

    const renderSelfhstIcons = (query) => {
        // selfh.st doesn't have a public JSON index, so we generate candidates
        // based on the search query and check if the images load
        const candidates = generateSelfhstCandidates(query);

        selfhstIconGrid.innerHTML = '';

        if (candidates.length === 0) {
            selfhstIconGrid.innerHTML = '<div class="text-center text-muted p-3">Aucun résultat</div>';
            return;
        }

        candidates.forEach(name => {
            const url = `${SELFHST_ICONS_CDN}${name}.png`;
            const item = document.createElement('div');
            item.className = 'ie-icon-item';
            item.innerHTML = `
                <img src="${url}" alt="${name}" loading="lazy" onerror="this.parentElement.style.display='none'">
                <span title="${name}">${name}</span>
            `;
            item.addEventListener('click', () => {
                selectIcon(url);
            });
            selfhstIconGrid.appendChild(item);
        });
    };

    const generateSelfhstCandidates = (query) => {
        const base = query.toLowerCase().replace(/\s+/g, '-');
        const variants = [
            base,
            `${base}-light`,
            `${base}-dark`,
        ];
        // Also try with common prefixes/suffixes removed
        if (base.includes('-')) {
            const parts = base.split('-');
            variants.push(parts[0]);
        }
        return variants;
    };

    // ===== Custom URL =====
    customIconUrl.addEventListener('input', () => {
        const url = customIconUrl.value.trim();
        if (url) {
            customIconPreview.innerHTML = `<img src="${url}" alt="preview" onerror="this.parentElement.innerHTML='<span class=\\'text-danger\\'>Image non trouvée</span>'">`;
        } else {
            customIconPreview.innerHTML = '<span class="text-muted">Aperçu</span>';
        }
    });

    customIconConfirm.addEventListener('click', () => {
        const url = customIconUrl.value.trim();
        if (url) {
            selectIcon(url);
        }
    });

    // ===== Select icon and insert into target input =====
    const selectIcon = (value) => {
        if (currentIconTarget) {
            currentIconTarget.value = value;
            // Trigger input event for any listeners
            currentIconTarget.dispatchEvent(new Event('input'));
        }
        iconPickerModal.hide();
    };

    // ===== Init =====
    fetchApplications();
});
