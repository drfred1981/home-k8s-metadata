import yaml
import os
from config import DATA_PATHS

REPO_PATH = os.environ.get('REPO_PATH')
# Chemin du répertoire racine des applications
ROOT_PATH = REPO_PATH+"/"+DATA_PATHS.get('applications_root')

def _find_file_path(base, name, namespace):
    """
    Trouve le chemin complet du fichier YAML pour une application.
    Le chemin est construit à partir du namespace.
    """
    filename = f"{base}_{namespace}_{name}.yaml"
    return os.path.join(ROOT_PATH, base, namespace, filename)


def load_data():
    """
    Charge les données de toutes les applications depuis tous les fichiers YAML
    dans la structure de répertoires. Chaque subapp est aplatie en une entrée
    distincte dans la liste retournée.
    """
    all_applications = []
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
                            for app_key, app_data in data['apps'].items():
                                parent_name = app_data.get('name', app_key)
                                parent_namespace = app_data.get('namespace', '')
                                parent_base = app_data.get('base', '')
                                parent_active = app_data.get('active')
                                parent_ksSelfManaged = app_data.get('ksSelfManaged')

                                subapps = app_data.get('subapps', {})
                                if not subapps:
                                    continue

                                for subapp_key, subapp_data in subapps.items():
                                    if subapp_data is None:
                                        subapp_data = {}
                                    entry = {
                                        'name': parent_name,
                                        'namespace': parent_namespace,
                                        'base': parent_base,
                                        'subapp_name': subapp_key,
                                        'active': subapp_data.get('active', parent_active),
                                        'prune': subapp_data.get('prune'),
                                        'retryInterval': subapp_data.get('retryInterval'),
                                        'timeout': subapp_data.get('timeout'),
                                        'interval': subapp_data.get('interval'),
                                        'components': subapp_data.get('components', []),
                                        'dependsOn': subapp_data.get('dependsOn', []),
                                        'ingress': subapp_data.get('ingress'),
                                        'helm': subapp_data.get('helm'),
                                        'substitute': subapp_data.get('substitute'),
                                        'helmchecksexprs': subapp_data.get('helmchecksexprs'),
                                        'full_path': filepath,
                                        'ksSelfManaged': parent_ksSelfManaged,
                                        'parent_active': parent_active,
                                    }
                                    all_applications.append(entry)
                except (yaml.YAMLError, FileNotFoundError) as e:
                    print(f"Erreur de lecture du fichier {filepath}: {e}")
                    continue

    # Trie par nom puis par subapp_name
    all_applications.sort(key=lambda app: (app.get('name', '').lower(), app.get('subapp_name', '').lower()))

    return all_applications

