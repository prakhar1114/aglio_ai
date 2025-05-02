import React from "react";
import { SafeAreaView, View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import ConfettiCannon from "react-native-confetti-cannon";

const { width } = Dimensions.get('window');

export default function OrderCelebration({ orderItems, onStartOver }) {
  return (
    <SafeAreaView style={{flex:1, backgroundColor:'#fff'}}>
      <View style={{flex:1, justifyContent:'flex-start', alignItems:'center', paddingTop:32}}>
        <ConfettiCannon count={80} origin={{x: width/2, y: 0}} fadeOut={true} fallSpeed={3500} explosionSpeed={500}/>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.headline}>Congratulations on your order!</Text>
        <Text style={styles.subheadline}>Great choice! 🍽️</Text>
        <Text style={styles.instruction}>Show this page to your waiter to place your order.</Text>
        <ScrollView style={{width:'100%', marginVertical:24}} contentContainerStyle={{paddingBottom:120}}>
          {orderItems.map(item => (
            <View key={item.id} style={styles.itemCard}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>₹{item.price}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
      <View style={styles.bottomArea}>
        <TouchableOpacity onPress={onStartOver} style={styles.startOverButton}>
          <Text style={styles.startOverText}>🔄 Start Over</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  emoji: {
    fontSize: 48,
    marginBottom: 12,
    textAlign: 'center',
  },
  headline: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 6,
    color: '#222',
  },
  subheadline: {
    fontSize: 16,
    textAlign: 'center',
    color: '#4CAF50',
    marginBottom: 8,
    fontWeight: '600',
  },
  instruction: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    marginBottom: 10,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e7ff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    padding: 12,
    marginBottom: 10,
    marginHorizontal: 8,
  },
  itemName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#222',
  },
  itemPrice: {
    fontWeight: '600',
    fontSize: 16,
    color: '#222',
  },
  bottomArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
  },
  startOverButton: {
    backgroundColor: '#e0e7ff',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  startOverText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3b3b3b',
  },
});
