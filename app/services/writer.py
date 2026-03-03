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

        break

    if not found:
        raise ValueError(f"Kustomization '{subapp_full_name}' non trouvé dans {ks_path}")

    with open(ks_path, "w") as f:
        ryaml.dump_all(docs, f)

    logger.info("ks.yaml mis à jour: %s/%s subapp=%s", namespace, app_name, subapp_full_name)
