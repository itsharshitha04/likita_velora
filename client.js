// client.js - instrumented for AEP link clicks and product interactions
// Product catalog with product image URLs
const products = [
  {id:"1", sku:"1", name:"Classic Denim Jacket", category:"Jackets", brand:"Velora", price:2499, image:"https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=600&h=800&fit=crop&auto=format"},
  {id:"2", sku:"2", name:"Casual White Shirt", category:"Shirts", brand:"Velora", price:1299, image:"https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600&h=800&fit=crop&auto=format&q=80"},
  {id:"3", sku:"3", name:"Summer Floral Dress", category:"Dresses", brand:"Velora", price:1999, image:"https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=600&h=800&fit=crop&auto=format"},
  {id:"4", sku:"4", name:"Slim Fit Chinos", category:"Trousers", brand:"Velora", price:1799, image:"https://images.unsplash.com/photo-1520975916090-3105956dac38?auto=format&fit=crop&w=600&q=80"}
];

// Simple cart state in sessionStorage
function getCart() {
  try { return JSON.parse(sessionStorage.getItem('velora_cart') || '[]'); } catch(e){ return []; }
}
function setCart(cart) { try { sessionStorage.setItem('velora_cart', JSON.stringify(cart)); } catch(e){} }

// Helper to determine page type
function getPageType() {
  const path = window.location.pathname || window.location.href;
  if (path.includes('pdp.html') || path.includes('id=')) return 'pdp';
  if (path.includes('plp.html')) return 'plp';
  if (path.includes('cart.html')) return 'cart';
  if (path.includes('checkout.html')) return 'checkout';
  if (path.includes('thankyou.html')) return 'thankyou';
  if (path.includes('payment.html')) return 'payment';
  return 'home';
}

// Legacy tracking helpers - kept for backwards compatibility
// All tracking should use window.adl functions directly
function trackLinkClick(opts) {
  // Use new ACDL tracking function
  if (window.adl && typeof window.adl.trackLinkClick === 'function') {
    try {
      window.adl.trackLinkClick(opts);
    } catch (e) {
      console.error('ACDL: Error in trackLinkClick helper', e);
    }
  }
}

// Legacy function - kept for backwards compatibility
// Use window.adl.trackAddToCart directly instead
function pushAddToCart(product, quantity, cartItems) {
  if (window.adl && typeof window.adl.trackAddToCart === 'function') {
    try {
      window.adl.trackAddToCart({
        productID: product.id || product.productId || '',
        productName: product.name || product.productName || '',
        category: product.category || product.productCategory || '',
        price: product.price || 0,
        quantity: quantity || 1
      });
    } catch (e) {
      console.error('ACDL: Error in pushAddToCart helper', e);
    }
  }
}

// Render products in the given container id
function renderProducts(containerId, items) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  items.forEach(p => {
    const div = document.createElement('div');
    div.className = 'product';
    div.dataset.productId = p.id;

    const img = document.createElement('img');
    img.src = p.image;
    img.alt = p.name;
    img.width = 220;
    img.height = 250;
    img.loading = 'lazy';
    img.addEventListener('error', ()=>{ img.src = 'https://via.placeholder.com/220x250?text=No+Image'; });

    const title = document.createElement('h3');
    title.textContent = p.name;

    const price = document.createElement('p');
    price.textContent = 'Rs ' + p.price;

    const btnAdd = document.createElement('button');
    btnAdd.className = 'add-to-cart';
    btnAdd.textContent = 'Add to cart';
    btnAdd.dataset.productId = p.id;

    const btnView = document.createElement('button');
    btnView.className = 'view-product';
    btnView.textContent = 'View';
    btnView.dataset.productId = p.id;

    div.appendChild(img);
    div.appendChild(title);
    div.appendChild(price);
    div.appendChild(btnAdd);
    div.appendChild(btnView);

    container.appendChild(div);
  });
}

// Robust initCart: update multiple badge ids used across pages
function initCart() {
  const cart = getCart();
  const count = cart.reduce((s,i)=>s+(i.quantity||1),0);
  const badge1 = document.getElementById('cart-count'); // preferred id
  const badge2 = document.getElementById('cartCount');  // legacy id used in some pages
  if (badge1) badge1.textContent = count;
  if (badge2) {
    badge2.textContent = count;
    badge2.style.display = count ? 'inline-block' : 'none';
  }
}

