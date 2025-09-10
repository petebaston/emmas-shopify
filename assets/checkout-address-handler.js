// Checkout Address Handler - Pass verified address to Shopify checkout
// This works with Shopify's standard checkout by adding address parameters to the checkout URL

class CheckoutAddressHandler {
  constructor() {
    this.verifiedAddress = null;
  }

  // Store the verified address data
  setVerifiedAddress(addressData) {
    this.verifiedAddress = addressData;
    // Also store in sessionStorage as backup
    if (addressData) {
      sessionStorage.setItem('verifiedCheckoutAddress', JSON.stringify(addressData));
    }
  }

  // Get stored address
  getVerifiedAddress() {
    if (this.verifiedAddress) {
      return this.verifiedAddress;
    }
    // Try to get from sessionStorage
    const stored = sessionStorage.getItem('verifiedCheckoutAddress');
    if (stored) {
      try {
        this.verifiedAddress = JSON.parse(stored);
        return this.verifiedAddress;
      } catch (e) {
        console.error('Error parsing stored address:', e);
      }
    }
    return null;
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

  // Clear stored address data
  clearAddress() {
    this.verifiedAddress = null;
    sessionStorage.removeItem('verifiedCheckoutAddress');
  }
}

// Create global instance
window.checkoutAddressHandler = new CheckoutAddressHandler();

// Auto-initialize on cart pages
if (window.location.pathname === '/cart' || document.querySelector('.template-cart')) {
  window.checkoutAddressHandler.init();
}