import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  Dimensions
} from 'react-native';
import { generateImageUrl } from '../../lib/api';
import ItemCard from '../ItemCard';
import ItemPreviewModal from '../ItemPreviewModal';
import useStore from '../../store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ThumbnailRow({ options = [], title = "Your Previous Orders" }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  
  const addToCart = useStore((state) => state.addToCart);
  const removeFromCart = useStore((state) => state.removeFromCart);
  const updateQty = useStore((state) => state.updateQty);
  const cart = useStore((state) => state.cart);

  // Function to get cart quantity for an item
  const getCartQty = (itemId) => {
    const cartItem = cart.find(item => item.id === itemId);
    return cartItem ? cartItem.qty || 1 : 0;
  };

  // Show full list modal
  const showItemsList = () => {
    setModalVisible(true);
  };

  // Close list modal
  const closeItemsList = () => {
    setModalVisible(false);
  };

  // Open item preview modal
  const openItemPreview = (item) => {
    // Check if the image_url is already a full URL (contains http or https)
    // If it's not, then process it with generateImageUrl
    const isFullUrl = item.image_url && (item.image_url.startsWith('http://') || item.image_url.startsWith('https://'));
    
    const processedItem = {
      ...item,
      image_url: isFullUrl ? item.image_url : (item.image_url ? generateImageUrl(item.image_url) : null)
    };
    
    setSelectedItem(processedItem);
    setPreviewModalVisible(true);
  };

  // Close item preview modal
  const closeItemPreview = () => {
    setPreviewModalVisible(false);
  };

  // Render thumbnail item
  const renderThumbnail = ({ item, index }) => {
    const imageUrl = item.image_url ? generateImageUrl(item.image_url) : null;
    
    return (
      <View style={styles.thumbnailContainer}>
        <Image 
          source={imageUrl ? { uri: imageUrl } : require('../../assets/icon.png')} 
          style={styles.thumbnail}
        />
      </View>
    );
  };

  // Render item in full list
  const renderListItem = ({ item }) => {
    // Check if the image_url is already a full URL (contains http or https)
    // If it's not, then process it with generateImageUrl
    const isFullUrl = item.image_url && (item.image_url.startsWith('http://') || item.image_url.startsWith('https://'));
    
    const processedItem = {
      ...item,
      image_url: isFullUrl ? item.image_url : (item.image_url ? generateImageUrl(item.image_url) : null)
    };
    
    return (
      <ItemCard
        item={processedItem}
        cartQty={getCartQty(item.id)}
        onAdd={addToCart}
        onRemove={removeFromCart}
        onQtyChange={updateQty}
        onPress={() => openItemPreview(processedItem)}
        showDescription={false}
        isVertical={false}
      />
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.sectionContainer}
        onPress={showItemsList}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.viewAll}>View All</Text>
        </View>
        
        <FlatList
          data={options}
          renderItem={renderThumbnail}
          keyExtractor={(item) => item.id.toString()}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbnailList}
        />
      </TouchableOpacity>
      
      {/* Full items list modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeItemsList}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
              <TouchableOpacity onPress={closeItemsList} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={options}
              renderItem={renderListItem}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.listContainer}
            />
          </View>
        </View>
      </Modal>
      
      {/* Item preview modal */}
      {selectedItem && (
        <ItemPreviewModal
          visible={previewModalVisible}
          item={selectedItem}
          onClose={closeItemPreview}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  sectionContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  viewAll: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '600',
  },
  thumbnailList: {
    paddingVertical: 4,
  },
  thumbnailContainer: {
    marginRight: 8, // Small separation between items
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#4B5563',
    fontWeight: 'bold',
  },
  listContainer: {
    paddingBottom: 20,
  },
});
