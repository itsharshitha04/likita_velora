/**
 * Adobe Data Layer XDM Helper (updated)
 * Ensures ACDL events follow the repository-wide contract:
 *  - pageLoaded events (persisted in sessionStorage as aurora_pageData)
 *  - linkClicked events (persisted in sessionStorage as aurora_lastLinkClicked)
 *  - All events include custData for consistent Adobe Launch access
 */

// Initialize Adobe Data Layer if not exists
window.adobeDataLayer = window.adobeDataLayer || [];

/**
 * Helper function to get page type
 * @returns {string} Page type (home, plp, pdp, cart, checkout, thankyou)
 */
function getPageType() {
  const path = window.location.pathname || window.location.href;
  if (path.includes('pdp.html') || path.includes('id=')) return 'pdp';
  if (path.includes('plp.html')) return 'plp';
  if (path.includes('cart.html')) return 'cart';
  if (path.includes('checkout.html')) return 'checkout';
  if (path.includes('thankyou.html')) return 'thankyou';
  return 'home';
}

/**
 * Local custData builder (self-contained so this file is safe to run
 * before adl-utils.js is loaded).
 */
function buildCustDataLocal() {
  const ua = navigator.userAgent || '';
  const platform = (window.innerWidth && window.innerWidth <= 768) || /Mobi|Android/i.test(ua) ? 'mobile website' : 'desktop website';
  const loginStatus = (window.user && window.user.isLoggedIn) ? 'logged-in' : 'guest';
  const customerID = (window.user && window.user.id) ? String(window.user.id) : (window.customerID || '');
  const lang = (document.documentElement && document.documentElement.lang)
    ? (document.documentElement.lang.toLowerCase().includes('hi') ? 'hindi' : 'english')
    : 'english';
  return { loginStatus, platform, customerID, lang };
}

/**
 * Local push helper: pushes to the adobeDataLayer with logging and optional
 * sessionStorage persistence for pageLoaded and linkClicked events.
 */
function localPushToDataLayer(obj) {
  window.adobeDataLayer.push(obj);
  try { console.log('✓ ACDL: ' + (obj.event || 'unknown') + ' tracked:', obj); } catch (e) {}
  try { console.log('📊 ACDL Length:', window.adobeDataLayer.length); } catch (e) {}

  // Persist specific keys required by the restoration flow
  try {
    if (obj.event === 'linkClicked') {
      // Ensure timestamp present
      if (!obj.timestamp) obj.timestamp = Date.now();
      sessionStorage.setItem('aurora_lastLinkClicked', JSON.stringify(obj));
    }
    if (obj.event === 'pageLoaded') {
      // Ensure timestamp present
      if (!obj.timestamp) obj.timestamp = Date.now();
      sessionStorage.setItem('aurora_pageData', JSON.stringify(obj));
    }
  } catch (e) {
    // ignore storage failures
  }
}

/**
 * Build AEP-compatible XDM structure for Adobe Analytics eVars
 * @param {Object} options - Configuration options
 */
function buildXDMStructure(options = {}) {
  const {
    productId = '',
    pageType = getPageType(),
    pageUrl = window.location.href,
    product = null,
    products = []
  } = options;

  // Base XDM structure compatible with AEP Web SDK
  const xdm = {
    _experience: {
      analytics: {
        customDimensions: {
          eVars: {
            eVar1: productId || '', // Product SKU/ID
            eVar2: pageType,        // Page type
            eVar3: pageUrl          // Page URL
          }
        }
      }
    },
    web: {
      webPageDetails: {
        pageViews: {
          value: 1
        },
        name: document.title || '',
        URL: pageUrl
      }
    }
  };

  // Add commerce data if product(s) provided
  if (product || (products && products.length > 0)) {
    xdm.commerce = {};

    if (product) {
      xdm.commerce.productListAdds = {
        value: product.quantity || 1,
        id: product.productId || product.id || '',
        name: product.productName || product.name || '',
        priceTotal: (product.price || 0) * (product.quantity || 1)
      };
      xdm._experience.analytics.customDimensions.eVars.eVar1 = product.productId || product.id || '';
    }

    if (products && products.length > 0) {
      xdm.productListItems = products.map((p, index) => ({
        SKU: p.productId || p.id || '',
        name: p.productName || p.name || '',
        productCategory: p.productCategory || p.category || '',
        priceTotal: (p.price || 0) * (p.quantity || 1),
        quantity: p.quantity || 1,
        position: index + 1
      }));
      if (products[0]) {
        xdm._experience.analytics.customDimensions.eVars.eVar1 = products[0].productId || products[0].id || '';
      }
    }
  }

  return xdm;
}

