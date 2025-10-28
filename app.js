// app.js - VERSIÓN COMPLETA CORREGIDA

// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyD_jPhRhjQBnozVPlJmPxQlzFvuVkzn66k",
    authDomain: "pagina-musica-25879.firebaseapp.com",
    projectId: "pagina-musica-25879",
    storageBucket: "pagina-musica-25879.firebasestorage.app",
    messagingSenderId: "287662125263",
    appId: "1:287662125263:web:80500af19c46b495d607ba",
};

// 🎯 Tu URL de la aplicación web de Google Apps Script
const GAS_UPLOAD_URL = 'https://script.google.com/macros/s/AKfycbxeyAjnPcofggJB8iixV9QjMo3Qtwels-a9QC1tGgRHUtoWO9S8pFHCEZrlQ__8Ay-t/exec';

// Inicializar Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Variables globales
let songs = [];
let currentSongIndex = -1;
let audioPlayer = new Audio();
let isPlaying = false;
let isLoading = false;
let currentUser = null;

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎵 Iniciando MusicStream...');
    initApp();
});

async function initApp() {
    try {
        await checkFirebaseAuthState();
        setupEventListeners();
        loadSongsFromLocalStorage();
        testGASConnection();
        console.log('✅ App inicializada correctamente');
    } catch (error) {
        console.error('❌ Error inicializando app:', error);
    }
}

// ========== FIREBASE AUTH ==========
async function checkFirebaseAuthState() {
    auth.onAuthStateChanged((user) => {
        console.log('🔐 Estado de autenticación:', user ? 'Conectado' : 'Desconectado');
        if (user) {
            currentUser = user;
            showMainContent();
            updateUserProfile();
            console.log('✅ Usuario autenticado:', user.displayName);
        } else {
            currentUser = null;
            showLoginSection();
            console.log('🔐 No hay usuario autenticado');
        }
    });
}

