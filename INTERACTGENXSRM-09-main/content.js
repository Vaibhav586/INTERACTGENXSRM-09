console.log("✅ InteractAI content script loaded on", location.href);

// Store highlighted elements for cleanup
let highlightedElements = [];
let highlightTimeout = null;

/**
 * Extract comprehensive page snapshot
 */
function extractPageSnapshot() {
  try {
    // Get main content area (try common containers first)
    const mainContent = document.querySelector('main, article, [role="main"], .content, #content') || document.body;
    
    // Extract headings with hierarchy
    const headings = [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")]
      .map(h => ({
        level: h.tagName.toLowerCase(),
        text: h.innerText.trim(),
        id: h.id || null
      }))
      .filter(h => h.text.length > 0);
    
    // Extract meaningful paragraphs (skip very short ones)
    const paragraphs = [...mainContent.querySelectorAll("p")]
      .map(p => p.innerText.trim())
      .filter(text => text.length > 20)
      .slice(0, 30);
    
    // Extract links with context
    const links = [...document.querySelectorAll("a[href]")]
      .map(a => ({
        text: a.innerText.trim(),
        href: a.href,
        title: a.title || a.getAttribute('aria-label') || ''
      }))
      .filter(link => link.text.length > 0)
      .slice(0, 100);
    
    // Extract meta information
    const meta = {
      description: document.querySelector('meta[name="description"]')?.content || '',
      keywords: document.querySelector('meta[name="keywords"]')?.content || '',
      author: document.querySelector('meta[name="author"]')?.content || ''
    };
    
    // Get visible text content (first 2000 chars)
    const visibleText = mainContent.innerText.substring(0, 2000).trim();
    
    // Detect pricing information
    const pricingElements = findPricingElements();
    
    // Detect contact information
    const contactInfo = findContactInfo();
    
    return {
      url: location.href,
      title: document.title,
      meta,
      headings,
      paragraphs,
      links,
      content: visibleText,
      hasPricing: pricingElements.length > 0,
      hasContact: contactInfo.length > 0,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error("Error extracting snapshot:", error);
    return {
      url: location.href,
      title: document.title,
      content: document.body?.innerText?.substring(0, 1000) || "Unable to extract content",
      error: error.message
    };
  }
}

/**
 * Find pricing-related elements on the page
 */
function findPricingElements() {
  const pricingKeywords = ['price', 'pricing', 'cost', '$', '€', '£', 'usd', 'free', 'premium', 'subscription', 'plan'];
  const elements = [];
  
  // Search in common pricing sections
  const containers = document.querySelectorAll('[class*="price"], [class*="pricing"], [id*="price"], [id*="pricing"]');
  
  containers.forEach(el => {
    if (isVisible(el)) {
      elements.push(el);
    }
  });
  
  // If no specific containers found, search by text content
  if (elements.length === 0) {
    const allElements = document.querySelectorAll('div, section, article, span, p, h1, h2, h3, h4');
    allElements.forEach(el => {
      const text = el.innerText?.toLowerCase() || '';
      if (pricingKeywords.some(keyword => text.includes(keyword)) && isVisible(el)) {
        elements.push(el);
      }
    });
  }
  
  return elements.slice(0, 10);
}

/**
 * Find contact information elements
 */
function findContactInfo() {
  const contactKeywords = ['contact', 'email', 'phone', 'call', 'reach', 'support', 'help'];
  const elements = [];
  
  // Search for email addresses
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const bodyText = document.body.innerText;
  const emails = bodyText.match(emailRegex);
  
  // Search for phone numbers
  const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const phones = bodyText.match(phoneRegex);
  
  // Find elements with contact keywords
  const allElements = document.querySelectorAll('[class*="contact"], [id*="contact"], a[href^="mailto:"], a[href^="tel:"]');
  
  allElements.forEach(el => {
    if (isVisible(el)) {
      elements.push(el);
    }
  });
  
  // Search by text content
  if (elements.length === 0) {
    const textElements = document.querySelectorAll('div, section, footer, header, p, span');
    textElements.forEach(el => {
      const text = el.innerText?.toLowerCase() || '';
      if (contactKeywords.some(keyword => text.includes(keyword)) && isVisible(el)) {
        elements.push(el);
      }
    });
  }
  
  return {
    elements: elements.slice(0, 10),
    emails: emails ? [...new Set(emails)].slice(0, 5) : [],
    phones: phones ? [...new Set(phones)].slice(0, 5) : []
  };
}

/**
 * Check if element is visible
 */
function isVisible(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && 
         style.visibility !== 'hidden' && 
         style.opacity !== '0' &&
         el.offsetWidth > 0 && 
         el.offsetHeight > 0;
}

/**
 * Highlight element with animation
 */
function highlightElement(el, color = 'rgba(255, 255, 0, 0.6)') {
  if (!el || !isVisible(el)) return false;
  
  // Store original styles
  const originalStyle = {
    boxShadow: el.style.boxShadow,
    outline: el.style.outline,
    backgroundColor: el.style.backgroundColor,
    transition: el.style.transition
  };
  
  // Apply highlight
  el.style.transition = 'all 0.3s ease';
  el.style.boxShadow = `0 0 0 4px ${color}, 0 0 20px ${color}`;
  el.style.outline = `3px solid ${color}`;
  
  // Scroll to element
  el.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "nearest"
  });
  
  // Track highlighted element
  highlightedElements.push({ el, originalStyle });
  
  // Clear previous timeout
  if (highlightTimeout) {
    clearTimeout(highlightTimeout);
  }
  
  // Remove highlight after 5 seconds
  highlightTimeout = setTimeout(() => {
    removeHighlights();
  }, 5000);
  
  return true;
}

