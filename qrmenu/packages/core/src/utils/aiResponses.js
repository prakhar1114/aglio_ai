// AI Response utility functions
export const getAIResponse = (userInput) => {
  const input = userInput.toLowerCase();
  
  if (input.includes('recommend') || input.includes('suggest')) {
    return "I'd recommend our bestsellers: the Classic Burger ($12.99) and Margherita Pizza ($14.99). Both are customer favorites! 🌟";
  }
  if (input.includes('vegan') || input.includes('vegetarian')) {
    return "Great choice! We have several vegan options: Beyond Burger, Quinoa Salad, and Veggie Pizza. Would you like details on any of these? 🌱";
  }
  if (input.includes('spicy') || input.includes('hot')) {
    return "For spicy food lovers, try our Buffalo Chicken Wings, Jalapeño Burger, or Spicy Pasta Arrabbiata! 🌶️";
  }
  if (input.includes('allergen') || input.includes('allergy')) {
    return "Please let me know your specific allergies and I'll help you find safe options. We clearly mark all allergens in our menu items. 🛡️";
  }
  if (input.includes('price') || input.includes('cheap') || input.includes('budget')) {
    return "Our budget-friendly options under $10 include: Classic Fries ($4.99), Soup of the Day ($6.99), and Mini Pizza ($8.99)! 💰";
  }
  if (input.includes('tell me more')) {
    return "That's a great choice! This dish is one of our popular items. It's made with fresh ingredients and has received excellent reviews from our customers. Would you like to know about ingredients, preparation, or similar items? 😊";
  }
  
  return "I'd be happy to help you with your order! You can ask me about menu recommendations, dietary restrictions, prices, or any other questions about our food. 😊";
}; 