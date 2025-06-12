import React, { useRef, useEffect } from 'react';

export function FullBleedVideo({ item }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          vid.play().catch(() => {});
        } else {
          vid.pause();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(vid);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="w-screen overflow-hidden" style={{ marginLeft: 'calc(50% - 50vw)' }}>
      <video
        ref={videoRef}
        src={item.url}
        poster={item.poster}
        muted
        playsInline
        loop
        className="w-full h-auto"
      />
    </div>
  );
} 