def save_data(data):
    """
    Sauvegarde une subapp dans son fichier YAML respectif.
    Préserve les données parent et les autres subapps dans le fichier.
    """
    name = data.get('name')
    namespace = data.get('namespace')
    base = data.get('base')
    subapp_name = data.get('subapp_name', 'app')

    if 'full_path' in data:
        file_path = data['full_path']
    else:
        if not namespace or not name or not base:
            raise ValueError("Le namespace, la base et le nom sont requis pour la sauvegarde.")
        file_path = _find_file_path(base, name, namespace)

    # Charger le fichier existant s'il y en a un
    full_yaml_data = {}
    if os.path.exists(file_path):
        with open(file_path, 'r') as f:
            full_yaml_data = yaml.safe_load(f) or {}

    # S'assurer que la structure existe
    if 'apps' not in full_yaml_data:
        full_yaml_data['apps'] = {}

    # Trouver ou créer l'entrée parent
    app_key = name
    if app_key not in full_yaml_data['apps']:
        full_yaml_data['apps'][app_key] = {}

    parent = full_yaml_data['apps'][app_key]

    # Mettre à jour les champs parent
    parent['name'] = name
    parent['namespace'] = namespace
    parent['base'] = base
    if data.get('parent_active') is not None:
        parent['active'] = data['parent_active']
    elif 'active' in parent:
        pass  # Garder la valeur existante
    if data.get('ksSelfManaged') is not None:
        parent['ksSelfManaged'] = data['ksSelfManaged']

    # S'assurer que subapps existe
    if 'subapps' not in parent:
        parent['subapps'] = {}

    # Construire les données du subapp
    subapp_data = {}

    if data.get('active') is not None:
        subapp_data['active'] = data['active']
    if data.get('prune') is not None:
        subapp_data['prune'] = data['prune']
    if data.get('retryInterval'):
        subapp_data['retryInterval'] = data['retryInterval']
    if data.get('timeout'):
        subapp_data['timeout'] = data['timeout']
    if data.get('interval'):
        subapp_data['interval'] = data['interval']
    if data.get('helm'):
        subapp_data['helm'] = data['helm']
    if data.get('components'):
        subapp_data['components'] = data['components']
    if data.get('dependsOn'):
        subapp_data['dependsOn'] = data['dependsOn']
    if data.get('ingress'):
        ingress = data['ingress']
        # Nettoyer les annotations vides
        if ingress.get('annotations'):
            ingress['annotations'] = {k: v for k, v in ingress['annotations'].items() if v}
            if not ingress['annotations']:
                del ingress['annotations']
        subapp_data['ingress'] = ingress
    if data.get('substitute'):
        subapp_data['substitute'] = data['substitute']
    if data.get('helmchecksexprs'):
        subapp_data['helmchecksexprs'] = data['helmchecksexprs']

    parent['subapps'][subapp_name] = subapp_data

    # Créer le répertoire si nécessaire
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, 'w') as f:
        yaml.dump(full_yaml_data, f, sort_keys=False)

def create_application(new_app_data):
    """
    Crée une nouvelle subapp. L'ID unique est le triplet (name, namespace, subapp_name).
    """
    name = new_app_data.get('name')
    namespace = new_app_data.get('namespace')
    subapp_name = new_app_data.get('subapp_name', 'app')

    if not name or not namespace:
        raise ValueError("Le nom et le namespace sont requis pour la création d'une application.")

    # Vérifier l'unicité
    all_apps = load_data()
    if any(app['name'] == name and app['namespace'] == namespace and app['subapp_name'] == subapp_name for app in all_apps):
        return None  # Subapp existante

    save_data(new_app_data)
    return new_app_data

def update_application(current_base, current_name, current_namespace, current_subapp_name, updated_data):
    """
    Met à jour une subapp existante.
    Si le nom, namespace ou subapp_name change, gère le déplacement.
    """
    # Rechercher la subapp existante
    all_apps = load_data()
    app_to_update = next(
        (app for app in all_apps
         if app['name'] == current_name
         and app['namespace'] == current_namespace
         and app['subapp_name'] == current_subapp_name),
        None
    )

    if not app_to_update:
        return None

    new_name = updated_data.get('name', current_name)
    new_namespace = updated_data.get('namespace', current_namespace)
    new_subapp_name = updated_data.get('subapp_name', current_subapp_name)

    # Vérifier si la destination existe déjà
    if (new_name != current_name or new_namespace != current_namespace or new_subapp_name != current_subapp_name):
        if any(app['name'] == new_name and app['namespace'] == new_namespace and app['subapp_name'] == new_subapp_name for app in all_apps):
            return None  # Conflit

    # Mettre à jour les données
    for key, value in updated_data.items():
        app_to_update[key] = value

    # Sauvegarder
    save_data(app_to_update)

    # Si le nom, namespace ou subapp_name a changé, supprimer l'ancien
    if new_name != current_name or new_namespace != current_namespace or new_subapp_name != current_subapp_name:
        _delete_subapp_from_file(current_base, current_name, current_namespace, current_subapp_name)

    return app_to_update

