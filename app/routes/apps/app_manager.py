from flask import Blueprint, render_template

app_manager_bp = Blueprint('app_manager', __name__)

@app_manager_bp.route('/app-manager')
def app_manager_page():
    return render_template('apps/app_manager.html')
