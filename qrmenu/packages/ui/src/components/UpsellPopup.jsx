import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { ItemCard } from './ItemCard.jsx';

export function UpsellPopup({ isCartOpen, onClose }) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasShown, setHasShown] = useState(false);

  // Mock upsell items - in real app this would come from API
  const upsellItems = [
    {
      id: 'upsell-fries',
      name: 'Crispy Fries',
      image_url: '/images/fries.jpg',
      price: 4.99,
      description: 'Perfectly seasoned golden fries'
    },
    {
      id: 'upsell-drink',
      name: 'Soft Drink',
      image_url: '/images/drink.jpg', 
      price: 2.99,
      description: 'Refreshing cola or lemon soda'
    }
  ];

  useEffect(() => {
    // Check if upsell has been shown before
    const onceUpsellShown = localStorage.getItem('qr_upsell_shown');
    if (onceUpsellShown) {
      setHasShown(true);
      return;
    }

    // Show upsell 5 seconds after cart opens for the first time
    if (isCartOpen && !hasShown) {
      const timer = setTimeout(() => {
        setIsVisible(true);
        localStorage.setItem('qr_upsell_shown', 'true');
        setHasShown(true);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [isCartOpen, hasShown]);

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-sm w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Complete your meal! 🍟
          </h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-gray-600 mb-4">
            Other customers often add these items to their order:
          </p>
          
          <div className="space-y-3">
            {upsellItems.map((item) => (
              <div key={item.id} className="border rounded-lg p-3">
                <div className="flex items-center space-x-3">
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-16 h-16 object-cover rounded-lg"
                    loading="lazy"
                  />
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{item.name}</h3>
                    <p className="text-sm text-gray-600">{item.description}</p>
                    <p className="text-lg font-semibold text-green-600">
                      ${item.price}
                    </p>
                  </div>
                  <button className="bg-red-500 text-white px-3 py-1 rounded-full text-sm hover:bg-red-600 transition-colors">
                    Add
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-6 flex space-x-3">
            <button
              onClick={handleClose}
              className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Not now
            </button>
            <button
              onClick={handleClose}
              className="flex-1 py-2 px-4 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 