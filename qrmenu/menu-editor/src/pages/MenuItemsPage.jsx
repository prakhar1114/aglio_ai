import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeftIcon, 
  PlusIcon, 
  MagnifyingGlassIcon,
  FunnelIcon,
  Squares2X2Icon,
  ListBulletIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  PowerIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import Card from '../components/Card';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { apiService } from '../services/api';
import { constructImageUrl } from '../utils/media';

function MenuItemsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'grid' or 'list'
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    category_brief: null,
    group_category: null,
    is_veg: null,
    is_active: null,
    special_filter: null
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    perPage: 50
  });
  const [categories, setCategories] = useState([]);
  const [groupCategories, setGroupCategories] = useState([]);

  useEffect(() => {
    fetchMenuItems();
  }, [filters]); // Fetch when filters change

  const fetchMenuItems = async (page = 1) => {
    try {
      setLoading(true);
      
      // Convert special_filter to individual parameters
      const apiParams = {
        page: page,
        per_page: pagination.perPage,
        category_brief: filters.category_brief,
        group_category: filters.group_category,
        is_veg: filters.is_veg,
        is_active: filters.is_active,
        search: searchTerm
      };

      // Handle special filter
      if (filters.special_filter) {
        switch (filters.special_filter) {
          case 'promote':
            apiParams.promote = 'true';
            break;
          case 'is_bestseller':
            apiParams.is_bestseller = 'true';
            break;
          case 'is_recommended':
            apiParams.is_recommended = 'true';
            break;
        }
      }

      console.log('Fetching menu items with params:', apiParams);
      console.log('Filters state:', filters);
      console.log('Special filter value:', filters.special_filter);
      const data = await apiService.getMenuItems(user.api_key, apiParams);
      console.log('Received data:', data);
      setMenuItems(data.items);
      setPagination(prev => ({
        ...prev,
        currentPage: page,
        totalPages: Math.ceil(data.total / pagination.perPage),
        totalItems: data.total
      }));
      
      // Extract unique categories and group categories from all items
      const allCategories = [...new Set(data.items.map(item => item.category_brief).filter(Boolean))];
      const allGroupCategories = [...new Set(data.items.map(item => item.group_category).filter(Boolean))];
      
      setCategories(allCategories.sort());
      setGroupCategories(allGroupCategories.sort());
    } catch (error) {
      console.error('Error fetching menu items:', error);
      toast.error('Failed to load menu items');
    } finally {
      setLoading(false);
    }
  };



  const handleToggleActive = async (publicId, currentActive) => {
    try {
      const result = await apiService.toggleMenuItemActive(user.api_key, publicId);
      const status = result.is_active ? 'activated' : 'deactivated';
      toast.success(`Menu item ${status} successfully`);
      fetchMenuItems(); // Refresh the list
    } catch (error) {
      console.error('Error toggling menu item active status:', error);
      toast.error('Failed to toggle menu item status');
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchMenuItems(1); // Reset to first page
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mb-4" />
          <p className="text-gray-600">Loading menu items...</p>
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
                onClick={() => navigate('/dashboard')}
                className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <h1 className="text-xl font-semibold text-gray-900">Menu Items</h1>
            </div>
            <Button
              onClick={() => navigate('/menu-items/create')}
              className="flex items-center"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <form onSubmit={handleSearch} className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search menu items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </form>
            </div>

            {/* View Toggle */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md ${
                  viewMode === 'grid' 
                    ? 'bg-red-100 text-red-600' 
                    : 'text-gray-400 hover:text-gray-500'
                }`}
              >
                <Squares2X2Icon className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md ${
                  viewMode === 'list' 
                    ? 'bg-red-100 text-red-600' 
                    : 'text-gray-400 hover:text-gray-500'
                }`}
              >
                <ListBulletIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Filters</h3>
            <button
              onClick={() => {
                setFilters({
                  category_brief: null,
                  group_category: null,
                  is_veg: null,
                  is_active: null,
                  special_filter: null
                });
                setSearchTerm('');
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear All
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Active Status</label>
              <select
                value={filters.is_active || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, is_active: e.target.value || null }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="">All Items</option>
                <option value="true">Active Only</option>
                <option value="false">Inactive Only</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Veg Status</label>
              <select
                value={filters.is_veg || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, is_veg: e.target.value || null }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="">All Items</option>
                <option value="true">Veg Only</option>
                <option value="false">Non-Veg Only</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={filters.category_brief || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, category_brief: e.target.value || null }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Group Category</label>
              <select
                value={filters.group_category || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, group_category: e.target.value || null }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="">All Groups</option>
                {groupCategories.map(group => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Special Filters</label>
              <select
                value={filters.special_filter || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, special_filter: e.target.value || null }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="">All Items</option>
                <option value="promote">Promoted</option>
                <option value="is_bestseller">BestSellers</option>
                <option value="is_recommended">Chef Specials</option>
              </select>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        {menuItems.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No menu items found</h3>
              <p className="text-gray-500 mb-4">Get started by adding your first menu item.</p>
              <Button onClick={() => navigate('/menu-items/new')}>
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Menu Item
              </Button>
            </div>
          </Card>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' : 'space-y-4'}>
            {menuItems.map((item) => (
              <Card key={item.public_id} className="group">
                {viewMode === 'grid' ? (
                  // Grid View
                  <div className={`p-4 ${!item.is_active ? 'opacity-50' : ''}`}>
                                         <div className="relative">
                       {(item.cloudflare_image_id || item.cloudflare_video_id || item.image_path) && (
                         <div className="w-full h-48 bg-gray-200 rounded-lg mb-4 overflow-hidden">
                           {(() => {
                             const mediaInfo = constructImageUrl(
                               item.image_path, 
                               item.cloudflare_image_id, 
                               item.cloudflare_video_id, 
                               'medium'
                             );
                             
                             if (mediaInfo?.type === 'video') {
                               return (
                                 <img 
                                   src={mediaInfo.thumbnail} 
                                   alt={item.name}
                                   className="w-full h-full object-cover"
                                   onError={(e) => {
                                     e.target.style.display = 'none';
                                     e.target.nextSibling.style.display = 'flex';
                                   }}
                                 />
                               );
                             } else if (mediaInfo?.type === 'image') {
                               return (
                                 <img 
                                   src={mediaInfo.url} 
                                   alt={item.name}
                                   className="w-full h-full object-cover"
                                   onError={(e) => {
                                     e.target.style.display = 'none';
                                     e.target.nextSibling.style.display = 'flex';
                                   }}
                                 />
                               );
                             } else {
                               return (
                                 <div className="w-full h-full flex items-center justify-center">
                                   <span className="text-gray-400">No Image</span>
                                 </div>
                               );
                             }
                           })()}
                           <div className="w-full h-full flex items-center justify-center" style={{ display: 'none' }}>
                             <span className="text-gray-400">Image Error</span>
                           </div>
                         </div>
                       )}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex space-x-1">
                          <button
                            onClick={() => handleToggleActive(item.public_id, item.is_active)}
                            className={`p-1 rounded shadow-sm ${
                              item.is_active 
                                ? 'bg-green-500 hover:bg-green-600' 
                                : 'bg-gray-400 hover:bg-gray-500'
                            }`}
                            title={item.is_active ? 'Deactivate' : 'Activate'}
                          >
                            <PowerIcon className="h-4 w-4 text-white" />
                          </button>
                          <button
                            onClick={() => navigate(`/menu-items/${item.public_id}/edit`)}
                            className="p-1 bg-white rounded shadow-sm hover:bg-gray-50"
                          >
                            <PencilIcon className="h-4 w-4 text-gray-600" />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <h3 className="font-semibold text-gray-900 truncate">{item.name}</h3>
                        <span className="text-lg font-bold text-red-600">₹{item.price}</span>
                      </div>
                      
                      {item.description && (
                        <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <div className="flex space-x-1">
                          {!item.is_active && (
                            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">Inactive</span>
                          )}
                          {item.veg_flag && (
                            <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">Veg</span>
                          )}
                          {item.is_bestseller && (
                            <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">Bestseller</span>
                          )}
                          {item.promote && (
                            <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">Promoted</span>
                          )}
                          {item.is_recommended && (
                            <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded">Chef Recommended</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">{item.category_brief}</span>
                      </div>
                      
                      {(item.timing_start || item.timing_end) && (
                        <div className="flex items-center space-x-1 mt-2">
                          <span className="text-xs text-gray-500">Available:</span>
                          <span className="text-xs text-blue-600">
                            {item.timing_start && item.timing_end 
                              ? `${item.timing_start} - ${item.timing_end}`
                              : item.timing_start 
                                ? `From ${item.timing_start}`
                                : `Until ${item.timing_end}`
                            }
                          </span>
                        </div>
                      )}
                      
                      {item.tags && item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {item.tags.map((tag, index) => (
                            <span key={index} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  // List View
                  <div className={`p-4 ${!item.is_active ? 'opacity-50' : ''}`}>
                    <div className="flex items-center justify-between">
                                             <div className="flex items-center space-x-4">
                         {(item.cloudflare_image_id || item.cloudflare_video_id || item.image_path) && (
                           <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                             {(() => {
                               const mediaInfo = constructImageUrl(
                                 item.image_path, 
                                 item.cloudflare_image_id, 
                                 item.cloudflare_video_id, 
                                 'thumbnail'
                               );
                               
                               if (mediaInfo?.type === 'video') {
                                 return (
                                   <img 
                                     src={mediaInfo.thumbnail} 
                                     alt={item.name}
                                     className="w-full h-full object-cover"
                                     onError={(e) => {
                                       e.target.style.display = 'none';
                                       e.target.nextSibling.style.display = 'flex';
                                     }}
                                   />
                                 );
                               } else if (mediaInfo?.type === 'image') {
                                 return (
                                   <img 
                                     src={mediaInfo.url} 
                                     alt={item.name}
                                     className="w-full h-full object-cover"
                                     onError={(e) => {
                                       e.target.style.display = 'none';
                                       e.target.nextSibling.style.display = 'flex';
                                     }}
                                   />
                                 );
                               } else {
                                 return (
                                   <div className="w-full h-full flex items-center justify-center">
                                     <span className="text-gray-400 text-xs">No Image</span>
                                   </div>
                                 );
                               }
                             })()}
                             <div className="w-full h-full flex items-center justify-center" style={{ display: 'none' }}>
                               <span className="text-gray-400 text-xs">Error</span>
                             </div>
                           </div>
                         )}
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-gray-900">{item.name}</h3>
                            <span className="text-lg font-bold text-red-600">₹{item.price}</span>
                          </div>
                          {item.description && (
                            <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                          )}
                          <div className="flex items-center space-x-2 mt-2">
                            {!item.is_active && (
                              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">Inactive</span>
                            )}
                            {item.veg_flag && (
                              <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">Veg</span>
                            )}
                            {item.is_bestseller && (
                              <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">Bestseller</span>
                            )}
                            {item.promote && (
                              <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">Promoted</span>
                            )}
                            {item.is_recommended && (
                              <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded">Chef Recommended</span>
                            )}
                            <span className="text-xs text-gray-500">{item.category_brief}</span>
                          </div>
                          
                          {(item.timing_start || item.timing_end) && (
                            <div className="flex items-center space-x-1 mt-1">
                              <span className="text-xs text-gray-500">Available:</span>
                              <span className="text-xs text-blue-600">
                                {item.timing_start && item.timing_end 
                                  ? `${item.timing_start} - ${item.timing_end}`
                                  : item.timing_start 
                                    ? `From ${item.timing_start}`
                                    : `Until ${item.timing_end}`
                                }
                              </span>
                            </div>
                          )}
                          
                          {item.tags && item.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {item.tags.map((tag, index) => (
                                <span key={index} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      
                                              <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleToggleActive(item.public_id, item.is_active)}
                            className={`p-2 rounded ${
                              item.is_active 
                                ? 'text-green-600 hover:text-green-700' 
                                : 'text-gray-400 hover:text-gray-600'
                            }`}
                            title={item.is_active ? 'Deactivate' : 'Activate'}
                          >
                            <PowerIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => navigate(`/menu-items/${item.public_id}/edit`)}
                            className="p-2 text-gray-400 hover:text-gray-600"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                        </div>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
        
        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {((pagination.currentPage - 1) * pagination.perPage) + 1} to{' '}
              {Math.min(pagination.currentPage * pagination.perPage, pagination.totalItems)} of{' '}
              {pagination.totalItems} items
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => fetchMenuItems(pagination.currentPage - 1)}
                disabled={pagination.currentPage <= 1}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const pageNum = i + 1;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => fetchMenuItems(pageNum)}
                      className={`px-3 py-2 text-sm rounded-md ${
                        pageNum === pagination.currentPage
                          ? 'bg-red-600 text-white'
                          : 'border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => fetchMenuItems(pagination.currentPage + 1)}
                disabled={pagination.currentPage >= pagination.totalPages}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MenuItemsPage; 