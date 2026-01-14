/**
 * Adobe Data Layer (ADL) Utilities
 * velora Apparel Implementation
 * 
 * Event Types:
 * - pageLoaded: Page-level metadata only
 * - linkClicked: Navigation and CTA interactions
 * - addToCart: Commerce event for adding products
 * - removeFromCart: Commerce event for removing products
 * - scView: Shopping cart view
 * - beginCheckout: Begin checkout process
 * - scCheckout: Checkout page view
 * - scPurchase: Purchase completion
 */

(function() {
  'use strict';

  // Initialize Global Data Layer (MUST be first)
  window.adobeDataLayer = window.adobeDataLayer || [];

  // Dedicated Utility Namespace
  window.adl = window.adl || {};

  // ============================================================================
  // Core Helper Functions
  // ============================================================================

  /**
   * Build custData object (common to ALL events)
   * @returns {Object} Customer data object
   */
  window.adl.buildCustData = function() {
    try {
      const ua = navigator.userAgent || '';
      const isMobile = (window.innerWidth && window.innerWidth <= 768) || /Mobi|Android/i.test(ua);
      const platform = isMobile ? 'mobile website' : 'desktop website';
      
      const loginStatus = (window.user && window.user.isLoggedIn) ? 'logged-in' : 'guest';
      const customerID = (window.user && window.user.id) ? String(window.user.id) : '';

      return {
        customerID: customerID,
        lang: "english",
        loginStatus: loginStatus,
        platform: platform
      };
    } catch (e) {
      console.error('ADL: Error building custData', e);
      return {
        customerID: "",
        lang: "english",
        loginStatus: "guest",
        platform: "desktop website"
      };
    }
  };

  /**
   * Get page type from current URL
   * @returns {string} Page type identifier
   */
  window.adl.getPageType = function() {
    try {
      const path = window.location.pathname || window.location.href;
      const params = new URLSearchParams(window.location.search);
      
      if (path.includes('pdp.html') || params.get('id')) return 'pdp';
      if (path.includes('plp.html')) return 'category';
      if (path.includes('cart.html')) return 'cart';
      if (path.includes('checkout.html')) return 'checkout';
      if (path.includes('payment.html')) return 'checkout';
      if (path.includes('thankyou.html')) return 'confirmation';
      if (path.includes('index.html') || path === '/' || path.endsWith('/')) return 'home';
      
      return 'home';
    } catch (e) {
      console.error('ADL: Error getting page type', e);
      return 'home';
    }
  };

  /**
   * Get page name for tracking
   * @returns {string} Page name
   */
  window.adl.getPageName = function() {
    try {
      const pageType = window.adl.getPageType();
      const pageNames = {
        'home': 'home',
        'category': 'plp',
        'pdp': 'product',
        'cart': 'cart',
        'checkout': 'checkout',
        'confirmation': 'confirmation'
      };
      return pageNames[pageType] || 'home';
    } catch (e) {
      console.error('ADL: Error getting page name', e);
      return 'home';
    }
  };

  // ============================================================================
  // PAGE LOADED EVENT
  // ============================================================================

  /**
   * Fire pageLoaded event with page-level context only
   * @param {Object} options - Optional: { pageName, pageType, productDetails (for PDP only) }
   */
  window.adl.firePageLoaded = function(options) {
    try {
      const opts = options || {};
      const pageType = opts.pageType || window.adl.getPageType();
      let pageName = opts.pageName || window.adl.getPageName();
      const custData = window.adl.buildCustData();

      // Build base event
      const eventObject = {
        event: "pageLoaded",
        xdmPageLoad: {
          custData: custData,
          web: {
            webPageDetails: {
              brand: "velora",
              channel: "web|" + pageType,
              pageName: pageName,
              pageType: pageType,
              pageUrl: window.location.href
            }
          }
        }
      };

      // PDP ONLY: Include productDetails in pageLoaded
      if (pageType === 'pdp' && opts.productDetails) {
        const product = opts.productDetails;
        eventObject.xdmPageLoad.web.webPageDetails.pageName = "product:" + (product.productID || '').toLowerCase();
        eventObject.xdmPageLoad.web.webPageDetails.productCategory = product.category || '';
        eventObject.xdmPageLoad.web.productDetails = [{
          productID: product.productID || '',
          sku: product.sku || '',
          productName: product.productName || '',
          brand: product.brand || 'velora',
          category: product.category || '',
          price: product.price || 0,
          color: product.color || '',
          size: product.size || '',
          quantity: product.quantity || 1,
          currency: "USD"
        }];
      }

      window.adobeDataLayer.push(eventObject);
      console.log('ADL: pageLoaded event fired:', pageName);

    } catch (e) {
      console.error('ADL: Error firing pageLoaded event', e);
    }
  };

  // ============================================================================
  // LINK CLICKED EVENT
  // ============================================================================

  /**
   * Track link click with standardized structure
   * Supports both new signature (4 params) and legacy signature (event, options object)
   * @param {string|Event} linkNameOrEvent - Name of the link OR event object (for legacy)
   * @param {string|Object} linkTypeOrOptions - Type: 'nav', 'cta', 'banner', 'card', 'footer', 'removeFromCart' OR legacy options object
   * @param {string} linkPosition - Position: 'header-nav', 'footer', 'hero-banner', etc.
   * @param {string} linkPageName - Page name where link was clicked
   */
  window.adl.trackLinkClick = function(linkNameOrEvent, linkTypeOrOptions, linkPosition, linkPageName) {
    try {
      let linkName, linkType, pageName, linkURL, shouldNavigate;
      
      // Detect if using legacy signature (event, options object)
      if (linkNameOrEvent && typeof linkNameOrEvent === 'object' && linkNameOrEvent.preventDefault) {
        // Legacy signature: trackLinkClick(event, { linkName, linkType, ... })
        const event = linkNameOrEvent;
        const opts = linkTypeOrOptions || {};
        
        linkName = opts.linkName || '';
        linkType = opts.linkType || 'nav';
        linkPosition = opts.linkPosition || '';
        pageName = opts.linkPageName || window.adl.getPageName();
        linkURL = opts.linkURL || '';
        shouldNavigate = opts.shouldNavigate !== false;
        
        // Prevent default navigation if URL provided
        if (event && event.preventDefault && linkURL) {
          event.preventDefault();
        }
      } else if (linkNameOrEvent && typeof linkNameOrEvent === 'object' && !linkNameOrEvent.preventDefault) {
        // Legacy signature: trackLinkClick({ linkName, linkType, ... }) - no event
        const opts = linkNameOrEvent;
        
        linkName = opts.linkName || '';
        linkType = opts.linkType || 'nav';
        linkPosition = opts.linkPosition || '';
        pageName = opts.linkPageName || window.adl.getPageName();
        linkURL = opts.linkURL || '';
        shouldNavigate = opts.shouldNavigate !== false;
      } else {
        // New signature: trackLinkClick(linkName, linkType, linkPosition, linkPageName)
        linkName = linkNameOrEvent;
        linkType = linkTypeOrOptions || 'nav';
        linkPosition = linkPosition || '';
        pageName = linkPageName || window.adl.getPageName();
        linkURL = '';
        shouldNavigate = false;
      }
      
      if (!linkName) {
        console.error('ADL: trackLinkClick requires linkName');
        return;
      }

      const custData = window.adl.buildCustData();

      const eventObject = {
        event: "linkClicked",
        custData: custData,
        xdmActionDetails: {
          web: {
            webInteraction: {
              brand: "velora",
              channel: "web|" + pageName,
              linkName: linkName,
              linkType: linkType,
              linkPosition: linkPosition,
              linkPageName: pageName
            }
          }
        }
      };
      
      // Handle navigation for legacy calls
      if (linkURL && shouldNavigate) {
        setTimeout(function() {
          window.location.href = linkURL;
        }, 300);
      }

      window.adobeDataLayer.push(eventObject);
      console.log('ADL: linkClicked event fired:', linkName);

    } catch (e) {
      console.error('ADL: Error tracking link click', e);
    }
  };

  // ============================================================================
  // ADD TO CART EVENT
  // ============================================================================

  /**
   * Track add to cart event (commerce event)
   * @param {Object} product - Product object with all details
   */
  window.adl.trackAddToCart = function(product) {
    try {
      if (!product || !product.productID) {
        console.error('ADL: trackAddToCart requires product with productID');
        return;
      }

      const custData = window.adl.buildCustData();

      const eventData = {
        event: "addToCart",
        custData: custData,
        xdmCommerce: {
          product: {
            sku: product.sku || '',
            productID: product.productID,
            productName: product.productName,
            brand: product.brand || 'velora',
            category: product.category,
            color: product.color || '',
            size: product.size || '',
            price: product.price,
            quantity: product.quantity || 1,
            currencyCode: "USD"
          }
        }
      };

      // Add CTA metadata if provided
      if (product.linkPosition || product.linkType) {
        eventData.xdmCommerce.product.linkPosition = product.linkPosition || '';
        eventData.xdmCommerce.product.linkType = product.linkType || '';
      }

      window.adobeDataLayer.push(eventData);
      console.log('ADL: addToCart event fired:', product.productName);

    } catch (e) {
      console.error('ADL: Error tracking add to cart', e);
    }
  };

  // ============================================================================
  // REMOVE FROM CART EVENT
  // ============================================================================

  /**
   * Track remove from cart event
   * @param {Object} product - Product object with details
   */
  window.adl.trackRemoveFromCart = function(product) {
    try {
      if (!product || !product.productID) {
        console.error('ADL: trackRemoveFromCart requires product with productID');
        return;
      }

      const custData = window.adl.buildCustData();

      const eventObject = {
        event: "removeFromCart",
        custData: custData,
        xdmCommerce: {
          product: {
            sku: product.sku || '',
            productID: product.productID,
            productName: product.productName,
            brand: product.brand || 'velora',
            category: product.category || '',
            price: product.price || 0,
            color: product.color || '',
            size: product.size || '',
            quantity: product.quantity || 1,
            currencyCode: "USD"
          }
        }
      };

      window.adobeDataLayer.push(eventObject);
      console.log('ADL: removeFromCart event fired:', product.productName);

    } catch (e) {
      console.error('ADL: Error tracking remove from cart', e);
    }
  };

  // ============================================================================
  // SHOPPING CART VIEW EVENT (scView)
  // ============================================================================

  /**
   * Track shopping cart view event
   * @param {Object} cart - Cart object with totalQuantity, totalValue, products
   * @param {string} pageName - Page name (optional)
   */
  window.adl.trackShoppingCartView = function(cart, pageName) {
    try {
      if (!cart) {
        console.error('ADL: trackShoppingCartView requires cart object');
        return;
      }

      const custData = window.adl.buildCustData();

      const eventObject = {
        event: "scView",
        custData: custData,
        xdmCommerce: {
          cart: {
            totalQuantity: cart.totalQuantity || 0,
            totalValue: cart.totalValue || 0,
            products: (cart.products || []).map(function(p) {
              return {
                sku: p.sku || '',
                productID: p.productID,
                productName: p.productName,
                brand: p.brand || 'velora',
                category: p.category || '',
                price: p.price || 0,
                color: p.color || '',
                size: p.size || '',
                quantity: p.quantity || 1,
                currencyCode: "USD"
              };
            })
          }
        }
      };

      window.adobeDataLayer.push(eventObject);
      console.log('ADL: scView event fired');

    } catch (e) {
      console.error('ADL: Error tracking shopping cart view', e);
    }
  };

  // ============================================================================
  // BEGIN CHECKOUT EVENT
  // ============================================================================

  /**
   * Track begin checkout event
   * @param {Object} cart - Cart object with totalQuantity, totalValue
   */
  window.adl.trackBeginCheckout = function(cart) {
    try {
      if (!cart) {
        console.error('ADL: trackBeginCheckout requires cart object');
        return;
      }

      const custData = window.adl.buildCustData();

      const eventObject = {
        event: "beginCheckout",
        custData: custData,
        xdmCommerce: {
          checkout: {
            totalQuantity: cart.totalQuantity || 0,
            totalValue: cart.totalValue || 0
          }
        }
      };

      window.adobeDataLayer.push(eventObject);
      console.log('ADL: beginCheckout event fired');

    } catch (e) {
      console.error('ADL: Error tracking begin checkout', e);
    }
  };

  // ============================================================================
  // CHECKOUT EVENT (scCheckout)
  // ============================================================================

  /**
   * Track checkout page view event
   * @param {Object} cart - Cart object with totalQuantity, totalValue, products
   */
  window.adl.trackCheckout = function(cart) {
    try {
      if (!cart) {
        console.error('ADL: trackCheckout requires cart object');
        return;
      }

      const custData = window.adl.buildCustData();

      const eventObject = {
        event: "scCheckout",
        custData: custData,
        xdmCommerce: {
          checkout: {
            totalQuantity: cart.totalQuantity || 0,
            totalValue: cart.totalValue || 0,
            products: (cart.products || []).map(function(p) {
              return {
                sku: p.sku || '',
                productID: p.productID,
                productName: p.productName,
                brand: p.brand || 'velora',
                category: p.category || '',
                price: p.price || 0,
                color: p.color || '',
                size: p.size || '',
                quantity: p.quantity || 1,
                currencyCode: "USD"
              };
            })
          }
        }
      };

      window.adobeDataLayer.push(eventObject);
      console.log('ADL: scCheckout event fired');

    } catch (e) {
      console.error('ADL: Error tracking checkout', e);
    }
  };

  // ============================================================================
  // PURCHASE EVENT (scPurchase)
  // ============================================================================

  /**
   * Track purchase completion event
   * @param {Object} order - Order object with full details
   */
  window.adl.trackPurchase = function(order) {
    try {
      if (!order || !order.orderID) {
        console.error('ADL: trackPurchase requires order with orderID');
        return;
      }

      const custData = window.adl.buildCustData();
      // Use customer email as customerID if available
      custData.customerID = order.customerEmail || order.email || custData.customerID;

      const eventObject = {
        event: "scPurchase",
        custData: custData,
        xdmCommerce: {
          order: {
            orderID: order.orderID,
            totalQuantity: order.totalQuantity || 0,
            subtotal: order.subtotal || 0,
            shipping: order.shipping || 0,
            tax: order.tax || 0,
            totalValue: order.totalValue || 0,
            paymentMethod: order.paymentMethod || "credit_card",
            currencyCode: "USD",
            products: (order.products || []).map(function(p) {
              return {
                sku: p.sku || '',
                productID: p.productID,
                productName: p.productName,
                brand: p.brand || 'velora',
                category: p.category || '',
                price: p.price || 0,
                color: p.color || '',
                size: p.size || '',
                quantity: p.quantity || 1,
                currencyCode: "USD"
              };
            }),
            shippingAddress: {
              firstName: order.firstName || '',
              lastName: order.lastName || '',
              email: order.email || '',
              address: order.address || '',
              city: order.city || '',
              state: order.state || '',
              zipCode: order.zipCode || ''
            }
          }
        }
      };

      window.adobeDataLayer.push(eventObject);
      console.log('ADL: scPurchase event fired:', order.orderID);

    } catch (e) {
      console.error('ADL: Error tracking purchase', e);
    }
  };

  // ============================================================================
  // Debugging Utilities
  // ============================================================================

  /**
   * Get all pushes in the data layer
   * @returns {Array} All data layer events
   */
  window.adl.getAllPushes = function() {
    return window.adobeDataLayer.slice(0);
  };

  /**
   * Get last push in the data layer
   * @returns {Object|null} Last event object or null
   */
  window.adl.getLastPush = function() {
    const length = window.adobeDataLayer.length;
    return length > 0 ? window.adobeDataLayer[length - 1] : null;
  };

  /**
   * Get events by event type
   * @param {string} eventName - Event name to filter by
   * @returns {Array} Filtered events
   */
  window.adl.getByEvent = function(eventName) {
    return window.adobeDataLayer.filter(function(item) {
      return item.event === eventName;
    });
  };

  console.log('ADL: velora Apparel Data Layer utilities initialized');
})();