async function signInWithGoogle() {
    try {
        showLoading(true, 'Iniciando sesión con Google...');
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/drive.file');
        const result = await auth.signInWithPopup(provider);
        console.log('✅ Login exitoso:', result.user.displayName);
        showNotification('¡Bienvenido ' + result.user.displayName + '!', 'success');
    } catch (error) {
        console.error('❌ Error iniciando sesión:', error);
        showNotification('Error al iniciar sesión: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function signOut() {
    try {
        showLoading(true, 'Cerrando sesión...');
        await auth.signOut();
        currentUser = null;
        showLoginSection();
        showNotification('Sesión cerrada exitosamente', 'success');
        audioPlayer.pause();
        isPlaying = false;
        updatePlayButton();
    } catch (error) {
        console.error('❌ Error cerrando sesión:', error);
        showNotification('Error al cerrar sesión', 'error');
    } finally {
        showLoading(false);
    }
}

// ========== INTERFAZ DE USUARIO ==========
function showLoginSection() {
    console.log('👤 Mostrando sección de login');
    document.getElementById('login-section').classList.remove('hidden');
    document.getElementById('main-content').classList.add('hidden');
    document.getElementById('login-btn').classList.add('hidden');
    document.getElementById('logout-btn').classList.add('hidden');
    document.getElementById('user-profile').classList.add('hidden');
}

function showMainContent() {
    console.log('🏠 Mostrando contenido principal');
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('main-content').classList.remove('hidden');
    document.getElementById('login-btn').classList.add('hidden');
    document.getElementById('logout-btn').classList.remove('hidden');
    document.getElementById('user-profile').classList.remove('hidden');
    showHomeSection();
}

function updateUserProfile() {
    if (!currentUser) return;
    const userProfile = document.getElementById('user-profile');
    userProfile.innerHTML = `
        <img src="${currentUser.photoURL || 'https://www.gravatar.com/avatar/?d=mp'}" 
             alt="Avatar" class="user-avatar">
        <span>${currentUser.displayName || currentUser.email}</span>
    `;
}

function setupEventListeners() {
    console.log('🔧 Configurando event listeners...');
    
    // Auth
    document.getElementById('google-login').addEventListener('click', signInWithGoogle);
    document.getElementById('login-btn').addEventListener('click', showLoginSection);
    document.getElementById('logout-btn').addEventListener('click', signOut);
    
    // Navegación
    document.getElementById('home-link').addEventListener('click', showHomeSection);
    document.getElementById('upload-link').addEventListener('click', showUploadSection);
    document.getElementById('stats-link').addEventListener('click', showStats);
    
    // Búsqueda y filtros
    document.getElementById('search-btn').addEventListener('click', performSearch);
    document.getElementById('search-input').addEventListener('input', performSearch);
    document.getElementById('genre-filter').addEventListener('change', performSearch);
    
    // Upload
    document.getElementById('upload-form').addEventListener('submit', handleUpload);
    
    // Reproductor
    document.getElementById('play-btn').addEventListener('click', togglePlay);
    document.getElementById('prev-btn').addEventListener('click', playPrevious);
    document.getElementById('next-btn').addEventListener('click', playNext);
    document.getElementById('volume-slider').addEventListener('input', setVolume);
    
    // Eventos de audio
    audioPlayer.addEventListener('loadedmetadata', updateDuration);
    audioPlayer.addEventListener('timeupdate', updateProgress);
    audioPlayer.addEventListener('ended', playNext);
    audioPlayer.addEventListener('error', handleAudioError);
    
    const progressBar = document.querySelector('.progress-bar');
    if (progressBar) {
        progressBar.addEventListener('click', seek);
    }
    
    console.log('✅ Event listeners configurados');
}

// ========== TEST CONEXIÓN GOOGLE APPS SCRIPT ==========
async function testGASConnection() {
    try {
        console.log('🔗 Probando conexión con Google Apps Script...');
        const response = await fetch(GAS_UPLOAD_URL);
        const result = await response.json();
        console.log('✅ Conexión GAS exitosa:', result);
        showNotification('Conexión con Google Drive establecida', 'success');
    } catch (error) {
        console.error('❌ Error conectando con GAS:', error);
        showNotification('Advertencia: No se pudo conectar con Google Drive', 'warning');
    }
}

// ========== GOOGLE APPS SCRIPT UPLOAD ==========
async function handleUpload(e) {
    e.preventDefault();
    console.log('📤 Iniciando subida de archivo...');
    
    if (!currentUser) {
        showNotification('❌ Debes iniciar sesión para subir canciones', 'error');
        showLoginSection();
        return;
    }

    const fileInput = document.getElementById('song-file');
    const coverInput = document.getElementById('song-cover');
    const songName = document.getElementById('song-name').value.trim();
    const artistName = document.getElementById('artist-name').value.trim();
    const songGenre = document.getElementById('song-genre').value;
    
    const audioFile = fileInput.files[0];

    if (!audioFile) {
        showNotification('❌ Selecciona un archivo de audio', 'error');
        return;
    }

    if (!songName || !artistName || !songGenre) {
        showNotification('❌ Completa todos los campos requeridos', 'error');
        return;
    }

    // Validar tipo de archivo
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac'];
    if (!validTypes.includes(audioFile.type)) {
        showNotification('❌ Formato de audio no soportado. Usa MP3, WAV, OGG o AAC', 'error');
        return;
    }

    try {
        showLoading(true, '📤 Subiendo canción a Google Drive...');
        const submitBtn = document.querySelector('.btn-upload');
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Subiendo...';
        submitBtn.style.opacity = '0.7';

        // Subir a Google Apps Script
        const result = await uploadToGoogleScript(audioFile, coverInput.files[0], songName, artistName, songGenre);

        // Guardar metadata de la canción
        await saveSongToLibrary(
            result.downloadUrl, 
            result.coverUrl, 
            songName, 
            artistName, 
            songGenre, 
            audioFile, 
            result.driveId
        );
        
        showNotification('🎉 ¡Canción subida exitosamente a Google Drive!', 'success');
        document.getElementById('upload-form').reset();

    } catch (error) {
        console.error('❌ Error con Apps Script/Drive:', error);
        
        // Fallback a localStorage si falla la subida a GAS
        showNotification(`⚠️ Fallo en la subida a Drive. Usando almacenamiento local. Error: ${error.message}`, 'warning');
        await handleLocalUpload(audioFile, coverInput.files[0], songName, artistName, songGenre);
    } finally {
        showLoading(false);
        const submitBtn = document.querySelector('.btn-upload');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '🚀 Subir Canción';
            submitBtn.style.opacity = '1';
        }
    }
}

async function uploadToGoogleScript(audioFile, coverFile, songName, artistName, songGenre) {
    const formData = new FormData();
    
    // Agregar el archivo con el nombre correcto
    formData.append('songFile', audioFile);
    
    // Agregar metadatos como campos separados
    formData.append('songName', songName);
    formData.append('artistName', artistName);
    formData.append('genre', songGenre);
    formData.append('timestamp', new Date().toISOString());
    formData.append('uploader', currentUser.displayName || currentUser.email);

    console.log('📤 Enviando archivo a GAS:', audioFile.name, audioFile.size, 'bytes');
    
    const response = await fetch(GAS_UPLOAD_URL, {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('📥 Respuesta de GAS:', result);

    if (result.error) {
        throw new Error(result.error);
    }

    // Manejar la portada
    let coverUrl = getDefaultCover(songGenre);
    if (coverFile) {
        coverUrl = URL.createObjectURL(coverFile);
    }
    
    return { 
        driveId: result.driveId, 
        downloadUrl: result.downloadUrl, 
        coverUrl: coverUrl,
        fileName: result.fileName
    };
}

// ========== ALMACENAMIENTO LOCAL Y METADATA ==========
async function handleLocalUpload(audioFile, coverFile, songName, artistName, songGenre) {
    const duration = await getAudioDuration(audioFile);
    
    // Convertir archivos a Base64 para persistencia
    const audioUrl = URL.createObjectURL(audioFile);
    const audioBase64 = await fileToBase64(audioFile);
    
    let coverUrl = getDefaultCover(songGenre);
    let coverBase64 = null;
    
    if (coverFile) {
        coverUrl = URL.createObjectURL(coverFile);
        coverBase64 = await fileToBase64(coverFile);
    }

    const newSong = {
        id: Date.now().toString(),
        name: songName,
        artist: artistName,
        genre: songGenre,
        fileUrl: audioUrl,
        imageUrl: coverUrl,
        file_size: audioFile.size,
        duration: duration,
        uploader: currentUser.uid,
        uploader_name: currentUser.displayName || currentUser.email,
        created_at: new Date().toISOString(),
        formattedDuration: formatDuration(duration),
        formattedSize: formatFileSize(audioFile.size),
        audioData: audioBase64,
        coverData: coverBase64,
        storage: 'local'
    };

    // Guardar en localStorage
    const currentSongs = [...songs, newSong];
    window.songs = currentSongs;
    saveSongsToLocalStorage(currentSongs);
    
    showNotification('🎉 ¡Canción subida exitosamente! (Almacenamiento local)', 'success');
    document.getElementById('upload-form').reset();
    displaySongs(currentSongs);
    updateStats(currentSongs);
    showHomeSection();
}

async function saveSongToLibrary(audioUrl, coverUrl, songName, artistName, songGenre, audioFile, driveId) {
    const duration = await getAudioDuration(audioFile);
    
    const newSong = {
        id: Date.now().toString(),
        name: songName,
        artist: artistName,
        genre: songGenre,
        fileUrl: audioUrl,
        imageUrl: coverUrl,
        file_size: audioFile.size,
        duration: duration,
        uploader: currentUser.uid,
        uploader_name: currentUser.displayName || currentUser.email,
        created_at: new Date().toISOString(),
        formattedDuration: formatDuration(duration),
        formattedSize: formatFileSize(audioFile.size),
        driveId: driveId,
        storage: 'google_drive'
    };

    // Guardar en localStorage
    const currentSongs = [...songs, newSong];
    window.songs = currentSongs;
    saveSongsToLocalStorage(currentSongs);
    
    displaySongs(currentSongs);
    updateStats(currentSongs);
    showHomeSection();
}

function loadSongsFromLocalStorage() {
    try {
        showLoading(true, '🎵 Cargando biblioteca...');
        
        const savedSongs = localStorage.getItem('musicStreamSongs');
        if (savedSongs) {
            const songsData = JSON.parse(savedSongs);
            
            // Para canciones locales, reconstruir desde base64
            songsData.forEach(song => {
                if (song.storage === 'local' && song.audioData) {
                    song.fileUrl = song.audioData;
                }
                if (song.storage === 'local' && song.coverData) {
                    song.imageUrl = song.coverData;
                } else if (!song.imageUrl) {
                    song.imageUrl = getDefaultCover(song.genre);
                }
            });
            
            window.songs = songsData;
            displaySongs(songsData);
            updateStats(songsData);
            showNotification(`🎵 ${songsData.length} canciones cargadas`, 'success');
            return;
        }
        
        showNoSongsMessage();
        
    } catch (error) {
        console.error('❌ Error cargando canciones:', error);
        showNoSongsMessage();
    } finally {
        showLoading(false);
    }
}

function saveSongsToLocalStorage(songs) {
    try {
        localStorage.setItem('musicStreamSongs', JSON.stringify(songs));
        console.log('💾 Canciones guardadas en localStorage');
    } catch (error) {
        console.error('❌ Error guardando en localStorage:', error);
    }
}

function displaySongs(songsToDisplay) {
    const container = document.getElementById('songs-container');
    
    if (!songsToDisplay || songsToDisplay.length === 0) {
        showNoSongsMessage();
        return;
    }
    
    container.innerHTML = songsToDisplay.map((song, index) => `
        <div class="song-card" data-id="${song.id}">
            <div class="song-image">
                <img src="${song.imageUrl}" alt="${song.name}" 
                     onerror="this.src='${getDefaultCover(song.genre)}'">
                <div class="song-overlay">
                    <button class="btn-play-overlay" data-index="${index}">▶</button>
                </div>
                ${song.duration ? `<div class="duration-badge">${song.formattedDuration}</div>` : ''}
            </div>
            <div class="song-info">
                <h3 class="song-title" title="${escapeHtml(song.name)}">${escapeHtml(song.name)}</h3>
                <p class="song-artist" title="${escapeHtml(song.artist)}">${escapeHtml(song.artist)}</p>
                <div class="song-meta">
                    <span class="song-genre">${capitalizeFirst(song.genre)}</span>
                    <span class="song-size">${song.formattedSize}</span>
                    ${song.uploader_name ? `<span class="uploader">Subido por: ${song.uploader_name}</span>` : ''}
                    <span class="storage-badge ${song.storage}">${song.storage === 'google_drive' ? '☁️ Drive' : '💾 Local'}</span>
                </div>
            </div>
            <div class="song-actions">
                <button class="btn-download" data-id="${song.id}" title="Descargar">
                    <span class="icon">📥</span>
                    <span class="text">Descargar</span>
                </button>
                <button class="btn-play" data-index="${index}" title="Reproducir">
                    <span class="icon">▶</span>
                    <span class="text">Reproducir</span>
                </button>
            </div>
        </div>
    `).join('');
    
    // Agregar event listeners a los botones dinámicos
    container.querySelectorAll('.btn-play, .btn-play-overlay').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.getAttribute('data-index'));
            playSong(index);
        });
    });
    
    container.querySelectorAll('.btn-download').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const songId = e.currentTarget.getAttribute('data-id');
            downloadSong(songId);
        });
    });
}

