from flask import Blueprint

apps_bp = Blueprint('apps', __name__, url_prefix='/apps')
# Vous devez importer vos routes ici pour qu'elles soient enregistrées
from . import components, substitutes , applications, ingress_annotations, ingress_editor