document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('componentForm');
    const tableBody = document.querySelector('#componentsTable tbody');
    const submitBtn = document.getElementById('submitBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    // Référence à l'ancien nom/ID pour les opérations de modification
    const originalComponentNameInput = document.getElementById('originalComponentName'); 
    const nomInput = document.getElementById('nom');

    const API_URL_BASE = '/apps/api/components'; // URL de base de l'API

    const fetchComponents = async () => {
        const response = await fetch(API_URL_BASE);
        const data = await response.json();
        renderTable(data);
    };

    const renderTable = (data) => {
        tableBody.innerHTML = '';
        data.forEach(component => {
            const row = tableBody.insertRow();
            // Utiliser le nom comme data-id
            row.dataset.id = component.nom; 
            row.innerHTML = `
                <td>${component.nom}</td>
                <td>
                    <button class="btn btn-sm btn-info edit-btn" data-id="${component.nom}">Modifier</button>
                    <button class="btn btn-sm btn-danger delete-btn" data-id="${component.nom}">Supprimer</button>
                </td>
            `;
        });
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        // L'ancien nom est l'ID actuel si nous sommes en modification
        const originalName = originalComponentNameInput.value;
        const nom = nomInput.value.trim(); // Le nouveau nom/valeur du component
        const newComponentData = { nom };

        if (!nom) {
            alert("Le nom du component est obligatoire.");
            return;
        }

        let url = API_URL_BASE;
        let method = 'POST';

        if (originalName) {
            // Modification (PUT)
            url = `${API_URL_BASE}/${encodeURIComponent(originalName)}`;
            method = 'PUT';
        }

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newComponentData)
        });
        
        if (response.ok) {
            form.reset();
            submitBtn.textContent = 'Ajouter';
            cancelBtn.style.display = 'none';
            originalComponentNameInput.value = ''; // Réinitialiser l'ID/Nom original
            fetchComponents();
        } else {
            const errorData = await response.json();
            alert(`Erreur: ${errorData.error || response.statusText}`);
        }
    });

    tableBody.addEventListener('click', async (e) => {
        const id = e.target.dataset.id; // C'est le nom du component

        if (e.target.classList.contains('delete-btn')) {
            // Suppression (DELETE)
            const response = await fetch(`${API_URL_BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
            if (response.ok) {
                fetchComponents();
            } else {
                alert("Erreur lors de la suppression.");
            }
        } else if (e.target.classList.contains('edit-btn')) {
            // Remplissage du formulaire pour la modification
            const row = e.target.closest('tr');
            const currentName = row.cells[0].textContent.trim(); // Le nom actuel

            originalComponentNameInput.value = currentName; // Sauvegarder le nom actuel comme ID
            nomInput.value = currentName; // Pré-remplir le champ de saisie
            
            submitBtn.textContent = 'Modifier';
            cancelBtn.style.display = 'inline';
        }
    });

    cancelBtn.addEventListener('click', () => {
        form.reset();
        submitBtn.textContent = 'Ajouter';
        cancelBtn.style.display = 'none';
        originalComponentNameInput.value = '';
    });

    fetchComponents(); // Charger les données au démarrage
});