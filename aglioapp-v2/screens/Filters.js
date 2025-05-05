import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
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
    <View style={styles.screen}>
      <Text style={styles.topHeading}>Choose Your Preferences</Text>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.row}>
          <TouchableOpacity onPress={() => setVeg(!veg)} style={[styles.chip, veg && styles.chipActive]}>
            <Text style={[styles.chipText, veg && styles.chipTextActive]}>{veg ? 'Veg ✓' : 'Vegetarian'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.heading}>Browse Menu by Food Type</Text>
        {Object.entries(categories).map(([group, briefs]) => (
          <View key={group} style={{ marginBottom: 16 }}>
            <Text style={styles.groupHeading}>{group}</Text>
            <View style={styles.row}>
              {briefs.map(cat => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => toggleCategory(cat)}
                  style={[styles.chip, selectedCategories.includes(cat) && styles.chipActive]}
                >
                  <Text style={[styles.chipText, selectedCategories.includes(cat) && styles.chipTextActive]}>
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
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16 },
  topHeading: { fontSize: 22, fontWeight: 'bold', marginTop: 32, marginBottom: 8, textAlign: 'left' },
  container: { paddingBottom: 100 }, // only vertical padding for button
  row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 0 },
  chip: { padding: 8, borderWidth: 1, borderColor: '#ccc', borderRadius: 16, margin: 4 },
  chipActive: { backgroundColor: '#2196F3', borderColor: '#2196F3' },
  chipText: { color: '#333' },
  chipTextActive: { color: '#fff' },
  heading: { fontSize: 18, fontWeight: 'bold', marginVertical: 8 },
  groupHeading: { fontSize: 16, fontWeight: '600', marginBottom: 4, marginTop: 4 },
  fixedButtonContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    alignItems: 'center',
  },
  nextButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  nextText: { color: '#fff', fontSize: 16 },
});

export default Filters;
