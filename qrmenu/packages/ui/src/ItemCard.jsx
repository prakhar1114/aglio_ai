import React from 'react';
import { useCartStore } from '@qrmenu/core';

export function ItemCard({ item }) {
  const qty = useCartStore((s) => s.items[item.id]?.qty ?? 0);
  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);

  const handleAdd = () => addItem(item);

  const handleRemove = () => removeItem(item);

  const cardStyle = {
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    backgroundColor: 'white',
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid #e5e7eb',
    width: '100%',
    margin: 0
  };

  const imageContainerStyle = {
    position: 'relative',
    aspectRatio: '1',
    width: '100%'
  };

  const imageStyle = {
    aspectRatio: '1',
    objectFit: 'cover',
    width: '100%',
    height: '100%',
    display: 'block'
  };

  const contentStyle = {
    padding: '2px 8px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    minHeight: '20px'
  };

  const titleStyle = {
    fontSize: '10px',
    fontWeight: '500',
    color: '#1f2937',
    lineHeight: '1.1',
    wordBreak: 'break-word',
    flex: '1',
    margin: 0,
    padding: 0,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 1,
    WebkitBoxOrient: 'vertical'
  };

  const priceStyle = {
    fontSize: '9px',
    color: '#6b7280',
    whiteSpace: 'nowrap',
    fontWeight: '500',
    margin: 0,
    padding: 0
  };

  const buttonOverlayStyle = {
    position: 'absolute',
    bottom: '8px',
    right: '8px',
    zIndex: 10
  };

  const addButtonStyle = {
    padding: '4px 8px',
    fontSize: '12px',
    color: 'white',
    borderRadius: '4px',
    border: 'none',
    background: 'var(--brand, #D9232E)',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
  };

  const quantityButtonStyle = {
    padding: '2px 6px',
    fontSize: '12px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: '#374151',
    fontWeight: '500'
  };

  const quantityStyle = {
    padding: '0 4px',
    fontSize: '12px',
    fontWeight: '500',
    color: '#374151',
    minWidth: '16px',
    textAlign: 'center'
  };

  const quantityPillStyle = {
    display: 'flex',
    alignItems: 'center',
    background: 'white',
    borderRadius: '12px',
    border: '1px solid #d1d5db',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    overflow: 'hidden'
  };

  return (
    <div style={cardStyle}>
      {item.image_url && (
        <div style={imageContainerStyle}>
          <img
            src={item.image_url}
            alt={item.name}
            style={imageStyle}
            loading="lazy"
          />
          <div style={buttonOverlayStyle}>
            {qty === 0 ? (
              <button
                onClick={handleAdd}
                style={addButtonStyle}
              >
                Add
              </button>
            ) : (
              <div style={quantityPillStyle}>
                <button
                  onClick={handleRemove}
                  style={quantityButtonStyle}
                >
                  −
                </button>
                <span style={quantityStyle}>{qty}</span>
                <button
                  onClick={handleAdd}
                  style={quantityButtonStyle}
                >
                  +
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      <div style={contentStyle}>
        <h3 style={titleStyle}>{item.name}</h3>
        <p style={priceStyle}>₹{item.price}</p>
      </div>
    </div>
  );
} 