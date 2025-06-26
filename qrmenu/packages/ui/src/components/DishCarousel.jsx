import React from 'react';
import { DishCard } from './DishCard';

export function DishCarousel({ options, className = '' }) {
  if (!options || options.length === 0) return null;

  return (
    <div 
      className={`
        flex gap-3 py-1 pb-2
        overflow-x-auto overflow-y-hidden
        scroll-smooth
        scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-200
        ${className}
      `}
      style={{ 
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(0, 0, 0, 0.1) transparent'
      }}
    >
      {options.map((dish, index) => (
        <DishCard
          key={dish.id || index}
          id={dish.id}
          name={dish.name}
          price={dish.price}
          image_url={dish.image_url}
          cloudflare_image_id={dish.cloudflare_image_id}
          cloudflare_video_id={dish.cloudflare_video_id}
          tags={dish.tags}
          description={dish.description}
        />
      ))}
    </div>
  );
} 