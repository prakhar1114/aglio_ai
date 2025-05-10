import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import useStore from '../../store';
import analytics from '../../lib/analytics';
import { generateImageUrl } from '../../lib/api';
import AddToCartButton from '../ui/AddToCartButton';
import ItemPreviewModal from '../ItemPreviewModal';

export default function DishCardBlock({ id, name, price, image_url, tags = [], description = '' }) {
  const [modalVisible, setModalVisible] = useState(false);
  const image = image_url ? generateImageUrl(image_url) : null;
  
  // Create item data object to be passed to AddToCartButton and ItemPreviewModal
  const itemData = {
    id,
    name,
    price,
    image_url: image,
    tags,
    description
  };
  
  // Handle analytics tracking when item is added
  const handleAdd = () => {
    analytics.trackAddFromChat(id, name);
  };
  
  // Handle card press to open modal
  const handleCardPress = () => {
    setModalVisible(true);
  };
  
  // Prevent event bubbling for AddToCartButton
  const handleAddButtonPress = (e) => {
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
  };

  // Format price to display with ₹ symbol
  const formattedPrice = `₹${price}`;

  return (
    <>
      <TouchableOpacity 
        style={styles.container}
        onPress={handleCardPress}
        accessibilityRole="button"
        accessibilityLabel={`View details of ${name}`}
      >
        {image ? (
          <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.placeholderImage]}>
            <Text style={styles.placeholderText}>No Image</Text>
          </View>
        )}
        
        <View style={styles.contentContainer}>
          {/* Name on first line */}
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          
          {/* Price and AddToCartButton on second line */}
          <View style={styles.priceActionRow}>
            <Text style={styles.price}>{formattedPrice}</Text>
            <TouchableOpacity 
              onPress={handleAddButtonPress}
              style={styles.addButtonWrapper}
            >
              <AddToCartButton
                itemId={id}
                itemData={itemData}
                style={styles.addButton}
                onAdd={handleAdd}
                useIcon={true}
              />
            </TouchableOpacity>
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
        </View>
      </TouchableOpacity>
      
      <ItemPreviewModal
        visible={modalVisible}
        item={itemData}
        onClose={() => setModalVisible(false)}
      />
    </>
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
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  priceActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  addButtonWrapper: {
    // Wrapper to prevent event bubbling
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
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    width: 80, // Increased from 28 to 80 to show the full stepper
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
