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

app = FastAPI(title="RedStream API")

# Configuration CORS pour autoriser le frontend React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En prod, remplacer par l'URL de ton frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Stockage des téléchargements en cours
downloads_status = {}

class VideoRequest(BaseModel):
    url: str

class DownloadRequest(BaseModel):
    url: str
    format_id: str
    extract_audio: bool = False
    include_thumbnail: bool = True
    include_subtitles: bool = False

class PlaylistDownloadRequest(BaseModel):
    urls: List[str]  # Liste des URLs des vidéos à télécharger
    format_id: str
    extract_audio: bool = False
    include_thumbnail: bool = True
    include_subtitles: bool = False

def format_error(e: Exception) -> dict:
    """Formate une erreur pour le frontend"""
    error_str = str(e)
    
    # Messages d'erreur plus clairs
    if "Requested format is not available" in error_str:
        return {
            "error": "Format non disponible",
            "detail": "Le format sélectionné n'est pas disponible pour cette vidéo. Essayez avec 'best' ou un autre format.",
            "code": "FORMAT_UNAVAILABLE"
        }
    elif "Video unavailable" in error_str:
        return {
            "error": "Vidéo indisponible",
            "detail": "Cette vidéo n'est pas accessible (privée, supprimée ou bloquée dans votre région).",
            "code": "VIDEO_UNAVAILABLE"
        }
    elif "Sign in" in error_str or "age" in error_str.lower():
        return {
            "error": "Restriction d'âge",
            "detail": "Cette vidéo nécessite une connexion pour vérifier l'âge.",
            "code": "AGE_RESTRICTED"
        }
    elif "No supported JavaScript runtime" in error_str:
        return {
            "error": "Runtime JS manquant",
            "detail": "Installez Node.js ou Deno pour un meilleur support YouTube.",
            "code": "JS_RUNTIME_MISSING"
        }
    else:
        return {
            "error": "Erreur de téléchargement",
            "detail": error_str[:200],  # Limiter la taille
            "code": "UNKNOWN_ERROR"
        }

