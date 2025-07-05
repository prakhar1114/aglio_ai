import React from 'react';
import { ItemCard } from './ItemCard.jsx';
import { PromotionBanner } from './PromotionBanner.jsx';
import { FullBleedVideo } from './FullBleedVideo.jsx';

export function FeedItemSwitcher({ item, containerWidth, onItemClick, preload=false, autoplay=false, muted=true }) {
  switch (item.kind) {
    case 'food':
      return <ItemCard item={item} containerWidth={containerWidth} onItemClick={onItemClick} preload={preload} autoplay={autoplay} muted={muted} />;
    case 'promotion':
    case 'instagram':
      return <PromotionBanner item={item} />;
    case 'video':
    case 'story':
      return <FullBleedVideo item={item} />;
    default:
      return null;
  }
} 