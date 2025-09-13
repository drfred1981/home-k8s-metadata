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

def setup_logging(app, log_level='INFO'):
    """
    Configure le logger pour l'application Flask.
    
    Args:
        app: L'instance de l'application Flask.
        log_level (str): Le niveau de verbosité par défaut ('INFO', 'DEBUG', etc.).
    """
    # S'assurer que le répertoire des logs existe
    log_dir = 'logs'
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)

    # Définir le niveau de log par défaut
    level = VERBOSITY_LEVELS.get(log_level.upper(), logging.INFO)
    app.logger.setLevel(level)

    # Format du message de log
    formatter = logging.Formatter(
        '[%(asctime)s] %(levelname)s in %(module)s: %(message)s'
    )

    # Gestionnaire pour la sortie console
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    app.logger.addHandler(console_handler)

    # Gestionnaire pour le fichier de log (rotation des fichiers)
    file_handler = RotatingFileHandler(
        os.path.join(log_dir, 'app.log'),
        maxBytes=1024 * 1024 * 10,  # 10 Mo
        backupCount=5
    )
    file_handler.setFormatter(formatter)
    app.logger.addHandler(file_handler)

    # Empêcher le logger de Flask d'afficher deux fois les messages
    app.logger.propagate = False