function showNoSongsMessage() {
    document.getElementById('songs-container').innerHTML = `
        <div class="no-songs">
            <h3>¡Bienvenido a MusicStream!</h3>
            <p>Sube tu primera canción para comenzar</p>
            <button onclick="showUploadSection()" class="btn-upload-first">🎵 Subir Primera Canción</button>
        </div>
    `;
    updateStats([]);
}

function updateStats(songs) {
    const totalSize = songs.reduce((sum, song) => sum + (song.file_size || 0), 0);
    const genres = new Set(songs.map(song => song.genre));
    const driveSongs = songs.filter(song => song.storage === 'google_drive').length;
    const localSongs = songs.filter(song => song.storage === 'local').length;
    
    document.getElementById('total-songs').innerHTML = `<strong>${songs.length}</strong> canciones (${driveSongs} en Drive, ${localSongs} local)`;
    document.getElementById('total-genres').innerHTML = `<strong>${genres.size}</strong> géneros`;
    document.getElementById('total-size').innerHTML = `<strong>${formatFileSize(totalSize)}</strong> total`;
}

// ========== REPRODUCTOR ==========
function playSong(index) {
    if (index < 0 || index >= songs.length) return;
    
    const song = songs[index];
    currentSongIndex = index;
    
    document.getElementById('current-song-title').textContent = song.name;
    document.getElementById('current-song-artist').textContent = song.artist;
    document.getElementById('current-song-img').src = song.imageUrl;
    
    audioPlayer.src = song.fileUrl; 
    audioPlayer.load();
    
    audioPlayer.play().then(() => {
        isPlaying = true;
        updatePlayButton();
        showNotification(`▶ Reproduciendo: ${song.name} - ${song.artist}`, 'info');
    }).catch(error => {
        console.error('Error reproduciendo:', error);
        showNotification('❌ Error al reproducir la canción', 'error');
    });
}

