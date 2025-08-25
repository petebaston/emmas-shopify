document.addEventListener("DOMContentLoaded", function() {
    const modal = document.querySelector("#bis-modal");
    const bisInput = document.querySelector("#bisInput");

    const bisButtons = document.querySelectorAll('.klaviyo-back-in-stock-button')
    bisButtons.forEach(bisButton => {
      bisButton.addEventListener("click", function(event) {
        event.preventDefault();

        // Set the data-variantID attribute in the input element
        const variantID = bisButton.getAttribute("data-variantid");
        bisInput.setAttribute("data-variantid", variantID);

        // Open the modal
        modal.setAttribute("aria-hidden", "false");
      });
    });

    // If the user clicks outside the modal, close it
    modal.addEventListener('click', (event) => {
      const hidden = modal.getAttribute('aria-hidden')
      if (hidden == 'false') {
        if (event.target.id == 'bis-modal') {
          modal.setAttribute('aria-hidden', 'true');
        }
      }
    });

  });

  function subscribeToBIS(event) {
    event.preventDefault(); // Prevent default form submission

    const popupContent = document.querySelector('.exit-popup')
    const form = document.getElementById('bis-popup');
    const emailField = document.getElementById('bisInput');
    const email = emailField.value;
    const variantID = emailField.dataset.variantid

    // The empty element to inform the customer of the status of the request
    const responseTextElement = document.createElement('p');


    fetch('https://a.klaviyo.com/onsite/components/back-in-stock/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `a=HhCsH3&email=${email}&variant=${variantID}&platform=shopify`
    })
      .then(response => {
        if (response.ok) {
          // console.log('Response: ', response);
          form.remove();
          responseTextElement.innerText = 'Thanks! Your request has been sent successfully!';
          popupContent.setAttribute('style', 'text-align: center;');
          popupContent.appendChild(responseTextElement);
        } else {
          // This will only happen if the e-mail is malformed, but the form is already validating e-mail adresses, so it should never happen. 
          console.log('Failed response: ', response);
          responseTextElement.innerText = 'An error has occured. Is there a typo in your e-mail?';
          popupContent.setAttribute('style', 'text-align: center; color: red;');
          popupContent.appendChild(responseTextElement);
        }
      })
      .catch(error => {
        // This will only happen if Klaviyo is down
        console.error('Network Error:', error);
        responseTextElement.innerText = 'A server error has occured. Try again later.';
        popupContent.setAttribute('style', 'text-align: center; color: red;');
        popupContent.appendChild(responseTextElement)
      });
  }