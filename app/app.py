# backend/app.py

from flask import Flask, render_template, current_app
from typing import List, Dict, Optional
import git 
import os
import sys


# Utilisation d'une importation relative pour le module logger
# Cela suppose que le fichier logger.py est dans le même répertoire que app.py
from logger import setup_logging

# Importation des Blueprints
from routes.apps.applications import applications_bp
from routes.apps.components import components_bp
from routes.apps.substitutes import substitutes_bp
from routes.apps.ingress_annotations import ingress_annotations_bp
from routes.sync import sync_bp
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
    app.register_blueprint(sync_bp, url_prefix='/')
    app.register_blueprint(ingress_annotations_bp, url_prefix='/apps')
    """
    Vérifie si le dépôt existe et le clone si ce n'est pas le cas.
    Utilise les variables d'environnement REPO_URL et REPO_PATH.
    """
    repo_url = os.environ.get('REPO_URL')
    repo_path = os.environ.get('REPO_PATH')
    current_app.logger.info(f"repo_url: {repo_url}")
    current_app.logger.info(f"repo_path: {repo_path}")
    if not repo_url or not repo_path:
        current_app.logger.error("Les variables d'environnement REPO_URL ou REPO_PATH ne sont pas définies.")
        return

    # Vérifie si le chemin d'accès existe déjà
    if os.path.exists(repo_path):
        current_app.logger.error(f"Le dépôt existe déjà à l'emplacement {repo_path}")
    else:
        current_app.logger.info(f"Clonage du dépôt depuis {repo_url} vers {repo_path}")
        try:
            # Crée le répertoire parent si nécessaire
            os.makedirs(os.path.dirname(repo_path), exist_ok=True)
            # Clone le dépôt
            git.Repo.clone_from(repo_url, repo_path)
            current_app.logger.info("Clonage réussi.")
        except git.GitCommandError as e:
            current_app.logger.rror(f"Erreur lors du clonage du dépôt : {e}")

    @app.route('/')
    def index():
        return render_template('index.html')

    return app

# La variable 'app' est nécessaire pour Gunicorn
# Elle est définie ici en appelant la fonction de fabrique
app = create_app()

if __name__ == '__main__':
    # Lance l'application avec le serveur de développement Flask
    print("I'm starting the web server")
    app.run(debug=True)