@app.post("/api/info")
async def get_video_info(request: VideoRequest):
    """Récupère les métadonnées sans télécharger"""
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
        'extract_flat': False,
        'ignoreerrors': True,  # Ignorer les erreurs pour les playlists
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(request.url, download=False)
            
            if info is None:
                raise HTTPException(status_code=400, detail=format_error(Exception("Impossible d'extraire les informations")))
            
            # Vérifier si c'est une playlist
            is_playlist = 'entries' in info and info.get('entries')
            
            if is_playlist:
                # Traitement playlist
                entries = []
                playlist_formats = []
                
                for idx, entry in enumerate(info.get('entries', [])):
                    if entry is None:
                        continue
                    
                    # Extraire les formats de la première vidéo pour avoir une référence
                    if idx == 0 and entry.get('formats'):
                        for f in entry.get('formats', []):
                            if f.get('filesize') or f.get('filesize_approx') or f.get('format_note'):
                                playlist_formats.append({
                                    'format_id': f['format_id'],
                                    'ext': f['ext'],
                                    'resolution': f.get('resolution', 'audio only'),
                                    'filesize': f.get('filesize') or f.get('filesize_approx'),
                                    'fps': f.get('fps'),
                                    'vcodec': f.get('vcodec'),
                                    'acodec': f.get('acodec'),
                                    'note': f.get('format_note', '')
                                })
                    
                    # Construire l'URL de la vidéo
                    video_id = entry.get('id')
                    video_url = f"https://www.youtube.com/watch?v={video_id}" if video_id else entry.get('url', '')
                    
                    entries.append({
                        'id': video_id,
                        'title': entry.get('title', f'Vidéo {idx + 1}'),
                        'thumbnail': entry.get('thumbnail'),
                        'duration': entry.get('duration'),
                        'uploader': entry.get('uploader'),
                        'url': video_url,
                    })
                
                # Ajouter des formats génériques garantis
                generic_formats = [
                    {'format_id': 'bestvideo+bestaudio/best', 'ext': 'mp4', 'resolution': 'Meilleure qualité', 'filesize': None, 'fps': None, 'vcodec': 'auto', 'acodec': 'auto', 'note': 'Recommandé'},
                    {'format_id': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]', 'ext': 'mp4', 'resolution': '1080p max', 'filesize': None, 'fps': None, 'vcodec': 'auto', 'acodec': 'auto', 'note': ''},
                    {'format_id': 'bestvideo[height<=720]+bestaudio/best[height<=720]', 'ext': 'mp4', 'resolution': '720p max', 'filesize': None, 'fps': None, 'vcodec': 'auto', 'acodec': 'auto', 'note': ''},
                    {'format_id': 'bestvideo[height<=480]+bestaudio/best[height<=480]', 'ext': 'mp4', 'resolution': '480p max', 'filesize': None, 'fps': None, 'vcodec': 'auto', 'acodec': 'auto', 'note': ''},
                    {'format_id': 'bestaudio/best', 'ext': 'm4a', 'resolution': 'audio only', 'filesize': None, 'fps': None, 'vcodec': 'none', 'acodec': 'auto', 'note': 'Audio uniquement'},
                ]
                
                return {
                    "id": info.get('id'),
                    "title": info.get('title', 'Playlist'),
                    "thumbnail": info.get('thumbnail') or (entries[0]['thumbnail'] if entries else None),
                    "duration": sum(e.get('duration', 0) or 0 for e in entries),
                    "uploader": info.get('uploader') or (entries[0]['uploader'] if entries else None),
                    "is_playlist": True,
                    "playlist_count": len(entries),
                    "entries": entries,
                    "formats": generic_formats  # Utiliser les formats génériques pour les playlists
                }
            else:
                # Traitement vidéo simple
                formats = []
                for f in info.get('formats', []):
                    if f.get('filesize') or f.get('filesize_approx') or f.get('format_note'):
                        formats.append({
                            'format_id': f['format_id'],
                            'ext': f['ext'],
                            'resolution': f.get('resolution', 'audio only'),
                            'filesize': f.get('filesize') or f.get('filesize_approx'),
                            'fps': f.get('fps'),
                            'vcodec': f.get('vcodec'),
                            'acodec': f.get('acodec'),
                            'note': f.get('format_note', '')
                        })
                
                # Ajouter les formats génériques en premier
                generic_formats = [
                    {'format_id': 'bestvideo+bestaudio/best', 'ext': 'mp4', 'resolution': 'Meilleure qualité', 'filesize': None, 'fps': None, 'vcodec': 'auto', 'acodec': 'auto', 'note': 'Recommandé'},
                    {'format_id': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]', 'ext': 'mp4', 'resolution': '1080p max', 'filesize': None, 'fps': None, 'vcodec': 'auto', 'acodec': 'auto', 'note': ''},
                    {'format_id': 'bestvideo[height<=720]+bestaudio/best[height<=720]', 'ext': 'mp4', 'resolution': '720p max', 'filesize': None, 'fps': None, 'vcodec': 'auto', 'acodec': 'auto', 'note': ''},
                    {'format_id': 'bestaudio/best', 'ext': 'm4a', 'resolution': 'audio only', 'filesize': None, 'fps': None, 'vcodec': 'none', 'acodec': 'auto', 'note': 'Audio uniquement'},
                ]
                
                return {
                    "id": info.get('id'),
                    "title": info.get('title'),
                    "thumbnail": info.get('thumbnail'),
                    "duration": info.get('duration'),
                    "uploader": info.get('uploader'),
                    "is_playlist": False,
                    "formats": generic_formats + formats
                }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=format_error(e))

