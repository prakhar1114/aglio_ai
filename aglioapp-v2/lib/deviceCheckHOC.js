import React from 'react';
import { Platform } from 'react-native';
import DesktopWarning from '../components/DesktopWarning';

const withDeviceCheck = (WrappedComponent) => (props) => {
  if (Platform.OS === 'web') {
    return <DesktopWarning />;
  }
  return <WrappedComponent {...props} />;
};

export default withDeviceCheck;
