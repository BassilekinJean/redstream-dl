# ===== BACKEND (Python/FastAPI) =====
FROM python:3.11-slim AS backend

# Installer FFmpeg et dépendances système
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Créer le répertoire de travail
WORKDIR /app/server

# Copier et installer les dépendances Python
COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copier le code backend
COPY server/ .

# Créer le dossier downloads
RUN mkdir -p downloads

# Exposer le port
EXPOSE 8000

# Commande de démarrage
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]


# ===== FRONTEND (Node.js/React) =====
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm ci

# Copier le code source
COPY . .

# Build de production
RUN npm run build


# ===== NGINX pour servir le frontend =====
FROM nginx:alpine AS frontend

# Copier la configuration nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copier les fichiers buildés
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
