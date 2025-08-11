import { createContext, useContext, useState, useEffect } from 'react';
import { apiService } from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const savedUser = localStorage.getItem('menu_editor_user');
    const savedToken = localStorage.getItem('menu_editor_token');
    
    if (savedUser && savedToken) {
      setUser(JSON.parse(savedUser));
      setIsAuthenticated(true);
    }
    
    setLoading(false);
  }, []);

  const login = async (restaurantSlug, apiKey) => {
    try {
      const data = await apiService.login(restaurantSlug, apiKey);
      
      if (data.success) {
        setUser({
          restaurant_name: data.restaurant_name,
          restaurant_slug: data.restaurant_slug,
          api_key: apiKey,
        });
        setIsAuthenticated(true);
        
        // Save to localStorage
        localStorage.setItem('menu_editor_user', JSON.stringify({
          restaurant_name: data.restaurant_name,
          restaurant_slug: data.restaurant_slug,
          api_key: apiKey,
        }));
        localStorage.setItem('menu_editor_token', apiKey);
        
        return { success: true };
      } else {
        throw new Error(data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('menu_editor_user');
    localStorage.removeItem('menu_editor_token');
  };

  const value = {
    isAuthenticated,
    user,
    login,
    logout,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 