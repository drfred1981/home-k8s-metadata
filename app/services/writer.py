import os
import logging
from ruamel.yaml import YAML

logger = logging.getLogger(__name__)

APPS_ROOT = "kubernetes/apps"


def update_ks_yaml(repo_path, namespace, app_name, subapp_full_name, changes):
    """Met à jour les champs d'un document Kustomization dans ks.yaml.

    changes peut contenir :
      - substitute: {key: value, ...} (fusionné dans l'existant)
      - interval, retryInterval, timeout: str
      - wait, prune: bool
    """
    ks_path = os.path.join(repo_path, APPS_ROOT, namespace, app_name, "ks.yaml")
    if not os.path.isfile(ks_path):
        raise FileNotFoundError(f"ks.yaml introuvable: {ks_path}")

    ryaml = YAML()
    ryaml.preserve_quotes = True

    with open(ks_path, "r") as f:
        docs = list(ryaml.load_all(f))

    found = False
    for doc in docs:
        if not doc or doc.get("kind") != "Kustomization":
            continue
        if doc["metadata"]["name"] != subapp_full_name:
            continue

        found = True
        spec = doc["spec"]

        # Champs simples
        for field in ("interval", "retryInterval", "timeout"):
            if field in changes:
                spec[field] = changes[field]

        for field in ("wait", "prune"):
            if field in changes:
                val = changes[field]
                if isinstance(val, str):
                    val = val.lower() == "true"
                spec[field] = val

        # Merge substitutes
        if "substitute" in changes and changes["substitute"]:
            if "postBuild" not in spec:
                spec["postBuild"] = {}
            if "substitute" not in spec["postBuild"]:
                spec["postBuild"]["substitute"] = {}
            for k, v in changes["substitute"].items():
                spec["postBuild"]["substitute"][k] = v

        # Replace dependsOn
        if "dependsOn" in changes:
            from ruamel.yaml.comments import CommentedMap, CommentedSeq
            new_deps = CommentedSeq()
            for dep in changes["dependsOn"]:
                d = CommentedMap()
                d["name"] = dep["name"]
                d["namespace"] = dep["namespace"]
                new_deps.append(d)
            if new_deps:
                spec["dependsOn"] = new_deps
            elif "dependsOn" in spec:
                del spec["dependsOn"]

        break

    if not found:
        raise ValueError(f"Kustomization '{subapp_full_name}' non trouvé dans {ks_path}")

    with open(ks_path, "w") as f:
        ryaml.dump_all(docs, f)

    logger.info("ks.yaml mis à jour: %s/%s subapp=%s", namespace, app_name, subapp_full_name)


def update_helmrelease_annotations(repo_path, namespace, app_name, subapp_path, ingress_name, annotations):
    """Met à jour les annotations ingress dans un helmrelease.yaml.

    annotations: dict complet des annotations (remplace l'existant).
    subapp_path: le spec.path du ks.yaml (ex: ./kubernetes/apps/services-it/karakeep/app)
    """
    if subapp_path.startswith("./"):
        subapp_path = subapp_path[2:]
    hr_path = os.path.join(repo_path, subapp_path, "helmrelease.yaml")
    if not os.path.isfile(hr_path):
        raise FileNotFoundError(f"helmrelease.yaml introuvable: {hr_path}")

    ryaml = YAML()
    ryaml.preserve_quotes = True

    with open(hr_path, "r") as f:
        data = ryaml.load(f)

    if not data or data.get("kind") != "HelmRelease":
        raise ValueError(f"Fichier invalide: {hr_path}")

    values = data.get("spec", {}).get("values", {})
    ingress = values.get("ingress", {})
    ing_def = ingress.get(ingress_name)
    if ing_def is None:
        raise ValueError(f"Ingress '{ingress_name}' non trouvé dans {hr_path}")

    # Remplacer les annotations
    from ruamel.yaml.comments import CommentedMap
    new_annots = CommentedMap()
    for k in sorted(annotations.keys()):
        new_annots[k] = annotations[k]
    ing_def["annotations"] = new_annots

    with open(hr_path, "w") as f:
        ryaml.dump(data, f)

    logger.info("Annotations mises à jour: %s/%s ingress=%s", namespace, app_name, ingress_name)
