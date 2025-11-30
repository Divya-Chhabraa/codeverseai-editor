import React, { useState, useRef, useEffect } from 'react';
import ACTIONS from '../Actions';

const WatchTogether = ({ roomId, socketRef, isSocketReady, theme, isDarkMode }) => {
    const [videoUrl, setVideoUrl] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [showVideoPlayer, setShowVideoPlayer] = useState(false);
    const [isHost, setIsHost] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [videoType, setVideoType] = useState(''); // 'youtube' or 'html5'
    const videoRef = useRef(null);
    const lastSyncTimeRef = useRef(0);

    // Reset states when room changes
    useEffect(() => {
        setVideoUrl('');
        setShowVideoPlayer(false);
        setIsHost(false);
        setIsPlaying(false);
        setCurrentTime(0);
        setVideoType('');
    }, [roomId]);

    // Initialize video sync when component mounts
    useEffect(() => {
        if (!socketRef.current || !isSocketReady) return;

        const socket = socketRef.current;
        
        // Join video room
        socket.emit(ACTIONS.VIDEO_JOIN, { roomId });
        console.log('🎥 Joined video room:', roomId);

    }, [socketRef, isSocketReady, roomId]);

    // Video event listeners
    useEffect(() => {
        if (!socketRef.current || !isSocketReady) return;

        const socket = socketRef.current;

        const handleVideoPlay = (data) => {
            console.log('🎥 Received PLAY event:', data);
            if (videoRef.current && !isHost && Date.now() - lastSyncTimeRef.current > 500) {
                setIsSyncing(true);
                lastSyncTimeRef.current = Date.now();

                if (videoType === 'html5' && data.currentTime !== undefined) {
                    // For HTML5 videos, sync time precisely
                    videoRef.current.currentTime = data.currentTime;
                }
                
                setTimeout(() => {
                    if (videoRef.current) {
                        videoRef.current.play().catch(e => console.log('Play error:', e));
                        setIsPlaying(true);
                        if (videoType === 'html5') {
                            setCurrentTime(data.currentTime || 0);
                        }
                    }
                    setIsSyncing(false);
                }, 100);
            }
        };

        const handleVideoPause = (data) => {
            console.log('🎥 Received PAUSE event:', data);
            if (videoRef.current && !isHost && Date.now() - lastSyncTimeRef.current > 500) {
                setIsSyncing(true);
                lastSyncTimeRef.current = Date.now();

                if (videoType === 'html5' && data.currentTime !== undefined) {
                    videoRef.current.currentTime = data.currentTime;
                    setCurrentTime(data.currentTime);
                }
                
                videoRef.current.pause();
                setIsPlaying(false);
                setIsSyncing(false);
            }
        };

        const handleVideoSeek = (data) => {
            console.log('🎥 Received SEEK event:', data);
            if (videoRef.current && !isHost && videoType === 'html5' && Date.now() - lastSyncTimeRef.current > 500) {
                setIsSyncing(true);
                lastSyncTimeRef.current = Date.now();
                
                if (Math.abs(videoRef.current.currentTime - data.currentTime) > 1) {
                    videoRef.current.currentTime = data.currentTime;
                    setCurrentTime(data.currentTime);
                }
                
                setTimeout(() => setIsSyncing(false), 100);
            }
        };

        const handleVideoChange = (data) => {
            console.log('🎥 Received VIDEO CHANGE event:', data);
            setVideoUrl(data.videoUrl);
            setShowVideoPlayer(true);
            setIsHost(false); // Someone else changed the video, they are host
            
            // Detect video type
            const type = detectVideoType(data.videoUrl);
            setVideoType(type);
        };

        const handleVideoStateSync = (state) => {
            console.log('🎥 Received STATE SYNC:', state);
            if (state && state.videoUrl) {
                setVideoUrl(state.videoUrl);
                setShowVideoPlayer(true);
                setIsHost(false); // If there's existing state, we're not host
                
                // Detect video type
                const type = detectVideoType(state.videoUrl);
                setVideoType(type);
                
                // Apply synced state after delay
                setTimeout(() => {
                    if (videoRef.current) {
                        console.log('🎥 Applying synced state:', state);
                        
                        if (type === 'html5' && state.currentTime !== undefined) {
                            videoRef.current.currentTime = state.currentTime;
                            setCurrentTime(state.currentTime);
                        }
                        
                        if (state.isPlaying) {
                            videoRef.current.play().catch(e => console.log('Sync play error:', e));
                            setIsPlaying(true);
                        } else {
                            videoRef.current.pause();
                            setIsPlaying(false);
                        }
                    }
                }, 1500);
            }
        };

        socket.on(ACTIONS.VIDEO_PLAY, handleVideoPlay);
        socket.on(ACTIONS.VIDEO_PAUSE, handleVideoPause);
        socket.on(ACTIONS.VIDEO_SEEK, handleVideoSeek);
        socket.on(ACTIONS.VIDEO_CHANGE, handleVideoChange);
        socket.on(ACTIONS.VIDEO_STATE_SYNC, handleVideoStateSync);

        return () => {
            socket.off(ACTIONS.VIDEO_PLAY, handleVideoPlay);
            socket.off(ACTIONS.VIDEO_PAUSE, handleVideoPause);
            socket.off(ACTIONS.VIDEO_SEEK, handleVideoSeek);
            socket.off(ACTIONS.VIDEO_CHANGE, handleVideoChange);
            socket.off(ACTIONS.VIDEO_STATE_SYNC, handleVideoStateSync);
        };
    }, [socketRef, isSocketReady, isHost, videoType]);

    // Detect video type
    const detectVideoType = (url) => {
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            return 'youtube';
        } else {
            return 'html5';
        }
    };

    // HTML5 video time update
    const handleTimeUpdate = () => {
        if (videoRef.current && videoType === 'html5') {
            setCurrentTime(videoRef.current.currentTime);
        }
    };

    // Event handlers
    const handlePlay = () => {
        if (videoRef.current && socketRef.current && isSocketReady && isHost && !isSyncing) {
            const currentTime = videoType === 'html5' ? videoRef.current.currentTime : 0;
            console.log('🎥 Host playing video - Time:', currentTime);
            
            socketRef.current.emit(ACTIONS.VIDEO_PLAY, {
                roomId,
                currentTime: currentTime,
                videoUrl: videoUrl,
                timestamp: Date.now()
            });
            
            setIsPlaying(true);
            lastSyncTimeRef.current = Date.now();
        }
    };

    const handlePause = () => {
        if (videoRef.current && socketRef.current && isSocketReady && isHost && !isSyncing) {
            const currentTime = videoType === 'html5' ? videoRef.current.currentTime : 0;
            console.log('🎥 Host pausing video - Time:', currentTime);
            
            socketRef.current.emit(ACTIONS.VIDEO_PAUSE, {
                roomId,
                currentTime: currentTime,
                videoUrl: videoUrl,
                timestamp: Date.now()
            });
            
            setIsPlaying(false);
            lastSyncTimeRef.current = Date.now();
        }
    };

    const handleSeek = () => {
        if (videoRef.current && socketRef.current && isSocketReady && isHost && !isSyncing && videoType === 'html5') {
            const currentTime = videoRef.current.currentTime;
            console.log('🎥 Host seeking video - Time:', currentTime);
            
            socketRef.current.emit(ACTIONS.VIDEO_SEEK, {
                roomId,
                currentTime: currentTime,
                timestamp: Date.now()
            });
            
            lastSyncTimeRef.current = Date.now();
        }
    };

    const handleVideoLoad = (url) => {
        if (socketRef.current && isSocketReady && url.trim()) {
            setVideoUrl(url);
            setShowVideoPlayer(true);
            setIsHost(true); // Person who loads video becomes host
            
            // Detect video type
            const type = detectVideoType(url);
            setVideoType(type);
            
            console.log('🎥 User became HOST with video type:', type);
            socketRef.current.emit(ACTIONS.VIDEO_CHANGE, {
                roomId,
                videoUrl: url,
                timestamp: Date.now()
            });
        }
    };

    const handleSyncRequest = () => {
        if (socketRef.current && isSocketReady) {
            console.log('🎥 Requesting video sync');
            socketRef.current.emit(ACTIONS.VIDEO_SYNC_REQUEST, { roomId });
        }
    };

    const handleBecomeHost = () => {
        if (videoUrl && socketRef.current && isSocketReady) {
            setIsHost(true);
            console.log('🎥 User manually became HOST');
            // Re-broadcast the video change to claim host
            socketRef.current.emit(ACTIONS.VIDEO_CHANGE, {
                roomId,
                videoUrl: videoUrl,
                timestamp: Date.now()
            });
        }
    };

    const extractVideoId = (url) => {
        const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[7].length === 11) ? match[7] : null;
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const getSupportedFormatsText = () => {
        return "Supported: YouTube, MP4, WebM, OGG";
    };

    return (
        <div className="watch-together-container" style={{
            border: `1px solid ${theme.border}`,
            borderRadius: '12px',
            padding: '20px',
            margin: '20px 0',
            background: theme.surface,
            color: theme.text,
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <div className="video-controls" style={{ marginBottom: '15px', flexShrink: 0 }}>
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    marginBottom: '15px' 
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h4 style={{ margin: 0, color: theme.text }}>🎥 Watch Together</h4>
                        <div style={{
                            fontSize: '12px',
                            padding: '4px 8px',
                            borderRadius: '12px',
                            background: isHost ? '#10b981' : '#6b7280',
                            color: 'white',
                            fontWeight: 'bold'
                        }}>
                            {isHost ? '🎮 HOST' : '👀 VIEWER'}
                        </div>
                        {videoType && (
                            <div style={{
                                fontSize: '10px',
                                padding: '2px 6px',
                                borderRadius: '8px',
                                background: videoType === 'youtube' ? '#ff0000' : '#3b82f6',
                                color: 'white',
                            }}>
                                {videoType === 'youtube' ? 'YouTube' : 'HTML5'}
                            </div>
                        )}
                        {isSyncing && (
                            <div style={{
                                fontSize: '12px',
                                padding: '4px 8px',
                                borderRadius: '12px',
                                background: '#f59e0b',
                                color: 'white'
                            }}>
                                Syncing...
                            </div>
                        )}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {!isHost && videoUrl && (
                            <button 
                                onClick={handleBecomeHost}
                                style={{
                                    padding: '6px 12px',
                                    background: '#f59e0b',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: 'bold'
                                }}
                            >
                                🎮 Become Host
                            </button>
                        )}
                        <button 
                            onClick={handleSyncRequest}
                            style={{
                                padding: '6px 12px',
                                background: theme.accent,
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 'bold'
                            }}
                        >
                            🔄 Sync Now
                        </button>
                    </div>
                </div>
                
                <div className="video-url-input" style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    <input
                        type="text"
                        placeholder="Enter YouTube URL or direct video URL (MP4, WebM, OGG)"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                handleVideoLoad(videoUrl);
                            }
                        }}
                        style={{
                            flex: 1,
                            padding: '10px 12px',
                            border: `1px solid ${theme.border}`,
                            borderRadius: '8px',
                            backgroundColor: theme.surfaceSecondary,
                            color: theme.text,
                            outline: 'none',
                            fontSize: '14px'
                        }}
                    />
                    <button 
                        onClick={() => handleVideoLoad(videoUrl)}
                        disabled={!videoUrl.trim()}
                        style={{
                            padding: '10px 20px',
                            background: videoUrl.trim() ? theme.accent : theme.border,
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: videoUrl.trim() ? 'pointer' : 'not-allowed',
                            fontWeight: 'bold',
                            fontSize: '14px'
                        }}
                    >
                        {isHost ? 'Change Video' : 'Load Video'}
                    </button>
                </div>
                <div style={{ fontSize: '12px', color: theme.textSecondary, textAlign: 'center' }}>
                    {getSupportedFormatsText()}
                </div>
            </div>

            {showVideoPlayer && videoUrl && (
                <div className="video-player-wrapper" style={{ flex: 1, minHeight: 0 }}>
                    {videoType === 'youtube' ? (
                        <div style={{ 
                            position: 'relative', 
                            paddingBottom: '56.25%', 
                            height: 0, 
                            overflow: 'hidden', 
                            borderRadius: '8px',
                            backgroundColor: '#000'
                        }}>
                            <iframe
                                ref={videoRef}
                                src={`https://www.youtube.com/embed/${extractVideoId(videoUrl)}?enablejsapi=1`}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    border: 'none',
                                    borderRadius: '8px'
                                }}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                title="Watch Together"
                                onPlay={handlePlay}
                                onPause={handlePause}
                            />
                        </div>
                    ) : (
                        <video
                            ref={videoRef}
                            width="100%"
                            height="100%"
                            controls={isHost}
                            onPlay={handlePlay}
                            onPause={handlePause}
                            onSeeked={handleSeek}
                            onTimeUpdate={handleTimeUpdate}
                            style={{
                                borderRadius: '8px',
                                backgroundColor: '#000',
                                maxHeight: '100%'
                            }}
                        >
                            <source src={videoUrl} type="video/mp4" />
                            <source src={videoUrl} type="video/webm" />
                            <source src={videoUrl} type="video/ogg" />
                            Your browser does not support the video tag.
                        </video>
                    )}
                    
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '10px',
                        padding: '0 10px',
                        fontSize: '14px',
                        color: theme.textSecondary
                    }}>
                        <span>
                            {videoType === 'html5' ? `Time: ${formatTime(currentTime)}` : 'YouTube Video'}
                        </span>
                        <span>Status: {isPlaying ? '▶️ Playing' : '⏸️ Paused'}</span>
                    </div>
                    
                    {isHost ? (
                        <div style={{
                            background: '#d1fae5',
                            border: '1px solid #10b981',
                            borderRadius: '4px',
                            padding: '10px',
                            marginTop: '10px',
                            textAlign: 'center',
                            color: '#065f46',
                            fontSize: '14px'
                        }}>
                            <p style={{ margin: 0, fontWeight: 'bold' }}>🎮 You are the HOST</p>
                            <p style={{ margin: '5px 0 0 0', fontSize: '12px' }}>
                                {videoType === 'html5' 
                                    ? 'Your play/pause/seek actions will sync perfectly with all viewers.' 
                                    : 'Your play/pause actions will sync with all viewers.'}
                            </p>
                            {videoType === 'html5' && (
                                <p style={{ margin: '5px 0 0 0', fontSize: '10px', opacity: 0.8 }}>
                                    ✅ Perfect timing sync supported
                                </p>
                            )}
                        </div>
                    ) : (
                        <div style={{
                            background: '#fff3cd',
                            border: '1px solid #ffeaa7',
                            borderRadius: '4px',
                            padding: '10px',
                            marginTop: '10px',
                            textAlign: 'center',
                            color: '#856404',
                            fontSize: '14px'
                        }}>
                            <p style={{ margin: 0, fontWeight: 'bold' }}>👀 You are a VIEWER</p>
                            <p style={{ margin: '5px 0 0 0', fontSize: '12px' }}>
                                Click "Become Host" to take control of playback.
                            </p>
                            {videoType === 'html5' && (
                                <p style={{ margin: '5px 0 0 0', fontSize: '10px', opacity: 0.8 }}>
                                    ✅ Perfect timing sync enabled
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {!showVideoPlayer && (
                <div style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: theme.textSecondary,
                    fontSize: '16px',
                    textAlign: 'center',
                    padding: '40px'
                }}>
                    <div>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎥</div>
                        <p>Enter a video URL above to start watching together!</p>
                        <p style={{ fontSize: '14px', opacity: 0.7 }}>
                            The first person to load a video becomes the host.
                        </p>
                        <div style={{ fontSize: '12px', opacity: 0.5, marginTop: '10px', textAlign: 'left' }}>
                            <p><strong>YouTube URLs:</strong></p>
                            <ul style={{ paddingLeft: '20px', margin: '5px 0' }}>
                                <li>Play/Pause sync only</li>
                                <li>Timing sync not available</li>
                            </ul>
                            <p><strong>Direct Video URLs (MP4, WebM, OGG):</strong></p>
                            <ul style={{ paddingLeft: '20px', margin: '5px 0' }}>
                                <li>Perfect play/pause/seek sync</li>
                                <li>Exact timing synchronization</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WatchTogether;