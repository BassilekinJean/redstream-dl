# ===== STAGE 1: Backend =====
FROM python:3.12-slim AS backend

WORKDIR /app/server

# Installer les dépendances système pour yt-dlp
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server/ .

# Créer les répertoires nécessaires
RUN mkdir -p downloads /tmp/yt-dlp-cache

# ===== STAGE 2: Frontend Builder =====
FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ===== STAGE 3: Production avec Nginx =====
FROM nginx:alpine AS production

# Copier la config nginx
COPY nginx.conf /etc/nginx/nginx.conf

# Copier le frontend buildé
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Copier le backend
COPY --from=backend /app/server /app/server
COPY --from=backend /usr/local/lib/python3.12 /usr/local/lib/python3.12
COPY --from=backend /usr/local/bin/python3.12 /usr/local/bin/python3.12
COPY --from=backend /usr/bin/ffmpeg /usr/bin/ffmpeg

# Installer Python et supervisord dans l'image nginx
RUN apk add --no-cache python3 py3-pip supervisor

# Créer lien symbolique python
RUN ln -sf /usr/bin/python3 /usr/bin/python

# Installer les dépendances Python
COPY server/requirements.txt /app/server/
RUN pip3 install --no-cache-dir --break-system-packages -r /app/server/requirements.txt

# Créer le dossier downloads
RUN mkdir -p /app/server/downloads

# Copier la config supervisord
COPY supervisord.conf /etc/supervisord.conf

# Exposer le port (Render utilise PORT)
EXPOSE 80

# Lancer supervisord
CMD ["supervisord", "-c", "/etc/supervisord.conf"]