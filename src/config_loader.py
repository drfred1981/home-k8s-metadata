import yaml
import os
from typing import List, Dict

def load_yaml_files_recursively(directory: str) -> List[Dict]:
    yamls = []
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith((".yaml", ".yml")):
                path = os.path.join(root, file)
                with open(path, 'r') as f:
                    yamls.append(yaml.safe_load(f))
    return yamls

def extract_requirements(configs: List[Dict]):
    exigences_prod = []
    for config in configs:
        doc = config.get("docs", {})
        for exigence in doc.get("exigences_prod", []):
            exigences_prod.append(exigence)
    return exigences_prod

def extract_exigences(configs: List[Dict]):
    exigences_prod = []
    for config in configs:
        doc = config.get("exigences", {})
        for exigence in doc:
            exigences_prod.append(exigence)
    return exigences_prod
