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
    bottom: '4px',
    right: '4px',
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

  // Style for cards without images
  const noImageCardStyle = {
    position: 'relative',
    width: '100%',
    height: '80px', // Even more compact height
    background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '6px',
    textAlign: 'center'
  };

  const noImageContentStyle = {
    display: 'flex',
    // flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '2px',
    width: '100%',
    paddingRight: '0px' // Leave space for button
  };

  const noImageTitleStyle = {
    fontSize: '12px',
    fontWeight: '600',
    color: '#1f2937',
    lineHeight: '1.2',
    wordBreak: 'break-word',
    margin: '0',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical'
  };

  const noImagePriceStyle = {
    fontSize: '11px',
    color: '#6b7280',
    fontWeight: '600',
    margin: '0'
  };

  const noImageButtonStyle = {
    padding: '4px 8px',
    fontSize: '12px',
    color: 'white',
    borderRadius: '4px',
    border: 'none',
    background: 'linear-gradient(135deg, var(--brand, #D9232E) 0%, var(--brand, #D9232E) 100%)',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
  };

  const noImageButtonOverlayStyle = {
    position: 'absolute',
    bottom: '4px',
    right: '4px',
    zIndex: 10
  };

  const noImageQuantityPillStyle = {
    display: 'flex',
    alignItems: 'center',
    background: 'white',
    borderRadius: '12px',
    border: '1px solid #d1d5db',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    overflow: 'hidden',
    fontSize: '11px'
  };

  return (
    <div style={cardStyle}>
      {item.image_url ? (
        // Card with image
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
      ) : (
        // Card without image
        <div style={noImageCardStyle}>
          <div style={noImageContentStyle}>
            <h3 style={noImageTitleStyle}>{item.name}</h3>
            <p style={noImagePriceStyle}>₹{item.price}</p>
          </div>
          <div style={noImageButtonOverlayStyle}>
            {qty === 0 ? (
              <button
                onClick={handleAdd}
                style={noImageButtonStyle}
              >
                Add
              </button>
            ) : (
              <div style={noImageQuantityPillStyle}>
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
      {item.image_url && (
        <div style={contentStyle}>
          <h3 style={titleStyle}>{item.name}</h3>
          <p style={priceStyle}>₹{item.price}</p>
        </div>
      )}
    </div>
  );
} 