import React from 'react';
import { ItemCard } from './ItemCard.jsx';
import { PromotionBanner } from './PromotionBanner.jsx';
import { FullBleedVideo } from './FullBleedVideo.jsx';

export function FeedItemSwitcher({ item, containerWidth, onItemClick, preload=false, autoplay=false, muted=true, context_namespace=null }) {
  switch (item.kind) {
    case 'food':
      return <ItemCard item={item} containerWidth={containerWidth} onItemClick={onItemClick} preload={preload} autoplay={autoplay} muted={muted} context_namespace={context_namespace} />;
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