const express = require("express");
const app = express();
app.use(express.json());

app.post("/payments", (req, res) => {
  res.json({
    success: true, // boolean
    status: "success", // string, 'success' or 'failed'
    responseCode: "00", // required
    responseMessage: "Payment successful", // required
    transactionId: req.body.merchantTransactionId || "MOCK_TXN_123",
    amount: req.body.amount,
    currency: req.body.currency,
    authorizationCode: "AUTH123", // optional
    rrn: "RRN123", // optional
  });
});

app.listen(3001, () =>
  console.log("Mock SMT API running at http://localhost:3001")
);

app.post("/refunds", (req, res) => {
  console.log("Refund request received:", req.body);

  res.json({
    success: true,
    status: "success",
    responseCode: "00",
    responseMessage: "Refund successful",
    refundTransactionId: req.body.merchantRefundId || "MOCK_REFUND_123",
    originalTransactionId: req.body.originalTransactionId,
    amountRefunded: req.body.amount,
  });
});

app.listen(3001, () =>
  console.log("Mock SMT API running at http://localhost:3001")
);