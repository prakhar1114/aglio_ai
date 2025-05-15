import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, SectionList, Modal, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Topbar from '../components/Topbar';
import Sidebar from '../components/Sidebar';
import useStore from '../store';
import api, { baseURL } from '../lib/api';
import ItemCard from '../components/ItemCard';
import ItemPreviewModal from '../components/ItemPreviewModal';
import SkeletonLoader from '../components/SkeletonLoader';
import ErrorToast from '../components/ErrorToast';
import FloatingCartFab from '../components/FloatingCartFab';
import ChatFAB from '../components/ChatFAB';
import ChatSheet from '../components/ChatSheet';
import FilterModal from '../components/FilterModal';
import qs from 'qs';

const Menu = () => {
  // Sidebar state and animation
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const sidebarAnimation = useRef(new Animated.Value(0)).current;
  
  // Toggle sidebar function
  const toggleSidebar = useCallback((forceClose = false) => {

    // If forceClose is true, always close the sidebar
    // Otherwise, toggle between open and closed
    const newVisibility = forceClose ? false : !sidebarVisible;
    const toValue = newVisibility ? 1 : 0;
    

    Animated.timing(sidebarAnimation, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start();
    
    setSidebarVisible(newVisibility);
  }, [sidebarVisible]);
  const navigation = useNavigation();
  const filters = useStore(state => state.filters);
  const sessionId = useStore(state => state.sessionId);
  const addToCart = useStore(state => state.addToCart);
  const updateQty = useStore(state => state.updateQty);
  const removeFromCart = useStore(state => state.removeFromCart);
  const cart = useStore(state => state.cart);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [chatVisible, setChatVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState('');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const sectionListRef = useRef(null);
  
  // Set current dish in store when selected for chat context
  useEffect(() => {
    if (selectedItem) {
      useStore.setState({ currentDish: selectedItem });
    }
  }, [selectedItem]);

  useEffect(() => {
    const fetchMenu = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = {
          session_id: sessionId,
        };
        if (filters.veg !== undefined) params.is_veg = filters.veg;
        if (filters.category_brief && filters.category_brief.length > 0) params.category_brief = filters.category_brief;
        if (filters.price_cap) params.price_cap = filters.price_cap;
        const res = await api.get('/menu', {
  params,
  paramsSerializer: params => qs.stringify(params, { arrayFormat: 'repeat' }),
});
        const menuWithFullImageUrl = res.data.map(item => ({
          ...item,
          image_url: item.image_url
            ? item.image_url.startsWith('http')
              ? item.image_url
              : `${baseURL.replace(/\/$/, '')}/${item.image_url.replace(/^\//, '')}`
            : null,
        }));
        setMenu(menuWithFullImageUrl);
      } catch (err) {
        setError('Failed to fetch menu.');
      } finally {
        setLoading(false);
      }
    };
    fetchMenu();
  }, [filters, sessionId]);

  if (loading) return <SkeletonLoader type="list" count={6} style={{ marginTop: 32 }} />;
  if (error) return <ErrorToast message={error} />;

  // Group menu items by category_brief and convert to SectionList format
  const sections = Object.entries(
    menu.reduce((acc, item) => {
      const category = item.category_brief || 'Other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(item);
      return acc;
    }, {})
  ).map(([title, data]) => ({ title, data }));

  // Function to scroll to a specific section
  const scrollToSection = (sectionTitle) => {
    // Removed setActiveCategory to prevent selection from moving after clicking
    const sectionIndex = sections.findIndex(section => section.title === sectionTitle);
    if (sectionIndex !== -1 && sectionListRef.current) {
      sectionListRef.current.scrollToLocation({
        sectionIndex,
        itemIndex: 0,
        animated: true,
        viewOffset: 0
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* Topbar */}
      <Topbar 
        heading="Menu" 
        onMenuPress={toggleSidebar} 
        buttonText="Home" 
        buttonPath="Home" 
      />
      
      {/* Sidebar */}
      <Sidebar 
        isVisible={sidebarVisible} 
        sidebarAnimation={sidebarAnimation} 
        toggleSidebar={toggleSidebar}
      />
      <View style={styles.contentContainer}>
        <View style={styles.headerContainer}>
          <View style={styles.filterRow}>
            <TouchableOpacity 
              style={[
                styles.filterPill, 
                Object.keys(filters).length > 0 && styles.activeFilterPill
              ]}
              onPress={() => setFilterModalVisible(true)}
            >
              <Text style={[
                styles.filterPillText,
                Object.keys(filters).length > 0 && styles.activeFilterPillText
              ]}>Filters</Text>
            </TouchableOpacity>

            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              style={styles.categoriesScrollView}
              contentContainerStyle={styles.categoriesContainer}
            >
              {sections.map((section) => (
                <TouchableOpacity 
                  key={section.title} 
                  style={[styles.categoryPill, activeCategory === section.title && styles.activeCategoryPill]}
                  onPress={() => scrollToSection(section.title)}
                >
                  <Text style={[styles.categoryPillText, activeCategory === section.title && styles.activeCategoryPillText]}>
                    {section.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
      </View>
      {sections.length === 0 ? (
        <Text style={{ textAlign: 'center', marginTop: 24 }}>No menu items found.</Text>
      ) : (
        <SectionList
          ref={sectionListRef}
          sections={sections}
          keyExtractor={(item) => (item && item.id ? item.id.toString() : Math.random().toString())}
          onViewableItemsChanged={({viewableItems}) => {
            if (viewableItems && viewableItems.length > 0 && viewableItems[0] && viewableItems[0].section) {
              setActiveCategory(viewableItems[0].section.title);
            }
          }}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          renderItem={({ item }) => {
            const cartQty = cart.find(i => i.id === item.id)?.qty || 0;
            return (
              <ItemCard
                item={item}
                cartQty={cartQty}
                onPress={() => {
                  setSelectedItem(item);
                  setModalVisible(true);
                }}
                onAdd={addToCart}
                onQtyChange={updateQty}
                onRemove={removeFromCart}
                isVertical={true}
              />
            );
          }}
          renderSectionHeader={({ section: { title } }) => (
            <Text style={styles.categoryHeader}>{title}</Text>
          )}
          contentContainerStyle={{ paddingBottom: 32 }}
        />
      )}
      <Modal
        visible={modalVisible}
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <ItemPreviewModal
          item={selectedItem}
          onClose={() => setModalVisible(false)}
        />
      </Modal>
      </View>
      <FloatingCartFab />
      <ChatFAB onPress={() => setChatVisible(true)} />
      <ChatSheet open={chatVisible} onClose={() => setChatVisible(false)} />
      <FilterModal visible={filterModalVisible} onClose={() => setFilterModalVisible(false)} />
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
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerContainer: {
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
  },
  filterPill: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginRight: 10,
    flexShrink: 0, // Prevent the button from shrinking
  },
  filterPillText: {
    fontWeight: '600',
    color: '#333',
  },
  categoriesScrollView: {
    flex: 1, // Take remaining space
  },
  categoriesContainer: {
    paddingRight: 8,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  activeCategoryPill: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  activeFilterPill: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  categoryPillText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  activeCategoryPillText: {
    color: '#FFF',
  },
  activeFilterPillText: {
    color: '#FFF',
  },
  categoryHeader: {
    fontWeight: 'bold',
    fontSize: 16,
    paddingVertical: 4,
    paddingLeft: 2,
    marginTop: 8,
    marginBottom: 2,
    backgroundColor: 'transparent',
  },
});

export default Menu;