/**
 * Push page view event to Adobe Data Layer
 * NOTE: Uses event: "pageLoaded" to match the site's ACDL contract
 * @param {Object} options - Additional options
 */
function pushPageView(options = {}) {
  if (!window.adobeDataLayer) return;

  const pageType = options.pageType || getPageType();
  const pageName = options.pageName || document.title || '';
  const custData = (typeof window.adl !== 'undefined' && window.adl.get) ? (window.adl.get('custData') || buildCustDataLocal()) : buildCustDataLocal();

  const payload = {
    event: 'pageLoaded',
    xdmPageLoad: {
      pageInfo: {
        pageName: (pageName ? pageName + ' | aurora' : (window.location.pathname || 'unknown') + ' | aurora'),
        pageURL: window.location.href,
        server: 'aurora-server'
      },
      custData: custData
    },
    xdm: buildXDMStructure({
      pageType: pageType,
      pageUrl: window.location.href
    }),
    page: {
      pageName: pageName,
      pageType: pageType,
      url: window.location.href,
      language: 'en'
    },
    timestamp: new Date().toISOString()
  };

  localPushToDataLayer(payload);
}

/**
 * Push link click event (standardized to event: "linkClicked")
 * @param {Object} options - Link click options
 */
function pushLinkClick(options = {}) {
  if (!window.adobeDataLayer) return;

  const { linkText = '', linkUrl = '', linkType = 'button', linkPosition = '', productCategory = '' } = options;
  const custData = (typeof window.adl !== 'undefined' && window.adl.get) ? (window.adl.get('custData') || buildCustDataLocal()) : buildCustDataLocal();

  // Get consistent page information using same logic as adl-utils.js
  const currentPageType = getPageType();
  let currentPageName = '';
  const path = window.location.pathname || window.location.href;
  const params = new URLSearchParams(window.location.search);
  
  // Match the same page name logic as adl-utils.js
  if (path.includes('pdp.html') || params.get('id')) {
    currentPageName = 'Product Detail | aurora';
  } else if (path.includes('index.html') || path === '/' || path.endsWith('/')) {
    currentPageName = 'home page | aurora';
  } else if (path.includes('plp.html')) {
    currentPageName = 'Shop | aurora';
  } else if (path.includes('cart.html')) {
    currentPageName = 'Cart | aurora';
  } else if (path.includes('checkout.html')) {
    currentPageName = 'Checkout | aurora';
  } else if (path.includes('payment.html')) {
    currentPageName = 'Payment | aurora';
  } else if (path.includes('thankyou.html')) {
    currentPageName = 'Thank You | aurora';
  } else if (document.title) {
    currentPageName = document.title.includes('|') ? document.title : document.title + ' | aurora';
  } else {
    currentPageName = (path.split('/').pop() || 'unknown') + ' | aurora';
  }

  const currentPageURL = window.location.href;

  // Extract link properties with proper defaults
  const linkName = linkText || '';
  const linkTypeValue = linkType || 'navigation';
  const linkPositionValue = linkPosition || '';
  
  // Build linkClicked payload with linkName, linkType, linkPosition at root level
  // Also includes pageName, pageType, pageURL at top level
  // Consistent structure with adl-utils.js trackLinkClick
  const payload = {
    event: 'linkClicked',
    linkName: linkName,
    linkType: linkTypeValue,
    linkPosition: linkPositionValue,
    pageName: currentPageName,
    pageType: currentPageType,
    pageURL: currentPageURL,
    linkURL: linkUrl,
    custData: custData,
    xdmActionDetails: {
      web: {
        webInteraction: {
          linkName: linkName,
          linkPageName: currentPageName,
          linkPosition: linkPositionValue,
          linkType: linkTypeValue,
          linkURL: linkUrl,
          productCategory: productCategory
        }
      }
    },
    xdm: buildXDMStructure({
      pageType: currentPageType,
      pageUrl: currentPageURL
    }),
    timestamp: new Date().toISOString()
  };

  localPushToDataLayer(payload);

  // Navigation behavior: allow consumers to call this helper and then navigate after 300ms
  // If consumer expects navigation to happen here, they can use setTimeout as needed.
}

