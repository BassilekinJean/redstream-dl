import React, { useState } from 'react';
import {
  Download,
  Search,
  Youtube,
  Music,
  Film,
  FileText,
  Image as ImageIcon,
  Settings,
  List,
  Check,
  AlertCircle,
  Loader2,
  Play,
  X,
  Folder,
  Globe,
  Monitor
} from 'lucide-react';

// Configuration API - utilise l'URL relative en production (Docker)
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// --- Mock Data (Reste inchangé) ---
const MOCK_VIDEO_DATA = {
  id: "dQw4w9WgXcQ",
  title: "Rick Astley - Never Gonna Give You Up (Official Music Video)",
  uploader: "Rick Astley",
  duration: 212,
  view_count: 1402938421,
  thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
  description: "The official video for “Never Gonna Give You Up” by Rick Astley...",
  formats: [
    { format_id: "137", ext: "mp4", resolution: "1080p", note: "High Quality", filesize: 45000000, fps: 30, vcodec: "avc1" },
    { format_id: "22", ext: "mp4", resolution: "720p", note: "Medium Quality", filesize: 22000000, fps: 30, vcodec: "avc1" },
    { format_id: "18", ext: "mp4", resolution: "360p", note: "Low Quality", filesize: 8000000, fps: 30, vcodec: "avc1" },
    { format_id: "140", ext: "m4a", resolution: "audio only", note: "Medium Audio", filesize: 3000000, acodec: "mp4a" },
    { format_id: "251", ext: "webm", resolution: "audio only", note: "High Audio", filesize: 3500000, acodec: "opus" },
  ],
  subtitles: {
    en: [{ ext: "vtt" }, { ext: "srv3" }],
    fr: [{ ext: "vtt" }]
  }
};

const MOCK_PLAYLIST_DATA = {
  ...MOCK_VIDEO_DATA,
  is_playlist: true,
  playlist_title: "80s Hits Collection",
  playlist_count: 12,
  title: "80s Hits Collection (Playlist)"
};

// --- Composants UI ---

const Badge = ({ children, className }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
    {children}
  </span>
);

const Card = ({ children, className }) => (
  <div className={`bg-neutral-900/80 border border-neutral-800 backdrop-blur-sm rounded-xl overflow-hidden ${className}`}>
    {children}
  </div>
);

