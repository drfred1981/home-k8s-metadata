document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('annotationForm');
    const tableBody = document.querySelector('#annotationsTable tbody');
    const nomInput = document.getElementById('nom');
    const originalNomInput = document.getElementById('originalNom');
    const submitBtn = document.getElementById('submitBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    const API_URL_BASE = '/apps/api/ingress-annotations';

    const fetchAnnotations = async () => {
        const response = await fetch(API_URL_BASE);
        const data = await response.json();
        renderTable(data);
    };

    const renderTable = (data) => {
        tableBody.innerHTML = '';
        data.forEach(annotation => {
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td>${annotation.nom}</td>
                <td>
                    <button class="btn btn-sm btn-info edit-btn" data-nom="${annotation.nom}">Modifier</button>
                    <button class="btn btn-sm btn-danger delete-btn" data-nom="${annotation.nom}">Supprimer</button>
                </td>
            `;
        });
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nom = nomInput.value.trim();
        const originalNom = originalNomInput.value.trim();
        
        const data = { nom: nom };
        let url = API_URL_BASE;
        let method = 'POST';

        if (originalNom) {
            url = `${API_URL_BASE}/${encodeURIComponent(originalNom)}`;
            method = 'PUT';
        }

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            form.reset();
            submitBtn.textContent = 'Ajouter';
            cancelBtn.style.display = 'none';
            originalNomInput.value = '';
            fetchAnnotations();
        } else {
            const errorData = await response.json();
            alert(`Erreur: ${errorData.error || response.statusText}`);
        }
    });

    tableBody.addEventListener('click', async (e) => {
        const target = e.target;
        const nom = target.dataset.nom;

        if (target.classList.contains('delete-btn')) {
            if (confirm(`Voulez-vous vraiment supprimer l'annotation '${nom}' ?`)) {
                const response = await fetch(`${API_URL_BASE}/${encodeURIComponent(nom)}`, { method: 'DELETE' });
                if (response.ok) {
                    fetchAnnotations();
                } else {
                    alert("Erreur lors de la suppression.");
                }
            }
        } else if (target.classList.contains('edit-btn')) {
            nomInput.value = nom;
            originalNomInput.value = nom;
            submitBtn.textContent = 'Modifier';
            cancelBtn.style.display = 'inline';
            window.scrollTo(0, 0);
        }
    });

    cancelBtn.addEventListener('click', () => {
        form.reset();
        submitBtn.textContent = 'Ajouter';
        cancelBtn.style.display = 'none';
        originalNomInput.value = '';
    });

    fetchAnnotations();
});