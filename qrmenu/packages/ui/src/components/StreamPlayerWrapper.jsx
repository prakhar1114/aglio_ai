import React, {
  memo,
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useState,
} from 'react';
import { Stream } from '@cloudflare/stream-react';
import { streamRegistry } from '../utils/streamRegistry.js';

// Retrieve Cloudflare customer code from Vite or Node environment variables
const customerCode =
  import.meta.env?.VITE_CLOUDFLARE_STREAM_CUSTOMER_CODE ||
  process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE || '';

/**
 * StreamPlayerWrapper
 * --------------------
 * A memoized wrapper around Cloudflare's <Stream> component that:
 * 1. Exposes imperative methods (play, pause, seek, etc.) via refs
 * 2. Accepts simple CSS transform parameters so the parent can animate/scale/translate
 *    the player without triggering re-renders of the underlying iframe/player.
 * 3. Keeps styling & aspect-ratio concerns outside the core Stream component so
 *    we can swap layouts/responsive behaviour easily later.
 */
export const StreamPlayerWrapper = memo(
  forwardRef(function StreamPlayerWrapper(
    {
      videoId,
      containerWidth = '100%',
      containerHeight = '100%',
      addControls = false,
      preload = false,
      autoplay = false,
      muted = true,
      loop = true,
      reuseStream = false,
      contextId = null,
      transformations = {}, // { scale, x, y, animated }
      className = '',
      onStreamReady,
    },
    ref,
  ) {
    const internalRef = useRef();
    const containerRef = useRef();
    const [isMutedState, setIsMutedState] = useState(muted);
    const [progress, setProgress] = useState(0); // 0..1
    const [buffered, setBuffered] = useState(0); // 0..1
    const [isLoading, setIsLoading] = useState(true);

    // Expose a minimal imperative API to parent components
    useImperativeHandle(ref, () => ({
      play: () => internalRef.current?.play(),
      pause: () => internalRef.current?.pause(),
      seek: (time) => {
        if (internalRef.current) {
          internalRef.current.currentTime = time;
        }
      },
      getCurrentTime: () => internalRef.current?.currentTime ?? 0,
      getPlayer: () => internalRef.current,
    }));

    const {
      scale = 1,
      x = 0,
      y = 0,
      animated = false,
    } = transformations || {};

    // Compute scale based on assumption that Stream player always starts as 16:9 box
    // We want content to touch full width – so we zoom player until pillar-box width is filled.
    // useEffect(() => {
    //   if (!containerWidth || !containerHeight) return;
    //   const fittedWidth = containerHeight * (16 / 9); // width of 16:9 frame when height is fixed
    //   const widthScale = containerWidth / fittedWidth;
    //   setCalculatedScale(Math.max(1, widthScale));
    // }, [containerWidth, containerHeight]);

    // Calculate height% so width fits and video is slightly zoomed to fill height.
    // const naturalVideoHeight = (containerWidth * 9) / 16; // assuming 16:9 source
    // const heightPercent =
    //   naturalVideoHeight === 0
    //     ? 100
    //     : Math.max(100, (containerHeight / naturalVideoHeight) * 100);

    // ------- Attach player listeners for progress ----------
    useEffect(() => {
      const player = internalRef.current;
      if (!player) return;

      function updateProgress() {
        if (!player.duration || player.duration === Infinity) return;
        setProgress(player.currentTime / player.duration);

        const ranges = player.buffered;
        if (ranges && ranges.length) {
          const end = ranges.end(ranges.length - 1);
          setBuffered(Math.min(1, end / player.duration));
        }
      }

      const handlePlaying = () => setIsLoading(false);
      const handleWaiting = () => setIsLoading(true);

      player.addEventListener('timeupdate', updateProgress);
      player.addEventListener('progress', updateProgress);
      player.addEventListener('playing', handlePlaying);
      player.addEventListener('canplay', handlePlaying);
      player.addEventListener('waiting', handleWaiting);

      // initial
      updateProgress();

      return () => {
        player.removeEventListener('timeupdate', updateProgress);
        player.removeEventListener('progress', updateProgress);
        player.removeEventListener('playing', handlePlaying);
        player.removeEventListener('canplay', handlePlaying);
        player.removeEventListener('waiting', handleWaiting);
      };
    }, [internalRef]);

    // Whenever the video source changes, reset progress & show loading spinner
    useEffect(() => {
      setIsLoading(true);
      setProgress(0);
      setBuffered(0);
      console.log('rendering stream ', videoId, 'contextId ', contextId);
    }, [videoId]);

    return (
      <div
        className={`stream-wrapper ${className}`}
        style={{
          width: containerWidth,
          height: containerHeight,
          position: 'relative',
          overflow: 'hidden',
          // transform: `translate(${x}px, ${y}px) scale(${scale * calculatedScale})`,
          transformOrigin: 'center',
          transition: animated ? 'transform 0.35s ease-out' : undefined,
        }}
        ref={containerRef}
      >
        {/* Mute/Unmute Toggle (custom) */}
        {addControls && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const player = internalRef.current;
              if (player) {
                player.muted = !player.muted;
                setIsMutedState(player.muted);
              }
            }}
            className="absolute bottom-3 right-3 z-20 bg-black/60 hover:bg-black/70 text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ pointerEvents: 'auto' }}
          >
            {isMutedState ? (
              // Muted icon
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
              </svg>
            ) : (
              // Unmuted icon
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              </svg>
            )}
          </button>
        )}

        {/* Minimal progress bar */}
        {!isLoading && addControls && (
          <ProgressBar
            progress={progress}
            buffered={buffered}
            onSeek={(fraction) => {
              const player = internalRef.current;
              if (player && player.duration && player.duration !== Infinity) {
                player.currentTime = fraction * player.duration;
              }
            }}
          />
        )}

        {/* Loading spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            width: '100%',
            // height: `${heightPercent}%`,
            transform: 'translateY(-50%)',
            overflow: 'hidden',
          }}
        >
          {/* Render Stream */}
          <Stream
            streamRef={internalRef}
            src={videoId}
            customerCode={customerCode || undefined}
            controls={false}
            autoplay={autoplay}
            muted={isMutedState}
            loop={loop}
            preload={preload ? 'auto' : 'metadata'}
            responsive={true}
            height={containerHeight}
            width={containerWidth}
            // onLoadedMetaData={() => {
            //   if (reuseStream && internalRef.current) {
            //     streamRegistry.register(videoId, internalRef.current);
            //   }
            //   onStreamReady?.(internalRef.current);
            //   setIsLoading(false);
            // }}
          />
        </div>
      </div>
    );
  }),
);

