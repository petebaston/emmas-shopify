// Checkout Address Handler - Pass verified address to Shopify checkout
// This works with Shopify's standard checkout by adding address parameters to the checkout URL

class CheckoutAddressHandler {
  constructor() {
    this.verifiedAddress = null;
    this.STORAGE_KEY = 'verifiedCheckoutAddress';
    this.TIMESTAMP_KEY = 'verifiedCheckoutTimestamp';
    this.MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

    // Clean up expired data on initialization
    this.cleanupExpiredData();
  }

  // Store the verified address data with multi-layer redundancy
  setVerifiedAddress(addressData) {
    if (!addressData) {
      console.warn('Attempted to store null/undefined address data');
      return;
    }

    const timestamp = Date.now();
    const dataToStore = {
      address: addressData,
      timestamp: timestamp,
      version: '1.0' // For future compatibility
    };

    try {
      // Layer 1: In-memory storage (fastest, but lost on page reload)
      this.verifiedAddress = dataToStore;

      // Layer 2: localStorage (most persistent - survives tab closes, page reloads)
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(dataToStore));
        console.log('✓ Address data saved to localStorage');
      } catch (localStorageError) {
        console.warn('localStorage unavailable:', localStorageError);
      }

      // Layer 3: sessionStorage (backup - survives page reloads in same tab)
      try {
        sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(dataToStore));
        console.log('✓ Address data saved to sessionStorage');
      } catch (sessionStorageError) {
        console.warn('sessionStorage unavailable:', sessionStorageError);
      }

      // Layer 4: Store in hidden cart form fields (most reliable for checkout)
      this.storeInCartAttributes(addressData);

      console.log('✓ Address data stored successfully across all layers');

    } catch (error) {
      console.error('Critical error storing address data:', error);
      // Even if storage fails, keep in-memory version
      this.verifiedAddress = dataToStore;
    }
  }

  // Store address data in hidden form fields for maximum reliability
  storeInCartAttributes(addressData) {
    try {
      const form = document.querySelector('#cart_submit_form, form[action="/cart"]');
      if (!form) {
        console.warn('Cart form not found - cannot store in attributes');
        return;
      }

      // Store each critical field as a hidden input
      const fieldsToStore = {
        '_verified_inmate_name': addressData.name || '',
        '_verified_din': addressData.din || '',
        '_verification_timestamp': Date.now().toString()
      };

      Object.keys(fieldsToStore).forEach(fieldName => {
        // Remove existing hidden field if it exists
        const existing = form.querySelector(`input[name="attributes[${fieldName}]"]`);
        if (existing) {
          existing.remove();
        }

        // Create new hidden field
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = `attributes[${fieldName}]`;
        input.value = fieldsToStore[fieldName];
        input.setAttribute('data-verified-field', 'true');
        form.appendChild(input);
      });

      console.log('✓ Address data stored in cart attributes');
    } catch (error) {
      console.error('Error storing in cart attributes:', error);
    }
  }

  // Get stored address with fallback chain and validation
  getVerifiedAddress() {
    // Try each storage layer in order of preference
    const sources = [
      { name: 'memory', getter: () => this.verifiedAddress },
      { name: 'localStorage', getter: () => this.getFromStorage(localStorage) },
      { name: 'sessionStorage', getter: () => this.getFromStorage(sessionStorage) },
      { name: 'cartAttributes', getter: () => this.getFromCartAttributes() }
    ];

    for (const source of sources) {
      try {
        const data = source.getter();
        if (data) {
          // Validate data is not stale
          if (this.isDataValid(data)) {
            console.log(`✓ Retrieved valid address data from ${source.name}`);

            // Restore to all layers if found in fallback source
            if (source.name !== 'memory') {
              this.verifiedAddress = data;
            }
            if (source.name !== 'localStorage') {
              try {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
              } catch (e) { /* ignore */ }
            }

            return data.address || data; // Return address object
          } else {
            console.warn(`Data from ${source.name} is stale or invalid`);
          }
        }
      } catch (error) {
        console.warn(`Error retrieving from ${source.name}:`, error);
      }
    }

    console.warn('No valid address data found in any storage layer');
    return null;
  }

  // Get data from browser storage (localStorage or sessionStorage)
  getFromStorage(storage) {
    try {
      const stored = storage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed;
      }
    } catch (e) {
      console.error('Error parsing stored data:', e);
    }
    return null;
  }

  // Retrieve address data from cart form attributes
  getFromCartAttributes() {
    try {
      const form = document.querySelector('#cart_submit_form, form[action="/cart"]');
      if (!form) return null;

      const inmateName = form.querySelector('input[name="attributes[_verified_inmate_name]"]')?.value;
      const din = form.querySelector('input[name="attributes[_verified_din]"]')?.value;
      const timestamp = form.querySelector('input[name="attributes[_verification_timestamp]"]')?.value;

      if (!inmateName || !timestamp) return null;

      // Reconstruct address data from hidden fields (only essential verified fields)
      const addressData = {
        address: {
          name: inmateName,
          din: din || '',
          country: 'United States'
        },
        timestamp: parseInt(timestamp, 10),
        version: '1.0'
      };

      return addressData;
    } catch (error) {
      console.error('Error retrieving from cart attributes:', error);
      return null;
    }
  }

  // Validate that data is not stale
  isDataValid(data) {
    if (!data) return false;

    // Check if data has required fields
    const addressData = data.address || data;
    if (!addressData.facility && !addressData.name) {
      return false;
    }

    // Check timestamp if available
    if (data.timestamp) {
      const age = Date.now() - data.timestamp;
      if (age > this.MAX_AGE_MS) {
        console.warn(`Data is ${Math.round(age / 60000)} minutes old (max ${this.MAX_AGE_MS / 60000} minutes)`);
        return false;
      }
    }

    return true;
  }

  // Clean up expired data from storage
  cleanupExpiredData() {
    try {
      [localStorage, sessionStorage].forEach(storage => {
        try {
          const data = this.getFromStorage(storage);
          if (data && !this.isDataValid(data)) {
            storage.removeItem(this.STORAGE_KEY);
            console.log('✓ Cleaned up expired data from storage');
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      });
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }


  // Create checkout URL with pre-filled address parameters
  createCheckoutUrl(addressData) {
    const baseUrl = '/checkout';
    
    if (!addressData) {
      return baseUrl;
    }

    // Build checkout URL with address parameters
    // Format: /checkout?checkout[shipping_address][field]=value
    const params = [];
    
    // Add shipping address fields
    if (addressData.firstName || addressData.name) {
      const firstName = addressData.firstName || addressData.name.split(' ')[0] || '';
      params.push(`checkout[shipping_address][first_name]=${encodeURIComponent(firstName)}`);
    }
    
    if (addressData.lastName || addressData.name) {
      const lastName = addressData.lastName || addressData.name.split(' ').slice(1).join(' ') || '';
      params.push(`checkout[shipping_address][last_name]=${encodeURIComponent(lastName)}`);
    }
    
    if (addressData.address1) {
      params.push(`checkout[shipping_address][address1]=${encodeURIComponent(addressData.address1)}`);
    }
    
    if (addressData.city) {
      params.push(`checkout[shipping_address][city]=${encodeURIComponent(addressData.city)}`);
    }
    
    if (addressData.state) {
      params.push(`checkout[shipping_address][province]=${encodeURIComponent(addressData.state)}`);
    }
    
    if (addressData.zip) {
      params.push(`checkout[shipping_address][zip]=${encodeURIComponent(addressData.zip)}`);
    }
    
    // Always set country
    params.push(`checkout[shipping_address][country]=${encodeURIComponent(addressData.country || 'United States')}`);
    

    const queryString = params.join('&');
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  }


  // Initialize on cart page
  init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupListeners());
    } else {
      this.setupListeners();
    }
  }

  setupListeners() {
    // Find the checkout form
    const checkoutForm = document.querySelector('#cart_submit_form, form[action="/cart"]');
    
    if (checkoutForm) {
      // BULLETPROOF: Use capture phase to run before other handlers
      checkoutForm.addEventListener('submit', async (e) => {
        const addressData = this.getVerifiedAddress();
        
        if (addressData) {
          e.preventDefault();
          e.stopPropagation();
          
          console.log('Checkout handler intercepted - saving cart first');
          
          // Show loading state
          const submitButton = checkoutForm.querySelector('button[type="submit"], button[name="checkout"]');
          const originalText = submitButton ? submitButton.textContent : '';
          if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Processing...';
          }
          
          try {
            // BULLETPROOF: Enable disabled fields before form submission
            const disabledFields = checkoutForm.querySelectorAll('[disabled]');
            disabledFields.forEach(field => {
              field.disabled = false;
            });
            
            // BULLETPROOF: Submit cart form data first to save attributes
            const formData = new FormData(checkoutForm);
            
            const cartResponse = await fetch('/cart', {
              method: 'POST',
              body: formData
            });
            
            if (!cartResponse.ok) {
              throw new Error(`Cart update failed: ${cartResponse.status}`);
            }
            
            console.log('Cart attributes saved successfully');
            
            // Create checkout URL with address parameters
            const checkoutUrl = this.createCheckoutUrl(addressData);
            
            console.log('Redirecting to checkout with address:', checkoutUrl);
            
            // Redirect to checkout with pre-filled address
            window.location.href = checkoutUrl;
            
          } catch (error) {
            console.error('Error in checkout process:', error);
            
            // Fallback: restore button and show error
            if (submitButton) {
              submitButton.disabled = false;
              submitButton.textContent = originalText;
            }
            
            alert('There was an error processing your request. Please try again.');
          }
        }
      }, true); // Use capture phase to run first
    }
  }

  // Clear stored address data from all layers
  clearAddress() {
    console.log('Clearing address data from all storage layers');

    // Clear in-memory storage
    this.verifiedAddress = null;

    // Clear browser storage
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (e) {
      console.warn('Could not clear localStorage:', e);
    }

    try {
      sessionStorage.removeItem(this.STORAGE_KEY);
    } catch (e) {
      console.warn('Could not clear sessionStorage:', e);
    }

    // Clear cart attributes
    try {
      const form = document.querySelector('#cart_submit_form, form[action="/cart"]');
      if (form) {
        const verifiedFields = form.querySelectorAll('input[data-verified-field="true"]');
        verifiedFields.forEach(field => field.remove());
        console.log('✓ Cleared cart attribute fields');
      }
    } catch (error) {
      console.error('Error clearing cart attributes:', error);
    }

    console.log('✓ Address data cleared from all layers');
  }
}

// Create global instance
window.checkoutAddressHandler = new CheckoutAddressHandler();

// Auto-initialize on cart pages
if (window.location.pathname === '/cart' || document.querySelector('.template-cart')) {
  window.checkoutAddressHandler.init();
}