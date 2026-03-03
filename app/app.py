from flask import Flask
import git
import os

from logger import setup_logging
from routes.dashboard import dashboard_bp
from routes.sync import sync_bp


def create_app():
    app = Flask(__name__)
    setup_logging(app, log_level='DEBUG')

    app.register_blueprint(dashboard_bp)
    app.register_blueprint(sync_bp)

    repo_url = os.environ.get('REPO_URL')
    repo_path = os.environ.get('REPO_PATH')

    if not repo_url or not repo_path:
        app.logger.error("REPO_URL ou REPO_PATH non définies.")
        return app

    if os.path.exists(repo_path):
        app.logger.info("Dépôt déjà présent : %s", repo_path)
    else:
        app.logger.info("Clonage du dépôt depuis %s vers %s", repo_url, repo_path)
        try:
            os.makedirs(os.path.dirname(repo_path), exist_ok=True)
            git.Repo.clone_from(repo_url, repo_path)
            app.logger.info("Clonage réussi.")
        except git.GitCommandError as e:
            app.logger.error("Erreur lors du clonage : %s", e)

    return app


app = create_app()

if __name__ == '__main__':
    app.run(debug=True)
