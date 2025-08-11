import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import Card from '../components/Card';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import ImageUpload from '../components/ImageUpload';
import { apiService } from '../services/api';

function EditMenuItemPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { publicId } = useParams();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category_brief: '',
    group_category: '',
    veg_flag: false,
    is_bestseller: false,
    is_recommended: false,
    promote: false,
    show_on_menu: true,
    priority: 0,
    tags: [],
    image_path: '',
    cloudflare_image_id: '',
    cloudflare_video_id: '',
    timing_start: '',
    timing_end: ''
  });

  useEffect(() => {
    const fetchMenuItem = async () => {
      try {
        setFetching(true);
        const item = await apiService.getMenuItem(user.api_key, publicId);
        
        setFormData({
          name: item.name || '',
          description: item.description || '',
          price: item.price?.toString() || '',
          category_brief: item.category_brief || '',
          group_category: item.group_category || '',
          veg_flag: item.veg_flag || false,
          is_bestseller: item.is_bestseller || false,
          is_recommended: item.is_recommended || false,
          promote: item.promote || false,
          show_on_menu: item.show_on_menu !== false,
          priority: item.priority || 0,
          tags: item.tags || [],
          image_path: item.image_path || '',
          cloudflare_image_id: item.cloudflare_image_id || '',
          cloudflare_video_id: item.cloudflare_video_id || '',
          timing_start: item.timing_start || '',
          timing_end: item.timing_end || ''
        });
      } catch (error) {
        console.error('Error fetching menu item:', error);
        toast.error('Failed to load menu item');
        navigate('/menu-items');
      } finally {
        setFetching(false);
      }
    };

    if (publicId) {
      fetchMenuItem();
    }
  }, [publicId, user.api_key, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const itemData = {
        ...formData,
        price: parseFloat(formData.price),
        tags: formData.tags.filter(tag => tag.trim())
      };

      // Remove empty fields for update
      Object.keys(itemData).forEach(key => {
        if (itemData[key] === '' || itemData[key] === null || itemData[key] === undefined) {
          delete itemData[key];
        }
      });

      console.log('Updating menu item with data:', itemData);
      const result = await apiService.updateMenuItem(user.api_key, publicId, itemData);
      console.log('Update result:', result);
      toast.success('Menu item updated successfully!');
      navigate('/menu-items');
    } catch (error) {
      console.error('Error updating menu item:', error);
      toast.error('Failed to update menu item');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  if (fetching) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mb-4" />
          <p className="text-gray-600">Loading menu item...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/menu-items')}
                className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <h1 className="text-xl font-semibold text-gray-900">Edit Menu Item</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Card>
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price *
                </label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  required
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <input
                  type="text"
                  name="category_brief"
                  value={formData.category_brief}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Group Category
                </label>
                <input
                  type="text"
                  name="group_category"
                  value={formData.group_category}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Timing Start (Optional)
              </label>
              <input
                type="time"
                name="timing_start"
                value={formData.timing_start}
                onChange={handleChange}
                placeholder="HH:MM (24-hour format)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
              <p className="text-xs text-gray-500 mt-1">Leave empty for all-day availability</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Timing End (Optional)
              </label>
              <input
                type="time"
                name="timing_end"
                value={formData.timing_end}
                onChange={handleChange}
                placeholder="HH:MM (24-hour format)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
              <p className="text-xs text-gray-500 mt-1">Leave empty for all-day availability</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="veg_flag"
                  checked={formData.veg_flag}
                  onChange={handleChange}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span className="ml-2 text-sm text-gray-700">Vegetarian</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="is_bestseller"
                  checked={formData.is_bestseller}
                  onChange={handleChange}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span className="ml-2 text-sm text-gray-700">Bestseller</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="is_recommended"
                  checked={formData.is_recommended}
                  onChange={handleChange}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span className="ml-2 text-sm text-gray-700">Recommended</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="promote"
                  checked={formData.promote}
                  onChange={handleChange}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span className="ml-2 text-sm text-gray-700">Promote</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="show_on_menu"
                  checked={formData.show_on_menu}
                  onChange={handleChange}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span className="ml-2 text-sm text-gray-700">Show on Menu</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                name="tags"
                value={Array.isArray(formData.tags) ? formData.tags.join(', ') : formData.tags}
                onChange={(e) => {
                  const tags = e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag);
                  setFormData(prev => ({
                    ...prev,
                    tags: tags
                  }));
                }}
                placeholder="tag1, tag2, tag3"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Media
              </label>
              <ImageUpload
                currentImageUrl={formData.image_path}
                currentCloudflareImageId={formData.cloudflare_image_id}
                currentCloudflareVideoId={formData.cloudflare_video_id}
                onImageChange={(cloudflareImageId) => {
                  setFormData(prev => ({
                    ...prev,
                    cloudflare_image_id: cloudflareImageId,
                    cloudflare_video_id: null // Clear video when image is set
                  }));
                }}
                onVideoChange={(cloudflareVideoId) => {
                  setFormData(prev => ({
                    ...prev,
                    cloudflare_video_id: cloudflareVideoId,
                    cloudflare_image_id: null // Clear image when video is set
                  }));
                }}
              />
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/menu-items')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={loading}
              >
                Update Menu Item
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

export default EditMenuItemPage; 