function togglePlay() {
    if (songs.length === 0) {
        showNotification('❌ No hay canciones para reproducir', 'error');
        return;
    }
    
    if (audioPlayer.paused) {
        if (currentSongIndex === -1) playSong(0);
        else audioPlayer.play().then(() => {
            isPlaying = true;
            updatePlayButton();
        }).catch(error => {
            console.error('Error al reanudar:', error);
            showNotification('❌ Error al reproducir', 'error');
        });
    } else {
        audioPlayer.pause();
        isPlaying = false;
        updatePlayButton();
    }
}

function playPrevious() {
    if (songs.length === 0) return;
    const newIndex = (currentSongIndex - 1 + songs.length) % songs.length;
    playSong(newIndex);
}

function playNext() {
    if (songs.length === 0) return;
    const newIndex = (currentSongIndex + 1) % songs.length;
    playSong(newIndex);
}

function setVolume() {
    const volume = document.getElementById('volume-slider').value / 100;
    audioPlayer.volume = volume;
}

function updatePlayButton() {
    const playBtn = document.getElementById('play-btn');
    if (playBtn) {
        playBtn.textContent = isPlaying ? '⏸' : '▶';
        playBtn.classList.toggle('playing', isPlaying);
    }
}

function updateDuration() {
    const totalSeconds = Math.floor(audioPlayer.duration);
    document.getElementById('duration').textContent = formatTime(totalSeconds);
}

