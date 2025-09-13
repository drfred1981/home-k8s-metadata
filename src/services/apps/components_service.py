import yaml
import os
from .config import DATA_PATHS

# Chemin du fichier YAML pour les components
YAML_FILE_PATH = DATA_PATHS.get('components')
ENTITY_KEY = 'components' # Clé dans la hiérarchie YAML

def load_data():
    """Charge les données des components depuis le fichier YAML. Retourne une liste."""
    if not os.path.exists(YAML_FILE_PATH):
        return []
    with open(YAML_FILE_PATH, 'r') as file:
        full_data = yaml.safe_load(file) or {}
        # La structure sera : metadatas -> apps -> components
        return full_data.get('metadatas', {}).get('apps', {}).get(ENTITY_KEY, [])

def save_data(data):
    """
    Sauvegarde la liste des components dans le fichier YAML.
    La liste est stockée sous la hiérarchie metadatas -> apps -> components.
    """
    # Charger la structure existante
    full_data = {}
    if os.path.exists(YAML_FILE_PATH):
        with open(YAML_FILE_PATH, 'r') as file:
            full_data = yaml.safe_load(file) or {}

    # S'assurer que la structure hiérarchique existe
    if 'metadatas' not in full_data:
        full_data['metadatas'] = {}
    if 'apps' not in full_data['metadatas']:
        full_data['metadatas']['apps'] = {}
    
    # Mettre à jour la liste des components
    full_data['metadatas']['apps'][ENTITY_KEY] = data
    
    os.makedirs(os.path.dirname(YAML_FILE_PATH), exist_ok=True)
    with open(YAML_FILE_PATH, 'w') as file:
        yaml.dump(full_data, file, sort_keys=False)

def create_component(new_component):
    """Crée un nouveau component. Le 'nom' est l'ID unique."""
    data = load_data()
    
    # Vérifier l'unicité du nom
    new_name = new_component.get('nom', '').strip()
    if not new_name:
        raise ValueError("Le nom du component ne peut pas être vide.")

    # Convertir tous les noms existants en minuscules pour une vérification sensible à la casse
    existing_names = {c.get('nom', '').lower() for c in data}
    if new_name.lower() in existing_names:
        # On pourrait lever une exception ou retourner None pour indiquer l'échec
        return None # Échec de la création (nom déjà existant)
        
    # Ajouter l'entité
    data.append({'nom': new_name})
    save_data(data)
    return {'nom': new_name} # Retourner l'entité créée

def update_component(current_name, updated_data):
    """
    Met à jour un component existant par son nom (current_name).
    Note: Comme le nom est l'ID, si 'nom' est dans updated_data,
    cela signifie un changement d'ID, ce qui est géré ici.
    """
    data = load_data()
    updated_name = updated_data.get('nom', current_name).strip()
    
    # S'assurer que le nouveau nom n'existe pas déjà, sauf si c'est l'ancien nom
    if updated_name.lower() != current_name.lower():
        existing_names = {c.get('nom', '').lower() for c in data if c.get('nom', '').lower() != current_name.lower()}
        if updated_name.lower() in existing_names:
            return None # Échec de la mise à jour (nouveau nom déjà existant)
    
    for i, component in enumerate(data):
        if component.get('nom') == current_name:
            # Mettre à jour (dans ce cas, juste le nom)
            data[i]['nom'] = updated_name
            save_data(data)
            return data[i]
            
    return None

def delete_component(name):
    """Supprime un component par son nom."""
    data = load_data()
    original_size = len(data)
    # Filtrer les entités, en utilisant le nom comme ID
    data = [c for c in data if c.get('nom') != name]
    
    if len(data) < original_size:
        save_data(data)
        return True
    return False