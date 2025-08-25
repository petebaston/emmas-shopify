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

  // Update cart attributes with address information
  async updateCartAttributes(addressData) {
    try {
      const attributes = {
        'Shipping_First_Name': addressData.firstName || addressData.name?.split(' ')[0] || '',
        'Shipping_Last_Name': addressData.lastName || addressData.name?.split(' ').slice(1).join(' ') || '',
        'Shipping_Address1': addressData.address1 || '',
        'Shipping_City': addressData.city || '',
        'Shipping_Province': addressData.state || '',
        'Shipping_Zip': addressData.zip || '',
        'Shipping_Country': addressData.country || 'United States',
        'Shipping_Facility': addressData.facility || '',
        'Inmate_DIN': addressData.din || '',
        'Inmate_Name': addressData.name || ''
      };

      const response = await fetch('/cart/update.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ attributes })
      });

      if (!response.ok) {
        throw new Error('Failed to update cart attributes');
      }

      const cart = await response.json();
      console.log('Cart attributes updated:', cart.attributes);
      return true;
    } catch (error) {
      console.error('Error updating cart attributes:', error);
      return false;
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
    
    // Add checkout attributes for reference
    if (addressData.din) {
      params.push(`checkout[attributes][inmate_din]=${encodeURIComponent(addressData.din)}`);
    }
    
    if (addressData.name) {
      params.push(`checkout[attributes][inmate_name]=${encodeURIComponent(addressData.name)}`);
    }
    
    if (addressData.facility) {
      params.push(`checkout[attributes][facility]=${encodeURIComponent(addressData.facility)}`);
    }

    const queryString = params.join('&');
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  }

  // Handle checkout form submission
  async handleCheckoutSubmission(formElement, addressData) {
    if (!addressData) {
      // No address to pre-fill, proceed normally
      return true;
    }

    try {
      // First update cart attributes
      await this.updateCartAttributes(addressData);

      // Create checkout URL with address parameters
      const checkoutUrl = this.createCheckoutUrl(addressData);
      
      // Instead of normal form submission, redirect to checkout with parameters
      window.location.href = checkoutUrl;
      
      // Prevent default form submission
      return false;
    } catch (error) {
      console.error('Error handling checkout:', error);
      // Allow normal checkout to proceed
      return true;
    }
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
      // Override form submission
      checkoutForm.addEventListener('submit', async (e) => {
        const addressData = this.getVerifiedAddress();
        
        if (addressData) {
          e.preventDefault();
          e.stopPropagation();
          
          // Show loading state
          const submitButton = checkoutForm.querySelector('button[type="submit"], button[name="checkout"]');
          const originalText = submitButton ? submitButton.textContent : '';
          if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Processing...';
          }
          
          try {
            // First update cart attributes
            await this.updateCartAttributes(addressData);
            
            // Create checkout URL with address parameters
            const checkoutUrl = this.createCheckoutUrl(addressData);
            
            console.log('Redirecting to checkout with address:', checkoutUrl);
            
            // Redirect to checkout with pre-filled address
            window.location.href = checkoutUrl;
          } catch (error) {
            console.error('Error processing checkout:', error);
            // Restore button and submit normally
            if (submitButton) {
              submitButton.disabled = false;
              submitButton.textContent = originalText;
            }
            checkoutForm.submit();
          }
        }
      });
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