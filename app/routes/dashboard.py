from flask import Blueprint, jsonify, render_template, request
import os

from services.scanner import scan_apps, get_app_detail, get_all_annotation_suggestions, get_all_dependency_suggestions, get_all_substitute_suggestions, get_all_component_suggestions
from services.writer import update_ks_yaml, update_helmrelease_annotations

dashboard_bp = Blueprint('dashboard', __name__)

REPO_PATH = os.environ.get('REPO_PATH', '')


@dashboard_bp.route('/')
def index():
    return render_template('index.html')


@dashboard_bp.route('/api/apps')
def api_apps():
    apps = scan_apps(REPO_PATH)
    return jsonify(apps)


@dashboard_bp.route('/api/apps/<namespace>/<name>')
def api_app_detail(namespace, name):
    detail = get_app_detail(REPO_PATH, namespace, name)
    if not detail:
        return jsonify({"error": "Application introuvable"}), 404
    return jsonify(detail)


@dashboard_bp.route('/api/apps/<namespace>/<name>', methods=['PATCH'])
def api_app_update(namespace, name):
    data = request.get_json()
    if not data:
        return jsonify({"error": "Corps JSON requis"}), 400

    subapp_full_name = data.get("subapp_full_name")
    changes = data.get("changes", {})

    if not subapp_full_name:
        return jsonify({"error": "subapp_full_name requis"}), 400

    allowed = {"interval", "retryInterval", "timeout", "wait", "prune", "suspend", "substitute", "dependsOn", "components"}
    filtered = {k: v for k, v in changes.items() if k in allowed}

    try:
        update_ks_yaml(REPO_PATH, namespace, name, subapp_full_name, filtered)
        return jsonify({"message": "Modifications enregistrees"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@dashboard_bp.route('/api/dependencies/suggestions')
def api_dependency_suggestions():
    suggestions = get_all_dependency_suggestions(REPO_PATH)
    return jsonify(suggestions)


@dashboard_bp.route('/api/components/suggestions')
def api_component_suggestions():
    suggestions = get_all_component_suggestions(REPO_PATH)
    return jsonify(suggestions)


@dashboard_bp.route('/api/substitutes/suggestions')
def api_substitute_suggestions():
    suggestions = get_all_substitute_suggestions(REPO_PATH)
    return jsonify(suggestions)


@dashboard_bp.route('/api/annotations/suggestions')
def api_annotation_suggestions():
    suggestions = get_all_annotation_suggestions(REPO_PATH)
    return jsonify(suggestions)


@dashboard_bp.route('/api/apps/<namespace>/<name>/annotations', methods=['PATCH'])
def api_app_update_annotations(namespace, name):
    data = request.get_json()
    if not data:
        return jsonify({"error": "Corps JSON requis"}), 400

    subapp_path = data.get("subapp_path")
    ingress_name = data.get("ingress_name")
    annotations = data.get("annotations")

    if not subapp_path or not ingress_name or annotations is None:
        return jsonify({"error": "subapp_path, ingress_name et annotations requis"}), 400

    try:
        update_helmrelease_annotations(REPO_PATH, namespace, name, subapp_path, ingress_name, annotations)
        return jsonify({"message": "Annotations mises a jour"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
