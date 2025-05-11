import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  StyleSheet, 
  Modal, 
  SafeAreaView 
} from 'react-native';
import api from '../lib/api';
import useStore from '../store';
import { setFiltersCookie } from '../lib/session';

const FilterModal = ({ visible, onClose }) => {
  const setFilters = useStore(state => state.setFilters);
  const currentFilters = useStore(state => state.filters);
  
  // categories is now an object: { [group_category]: [category_brief, ...] }
  const [categories, setCategories] = useState({});
  const [veg, setVeg] = useState(currentFilters.veg || false);
  const [selectedCategories, setSelectedCategories] = useState(currentFilters.categories || []);
  const [selectedCategoryBriefs, setSelectedCategoryBriefs] = useState(currentFilters.category_brief || []);

  useEffect(() => {
    if (visible) {
      // Reset to current filters whenever modal opens
      setVeg(currentFilters.veg || false);
      setSelectedCategories(currentFilters.categories || []);
      setSelectedCategoryBriefs(currentFilters.category_brief || []);
      
      // Fetch categories
      api.get('/categories')
        .then(res => {
          if (Array.isArray(res.data)) {
            // Group by group_category
            const grouped = res.data.reduce((acc, item) => {
              if (!acc[item.group_category]) acc[item.group_category] = [];
              acc[item.group_category].push(item.category_brief);
              return acc;
            }, {});
            setCategories(grouped);
          } else {
            setCategories({});
          }
        })
        .catch(err => console.error(err));
    }
  }, [visible, currentFilters]);

  const toggleCategory = (cat) => {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories(selectedCategories.filter(c => c !== cat));
      setSelectedCategoryBriefs(selectedCategoryBriefs.filter(c => c !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
      setSelectedCategoryBriefs([...selectedCategoryBriefs, cat]);
    }
  };

  const handleApply = () => {
    const newFilters = { 
      veg, 
      categories: selectedCategories, 
      category_brief: selectedCategoryBriefs 
    };
    
    setFilters(newFilters);
    setFiltersCookie(newFilters);
    onClose();
  };

  const handleReset = () => {
    setVeg(false);
    setSelectedCategories([]);
    setSelectedCategoryBriefs([]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.centeredView}>
        <View style={styles.modalView}>
          <View style={styles.header}>
            <Text style={styles.topHeading}>Filters</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.vegSection}>
              <TouchableOpacity 
                onPress={() => setVeg(!veg)} 
                style={[styles.vegChip, veg && styles.vegChipActive]}
              >
                <Text style={[styles.vegChipText, veg && styles.vegChipTextActive]}>
                  {veg ? 'Veg ✓' : 'Vegetarian'}
                </Text>
              </TouchableOpacity>
            </View>
            
            {Object.entries(categories).map(([group, briefs]) => (
              <View key={group} style={styles.categorySection}>
                <Text style={styles.groupHeading}>{group}</Text>
                <View style={styles.categoryRow}>
                  {briefs.map(cat => (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => toggleCategory(cat)}
                      style={[
                        styles.categoryChip, 
                        selectedCategories.includes(cat) && styles.categoryChipActive
                      ]}
                    >
                      <Text style={[
                        styles.categoryChipText, 
                        selectedCategories.includes(cat) && styles.categoryChipTextActive
                      ]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
              <Text style={styles.applyText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    marginTop: 40,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 16,
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    padding: 10,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#333',
  },
  topHeading: { 
    fontSize: 20, 
    fontWeight: '600', 
    textAlign: 'center',
    color: '#333'
  },
  container: { 
    paddingBottom: 20,
  },
  vegSection: { 
    marginBottom: 20,
    alignItems: 'flex-start'
  },
  vegChip: { 
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1, 
    borderColor: '#a52a2a', 
    borderRadius: 30,
    backgroundColor: 'transparent'
  },
  vegChipActive: { 
    backgroundColor: '#a52a2a', 
    borderColor: '#a52a2a' 
  },
  vegChipText: { 
    color: '#a52a2a',
    fontSize: 16,
    fontWeight: '500'
  },
  vegChipTextActive: { 
    color: '#fff' 
  },
  categorySection: { 
    marginBottom: 30 
  },
  categoryRow: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    marginHorizontal: -4
  },
  groupHeading: { 
    fontSize: 18, 
    fontWeight: '600', 
    marginBottom: 12, 
    color: '#333' 
  },
  categoryChip: { 
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1, 
    borderColor: '#ddd', 
    borderRadius: 30, 
    margin: 4,
    backgroundColor: '#fff'
  },
  categoryChipActive: { 
    backgroundColor: '#a52a2a', 
    borderColor: '#a52a2a'
  },
  categoryChipText: { 
    color: '#333',
    fontSize: 15
  },
  categoryChipTextActive: { 
    color: '#fff',
    fontWeight: '500'
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 16,
  },
  resetButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#a52a2a',
    marginRight: 8,
    flex: 1,
    alignItems: 'center',
  },
  resetText: {
    color: '#a52a2a',
    fontSize: 16,
    fontWeight: '600',
  },
  applyButton: {
    backgroundColor: '#a52a2a',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 30,
    flex: 1,
    alignItems: 'center',
  },
  applyText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default FilterModal;
