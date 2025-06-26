import React from 'react';
import { TextBlock } from './TextBlock';
import { DishCard } from './DishCard';
import { DishCarousel } from './DishCarousel';
import { QuickReplies } from './QuickReplies';

export function BlockRenderer({ block, className = '' }) {
  if (!block || !block.type) return null;

  switch (block.type) {
    case 'text':
      return (
        <TextBlock text={block.markdown} className={className} />
      );
    
    case 'dish_carousal':
      return (
        <DishCarousel options={block.options} className={className} />
      );
    
    case 'dish_card':
      return (
        <DishCard 
          id={block.id}
          name={block.name}
          price={block.price}
          image_url={block.image_url}
          cloudflare_image_id={block.cloudflare_image_id}
          cloudflare_video_id={block.cloudflare_video_id}
          tags={block.tags}
          description={block.description}
          className={className}
        />
      );
    
    case 'quick_replies':
      return (
        <QuickReplies options={block.options} className={className} />
      );
    
    default:
      console.warn(`Unknown block type: ${block.type}`);
      return null;
  }
} 