import React from 'react';
import ContentLoader, { Rect } from 'react-content-loader/native';
import { View } from 'react-native';

const SkeletonLoader = ({ type = 'list', count = 5, style }) => {
  if (type === 'list') {
    return (
      <View style={style}>
        {[...Array(count)].map((_, i) => (
          <ContentLoader
            key={i}
            speed={1.5}
            width={360}
            height={80}
            backgroundColor="#f3f3f3"
            foregroundColor="#ecebeb"
            style={{ marginBottom: 12 }}
          >
            <Rect x="16" y="16" rx="8" ry="8" width="60" height="60" />
            <Rect x="88" y="24" rx="4" ry="4" width="180" height="16" />
            <Rect x="88" y="48" rx="4" ry="4" width="120" height="12" />
          </ContentLoader>
        ))}
      </View>
    );
  }
  // Add more skeleton types as needed
  return null;
};

export default SkeletonLoader;
