Request for Bill, Call Waiter options are disabled in the frontend, in the bottombar as well as in the "My Table"
enableCallWaiter={enableCallWaiter}

In Case of ordering from phone, showToWaiter basically asks the customer to show their phone to the waiter to take a order
showToWaiter={showToWaiter}

Customer Message to display on the OrderConfirmationDrawer after the order is successfully placed
message={message}

In the category dropdown, labels for group category comes up:
showAggregatedCategory={showAggregatedCategory}

____________
disablePlaceOrder=true
- to not show the PlaceOrder button
needed for amado to make it clear for customers that they cant order from the phone

<!-- - no table_session created, everybody creates their individual cart, single qr code scan will keep independent session -->

<!-- - cache the cart with a "Clear Cart" button on the bottom -->

- Your List instead of "Shared Cart"

- dont show My Table in the bottom drawer



__________________

showAskNameModal=true or false
- by default=true
- disable asking for name modal "NicknamePrompt" component

__________________

enableNavigationOverlay
- showing grouped category 