import React, { useState, useRef, useEffect } from 'react';
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
  Platform,
  ActivityIndicator
} from 'react-native';
import AddToCartButton from '../ui/AddToCartButton';
import { generateImageUrl } from '../../lib/api';
import Constants from 'expo-constants';

// Only import WebView for native platforms
let WebView = null;
if (Platform.OS !== 'web') {
  WebView = require('react-native-webview').WebView;
}
const isWeb = Platform.OS === 'web';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function StoryCarousal({ stories = [], options = [], title = 'Featured Stories', type = 'story_carousal' }) {
  // Get Instagram token from environment variables
  const INSTAGRAM_TOKEN = Constants.expoConfig?.extra?.EXPO_PUBLIC_INSTAGRAM_TOKEN || process.env.EXPO_PUBLIC_INSTAGRAM_TOKEN;
  // Use options prop if provided (from blockRenderers), otherwise use stories prop
  const storyItems = options.length > 0 ? options : stories;
  const [modalVisible, setModalVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewedStories, setViewedStories] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // Navigation functions for story viewer
  const goToNextStory = () => {
    if (currentIndex < storyItems.length - 1) {
      setIsLoading(true);
      setCurrentIndex(currentIndex + 1);
    } else {
      closeStoryModal();
    }
  };

  const goToPreviousStory = () => {
    if (currentIndex > 0) {
      setIsLoading(true);
      setCurrentIndex(currentIndex - 1);
    }
  };

  const openStoryModal = (index) => {
    setIsLoading(true);
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
    const hasInstagramContent = currentStory.insta_id && INSTAGRAM_TOKEN;
    let storyImage = null;
    
    // Only set storyImage if we're not showing Instagram content
    if (!hasInstagramContent && currentStory.image_url) {
      storyImage = generateImageUrl(currentStory.image_url);
    }

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
            {hasInstagramContent && (
              <View style={styles.instagramIndicator}>
                <Text style={styles.instagramIndicatorText}>Instagram</Text>
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={closeStoryModal}>
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.contentContainer}>
          {hasInstagramContent ? (
            // Render Instagram embed
            <View style={styles.instagramContainer}>
              {/* Create a touchable area for the center of the screen that doesn't interfere with nav buttons */}
              <View style={styles.instagramContentArea}>
                <View style={styles.instagramCardWrapper}>
                  {Platform.OS !== 'web' && WebView ? (
                    // Use WebView for native platforms
                    <WebView
                      source={{
                        uri: currentStory.insta_id.includes('reel')
                        ? `https://www.instagram.com/reel/${currentStory.insta_id.replace('reel/', '')}/embed/?autoplay=1&mute=1&hidecaption=1&cr=1&rd=1`
                        : `https://www.instagram.com/p/${currentStory.insta_id.replace('p/', '')}/embed/?autoplay=1&mute=1&hidecaption=1`,
                        headers: {
                          'Authorization': `Bearer ${INSTAGRAM_TOKEN}`
                        }
                      }}
                      style={styles.instagramWebView}
                      startInLoadingState={true}
                      javaScriptEnabled={true}
                      domStorageEnabled={true}
                      allowsFullscreenVideo={true}
                      mediaPlaybackRequiresUserAction={false}
                      onLoadEnd={() => setIsLoading(false)}
                      renderLoading={() => (
                        <View style={styles.loadingContainer}>
                          <ActivityIndicator size="large" color="#ffffff" />
                          <Text style={styles.loadingText}>Loading Instagram content...</Text>
                        </View>
                      )}
                      onError={(syntheticEvent) => {
                        const { nativeEvent } = syntheticEvent;
                        console.error('WebView error:', nativeEvent);
                        setIsLoading(false);
                        return (
                          <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>Failed to load Instagram content</Text>
                          </View>
                        );
                      }}
                      allowsInlineMediaPlayback={true}
                      bounces={false}
                    />
                  ) : (
                    // Use iframe for web platform
                    <View style={styles.instagramWebView}>
                      {Platform.OS === 'web' && (
                        <iframe
                          src={currentStory.insta_id.includes('reel') 
                            ? `https://www.instagram.com/reel/${currentStory.insta_id.replace('reel/', '')}/embed/?autoplay=1&mute=1&hidecaption=1&cr=1&rd=1`
                            : `https://www.instagram.com/p/${currentStory.insta_id.replace('p/', '')}/embed/?autoplay=1&mute=1&hidecaption=1`}
                          width="100%"
                          height="100%"
                          frameBorder="0"
                          scrolling="no"
                          allowTransparency="true"
                          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                          style={{ border: 'none', overflow: 'hidden', borderRadius: '12px' }}
                          onLoad={() => setIsLoading(false)}
                        />
                      )}
                    </View>
                  )}
                </View>
                
                {/* Custom Instagram footer */}
                <View style={styles.customInstagramFooter}>
                  <View style={styles.instagramInteractionRow}>
                    <View style={styles.instagramInteractionLeft}>
                      <Text style={styles.instagramLikes}>46 likes</Text>
                    </View>
                    <View style={styles.instagramInteractionRight}>
                      <TouchableOpacity style={styles.instagramButton} accessibilityLabel="View on Instagram">
                        <Text style={styles.instagramButtonText}>View on Instagram</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          ) : storyImage ? (
          // Render regular image
          <Image 
            source={{ uri: storyImage }} 
            style={styles.fullScreenImage}
            resizeMode="cover"
            onLoad={() => setIsLoading(false)}
          />
          ) : (
            // Render placeholder
            <View style={styles.fullScreenPlaceholder}>
              <Text style={styles.placeholderText}>No Image</Text>
            </View>
          )}
        </View>
        
        {currentStory.description && !hasInstagramContent && (
          <View style={styles.storyCaption}>
            <Text style={styles.storyCaptionText}>{currentStory.description}</Text>
          </View>
        )}
        
        {/* Loading indicator overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.loadingOverlayText}>Loading...</Text>
        </View>
      )}
      
      {/* Navigation buttons for web compatibility */}
        {/* Navigation buttons positioned to avoid blocking Instagram content */}
      <View 
        style={[
          styles.navigationControls,
          hasInstagramContent ? styles.instagramNavigationControls : {}
        ]}
        pointerEvents="box-none"
        >
          {currentIndex > 0 && (
            <TouchableOpacity 
              style={[styles.navButton, styles.prevButton]} 
              onPress={goToPreviousStory}
              accessibilityLabel="Previous story"
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              pointerEvents="auto"
            >
              <Text style={styles.navButtonText}>‹</Text>
            </TouchableOpacity>
          )}
          
          {currentIndex < storyItems.length - 1 && (
            <TouchableOpacity 
              style={[styles.navButton, styles.nextButton]} 
              onPress={goToNextStory}
              accessibilityLabel="Next story"
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              pointerEvents="auto"
            >
              <Text style={styles.navButtonText}>›</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* Add to Cart Button */}
        <View style={styles.addToCartContainer}>
          <AddToCartButton
            itemId={currentStory.id}
            itemData={{
              id: currentStory.id,
              name: currentStory.name,
              description: currentStory.description,
              image_url: currentStory.image_url ? generateImageUrl(currentStory.image_url) : null,
              price: currentStory.price || 0
            }}
            style={styles.addToCartButton}
            useIcon={false}
            buttonText="Add to Cart"
          />
        </View>
      </View>
    );
  };

  if (!storyItems || storyItems.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.sectionContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        
        <FlatList
          data={storyItems}
          horizontal
          renderItem={renderStoryItem}
          keyExtractor={(item) => item.id.toString()}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storyList}
        />
      </View>
      
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeStoryModal}
      >
        {renderFullScreenStory()}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  instagramBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  instagramIcon: {
    fontSize: 12,
  },
  contentContainer: {
    flex: 1,
    marginTop: 100, // Add space below the header
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 100, // Adjust height to account for header
  },
  instagramContainer: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 100,
    backgroundColor: '#fff',
    zIndex: 20,
  },
  instagramContentArea: {
    flex: 1,
    width: '100%',
    height: '100%',
    paddingHorizontal: 60, // Reduced padding to give more space for the embed
    justifyContent: 'center', // Changed back to center for vertical centering
    alignItems: 'center',
    paddingTop: 0, // Removed top padding to allow true centering
  },
  instagramCardWrapper: {
    width: '100%',
    maxWidth: 600, // Increased from 500 to 600
    height: '60%', // Reduced from 90% to 60% to truncate vertically
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  instagramWebView: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#fff',
    zIndex: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  customInstagramFooter: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  instagramInteractionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  instagramInteractionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  instagramLikes: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
  },
  instagramInteractionRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  instagramButton: {
    backgroundColor: '#0095F6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  instagramButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f1f1',
  },
  loadingText: {
    fontSize: 16,
    color: '#333',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8d7da',
  },
  errorText: {
    fontSize: 16,
    color: '#721c24',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  loadingOverlayText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 10,
    fontWeight: 'bold',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  loadingOverlayText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 10,
    fontWeight: 'bold',
  },
  instagramIndicator: {
    marginLeft: 10,
    backgroundColor: '#E1306C',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  instagramIndicatorText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  sectionContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 10,
    marginHorizontal: 0,
    marginVertical: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
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
  storyItemSquare: {
    alignItems: 'center',
    marginHorizontal: 6,
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
    paddingHorizontal: 6,
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
    paddingTop: Platform.OS === 'ios' ? 40 : 10, // Add extra padding for iOS status bar
    flexDirection: 'column',
  },
  storyProgressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5, // Reduced from 8 to 5
    paddingTop: 0, // Reduced from 10 to 0
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
    marginTop: 10, // Reduced from 36 to 10
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
    zIndex: 50, // Higher than Instagram content
  },
  instagramNavigationControls: {
    // Special style for when Instagram content is present
    zIndex: 50, // Higher than Instagram content
    pointerEvents: 'box-none',
  },
  navButton: {
    width: 40, // Reduced from 50
    height: 40, // Reduced from 50
    borderRadius: 20, // Adjusted for new size
    backgroundColor: 'rgba(0, 0, 0, 0.7)', // Slightly darker for better visibility
    justifyContent: 'center',
    alignItems: 'center',
    margin: 10, // Reduced from 20
    zIndex: 51, // Higher than the navigationControls container
    elevation: 5, // For Android
    shadowColor: '#000', // For iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
  },
  prevButton: {
    position: 'absolute',
    left: 0,
    top: '50%',
    transform: [{ translateY: -25 }], // Center vertically
  },
  nextButton: {
    position: 'absolute',
    right: 0,
    top: '50%',
    transform: [{ translateY: -25 }], // Center vertically
  },
  navButtonText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 40, // Helps center the text vertically
  },
  addToCartContainer: {
    backgroundColor: '#3B82F6',
    position: 'absolute',
    bottom: 20,
    left: '25%',
    right: '25%',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    width: '50%',
    zIndex: 50,
    borderRadius: 12,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  addToCartButton: {
    // backgroundColor: '#3B82F6',
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    minWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    height: 40,
  },
});