/**
 * Remove all highlights
 */
function removeHighlights() {
  highlightedElements.forEach(({ el, originalStyle }) => {
    if (el && el.style) {
      Object.assign(el.style, originalStyle);
    }
  });
  highlightedElements = [];
}

/**
 * Find elements by text content
 */
function findElementsByText(searchText, options = {}) {
  const {
    exactMatch = false,
    caseSensitive = false,
    limit = 10
  } = options;
  
  const search = caseSensitive ? searchText : searchText.toLowerCase();
  const results = [];
  
  // Search all text-containing elements
  const elements = document.querySelectorAll('*');
  
  for (let el of elements) {
    // Skip script, style, and hidden elements
    if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName) || !isVisible(el)) {
      continue;
    }
    
    // Get direct text content (not including children)
    const text = Array.from(el.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent.trim())
      .join(' ');
    
    if (!text) continue;
    
    const compareText = caseSensitive ? text : text.toLowerCase();
    
    const matches = exactMatch 
      ? compareText === search
      : compareText.includes(search);
    
    if (matches) {
      results.push(el);
      if (results.length >= limit) break;
    }
  }
  
  return results;
}

/**
 * Scroll to section by heading text
 */
function scrollToSection(sectionName) {
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  
  for (let heading of headings) {
    if (heading.innerText.toLowerCase().includes(sectionName.toLowerCase())) {
      heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
      highlightElement(heading, 'rgba(100, 200, 255, 0.6)');
      return true;
    }
  }
  
  return false;
}

/**
 * Read page content aloud
 */
function readPageAloud() {
  // Get main content
  const mainContent = document.querySelector('main, article, [role="main"]') || document.body;
  const text = mainContent.innerText.substring(0, 500); // First 500 chars
  
  return {
    success: true,
    text: text,
    message: "Content ready to be read by popup"
  };
}

/**
 * Handle different action types
 */