/**
 * Push add to cart event (scAdd) — includes custData and cart summary if passed
 * @param {Object} product - Product object
 * @param {number} quantity - Quantity added
 * @param {Array} cartItems - Current cart items (optional)
 */
function pushAddToCart(product, quantity = 1, cartItems = []) {
  if (!window.adobeDataLayer || !product) return;

  const custData = (typeof window.adl !== 'undefined' && window.adl.get) ? (window.adl.get('custData') || buildCustDataLocal()) : buildCustDataLocal();

  const productId = product.id || product.productId || '';
  const productName = product.name || product.productName || '';
  const productCategory = product.category || product.productCategory || '';
  const price = product.price || 0;

  const payload = {
    event: 'scAdd',
    custData: custData,
    xdm: buildXDMStructure({
      productId: productId,
      pageType: getPageType(),
      pageUrl: window.location.href,
      product: {
        productId: productId,
        productName: productName,
        productCategory: productCategory,
        price: price,
        quantity: quantity
      }
    }),
    product: [{
      productId: productId,
      productName: productName,
      productCategory: productCategory,
      brand: product.brand || '',
      price: price,
      quantity: quantity
    }],
    cart: {
      items: cartItems.map(item => ({
        productId: item.id || item.productId,
        productName: item.name || item.productName,
        productCategory: item.category || item.productCategory,
        brand: item.brand || '',
        price: item.price || 0,
        quantity: item.qty || item.quantity || 1
      })),
      total: (cartItems && cartItems.length) ? cartItems.reduce((sum, item) => sum + (item.price || 0) * (item.qty || item.quantity || 1), 0) : (price * quantity)
    },
    page: {
      pageName: document.title || '',
      pageType: getPageType(),
      url: window.location.href
    },
    timestamp: new Date().toISOString()
  };

  localPushToDataLayer(payload);
}

/**
 * Push product detail view event (standardized to event: "productDetail")
 * @param {Object} product - Product object
 */
function pushProductDetailView(product) {
  if (!window.adobeDataLayer || !product) return;

  const custData = (typeof window.adl !== 'undefined' && window.adl.get) ? (window.adl.get('custData') || buildCustDataLocal()) : buildCustDataLocal();
  const productId = product.id || product.productId || '';

  const payload = {
    event: 'productDetail',
    custData: custData,
    xdm: buildXDMStructure({
      productId: productId,
      pageType: 'pdp',
      pageUrl: window.location.href,
      product: {
        productId: productId,
        productName: product.name || product.productName || '',
        productCategory: product.category || product.productCategory || '',
        price: product.price || 0,
        quantity: 1
      }
    }),
    product: [{
      productId: productId,
      productName: product.name || product.productName || '',
      productCategory: product.category || product.productCategory || '',
      brand: product.brand || '',
      price: product.price || 0,
      position: 1
    }],
    page: {
      pageName: document.title || '',
      pageType: 'pdp',
      url: window.location.href
    },
    timestamp: new Date().toISOString()
  };

  localPushToDataLayer(payload);
}

/**
 * Push product list view event (PLP)
 * @param {Array} products - Array of products
 */
function pushProductListView(products = []) {
  if (!window.adobeDataLayer) return;

  const custData = (typeof window.adl !== 'undefined' && window.adl.get) ? (window.adl.get('custData') || buildCustDataLocal()) : buildCustDataLocal();

  const payload = {
    event: 'productImpression',
    custData: custData,
    xdm: buildXDMStructure({
      pageType: 'plp',
      pageUrl: window.location.href,
      products: products.map(p => ({
        productId: p.id || p.productId || '',
        productName: p.name || p.productName || '',
        productCategory: p.category || p.productCategory || '',
        brand: p.brand || '',
        price: p.price || 0,
        position: p.position || 1
      }))
    }),
    productList: products.map((p, index) => ({
      productId: p.id || p.productId || '',
      productName: p.name || p.productName || '',
      productCategory: p.category || p.productCategory || '',
      brand: p.brand || '',
      price: p.price || 0,
      position: index + 1
    })),
    page: {
      pageName: document.title || '',
      pageType: 'plp',
      url: window.location.href
    },
    timestamp: new Date().toISOString()
  };

  localPushToDataLayer(payload);
}

// Export functions to global scope
window.adlXDM = {
  buildXDMStructure,
  pushPageView,
  pushLinkClick,
  pushAddToCart,
  pushProductDetailView,
  pushProductListView,
  getPageType
};