StreamPlayerWrapper.displayName = 'StreamPlayerWrapper';

// ---------- ProgressBar component -------------
function ProgressBar({ progress, buffered, onSeek }) {
  const barRef = useRef();
  const draggingRef = useRef(false);

  // Helper to compute fraction based on pointer event
  const computeFraction = (clientX) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const fraction = (clientX - rect.left) / rect.width;
    return Math.min(1, Math.max(0, fraction));
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    draggingRef.current = true;
    const fraction = computeFraction(e.clientX || e.touches?.[0]?.clientX || 0);
    onSeek(fraction);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const handlePointerMove = (e) => {
    if (!draggingRef.current) return;
    const fraction = computeFraction(e.clientX || e.touches?.[0]?.clientX || 0);
    onSeek(fraction);
  };

  const handlePointerUp = () => {
    draggingRef.current = false;
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerUp);
  };

  return (
    <div
      ref={barRef}
      onPointerDown={handlePointerDown}
      className="absolute bottom-0 left-0 w-full"
      style={{ height: '3px', cursor: 'pointer', zIndex: 20 }}
    >
      {/* background track */}
      <div
        className="w-full h-full"
        style={{ position: 'absolute', top: 0, left: 0 }}
      ></div>
      {/* buffered */}
      <div
        className="h-full"
        style={{ position: 'absolute', top: 0, left: 0, width: `${buffered * 100}%`, background: 'rgba(255,255,255,0.35)' }}
      ></div>
      {/* played */}
      <div
        className="h-full bg-white"
        style={{ position: 'absolute', top: 0, left: 0, width: `${progress * 100}%` }}
      ></div>
    </div>
  );
} 