function executeAction(action) {
  const { action: actionType, text, options } = action;
  
  switch (actionType) {
    case "navigate": {
  if (!text) return { success: false, message: "No navigation intent specified" };
  
  const navResult = handleNavigation(text, options);
  return navResult;
}
    case "highlight": {
      if (!text) return { success: false, message: "No text specified" };
      
      // Try to find pricing/contact elements first
      let elements = [];
      
      if (text.toLowerCase().includes('pric')) {
        elements = findPricingElements();
      } else if (text.toLowerCase().includes('contact')) {
        const contactInfo = findContactInfo();
        elements = contactInfo.elements;
      } else {
        elements = findElementsByText(text, { limit: 5 });
      }
      
      if (elements.length === 0) {
        return { success: false, message: `No elements found matching: ${text}` };
      }
      
      // Highlight all found elements
      let highlightedCount = 0;
      elements.forEach((el, index) => {
        setTimeout(() => {
          if (highlightElement(el)) {
            highlightedCount++;
          }
        }, index * 100); // Stagger highlights
      });
      
      return { 
        success: true, 
        message: `Highlighted ${elements.length} element(s)`,
        count: elements.length
      };
    }
    
    case "scroll": {
      if (!text) return { success: false, message: "No section specified" };
      
      const success = scrollToSection(text);
      return { 
        success, 
        message: success ? `Scrolled to: ${text}` : `Section not found: ${text}`
      };
    }
    
    case "click": {
      if (!text) return { success: false, message: "No element specified" };
      
      const elements = findElementsByText(text, { limit: 1 });
      if (elements.length > 0 && elements[0].click) {
        elements[0].click();
        return { success: true, message: `Clicked: ${text}` };
      }
      
      return { success: false, message: `Element not found or not clickable: ${text}` };
    }
    
    case "read": {
      return readPageAloud();
    }
    
    case "clear_highlights": {
      removeHighlights();
      return { success: true, message: "Highlights cleared" };
    }
    
    default:
      return { success: false, message: `Unknown action: ${actionType}` };
  }
}
/**
 * Website-specific navigation patterns
 */
const NAVIGATION_PATTERNS = {
  // Amazon
  amazon: {
    orders: [
      '/gp/css/order-history',
      '/your-orders',
      'a[href*="order-history"]',
      'a[href*="your-orders"]'
    ],
    address: [
      '/a/addresses',
      '/gp/css/homepage.html/ref=nav_youraccount_ya',
      'a[href*="addresses"]',
      'a[data-nav-ref="nav_youraccount_btn"]'
    ],
    payment: [
      '/cpe/yourpayments/wallet',
      '/gp/css/homepage.html',
      'a[href*="payment"]',
      'a[href*="wallet"]'
    ],
    cart: [
      '/gp/cart/view.html',
      '#nav-cart',
      'a[href*="cart"]'
    ],
    wishlist: [
      '/hz/wishlist/ls',
      '#nav-wishlist',
      'a[href*="wishlist"]'
    ],
    account: [
      '/gp/css/homepage.html',
      '#nav-link-accountList',
      'a[data-nav-ref="nav_youraccount_btn"]'
    ],
    logout: [
      'a[href*="sign-out"]',
      'a[id*="sign-out"]'
    ]
  },
  
  // eBay
  ebay: {
    orders: [
      '/sh/ord/',
      'a[href*="purchase-history"]',
      'a[href*="myb/PurchaseHistory"]'
    ],
    address: [
      '/usr/address',
      'a[href*="address"]'
    ],
    payment: [
      '/mye/myebay/payment',
      'a[href*="payment"]'
    ],
    account: [
      '/mye/myebay/summary',
      'button[id*="gh-ug"]'
    ],
    selling: [
      '/sh/ovw',
      'a[href*="selling"]'
    ]
  },
  
  // Google
  google: {
    account: [
      'https://myaccount.google.com',
      'a[href*="myaccount.google.com"]'
    ],
    security: [
      'https://myaccount.google.com/security',
      'a[href*="security"]'
    ],
    privacy: [
      'https://myaccount.google.com/privacy',
      'a[href*="privacy"]'
    ],
    data: [
      'https://myaccount.google.com/data-and-privacy',
      'a[href*="data"]'
    ]
  },
  
  // Generic patterns
  generic: {
    profile: [
      '/profile',
      '/account',
      '/settings',
      'a[href*="profile"]',
      'a[href*="account"]',
      'button[aria-label*="profile" i]'
    ],
    settings: [
      '/settings',
      '/preferences',
      'a[href*="settings"]',
      'a[href*="preferences"]',
      'button[aria-label*="settings" i]'
    ],
    orders: [
      '/orders',
      '/purchases',
      'a[href*="orders"]',
      'a[href*="purchases"]'
    ],
    logout: [
      '/logout',
      '/signout',
      'a[href*="logout"]',
      'a[href*="signout"]',
      'a[href*="sign-out"]',
      'button[aria-label*="sign out" i]',
      'button[aria-label*="logout" i]'
    ],
    cart: [
      '/cart',
      '/basket',
      'a[href*="cart"]',
      'a[href*="basket"]',
      'button[aria-label*="cart" i]'
    ]
  }
};

