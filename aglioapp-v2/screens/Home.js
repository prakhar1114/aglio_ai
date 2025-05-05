import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const Home = () => {
  const navigation = useNavigation();
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Menu')}>
        <Text style={styles.cardText}>Menu</Text>
      </TouchableOpacity>
      {/* <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('AI')}>
        <Text style={styles.cardText}>AI Recommendations</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Success')}>
        <Text style={styles.cardText}>Our Recs</Text>
      </TouchableOpacity> */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  card: { backgroundColor: '#4F8EF7', padding: 20, marginVertical: 10, borderRadius: 8, width: '100%', alignItems: 'center' },
  cardText: { fontSize: 18 },
});

export default Home;
