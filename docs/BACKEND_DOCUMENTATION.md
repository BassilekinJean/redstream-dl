# 📚 Documentation Technique - Backend (main.py)

## Table des matières
1. [Vue d'ensemble](#vue-densemble)
2. [Architecture et dépendances](#architecture-et-dépendances)
3. [Configuration CORS](#configuration-cors)
4. [Modèles de données (Pydantic)](#modèles-de-données-pydantic)
5. [Fonctions utilitaires](#fonctions-utilitaires)
6. [Endpoints API](#endpoints-api)
7. [Choix techniques](#choix-techniques)
8. [Pistes d'amélioration](#pistes-damélioration)

---

## Vue d'ensemble

Le backend RedStream est une API REST construite avec **FastAPI** qui sert d'interface entre le frontend React et la bibliothèque **yt-dlp** pour l'extraction et le téléchargement de vidéos YouTube.

### Stack technique
- **FastAPI** : Framework web asynchrone haute performance
- **yt-dlp** : Fork amélioré de youtube-dl pour l'extraction vidéo
- **Pydantic** : Validation des données et sérialisation
- **UUID** : Génération d'identifiants uniques pour les téléchargements

---

## Architecture et dépendances

```python
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import yt_dlp
import os
import uuid
import glob
import asyncio
import traceback
```

### Pourquoi ces choix ?

| Dépendance | Justification |
|------------|---------------|
| `FastAPI` | Performance async native, documentation auto (Swagger), validation intégrée |
| `HTTPException` | Gestion standardisée des erreurs HTTP |
| `FileResponse` | Streaming efficace des fichiers vers le navigateur |
| `Pydantic` | Validation automatique des entrées, sérialisation JSON |
| `yt-dlp` | Plus maintenu que youtube-dl, meilleur support des formats |
| `uuid` | Identifiants uniques pour isoler les téléchargements |
| `glob` | Recherche de fichiers avec patterns (wildcards) |

---

## Configuration CORS

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ⚠️ À restreindre en production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Explication

Le **CORS** (Cross-Origin Resource Sharing) permet au frontend (ex: `localhost:5173`) de communiquer avec le backend (`localhost:8000`) malgré les origines différentes.

| Paramètre | Valeur | Signification |
|-----------|--------|---------------|
| `allow_origins` | `["*"]` | Accepte toutes les origines (à restreindre) |
| `allow_credentials` | `True` | Autorise les cookies/authentification |
| `allow_methods` | `["*"]` | Autorise GET, POST, PUT, DELETE, etc. |
| `allow_headers` | `["*"]` | Accepte tous les headers HTTP |

---

## Modèles de données (Pydantic)

### VideoRequest
```python
class VideoRequest(BaseModel):
    url: str
```
**Usage** : Requête simple contenant uniquement l'URL à analyser.

### DownloadRequest
```python
class DownloadRequest(BaseModel):
    url: str
    format_id: str
    extract_audio: bool = False
    include_thumbnail: bool = True
    include_subtitles: bool = False
```

| Champ | Type | Défaut | Description |
|-------|------|--------|-------------|
| `url` | `str` | requis | URL de la vidéo YouTube |
| `format_id` | `str` | requis | ID du format (ex: "137", "bestvideo+bestaudio") |
| `extract_audio` | `bool` | `False` | Convertir en MP3 |
| `include_thumbnail` | `bool` | `True` | Télécharger la miniature |
| `include_subtitles` | `bool` | `False` | Télécharger les sous-titres |

### PlaylistDownloadRequest
```python
class PlaylistDownloadRequest(BaseModel):
    urls: List[str]
    format_id: str
    extract_audio: bool = False
    include_thumbnail: bool = True
    include_subtitles: bool = False
```

**Différence** : `urls` est une liste pour télécharger plusieurs vidéos sélectionnées.

---

## Fonctions utilitaires

### format_error()

```python
def format_error(e: Exception) -> dict:
    """Formate une erreur pour le frontend"""
    error_str = str(e)
    
    if "Requested format is not available" in error_str:
        return {
            "error": "Format non disponible",
            "detail": "Le format sélectionné n'est pas disponible...",
            "code": "FORMAT_UNAVAILABLE"
        }
    # ... autres cas
```

### Pourquoi cette fonction ?

1. **UX améliorée** : Les erreurs yt-dlp sont cryptiques pour l'utilisateur
2. **Internationalisation** : Messages en français
3. **Codes d'erreur** : Permettent au frontend de réagir différemment selon le type
4. **Sécurité** : Évite d'exposer des détails techniques sensibles

### Mapping des erreurs

| Pattern détecté | Code | Message utilisateur |
|-----------------|------|---------------------|
| "Requested format is not available" | `FORMAT_UNAVAILABLE` | Format non disponible |
| "Video unavailable" | `VIDEO_UNAVAILABLE` | Vidéo indisponible |
| "Sign in" / "age" | `AGE_RESTRICTED` | Restriction d'âge |
| "No supported JavaScript runtime" | `JS_RUNTIME_MISSING` | Runtime JS manquant |
| Autre | `UNKNOWN_ERROR` | Erreur générique (tronquée à 200 chars) |

---

## Endpoints API

### POST /api/info

**But** : Extraire les métadonnées d'une vidéo ou playlist sans télécharger.

```python
@app.post("/api/info")
async def get_video_info(request: VideoRequest):
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
        'extract_flat': False,
        'ignoreerrors': True,
    }
```

#### Options yt-dlp expliquées

| Option | Valeur | Raison |
|--------|--------|--------|
| `quiet` | `True` | Pas de sortie console |
| `no_warnings` | `True` | Supprime les avertissements |
| `skip_download` | `True` | Extraction métadonnées uniquement |
| `extract_flat` | `False` | Extrait les infos complètes des vidéos de playlist |
| `ignoreerrors` | `True` | Continue même si une vidéo de playlist échoue |

#### Formats génériques

```python
generic_formats = [
    {'format_id': 'bestvideo+bestaudio/best', ...},
    {'format_id': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]', ...},
    # ...
]
```

**Pourquoi ?** Les format_id spécifiques (137, 22, etc.) varient selon les vidéos. Les sélecteurs génériques (`bestvideo+bestaudio`) fonctionnent universellement.

### POST /api/download

**But** : Télécharger une vidéo unique.

```python
@app.post("/api/download")
async def download_video(request: DownloadRequest):
    download_id = str(uuid.uuid4())
    download_dir = f"downloads/{download_id}"
    os.makedirs(download_dir, exist_ok=True)
```

#### Flux de téléchargement

```
1. Génère UUID unique
2. Crée dossier downloads/{uuid}/
3. Configure yt-dlp avec le format demandé
4. Télécharge et fusionne vidéo+audio en MP4
5. Retourne {download_id, filename}
```

#### Postprocesseurs

```python
'postprocessors': [{
    'key': 'FFmpegVideoConvertor',
    'preferedformat': 'mp4',
}]
```

**Pourquoi ?** YouTube sépare souvent vidéo (webm) et audio (m4a). FFmpeg les fusionne en un seul MP4.

### POST /api/download/playlist

**But** : Télécharger plusieurs vidéos sélectionnées d'une playlist.

```python
@app.post("/api/download/playlist")
async def download_playlist(request: PlaylistDownloadRequest):
    # Boucle sur chaque URL
    for url in request.urls:
        try:
            ydl.download([url])
            results.append({"url": url, "status": "success"})
        except Exception as e:
            errors.append({"url": url, "error": str(e)[:100]})
```

**Différence avec /api/download** : 
- Accepte une liste d'URLs
- Continue même si une vidéo échoue
- Retourne un rapport détaillé (succès/échecs)

### GET /api/download/{download_id}/{filename}

**But** : Servir le fichier téléchargé au navigateur.

```python
@app.get("/api/download/{download_id}/{filename}")
async def get_file(download_id: str, filename: str):
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type='application/octet-stream'
    )
```

**Pourquoi FileResponse ?**
- Streaming efficace (ne charge pas tout en mémoire)
- Headers corrects pour forcer le téléchargement
- Gestion automatique du Content-Length

### GET /api/download/{download_id}

**But** : Lister les fichiers disponibles dans un téléchargement.

```python
@app.get("/api/download/{download_id}")
async def list_files(download_id: str):
    files = glob.glob(f"{download_dir}/*")
    video_files = [f for f in files if not f.endswith(('.jpg', '.png', '.webp', '.vtt', '.srt'))]
    return {"files": video_files}
```

**Utilité** : Le frontend peut afficher la liste avant de déclencher les téléchargements.

---

## Choix techniques

### 1. Architecture REST vs WebSocket

**Choix** : REST synchrone

**Raison** : 
- Simplicité d'implémentation
- Les téléchargements sont relativement courts
- Pas besoin de bidirectionnel en temps réel

### 2. Stockage temporaire sur disque

**Choix** : `downloads/{uuid}/`

**Raison** :
- Isolation des téléchargements concurrents
- Facilité de nettoyage
- Compatibilité avec FileResponse

### 3. Formats génériques par défaut

**Choix** : `bestvideo+bestaudio/best` plutôt que format_id fixes

**Raison** :
- Fonctionne sur toutes les vidéos
- S'adapte automatiquement à la meilleure qualité disponible
- Évite l'erreur "Requested format is not available"

---

## Pistes d'amélioration

### 🔒 Sécurité

#### 1. Validation des URLs
```python
from urllib.parse import urlparse

ALLOWED_DOMAINS = ['youtube.com', 'youtu.be', 'www.youtube.com']

def validate_url(url: str) -> bool:
    parsed = urlparse(url)
    return parsed.netloc in ALLOWED_DOMAINS
```

#### 2. Rate Limiting
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.post("/api/info")
@limiter.limit("10/minute")
async def get_video_info(request: Request, video: VideoRequest):
    pass
```

#### 3. Restriction CORS en production
```python
allow_origins=["https://redstream.example.com"]
```

#### 4. Authentification
```python
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

security = HTTPBearer()

@app.post("/api/download")
async def download_video(
    request: DownloadRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials
    payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    # ...
```

### 🛡️ Protection du serveur

#### 1. Limite de taille des téléchargements
```python
MAX_VIDEO_SIZE = 2 * 1024 * 1024 * 1024  # 2 GB

ydl_opts = {
    'max_filesize': MAX_VIDEO_SIZE,
}
```

#### 2. Nettoyage automatique des fichiers
```python
from apscheduler.schedulers.background import BackgroundScheduler
import shutil
from datetime import datetime, timedelta

def cleanup_old_downloads():
    download_dir = "downloads"
    threshold = datetime.now() - timedelta(hours=1)
    
    for folder in os.listdir(download_dir):
        folder_path = os.path.join(download_dir, folder)
        if os.path.getmtime(folder_path) < threshold.timestamp():
            shutil.rmtree(folder_path)

scheduler = BackgroundScheduler()
scheduler.add_job(cleanup_old_downloads, 'interval', minutes=30)
scheduler.start()
```

#### 3. Limitation des téléchargements simultanés
```python
import asyncio

download_semaphore = asyncio.Semaphore(5)  # Max 5 téléchargements

@app.post("/api/download")
async def download_video(request: DownloadRequest):
    async with download_semaphore:
        # ... logique de téléchargement
```

#### 4. Sanitization des noms de fichiers
```python
import re

def sanitize_filename(filename: str) -> str:
    # Supprimer caractères dangereux
    return re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', filename)
```

### 🚀 Fonctionnalités

#### 1. Progression en temps réel (WebSocket)
```python
from fastapi import WebSocket

@app.websocket("/ws/download/{download_id}")
async def download_progress(websocket: WebSocket, download_id: str):
    await websocket.accept()
    
    def progress_hook(d):
        if d['status'] == 'downloading':
            asyncio.run(websocket.send_json({
                'percent': d.get('_percent_str', '0%'),
                'speed': d.get('_speed_str', 'N/A'),
                'eta': d.get('_eta_str', 'N/A')
            }))
    
    ydl_opts['progress_hooks'] = [progress_hook]
```

#### 2. File d'attente de téléchargement
```python
from celery import Celery

celery_app = Celery('tasks', broker='redis://localhost:6379')

@celery_app.task
def download_video_task(url, format_id, options):
    # Téléchargement en arrière-plan
    pass

@app.post("/api/download")
async def download_video(request: DownloadRequest):
    task = download_video_task.delay(request.url, request.format_id, {})
    return {"task_id": task.id}
```

#### 3. Cache des métadonnées
```python
from functools import lru_cache
import hashlib

@lru_cache(maxsize=100)
def get_cached_info(url_hash: str):
    # Retourne les infos mises en cache
    pass

@app.post("/api/info")
async def get_video_info(request: VideoRequest):
    url_hash = hashlib.md5(request.url.encode()).hexdigest()
    cached = get_cached_info(url_hash)
    if cached:
        return cached
    # ...
```

#### 4. Support multi-plateformes
```python
SUPPORTED_EXTRACTORS = [
    'youtube', 'vimeo', 'dailymotion', 'twitch', 
    'twitter', 'instagram', 'tiktok'
]

def detect_platform(url: str) -> str:
    for extractor in SUPPORTED_EXTRACTORS:
        if extractor in url:
            return extractor
    return 'unknown'
```

#### 5. Conversion de formats supplémentaires
```python
class ConversionRequest(BaseModel):
    download_id: str
    output_format: str  # mp4, webm, mkv, mp3, aac, flac

@app.post("/api/convert")
async def convert_file(request: ConversionRequest):
    # Utiliser FFmpeg pour la conversion
    pass
```

#### 6. API de statut et monitoring
```python
@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "active_downloads": len(os.listdir("downloads")),
        "disk_usage": shutil.disk_usage("downloads")
    }
```

---

## Résumé

Ce backend offre une API simple et efficace pour le téléchargement de vidéos YouTube. Les principaux points d'attention pour une mise en production sont :

1. **Sécurité** : Authentification, rate limiting, validation stricte
2. **Performance** : Cache, file d'attente, limites de concurrence
3. **Maintenance** : Nettoyage automatique, monitoring, logs structurés
4. **Scalabilité** : Workers Celery, stockage distribué (S3), load balancing

---

*Documentation générée pour RedStream DL v1.0.0*