/**
 * Intent to navigation mapping
 */
const INTENT_MAP = {
  // Address related
  'change address': 'address',
  'update address': 'address',
  'edit address': 'address',
  'manage address': 'address',
  'my address': 'address',
  'shipping address': 'address',
  'delivery address': 'address',
  
  // Orders related
  'my orders': 'orders',
  'view orders': 'orders',
  'order history': 'orders',
  'track order': 'orders',
  'previous orders': 'orders',
  'past purchases': 'orders',
  
  // Payment related
  'change payment': 'payment',
  'update payment': 'payment',
  'payment method': 'payment',
  'add card': 'payment',
  'manage payment': 'payment',
  'wallet': 'payment',
  
  // Account related
  'my account': 'account',
  'account settings': 'account',
  'profile settings': 'profile',
  'edit profile': 'profile',
  'my profile': 'profile',
  
  // Cart related
  'my cart': 'cart',
  'shopping cart': 'cart',
  'view cart': 'cart',
  'go to cart': 'cart',
  
  // Wishlist related
  'my wishlist': 'wishlist',
  'wish list': 'wishlist',
  'saved items': 'wishlist',
  
  // Logout
  'log out': 'logout',
  'logout': 'logout',
  'sign out': 'logout',
  'signout': 'logout',
  
  // Security
  'security settings': 'security',
  'privacy settings': 'privacy',
  'my data': 'data'
};

/**
 * Handle navigation based on user intent
 */
function handleNavigation(intent, options = {}) {
  const lowerIntent = intent.toLowerCase().trim();
  const hostname = window.location.hostname.toLowerCase();
  
  // Detect website type
  let siteType = 'generic';
  if (hostname.includes('amazon')) siteType = 'amazon';
  else if (hostname.includes('ebay')) siteType = 'ebay';
  else if (hostname.includes('google')) siteType = 'google';
  
  // Find matching navigation target
  let navTarget = null;
  
  // Check intent map
  for (const [intentPhrase, target] of Object.entries(INTENT_MAP)) {
    if (lowerIntent.includes(intentPhrase)) {
      navTarget = target;
      break;
    }
  }
  
  if (!navTarget) {
    return { 
      success: false, 
      message: `Could not understand navigation intent: "${intent}". Try phrases like "my orders", "change address", etc.` 
    };
  }
  
  // Get navigation patterns for this site
  const sitePatterns = NAVIGATION_PATTERNS[siteType] || {};
  const genericPatterns = NAVIGATION_PATTERNS.generic || {};
  
  const patterns = sitePatterns[navTarget] || genericPatterns[navTarget] || [];
  
  if (patterns.length === 0) {
    return { 
      success: false, 
      message: `"${navTarget}" navigation not supported on ${hostname}` 
    };
  }
  
  // Try to navigate
  for (const pattern of patterns) {
    // Check if it's a URL path
    if (pattern.startsWith('/') || pattern.startsWith('http')) {
      const fullUrl = pattern.startsWith('http') 
        ? pattern 
        : `${window.location.origin}${pattern}`;
      
      window.location.href = fullUrl;
      return { 
        success: true, 
        message: `Navigating to ${navTarget}...`,
        method: 'redirect'
      };
    }
    
    // Check if it's a selector
    const element = document.querySelector(pattern);
    if (element && isVisible(element)) {
      // Highlight before clicking
      highlightElement(element, 'rgba(100, 200, 255, 0.6)');
      
      setTimeout(() => {
        element.click();
      }, 300);
      
      return { 
        success: true, 
        message: `Clicking ${navTarget} link...`,
        method: 'click'
      };
    }
  }
  
  return { 
    success: false, 
    message: `Could not find ${navTarget} on this page. You may need to be logged in.` 
  };
}
function executeSearch(query) {
    if (!query) {
        return { success: false, message: "Search query is empty." };
    }

    const lowerQuery = query.toLowerCase();
    
    // 1. Try to find a standard search input element (input[type="search"], input[type="text"] with name/id containing 'q' or 'search')
    const searchInputs = document.querySelectorAll('input[type="search"], input[type="text"], input[role="searchbox"]');
    
    let targetInput = null;

    // Prioritize inputs that are visible and likely to be the main search bar
    for (const input of searchInputs) {
        const name = input.name || input.id || '';
        if ((name.toLowerCase().includes('search') || name.toLowerCase().includes('q')) && input.offsetParent !== null) {
            targetInput = input;
            break;
        }
    }
    
    // Fallback: If no clear target is found, take the first visible input field
    if (!targetInput) {
        for (const input of searchInputs) {
            if (input.offsetParent !== null) {
                targetInput = input;
                break;
            }
        }
    }

    if (targetInput) {
        // 2. Set the value and dispatch an event (often a 'submit' event on the parent form)
        targetInput.value = query;
        
        // Trigger input event to simulate typing
        targetInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Find the parent form and try to submit it
        let form = targetInput.closest('form');
        if (form) {
            form.submit();
            return { success: true, message: `Successfully searched "${query}" on the current site (submitted form).`, method: 'form_submit' };
        } else {
            // If no form, trigger a keypress (like Enter) or click a nearby search button
            targetInput.dispatchEvent(new KeyboardEvent('keydown', { 'key': 'Enter', 'keyCode': 13, 'bubbles': true }));
            
            // Fallback: Try to find a submit button nearby (e.g., Amazon's search icon)
            const submitButton = document.querySelector('button[type="submit"], [aria-label*="search"], [name*="submit"]');
            if (submitButton && targetInput.closest('div').contains(submitButton)) {
                submitButton.click();
                return { success: true, message: `Successfully searched "${query}" on the current site (clicked button).`, method: 'button_click' };
            }

            return { success: true, message: `Set search term "${query}" but could not submit form automatically.`, method: 'input_set' };
        }
        
    } else {
        return { success: false, message: "Could not find a prominent search input field on this page." };
    }
}

