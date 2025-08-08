import React from 'react';
import { useCartStore, useSessionStore, addItemToCart, updateCartItem, deleteCartItem } from '@qrmenu/core';

export function StackedNoMediaList({ items = [], onItemClick }) {
  const { items: cartItems } = useCartStore();
  const { memberPid } = useSessionStore();

  const getInitials = (name) => {
    if (!name) return '';
    const parts = String(name).trim().split(/\s+/);
    return (parts[0]?.[0] || '').concat(parts[1]?.[0] || '').toUpperCase();
  };
  const hashToHue = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
      hash &= hash;
    }
    return Math.abs(hash) % 360;
  };
  const getPastelGradient = (seed) => {
    const h = hashToHue(seed || 'seed');
    const h2 = (h + 35) % 360;
    const c1 = `hsl(${h}, 80%, 88%)`;
    const c2 = `hsl(${h2}, 76%, 78%)`;
    return `linear-gradient(135deg, ${c1}, ${c2})`;
  };

  const containerStyle = {
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.9)',
    border: '1px solid rgba(17,24,39,0.06)',
    boxShadow: '0 12px 30px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
    overflow: 'hidden'
  };

  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    background: 'transparent',
    cursor: 'pointer'
  };

  const dividerStyle = {
    height: 1,
    background: 'rgba(17,24,39,0.06)',
    margin: '0 12px'
  };

  const avatarStyle = {
    position: 'relative',
    width: 54,
    height: 54,
    borderRadius: 14,
    overflow: 'hidden',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.6)'
  };

  const titleStyle = {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#0F172A',
    fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    lineHeight: 1.35,
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  };

  const chipStyle = {
    fontSize: 11,
    color: '#374151',
    background: 'rgba(17,24,39,0.06)',
    border: '1px solid rgba(17,24,39,0.08)',
    padding: '4px 8px',
    borderRadius: 999,
    whiteSpace: 'nowrap',
    fontWeight: 500,
    letterSpacing: '-0.01em'
  };

  const rightStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0
  };

  const priceStyle = {
    fontSize: 14,
    color: '#C72C48',
    fontWeight: 700,
    whiteSpace: 'nowrap',
    fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  };

  const addButtonStyle = {
    width: 38,
    height: 38,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFF',
    background: '#C72C48',
    border: 'none',
    borderRadius: 12,
    boxShadow: '0 10px 20px rgba(199,44,72,0.25)'
  };

  const quantityPillStyle = {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(255,255,255,0.95)',
    borderRadius: 18,
    border: '1px solid rgba(17,24,39,0.08)'
  };
  const quantityButtonStyle = {
    padding: '6px 10px',
    border: 'none',
    background: 'transparent',
    fontWeight: 600,
    cursor: 'pointer'
  };
  const quantityStyle = { fontSize: 12, fontWeight: 600, padding: '0 8px' };

  const getUserCartData = (menuItemId) => {
    const userItems = cartItems.filter(ci => ci.menu_item_pid === menuItemId && ci.member_pid === memberPid);
    const qty = userItems.reduce((t, x) => t + x.qty, 0);
    return { qty, first: userItems[0] };
  };

  const handleAdd = (menuItem) => {
    const { qty, first } = getUserCartData(menuItem.id);
    if (qty === 0) {
      addItemToCart(menuItem, 1, '');
    } else if (first) {
      updateCartItem(first.public_id, first.qty + 1, first.note, first.version);
    }
  };

  const handleRemove = (menuItem) => {
    const { first } = getUserCartData(menuItem.id);
    if (!first) return;
    if (first.qty === 1) deleteCartItem(first.public_id, first.version);
    else updateCartItem(first.public_id, first.qty - 1, first.note, first.version);
  };

  return (
    <div style={containerStyle}>
      {items.map((menuItem, idx) => {
        const { qty } = getUserCartData(menuItem.id);
        const chips = Array.isArray(menuItem?.tags) ? menuItem.tags.filter(t => typeof t === 'string' && t.length <= 16).slice(0, 2) : [];
        return (
          <div key={menuItem.id}>
            <div
              style={rowStyle}
              onClick={(e) => {
                if (e.target.closest('button')) return;
                onItemClick?.(menuItem);
              }}
            >
              <div style={avatarStyle} aria-hidden>
                <div style={{ width: '100%', height: '100%', background: getPastelGradient(menuItem?.name || String(menuItem?.id || '')) }} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(0,0,0,0.45)', fontWeight: 700, fontSize: 16, letterSpacing: '0.04em' }}>
                  {getInitials(menuItem?.name)}
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={titleStyle}>{menuItem.name}</div>
                {chips.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    {chips.map((c) => (
                      <span key={c} style={chipStyle}>{c}</span>
                    ))}
                  </div>
                )}
              </div>

              <div style={rightStyle}>
                <div style={priceStyle}>₹{menuItem.base_price}</div>
                {qty === 0 ? (
                  <button
                    style={addButtonStyle}
                    onClick={(e) => { e.stopPropagation(); handleAdd(menuItem); }}
                    aria-label="Add item"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 5v14m-7-7h14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                ) : (
                  <div style={quantityPillStyle}>
                    <button style={quantityButtonStyle} onClick={(e) => { e.stopPropagation(); handleRemove(menuItem); }} aria-label="Decrease quantity">−</button>
                    <span style={quantityStyle}>{qty}</span>
                    <button style={quantityButtonStyle} onClick={(e) => { e.stopPropagation(); handleAdd(menuItem); }} aria-label="Increase quantity">+</button>
                  </div>
                )}
              </div>
            </div>
            {idx < items.length - 1 && <div style={dividerStyle} />}
          </div>
        );
      })}
    </div>
  );
}