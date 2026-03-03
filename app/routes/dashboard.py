from flask import Blueprint, jsonify, render_template
import os

from services.scanner import scan_apps

dashboard_bp = Blueprint('dashboard', __name__)

REPO_PATH = os.environ.get('REPO_PATH', '')


@dashboard_bp.route('/')
def index():
    return render_template('index.html')


@dashboard_bp.route('/api/apps')
def api_apps():
    apps = scan_apps(REPO_PATH)
    return jsonify(apps)
