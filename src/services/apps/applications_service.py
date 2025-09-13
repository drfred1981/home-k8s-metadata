import yaml
import os
from .config import DATA_PATHS

# Chemin du répertoire racine des applications
ROOT_PATH = DATA_PATHS.get('applications_root')

def _find_file_path(name, namespace):
    """
    Trouve le chemin complet du fichier YAML pour une application.
    Le chemin est construit à partir du namespace.
    """
    filename = f"apps_{namespace}_{name}.yaml"
    return os.path.join(ROOT_PATH, namespace, filename)


def load_data():
    """
    Charge les données de toutes les applications depuis tous les fichiers YAML
    dans la structure de répertoires et les trie par nom.
    """
    all_applications = []
    # ... (le code existant pour charger et trier les données)
    if not os.path.exists(ROOT_PATH):
        return []

    for root, dirs, files in os.walk(ROOT_PATH):
        for file in files:
            if file.endswith('.yaml'):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r') as f:
                        data = yaml.safe_load(f)
                        if data and 'apps' in data:
                            for app_name, app_data in data['apps'].items():
                                app_data['full_path'] = filepath
                                all_applications.append(app_data)
                except (yaml.YAMLError, FileNotFoundError) as e:
                    print(f"Erreur de lecture du fichier {filepath}: {e}")
                    continue
    
    # Trie la liste des applications par le nom (ordre alphabétique)
    all_applications.sort(key=lambda app: app.get('name', '').lower())
    
    return all_applications

def save_data(data):
    """
    Sauvegarde une application dans son fichier YAML respectif.
    Préserve les données existantes dans le fichier.
    """
    # On reconstruit la hiérarchie du fichier pour ne pas écraser d'autres applications
    # qui pourraient être dans le même fichier, ou d'autres clés dans le fichier.
    
    # On s'assure que le chemin du fichier est fourni
    if 'full_path' not in data:
        # Cas de création
        namespace = data.get('namespace')
        name = data.get('name')
        if not namespace or not name:
            raise ValueError("Le namespace et le nom sont requis pour la sauvegarde.")
        file_path = _find_file_path(name, namespace)
    else:
        file_path = data['full_path']
        del data['full_path'] # Nettoyer la clé temporaire

      # Charger le fichier existant s'il y en a un
    full_yaml_data = {}
    if os.path.exists(file_path):
        with open(file_path, 'r') as f:
            full_yaml_data = yaml.safe_load(f) or {}

    # S'assurer que la clé 'apps' existe
    if 'apps' not in full_yaml_data:
        full_yaml_data['apps'] = {}

    # Mettre à jour l'application spécifique
    app_data_to_save = {
        'active': data.get('active', False),
        'name': data.get('name'),
        'namespace': data.get('namespace'),
        'base': data.get('base'),
        'prune': data.get('prune', False),
        'retryInterval': data.get('retryInterval'),
        'timeout': data.get('timeout'),
        'interval': data.get('interval'),
        'components': data.get('components', []),
        'dependsOn': data.get('dependsOn', []),
        'ingress': data.get('ingress'),
        'helm': data.get('helm'),
        'substitute': data.get('substitute') # AJOUT DU CHAMP SUBSTITUTE
    }
    # S'assurer que les valeurs d'ingress sont structurées correctement
    if app_data_to_save.get('ingress') and app_data_to_save['ingress'].get('annotations'):
        ingress_annotations = app_data_to_save['ingress']['annotations']
        # Supprimer les annotations avec des valeurs vides
        app_data_to_save['ingress']['annotations'] = {k: v for k, v in ingress_annotations.items() if v}
        # Si le dictionnaire d'annotations est vide, le supprimer
        if not app_data_to_save['ingress']['annotations']:
            del app_data_to_save['ingress']['annotations']
    # Supprimer les clés avec des valeurs 'None' pour un YAML plus propre
    app_data_to_save = {k: v for k, v in app_data_to_save.items() if v is not None}
    
    full_yaml_data['apps'][data['name']] = app_data_to_save

    # Créer le répertoire si nécessaire
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, 'w') as f:
        yaml.dump(full_yaml_data, f, sort_keys=False)

def create_application(new_app_data):
    """
    Crée une nouvelle application. L'ID est le couple (name, namespace).
    """
    name = new_app_data.get('name')
    namespace = new_app_data.get('namespace')
    
    if not name or not namespace:
        raise ValueError("Le nom et le namespace sont requis pour la création d'une application.")

    # Vérifier l'unicité
    all_apps = load_data()
    if any(app['name'] == name and app['namespace'] == namespace for app in all_apps):
        return None # Application existante

    # Ajouter le champ 'base'
    new_app_data['base'] = 'apps'
    
    save_data(new_app_data)
    return new_app_data

