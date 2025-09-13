# backend/app.py

from flask import Flask, render_template
from typing import List, Dict, Optional

import os
import sys

# Ajoutez la racine du projet au chemin d'accès Python
# Cela permet d'utiliser des imports absolus comme `from src.services.apps import ...`
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if project_root not in sys.path:
    sys.path.append(project_root)

# Utilisation d'une importation relative pour le module logger
# Cela suppose que le fichier logger.py est dans le même répertoire que app.py
from logger import setup_logging

# Importation des Blueprints
from routes.apps.applications import applications_bp
from routes.apps.components import components_bp
from routes.apps.substitutes import substitutes_bp
from routes.apps.ingress_annotations import ingress_annotations_bp

def create_app():
    """
    Fonction de fabrique pour créer et configurer l'application Flask.
    """
    app = Flask(__name__)
    
    # Configuration du logger
    setup_logging(app, log_level='DEBUG')

    # Enregistrement des Blueprints avec leur préfixe d'URL
    app.register_blueprint(applications_bp, url_prefix='/apps')
    app.register_blueprint(components_bp, url_prefix='/apps')
    app.register_blueprint(substitutes_bp, url_prefix='/apps')
    app.register_blueprint(ingress_annotations_bp, url_prefix='/apps')

    @app.route('/')
    def index():
        return render_template('index.html')

    return app

# La variable 'app' est nécessaire pour Gunicorn
# Elle est définie ici en appelant la fonction de fabrique
app = create_app()

if __name__ == '__main__':
    # Lance l'application avec le serveur de développement Flask
    print("I'm starting web server")
    app.run(debug=True)