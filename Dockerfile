# Utilise une image Python légère comme base
FROM python:3.10-slim


# 🎯 Rajout de l'installation de Git
RUN apt-get update && apt-get install -y git
# Définit le répertoire de travail dans le conteneur
WORKDIR /app

# Copie le fichier des dépendances dans le conteneur
COPY requirements.txt .

# Installe les dépendances Python
RUN pip install --no-cache-dir -r requirements.txt

# Copie l'ensemble du code de l'application dans le conteneur
COPY app .

# Expose le port par défaut de l'application Flask
EXPOSE 5000

# Définit la commande pour lancer l'application avec Gunicorn
# Les variables d'environnement seront passées au moment de l'exécution
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]