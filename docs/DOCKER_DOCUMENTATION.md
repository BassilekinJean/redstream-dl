# 🐳 Documentation Docker & Nginx - RedStream DL

## Table des matières
1. [Vue d'ensemble](#vue-densemble)
2. [Architecture](#architecture)
3. [Dockerfile](#dockerfile)
4. [Docker Compose](#docker-compose)
5. [Configuration Nginx](#configuration-nginx)
6. [Commandes utiles](#commandes-utiles)
7. [Personnalisation](#personnalisation)
8. [Dépannage](#dépannage)

---

## Vue d'ensemble

RedStream DL utilise une architecture Docker multi-conteneurs pour séparer le frontend (React/Nginx) du backend (FastAPI/Python). Cette approche offre :

- **Isolation** : Chaque service dans son propre conteneur
- **Portabilité** : Déploiement identique partout
- **Scalabilité** : Possibilité de répliquer les services
- **Simplicité** : Une seule commande pour tout démarrer

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         INTERNET                                │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼ Port 80
┌─────────────────────────────────────────────────────────────────┐
│                    NGINX (frontend)                             │
│              Container: redstream-frontend                      │
│                                                                 │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐│
│  │   Static Files      │    │      Reverse Proxy              ││
│  │   /usr/share/       │    │      /api/* → backend:8000      ││
│  │   nginx/html/       │    │                                 ││
│  │   (React build)     │    │                                 ││
│  └─────────────────────┘    └─────────────────────────────────┘│
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼ Port 8000 (interne)
┌─────────────────────────────────────────────────────────────────┐
│                    FastAPI (backend)                            │
│              Container: redstream-backend                       │
│                                                                 │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐│
│  │   yt-dlp            │    │      FFmpeg                     ││
│  │   Extraction vidéo  │    │      Fusion audio/vidéo         ││
│  └─────────────────────┘    └─────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │   Volume: downloads/                                        ││
│  │   Fichiers temporaires (nettoyage automatique 30 min)       ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Flux des requêtes

1. **Requête statique** (`/`, `/index.html`, `/assets/*`)
   - Nginx sert directement les fichiers du build React

2. **Requête API** (`/api/*`)
   - Nginx proxifie vers le backend FastAPI
   - Le backend traite et répond
   - Nginx renvoie la réponse au client

---

## Dockerfile

Le Dockerfile utilise un **build multi-stage** pour optimiser la taille des images.

### Stage 1: Backend (Python/FastAPI)

```dockerfile
FROM python:3.11-slim as backend

# Installer FFmpeg et dépendances système
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/server

COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server/ .
RUN mkdir -p downloads

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### Explications

| Instruction | Raison |
|-------------|--------|
| `python:3.11-slim` | Image légère (~150MB vs ~900MB pour la full) |
| `apt-get install ffmpeg` | Nécessaire pour fusionner vidéo + audio |
| `--no-cache-dir` | Réduit la taille de l'image (pas de cache pip) |
| `--host 0.0.0.0` | Écoute sur toutes les interfaces (requis en Docker) |

### Stage 2: Frontend Builder (Node.js)

```dockerfile
FROM node:20-alpine as frontend-builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build
```

#### Explications

| Instruction | Raison |
|-------------|--------|
| `node:20-alpine` | Image ultra-légère (~180MB) |
| `npm ci` | Installation plus rapide et déterministe que `npm install` |
| `npm run build` | Génère les fichiers statiques dans `/dist` |

### Stage 3: Frontend Runtime (Nginx)

```dockerfile
FROM nginx:alpine as frontend

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### Explications

| Instruction | Raison |
|-------------|--------|
| `nginx:alpine` | Image ~25MB, parfaite pour servir des fichiers statiques |
| `--from=frontend-builder` | Copie uniquement le build, pas node_modules |
| `daemon off` | Nginx reste en foreground (requis pour Docker) |

### Taille des images finales

| Image | Taille approximative |
|-------|---------------------|
| Backend (Python + FFmpeg) | ~500MB |
| Frontend (Nginx + build) | ~30MB |

---

## Docker Compose

```yaml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile
      target: backend
    container_name: redstream-backend
    restart: unless-stopped
    ports:
      - "8000:8000"
    volumes:
      - downloads_data:/app/server/downloads
    environment:
      - PYTHONUNBUFFERED=1
      - FILE_EXPIRY_MINUTES=30
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/docs"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - redstream-network

  frontend:
    build:
      context: .
      dockerfile: Dockerfile
      target: frontend
    container_name: redstream-frontend
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - redstream-network

networks:
  redstream-network:
    driver: bridge

volumes:
  downloads_data:
    driver: local
```

### Paramètres expliqués

#### Service `backend`

| Paramètre | Valeur | Explication |
|-----------|--------|-------------|
| `target: backend` | Stage du Dockerfile | Utilise uniquement le stage "backend" |
| `restart: unless-stopped` | Politique de redémarrage | Redémarre sauf si arrêté manuellement |
| `ports: "8000:8000"` | Mapping de ports | Optionnel, utile pour debug direct |
| `PYTHONUNBUFFERED=1` | Variable d'env | Logs Python en temps réel |
| `FILE_EXPIRY_MINUTES=30` | Variable d'env | Durée de vie des fichiers téléchargés |
| `healthcheck` | Vérification santé | Docker vérifie que l'API répond |

#### Service `frontend`

| Paramètre | Valeur | Explication |
|-----------|--------|-------------|
| `target: frontend` | Stage du Dockerfile | Utilise le stage Nginx |
| `ports: "80:80"` | Mapping de ports | Point d'entrée principal |
| `depends_on: backend` | Dépendance | Attend que le backend démarre |

#### Réseau `redstream-network`

- **Type `bridge`** : Réseau isolé pour les conteneurs
- Les conteneurs communiquent via leurs noms (`backend`, `frontend`)
- Exemple : `http://backend:8000` depuis le conteneur frontend

#### Volume `downloads_data`

- **Persistance optionnelle** des téléchargements entre redémarrages
- Peut être supprimé si vous ne voulez pas de persistance

---

## Configuration Nginx

```nginx
server {
    listen 80;
    server_name localhost;
    
    # Servir les fichiers statiques React
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Proxy vers le backend FastAPI
    location /api/ {
        proxy_pass http://backend:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout pour les téléchargements longs
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        proxy_send_timeout 300s;
        
        # Taille max des uploads
        client_max_body_size 100M;
    }

    # Headers de sécurité
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_types text/plain text/css text/xml text/javascript 
               application/javascript application/json application/xml;
}
```

### Directives expliquées

#### `location /` - Fichiers statiques

```nginx
root /usr/share/nginx/html;
index index.html;
try_files $uri $uri/ /index.html;
```

| Directive | Explication |
|-----------|-------------|
| `root` | Dossier contenant le build React |
| `index` | Fichier par défaut |
| `try_files` | **SPA fallback** : si le fichier n'existe pas, renvoie `index.html` |

Le `try_files` est crucial pour les Single Page Applications (React Router) :
- `/about` → fichier non trouvé → renvoie `index.html` → React gère la route

#### `location /api/` - Reverse Proxy

```nginx
proxy_pass http://backend:8000;
```

| Directive | Explication |
|-----------|-------------|
| `proxy_pass` | Redirige vers le backend (nom du service Docker) |
| `proxy_http_version 1.1` | HTTP/1.1 pour le keep-alive |
| `proxy_set_header Host` | Préserve le header Host original |
| `proxy_set_header X-Real-IP` | Transmet l'IP réelle du client |
| `proxy_set_header X-Forwarded-For` | Chaîne des proxies traversés |

#### Timeouts

```nginx
proxy_read_timeout 300s;    # 5 minutes
proxy_connect_timeout 75s;
proxy_send_timeout 300s;
```

**Pourquoi 5 minutes ?** Les téléchargements de vidéos longues peuvent prendre du temps. Sans ces timeouts, Nginx couperait la connexion après 60s par défaut.

#### Headers de sécurité

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
```

| Header | Protection contre |
|--------|-------------------|
| `X-Frame-Options` | Clickjacking (iframe malveillants) |
| `X-Content-Type-Options` | MIME-type sniffing |
| `X-XSS-Protection` | Attaques XSS (Cross-Site Scripting) |

#### Compression Gzip

```nginx
gzip on;
gzip_types text/plain text/css application/javascript application/json;
```

**Avantage** : Réduit la taille des réponses de 60-80%, accélère le chargement.

---

## Commandes utiles

### Gestion basique

```bash
# Build et démarrer
docker-compose up --build

# Démarrer en arrière-plan
docker-compose up -d --build

# Arrêter
docker-compose down

# Arrêter et supprimer les volumes
docker-compose down -v
```

### Logs et debug

```bash
# Voir tous les logs
docker-compose logs -f

# Logs d'un service spécifique
docker-compose logs -f backend
docker-compose logs -f frontend

# Entrer dans un conteneur
docker exec -it redstream-backend /bin/bash
docker exec -it redstream-frontend /bin/sh
```

### Maintenance

```bash
# Reconstruire un service spécifique
docker-compose build backend
docker-compose up -d backend

# Voir l'état des conteneurs
docker-compose ps

# Voir l'utilisation des ressources
docker stats

# Nettoyer les images non utilisées
docker system prune -a
```

### Vérification santé

```bash
# Vérifier que le backend répond
curl http://localhost:8000/docs

# Vérifier que le frontend répond
curl http://localhost/

# Vérifier le proxy API
curl http://localhost/api/docs
```

---

## Personnalisation

### Changer le port d'exposition

```yaml
# docker-compose.yml
frontend:
  ports:
    - "3000:80"  # Accessible sur http://localhost:3000
```

### Ajouter HTTPS (avec Certbot)

```nginx
# nginx.conf
server {
    listen 80;
    server_name example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com;
    
    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    
    # ... reste de la config
}
```

### Limiter les ressources

```yaml
# docker-compose.yml
backend:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 2G
      reservations:
        cpus: '0.5'
        memory: 512M
```

### Variables d'environnement personnalisées

```yaml
# docker-compose.yml
backend:
  environment:
    - FILE_EXPIRY_MINUTES=60  # 1 heure au lieu de 30 min
    - CLEANUP_INTERVAL_SECONDS=600  # Vérification toutes les 10 min
```

### Ajouter un nom de domaine

```nginx
# nginx.conf
server {
    listen 80;
    server_name redstream.example.com;
    # ...
}
```

---

## Dépannage

### Le frontend ne se connecte pas au backend

**Symptôme** : Erreurs CORS ou "Failed to fetch"

**Solutions** :
1. Vérifier que les deux conteneurs sont sur le même réseau :
   ```bash
   docker network inspect redstream-dl_redstream-network
   ```

2. Vérifier que le backend est accessible :
   ```bash
   docker exec redstream-frontend wget -qO- http://backend:8000/docs
   ```

### Les téléchargements échouent

**Symptôme** : Timeout ou erreur 502

**Solutions** :
1. Augmenter les timeouts nginx :
   ```nginx
   proxy_read_timeout 600s;  # 10 minutes
   ```

2. Vérifier les logs backend :
   ```bash
   docker-compose logs -f backend
   ```

### Les fichiers ne sont pas nettoyés

**Symptôme** : Le volume `downloads_data` grossit

**Solutions** :
1. Vérifier que le thread de nettoyage est actif :
   ```bash
   docker-compose logs backend | grep "Cleanup"
   ```

2. Nettoyer manuellement :
   ```bash
   docker exec redstream-backend rm -rf /app/server/downloads/*
   ```

### Erreur "port already in use"

**Symptôme** : `Error starting userland proxy: listen tcp4 0.0.0.0:80: bind: address already in use`

**Solutions** :
1. Trouver le processus utilisant le port :
   ```bash
   sudo lsof -i :80
   ```

2. Changer le port dans docker-compose.yml :
   ```yaml
   ports:
     - "8080:80"
   ```

### Build très lent

**Solutions** :
1. Utiliser le cache Docker :
   ```bash
   docker-compose build  # Sans --no-cache
   ```

2. Ajouter un `.dockerignore` pour exclure `node_modules`, `venv`, etc.

---

## Ressources

- [Documentation Docker](https://docs.docker.com/)
- [Documentation Docker Compose](https://docs.docker.com/compose/)
- [Documentation Nginx](https://nginx.org/en/docs/)
- [Best practices Dockerfile](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)

---

*Documentation générée pour RedStream DL v1.0.0*
