from flask import Flask, render_template
import os
from pydantic import BaseModel
from typing import List, Dict, Optional

from logger import setup_logging # Import du logger

from routes.apps.applications import applications_bp
from routes.apps.components import components_bp
from routes.apps.substitutes import substitutes_bp
from routes.apps.ingress_annotations import ingress_annotations_bp

app = Flask(__name__)
# Configuration du logger
# Vous pouvez changer le niveau ici, par exemple 'DEBUG' en développement
setup_logging(app, log_level='DEBUG')
# Enregistrer le Blueprint, ce qui inclut les routes de ses sous-modules
app.register_blueprint(applications_bp, url_prefix='/apps')
app.register_blueprint(components_bp, url_prefix='/apps')
app.register_blueprint(substitutes_bp, url_prefix='/apps')
app.register_blueprint(ingress_annotations_bp, url_prefix='/apps')

def create_app():
    app = Flask(__name__)
    # Remarque : La variable DATA_PATHS n'est plus importée ici car elle est
    # gérée dans le service et la configuration.
    
    # Enregistrement des Blueprints
    # ✅ Les objets de blueprint sont importés et enregistrés correctement.
    app.register_blueprint(applications_bp, url_prefix='/apps')
    app.register_blueprint(components_bp, url_prefix='/apps')
    app.register_blueprint(substitutes_bp, url_prefix='/apps')
    app.register_blueprint(ingress_annotations_bp, url_prefix='/apps')

    @app.route('/')
    def index():
        return render_template('index.html')

    return app

if __name__ == '__main__':
    # La configuration est maintenant dans un module à part (config.py)
    # et n'a pas besoin d'être passée directement ici.
    app = create_app()
    app.run(debug=True)