def _delete_subapp_from_file(base, name, namespace, subapp_name):
    """
    Supprime un subapp spécifique du fichier YAML.
    Si c'était le dernier subapp, supprime le fichier.
    """
    file_path = _find_file_path(base, name, namespace)

    if not os.path.exists(file_path):
        return False

    with open(file_path, 'r') as f:
        full_yaml_data = yaml.safe_load(f) or {}

    if 'apps' not in full_yaml_data or name not in full_yaml_data['apps']:
        return False

    parent = full_yaml_data['apps'][name]
    subapps = parent.get('subapps', {})

    if subapp_name not in subapps:
        return False

    del subapps[subapp_name]

    # Si plus aucun subapp, supprimer l'app entière du fichier
    if not subapps:
        del full_yaml_data['apps'][name]

        # Si le fichier est vide, le supprimer
        if not full_yaml_data.get('apps'):
            os.remove(file_path)
            try:
                os.rmdir(os.path.dirname(file_path))
            except OSError:
                pass
            return True

    # Sinon, sauvegarder le fichier mis à jour
    with open(file_path, 'w') as f:
        yaml.dump(full_yaml_data, f, sort_keys=False)

    return True

def delete_application(base, name, namespace, subapp_name):
    """
    Supprime une subapp par son nom, namespace et subapp_name.
    """
    return _delete_subapp_from_file(base, name, namespace, subapp_name)

def get_application(name, namespace, subapp_name):
    """
    Récupère les données d'une subapp spécifique.
    """
    all_applications = load_data()

    for app in all_applications:
        if (app.get('name') == name
            and app.get('namespace') == namespace
            and app.get('subapp_name') == subapp_name):
            return app

    return None


def get_dependency_tree(app_name, app_namespace, depth):
    """
    Construit l'arbre de dépendances pour une subapp donnée.
    L'identité de chaque subapp est <name>-<subapp_name>:<namespace>.
    """
    all_apps = load_data()
    # Construire le dictionnaire avec clé = <name>-<subapp_name>:<namespace>
    apps_dict = {}
    for app in all_apps:
        key = f"{app.get('name')}-{app.get('subapp_name')}:{app.get('namespace')}"
        apps_dict[key] = app

    nodes = []
    links = []
    processed_ids = set()

    # Le app_name reçu est déjà au format <name>-<subapp_name>
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
                'name': f"{current_app.get('name')}-{current_app.get('subapp_name')}",
                'namespace': current_app.get('namespace'),
                'level': current_depth,
                'type': node_type
            })

            if current_depth < depth:
                for dep in current_app.get('dependsOn', []):
                    dep_id = f"{dep.get('name')}:{dep.get('namespace')}"
                    links.append({
                        'source': dep_id,
                        'target': current_id,
                        'type': 'dependency'
                    })
                    queue.append((dep_id, current_depth + 1, 'dependency'))
        else:
            # Noeud non trouvé dans les métadonnées (référence externe)
            parts = current_id.split(':')
            node_name = parts[0] if parts else current_id
            node_ns = parts[1] if len(parts) > 1 else ''
            nodes.append({
                'id': current_id,
                'name': node_name,
                'namespace': node_ns,
                'level': current_depth,
                'type': node_type
            })

    return {'nodes': nodes, 'links': links}


def get_all_dependencies_graph_data():
    """
    Construit un graphe de toutes les dépendances entre toutes les subapps.
    """
    all_apps = load_data()
    # Construire le dictionnaire avec clé = <name>-<subapp_name>:<namespace>
    apps_dict = {}
    for app in all_apps:
        key = f"{app.get('name')}-{app.get('subapp_name')}:{app.get('namespace')}"
        apps_dict[key] = app

    nodes = []
    links = []
    added_node_ids = set()

    for app_id, app in apps_dict.items():
        if app_id not in added_node_ids:
            nodes.append({
                'id': app_id,
                'name': f"{app.get('name')}-{app.get('subapp_name')}",
                'namespace': app.get('namespace'),
                'type': 'application'
            })
            added_node_ids.add(app_id)

        for dep in app.get('dependsOn', []):
            dep_id = f"{dep.get('name')}:{dep.get('namespace')}"

            if dep_id not in added_node_ids:
                nodes.append({
                    'id': dep_id,
                    'name': dep.get('name'),
                    'namespace': dep.get('namespace'),
                    'type': 'dependency'
                })
                added_node_ids.add(dep_id)

            links.append({
                'source': dep_id,
                'target': app_id,
                'type': 'dependency'
            })

    return {'nodes': nodes, 'links': links}
