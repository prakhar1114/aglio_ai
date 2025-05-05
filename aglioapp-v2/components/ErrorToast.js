import { Alert } from '@gluestack-ui/themed';
import React from 'react';

const ErrorToast = ({ message }) => {
  if (!message) return null;
  return (
    <Alert action="error" variant="solid" style={{ margin: 16 }}>
      {message}
    </Alert>
  );
};

export default ErrorToast;
