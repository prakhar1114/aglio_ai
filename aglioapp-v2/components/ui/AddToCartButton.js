import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useStore from '../../store';
import QtyStepper from './QtyStepper';

/**
 * A reusable component that handles the add to cart button and quantity stepper
 * transitions and logic.
 */
export default function AddToCartButton({ 
  itemId, 
  itemData, 
  style, 
  onAdd,
  isVertical = false,
  useIcon = true,
  buttonText = 'Add to Cart'
}) {
  const cart = useStore((state) => state.cart);
  const addToCart = useStore((state) => state.addToCart);
  const updateQty = useStore((state) => state.updateQty);
  
  const [added, setAdded] = useState(false);
  const [qty, setQty] = useState(1);
  
  // Check if item is in cart and set initial state
  useEffect(() => {
    const cartItem = cart.find(item => item.id === itemId);
    setAdded(!!cartItem);
    setQty(cartItem ? cartItem.qty : 1);
  }, [cart, itemId]);
  
  const handleAddToCart = () => {
    if (!itemData) return;
    
    addToCart(itemData);
    
    // Call optional callback if provided
    if (onAdd) {
      onAdd(itemData);
    }
  };
  
  const handleQtyChange = (newQty) => {
    setQty(newQty);
    if (newQty <= 0) {
      setAdded(false);
    }
    updateQty(itemId, newQty);
  };
  
  // Check if style has backgroundColor to determine if we're in a parent container
  const isInParentContainer = style && (style.backgroundColor === 'transparent' || style.backgroundColor === undefined);
  
  if (!added) {
    // If we're in a parent container, render a TouchableOpacity with the content
    if (isInParentContainer) {
      return (
        <TouchableOpacity 
          style={[styles.contentContainer, style]}
          onPress={handleAddToCart}
          accessibilityLabel={`Add ${itemData?.name || 'item'} to cart`}
          accessibilityRole="button"
        >
          {useIcon ? (
            <Ionicons name="add" size={20} color="#fff" />
          ) : (
            <Text style={styles.addButtonText}>{buttonText}</Text>
          )}
        </TouchableOpacity>
      );
    }
    
    // Otherwise, render with TouchableOpacity
    return (
      <TouchableOpacity 
        style={[styles.addButton, style]} 
        onPress={handleAddToCart}
        accessibilityLabel={`Add ${itemData?.name || 'item'} to cart`}
        accessibilityRole="button"
      >
        {useIcon ? (
          <Ionicons name="add" size={20} color="#fff" />
        ) : (
          <Text style={styles.addButtonText}>+</Text>
        )}
      </TouchableOpacity>
    );
  }
  
  // For QtyStepper, check if it's in a parent container
  if (isInParentContainer) {
    return (
      <View style={[styles.contentContainer, style]}>
        <QtyStepper
          qty={qty}
          onChange={handleQtyChange}
          style={styles.qtyStepperInContainer}
          isVertical={isVertical}
        />
      </View>
    );
  }
  
  // Otherwise render it directly
  return (
    <QtyStepper
      qty={qty}
      onChange={handleQtyChange}
      style={[styles.qtyStepper, style]}
      isVertical={isVertical}
    />
  );
}

const styles = StyleSheet.create({
  addButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  qtyStepper: {
    // No specific styles needed as the parent will define positioning
  },
  qtyStepperInContainer: {
    height: '100%',
    width: '100%',
    alignSelf: 'center',
    borderRadius: 10,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
});