function updateProgress() {
    const currentSeconds = Math.floor(audioPlayer.currentTime);
    document.getElementById('current-time').textContent = formatTime(currentSeconds);
    const progressPercent = (audioPlayer.currentTime / audioPlayer.duration) * 100 || 0;
    document.querySelector('.progress').style.width = `${progressPercent}%`;
}

function seek(e) {
    if (!audioPlayer.duration) return;
    const progressBar = e.currentTarget;
    const clickPosition = e.offsetX;
    const progressBarWidth = progressBar.clientWidth;
    const seekTime = (clickPosition / progressBarWidth) * audioPlayer.duration;
    audioPlayer.currentTime = seekTime;
}

function handleAudioError(error) {
    console.error('Error de audio:', error);
    showNotification('❌ Error al cargar el archivo de audio', 'error');
}

function downloadSong(songId) {
    const song = songs.find(s => s.id === songId);
    if (!song) {
        showNotification('❌ Canción no encontrada', 'error');
        return;
    }
    
    try {
        const link = document.createElement('a');
        link.href = song.fileUrl;
        link.download = `${song.name} - ${song.artist}.mp3`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification(`📥 Descargando: ${song.name}`, 'success');
    } catch (error) {
        console.error('Error descargando:', error);
        showNotification('❌ Error al descargar la canción', 'error');
    }
}

// ========== NAVEGACIÓN Y UTILIDADES ==========
function showHomeSection(e) {
    if (e) e.preventDefault();
    document.getElementById('upload-section').classList.add('hidden');
    document.querySelector('.songs-section').classList.remove('hidden');
    document.querySelector('.search-section').classList.remove('hidden');
    document.querySelector('.player-section').classList.remove('hidden');
}

function showUploadSection(e) {
    if (e) e.preventDefault();
    if (!currentUser) {
        showNotification('❌ Debes iniciar sesión para subir música', 'error');
        showLoginSection();
        return;
    }
    document.getElementById('upload-section').classList.remove('hidden');
    document.querySelector('.songs-section').classList.add('hidden');
    document.querySelector('.search-section').classList.add('hidden');
    document.querySelector('.player-section').classList.add('hidden');
}

function showStats() {
    if (songs.length === 0) {
        showNotification('📊 La biblioteca está vacía', 'info');
        return;
    }
    const totalSize = songs.reduce((sum, song) => sum + (song.file_size || 0), 0);
    const genres = new Set(songs.map(song => song.genre));
    const driveSongs = songs.filter(song => song.storage === 'google_drive').length;
    const localSongs = songs.filter(song => song.storage === 'local').length;
    showNotification(`📊 Estadísticas: ${songs.length} canciones (${driveSongs} Drive, ${localSongs} local) | ${genres.size} géneros | ${formatFileSize(totalSize)} total`, 'info');
}

