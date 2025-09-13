import yaml
from .config import DATA_PATHS
import os

ANNOTATIONS_PATH = DATA_PATHS.get('ingress_annotations')

def load_data():
    """
    Charge les données de l'entité 'ingressAnnotations' depuis le fichier YAML.
    """
    if not os.path.exists(ANNOTATIONS_PATH):
        return []
    try:
        with open(ANNOTATIONS_PATH, 'r') as f:
            data = yaml.safe_load(f)
            if data and 'metadatas' in data and 'apps' in data['metadatas'] and 'ingress_annotations' in data['metadatas']['apps']:
                return data['metadatas']['apps']['ingress_annotations']
    except (yaml.YAMLError, FileNotFoundError) as e:
        print(f"Erreur de lecture du fichier des annotations d'ingress : {e}")
        return []
    return []

def save_data(new_annotations):
    """
    Sauvegarde la liste complète des 'ingressAnnotations' dans le fichier YAML.
    """
    full_yaml_data = {}
    if os.path.exists(ANNOTATIONS_PATH):
        with open(ANNOTATIONS_PATH, 'r') as f:
            full_yaml_data = yaml.safe_load(f) or {}

    if 'metadatas' not in full_yaml_data:
        full_yaml_data['metadatas'] = {}
    if 'apps' not in full_yaml_data['metadatas']:
        full_yaml_data['metadatas']['apps'] = {}
        
    full_yaml_data['metadatas']['apps']['ingress_annotations'] = new_annotations
    
    with open(ANNOTATIONS_PATH, 'w') as f:
        yaml.dump(full_yaml_data, f, sort_keys=False)

def create_annotation(nom):
    """
    Ajoute une nouvelle annotation si elle n'existe pas déjà.
    """
    data = load_data()
    if any(a['nom'] == nom for a in data):
        return None  # L'annotation existe déjà

    data.append({'nom': nom})
    save_data(data)
    return {'nom': nom}

def update_annotation(old_nom, new_nom):
    """
    Met à jour le nom d'une annotation existante.
    """
    data = load_data()
    for a in data:
        if a['nom'] == old_nom:
            a['nom'] = new_nom
            save_data(data)
            return a
    return None

def delete_annotation(nom):
    """
    Supprime une annotation par son nom.
    """
    data = load_data()
    initial_len = len(data)
    data = [a for a in data if a['nom'] != nom]
    
    if len(data) < initial_len:
        save_data(data)
        return True
    return False