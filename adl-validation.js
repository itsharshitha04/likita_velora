/*
 * ADL Validation Utility
 * Purpose: Validate consistent pageLoad implementation across all pages
 * Ensures single pageLoad event per page with proper XDM structure
 */
(function (window) {
  'use strict';

  // Validation utility
  window.adlValidation = {
    
    /**
     * Validate that only one pageLoad event exists and has proper structure
     */
    validatePageLoad: function() {
      if (!window.adobeDataLayer) {
        console.error('❌ ADL Validation: adobeDataLayer not initialized');
        return false;
      }

      const pageLoadEvents = window.adobeDataLayer.filter(function(event) {
        return event && event.event === 'pageLoaded';
      });

      if (pageLoadEvents.length === 0) {
        console.error('❌ ADL Validation: No pageLoaded event found');
        return false;
      }

      if (pageLoadEvents.length > 1) {
        console.error('❌ ADL Validation: Multiple pageLoaded events found:', pageLoadEvents.length);
        console.error('❌ ADL Validation: Events:', pageLoadEvents);
        return false;
      }

      const pageLoadEvent = pageLoadEvents[0];
      
      // Check required structure
      if (!pageLoadEvent.xdmPageLoad) {
        console.error('❌ ADL Validation: xdmPageLoad missing from pageLoaded event');
        return false;
      }

      if (!pageLoadEvent.xdmPageLoad.web) {
        console.error('❌ ADL Validation: xdmPageLoad.web missing');
        return false;
      }

      if (!pageLoadEvent.xdmPageLoad.web.webPageDetails) {
        console.error('❌ ADL Validation: xdmPageLoad.web.webPageDetails missing');
        return false;
      }

      const webPageDetails = pageLoadEvent.xdmPageLoad.web.webPageDetails;
      const requiredFields = ['brand', 'channel', 'pageName', 'pageType', 'pageUrl'];
      
      for (let field of requiredFields) {
        if (!webPageDetails[field]) {
          console.error('❌ ADL Validation: webPageDetails.' + field + ' missing or empty');
          return false;
        }
      }

      console.log('✅ ADL Validation: pageLoad structure is valid');
      return true;
    },

    /**
     * Validate product details structure consistency
     */
    validateProductDetails: function() {
      if (!window.adobeDataLayer) return false;

      const pageLoadEvents = window.adobeDataLayer.filter(function(event) {
        return event && event.event === 'pageLoaded';
      });

      if (pageLoadEvents.length === 0) return false;

      const pageLoadEvent = pageLoadEvents[0];
      
      // Get current page type and name
      const pageType = pageLoadEvent.xdmPageLoad && 
                       pageLoadEvent.xdmPageLoad.web && 
                       pageLoadEvent.xdmPageLoad.web.webPageDetails &&
                       pageLoadEvent.xdmPageLoad.web.webPageDetails.pageType;
      
      const pageName = pageLoadEvent.xdmPageLoad && 
                       pageLoadEvent.xdmPageLoad.web && 
                       pageLoadEvent.xdmPageLoad.web.webPageDetails &&
                       pageLoadEvent.xdmPageLoad.web.webPageDetails.pageName;
      
      // Product details should ONLY exist on: pdp, cart, checkout (but NOT payment), thankyou
      // NOT on: home, plp, payment
      const shouldHaveProducts = ['pdp', 'cart', 'thankyou'].includes(pageType) || 
                                 (pageType === 'checkout' && pageName === 'checkout');
      const hasProducts = pageLoadEvent.xdmPageLoad && 
                         pageLoadEvent.xdmPageLoad.web && 
                         pageLoadEvent.xdmPageLoad.web.productDetails &&
                         Array.isArray(pageLoadEvent.xdmPageLoad.web.productDetails) &&
                         pageLoadEvent.xdmPageLoad.web.productDetails.length > 0;
      
      if (shouldHaveProducts && !hasProducts) {
        console.warn('⚠ ADL Validation: Page type "' + pageType + '" should have product details but none found');
        return false;
      }
      
      if (!shouldHaveProducts && hasProducts) {
        console.warn('⚠ ADL Validation: Page type "' + pageType + '" should NOT have product details but found:', pageLoadEvent.xdmPageLoad.web.productDetails.length);
        return false;
      }
      
      if (hasProducts) {
        const products = pageLoadEvent.xdmPageLoad.web.productDetails;
        const requiredProductFields = ['productID', 'productName', 'brand', 'price'];
        
        for (let product of products) {
          for (let field of requiredProductFields) {
            if (product[field] === undefined || product[field] === null) {
              console.warn('⚠ ADL Validation: Product missing field:', field, product);
            }
          }
        }
        
        console.log('✅ ADL Validation: Product details valid for page type "' + pageType + '", count:', products.length);
        return true;
      }

      console.log('✅ ADL Validation: No product details (correct for page type: "' + pageType + '")');
      return true;
    },

    /**
     * Validate XDM path consistency across normalizer
     */
    validateXDMConsistency: function() {
      if (!window.adlXDM || typeof window.adlXDM.getUnifiedXDM !== 'function') {
        console.error('❌ ADL Validation: XDM normalizer not available');
        return false;
      }

      try {
        const unifiedXDM = window.adlXDM.getUnifiedXDM();
        
        if (!unifiedXDM || !unifiedXDM.web || !unifiedXDM.web.webPageDetails) {
          console.error('❌ ADL Validation: Unified XDM missing webPageDetails');
          return false;
        }

        if (!unifiedXDM.commerce || !Array.isArray(unifiedXDM.commerce.productListItems)) {
          console.warn('⚠ ADL Validation: Unified XDM missing commerce.productListItems array');
        }

        console.log('✅ ADL Validation: XDM normalizer structure consistent');
        return true;
      } catch (e) {
        console.error('❌ ADL Validation: Error validating XDM consistency:', e);
        return false;
      }
    },

    /**
     * Check for duplicate or legacy events
     */
    validateNoDuplicates: function() {
      if (!window.adobeDataLayer) return false;

      const eventCounts = {};
      const pageLoadEvents = [];
      
      window.adobeDataLayer.forEach(function(event, index) {
        if (!event || !event.event) return;
        
        eventCounts[event.event] = (eventCounts[event.event] || 0) + 1;
        
        if (event.event === 'pageLoaded') {
          pageLoadEvents.push({index: index, event: event});
        }
      });

      if (eventCounts['pageLoaded'] > 1) {
        console.error('❌ ADL Validation: Duplicate pageLoaded events detected:', eventCounts['pageLoaded']);
        console.error('❌ ADL Validation: Event details:', pageLoadEvents);
        return false;
      }

      console.log('✅ ADL Validation: No duplicate pageLoad events detected');
      return true;
    },

    /**
     * Run all validations
     */
    runAllValidations: function() {
      console.log('🔍 ADL Validation: Running comprehensive validation...');
      
      const results = {
        pageLoad: this.validatePageLoad(),
        productDetails: this.validateProductDetails(),
        xdmConsistency: this.validateXDMConsistency(),
        noDuplicates: this.validateNoDuplicates()
      };

      const allPassed = Object.values(results).every(Boolean);
      
      if (allPassed) {
        console.log('✅ ADL Validation: All checks passed! Data layer is consistent.');
      } else {
        console.error('❌ ADL Validation: Some checks failed:', results);
      }

      return results;
    },

    /**
     * Debug information about current page
     */
    debugCurrentPage: function() {
      console.log('🐛 ADL Debug Info for current page:');
      console.log('- URL:', window.location.href);
      console.log('- Title:', document.title);
      console.log('- Data Layer Length:', window.adobeDataLayer ? window.adobeDataLayer.length : 'Not initialized');
      
      if (window.adobeDataLayer && window.adobeDataLayer.length > 0) {
        const events = window.adobeDataLayer.map(function(e) { return e.event; }).filter(Boolean);
        console.log('- Events:', events);
        
        const pageLoadEvent = window.adobeDataLayer.find(function(e) { return e && e.event === 'pageLoaded'; });
        if (pageLoadEvent && pageLoadEvent.xdmPageLoad && pageLoadEvent.xdmPageLoad.web && pageLoadEvent.xdmPageLoad.web.webPageDetails) {
          console.log('- Page Details:', pageLoadEvent.xdmPageLoad.web.webPageDetails);
          if (pageLoadEvent.xdmPageLoad.web.productDetails) {
            console.log('- Product Count:', pageLoadEvent.xdmPageLoad.web.productDetails.length);
          }
        }
      }

      // Check sessionStorage
      try {
        const persistedProducts = sessionStorage.getItem('velora_productListItems');
        console.log('- Persisted Products:', persistedProducts ? JSON.parse(persistedProducts).length + ' items' : 'None');
      } catch (e) {
        console.log('- Persisted Products: Error reading');
      }
    }
  };

  // Auto-run validation after page load (with delay to ensure all scripts loaded)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(function() {
        window.adlValidation.runAllValidations();
        window.adlValidation.debugCurrentPage();
      }, 1000);
    });
  } else {
    setTimeout(function() {
      window.adlValidation.runAllValidations();
      window.adlValidation.debugCurrentPage();
    }, 1000);
  }

})(window);