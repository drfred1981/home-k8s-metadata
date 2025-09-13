import yaml
from config import DATA_PATHS
import os

REPO_PATH = os.environ.get('REPO_PATH')
# Chemin du répertoire racine des applications
SUBSTITUTES_PATH = REPO_PATH+"/"+DATA_PATHS.get('substitutes')

def load_data():
    """
    Charge les données de l'entité 'substitute' depuis le fichier YAML.
    """
    if not os.path.exists(SUBSTITUTES_PATH):
        return []
    try:
        with open(SUBSTITUTES_PATH, 'r') as f:
            data = yaml.safe_load(f)
            if data and 'metadatas' in data and 'apps' in data['metadatas'] and 'substitutes' in data['metadatas']['apps']:
                return data['metadatas']['apps']['substitutes']
    except (yaml.YAMLError, FileNotFoundError) as e:
        print(f"Erreur de lecture du fichier des substitutes : {e}")
        return []
    return []

def save_data(new_substitutes):
    """
    Sauvegarde la liste complète des 'substitutes' dans le fichier YAML.
    """
    full_yaml_data = {}
    if os.path.exists(SUBSTITUTES_PATH):
        with open(SUBSTITUTES_PATH, 'r') as f:
            full_yaml_data = yaml.safe_load(f) or {}

    # Assurez-vous que la hiérarchie existe
    if 'metadatas' not in full_yaml_data:
        full_yaml_data['metadatas'] = {}
    if 'apps' not in full_yaml_data['metadatas']:
        full_yaml_data['metadatas']['apps'] = {}
        
    full_yaml_data['metadatas']['apps']['substitutes'] = new_substitutes
    
    with open(SUBSTITUTES_PATH, 'w') as f:
        yaml.dump(full_yaml_data, f, sort_keys=False)

def create_substitute(nom):
    """
    Ajoute un nouveau 'substitute' s'il n'existe pas déjà.
    """
    data = load_data()
    if any(s['nom'] == nom for s in data):
        return None  # Le substitute existe déjà

    data.append({'nom': nom})
    save_data(data)
    return {'nom': nom}

def update_substitute(old_nom, new_nom):
    """
    Met à jour le nom d'un 'substitute' existant.
    """
    data = load_data()
    for s in data:
        if s['nom'] == old_nom:
            s['nom'] = new_nom
            save_data(data)
            return s
    return None

def delete_substitute(nom):
    """
    Supprime un 'substitute' par son nom.
    """
    data = load_data()
    initial_len = len(data)
    data = [s for s in data if s['nom'] != nom]
    
    if len(data) < initial_len:
        save_data(data)
        return True
    return False