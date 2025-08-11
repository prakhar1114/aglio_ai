import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/Button';

function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    setIsLoading(true);
    
    try {
      const result = await login(data.restaurant_slug, data.api_key);
      
      if (result.success) {
        toast.success('Login successful!');
        navigate('/dashboard');
      } else {
        toast.error(result.error || 'Login failed');
      }
    } catch (error) {
      toast.error('Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {/* Mobile Header */}
        <div className="sm:hidden text-center mb-8">
          <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-red-100 mb-4">
            <svg
              className="h-10 w-10 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Menu Editor</h1>
          <p className="mt-2 text-sm text-gray-600">Sign in to manage your menu</p>
        </div>

        {/* Desktop Header */}
        <div className="hidden sm:block text-center mb-8">
          <div className="mx-auto h-20 w-20 flex items-center justify-center rounded-full bg-red-100 mb-6">
            <svg
              className="h-12 w-12 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Menu Editor</h1>
          <p className="mt-3 text-base text-gray-600">Sign in to manage your restaurant menu</p>
        </div>
        
        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="restaurant_slug" className="block text-sm font-medium text-gray-700 mb-2">
                  Restaurant Slug
                </label>
                <input
                  {...register('restaurant_slug', { 
                    required: 'Restaurant slug is required' 
                  })}
                  type="text"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors text-base"
                  placeholder="Enter your restaurant slug"
                />
                {errors.restaurant_slug && (
                  <p className="mt-2 text-sm text-red-600">
                    {errors.restaurant_slug.message}
                  </p>
                )}
              </div>
              
              <div>
                <label htmlFor="api_key" className="block text-sm font-medium text-gray-700 mb-2">
                  API Key
                </label>
                <input
                  {...register('api_key', { 
                    required: 'API key is required' 
                  })}
                  type="password"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors text-base"
                  placeholder="Enter your API key"
                />
                {errors.api_key && (
                  <p className="mt-2 text-sm text-red-600">
                    {errors.api_key.message}
                  </p>
                )}
              </div>
            </div>

            <Button
              type="submit"
              loading={isLoading}
              size="lg"
              className="w-full"
            >
              Sign in
            </Button>
          </form>
          
          {/* Help Text */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Need help? Contact your restaurant administrator for login credentials.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage; 