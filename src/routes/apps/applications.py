from flask import Blueprint, request, jsonify, render_template

# 🎯 Importez correctement tous les services nécessaires
# Make sure to import the services you need here.
from ..services.apps import applications_service, components_service, substitutes_service, ingress_annotations_service

applications_bp = Blueprint('applications', __name__)

@applications_bp.route('/global-graph')
def global_dependency_graph_page():
    return render_template('apps/global_dependency_graph.html')



@applications_bp.route('/api/applications/global-graph-data', methods=['GET'])
def get_global_graph_data():
    try:
        graph_data = applications_service.get_all_dependencies_graph_data()
        return jsonify(graph_data)
    except Exception as e:
        print(f"Erreur lors de la génération du graphe global : {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500
        

# Your route to display the applications page
@applications_bp.route('/applications')
def applications_page():
    applications = applications_service.load_data()
    components = components_service.load_data()
    substitutes = substitutes_service.load_data()
    ingress_annotations = ingress_annotations_service.load_data()
    return render_template(
        'apps/applications.html',
        applications=applications,
        components=components,
        substitutes=substitutes,
        ingress_annotations=ingress_annotations
    )
@applications_bp.route('/api/applications/dependencies', methods=['POST'])
def get_dependencies_graph():
    data = request.json
    app_name = data.get('app_name')
    app_namespace = data.get('app_namespace')
    depth_str = data.get('depth', '2')

    try:
        depth = int(depth_str) if depth_str != 'all' else float('inf')
    except (ValueError, TypeError):
        depth = 2

    if not app_name or not app_namespace:
        return jsonify({'error': 'Nom et namespace de l\'application requis'}), 400

    try:
        # The applications_service is now correctly defined here.
        graph_data = applications_service.get_dependency_tree(app_name, app_namespace, depth)
        return jsonify(graph_data)
    except Exception as e:
        print(f"Erreur lors de la génération du graphe de dépendances : {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500

# API pour obtenir toutes les applications
@applications_bp.route('/api/applications', methods=['GET'])
def get_applications():
    data = applications_service.load_data()
    return jsonify(data)

# Nouvelle API pour obtenir une seule application par son nom et namespace
@applications_bp.route('/api/applications/<path:namespace>/<path:name>', methods=['GET'])
def get_single_application(name, namespace):
    """
    Récupère les données d'une application spécifique pour le formulaire de modification.
    """
    app_data = applications_service.get_application(name, namespace)
    if app_data:
        return jsonify(app_data)
    return jsonify({'error': 'Application not found'}), 404
# API pour créer une nouvelle application
@applications_bp.route('/api/applications', methods=['POST'])
def create_application():
    new_app_data = request.json
    try:
        new_app = applications_service.create_application(new_app_data)
        if new_app is None:
            return jsonify({'error': 'Application with this name and namespace already exists'}), 409
        return jsonify(new_app), 201
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

# API pour mettre à jour une application
@applications_bp.route('/api/applications/<path:namespace>/<path:name>', methods=['PUT'])
def update_application(name, namespace):
    updated_app_data = request.json
    print(updated_app_data)
    try:
        updated_app = applications_service.update_application(name, namespace, updated_app_data)
       
        if updated_app:
            return jsonify(updated_app)
        return jsonify({'error': 'Application not found or new name/namespace already exists'}), 404
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

# API pour supprimer une application
@applications_bp.route('/api/applications/<path:namespace>/<path:name>', methods=['DELETE'])
def delete_application(name, namespace):
    if applications_service.delete_application(name, namespace):
        return '', 204
    return jsonify({'error': 'Application not found'}), 404

