document.addEventListener('DOMContentLoaded', () => {
    let allApps = [];
    let sortCol = 'name';
    let sortAsc = true;

    const tbody = document.getElementById('apps-body');
    const countBadge = document.getElementById('app-count');
    const searchInput = document.getElementById('search');
    const nsFilter = document.getElementById('filter-namespace');
    const groupFilter = document.getElementById('filter-group');
    const activeFilter = document.getElementById('filter-active');

    fetch('/api/apps')
        .then(r => r.json())
        .then(apps => {
            allApps = apps;
            populateFilters(apps);
            render();
        })
        .catch(() => {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Erreur de chargement</td></tr>';
        });

    searchInput.addEventListener('input', render);
    nsFilter.addEventListener('change', render);
    groupFilter.addEventListener('change', render);
    activeFilter.addEventListener('change', render);

    document.querySelectorAll('.sortable').forEach(th => {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (sortCol === col) {
                sortAsc = !sortAsc;
            } else {
                sortCol = col;
                sortAsc = true;
            }
            render();
        });
    });

    function populateFilters(apps) {
        const namespaces = [...new Set(apps.map(a => a.namespace))].sort();
        const groups = [...new Set(apps.map(a => a.group).filter(Boolean))].sort();

        namespaces.forEach(ns => {
            nsFilter.insertAdjacentHTML('beforeend', `<option value="${ns}">${ns}</option>`);
        });
        groups.forEach(g => {
            groupFilter.insertAdjacentHTML('beforeend', `<option value="${g}">${g}</option>`);
        });
    }

    function render() {
        const query = searchInput.value.toLowerCase();
        const ns = nsFilter.value;
        const group = groupFilter.value;
        const active = activeFilter.value;

        let filtered = allApps.filter(app => {
            if (query && !app.name.toLowerCase().includes(query) &&
                !(app.display_name || '').toLowerCase().includes(query) &&
                !(app.description || '').toLowerCase().includes(query)) return false;
            if (ns && app.namespace !== ns) return false;
            if (group && app.group !== group) return false;
            if (active === 'true' && !app.active) return false;
            if (active === 'false' && app.active) return false;
            if (active === 'suspended' && !(app.active && app.suspended)) return false;
            return true;
        });

        filtered.sort((a, b) => {
            const va = (a[sortCol] || '').toString().toLowerCase();
            const vb = (b[sortCol] || '').toString().toLowerCase();
            return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
        });

        countBadge.textContent = `${filtered.length} / ${allApps.length}`;

        if (!filtered.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Aucune application</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(app => `
            <tr class="${!app.active ? 'table-secondary' : app.suspended ? 'table-warning' : ''}" style="cursor:pointer"
                data-ns="${escHtml(app.namespace)}" data-name="${escHtml(app.name)}"
                data-display="${escHtml(app.display_name || app.name)}" data-icon="${iconUrl(app)}">
                <td>
                    ${iconHtml(app)}
                    <strong>${escHtml(app.display_name || app.name)}</strong>
                    ${app.display_name && app.display_name !== app.name ? `<br><small class="text-muted">${escHtml(app.name)}</small>` : ''}
                </td>
                <td><span class="badge bg-primary">${escHtml(app.namespace)}</span></td>
                <td><code>${escHtml(app.version || '-')}</code></td>
                <td>${escHtml(app.group || '-')}</td>
                <td>${accessBadge(app)}</td>
                <td>${infraBadges(app)}</td>
                <td>${statusBadge(app)}</td>
            </tr>
        `).join('');
    }

    // Event delegation pour le clic sur les lignes et boutons suspend
    tbody.addEventListener('click', async (e) => {
        // Bouton suspend/resume
        const btn = e.target.closest('.suspend-toggle');
        if (btn) {
            e.stopPropagation();
            const ns = btn.dataset.ns;
            const appName = btn.dataset.app;
            const action = btn.dataset.action;
            const newSuspend = action === 'suspend';
            const label = newSuspend ? 'suspendre' : 'reprendre';
            if (!confirm(`Voulez-vous ${label} l'application ${appName} ?`)) return;

            btn.disabled = true;
            try {
                const detailResp = await fetch(`/api/apps/${encodeURIComponent(ns)}/${encodeURIComponent(appName)}`);
                const detail = await detailResp.json();

                // 1. Set suspend in ks.yaml for all subapps
                for (const sa of (detail.subapps || [])) {
                    const fullName = sa.ks_full_name || sa.full_name;
                    const resp = await fetch(`/api/apps/${encodeURIComponent(ns)}/${encodeURIComponent(appName)}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ subapp_full_name: fullName, changes: { suspend: newSuspend } })
                    });
                    if (!resp.ok) {
                        const err = await resp.json();
                        alert(`Erreur: ${err.error}`);
                        btn.disabled = false;
                        return;
                    }
                }

                // 2. Scale pods to 0 (suspend) or back to 1 (resume)
                const targetReplicas = newSuspend ? 0 : 1;
                const scaleResp = await fetch(`/api/apps/${encodeURIComponent(ns)}/${encodeURIComponent(appName)}/scale`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ replicas: targetReplicas })
                });
                if (!scaleResp.ok) {
                    const err = await scaleResp.json();
                    alert(`${newSuspend ? 'Suspend' : 'Resume'} OK mais erreur scale: ${err.error}`);
                }

                const apps = await fetch('/api/apps').then(r => r.json());
                allApps = apps;
                render();
            } catch (err) {
                alert(`Erreur reseau: ${err.message}`);
                btn.disabled = false;
            }
            return;
        }

        // Clic sur ligne → ouvrir le detail
        const tr = e.target.closest('tr[data-name]');
        if (!tr) return;
        if (window.openAppDetail) {
            window.openAppDetail(tr.dataset.ns, tr.dataset.name, tr.dataset.display, tr.dataset.icon);
        }
    });

    function iconUrl(app) {
        if (!app.icon) return '';
        return app.icon.startsWith('http') ? app.icon :
            `https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/${app.icon}`;
    }

    function iconHtml(app) {
        const src = iconUrl(app);
        if (!src) return '';
        return `<img src="${src}" width="20" height="20" class="me-2 rounded" onerror="this.style.display='none'">`;
    }

    function accessBadge(app) {
        if (!app.ingress_class) return '<span class="text-muted">-</span>';
        const cls = app.ingress_class === 'external' ? 'bg-warning text-dark' : 'bg-info';
        return `<span class="badge ${cls}">${escHtml(app.ingress_class)}</span>`;
    }

    function infraBadges(app) {
        const badges = [];
        if (app.has_database) badges.push('<span class="badge bg-danger">DB</span>');
        if (app.has_monitoring) badges.push(`<span class="badge bg-success">${app.has_monitoring === 'external' ? 'Gatus ext.' : 'Gatus int.'}</span>`);
        if (app.has_storage) badges.push(`<span class="badge bg-info">${escHtml(app.has_storage)}</span>`);
        return badges.join(' ') || '<span class="text-muted">-</span>';
    }

    function statusBadge(app) {
        if (!app.active) return '<span class="badge bg-secondary">Inactive</span>';
        if (app.suspended) {
            return `<span class="badge bg-warning text-dark">Suspendu</span>
                <button class="btn btn-sm btn-outline-success ms-1 suspend-toggle"
                        data-ns="${escHtml(app.namespace)}" data-app="${escHtml(app.name)}"
                        data-action="resume" title="Reprendre la reconciliation">
                    <i class="fas fa-play"></i>
                </button>`;
        }
        return `<span class="badge bg-success">Active</span>
            <button class="btn btn-sm btn-outline-warning ms-1 suspend-toggle"
                    data-ns="${escHtml(app.namespace)}" data-app="${escHtml(app.name)}"
                    data-action="suspend" title="Suspendre la reconciliation">
                <i class="fas fa-pause"></i>
            </button>`;
    }

    function escHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }
});