@app.post("/api/download")
async def download_video(request: DownloadRequest):
    """Lance le téléchargement et retourne le fichier"""
    download_id = str(uuid.uuid4())
    download_dir = f"downloads/{download_id}"
    os.makedirs(download_dir, exist_ok=True)
    
    output_template = f"{download_dir}/%(title)s.%(ext)s"

    # Utiliser un format sûr si le format demandé pose problème
    format_spec = request.format_id if request.format_id else 'bestvideo+bestaudio/best'
    
    ydl_opts = {
        'format': format_spec,
        'outtmpl': output_template,
        'writethumbnail': request.include_thumbnail,
        'writesubtitles': request.include_subtitles,
        'quiet': True,
        'no_warnings': True,
        'merge_output_format': 'mp4',  # Fusionner en MP4
        'postprocessors': [{
            'key': 'FFmpegVideoConvertor',
            'preferedformat': 'mp4',
        }] if not request.extract_audio else [],
    }

    if request.extract_audio:
        ydl_opts.update({
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
        })

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([request.url])
        
        # Trouver le fichier téléchargé
        files = glob.glob(f"{download_dir}/*")
        video_files = [f for f in files if not f.endswith(('.jpg', '.png', '.webp', '.vtt', '.srt'))]
        
        if not video_files:
            raise HTTPException(status_code=500, detail=format_error(Exception("Fichier non trouvé après téléchargement")))
        
        file_path = video_files[0]
        filename = os.path.basename(file_path)
        
        return {"status": "completed", "download_id": download_id, "filename": filename}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=format_error(e))

@app.post("/api/download/playlist")
async def download_playlist(request: PlaylistDownloadRequest):
    """Télécharge plusieurs vidéos d'une playlist"""
    download_id = str(uuid.uuid4())
    download_dir = f"downloads/{download_id}"
    os.makedirs(download_dir, exist_ok=True)
    
    results = []
    errors = []
    
    format_spec = request.format_id if request.format_id else 'bestvideo+bestaudio/best'
    
    for url in request.urls:
        output_template = f"{download_dir}/%(title)s.%(ext)s"
        
        ydl_opts = {
            'format': format_spec,
            'outtmpl': output_template,
            'writethumbnail': request.include_thumbnail,
            'writesubtitles': request.include_subtitles,
            'quiet': True,
            'no_warnings': True,
            'merge_output_format': 'mp4',
            'ignoreerrors': True,
        }

        if request.extract_audio:
            ydl_opts.update({
                'format': 'bestaudio/best',
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
            })

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
            results.append({"url": url, "status": "success"})
        except Exception as e:
            errors.append({"url": url, "error": str(e)[:100]})
    
    # Lister tous les fichiers téléchargés
    files = glob.glob(f"{download_dir}/*")
    video_files = [os.path.basename(f) for f in files if not f.endswith(('.jpg', '.png', '.webp', '.vtt', '.srt'))]
    
    return {
        "status": "completed",
        "download_id": download_id,
        "files": video_files,
        "success_count": len(results),
        "error_count": len(errors),
        "errors": errors
    }

@app.get("/api/download/{download_id}/{filename}")
async def get_file(download_id: str, filename: str):
    """Télécharge le fichier vers le navigateur"""
    file_path = f"downloads/{download_id}/{filename}"
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=format_error(Exception("Fichier non trouvé")))
    
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type='application/octet-stream'
    )

@app.get("/api/download/{download_id}")
async def list_files(download_id: str):
    """Liste les fichiers disponibles dans un téléchargement"""
    download_dir = f"downloads/{download_id}"
    
    if not os.path.exists(download_dir):
        raise HTTPException(status_code=404, detail=format_error(Exception("Téléchargement non trouvé")))
    
    files = glob.glob(f"{download_dir}/*")
    video_files = [os.path.basename(f) for f in files if not f.endswith(('.jpg', '.png', '.webp', '.vtt', '.srt'))]
    
    return {"files": video_files}

