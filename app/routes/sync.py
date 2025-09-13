# backend/routes/sync.py

from flask import Blueprint, jsonify, request, render_template
import os
import git

sync_bp = Blueprint('sync', __name__)

# Assurez-vous que cette variable correspond à votre variable d'environnement
REPO_PATH = os.environ.get('REPO_PATH')

def get_repo():
    """Récupère l'objet git.Repo si le chemin est valide."""
    if not REPO_PATH or not os.path.exists(REPO_PATH):
        return None
    try:
        return git.Repo(REPO_PATH)
    except git.InvalidGitRepositoryError:
        return None

# Route pour la page de l'interface utilisateur
@sync_bp.route('/sync')
def sync_page():
    repo = get_repo()
    status = "Le dépôt n'est pas configuré ou n'existe pas."
    
    if repo:
        try:
            # Récupère l'état actuel du dépôt
            head_commit = repo.head.commit.hexsha[:7]
            status = f"Dépôt prêt. Dernier commit : {head_commit}"
        except Exception as e:
            status = f"Erreur lors de la récupération du statut : {e}"
            
    return render_template('sync.html', status=status)

# API pour l'opération git pull
@sync_bp.route('/api/git-pull', methods=['POST'])
def git_pull():
    repo = get_repo()
    if not repo:
        return jsonify({'error': 'Dépôt non trouvé'}), 404
        
    try:
        origin = repo.remotes.origin
        pull_info = origin.pull()
        
        message = [f"Pull réussi. Révision mise à jour : {info.commit.hexsha[:7]}" for info in pull_info]
        return jsonify({'message': message})
    except Exception as e:
        return jsonify({'error': f"Erreur lors du pull : {e}"}), 500

# API pour l'opération git push
@sync_bp.route('/api/git-push', methods=['POST'])
def git_push():
    repo = get_repo()
    if not repo:
        return jsonify({'error': 'Dépôt non trouvé'}), 404
        
    commit_message = request.json.get('commit_message')
    if not commit_message:
        return jsonify({'error': 'Message de commit manquant'}), 400

    try:
        # Ajoute tous les fichiers modifiés/supprimés
        repo.git.add(all=True)
        # Commit des changements
        repo.index.commit(commit_message)
        # Push vers l'origine
        origin = repo.remotes.origin
        push_info = origin.push()
        
        return jsonify({'message': 'Push réussi.'})
    except Exception as e:
        return jsonify({'error': f"Erreur lors du push : {e}"}), 500