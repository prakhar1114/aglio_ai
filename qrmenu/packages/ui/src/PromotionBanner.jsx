import React from 'react';
import clsx from 'clsx';

export function PromotionBanner({ item }) {
  return (
    <a
      href={item.cta_url || '#'}
      className={clsx('block overflow-hidden', item.fullBleed && 'col-span-full')}
    >
      <img
        src={item.image_url}
        alt={item.alt || 'promotion'}
        className="w-full object-cover rounded-lg"
        loading="lazy"
      />
    </a>
  );
} 