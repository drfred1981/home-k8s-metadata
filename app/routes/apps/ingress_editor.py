from flask import Blueprint, render_template

from services.apps import applications_service, ingress_annotations_service

ingress_editor_bp = Blueprint('ingress_editor', __name__)

@ingress_editor_bp.route('/ingress-editor')
def ingress_editor_page():
    applications = applications_service.load_data()
    ingress_annotations = ingress_annotations_service.load_data()
    return render_template(
        'apps/ingress_editor.html',
        applications=applications,
        ingress_annotations=ingress_annotations
    )
