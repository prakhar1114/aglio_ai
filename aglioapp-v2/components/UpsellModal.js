import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TouchableWithoutFeedback, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import DishCardBlock from './blocks/DishCardBlock';
import useStore from '../store';
import { fetchUpsellRecommendations } from '../lib/api';

const UpsellModal = ({ 
  visible, 
  onClose, 
  onNoThanks, 
  navigation,
  initialDelay = 5000, // Default delay of 5 seconds
  autoShow = true,    // Whether to automatically show after delay
  onShow            // Callback to show the modal from parent
}) => {
  // Internal state management for data
  const [upsellResponse, setUpsellResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const cart = useStore(state => state.cart);
  const isCartEmpty = cart.length === 0;

  // Track if we've already fetched data
  const [hasFetched, setHasFetched] = useState(false);
  
  // Setup auto-show timer
  useEffect(() => {
    // Only setup timer if auto-show is enabled and we haven't shown yet
    if (autoShow && initialDelay > 0 && onShow && !isCartEmpty && !hasFetched) {
      const timer = setTimeout(() => {
        onShow();
      }, initialDelay);
      
      return () => clearTimeout(timer);
    }
  }, [autoShow, initialDelay, onShow, isCartEmpty, hasFetched]);
  
  // Fetch upsell recommendations
  useEffect(() => {
    // Only fetch if we haven't already and cart is not empty
    if (!hasFetched && !isCartEmpty && (visible || autoShow)) {
      const fetchData = async () => {
        try {
          setIsLoading(true);
          const response = await fetchUpsellRecommendations();
          setUpsellResponse(response);
          setIsLoading(false);
          setHasFetched(true); // Mark as fetched so we don't fetch again
        } catch (error) {
          console.error('Error fetching upsell recommendations:', error);
          setIsLoading(false);
        }
      };
      
      fetchData();
    }
  }, [autoShow, isCartEmpty, hasFetched]); // No need for visible in dependencies

  // Helper function to render blocks
  const renderBlocks = (blocks) => {
    return (
      <View style={styles.blocksContainer}>
        {blocks.map((block, idx) => {
          switch (block.type) {
            case 'text':
              return (
                <Markdown 
                  key={`text-${idx}`}
                  style={{
                    body: styles.markdownBody,
                    paragraph: styles.markdownParagraph,
                    text: styles.markdownText
                  }}
                >
                  {block.markdown}
                </Markdown>
              );
            
            case 'dish_carousal': // Note: API spells it 'carousal'
              return (
                <View key={`carousel-${idx}`} style={styles.carouselContainer}>
                  {block.title && (
                    <Text style={styles.carouselTitle}>{block.title}</Text>
                  )}
                  <FlatList
                    data={block.options}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    renderItem={({ item }) => <DishCardBlock {...item} />}
                    keyExtractor={item => `carousel-item-${item.id}`}
                    contentContainerStyle={styles.carouselContent}
                  />
                </View>
              );
            
            default:
              return (
                <Text key={`unknown-${idx}`} style={styles.modalText}>
                  Unsupported content type: {block.type}
                </Text>
              );
          }
        })}
      </View>
    );
  };

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.centeredView}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalView}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>You might also like</Text>
                <TouchableOpacity 
                  style={styles.closeButton} 
                  onPress={onClose}
                >
                  <Ionicons name="close" size={24} color="#000" />
                </TouchableOpacity>
              </View>
              
              {isLoading ? (
                <Text style={styles.modalText}>Loading recommendations...</Text>
              ) : (
                <>
                  {upsellResponse && upsellResponse.blocks && renderBlocks(upsellResponse.blocks)}
                </>
              )}
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.modalDeclineBtn}
                  onPress={onNoThanks}
                >
                  <Text style={styles.modalBtnText}>Continue</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  modalText: {
    marginBottom: 15,
    textAlign: 'center',
    fontSize: 16,
    color: '#444',
  },
  modalButtons: {
    marginTop: 15,
    alignItems: 'center',
  },
  modalDeclineBtn: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    marginTop: 10,
    width: '100%',
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
  blocksContainer: {
    marginBottom: 15,
  },
  // Markdown text styles
  markdownBody: {
    padding: 0,
    marginBottom: 10,
  },
  markdownParagraph: {
    marginBottom: 5,
    fontSize: 16,
    color: '#333',
  },
  markdownText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  // Carousel styles
  carouselContainer: {
    marginBottom: 15,
  },
  carouselTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  carouselContent: {
    paddingRight: 20,
  },
});

export default UpsellModal;
