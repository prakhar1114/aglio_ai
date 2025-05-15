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

  useEffect(() => {
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
  }, []);

  const toggleCategory = (cat) => {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories(selectedCategories.filter(c => c !== cat));
      setSelectedCategoryBriefs(selectedCategoryBriefs.filter(c => c !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
      setSelectedCategoryBriefs([...selectedCategoryBriefs, cat]);
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
              {briefs.map(cat => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => toggleCategory(cat)}
                  style={[styles.categoryChip, selectedCategories.includes(cat) && styles.categoryChipActive]}
                >
                  <Text style={[styles.categoryChipText, selectedCategories.includes(cat) && styles.categoryChipTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
      
      <View style={styles.fixedButtonContainer}>
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
