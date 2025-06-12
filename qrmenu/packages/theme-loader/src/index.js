/**
 * QR Menu Theme Loader
 * Loads theme configuration and injects CSS variables
 */

export async function loadTheme() {
  try {
    // Fetch theme configuration from public/theme.json
    const response = await fetch('/theme.json');
    if (!response.ok) {
      throw new Error(`Failed to load theme: ${response.status}`);
    }
    
    const theme = await response.json();
    
    // Inject CSS variables into :root
    injectThemeVariables(theme);
    
    return theme;
  } catch (error) {
    console.warn('Failed to load theme, using defaults:', error);
    // Return default theme
    const defaultTheme = {
      brandColor: '#D9232E',
      fontHeading: "'Inter', sans-serif",
      logo: '/placeholder-logo.png',
      instagram: null,
      extras: {}
    };
    
    injectThemeVariables(defaultTheme);
    return defaultTheme;
  }
}

function injectThemeVariables(theme) {
  const root = document.documentElement;
  
  // Core theme variables
  if (theme.brandColor) {
    root.style.setProperty('--brand', theme.brandColor);
    root.style.setProperty('--brand-rgb', hexToRgb(theme.brandColor));
  }
  
  if (theme.fontHeading) {
    root.style.setProperty('--font-heading', theme.fontHeading);
  }
  
  // Additional theme variables
  if (theme.secondaryColor) {
    root.style.setProperty('--secondary', theme.secondaryColor);
  }
  
  if (theme.backgroundColor) {
    root.style.setProperty('--background', theme.backgroundColor);
  }
  
  if (theme.textColor) {
    root.style.setProperty('--text', theme.textColor);
  }
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? 
    `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : 
    '217, 35, 46'; // fallback to default brand color
} 