from flask import Blueprint, request, jsonify, render_template
from .services.apps import ingress_annotations_service
ingress_annotations_bp = Blueprint('ingressannotations', __name__)

@ingress_annotations_bp.route('/ingress-annotations')
def ingress_annotations_page():
    return render_template('apps/ingress_annotations.html')

@ingress_annotations_bp.route('/api/ingress-annotations', methods=['GET'])
def get_ingress_annotations():
    data = ingress_annotations_service.load_data()
    return jsonify(data)

@ingress_annotations_bp.route('/api/ingress-annotations', methods=['POST'])
def create_ingress_annotation():
    data = request.json
    nom = data.get('nom')
    if not nom:
        return jsonify({'error': 'Nom est requis'}), 400
    annotation = ingress_annotations_service.create_annotation(nom)
    if annotation:
        return jsonify(annotation), 201
    return jsonify({'error': 'Ce nom existe déjà'}), 409

@ingress_annotations_bp.route('/api/ingress-annotations/<string:old_nom>', methods=['PUT'])
def update_ingress_annotation(old_nom):
    data = request.json
    new_nom = data.get('nom')
    if not new_nom:
        return jsonify({'error': 'Nouveau nom est requis'}), 400
    annotation = ingress_annotations_service.update_annotation(old_nom, new_nom)
    if annotation:
        return jsonify(annotation)
    return jsonify({'error': 'Annotation non trouvée'}), 404

@ingress_annotations_bp.route('/api/ingress-annotations/<string:nom>', methods=['DELETE'])
def delete_ingress_annotation(nom):
    if ingress_annotations_service.delete_annotation(nom):
        return '', 204
    return jsonify({'error': 'Annotation non trouvée'}), 404