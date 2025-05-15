import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Topbar from '../components/Topbar';
import Sidebar from '../components/Sidebar';
import StoryCarousal from '../components/blocks/StoryCarousal';
import ButtonGroup from '../components/blocks/ButtonGroup';
import FloatingCartFab from '../components/FloatingCartFab';
import QuickRepliesPreview from '../components/QuickRepliesPreview';
import { fetchFeaturedDishes } from '../lib/api';
import useStore from '../store';

const Home = () => {
  const navigation = useNavigation();
  
  // Sidebar state and animation
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const sidebarAnimation = useRef(new Animated.Value(0)).current;
  
  // Get featured dishes from Zustand store
  const featuredDishes = useStore((state) => state.featuredDishes);
  const setFeaturedDishes = useStore((state) => state.setFeaturedDishes);
  const [loading, setLoading] = useState(true);
  
  // Toggle sidebar function
  const toggleSidebar = useCallback((forceClose = false) => {
    const newVisibility = forceClose ? false : !sidebarVisible;
    const toValue = newVisibility ? 1 : 0;
    
    Animated.timing(sidebarAnimation, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start();
    
    setSidebarVisible(newVisibility);
  }, [sidebarVisible, sidebarAnimation]);
  
  // Fetch featured dishes only if not already loaded
  useEffect(() => {
    const loadFeaturedDishes = async () => {
      // Check if we have data in the store
      if (featuredDishes) {
        setLoading(false);
        return;
      }
      
      // Otherwise fetch the data
      setLoading(true);
      try {
        const data = await fetchFeaturedDishes();
        if (data && data.blocks) {
          setFeaturedDishes(data);
        }
      } catch (error) {
        console.error('Error loading featured dishes:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadFeaturedDishes();
  }, []);
  
  // Configure button for Browse Menu
  const menuButtons = [
    { text: 'Browse Menu', path: 'Menu' }
  ];
  
  // Sample quick reply questions
  const quickReplyOptions = [
    'Tell me the chef specials?',
    'Recommend me the creamiest pasta',
    'What is Ravioli?',
    "Best Sellers?",
  ];
  
  return (
    <View style={styles.container}>
      <Topbar 
        heading="Home" 
        onMenuPress={toggleSidebar}
        showMenuButton={true}
      />
      
      <Sidebar 
        isVisible={sidebarVisible} 
        sidebarAnimation={sidebarAnimation} 
        toggleSidebar={toggleSidebar} 
      />
      
      <View style={styles.contentContainer}>
        {featuredDishes && featuredDishes.blocks && featuredDishes.blocks.length > 0 && (
          <View style={styles.featuredSection}>
            {featuredDishes.blocks.map((block, index) => {
              if (block.type === 'story_carousal') {
                return (
                  <StoryCarousal 
                    key={`block-${index}`}
                    stories={block.options} 
                    title={block.title || "Featured Dishes"}
                  />
                );
              }
              return null;
            })}
          </View>
        )}
        
        <View style={styles.buttonSection}>
          <ButtonGroup 
            options={menuButtons}
            title="What would you like to do?"
          />
        </View>
        
        <View style={styles.aiAssistantSection}>
          <View style={styles.aiAssistantHeader}>
            <Text style={styles.aiAssistantTitle}>Need any help? Ask our AI Assistant</Text>
          </View>
          
          <QuickRepliesPreview options={quickReplyOptions} />
          
          <TouchableOpacity 
            style={styles.openChatButton}
            onPress={() => navigation.navigate('AI')}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={24} color="#fff" style={styles.chatIcon} />
            <Text style={styles.openChatButtonText}>Open Chat</Text>
          </TouchableOpacity>
        </View>
      </View>
      <FloatingCartFab />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 0,
    marginVertical: 0,
  },
  featuredSection: {
    marginBottom: 0,
  },
  buttonSection: {
    marginTop: 0,
    marginBottom: 0,
  },
  aiAssistantSection: {
    backgroundColor: '#F0F4F8',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  aiAssistantHeader: {
    paddingHorizontal: 0,
    marginBottom: 8,
  },
  aiAssistantTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  openChatButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatIcon: {
    marginRight: 8,
  },
  openChatButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default Home;
