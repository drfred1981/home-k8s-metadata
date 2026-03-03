import os
import yaml
import logging
import re

logger = logging.getLogger(__name__)

APPS_ROOT = "kubernetes/apps"


def scan_apps(repo_path):
    """Scan le repo GitOps et extrait les infos de chaque application."""
    apps_dir = os.path.join(repo_path, APPS_ROOT)
    if not os.path.isdir(apps_dir):
        logger.error("Dossier %s introuvable", apps_dir)
        return []

    apps = []
    for ns in sorted(os.listdir(apps_dir)):
        ns_dir = os.path.join(apps_dir, ns)
        if not os.path.isdir(ns_dir):
            continue

        active_apps = _get_active_apps(ns_dir)

        for app_name in sorted(os.listdir(ns_dir)):
            app_dir = os.path.join(ns_dir, app_name)
            if not os.path.isdir(app_dir) or app_name == "kustomization.yaml":
                continue

            app_info = _scan_single_app(app_dir, app_name, ns, app_name in active_apps)
            if app_info:
                apps.append(app_info)

    return apps


def _get_active_apps(ns_dir):
    """Lit le kustomization.yaml du namespace pour lister les apps actives."""
    ks_path = os.path.join(ns_dir, "kustomization.yaml")
    if not os.path.isfile(ks_path):
        return set()

    data = _load_yaml(ks_path)
    if not data:
        return set()

    active = set()
    for res in data.get("resources", []):
        # Format: "./app-name/ks.yaml" ou "app-name/ks.yaml"
        match = re.match(r'\.?/?([^/]+)/ks\.yaml', res)
        if match:
            active.add(match.group(1))
    return active


def _scan_single_app(app_dir, app_name, namespace, is_active):
    """Scan une application et retourne ses infos."""
    app_info = {
        "name": app_name,
        "namespace": namespace,
        "active": is_active,
        "version": None,
        "image": None,
        "display_name": None,
        "group": None,
        "icon": None,
        "description": None,
        "ingress_class": None,
        "url_host": None,
        "components": [],
        "depends_on": [],
        "has_database": False,
        "has_monitoring": None,
        "has_storage": None,
        "subapps": [],
    }

    # Parser les ks.yaml (peut contenir plusieurs documents)
    ks_path = os.path.join(app_dir, "ks.yaml")
    if os.path.isfile(ks_path):
        _parse_ks_yaml(ks_path, app_info)

    # Parser le helmrelease.yaml principal (dans app/)
    hr_path = os.path.join(app_dir, "app", "helmrelease.yaml")
    if os.path.isfile(hr_path):
        _parse_helmrelease(hr_path, app_info)

    return app_info


def _parse_ks_yaml(ks_path, app_info):
    """Parse le ks.yaml FluxCD pour extraire composants et dépendances."""
    docs = _load_yaml_all(ks_path)
    subapps = []

    for doc in docs:
        if not doc or doc.get("kind") != "Kustomization":
            continue

        spec = doc.get("spec", {})
        name = doc.get("metadata", {}).get("name", "")
        subapp_name = name.replace(app_info["name"] + "-", "")

        components_raw = spec.get("components", [])
        components = _extract_components(components_raw)

        depends_on = []
        for dep in spec.get("dependsOn", []):
            depends_on.append({
                "name": dep.get("name", ""),
                "namespace": dep.get("namespace", ""),
            })

        subapp = {
            "name": subapp_name,
            "full_name": name,
            "components": components,
            "depends_on": depends_on,
        }
        subapps.append(subapp)

        # Le premier subapp (app) définit les infos principales
        if subapp_name == "app" or len(subapps) == 1:
            app_info["components"] = components
            app_info["depends_on"] = depends_on
            app_info["has_database"] = any("cnpg" in c for c in components)
            monitoring = [c for c in components if "gatus" in c]
            if monitoring:
                app_info["has_monitoring"] = "external" if "external" in monitoring[0] else "internal"
            storage = [c for c in components if "pvc" in c]
            if storage:
                app_info["has_storage"] = storage[0].split("/")[-1]  # nfs, longhorn, smb

    app_info["subapps"] = subapps


def _extract_components(components_raw):
    """Extrait les noms de composants depuis les paths."""
    result = []
    for comp in components_raw:
        # "../../../../components/gatus/external" → "gatus/external"
        match = re.search(r'components/(.+)$', comp)
        if match:
            result.append(match.group(1))
    return result


def _parse_helmrelease(hr_path, app_info):
    """Parse le helmrelease.yaml pour extraire image, version, ingress."""
    data = _load_yaml(hr_path)
    if not data or data.get("kind") != "HelmRelease":
        return

    values = data.get("spec", {}).get("values", {})

    # Extraire image et version depuis controllers.*.containers.app
    _extract_image(values, app_info)

    # Extraire les infos ingress
    _extract_ingress(values, app_info)


def _extract_image(values, app_info):
    """Trouve l'image du container principal 'app'."""
    controllers = values.get("controllers", {})
    for ctrl_name, ctrl in controllers.items():
        if not isinstance(ctrl, dict):
            continue
        containers = ctrl.get("containers", {})
        app_container = containers.get("app", {})
        if not app_container:
            continue
        image = app_container.get("image", {})
        if isinstance(image, dict) and image.get("repository"):
            app_info["image"] = image["repository"]
            app_info["version"] = str(image.get("tag", ""))
            # Nettoyer le tag s'il contient un sha256
            if "@" in app_info["version"]:
                app_info["version"] = app_info["version"].split("@")[0]
            return


def _extract_ingress(values, app_info):
    """Extrait les infos d'ingress (className, host, annotations homepage)."""
    ingress = values.get("ingress", {})
    app_ingress = ingress.get("app", {})
    if not app_ingress:
        return

    app_info["ingress_class"] = app_ingress.get("className")

    # Host
    hosts = app_ingress.get("hosts", [])
    if hosts and isinstance(hosts[0], dict):
        app_info["url_host"] = hosts[0].get("host", "")

    # Annotations homepage
    annotations = app_ingress.get("annotations", {})
    app_info["display_name"] = annotations.get("gethomepage.dev/name")
    app_info["group"] = annotations.get("gethomepage.dev/group")
    app_info["icon"] = annotations.get("gethomepage.dev/icon")
    app_info["description"] = annotations.get("gethomepage.dev/description")


def _load_yaml(path):
    """Charge un fichier YAML (premier document)."""
    try:
        with open(path, "r") as f:
            return yaml.safe_load(f)
    except Exception as e:
        logger.warning("Erreur lecture YAML %s: %s", path, e)
        return None


def _load_yaml_all(path):
    """Charge tous les documents d'un fichier YAML multi-documents."""
    try:
        with open(path, "r") as f:
            return list(yaml.safe_load_all(f))
    except Exception as e:
        logger.warning("Erreur lecture YAML multi-doc %s: %s", path, e)
        return []
