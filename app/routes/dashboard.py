from flask import Blueprint, jsonify, render_template, request
import os

from services.scanner import scan_apps, get_app_detail
from services.writer import update_ks_yaml

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

    allowed = {"interval", "retryInterval", "timeout", "wait", "prune", "substitute"}
    filtered = {k: v for k, v in changes.items() if k in allowed}

    try:
        update_ks_yaml(REPO_PATH, namespace, name, subapp_full_name, filtered)
        return jsonify({"message": "Modifications enregistrees"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