// Load and display cart items (used on cart.html page)
function loadCart() {
  const cart = getCart();
  const cartItemsEl = document.getElementById('cartItems');
  const checkoutSection = document.getElementById('checkoutSection');
  
  if (!cartItemsEl) return;
  
  // Clear existing items
  cartItemsEl.innerHTML = '';
  
  if (!cart || cart.length === 0) {
    cartItemsEl.innerHTML = '<li>Your cart is empty.</li>';
    if (checkoutSection) checkoutSection.style.display = 'none';
    return;
  }
  
  // Display cart items with quantity controls
  cart.forEach((item, index) => {
    const li = document.createElement('li');
    li.style.cssText = 'background:white;padding:15px;margin:10px 0;border-radius:8px;box-shadow:0 1px 5px rgba(0,0,0,0.2);list-style:none;';
    
    const itemDiv = document.createElement('div');
    itemDiv.style.cssText = 'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;';
    
    const itemInfo = document.createElement('div');
    itemInfo.style.cssText = 'flex:1;min-width:200px;';
    itemInfo.innerHTML = `
      <strong>${item.name || 'Product'}</strong><br>
      <span>Category: ${item.category || 'N/A'}</span><br>
      <span>Brand: ${item.brand || 'N/A'}</span><br>
      ${item.color ? '<span>Color: ' + item.color + '</span><br>' : ''}
      ${item.size ? '<span>Size: ' + item.size + '</span><br>' : ''}
      <span>Price: ₹${item.price || 0} × Quantity: <span id="qty-${item.id}">${item.quantity || 1}</span> = ₹<span id="total-${item.id}">${(item.price || 0) * (item.quantity || 1)}</span></span>
    `;
    
    // Quantity controls
    const qtyControls = document.createElement('div');
    qtyControls.style.cssText = 'display:flex;align-items:center;gap:10px;margin:10px 0;';
    
    const decreaseBtn = document.createElement('button');
    decreaseBtn.textContent = '-';
    decreaseBtn.style.cssText = 'padding:5px 12px;background:#222;color:white;border:none;cursor:pointer;border-radius:5px;font-size:16px;font-weight:bold;';
    decreaseBtn.onclick = function(e) {
      e.preventDefault();
      // FIX: Get fresh quantity to avoid stale closure
      const freshCart = getCart();
      const freshItem = freshCart.find(i => String(i.id) === String(item.id));
      const currentQty = freshItem ? (freshItem.quantity || 1) : 1;
      
      if (currentQty > 1) {
        updateCartQuantity(item.id, currentQty - 1);
      }
    };
    
    const increaseBtn = document.createElement('button');
    increaseBtn.textContent = '+';
    increaseBtn.style.cssText = 'padding:5px 12px;background:#222;color:white;border:none;cursor:pointer;border-radius:5px;font-size:16px;font-weight:bold;';
    increaseBtn.onclick = function(e) {
      e.preventDefault();
      // FIX: Get fresh quantity to avoid stale closure
      const freshCart = getCart();
      const freshItem = freshCart.find(i => String(i.id) === String(item.id));
      const currentQty = freshItem ? (freshItem.quantity || 1) : 1;
      
      updateCartQuantity(item.id, currentQty + 1);
    };
    
    qtyControls.appendChild(decreaseBtn);
    qtyControls.appendChild(increaseBtn);
    
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.style.cssText = 'padding:5px 10px;background:#ff4081;color:white;border:none;cursor:pointer;border-radius:5px;margin-left:10px;';
    removeBtn.onclick = function(e) {
      e.preventDefault();
      
      // Track remove from cart event using ACDL e-commerce event
      if (window.adl && window.adl.trackRemoveFromCart) {
        window.adl.trackRemoveFromCart({
          productID: item.id || '',
          productName: item.name || '',
          category: item.category || '',
          price: item.price || 0,
          quantity: item.quantity || 1
        });
      }
      
      // Also track as link click for compatibility
      if (window.adl && window.adl.trackLinkClick) {
        window.adl.trackLinkClick({
          linkName: 'Remove from Cart',
          linkType: 'cta',
          linkPosition: 'cart',
          productCategory: item.category || '',
          shouldNavigate: false
        });
      }
      
      removeFromCart(item.id);
    };
    
    itemInfo.appendChild(qtyControls);
    itemDiv.appendChild(itemInfo);
    itemDiv.appendChild(removeBtn);
    li.appendChild(itemDiv);
    cartItemsEl.appendChild(li);
  });
  
  // Show checkout button if cart has items
  if (checkoutSection) {
    checkoutSection.style.display = cart.length > 0 ? 'block' : 'none';
  }
}