def update_application(current_name, current_namespace, updated_data):
    """
    Met à jour une application existante.
    Si le nom ou le namespace est modifié, le fichier sera déplacé.
    """
    # Rechercher l'application existante
    all_apps = load_data()
    app_to_update = next((app for app in all_apps if app['name'] == current_name and app['namespace'] == current_namespace), None)
    
    if not app_to_update:
        return None

    # Gérer un éventuel changement de nom ou de namespace
    new_name = updated_data.get('name', current_name)
    new_namespace = updated_data.get('namespace', current_namespace)

    # Vérifier si l'entité de destination existe déjà
    if (new_name != current_name or new_namespace != current_namespace) and \
       any(app['name'] == new_name and app['namespace'] == new_namespace for app in all_apps):
        return None # Conflit d'identifiant

    # Gérer la mise à jour des données
    for key, value in updated_data.items():
        app_to_update[key] = value

    # Sauvegarder les données
    save_data(app_to_update)

    # Si le nom ou le namespace a changé, il faut supprimer l'ancien fichier
    if new_name != current_name or new_namespace != current_namespace:
        old_file_path = _find_file_path(current_name, current_namespace)
        if os.path.exists(old_file_path):
            os.remove(old_file_path)
            # On peut aussi tenter de supprimer le répertoire si il est vide
            try:
                os.rmdir(os.path.dirname(old_file_path))
            except OSError:
                pass # Le répertoire n'était pas vide, on ne le supprime pas

    return app_to_update

def delete_application(name, namespace):
    """
    Supprime une application par son nom et son namespace.
    """
    file_path = _find_file_path(name, namespace)

    if not os.path.exists(file_path):
        return False

    with open(file_path, 'r') as f:
        full_yaml_data = yaml.safe_load(f) or {}

    if 'apps' in full_yaml_data and name in full_yaml_data['apps']:
        del full_yaml_data['apps'][name]

        with open(file_path, 'w') as f:
            yaml.dump(full_yaml_data, f, sort_keys=False)

        # Si le fichier est vide, on le supprime
        if not full_yaml_data.get('apps'):
            os.remove(file_path)
            try:
                os.rmdir(os.path.dirname(file_path))
            except OSError:
                pass

        return True
    return 

def get_application(name, namespace):
    """
    Récupère les données complètes d'une seule application en chargeant l'ensemble
    des applications et en filtrant par nom et namespace.
    """
    # Charge toutes les applications
    all_applications = load_data()
    
    # Recherche et retourne la première application qui correspond au nom et au namespace
    for app in all_applications:
        if app.get('name') == name and app.get('namespace') == namespace:
            return app
            
    return None


def get_dependency_tree(app_name, app_namespace, depth):
    all_apps = load_data()
    apps_dict = {f"{app.get('name')}:{app.get('namespace')}": app for app in all_apps}
    
    nodes = []
    links = []
    processed_ids = set()
    
    # Utilisez une file d'attente pour la recherche en largeur (BFS)
    # Le type est initialisé pour le nœud source
    queue = [(f"{app_name}:{app_namespace}", 0, 'source')]

    while queue:
        current_id, current_depth, node_type = queue.pop(0)

        if current_id in processed_ids or current_depth > depth:
            continue
        
        processed_ids.add(current_id)
        current_app = apps_dict.get(current_id)

        if current_app:
            nodes.append({
                'id': current_id,
                'name': current_app.get('name'),
                'namespace': current_app.get('namespace'),
                'level': current_depth,
                'type': node_type
            })
            
            # Rechercher les dépendances (celles dont l'app dépend)
            if current_depth < depth:
                for dep in current_app.get('dependsOn', []):
                    dep_id = f"{dep.get('name')}:{dep.get('namespace')}"
                    links.append({
                        'source': dep_id, 
                        'target': current_id, 
                        'type': 'dependency'
                    })
                    queue.append((dep_id, current_depth + 1, 'dependency'))

    # ✅ La boucle qui recherchait les dépendants a été retirée.
    
    return {'nodes': nodes, 'links': links}


def get_all_dependencies_graph_data():
    """
    Construit un graphe de toutes les dépendances entre toutes les applications.
    """
    all_apps = load_data()
    apps_dict = {f"{app.get('name')}:{app.get('namespace')}": app for app in all_apps}
    
    nodes = []
    links = []
    
    # Garder une trace des IDs de nœuds ajoutés pour éviter les doublons
    added_node_ids = set()

    # Parcourir toutes les applications pour construire les nœuds et les liens
    for app_id, app in apps_dict.items():
        if app_id not in added_node_ids:
            nodes.append({
                'id': app_id,
                'name': app.get('name'),
                'namespace': app.get('namespace'),
                'type': 'application' # Un type général pour tous les nœuds ici
            })
            added_node_ids.add(app_id)

        for dep in app.get('dependsOn', []):
            dep_id = f"{dep.get('name')}:{dep.get('namespace')}"
            
            # Si la dépendance n'est pas encore un nœud, l'ajouter
            if dep_id not in added_node_ids:
                nodes.append({
                    'id': dep_id,
                    'name': dep.get('name'),
                    'namespace': dep.get('namespace'),
                    'type': 'dependency' # Peut être différent si vous voulez un style distinct
                })
                added_node_ids.add(dep_id)
            
            # Ajout du lien. Le sens va de la dépendance vers l'application qui en dépend.
            links.append({
                'source': dep_id, 
                'target': app_id, 
                'type': 'dependency' # Type de lien
            })
    
    return {'nodes': nodes, 'links': links}