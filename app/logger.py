# backend/logger.py
import logging
import os
from logging.handlers import RotatingFileHandler

# Configuration des niveaux de verbosité
VERBOSITY_LEVELS = {
    'DEBUG': logging.DEBUG,
    'INFO': logging.INFO,
    'WARNING': logging.WARNING,
    'ERROR': logging.ERROR,
    'CRITICAL': logging.CRITICAL
}

# Remplacez votre fonction setup_logging existante par celle-ci
def setup_logging(app, log_level='INFO'):
    """
    Configure le logger de l'application Flask pour s'intégrer avec Gunicorn.
    """
    # Si le logger est déjà configuré (c'est le cas avec Gunicorn), on ne fait rien
    if app.logger.handlers:
        return

    # Création d'un handler qui écrit dans la sortie standard
    handler = logging.StreamHandler(sys.stdout)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    
    # Définition du niveau de log de l'application
    app.logger.setLevel(log_level)
    handler.setLevel(log_level)
    
    # Ajout du handler au logger de l'application
    app.logger.addHandler(handler)

    # Optionnel mais recommandé : configurer le logger racine
    # pour que tous les logs (y compris ceux des librairies) soient capturés
    root_logger = logging.getLogger()
    root_logger.addHandler(handler)
    root_logger.setLevel(log_level)