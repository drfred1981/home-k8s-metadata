from flask import Blueprint, request, jsonify, render_template
from .services.apps import substitutes_service

substitutes_bp = Blueprint('substitutes', __name__)

@substitutes_bp.route('/substitutes')
def substitutes_page():
    return render_template('apps/substitutes.html')

@substitutes_bp.route('/api/substitutes', methods=['GET'])
def get_substitutes():
    data = substitutes_service.load_data()
    return jsonify(data)

@substitutes_bp.route('/api/substitutes', methods=['POST'])
def create_substitute():
    data = request.json
    nom = data.get('nom')
    if not nom:
        return jsonify({'error': 'Nom est requis'}), 400
    substitute = substitutes_service.create_substitute(nom)
    if substitute:
        return jsonify(substitute), 201
    return jsonify({'error': 'Ce nom existe déjà'}), 409

@substitutes_bp.route('/api/substitutes/<string:old_nom>', methods=['PUT'])
def update_substitute(old_nom):
    data = request.json
    new_nom = data.get('nom')
    if not new_nom:
        return jsonify({'error': 'Nouveau nom est requis'}), 400
    substitute = substitutes_service.update_substitute(old_nom, new_nom)
    if substitute:
        return jsonify(substitute)
    return jsonify({'error': 'Substitut non trouvé'}), 404

@substitutes_bp.route('/api/substitutes/<string:nom>', methods=['DELETE'])
def delete_substitute(nom):
    if substitutes_service.delete_substitute(nom):
        return '', 204
    return jsonify({'error': 'Substitut non trouvé'}), 404