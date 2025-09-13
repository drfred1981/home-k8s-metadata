#!/bin/bash

# Nom de l'image Docker (à adapter)
IMAGE_NAME="home-k8s-metadata"

# Version de l'image (utilise la date pour un tag unique)
VERSION=$(date +%Y%m%d%H%M%S)

# Tag de l'image
FULL_IMAGE_NAME="ghcr.io/$GITHUB_REPOSITORY/$IMAGE_NAME:$VERSION"

# Assurez-vous d'être connecté à GitHub Container Registry
echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$GITHUB_ACTOR" --password-stdin

# Construire l'image Docker
docker build -t "$FULL_IMAGE_NAME" .

# Pousser l'image vers GitHub Container Registry
docker push "$FULL_IMAGE_NAME"

echo "Image $FULL_IMAGE_NAME a été déployée avec succès."