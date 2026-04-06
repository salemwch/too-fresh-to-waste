Integration in Mobile App
Integration Steps

Step 1 - Initiate payment
In this step we will initiate a payment.

Sandbox URL : https://sandbox.paymee.tn/api/v2/payments/create
Live URL : https://app.paymee.tn/api/v2/payments/create
Request method : POST
Header
Content-Type: application/json
Authorization: Token api_key (You can get an api_key by creating a sandbox account)
Input
amount: Payment amount (required)
note: Note about the payment (required)
first_name: Buyer’s first name (required)
last_name: Buyer’s first name (required)
email: Buyer’s e-mail (required)
phone: Buyer’s phone number (required)
return_url: The URL to which the user is redirected after finishing payment (optional)
cancel_url: The URL to which the user is redirected after canceling payment (optional)
webhook_url: The URL to which Paymee sends the payment status (required)
order_id: The order ID at the merchant’s side (optional)
{
"amount": 220.25,
"note": "Order #123",
"first_name": "John",
"last_name": "Doe",
"email": "test@paymee.tn",
"phone": "+21611222333",
"return_url": "https://www.return_url.tn",
"cancel_url": "https://www.cancel_url.tn",
"webhook_url": "https://www.webhook_url.tn",
"order_id": "244557"
}
Output
We will use the payment_url in the next step.

{
"status": true,
"message": "Success",
"code": 50,
"data": {
"token": "dfe54df34b54df3a854f3a53fc85a",
"order_id": "244557",
"first_name": "John",
"last_name": "Doe",
"email": "test@paymee.tn",
"phone": "+21611222333",
"note": "Order #123",
"amount": 220.25,
"payment_url": "https://sandbox.paymee.tn/gateway/dfe54df34b54df3a854f3a53fc85a"
}
}
Step 2 - Open a webview
In this step we will load the Paymee gateway in an iframe. The iframe’s src contains the token as shown below :

Le module en Sandbox affiche le paiement par compte Paymee, seulement, pour effectuer les tests.
Le paiement par carte bancaire sera activé en Production.

Test account :

Phone: 11111111
Password: 11111111

Once the payment process is done the webview will show the URL “/loader” which contains a loader animation.
When the URL of the webview contains “/loader”, hide the webview and go to Step 3

Step 3 - Check payment
At this Step, Paymee has sent the payment status to your webhook_url.

Your return_url verifies the payment_status and processes the order accordingly.

To check the integrity of the response, use check_sum.

check_sum is built as follows: md5(token+payment_status(1 or 0)+API Token)

Data sent to the webhook_url when payment is successful
{
"token": "dfe54df34b54df3a854f3a53fc85a",
"check_sum": "14efe54d8664f34543a854f3a5213fc85a",
"payment_status": True,
"order_id": "244557",
"first_name": "John",
"last_name": "Doe",
"email": "test@paymee.tn",
"phone": "+21611222333",
"note": "Order #123",
"amount": 220.25,
"transaction_id": 5578,
"received_amount": 210.25,
"cost": 10
}

Data sent to the webhook_url when payment fails
{
"token": "dfe54df34b54df3a854f3a53fc85a",
"check_sum": "14efe54d8664f34543a854f3a5213fc85a",
"payment_status": False,
"order_id": "244557",
"first_name": "John",
"last_name": "Doe",
"email": "test@paymee.tn",
"phone": "+21611222333",
"note": "Order #123",
"amount": 220.25
}
