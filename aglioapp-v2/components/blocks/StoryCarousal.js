import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Dimensions,
  FlatList,
  Platform
} from 'react-native';
import { generateImageUrl } from '../../lib/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function StoryCarousal({ stories = [], options = [], type = 'story_carousal' }) {
  // Use options prop if provided (from blockRenderers), otherwise use stories prop
  const storyItems = options.length > 0 ? options : stories;
  const [modalVisible, setModalVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewedStories, setViewedStories] = useState({});

  // Navigation functions for story viewer
  const goToNextStory = () => {
    if (currentIndex < storyItems.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      closeStoryModal();
    }
  };

  const goToPreviousStory = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const openStoryModal = (index) => {
    setCurrentIndex(index);
    setModalVisible(true);
    
    // Mark story as viewed
    setViewedStories(prev => ({
      ...prev,
      [storyItems[index].id]: true
    }));
  };

  const closeStoryModal = () => {
    setModalVisible(false);
  };

  const renderStoryItem = ({ item, index }) => {
    const isViewed = viewedStories[item.id];
    const storyImage = item.image_url ? generateImageUrl(item.image_url) : null;
    
    return (
      <TouchableOpacity
        style={styles.storyItemSquare}
        onPress={() => openStoryModal(index)}
        accessibilityRole="button"
        accessibilityLabel={`View story from ${item.name}`}
      >
        <View style={[
          styles.storySquare,
          isViewed ? styles.viewedStoryBorderSquare : styles.unviewedStoryBorderSquare
        ]}>
          {storyImage ? (
            <Image 
              source={{ uri: storyImage }} 
              style={styles.storyImageSquare} 
            />
          ) : (
            <View style={styles.placeholderImageSquare}>
              <Text style={styles.storyInitialSquare}>
                {item.name ? item.name[0].toUpperCase() : "S"}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderFullScreenStory = () => {
    if (!storyItems.length || currentIndex >= storyItems.length) return null;
    
    const currentStory = storyItems[currentIndex];
    const storyImage = currentStory.image_url ? generateImageUrl(currentStory.image_url) : null;

    return (
      <View style={styles.fullScreenStory}>
        <View style={styles.storyHeader}>
          <View style={styles.storyProgressContainer}>
            {storyItems.map((_, index) => (
              <View 
                key={index} 
                style={[
                  styles.storyProgressBar,
                  index === currentIndex ? styles.activeProgress : 
                  index < currentIndex ? styles.completedProgress : styles.inactiveProgress
                ]} 
              />
            ))}
          </View>
          <View style={styles.storyUserInfo}>
            <Text style={styles.storyUserName}>{currentStory.name || 'Story'}</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={closeStoryModal}>
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>
        </View>
        
        {storyImage ? (
          <Image 
            source={{ uri: storyImage }} 
            style={styles.fullScreenImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.fullScreenPlaceholder}>
            <Text style={styles.placeholderText}>No Image</Text>
          </View>
        )}
        
        {currentStory.description && (
          <View style={styles.storyCaption}>
            <Text style={styles.storyCaptionText}>{currentStory.description}</Text>
          </View>
        )}
        
        {/* Navigation buttons for web compatibility */}
        <View style={styles.navigationControls}>
          {currentIndex > 0 && (
            <TouchableOpacity 
              style={[styles.navButton, styles.prevButton]} 
              onPress={goToPreviousStory}
              accessibilityLabel="Previous story"
            >
              <Text style={styles.navButtonText}>‹</Text>
            </TouchableOpacity>
          )}
          
          {currentIndex < storyItems.length - 1 && (
            <TouchableOpacity 
              style={[styles.navButton, styles.nextButton]} 
              onPress={goToNextStory}
              accessibilityLabel="Next story"
            >
              <Text style={styles.navButtonText}>›</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (!storyItems || storyItems.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={storyItems}
        renderItem={renderStoryItem}
        keyExtractor={(item) => item.id.toString()}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storyList}
      />
      
      <Modal
        animationType="fade"
        transparent={false}
        visible={modalVisible}
        onRequestClose={closeStoryModal}
      >
        {renderFullScreenStory()}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  storyItemSquare: {
    alignItems: 'center',
    marginHorizontal: 10,
    width: 120,
    height: 170,
    justifyContent: 'flex-start',
  },
  storySquare: {
    width: 120,
    height: 160,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
  },
  unviewedStoryBorderSquare: {
    borderColor: '#F99305',
  },
  viewedStoryBorderSquare: {
    borderColor: '#DBDBDB',
  },
  storyImageSquare: {
    width: 114,
    height: 154,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
  },
  placeholderImageSquare: {
    width: 114,
    height: 154,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyInitialSquare: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#94a3b8',
  },
  container: {
    marginVertical: 10,
  },
  storyList: {
    paddingHorizontal: 10,
  },
  storyItem: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: 70,
  },
  storyCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unviewedStoryBorder: {
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 34,
    backgroundColor: 'transparent',
    padding: 2,
    // Instagram-style gradient border
    backgroundColor: '#F99305',
    borderWidth: 0,
    padding: 2,
    overflow: 'hidden',
  },
  viewedStoryBorder: {
    borderWidth: 2,
    borderColor: '#DBDBDB',
    borderRadius: 34,
    padding: 2,
  },
  storyImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f1f5f9',
  },
  placeholderImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyInitial: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#94a3b8',
  },
  storyTitle: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 70,
  },
  // Full screen story styles
  fullScreenStory: {
    flex: 1,
    backgroundColor: '#000',
  },
  storyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    padding: 10,
    flexDirection: 'column',
  },
  storyProgressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingTop: 10,
  },
  storyProgressBar: {
    flex: 1,
    height: 2,
    marginHorizontal: 2,
    borderRadius: 1,
  },
  activeProgress: {
    backgroundColor: '#FFFFFF',
  },
  completedProgress: {
    backgroundColor: '#FFFFFF',
  },
  inactiveProgress: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  storyUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 36,
    marginLeft: 0,
    marginRight: 60,
    alignSelf: 'flex-start',
  },
  storyUserName: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 20,
    letterSpacing: 0.1,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  fullScreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  fullScreenPlaceholder: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#FFFFFF',
    fontSize: 18,
  },
  storyCaption: {
    position: 'absolute',
    bottom: 50,
    left: 10,
    right: 10,
    padding: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
  },
  storyCaptionText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  navigationControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 20,
    zIndex: 10,
  },
  prevButton: {
    position: 'absolute',
    left: 0,
  },
  nextButton: {
    position: 'absolute',
    right: 0,
  },
  navButtonText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
});
