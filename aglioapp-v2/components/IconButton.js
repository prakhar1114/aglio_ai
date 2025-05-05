import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';

const IconButton = ({ name, size = 24, color = '#000', onPress }) => (
  <TouchableOpacity onPress={onPress} style={{ padding: 8 }}>
    <Feather name={name} size={size} color={color} />
  </TouchableOpacity>
);

export default IconButton;
