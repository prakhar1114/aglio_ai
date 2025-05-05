import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import PriceTag from './PriceTag';

const PreviewMenu = ({ item, onAdd, onShortlist, onInfo }) => (
  <View style={styles.container}>
    <Image source={{ uri: item.image }} style={styles.image} />
    <View style={styles.content}>
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.description}>{item.description}</Text>
      <PriceTag price={item.price} />
      <View style={styles.actions}>
        <TouchableOpacity style={styles.button} onPress={() => onAdd(item)}>
          <Text style={styles.buttonText}>Add</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => onShortlist(item)}>
          <Text style={styles.buttonText}>Shortlist</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => onInfo(item)}>
          <Text style={styles.buttonText}>Info</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    margin: 10,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 200,
  },
  content: {
    padding: 10,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    backgroundColor: '#2196F3',
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 4,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
  },
});

export default PreviewMenu;