const Button = ({ children, onClick, variant = 'primary', className, disabled, icon: Icon }) => {
  const baseStyle = "flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-300 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white shadow-lg shadow-red-900/30",
    secondary: "bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700",
    outline: "border border-red-600/50 text-red-500 hover:bg-red-900/10",
    ghost: "text-neutral-400 hover:text-white hover:bg-neutral-800"
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`}>
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
};

// --- Modal Paramètres ---
const SettingsModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-neutral-900 border border-neutral-800 w-full max-w-lg rounded-2xl shadow-2xl shadow-red-900/20 overflow-hidden animate-fade-in-up z-50">
        <div className="flex items-center justify-between p-6 border-b border-neutral-800">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Settings className="text-red-500" /> Paramètres yt-dlp
          </h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Section Dossier */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300 flex items-center gap-2">
              <Folder size={16} /> Dossier de téléchargement
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                defaultValue="C:/Users/Downloads/RedStream"
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-400 focus:outline-none focus:border-red-500/50 transition-colors"
              />
              <Button variant="secondary" className="!px-3 !py-2">Parcourir</Button>
            </div>
          </div>

          {/* Section Qualité par défaut */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300 flex items-center gap-2">
              <Monitor size={16} /> Qualité vidéo par défaut
            </label>
            <select className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-red-500/50 transition-colors">
              <option>Toujours demander (Recommandé)</option>
              <option>Meilleure (Best Video + Best Audio)</option>
              <option>1080p</option>
              <option>720p</option>
              <option>480p</option>
            </select>
          </div>

          {/* Section Proxy */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300 flex items-center gap-2">
              <Globe size={16} /> Proxy / VPN (Optionnel)
            </label>
            <input
              type="text"
              placeholder="http://user:pass@proxy:port"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-red-500/50 transition-colors"
            />
          </div>

          <div className="pt-4 border-t border-neutral-800">
            <label className="flex items-center justify-between cursor-pointer group">
              <span className="text-sm text-neutral-300 group-hover:text-white transition-colors">Activer le mode sombre forcé</span>
              <div className="w-10 h-6 bg-red-600 rounded-full relative">
                <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full shadow-sm" />
              </div>
            </label>
          </div>
        </div>

        <div className="p-4 bg-neutral-950 border-t border-neutral-800 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} className="!py-2">Annuler</Button>
          <Button onClick={onClose} className="!py-2">Sauvegarder</Button>
        </div>
      </div>
    </div>
  );
};


export default function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [mode, setMode] = useState('video'); // video, audio
  const [selectedFormat, setSelectedFormat] = useState(null);
  const [options, setOptions] = useState({
    thumbnail: true,
    subtitles: false,
    metadata: true
  });
  const [downloadStatus, setDownloadStatus] = useState(null); // idle, downloading, completed
  const [error, setError] = useState(null);
  
  // États pour les playlists
  const [selectedVideos, setSelectedVideos] = useState(new Set());

  // NOUVEAU: État pour la modale
  const [showSettings, setShowSettings] = useState(false);

  // Quand les données changent, sélectionner toutes les vidéos par défaut
  React.useEffect(() => {
    if (data?.is_playlist && data?.entries) {
      const allIds = new Set(data.entries.map(e => e.id));
      setSelectedVideos(allIds);
    }
  }, [data]);

  const toggleVideoSelection = (videoId) => {
    setSelectedVideos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(videoId)) {
        newSet.delete(videoId);
      } else {
        newSet.add(videoId);
      }
      return newSet;
    });
  };

  const toggleAllVideos = () => {
    if (!data?.entries) return;
    if (selectedVideos.size === data.entries.length) {
      setSelectedVideos(new Set());
    } else {
      setSelectedVideos(new Set(data.entries.map(e => e.id)));
    }
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setData(null);
    setDownloadStatus(null);
    setSelectedFormat(null);
    setError(null);
    setSelectedVideos(new Set());

    try {
      const response = await fetch(`${API_BASE_URL}/api/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errData = await response.json();
        const errorMsg = errData.detail?.error || errData.detail?.detail || errData.detail || 'Erreur lors de la récupération des infos';
        throw new Error(errorMsg);
      }

      const result = await response.json();
      setData(result);
      
      // Pré-sélectionner le premier format
      if (result.formats && result.formats.length > 0) {
        setSelectedFormat(result.formats[0].format_id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!selectedFormat || !data) return;

    setDownloadStatus('downloading');
    setError(null);
    
    try {
      let response;
      
      if (data.is_playlist && selectedVideos.size > 0) {
        // Téléchargement de playlist
        const selectedUrls = data.entries
          .filter(e => selectedVideos.has(e.id))
          .map(e => e.url);
        
        response = await fetch(`${API_BASE_URL}/api/download/playlist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            urls: selectedUrls,
            format_id: selectedFormat,
            extract_audio: mode === 'audio',
            include_thumbnail: options.thumbnail,
            include_subtitles: options.subtitles
          }),
        });
      } else {
        // Téléchargement simple
        response = await fetch(`${API_BASE_URL}/api/download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: url,
            format_id: selectedFormat,
            extract_audio: mode === 'audio',
            include_thumbnail: options.thumbnail,
            include_subtitles: options.subtitles
          }),
        });
      }

      if (!response.ok) {
        const errData = await response.json();
        const errorMsg = errData.detail?.error || errData.detail?.detail || errData.detail || 'Erreur de téléchargement';
        throw new Error(errorMsg);
      }

      const result = await response.json();
      
      if (result.status === 'completed') {
        if (result.files && result.files.length > 0) {
          // Playlist: télécharger chaque fichier
          for (const filename of result.files) {
            const downloadUrl = `${API_BASE_URL}/api/download/${result.download_id}/${encodeURIComponent(filename)}`;
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            await new Promise(r => setTimeout(r, 500)); // Petit délai entre les téléchargements
          }
        } else if (result.filename) {
          // Vidéo simple
          const downloadUrl = `${API_BASE_URL}/api/download/${result.download_id}/${encodeURIComponent(result.filename)}`;
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = result.filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
        
        setDownloadStatus('completed');
        setTimeout(() => setDownloadStatus(null), 3000);
      }

    } catch (err) {
      setError(err.message);
      setDownloadStatus(null);
    }
  };

  const toggleOption = (key) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Traitement des formats (Deduplication + Label 1080p etc)
  const processedFormats = React.useMemo(() => {
    if (!data || !data.formats) return [];

    if (mode === 'audio') {
      return data.formats.filter(f => f.resolution === 'audio only' || f.vcodec === 'none');
    }

    // Video processing - inclure les formats génériques
    const videoFormats = data.formats.filter(f => f.vcodec !== 'none' && f.resolution !== 'audio only');
    const uniqueFormats = {};

    videoFormats.forEach(f => {
      let label = f.resolution;
      // Convertir 1920x1080 -> 1080p si nécessaire
      const match = f.resolution.match(/[0-9]+x([0-9]+)/);
      if (match) {
        label = match[1] + 'p';
      }
      
      // Garder ce format (priorité aux formats génériques puis à la meilleure qualité)
      if (!uniqueFormats[label] || f.note === 'Recommandé' || (f.filesize && f.filesize > (uniqueFormats[label].filesize || 0))) {
        uniqueFormats[label] = { ...f, displayResolution: label };
      }
    });

    // Trier : formats génériques en premier, puis par résolution décroissante
    return Object.values(uniqueFormats).sort((a, b) => {
      if (a.note === 'Recommandé') return -1;
      if (b.note === 'Recommandé') return 1;
      const valA = parseInt(a.displayResolution) || 0;
      const valB = parseInt(b.displayResolution) || 0;
      return valB - valA;
    });
  }, [data, mode]);

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-red-500/30 selection:text-red-200">

      {/* Background Ambience */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-red-600/10 rounded-full blur-[100px]" />
      </div>

      {/* --- Container Plein Écran Desktop, Responsive Mobile --- */}
      <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-6 sm:py-8 max-w-[1920px] mx-auto">

        {/* Header */}
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-red-600 to-black p-2.5 rounded-lg border border-red-500/30 shadow-red-500/20 shadow-lg">
              <Youtube className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-neutral-400">
                RedStream <span className="text-red-600">DL</span>
              </h1>
              <p className="text-xs text-neutral-500 uppercase tracking-widest">Powered by <a href="https://github.com/BassilekinJean">BassilekinJean</a></p>
            </div>
          </div>
          <div className="flex gap-4">
            {/* --- MODIFICATION ICI : Bouton Settings actif --- */}
            <button
              onClick={() => setShowSettings(true)}
              className="text-neutral-400 hover:text-white transition-colors hover:bg-neutral-800 p-2 rounded-full cursor-pointer"
            >
              <Settings size={24} />
            </button>
          </div>
        </header>

        {/* Modal Paramètres */}
        <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

        {/* Search Hero */}
        <div className="text-center mb-8 sm:mb-12 space-y-4 sm:space-y-6">
          <h2 className="text-2xl sm:text-4xl md:text-6xl font-black tracking-tight mb-2 sm:mb-4">
            Téléchargez sans <span className="text-red-600">limites</span>.
          </h2>
          <p className="text-neutral-400 max-w-2xl mx-auto text-sm sm:text-lg md:text-xl px-4">
            Un outil puissant pour extraire vidéos, playlists et audios en haute qualité.
          </p>

          <form onSubmit={handleAnalyze} className="relative max-w-3xl mx-auto group mt-4 sm:mt-8 px-2 sm:px-0">
            <div className="absolute inset-0 bg-red-600 rounded-xl blur opacity-20 group-hover:opacity-30 transition-opacity duration-500"></div>
            <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center bg-neutral-900 border border-neutral-700 rounded-xl overflow-hidden focus-within:border-red-500/50 focus-within:ring-2 focus-within:ring-red-500/20 transition-all shadow-2xl">
              <div className="flex items-center flex-1">
                <div className="pl-4 sm:pl-6 text-neutral-500">
                  <Search size={20} className="sm:w-6 sm:h-6" />
                </div>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Collez votre lien YouTube ici..."
                  className="w-full bg-transparent px-3 sm:px-4 py-4 sm:py-6 text-sm sm:text-lg text-white placeholder-neutral-500 focus:outline-none"
                />
              </div>
              <div className="p-2 sm:pr-2">
                <Button
                  type="submit"
                  disabled={loading || !url}
                  className="w-full sm:w-auto !py-2.5 sm:!py-3 !px-6 sm:!px-8 text-sm sm:text-lg"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : 'Analyser'}
                </Button>
              </div>
            </div>
          </form>

          {error && (
            <div className="max-w-3xl mx-auto mt-4 p-4 bg-red-900/20 border border-red-500/50 rounded-xl flex items-start gap-3 text-red-200 animate-fade-in-up">
              <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
              <div className="flex-grow">
                <p className="font-medium">Erreur</p>
                <p className="text-sm text-red-300/80 mt-1">{typeof error === 'object' ? JSON.stringify(error) : error}</p>
              </div>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
          )}
        </div>

        {/* Results Section - Plus large */}
        {data && (
          <div className="animate-fade-in-up space-y-8 w-full">

            {/* Main Content Card */}
            <Card className="flex flex-col lg:flex-row gap-0 overflow-hidden shadow-2xl">
              {/* Thumbnail Area */}
              <div className="relative w-full lg:w-5/12 xl:w-4/12 min-h-[200px] sm:min-h-[250px] lg:min-h-[350px]">
                <img
                  src={data.thumbnail}
                  alt="Thumbnail"
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity absolute inset-0"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6">
                  <Badge className="bg-red-600 text-white mb-2 sm:mb-3 inline-block shadow-lg shadow-red-900/40">
                    {data.is_playlist ? 'PLAYLIST' : 'VIDEO'}
                  </Badge>
                  <h3 className="font-bold text-lg sm:text-2xl md:text-3xl leading-tight line-clamp-2 sm:line-clamp-3 mb-2 sm:mb-4 text-shadow">{data.title}</h3>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm sm:text-base text-neutral-300">
                    <span className="flex items-center gap-2 font-medium"><Play size={14} className="sm:w-4 sm:h-4" /> {data.uploader || 'Inconnu'}</span>
                    <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-neutral-500 rounded-full"></span>
                    <span className="font-mono">{data.duration ? `${Math.floor(data.duration / 60)}:${(data.duration % 60).toString().padStart(2, '0')}` : 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Controls Area */}
              <div className="p-4 sm:p-6 w-full lg:w-7/12 xl:w-8/12 flex flex-col bg-neutral-900/40">

                {/* Mode Tabs */}
                <div className="flex p-1 bg-neutral-950 rounded-lg mb-6 self-start border border-neutral-800">
                  <button
                    onClick={() => setMode('video')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${mode === 'video' ? 'bg-neutral-800 text-white shadow-md' : 'text-neutral-500 hover:text-neutral-300'}`}
                  >
                    <Film size={16} /> Vidéo
                  </button>
                  <button
                    onClick={() => setMode('audio')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${mode === 'audio' ? 'bg-neutral-800 text-white shadow-md' : 'text-neutral-500 hover:text-neutral-300'}`}
                  >
                    <Music size={16} /> Audio
                  </button>
                </div>

                {/* Format Selection Grid */}
                <div className="mb-4 sm:mb-6 flex-grow">
                  <h4 className="text-xs font-bold text-neutral-500 mb-2 sm:mb-3 uppercase tracking-wider flex items-center gap-2">
                    <Settings size={12} /> Formats Disponibles
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 max-h-[200px] sm:max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {processedFormats.map((fmt) => (
                        <div
                          key={fmt.format_id}
                          onClick={() => setSelectedFormat(fmt.format_id)}
                          className={`
                          cursor-pointer p-2 sm:p-3 rounded-lg border text-left transition-all relative overflow-hidden group hover:scale-[1.02] active:scale-[0.98]
                          ${selectedFormat === fmt.format_id
                              ? 'bg-red-900/10 border-red-500 ring-1 ring-red-500/50'
                              : 'bg-neutral-800/40 border-neutral-700/50 hover:border-neutral-500 hover:bg-neutral-800'}
                        `}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className={`font-bold text-sm sm:text-base ${selectedFormat === fmt.format_id ? 'text-red-500' : 'text-white'}`}>
                              {fmt.displayResolution || fmt.resolution}
                            </span>
                            {fmt.fps && <span className="text-[9px] sm:text-[10px] bg-black/40 border border-white/10 text-neutral-400 px-1 sm:px-1.5 py-0.5 rounded backdrop-blur-md">{fmt.fps}fps</span>}
                          </div>
                          <div className="flex justify-between items-end text-[9px] sm:text-[10px] text-neutral-500 font-mono">
                            <span>{fmt.ext.toUpperCase()}</span>
                            <span>{fmt.filesize ? (fmt.filesize / 1024 / 1024).toFixed(1) + ' MB' : 'N/A'}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Additional Options (Toggles) */}
                <div className="flex flex-wrap gap-3 sm:gap-4 mb-4 sm:mb-6 pt-3 sm:pt-4 border-t border-neutral-800/50">
                  <label className="flex items-center gap-2 sm:gap-3 cursor-pointer group select-none">
                    <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md border flex items-center justify-center transition-all ${options.thumbnail ? 'bg-red-600 border-red-600 shadow-sm shadow-red-900/50' : 'border-neutral-600 bg-neutral-900 group-hover:border-neutral-400'}`} onClick={() => toggleOption('thumbnail')}>
                      {options.thumbnail && <Check size={14} className="text-white" />}
                    </div>
                    <span className="text-sm sm:text-base text-neutral-300 group-hover:text-white flex items-center gap-1 sm:gap-2"><ImageIcon size={16} className="text-neutral-500 hidden sm:block" /> Miniature</span>
                  </label>

                  <label className="flex items-center gap-2 sm:gap-3 cursor-pointer group select-none">
                    <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md border flex items-center justify-center transition-all ${options.subtitles ? 'bg-red-600 border-red-600 shadow-sm shadow-red-900/50' : 'border-neutral-600 bg-neutral-900 group-hover:border-neutral-400'}`} onClick={() => toggleOption('subtitles')}>
                      {options.subtitles && <Check size={14} className="text-white" />}
                    </div>
                    <span className="text-sm sm:text-base text-neutral-300 group-hover:text-white flex items-center gap-1 sm:gap-2"><FileText size={16} className="text-neutral-500 hidden sm:block" /> Sous-titres</span>
                  </label>
                </div>

                {/* Action Button */}
                <div className="mt-auto">
                  {downloadStatus === 'downloading' ? (
                    <div className="bg-neutral-800/50 rounded-xl p-4 sm:p-6 border border-neutral-700/50 backdrop-blur-sm">
                      <div className="flex justify-between text-xs sm:text-sm text-neutral-300 mb-2 sm:mb-3 font-medium">
                        <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin text-red-500" /> Téléchargement...</span>
                      </div>
                      <div className="w-full bg-neutral-900 rounded-full h-2 sm:h-3 overflow-hidden border border-white/5">
                        <div className="bg-gradient-to-r from-red-800 to-red-500 h-full rounded-full animate-pulse w-full shadow-lg shadow-red-900/50"></div>
                      </div>
                    </div>
                  ) : downloadStatus === 'completed' ? (
                    <Button className="w-full !bg-green-600 hover:!bg-green-500 !shadow-green-900/30 !py-3 sm:!py-4 text-base sm:text-lg" icon={Check}>
                      Téléchargement terminé
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleDownload} 
                      className="w-full !py-3 sm:!py-4 text-base sm:text-lg shadow-red-900/40" 
                      icon={Download} 
                      disabled={!selectedFormat || (data.is_playlist && selectedVideos.size === 0)}
                    >
                      {data.is_playlist ? `Télécharger ${selectedVideos.size} vidéo(s)` : 'Télécharger'}
                    </Button>
                  )}
                </div>

              </div>
            </Card>

            {/* Playlist Specific UI */}
            {data.is_playlist && data.entries && (
              <Card className="p-4 sm:p-6 lg:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <h3 className="text-lg sm:text-xl font-bold flex items-center gap-3">
                    <List className="text-red-500" /> Contenu de la Playlist
                    <Badge className="bg-neutral-800 text-neutral-400 text-sm py-1 px-3 border border-neutral-700">
                      {selectedVideos.size}/{data.playlist_count} sélectionnées
                    </Badge>
                  </h3>
                  <Button 
                    variant="outline" 
                    className="text-sm"
                    onClick={toggleAllVideos}
                  >
                    {selectedVideos.size === data.entries.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                  </Button>
                </div>
                <div className="space-y-2 sm:space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {data.entries.map((entry, i) => {
                    const isSelected = selectedVideos.has(entry.id);
                    return (
                      <div 
                        key={entry.id || i} 
                        onClick={() => toggleVideoSelection(entry.id)}
                        className={`flex items-center gap-3 sm:gap-6 p-3 sm:p-4 rounded-xl transition-all cursor-pointer border ${
                          isSelected 
                            ? 'bg-red-900/10 border-red-500/50 hover:border-red-500' 
                            : 'bg-neutral-800/20 border-transparent hover:bg-neutral-800/40 hover:border-neutral-700'
                        }`}
                      >
                        <div className="text-neutral-600 font-mono text-base sm:text-lg w-6 sm:w-8 text-center flex-shrink-0">{i + 1}</div>
                        <div className="w-16 sm:w-24 h-10 sm:h-14 bg-neutral-800 rounded-lg overflow-hidden shadow-md flex-shrink-0">
                          <img 
                            src={entry.thumbnail || `https://picsum.photos/seed/${i}/160/90`} 
                            className={`w-full h-full object-cover transition-opacity ${isSelected ? 'opacity-100' : 'opacity-60'}`} 
                            alt={entry.title} 
                          />
                        </div>
                        <div className="flex-grow min-w-0">
                          <div className={`text-sm sm:text-base font-medium transition-colors truncate ${isSelected ? 'text-white' : 'text-neutral-400'}`}>
                            {entry.title}
                          </div>
                          <div className="text-xs text-neutral-500 mt-1 flex gap-2">
                            <span className="bg-neutral-900 px-1.5 rounded text-neutral-400">
                              {entry.duration ? `${Math.floor(entry.duration / 60)}:${(entry.duration % 60).toString().padStart(2, '0')}` : 'N/A'}
                            </span>
                          </div>
                        </div>
                        <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md border flex items-center justify-center transition-all flex-shrink-0 ${
                          isSelected 
                            ? 'bg-red-600 border-red-600' 
                            : 'border-neutral-600 bg-neutral-900'
                        }`}>
                          {isSelected && <Check size={14} className="text-white" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

          </div>
        )}

      </div>

      <footer className="fixed bottom-4 left-0 right-0 text-center pointer-events-none z-0">
        <p className="text-neutral-800 text-xs font-mono opacity-50">REDSTREAM v1.0.0 • DESIGNED FOR PERFORMANCE</p>
      </footer>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(20, 20, 20, 0.3);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(60, 60, 60, 0.5);
          border-radius: 4px;
          border: 2px solid rgba(0,0,0,0);
          background-clip: padding-box;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(220, 38, 38, 0.5);
        }
        .text-shadow {
          text-shadow: 0 2px 10px rgba(0,0,0,0.8);
        }
      `}</style>
    </div>
  );
}