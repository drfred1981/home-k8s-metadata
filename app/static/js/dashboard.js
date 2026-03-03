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
            <tr class="${app.active ? '' : 'table-secondary'}">
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
                <td>${app.active ? '<span class="badge bg-success">Active</span>' : '<span class="badge bg-secondary">Inactive</span>'}</td>
            </tr>
        `).join('');
    }

    function iconHtml(app) {
        if (!app.icon) return '';
        const src = app.icon.startsWith('http') ? app.icon :
            `https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/${app.icon}`;
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

    function escHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }
});
