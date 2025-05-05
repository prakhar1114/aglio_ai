import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SectionList, Modal } from 'react-native';
import useStore from '../store';
import api, { baseURL } from '../lib/api';
import ItemCard from '../components/ItemCard';
import ItemPreviewModal from '../components/ItemPreviewModal';
import SkeletonLoader from '../components/SkeletonLoader';
import ErrorToast from '../components/ErrorToast';
import FloatingCartFab from '../components/FloatingCartFab';
import qs from 'qs';

const Menu = () => {
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

  return (
    <View style={styles.container}>
      {sections.length === 0 ? (
        <Text style={{ textAlign: 'center', marginTop: 24 }}>No menu items found.</Text>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id.toString()}
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
      <FloatingCartFab />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: '#fff',
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
