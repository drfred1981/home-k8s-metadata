from flask import Blueprint, request, jsonify, render_template
# Importer le blueprint (assurez-vous d'avoir le __init__.py qui définit components_bp)

from ..services.apps import components_service

components_bp = Blueprint('components', __name__)

# Route pour la page web de gestion des Components
@components_bp.route('/components')
def components_page():
    # Le chemin du template est /templates/apps/components.html
    return render_template('apps/components.html')

# API pour obtenir tous les Components
@components_bp.route('/api/components', methods=['GET'])
def get_components():
    data = components_service.load_data()
    return jsonify(data)

# API pour créer un nouveau Component
@components_bp.route('/api/components', methods=['POST'])
def create_component():
    new_component_data = request.json
    new_component = components_service.create_component(new_component_data)
    
    if new_component is None:
        # Gérer le cas où le nom existe déjà
        return jsonify({'error': 'Component name already exists'}), 409
        
    return jsonify(new_component), 201

# API pour mettre à jour un Component (le nom est l'ID)
@components_bp.route('/api/components/<path:component_name>', methods=['PUT'])
def update_component(component_name):
    updated_component_data = request.json
    # Nous utilisons 'path:component_name' pour permettre les slashes dans le nom si besoin,
    # mais soyez prudent avec les IDs basés sur le nom.
    
    updated_component = components_service.update_component(component_name, updated_component_data)
    
    if updated_component:
        return jsonify(updated_component)
        
    # Cas d'erreur (non trouvé ou nouveau nom déjà existant)
    return jsonify({'error': 'Component not found or new name already exists'}), 404

# API pour supprimer un Component (le nom est l'ID)
@components_bp.route('/api/components/<path:component_name>', methods=['DELETE'])
def delete_component(component_name):
    if components_service.delete_component(component_name):
        return '', 204
    return jsonify({'error': 'Component not found'}), 404