// Update cart quantity (for +/- buttons)
function updateCartQuantity(productId, newQuantity) {
  const cart = getCart();
  const item = cart.find(i => String(i.id) === String(productId));
  
  if (!item) return;
  
  // Update quantity
  item.quantity = Math.max(1, newQuantity); // Ensure quantity is at least 1
  setCart(cart);
  
  // Update UI
  const qtyEl = document.getElementById('qty-' + productId);
  const totalEl = document.getElementById('total-' + productId);
  if (qtyEl) qtyEl.textContent = item.quantity;
  if (totalEl) totalEl.textContent = (item.price || 0) * item.quantity;
  
  // Update cart badge
  initCart();
  
  // Update web.productDetails in data layer (NO scView event)
  if (window.adl && window.adl.updateProductDetails) {
    const products = cart.map(function(cartItem) {
      return {
        productID: cartItem.id || '',
        productName: cartItem.name || '',
        brand: cartItem.brand || '',
        category: cartItem.category || '',
        price: cartItem.price || 0,
        quantity: cartItem.quantity || 1,
        color: cartItem.color || '',
        size: cartItem.size || '',
        currency: 'INR'
      };
    });
    window.adl.updateProductDetails(products);
  }
}

// Remove item from cart
function removeFromCart(productId) {
  const cart = getCart();
  const item = cart.find(i => String(i.id) === String(productId));
  const updatedCart = cart.filter(item => String(item.id) !== String(productId));
  setCart(updatedCart);
  loadCart();
  initCart();
  
  // Update web.productDetails after removal (NO scView event)
  if (window.adl && window.adl.updateProductDetails) {
    const products = updatedCart.map(function(cartItem) {
      return {
        productID: cartItem.id || '',
        productName: cartItem.name || '',
        brand: cartItem.brand || '',
        category: cartItem.category || '',
        price: cartItem.price || 0,
        quantity: cartItem.quantity || 1,
        color: cartItem.color || '',
        size: cartItem.size || '',
        currency: 'INR'
      };
    });
    window.adl.updateProductDetails(products);
  }
  
  // Track removal as e-commerce event (already tracked in removeBtn.onclick)
  // This function is also called from other places, so we track here too
  if (item && window.adl && window.adl.trackRemoveFromCart) {
    try {
      window.adl.trackRemoveFromCart({
        productID: item.id || '',
        productName: item.name || '',
        category: item.category || '',
        price: item.price || 0,
        quantity: item.quantity || 1
      });
    } catch (e) {
      console.error('ACDL: Error tracking remove from cart', e);
    }
  }
}

// Add to cart handler
// CRITICAL: This function should NOT navigate - cart must work without breaking
function handleAddToCart(productId, qty=1) {
  const prod = products.find(p=>p.id===String(productId));
  if (!prod) return;
  const cart = getCart();
  const existing = cart.find(i=>String(i.id)===String(productId));
  if (existing) {
    existing.quantity = (existing.quantity||1)+qty;
  } else {
    cart.push({ ...prod, quantity: qty });
  }
  setCart(cart);
  initCart();
  
  // Track add to cart event using ACDL e-commerce event (Phase 7)
  // Note: linkClicked tracking is handled by the button's onclick handler
  if (window.adl && window.adl.trackAddToCart) {
    try {
      window.adl.trackAddToCart({
        productID: prod.id || '',
        productName: prod.name || '',
        category: prod.category || '',
        price: prod.price || 0,
        quantity: qty
      });
    } catch (e) {
      console.error('ACDL: Error tracking add to cart', e);
    }
  }
  
  // Visual feedback (optional - can be enhanced with toast notification)
  if (typeof window !== 'undefined' && window.console) {
    console.log('✓ Product added to cart:', prod.name);
  }
}

