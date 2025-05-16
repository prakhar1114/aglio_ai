import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import api from '../lib/api';
import useStore from '../store';

const Filters = () => {
  const navigation = useNavigation();
  const setFilters = useStore(state => state.setFilters);
  const currentFilters = useStore(state => state.filters);
  // categories is now an object: { [group_category]: [category_brief, ...] }
  const [categories, setCategories] = useState({});
  const [veg, setVeg] = useState(currentFilters.veg || false);
  const [selectedCategories, setSelectedCategories] = useState(currentFilters.categories || []);
  const [selectedCategoryBriefs, setSelectedCategoryBriefs] = useState(currentFilters.category_brief || []);
  const [itemCount, setItemCount] = useState(0);

  useEffect(() => {
    api.get('/categories')
      .then(res => {
        if (Array.isArray(res.data)) {
          // Group by group_category with count information
          const grouped = res.data.reduce((acc, item) => {
            if (!acc[item.group_category]) acc[item.group_category] = [];
            acc[item.group_category].push({
              name: item.category_brief,
              totalCount: item.total_count,
              vegCount: item.veg_count,
              nonVegCount: item.total_count - item.veg_count
            });
            return acc;
          }, {});
          setCategories(grouped);
        } else {
          setCategories({});
        }
      })
      .catch(err => console.error(err));
  }, []);

  // Calculate total item count based on current filters
  useEffect(() => {
    // If no categories object yet, return
    if (Object.keys(categories).length === 0) return;
    
    let count = 0;
    
    // If no categories selected, count all items
    if (selectedCategories.length === 0) {
      // Sum up all items (either all or just veg based on filter)
      count = Object.values(categories)
        .flat()
        .reduce((sum, cat) => sum + (veg ? cat.vegCount : cat.totalCount), 0);
    } else {
      // Sum up only selected categories
      count = Object.values(categories)
        .flat()
        .filter(cat => selectedCategories.includes(cat.name))
        .reduce((sum, cat) => sum + (veg ? cat.vegCount : cat.totalCount), 0);
    }
    
    setItemCount(count);
  }, [categories, selectedCategories, veg]);

  const toggleCategory = (cat) => {
    const catName = cat.name;
    if (selectedCategories.includes(catName)) {
      setSelectedCategories(selectedCategories.filter(c => c !== catName));
      setSelectedCategoryBriefs(selectedCategoryBriefs.filter(c => c !== catName));
    } else {
      setSelectedCategories([...selectedCategories, catName]);
      setSelectedCategoryBriefs([...selectedCategoryBriefs, catName]);
    }
  };

  const handleNext = () => {
    setFilters({ veg, categories: selectedCategories, category_brief: selectedCategoryBriefs });
    navigation.navigate('Home');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.topHeading}>Set Your Filters</Text>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.vegSection}>
          <TouchableOpacity onPress={() => setVeg(!veg)} style={[styles.vegChip, veg && styles.vegChipActive]}>
            <Text style={[styles.vegChipText, veg && styles.vegChipTextActive]}>{veg ? 'Veg ✓' : 'Vegetarian'}</Text>
          </TouchableOpacity>
        </View>
        
        {Object.entries(categories).map(([group, briefs]) => (
          <View key={group} style={styles.categorySection}>
            <Text style={styles.groupHeading}>{group}</Text>
            <View style={styles.categoryRow}>
              {briefs.filter(cat => !veg || cat.vegCount > 0).map(cat => (
                <TouchableOpacity
                  key={cat.name}
                  onPress={() => toggleCategory(cat)}
                  style={[styles.categoryChip, selectedCategories.includes(cat.name) && styles.categoryChipActive]}
                >
                  <Text style={[styles.categoryChipText, selectedCategories.includes(cat.name) && styles.categoryChipTextActive]}>
                    {cat.name} ({veg ? cat.vegCount : cat.totalCount})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
      
      <View style={styles.fixedButtonContainer}>
        <View style={styles.countSummary}>
          <Text style={styles.countText}>
            Show {itemCount} items
          </Text>
        </View>
        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextText}>Next</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { 
    flex: 1, 
    backgroundColor: '#f9f9f9', 
    paddingHorizontal: 16 
  },
  topHeading: { 
    fontSize: 24, 
    fontWeight: '600', 
    marginTop: 20, 
    marginBottom: 20, 
    textAlign: 'center',
    color: '#333'
  },
  container: { 
    paddingBottom: 100,
    paddingHorizontal: 8
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
  fixedButtonContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
    alignItems: 'center',
  },
  countSummary: {
    marginBottom: 10,
    paddingHorizontal: 5,
    width: '100%',
    alignItems: 'center',
  },
  countText: {
    fontSize: 15,
    color: '#555',
    fontWeight: '500',
    marginBottom: 5,
  },
  nextButton: {
    backgroundColor: '#a52a2a',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 30,
    alignItems: 'center',
    width: '100%',
  },
  nextText: { 
    color: '#fff', 
    fontSize: 18,
    fontWeight: '600'
  },
});

export default Filters;
