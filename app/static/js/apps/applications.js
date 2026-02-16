document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('applicationForm');
    const tableBody = document.querySelector('#applicationsTable tbody');
    const submitBtn = document.getElementById('submitBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    // Références aux éléments du formulaire de base
    const originalAppNameInput = document.getElementById('originalAppName');
    const originalAppNamespaceInput = document.getElementById('originalAppNamespace');
    const originalAppBaseInput =  document.getElementById('base');
    const originalSubappNameInput = document.getElementById('originalSubappName');
    const nameInput = document.getElementById('name');
    const namespaceInput = document.getElementById('namespace');
    const subappNameInput = document.getElementById('subappName');
    const activeInput = document.getElementById('active');

    // Références aux métadonnées
    const baseInput = document.getElementById('base');
    const pruneInput = document.getElementById('prune');
    const retryIntervalInput = document.getElementById('retryInterval');
    const timeoutInput = document.getElementById('timeout');
    const intervalInput = document.getElementById('interval');

    // Références aux champs Ingress
    const ingressClassNameInput = document.getElementById('ingressClassName');
    const ingressSectionPathInput = document.getElementById('ingressSectionPath');
    const ingressHelmreleaseFile = document.getElementById('ingressHelmreleaseFile');
    const ingressActive = document.getElementById('ingressActive');
    const ingressAnnotationsKeysSelect = document.getElementById('ingressAnnotationsKeys');
    const ingressAnnotationsValuesContainer = document.getElementById('ingressAnnotationsValuesContainer');

    // Références aux champs Helm
    const helmNameInput = document.getElementById('helmName');
    const helmHealthChecksInput = document.getElementById('helmHealthChecks');

    // Références aux champs Substitutes
    const substitutesKeysSelect = document.getElementById('substitutesKeys');
    const substitutesValuesContainer = document.getElementById('substitutesValuesContainer');

    // Références aux listes déroulantes
    const componentsSelect = document.getElementById('components');
    const dependsOnSelect = document.getElementById('dependsOn');

    const dependencyDepthSelect = document.getElementById('dependencyDepth');
    const graphContainer = document.getElementById('dependencyGraph');

    const API_URL_BASE = '/apps/api/applications';
    const applicationsTable = document.getElementById('applicationsTable');

    const loadingSpinner = document.getElementById('loadingSpinner');

    const filterNameInput = document.getElementById('filter-name');
    const filterNamespaceSelect = document.getElementById('filter-namespace');
    const filterBaseSelect = document.getElementById('filter-base');
    const filterActiveSelect = document.getElementById('filter-active');
    const filterDependenciesInput = document.getElementById('filter-dependencies');
    const filterSubappInput = document.getElementById('filter-subapp');

    let allApplications = []; // Cache pour stocker toutes les applications

    const drawGraph = (graphData) => {
        const svg = d3.select("#dependencyGraph");
        const width = graphContainer.clientWidth;
        const height = graphContainer.clientHeight;

        svg.attr("width", width).attr("height", height);
        svg.selectAll("*").remove();

        svg.append("defs").append("marker")
            .attr("id", "arrowhead")
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 25)
            .attr("orient", "auto")
            .attr("markerWidth", 8)
            .attr("markerHeight", 8)
            .append("path").attr("d", "M 0,-5 L 10,0 L 0,5")
            .attr("fill", "#999");

        const simulation = d3.forceSimulation(graphData.nodes)
            .force("link", d3.forceLink(graphData.links).id(d => d.id).distance(100))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(width / 2, height / 2));

        const link = svg.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(graphData.links)
            .enter().append("line")
            .attr("stroke-width", 2)
            .attr("stroke", "#999")
            .attr("marker-end", "url(#arrowhead)");

        const node = svg.append("g")
            .attr("class", "nodes")
            .selectAll("g")
            .data(graphData.nodes)
            .enter().append("g")
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));

        node.append("path")
            .attr("d", d => {
                if (d.type === 'source') {
                    return `M -15 -15 L 15 -15 L 15 15 L -15 15 Z`;
                } else {
                    return d3.symbol().type(d3.symbolCircle).size(300)();
                }
            })
            .attr("fill", d => {
                if (d.type === 'source') {
                    return 'red';
                } else {
                    return 'steelblue';
                }
            });

    node.append("text")
        .attr("x", 18)
        .attr("y", 5)
        .text(d => d.name)
        .style("fill", "#555")
        .style("font-size", "12px");

    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
};

    // Fonction pour mettre à jour le graphe en fonction de l'application et de la profondeur
    const updateGraph = async () => {
        const appName = nameInput.value.trim();
        const appNamespace = namespaceInput.value.trim();
        const subappName = subappNameInput.value.trim() || 'app';
        const depth = dependencyDepthSelect.value;

        if (!appName || !appNamespace) {
            drawGraph({nodes: [], links: []});
            return;
        }

        // Envoyer le nom combiné <name>-<subapp> pour le graphe de dépendances
        const response = await fetch(`${API_URL_BASE}/dependencies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ app_name: `${appName}-${subappName}`, app_namespace: appNamespace, depth: depth === 'all' ? Infinity : parseInt(depth) })
        });

        if (response.ok) {
            const graphData = await response.json();
            drawGraph(graphData);
        }
    };

    // Écouteur pour les changements de nom, namespace, subapp et profondeur
    nameInput.addEventListener('input', updateGraph);
    namespaceInput.addEventListener('input', updateGraph);
    subappNameInput.addEventListener('input', updateGraph);
    dependencyDepthSelect.addEventListener('change', updateGraph);

    // Fonction pour générer dynamiquement les champs de valeur d'annotations
    const updateAnnotationsValueFields = (existingAnnotations = {}) => {
        const selectedKeys = Array.from(ingressAnnotationsKeysSelect.options)
            .filter(opt => opt.selected)
            .map(opt => opt.value);

        const currentValues = {};
        ingressAnnotationsValuesContainer.querySelectorAll('input').forEach(input => {
            const key = input.id.replace('annotation-', '');
            currentValues[key] = input.value;
        });

        ingressAnnotationsValuesContainer.innerHTML = '';
        selectedKeys.forEach(key => {
            const existingValue = existingAnnotations[key] || currentValues[key] || '';
            const div = document.createElement('div');
            div.className = 'row mb-3';
            div.innerHTML = `
                <div class="col-sm-4">
                    <label for="annotation-${key}" class="col-form-label">${key} :</label>
                </div>
                <div class="col-sm-8">
                    <input type="text" class="form-control" id="annotation-${key}" name="annotation-${key}" value="${existingValue}">
                </div>
            `;
            ingressAnnotationsValuesContainer.appendChild(div);
        });
    };

    // Fonction pour générer dynamiquement les champs de valeur de substituts
    const updateSubstituteValueFields = (existingSubstitutes = []) => {
        const selectedKeys = Array.from(substitutesKeysSelect.options)
            .filter(opt => opt.selected)
            .map(opt => opt.value);

        const currentValues = {};
        substitutesValuesContainer.querySelectorAll('input').forEach(input => {
            const key = input.id.replace('substitute-', '');
            currentValues[key] = input.value;
        });

        substitutesValuesContainer.innerHTML = '';
        selectedKeys.forEach(key => {
            const existingValue = existingSubstitutes.find(s => s.key === key)?.value || currentValues[key] || '';
            const div = document.createElement('div');
            div.className = 'row mb-3';
            div.innerHTML = `
                <div class="col-sm-4">
                    <label for="substitute-${key}" class="col-form-label">${key} :</label>
                </div>
                <div class="col-sm-8">
                    <input type="text" class="form-control" id="substitute-${key}" name="substitute-${key}" value="${existingValue}">
                </div>
            `;
            substitutesValuesContainer.appendChild(div);
        });
    };

    // Écouteurs pour les changements dans les listes de clés
    ingressAnnotationsKeysSelect.addEventListener('change', () => updateAnnotationsValueFields());
    substitutesKeysSelect.addEventListener('change', () => updateSubstituteValueFields());

    const fetchApplications = async () => {
        try {
            const response = await fetch(API_URL_BASE);
            const data = await response.json();
            allApplications = data;

            populateNamespaceFilter(allApplications);
            populateBaseFilter(allApplications);
            applyFilters();
        } catch (error) {
            console.error("Failed to fetch applications:", error);
        } finally {
            if (loadingSpinner) {
                loadingSpinner.style.display = 'none';
            }
        }
    };

    const populateNamespaceFilter = (applications) => {
        const namespaces = new Set();
        applications.forEach(app => namespaces.add(app.namespace));

        const sortedNamespaces = Array.from(namespaces).sort();
        sortedNamespaces.forEach(ns => {
            const option = document.createElement('option');
            option.value = ns;
            option.textContent = ns;
            filterNamespaceSelect.appendChild(option);
        });
    };

    const populateBaseFilter = (applications) => {
        const bases = new Set();
        applications.forEach(app => bases.add(app.base));

        const sortedBases = Array.from(bases).sort();
        sortedBases.forEach(b => {
            const option = document.createElement('option');
            option.value = b;
            option.textContent = b;
            filterBaseSelect.appendChild(option);
        });
    };

    const applyFilters = () => {
        const nameFilter = filterNameInput.value.toLowerCase();
        const namespaceFilter = filterNamespaceSelect.value;
        const baseFilter = filterBaseSelect.value;
        const activeFilter = filterActiveSelect.value;
        const dependenciesFilter = filterDependenciesInput.value.toLowerCase();
        const subappFilter = filterSubappInput ? filterSubappInput.value.toLowerCase() : '';

        const filteredApps = allApplications.filter(app => {
            const matchesName = app.name.toLowerCase().includes(nameFilter);
            const matchesNamespace = namespaceFilter === '' || app.namespace.toLowerCase().includes(namespaceFilter.toLowerCase());
            const matchesBase = baseFilter === '' || app.base.toLowerCase().includes(baseFilter.toLowerCase());
            const matchesActive = activeFilter === '' || String(app.active) === activeFilter;
            const matchesDependencies = dependenciesFilter === '' ||
                                        (app.dependsOn && app.dependsOn.some(dep => dep.name.toLowerCase().includes(dependenciesFilter)));
            const matchesSubapp = subappFilter === '' || app.subapp_name.toLowerCase().includes(subappFilter);

            return matchesName && matchesNamespace && matchesActive && matchesDependencies && matchesBase && matchesSubapp;
        });

        renderTable(filteredApps);
    };

    const renderTable = (data) => {
        tableBody.innerHTML = '';
        if (data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center">Aucune application ne correspond aux critères.</td></tr>';
            return;
        }
        data.forEach(app => {
            const row = tableBody.insertRow();
            row.dataset.name = app.name;
            row.dataset.namespace = app.namespace;
            row.dataset.base = app.base;
            row.dataset.subappName = app.subapp_name;

            const componentsList = (app.components || []).map(c => c.path || c.nom).join(', ');
            const dependsOnList = (app.dependsOn || []).map(d => `${d.name} (${d.namespace})`).join(', ');

            row.innerHTML = `
                <td>${app.name}</td>
                <td>${app.subapp_name}</td>
                <td>${app.namespace}</td>
                <td>${app.base}</td>
                <td>${app.active ? 'Oui' : 'Non'}</td>
                <td>${dependsOnList}</td>
                <td>
                    <button class="btn btn-sm btn-info edit-btn" data-name="${app.name}" data-namespace="${app.namespace}" data-subapp-name="${app.subapp_name}">Modifier</button>
                    <button class="btn btn-sm btn-danger delete-btn" data-name="${app.name}" data-namespace="${app.namespace}" data-base="${app.base}" data-subapp-name="${app.subapp_name}">Supprimer</button>
                </td>
            `;
        });
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const originalName = originalAppNameInput.value;
        const originalNamespace = originalAppNamespaceInput.value;
        const originalBase = originalAppBaseInput.value;
        const originalSubappName = originalSubappNameInput.value;

        const components = Array.from(componentsSelect.options)
            .filter(opt => opt.selected)
            .map(opt => ({ path: opt.value }));

        const dependsOn = Array.from(dependsOnSelect.options)
            .filter(opt => opt.selected)
            .map(opt => {
                const [name, namespace] = opt.value.split(':');
                return { name: name, namespace: namespace };
            });

        const ingressAnnotations = {};
        ingressAnnotationsValuesContainer.querySelectorAll('input').forEach(input => {
            const key = input.id.replace('annotation-', '');
            ingressAnnotations[key] = input.value.trim();
        });

        const substitutes = Array.from(substitutesValuesContainer.querySelectorAll('input')).map(input => ({
            key: input.id.replace('substitute-', ''),
            value: input.value.trim()
        }));

        const newAppData = {
            name: nameInput.value.trim(),
            namespace: namespaceInput.value.trim(),
            subapp_name: subappNameInput.value.trim() || 'app',
            active: activeInput.checked,
            base: baseInput.value.trim() || undefined,
            prune: pruneInput.checked,
            retryInterval: retryIntervalInput.value.trim() || undefined,
            timeout: timeoutInput.value.trim() || undefined,
            interval: intervalInput.value.trim() || undefined,
            ingress: {
                className: ingressClassNameInput.value.trim() || undefined,
                section_path: ingressSectionPathInput.value.trim() || undefined,
                helmrelease_file: ingressHelmreleaseFile.value.trim() || undefined,
                active: ingressActive.checked,
                annotations: ingressAnnotations
            },
            helm: {
                name: helmNameInput.value.trim() || "",
                healthChecks: helmHealthChecksInput.checked || false
            },
            substitute: substitutes,
            components: components,
            dependsOn: dependsOn,
        };

        // Supprimer les objets vides
        if (Object.values(newAppData.ingress).every(x => x === undefined || (typeof x === 'object' && Object.keys(x).length === 0))) {
            delete newAppData.ingress;
        }


        let url = API_URL_BASE;
        let method = 'POST';

        if (originalName && originalNamespace && originalBase && originalSubappName) {
            const encodedNamespace = encodeURIComponent(originalNamespace);
            const encodedName = encodeURIComponent(originalName);
            const encodedBase = encodeURIComponent(originalBase);
            const encodedSubappName = encodeURIComponent(originalSubappName);
            url = `${API_URL_BASE}/${encodedNamespace}/${encodedName}/${encodedBase}/${encodedSubappName}`;
            method = 'PUT';
        }

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newAppData)
        });

        if (response.ok) {
            form.reset();
            submitBtn.textContent = 'Ajouter';
            cancelBtn.style.display = 'none';
            originalAppNameInput.value = '';
            originalAppNamespaceInput.value = '';
            originalSubappNameInput.value = '';
            fetchApplications();
        } else {
            const errorData = await response.json();
            alert(`Erreur: ${errorData.error || response.statusText}`);
        }
    });

    tableBody.addEventListener('click', async (e) => {
        const target = e.target;
        const name = target.dataset.name;
        const namespace = target.dataset.namespace;
        const base = target.dataset.base;
        const subappName = target.dataset.subappName;

        if (target.classList.contains('delete-btn')) {
            const encodedNamespace = encodeURIComponent(namespace);
            const encodedName = encodeURIComponent(name);
            const encodedBase = encodeURIComponent(base);
            const encodedSubappName = encodeURIComponent(subappName);
            const url = `${API_URL_BASE}/${encodedNamespace}/${encodedName}/${encodedBase}/${encodedSubappName}`;

            if (confirm(`Voulez-vous vraiment supprimer la subapp "${subappName}" de l'application ${name} dans le namespace ${namespace} ?`)) {
                const response = await fetch(url, { method: 'DELETE' });
                if (response.ok) {
                    fetchApplications();
                } else {
                    alert("Erreur lors de la suppression.");
                }
            }
        } else if (target.classList.contains('edit-btn')) {
            window.scrollTo(0, 0);

            const encodedNamespace = encodeURIComponent(namespace);
            const encodedName = encodeURIComponent(name);
            const encodedSubappName = encodeURIComponent(subappName);
            const response = await fetch(`${API_URL_BASE}/${encodedNamespace}/${encodedName}/${encodedSubappName}`);

            if (!response.ok) {
                alert("Erreur lors de la récupération des données de l'application.");
                return;
            }
            const appData = await response.json();

            // Remplir les champs du formulaire de base
            originalAppNameInput.value = appData.name;
            originalAppNamespaceInput.value = appData.namespace;
            originalSubappNameInput.value = appData.subapp_name;
            nameInput.value = appData.name;
            namespaceInput.value = appData.namespace;
            subappNameInput.value = appData.subapp_name;
            activeInput.checked = appData.active;

            // Remplir les métadonnées
            baseInput.value = appData.base || '';
            pruneInput.checked = appData.prune || false;
            retryIntervalInput.value = appData.retryInterval || '';
            timeoutInput.value = appData.timeout || '';
            intervalInput.value = appData.interval || '';

            // Remplir les champs Ingress
            if (appData.ingress) {
                ingressClassNameInput.value = appData.ingress.className || '';
                ingressSectionPathInput.value = appData.ingress.section_path || '';
                ingressHelmreleaseFile.value = appData.ingress.helmrelease_file || '';
                ingressActive.checked = appData.ingress.active || false;

                const annotationsInApp = Object.keys(appData.ingress.annotations || {});
                Array.from(ingressAnnotationsKeysSelect.options).forEach(opt => {
                    opt.selected = annotationsInApp.includes(opt.value);
                });
                updateAnnotationsValueFields(appData.ingress.annotations);
            } else {
                ingressClassNameInput.value = '';
                ingressSectionPathInput.value = '';
                ingressHelmreleaseFile.value = '';
                ingressActive.checked = false;
                Array.from(ingressAnnotationsKeysSelect.options).forEach(opt => opt.selected = false);
                updateAnnotationsValueFields({});
            }

            // Remplir les champs Helm
            if (appData.helm) {
                helmNameInput.value = appData.helm.name || '';
                helmHealthChecksInput.checked = appData.helm.healthChecks || false;
            } else {
                helmNameInput.value = '';
                helmHealthChecksInput.checked = false;
            }

            // Pré-sélection des components
            const componentsInApp = (appData.components || []).map(c => c.path);
            Array.from(componentsSelect.options).forEach(opt => {
                opt.selected = componentsInApp.includes(opt.value);
            });

            // Pré-sélection des dépendances
            const dependsOnInApp = (appData.dependsOn || []).map(dep => `${dep.name}:${dep.namespace}`);
            Array.from(dependsOnSelect.options).forEach(opt => {
                opt.selected = dependsOnInApp.includes(opt.value);
            });

            // Pré-sélection des clés et génération des champs de valeur pour substitutes
            const substituteKeysInApp = (appData.substitute || []).map(s => s.key);
            Array.from(substitutesKeysSelect.options).forEach(opt => {
                opt.selected = substituteKeysInApp.includes(opt.value);
            });
            updateSubstituteValueFields(appData.substitute);

            updateGraph();

            submitBtn.textContent = 'Modifier';
            cancelBtn.style.display = 'inline';
        }
    });

    cancelBtn.addEventListener('click', () => {
        form.reset();
        submitBtn.textContent = 'Ajouter';
        cancelBtn.style.display = 'none';
        originalAppNameInput.value = '';
        originalAppNamespaceInput.value = '';
        originalSubappNameInput.value = '';
        updateAnnotationsValueFields({});
        updateSubstituteValueFields({});
    });

    filterNameInput.addEventListener('input', applyFilters);
    filterNamespaceSelect.addEventListener('change', applyFilters);
    filterBaseSelect.addEventListener('change', applyFilters);
    filterActiveSelect.addEventListener('change', applyFilters);
    filterDependenciesInput.addEventListener('input', applyFilters);
    if (filterSubappInput) filterSubappInput.addEventListener('input', applyFilters);

    fetchApplications();
});