// Compatibility wrapper so existing inline onclick="addToCart(...)" calls work
function addToCart(productOrId, qty = 1) {
  try {
    // if an object with id provided, or a raw id string/number
    const id = productOrId && (productOrId.id || productOrId.productId || productOrId);
    if (!id) return;
    handleAddToCart(String(id), qty);
  } catch (e) {
    console.error('addToCart wrapper error', e);
  }
}

// View product (navigate to pdp) handler
function handleViewProduct(productId) {
  const prod = products.find(p=>p.id===String(productId));
  const url = 'pdp.html?id=' + encodeURIComponent(productId);
  
  // Track link click with navigation (default behavior)
  // Use new ACDL tracking function
  if (window.adl && window.adl.trackLinkClick) {
    window.adl.trackLinkClick({
      linkName: prod ? prod.name : 'View product',
      linkURL: url,
      linkType: 'navigation',
      linkPosition: 'product card',
      productCategory: prod ? prod.category : ''
    });
  }
  
  // Navigation is handled by trackLinkClick (after 300ms)
}

// Attach global click instrumentation (centralized)
// This provides fallback tracking for links that don't have explicit onclick handlers
function attachGlobalClickInstrumentation() {
  // Use a delegated handler to capture add-to-cart / view clicks
  document.addEventListener('click', function(e){
    const target = e.target;
    if (!target) return;

    // Skip if already handled by explicit onclick handler
    if (target.hasAttribute('onclick') || target.closest('[onclick]')) {
      // Let the onclick handler take precedence
      return;
    }

    // Add-to-cart button (only if no explicit handler)
    if (target.matches && target.matches('button.add-to-cart')) {
      const pid = target.dataset.productId || target.closest('.product')?.dataset?.productId;
      if (pid) { 
        e.preventDefault(); 
        handleAddToCart(pid, 1); 
      }
      return;
    }

    // View product button (only if no explicit handler)
    if (target.matches && target.matches('button.view-product')) {
      const pid = target.dataset.productId || target.closest('.product')?.dataset?.productId;
      if (pid) { 
        e.preventDefault(); 
        handleViewProduct(pid); 
      }
      return;
    }

    // Generic link (<a>) - provide fallback tracking only if no onclick handler
    const anchor = target.closest && target.closest('a');
    if (anchor && anchor.href && !anchor.hasAttribute('onclick')) {
      // Only instrument same-origin / relative navigations
      const href = anchor.getAttribute('href');
      const isExternal = href && href.startsWith('http') && !href.includes(window.location.hostname);
      const isRelative = href && !href.startsWith('http');
      
      // Track only internal/relative links that don't have onclick handlers
      if ((isRelative || !isExternal) && window.adl && window.adl.trackLinkClick) {
        try {
          // Use event object to prevent default, then track and navigate
          e.preventDefault();
          const linkText = (anchor.textContent || anchor.innerText || '').trim() || 'Link';
          const linkPosition = anchor.closest('nav') ? 'header' : (anchor.closest('footer') ? 'footer' : 'page');
          window.adl.trackLinkClick(e, { 
            linkName: linkText, 
            linkURL: href, 
            linkType: 'navigation', 
            linkPosition: linkPosition
          });
        } catch (e2) {
          // Fallback: if tracking fails, allow normal navigation
          console.error('Tracking error (fallback navigation will work):', e2);
        }
      }
    }
  }, true); // Use capture phase to handle before other handlers
}

// Init on DOM ready
document.addEventListener('DOMContentLoaded', function(){
  try {
    if (document.getElementById('pdpContainer')) {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      const prod = products.find(p=>p.id===String(id));
      if (prod) {
        renderProducts('pdpContainer', [prod]);
        // Product detail view is tracked via pageLoad event for product page type
      }
    }

    // Attach instrumentation
    attachGlobalClickInstrumentation();

    // Init cart badge
    initCart();
  } catch (e) { console.error(e); }
});
