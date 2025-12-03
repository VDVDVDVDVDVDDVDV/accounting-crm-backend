const { google } = require('googleapis');

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body);
    const { type, partyName, amount, description, date } = data;

    // Validate required fields
    if (!type || !partyName || !amount || !description || !date) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Google Sheets configuration
    const SPREADSHEET_ID = '1ev0QFlrC6cfIk5XeFpJYyNyJLv3N8gP45DAwifSvF-I';
    
    // Initialize Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Determine accounts based on transaction type
    let debitAccount, creditAccount, debitCode, creditCode;
    
    switch(type) {
      case 'cash_receipt':
        debitAccount = 'Cash A/c';
        creditAccount = 'Service Income A/c';
        debitCode = '1000';
        creditCode = '4200';
        break;
      case 'cash_payment':
        debitAccount = 'Office Expenses A/c';
        creditAccount = 'Cash A/c';
        debitCode = '6200';
        creditCode = '1000';
        break;
      case 'credit_sale':
        debitAccount = `Sundry Debtors A/c (${partyName})`;
        creditAccount = 'Service Income A/c';
        debitCode = '1100';
        creditCode = '4200';
        break;
      case 'credit_purchase':
        debitAccount = 'Purchases A/c';
        creditAccount = `Sundry Creditors A/c (${partyName})`;
        debitCode = '5000';
        creditCode = '2000';
        break;
      case 'payment_received':
        debitAccount = 'Cash A/c';
        creditAccount = `Sundry Debtors A/c (${partyName})`;
        debitCode = '1000';
        creditCode = '1100';
        break;
      case 'payment_made':
        debitAccount = `Sundry Creditors A/c (${partyName})`;
        creditAccount = 'Cash A/c';
        debitCode = '2000';
        creditCode = '1000';
        break;
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid transaction type' })
        };
    }

    // Format date
    const formattedDate = new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    // Get next journal entry number
    const journalData = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Journal!A2:A1000'
    });
    
    const nextRow = (journalData.data.values?.length || 0) + 2;
    const journalNumber = `J${Math.floor(nextRow / 2)}`;

    // 1. POST TO JOURNAL
    const journalValues = [
      [formattedDate, `${debitAccount}                           Dr.`, debitCode, amount, '', '', partyName, '', `Being ${description}`],
      ['', `     To ${creditAccount}`, creditCode, '', amount, '', '', '', '']
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Journal!A2',
      valueInputOption: 'USER_ENTERED',
      resource: { values: journalValues }
    });

    // 2. POST TO LEDGER
    const ledgerData = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Ledger!A2:F1000'
    });
    
    const ledgerNextRow = (ledgerData.data.values?.length || 0) + 2;
    
    const ledgerValues = [
      [debitAccount, '', '', '', '', ''],
      [formattedDate, `To ${creditAccount}`, journalNumber, amount, '', ''],
      ['', '', '', '', '', ''],
      [creditAccount, '', '', '', '', ''],
      [formattedDate, `By ${debitAccount}`, journalNumber, '', amount, '']
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Ledger!A2',
      valueInputOption: 'USER_ENTERED',
      resource: { values: ledgerValues }
    });

    // 3. UPDATE TRIAL BALANCE
    const trialBalanceData = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Trial Balance!A2:D100'
    });

    let trialBalanceValues = trialBalanceData.data.values || [];
    let cashIndex = trialBalanceValues.findIndex(row => row[0] === 'Cash in Hand');
    let incomeIndex = trialBalanceValues.findIndex(row => row[0] === 'Service Income');
    let expenseIndex = trialBalanceValues.findIndex(row => row[0] === 'Office Expenses');
    let debtorsIndex = trialBalanceValues.findIndex(row => row[0]?.includes('Debtors'));

    // Update or create entries based on transaction type
    if (type === 'cash_receipt') {
      if (cashIndex === -1) {
        trialBalanceValues.push(['Cash in Hand', '1000', amount, '']);
      } else {
        trialBalanceValues[cashIndex][2] = (parseFloat(trialBalanceValues[cashIndex][2] || 0) + parseFloat(amount)).toString();
      }
      
      if (incomeIndex === -1) {
        trialBalanceValues.push(['Service Income', '4200', '', amount]);
      } else {
        trialBalanceValues[incomeIndex][3] = (parseFloat(trialBalanceValues[incomeIndex][3] || 0) + parseFloat(amount)).toString();
      }
    } else if (type === 'cash_payment') {
      if (cashIndex !== -1) {
        trialBalanceValues[cashIndex][2] = (parseFloat(trialBalanceValues[cashIndex][2] || 0) - parseFloat(amount)).toString();
      }
      
      if (expenseIndex === -1) {
        trialBalanceValues.push(['Office Expenses', '6200', amount, '']);
      } else {
        trialBalanceValues[expenseIndex][2] = (parseFloat(trialBalanceValues[expenseIndex][2] || 0) + parseFloat(amount)).toString();
      }
    } else if (type === 'credit_sale') {
      if (debtorsIndex === -1) {
        trialBalanceValues.push([`Sundry Debtors (${partyName})`, '1100', amount, '']);
      } else {
        trialBalanceValues[debtorsIndex][2] = (parseFloat(trialBalanceValues[debtorsIndex][2] || 0) + parseFloat(amount)).toString();
      }
      
      if (incomeIndex === -1) {
        trialBalanceValues.push(['Service Income', '4200', '', amount]);
      } else {
        trialBalanceValues[incomeIndex][3] = (parseFloat(trialBalanceValues[incomeIndex][3] || 0) + parseFloat(amount)).toString();
      }
    }

    // Add total row
    trialBalanceValues.push(['TOTAL', '', '=SUM(C2:C100)', '=SUM(D2:D100)']);

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Trial Balance!A2',
      valueInputOption: 'USER_ENTERED',
      resource: { values: trialBalanceValues }
    });

    // 4. UPDATE CASH BOOK (if cash transaction)
    if (type === 'cash_receipt' || type === 'cash_payment' || type === 'payment_received' || type === 'payment_made') {
      const cashBookData = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Cash Book!A2:H1000'
      });
      
      const cashBookNextRow = (cashBookData.data.values?.length || 0) + 2;
      
      let cashBookRow;
      if (type === 'cash_receipt' || type === 'payment_received') {
        cashBookRow = [formattedDate, `To ${creditAccount} (${partyName})`, creditCode, amount, '', '', '', ''];
      } else {
        cashBookRow = [formattedDate, '', '', '', '', `By ${debitAccount}`, amount, ''];
      }

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Cash Book!A2',
        valueInputOption: 'USER_ENTERED',
        resource: { values: [cashBookRow] }
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Transaction posted successfully',
        journalNumber,
        debitAccount,
        creditAccount,
        amount,
        date: formattedDate
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to process transaction',
        details: error.message
      })
    };
  }
};