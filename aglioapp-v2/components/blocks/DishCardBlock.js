import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useStore from '../../store';
import analytics from '../../lib/analytics';
import { generateImageUrl } from '../../lib/api';

export default function DishCardBlock({ id, name, price, image_url, tags = [] }) {
  const addToCart = useStore((state) => state.addToCart);

  const image = image_url ? generateImageUrl(image_url) : null;
  const handleAddToCart = () => {
    addToCart({
      id,
      name,
      price,
      image_url: image,
      tags
    });
    
    // Track the add from chat event
    analytics.trackAddFromChat(id, name);
  };

  // Format price to display with ₹ symbol
  const formattedPrice = `₹${price}`;

  return (
    <View style={styles.container}>
      {image ? (
        <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, styles.placeholderImage]}>
          <Text style={styles.placeholderText}>No Image</Text>
        </View>
      )}
      
      <View style={styles.contentContainer}>
        <View style={styles.textContainer}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={styles.price}>{formattedPrice}</Text>
        </View>
        
        {tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {tags.map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
        
        <TouchableOpacity 
          style={styles.addButton} 
          onPress={handleAddToCart}
          accessibilityLabel={`Add ${name} to cart`}
        >
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    marginVertical: 8,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    width: 280,
  },
  image: {
    width: '100%',
    height: 140,
    backgroundColor: '#f1f5f9',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  contentContainer: {
    padding: 12,
    position: 'relative',
  },
  textContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    paddingRight: 36, // Make space for the add button
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 8,
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  tag: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 4,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 12,
    color: '#64748b',
  },
  addButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
