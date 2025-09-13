# backend/config.py
import yaml
import os

def load_config(config_path='config.yaml'):
    """Charge le fichier de configuration et renvoie les chemins de données."""
    try:
        with open(config_path, 'r') as file:
            config = yaml.safe_load(file)
            return config['data_paths']
    except FileNotFoundError:
        print(f"Erreur: Le fichier de configuration '{config_path}' est introuvable.")
        return {}
    except KeyError:
        print("Erreur: La clé 'data_paths' est manquante dans le fichier de configuration.")
        return {}

# Charger la configuration une seule fois au démarrage
DATA_PATHS = load_config()