function performSearch() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const genreFilter = document.getElementById('genre-filter').value;

    let filteredSongs = songs;

    if (searchTerm) {
        filteredSongs = filteredSongs.filter(song => 
            song.name.toLowerCase().includes(searchTerm) || 
            song.artist.toLowerCase().includes(searchTerm)
        );
    }

    if (genreFilter) {
        filteredSongs = filteredSongs.filter(song => song.genre === genreFilter);
    }

    displaySongs(filteredSongs);
    
    if (filteredSongs.length === 0) {
        showNotification('🔍 No se encontraron canciones con esos criterios', 'info');
    }
}

// ========== UTILIDADES ==========
function getDefaultCover(genre) {
    const colors = {
        rock: '#e74c3c', pop: '#9b59b6', jazz: '#f39c12', hiphop: '#34495e',
        electronica: '#3498db', reggaeton: '#e67e22', salsa: '#e84393',
        clasica: '#95a5a6', otros: '#6c5ce7'
    };
    const color = colors[genre] || '#6c5ce7';
    return `data:image/svg+xml;base64,${btoa(`
        <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
            <rect width="200" height="200" fill="${color}"/>
            <circle cx="100" cy="80" r="30" fill="white" opacity="0.2"/>
            <circle cx="100" cy="80" r="15" fill="white" opacity="0.4"/>
            <rect x="70" y="120" width="60" height="8" fill="white" opacity="0.6"/>
            <rect x="80" y="135" width="40" height="5" fill="white" opacity="0.4"/>
        </svg>
    `)}`;
}

function getAudioDuration(file) {
    return new Promise((resolve) => {
        const audio = new Audio();
        audio.src = URL.createObjectURL(file);
        audio.addEventListener('loadedmetadata', () => {
            resolve(Math.floor(audio.duration));
            URL.revokeObjectURL(audio.src);
        });
        audio.addEventListener('error', () => resolve(0));
    });
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDuration(seconds) {
    return seconds ? formatTime(seconds) : '--:--';
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function capitalizeFirst(string) {
    return string ? string.charAt(0).toUpperCase() + string.slice(1) : '';
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ========== LOADING & NOTIFICATIONS ==========
function showLoading(show, message = '') {
    isLoading = show;
    if (show) {
        document.body.style.cursor = 'wait';
        let loadingOverlay = document.getElementById('global-loading-overlay');
        if (!loadingOverlay) {
            loadingOverlay = document.createElement('div');
            loadingOverlay.id = 'global-loading-overlay';
            loadingOverlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.85); display: flex; flex-direction: column;
                align-items: center; justify-content: center; z-index: 9999;
                color: white; font-family: inherit; backdrop-filter: blur(5px);
            `;
            document.body.appendChild(loadingOverlay);
        }
        loadingOverlay.innerHTML = `
            <style>@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
            .loading-spinner{width:60px;height:60px;border:5px solid rgba(108,92,231,0.3);
            border-top:5px solid #6c5ce7;border-radius:50%;animation:spin 1s linear infinite;
            margin-bottom:20px;}</style>
            <div class="loading-spinner"></div>
            <div style="font-size:18px;margin-bottom:10px;">${message}</div>
            <div style="font-size:14px;opacity:0.8;">Por favor, espera</div>
        `;
        loadingOverlay.style.display = 'flex';
    } else {
        document.body.style.cursor = 'default';
        const loadingOverlay = document.getElementById('global-loading-overlay');
        if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; padding: 15px 20px;
        border-radius: 8px; color: white; z-index: 10000; max-width: 400px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3); animation: slideInRight 0.3s ease;
        font-family: system-ui, -apple-system, sans-serif;
    `;
    const colors = { success: '#00b894', error: '#d63031', warning: '#fdcb6e', info: '#0984e3' };
    notification.style.background = colors[type] || colors.info;
    if (type === 'warning') notification.style.color = '#2d3436';
    notification.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="background: none; border: none; color: inherit; font-size: 18px; cursor: pointer; margin-left: 10px;">
                &times;
            </button>
        </div>
    `;
    document.body.appendChild(notification);
    setTimeout(() => { if (notification.parentNode) notification.remove(); }, 5000);
}

// Funciones globales
window.playSong = playSong;
window.downloadSong = downloadSong;
window.showUploadSection = showUploadSection;
window.loadSongs = loadSongsFromLocalStorage;

console.log('🎵 MusicStream cargado correctamente');
