import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import useStore from '../store';
import { initializeSocket, disconnectSocket } from '../lib/socket';
import { createSession, setUserCookie, clearCookies } from '../lib/session';
import { fetchFeaturedDishes, fetchPreviousOrders, addBrowseMenuButton } from '../lib/api';

const Auth = () => {
  const navigation = useNavigation();
  const setUser = useStore((state) => state.setUser);
  const setSessionId = useStore((state) => state.setSessionId);
  const resetStore = useStore((state) => state.resetStore);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState({
    name: '',
    phone: '',
    email: ''
  });

  const validateForm = () => {
    let isValid = true;
    const newErrors = {
      name: '',
      phone: '',
      email: ''
    };

    // Validate name
    if (!name.trim()) {
      newErrors.name = 'Name is required';
      isValid = false;
    }

    // Validate phone
    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required';
      isValid = false;
    }

    // Validate email
    if (!email.trim()) {
      newErrors.email = 'Email is required';
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async () => {
    if (validateForm()) {
      // Disconnect websocket, clear all cookies and reset store before creating a new session
      disconnectSocket();
      clearCookies();
      resetStore();
      
      // Create new session and set user data
      createSession();
      setSessionId();
      setUserCookie({ name, phone, email });
      setUser({ name, phone, email });
      
      // Fetch featured dishes and previous orders before initializing socket
      // await fetchFeaturedDishes();
      // await fetchPreviousOrders();
      // await addBrowseMenuButton();
      initializeSocket();
      
      navigation.navigate('Filters');
    }
  };

  const handleSkip = async () => {
    // Disconnect websocket, clear all cookies and reset store before creating a new session
    disconnectSocket();
    clearCookies();
    resetStore();
    
    // Create new session
    createSession();
    setSessionId();
    
    // Fetch featured dishes and previous orders before initializing socket
    // await fetchFeaturedDishes();
    // await addBrowseMenuButton();
    initializeSocket();
    
    navigation.navigate('Filters');
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        {/* <Image source={require('../assets/aglio.png')} style={styles.logo} /> */}
        <Image source={require('../assets/chianti.jpeg')} style={styles.logo} />
        <Text style={styles.restaurantName}>Welcome to Chianti Ristorante</Text>
        <Text style={styles.subtitle}>Experience Simply Authentic Italian Cuisine</Text>
      </View>
      
      <TextInput 
        style={[styles.input, errors.name ? styles.inputError : null]} 
        value={name} 
        onChangeText={setName} 
        placeholder="Name" 
      />
      {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
      
      <TextInput 
        style={[styles.input, errors.phone ? styles.inputError : null]} 
        value={phone} 
        onChangeText={setPhone} 
        placeholder="Phone" 
        keyboardType="phone-pad" 
      />
      {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
      
      <TextInput 
        style={[styles.input, errors.email ? styles.inputError : null]} 
        value={email} 
        onChangeText={setEmail} 
        placeholder="Email" 
        keyboardType="email-address" 
      />
      {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
      
      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>Continue</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip for now</Text>
      </TouchableOpacity>
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>Powered by AglioAI</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f9f9f9',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
  },
  restaurantName: {
    fontSize: 22,
    fontWeight: '500',
    marginTop: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    marginTop: 15,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  inputError: {
    borderColor: '#e74c3c',
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 14,
    marginTop: 5,
    marginLeft: 5,
  },
  button: {
    marginTop: 30,
    backgroundColor: '#a52a2a',
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  skipButton: {
    marginTop: 15,
    alignItems: 'center',
    padding: 10,
  },
  skipText: {
    fontSize: 16,
    color: '#666',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  footerText: {
    color: '#888',
    fontSize: 16,
  },
});

export default Auth;
