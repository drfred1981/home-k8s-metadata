// static/js/apps/global_dependency_graph.js

document.addEventListener('DOMContentLoaded', () => {
    const graphContainer = document.getElementById('globalDependencyGraphContainer');
    const svg = d3.select("#globalDependencyGraph");
    const layoutSelect = document.getElementById('layoutMode');
    const namespaceSelect = document.getElementById('namespaceFilter');

    const API_URL_GLOBAL_GRAPH = '/apps/api/applications/global-graph-data';
    let graphDataCache = null;

    const fetchGlobalGraphData = async () => {
        try {
            const response = await fetch(API_URL_GLOBAL_GRAPH);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            graphDataCache = await response.json();
            
            populateNamespaceFilter(graphDataCache.nodes);
            drawGraph();
        } catch (error) {
            console.error("Erreur lors du chargement des données du graphe global:", error);
            alert("Impossible de charger le graphe des dépendances globales.");
        }
    };

    const populateNamespaceFilter = (nodes) => {
        const namespaces = new Set();
        nodes.forEach(node => {
            if (node.namespace) {
                namespaces.add(node.namespace);
            }
        });

        const sortedNamespaces = Array.from(namespaces).sort();
        sortedNamespaces.forEach(ns => {
            const option = document.createElement('option');
            option.value = ns;
            option.textContent = ns;
            namespaceSelect.appendChild(option);
        });
    };

    layoutSelect.addEventListener('change', () => {
        if (graphDataCache) {
            drawGraph();
        }
    });

    // 🎯 L'événement est toujours 'change', mais la logique de récupération des valeurs est différente
    namespaceSelect.addEventListener('change', () => {
        if (graphDataCache) {
            drawGraph();
        }
    });

    const drawGraph = () => {
        if (!graphDataCache) return;
        const layoutMode = layoutSelect.value;
        
        // 🎯 Récupérer toutes les valeurs sélectionnées
        const selectedNamespaces = Array.from(namespaceSelect.options)
            .filter(option => option.selected)
            .map(option => option.value);

        const filteredData = filterDataByNamespace(graphDataCache, selectedNamespaces);

        const width = graphContainer.clientWidth;
        const height = graphContainer.clientHeight;
        
        svg.attr("width", width).attr("height", height);
        svg.selectAll("*").remove();

        const g = svg.append("g");
        
        svg.append("defs").append("marker")
            .attr("id", "arrowhead")
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 10)
            .attr("refY", 0)
            .attr("orient", "auto")
            .attr("markerWidth", 8)
            .attr("markerHeight", 8)
            .append("path").attr("d", "M 0,-5 L 10,0 L 0,5")
            .attr("fill", "#999");
        
        const zoom = d3.zoom()
            .scaleExtent([0.1, 2])
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
            });
        
        svg.call(zoom);

        if (layoutMode === 'normal') {
            drawForceLayout(filteredData, g, width, height);
        } else {
            drawTreeLayout(filteredData, g, width, height, layoutMode);
        }
    };

    // 🎯 La fonction accepte maintenant un tableau de namespaces
    const filterDataByNamespace = (data, selectedNamespaces) => {
        // Gérer le cas où "all" est sélectionné ou aucune sélection
        if (selectedNamespaces.includes('all') || selectedNamespaces.length === 0) {
            return data;
        }
        
        const filteredNodes = data.nodes.filter(node => 
            selectedNamespaces.includes(node.namespace)
        );
        
        const filteredNodeIds = new Set(filteredNodes.map(node => node.id));

        const filteredLinks = data.links.filter(link => 
            filteredNodeIds.has(link.source) && filteredNodeIds.has(link.target)
        );

        return { nodes: filteredNodes, links: filteredLinks };
    };

    const drawForceLayout = (graphData, g, width, height) => {
        const link = g.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(graphData.links)
            .enter().append("line")
            .attr("stroke-width", 2)
            .attr("stroke", "#999")
            .attr("marker-end", "url(#arrowhead)");

        const node = g.append("g")
            .attr("class", "nodes")
            .selectAll("circle")
            .data(graphData.nodes)
            .enter().append("circle")
            .attr("r", 5)
            .attr("fill", "steelblue")
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));

        node.append("title").text(d => d.name);

        const text = g.append("g")
            .attr("class", "labels")
            .selectAll("text")
            .data(graphData.nodes)
            .enter().append("text")
            .text(d => d.name)
            .style("font-size", "10px")
            .attr("x", 12)
            .attr("y", 3);

        const simulation = d3.forceSimulation(graphData.nodes)
            .force("link", d3.forceLink(graphData.links).id(d => d.id).distance(50))
            .force("charge", d3.forceManyBody().strength(-150))
            .force("center", d3.forceCenter(width / 2, height / 2));

        simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);
            
            node.attr("cx", d => d.x).attr("cy", d => d.y);
            text.attr("x", d => d.x + 12).attr("y", d => d.y + 3);
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

    const drawTreeLayout = (graphData, g, width, height, layoutMode) => {
        const nodesMap = new Map(graphData.nodes.map(d => [d.id, d]));
        const childrenMap = new Map();
        const linkChildren = new Set(graphData.links.map(l => l.target));
        
        graphData.links.forEach(link => {
            if (!childrenMap.has(link.source)) {
                childrenMap.set(link.source, []);
            }
            childrenMap.get(link.source).push(nodesMap.get(link.target));
        });

        graphData.nodes.forEach(node => {
            node.children = childrenMap.get(node.id) || [];
            node.isRoot = !linkChildren.has(node.id);
        });

        const rootNode = {
            id: "virtual-root",
            name: "Applications",
            children: graphData.nodes.filter(d => d.isRoot)
        };
        const root = d3.hierarchy(rootNode, d => d.children);

        const nodeCount = root.descendants().length;
        const nodeSeparation = 100;

        let dynamicWidth = Math.max(width, nodeCount * nodeSeparation);
        let dynamicHeight = Math.max(height, root.height * nodeSeparation);

        let treeLayout, linkPath, nodeTranslate;
        
        if (layoutMode === 'top-down') {
            treeLayout = d3.tree().size([dynamicWidth, dynamicHeight]);
            linkPath = d3.linkVertical().x(d => d.x).y(d => d.y);
            nodeTranslate = d => `translate(${d.x},${d.y})`;
        } else { // left-right
            treeLayout = d3.tree().size([dynamicHeight, dynamicWidth]);
            linkPath = d3.linkHorizontal().x(d => d.y).y(d => d.x);
            nodeTranslate = d => `translate(${d.y},${d.x})`;
        }
        
        treeLayout(root);
        svg.attr("width", dynamicWidth).attr("height", dynamicHeight);
        
        const links = g.selectAll(".link")
            .data(root.links().filter(d => d.source.data.id !== "virtual-root"))
            .enter().append("path")
            .attr("class", "link")
            .attr("d", linkPath)
            .style("fill", "none")
            .style("stroke", "#ccc")
            .style("stroke-width", "2px")
            .attr("marker-end", "url(#arrowhead)");

        const nodes = g.selectAll(".node")
            .data(root.descendants().filter(d => d.data.id !== "virtual-root"))
            .enter().append("g")
            .attr("class", "node")
            .attr("transform", nodeTranslate);

        nodes.append("circle")
            .attr("r", 5)
            .style("fill", "#555")
            .style("stroke", "#fff");

        nodes.append("text")
            .attr("dy", "0.31em")
            .attr("x", d => {
                if (layoutMode === 'top-down') {
                    return d.children ? -8 : 8;
                } else {
                    return d.children ? 8 : 8;
                }
            })
            .attr("text-anchor", d => {
                if (layoutMode === 'top-down') {
                    return d.children ? "end" : "start";
                } else {
                    return "start";
                }
            })
            .style("font-size", "10px")
            .text(d => d.data.name);

        svg.call(d3.zoom().transform, d3.zoomIdentity);
        svg.call(d3.zoom().on("zoom", (event) => g.attr("transform", event.transform)));
    };

    fetchGlobalGraphData();
});