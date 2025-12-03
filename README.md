# Accounting CRM Backend API

Serverless backend API for the Accounting CRM system with automatic Google Sheets integration.

## Features

- ✅ Serverless architecture using Netlify Functions
- ✅ Automatic Google Sheets updates
- ✅ Double-entry bookkeeping system
- ✅ Maharashtra Board accounting principles
- ✅ CORS enabled for frontend integration
- ✅ Real-time transaction processing

## Setup Instructions

### 1. Deploy to Netlify

1. Go to [Netlify](https://app.netlify.com/)
2. Click "Add new site" → "Import an existing project"
3. Connect to GitHub and select this repository: `VDVDVDVDVDVDDVDV/accounting-crm-backend`
4. Netlify will auto-detect the configuration from `netlify.toml`
5. Click "Deploy site"

### 2. Configure Google Sheets API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google Sheets API
4. Create a Service Account:
   - Go to "IAM & Admin" → "Service Accounts"
   - Click "Create Service Account"
   - Give it a name (e.g., "accounting-crm-api")
   - Grant role: "Editor"
   - Click "Create Key" → Choose JSON
   - Download the JSON file

5. Share your Google Sheet with the service account email:
   - Open your Google Sheet: https://docs.google.com/spreadsheets/d/1ev0QFlrC6cfIk5XeFpJYyNyJLv3N8gP45DAwifSvF-I/edit
   - Click "Share"
   - Add the service account email (found in the JSON file)
   - Give it "Editor" access

### 3. Add Environment Variables to Netlify

1. In Netlify dashboard, go to your site
2. Go to "Site settings" → "Environment variables"
3. Add new variable:
   - **Key:** `GOOGLE_CREDENTIALS`
   - **Value:** Paste the entire contents of the JSON file you downloaded

4. Redeploy your site for changes to take effect

### 4. Get Your API Endpoint

After deployment, your API will be available at:
```
https://your-site-name.netlify.app/.netlify/functions/submit-transaction
```

### 5. Update Frontend CRM

Update the CRM dashboard to use your new API endpoint:

```javascript
const API_ENDPOINT = 'https://your-site-name.netlify.app/.netlify/functions/submit-transaction';

async function submitTransaction(event) {
  event.preventDefault();
  
  const data = {
    type: document.getElementById('transactionType').value,
    partyName: document.getElementById('partyName').value,
    amount: document.getElementById('amount').value,
    description: document.getElementById('description').value,
    date: document.getElementById('transactionDate').value
  };
  
  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  const result = await response.json();
  console.log(result);
}
```

## API Endpoint

### POST `/submit-transaction`

Submit a new accounting transaction.

**Request Body:**
```json
{
  "type": "cash_receipt",
  "partyName": "ABC Company",
  "amount": 10000,
  "description": "Website services provided",
  "date": "2025-12-03"
}
```

**Transaction Types:**
- `cash_receipt` - Cash received (Income)
- `cash_payment` - Cash paid (Expense)
- `credit_sale` - Service provided on credit
- `credit_purchase` - Purchase on credit
- `payment_received` - Payment received from debtor
- `payment_made` - Payment made to creditor

**Response:**
```json
{
  "success": true,
  "message": "Transaction posted successfully",
  "journalNumber": "J5",
  "debitAccount": "Cash A/c",
  "creditAccount": "Service Income A/c",
  "amount": "10000",
  "date": "03-Dec-2025"
}
```

## Google Sheets Structure

The API automatically updates these sheets:
1. **Journal** - Primary book of entry
2. **Ledger** - Account-wise posting
3. **Trial Balance** - Debit/Credit balances
4. **Cash Book** - Cash transactions

## Accounting Principles

Follows Maharashtra State Board Book-keeping principles:
- Double-entry system
- Golden rules of accounting
- Accrual basis
- Proper classification (Personal, Real, Nominal accounts)

## Support

For issues or questions, contact: ind.vedaant2009@gmail.com

## License

MIT