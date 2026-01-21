/*
 * ADL XDM Normalizer
 * Purpose: Normalize existing site data (no new data layer) into
 * consistent XDM paths for Adobe Launch / AEP Web SDK.
 *
 * Exposes: window.adlXDM.getUnifiedXDM() -> returns an XDM object
 * Behavior:
 * - On PDP: capture product details from existing data sources and persist
 *   them to sessionStorage so cart/checkout/thankyou can reuse the same
 *   productListItems path (`xdm.commerce.productListItems`).
 * - On other pages: read persisted productListItems from sessionStorage.
 * - Always provide `xdm.web.webPageDetails` populated from the latest
 *   available page data (adobeDataLayer pageLoaded, sessionStorage, or
 *   derived defaults).
 * - Add order information only on thank-you pages if available.
 */
(function (window) {
  'use strict';

  var STORAGE_KEY_PRODUCTS = 'velora_productListItems';
  var STORAGE_KEY_PAGE = 'velora_pageData';

  function safeJSONParse(value) {
    try { return JSON.parse(value); } catch (e) { return null; }
  }

  function safeJSONStringify(value) {
    try { return JSON.stringify(value); } catch (e) { return null; }
  }

  function getQueryParam(name) {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get(name);
    } catch (e) {
      return null;
    }
  }

  function findLatestDLEvent(eventName) {
    try {
      var dl = window.adobeDataLayer || [];
      for (var i = dl.length - 1; i >= 0; i--) {
        var ev = dl[i];
        if (!ev) continue;
        if (ev.event === eventName) return ev;
        // Some pushes use nested shapes (xdmPageLoad)
        if (eventName === 'pageLoaded' && ev.xdmPageLoad) return ev;
      }
    } catch (e) {}
    return null;
  }

  function normalizeProduct(source) {
    if (!source || typeof source !== 'object') return null;
    var id = source.productID || source.id || source.sku || source.SKU || '';
    var name = source.productName || source.name || source.product_name || '';
    var category = source.category || source.productCategory || '';
    var price = Number(source.price || source.priceTotal || source.unitPrice || 0) || 0;
    var quantity = Number(source.quantity || source.qty || 1) || 1;
    var brand = source.brand || '';
    var image = source.image || source.imageUrl || '';
    return {
      SKU: id ? String(id) : '',
      productID: id ? String(id) : '',
      productName: name || '',
      productCategory: category || '',
      price: price,
      quantity: quantity,
      brand: brand || '',
      image: image || ''
    };
  }

  function buildProductListItemsFromPDP() {
    // Try multiple sources in order of reliability
    // 1) Last dataLayer productDetail / product array
    var pdpEvent = findLatestDLEvent('productDetail') || findLatestDLEvent('pageLoaded');
    if (pdpEvent) {
      // Look for common paths used in this repo
      var list = null;
      if (pdpEvent.xdm && Array.isArray(pdpEvent.xdm.productListItems)) list = pdpEvent.xdm.productListItems;
      if (!list && pdpEvent.xdmPageLoad && pdpEvent.xdmPageLoad.web && Array.isArray(pdpEvent.xdmPageLoad.web.productDetails)) list = pdpEvent.xdmPageLoad.web.productDetails;
      if (!list && pdpEvent.product && Array.isArray(pdpEvent.product)) list = pdpEvent.product;
      if (!list && Array.isArray(pdpEvent.productDetails)) list = pdpEvent.productDetails;
      if (list && list.length) {
        return list.map(normalizeProduct).filter(Boolean);
      }
    }

    // 2) Try global `products` + id query param (site uses client.js products array)
    try {
      var id = getQueryParam('id');
      if (id && window.products && Array.isArray(window.products)) {
        var found = window.products.find(function (p) { return String(p.id) === String(id); });
        if (found) {
          return [normalizeProduct({ productID: 'VEL-' + (found.id || ''), sku: found.sku || String(found.id), productName: found.name, productCategory: found.category, price: found.price || 0, quantity: 1, brand: found.brand || '' })];
        }
      }
    } catch (e) {}

    return null;
  }

  function buildProductListItemsFromCartOrStorage() {
    // 1) Try sessionStorage persisted product list (set on PDP capture)
    try {
      var stored = safeJSONParse(sessionStorage.getItem(STORAGE_KEY_PRODUCTS));
      if (Array.isArray(stored) && stored.length) return stored.map(normalizeProduct).filter(Boolean);
    } catch (e) {}

    // 2) Try velora_cart structure used by client.js
    try {
      var cart = safeJSONParse(sessionStorage.getItem('velora_cart')) || [];
      if (Array.isArray(cart) && cart.length) {
        return cart.map(function (c) {
          return normalizeProduct({ productID: c.id ? 'VEL-' + c.id : (c.productID || ''), sku: c.sku || c.id, productName: c.name || c.productName || '', productCategory: c.category || c.productCategory || '', price: c.price || 0, quantity: c.quantity || c.qty || 1, brand: c.brand || '' });
        }).filter(Boolean);
      }
    } catch (e) {}

    return null;
  }

  function persistProductListItems(list) {
    try {
      if (!Array.isArray(list)) return;
      var safe = list.map(normalizeProduct).filter(Boolean);
      sessionStorage.setItem(STORAGE_KEY_PRODUCTS, safeJSONStringify(safe));
    } catch (e) {}
  }

  function buildPageDetails() {
    // Look for persisted page data (adl-xdm-helper stores velora_pageData)
    try {
      var storedPage = safeJSONParse(sessionStorage.getItem(STORAGE_KEY_PAGE));
      if (storedPage && storedPage.xdmPageLoad && storedPage.xdmPageLoad.web && storedPage.xdmPageLoad.web.webPageDetails) {
        return storedPage.xdmPageLoad.web.webPageDetails;
      }
    } catch (e) {}

    // Try latest pageLoaded in dataLayer
    var pageEv = findLatestDLEvent('pageLoaded');
    if (pageEv && pageEv.xdm && pageEv.xdm.web && pageEv.xdm.web.webPageDetails) {
      return pageEv.xdm.web.webPageDetails;
    }
    if (pageEv && pageEv.xdmPageLoad && pageEv.xdmPageLoad.web && pageEv.xdmPageLoad.web.webPageDetails) {
      return pageEv.xdmPageLoad.web.webPageDetails;
    }

    // Derive essentials as a last resort
    var pageType = (window.adl && typeof window.adl.getPageType === 'function') ? window.adl.getPageType() : (document.location.pathname || '').split('/').pop() || 'home';
    var title = document.title || '';
    return {
      pageName: title ? (title + ' | velora') : (pageType + ' | velora'),
      pageType: pageType,
      pageUrl: window.location.href,
      brand: 'velora',
      channel: 'web|' + (pageType || 'web')
    };
  }

  function buildOrderDetailsIfPresent() {
    // Only populate on confirmation/thankyou.
    try {
      var pageType = (window.adl && typeof window.adl.getPageType === 'function') ? window.adl.getPageType() : (getQueryParam('page') || '').toLowerCase();
      var isThankYou = (pageType === 'confirmation' || window.location.pathname.indexOf('thankyou') !== -1 || window.location.pathname.indexOf('confirmation') !== -1 || window.location.href.indexOf('thankyou') !== -1);
      if (!isThankYou) return null;

      // Try find a purchase/purchaseComplete object in dataLayer
      var dl = window.adobeDataLayer || [];
      for (var i = dl.length - 1; i >= 0; i--) {
        var ev = dl[i];
        if (!ev) continue;
        if (ev.event && (ev.event.toLowerCase().indexOf('purchase') !== -1 || ev.event.toLowerCase().indexOf('scpurchase') !== -1 || ev.event === 'orderCompleted')) {
          return ev.order || (ev.xdm && ev.xdm.commerce && ev.xdm.commerce.order) || ev.orderDetails || null;
        }
        // Some implementations place order under xdmPageLoad
        if (ev.xdmPageLoad && ev.xdmPageLoad.web && ev.xdmPageLoad.web.order) return ev.xdmPageLoad.web.order;
      }

      // Fallback: check sessionStorage velora_order
      var stored = safeJSONParse(sessionStorage.getItem('velora_order'));
      if (stored) return stored;
    } catch (e) {}
    return null;
  }

  function buildUnifiedXDM() {
    var xdm = { web: { webPageDetails: {} }, commerce: {} };

    // Page details (consistent path)
    xdm.web.webPageDetails = buildPageDetails() || {};

    // Products: try PDP first (and persist), then cart/storage
    var products = null;
    try {
      var isPDPLike = (window.location.pathname.indexOf('pdp') !== -1 || getQueryParam('id'));

      if (isPDPLike) {
        products = buildProductListItemsFromPDP();
        if (products && products.length) persistProductListItems(products);
      }
    } catch (e) { products = null; }

    if (!products || !products.length) products = buildProductListItemsFromCartOrStorage() || [];

    // Ensure consistent path: xdm.commerce.productListItems
    xdm.commerce.productListItems = (Array.isArray(products) ? products : []).map(normalizeProduct).filter(Boolean);

    // Add order details only on thank you
    var order = buildOrderDetailsIfPresent();
    if (order) {
      xdm.commerce.order = order;
    }

    // CustData: surface existing adl.buildCustData if available
    var custData = null;
    try { custData = (window.adl && typeof window.adl.buildCustData === 'function') ? window.adl.buildCustData() : null; } catch (e) { custData = null; }

    return { xdm: xdm, custData: custData };
  }

  // Auto-capture PDP product on DOMContentLoaded to persist productListItems for subsequent pages
  try {
    var shouldAutoCapture = (window.location.pathname.indexOf('pdp') !== -1 || getQueryParam('id'));
    if (shouldAutoCapture) {
      // Delay slightly to allow other scripts to push to dataLayer
      window.addEventListener('DOMContentLoaded', function () {
        try {
          var captured = buildProductListItemsFromPDP();
          if (captured && captured.length) persistProductListItems(captured);
        } catch (e) {}
      });
    }
  } catch (e) {}

  // Expose public API
  window.adlXDM = window.adlXDM || {};
  window.adlXDM.getUnifiedXDM = function () {
    try { return buildUnifiedXDM(); } catch (e) { return { xdm: { web: { webPageDetails: {} }, commerce: { productListItems: [] } }, custData: null }; }
  };

})(window);
