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
    
    case 'quick_replies':
      return (
        <QuickReplies options={block.options} className={className} />
      );
    
    default:
      console.warn(`Unknown block type: ${block.type}`);
      return null;
  }
} 