/**
 * Smart click - finds and clicks elements based on text/label
 */
function smartClick(searchText) {
  const lowerSearch = searchText.toLowerCase();
  
  // Find clickable elements (buttons, links)
  const clickables = document.querySelectorAll('a, button, [role="button"], [onclick]');
  
  for (const el of clickables) {
    if (!isVisible(el)) continue;
    
    const text = el.innerText?.toLowerCase() || '';
    const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
    const title = el.getAttribute('title')?.toLowerCase() || '';
    
    if (text.includes(lowerSearch) || ariaLabel.includes(lowerSearch) || title.includes(lowerSearch)) {
      highlightElement(el, 'rgba(100, 200, 255, 0.6)');
      
      setTimeout(() => {
        el.click();
      }, 300);
      
      return { success: true, message: `Clicked: ${el.innerText || searchText}` };
    }
  }
  
  return { success: false, message: `Could not find clickable element: ${searchText}` };
}
/**
 * Message listener
 */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log("📩 Content script received message:", msg.type);

    // This must return true to indicate an asynchronous response (sendResponse) is expected.
    let responseSent = false; 

    try {
        if (msg.type === "GET_SNAPSHOT") {
            const snapshot = extractPageSnapshot();
            console.log("📸 Snapshot extracted:", snapshot);
            sendResponse({ snapshot });
            responseSent = true;
        }

        if (msg.type === "EXECUTE_ACTION") {
            const action = msg.action;
            let result = { success: false, message: "Invalid action." };

            switch (action.action) {
                case "highlight":
                    result = executeHighlight(action.text);
                    break;
                case "scroll":
                    result = executeScroll(action.text);
                    break;
                case "click":
                    result = executeClick(action.text);
                    break;
                case "navigate":
                    result = executeNavigation(action.text);
                    break;
                case "read":
                    result = executeRead();
                    break;
                case "site_search":
                    result = executeSearch(action.text);
                    break;
                default:
                    // If no match, keep the default "Invalid action"
                    break;
            }
            
            // Send the result of the action execution
            sendResponse(result);
            responseSent = true;
        }

    } catch (error) {
        console.error("🔥 Error processing message in content script:", error);
        
        // Ensure a response is sent even on error
        sendResponse({ success: false, error: error.message || "Unknown error during action execution." });
        responseSent = true;
    }

    // Return true if we intend to call sendResponse asynchronously (which is necessary for all these cases)
    // The boolean value of responseSent ensures we only return true if a known action was handled.
    return responseSent; 
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  removeHighlights();
});

console.log("✅ InteractAI content script ready!");