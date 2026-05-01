// CryptoVault Withdrawal Module
import { 
  auth, 
  db,
  onAuthStateChanged,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  increment
} from './firebase-config.js';

// ============================================
// GLOBAL VARIABLES
// ============================================

let currentBalance = 0;
let isWalletValid = false;

// ============================================
// WALLET ADDRESS VALIDATION PATTERNS
// ============================================

const walletPatterns = {
  BTC: {
    patterns: [
      /^1[a-km-zA-HJ-NP-Z1-9]{25,34}$/,           // Legacy (P2PKH)
      /^3[a-km-zA-HJ-NP-Z1-9]{25,34}$/,           // SegWit (P2SH)
      /^bc1[a-z0-9]{39,59}$/,                      // Native SegWit (Bech32)
      /^bc1p[a-z0-9]{58}$/                         // Taproot (P2TR)
    ],
    example: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    name: "Bitcoin"
  },
  ETH: {
    patterns: [/^0x[a-fA-F0-9]{40}$/],
    example: "0x742d35Cc6634C0532925a3b844Bc454e4438f44E",
    name: "Ethereum"
  },
  USDT: {
    patterns: [/^0x[a-fA-F0-9]{40}$/],             // ERC20
    example: "0x742d35Cc6634C0532925a3b844Bc454e4438f44E",
    name: "USDT (ERC20)"
  },
  USDC: {
    patterns: [/^0x[a-fA-F0-9]{40}$/],
    example: "0x742d35Cc6634C0532925a3b844Bc454e4438f44E",
    name: "USDC"
  },
  LTC: {
    patterns: [
      /^[LM][a-km-zA-HJ-NP-Z1-9]{26,33}$/,        // Legacy
      /^ltc1[a-z0-9]{39,59}$/                      // Bech32
    ],
    example: "LgGxuHjJBqeqjFrVrczXkkV1rWiQZwwWgP",
    name: "Litecoin"
  },
  BNB: {
    patterns: [
      /^0x[a-fA-F0-9]{40}$/,                       // BSC (BEP20)
      /^bnb1[a-z0-9]{38}$/                         // BNB Chain
    ],
    example: "0x742d35Cc6634C0532925a3b844Bc454e4438f44E",
    name: "BNB"
  },
  SOL: {
    patterns: [/^[1-9A-HJ-NP-Za-km-z]{32,44}$/],
    example: "9B5X4z3vYaGx9Zt6pQwJ8kL4nQ3mR5sT2yU1vW0xM9ab",
    name: "Solana"
  },
  XRP: {
    patterns: [/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/],
    example: "rN7n7otQDd6FczFgLdhmKAh4RNrYKKiVJC",
    name: "XRP"
  }
};

// ============================================
// AUTH CHECK & BALANCE LOAD
// ============================================

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
  } else {
    console.log("✅ User logged in:", user.email);
    await loadUserBalance(user.uid);
  }
});

async function loadUserBalance(uid) {
  try {
    const userDocRef = doc(db, "users", uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      const rawBalance = userDoc.data().balance;
      currentBalance = (typeof rawBalance === 'number' && !isNaN(rawBalance)) ? rawBalance : parseFloat(rawBalance) || 0;
      document.getElementById('availableBalance').textContent = 
        `$${currentBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    } else {
      currentBalance = 0;
      document.getElementById('availableBalance').textContent = '$0.00';
    }
  } catch (error) {
    console.error("Error loading balance:", error);
    currentBalance = 0;
    document.getElementById('availableBalance').textContent = '$0.00';
  }
}

// ============================================
// WALLET ADDRESS VALIDATION
// ============================================

function validateWalletAddress(address, cryptoType) {
  if (!address || !cryptoType) {
    return { valid: false, message: "Please select a cryptocurrency and enter address" };
  }

  const crypto = walletPatterns[cryptoType];
  if (!crypto) {
    return { valid: false, message: "Unknown cryptocurrency" };
  }

  // Check against all patterns for this crypto
  const isValid = crypto.patterns.some(pattern => pattern.test(address));

  if (isValid) {
    return { 
      valid: true, 
      message: `✓ Valid ${crypto.name} address` 
    };
  } else {
    return { 
      valid: false, 
      message: `Invalid ${crypto.name} address format. Example: ${crypto.example.substring(0, 20)}...` 
    };
  }
}

function updateValidationUI(result) {
  const validationEl = document.getElementById('walletValidation');
  const iconEl = document.getElementById('validationIcon');
  const textEl = document.getElementById('validationText');

  validationEl.style.display = 'flex';
  
  if (result.valid) {
    validationEl.className = 'wallet-validation valid';
    iconEl.textContent = '✓';
    isWalletValid = true;
  } else {
    validationEl.className = 'wallet-validation invalid';
    iconEl.textContent = '✗';
    isWalletValid = false;
  }
  
  textEl.textContent = result.message;
}

// Event listeners for wallet validation
document.getElementById('walletAddress').addEventListener('input', function() {
  const address = this.value.trim();
  const cryptoType = document.getElementById('cryptoType').value;
  
  if (address.length > 10 && cryptoType) {
    const result = validateWalletAddress(address, cryptoType);
    updateValidationUI(result);
  } else if (address.length > 0) {
    document.getElementById('walletValidation').style.display = 'flex';
    document.getElementById('walletValidation').className = 'wallet-validation pending';
    document.getElementById('validationIcon').textContent = '⏳';
    document.getElementById('validationText').textContent = 'Enter complete address to validate';
    isWalletValid = false;
  } else {
    document.getElementById('walletValidation').style.display = 'none';
    isWalletValid = false;
  }
});

document.getElementById('cryptoType').addEventListener('change', function() {
  // Update network fees
  const fees = {
    'BTC': '~$3.50',
    'ETH': '~$5.00',
    'USDT': '~$1.00',
    'USDC': '~$4.50',
    'LTC': '~$0.50',
    'BNB': '~$0.30',
    'SOL': '~$0.01',
    'XRP': '~$0.01'
  };
  document.getElementById('networkFee').textContent = fees[this.value] || '~$2.50';
  
  // Re-validate wallet address if present
  const address = document.getElementById('walletAddress').value.trim();
  if (address.length > 10) {
    const result = validateWalletAddress(address, this.value);
    updateValidationUI(result);
  }
});

// ============================================
// QUICK AMOUNT BUTTONS
// ============================================

window.setAmount = function(amount) {
  document.getElementById('withdrawAmount').value = amount;
};

window.setMaxAmount = function() {
  document.getElementById('withdrawAmount').value = currentBalance > 0 ? currentBalance.toFixed(2) : 0;
};

// ============================================
// WITHDRAWAL FORM HANDLER
// ============================================

document.getElementById('withdrawalForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const user = auth.currentUser;
  if (!user) {
    showMessage('error', '❌ You must be logged in to withdraw funds!');
    return;
  }

  const amount = parseFloat(document.getElementById('withdrawAmount').value);
  const cryptoType = document.getElementById('cryptoType').value;
  const walletAddress = document.getElementById('walletAddress').value.trim();

  // Validation
  if (!amount || amount < 10) {
    showMessage('error', '❌ Minimum withdrawal amount is $10');
    return;
  }

  if (amount > currentBalance) {
    showMessage('error', '❌ Insufficient balance for this withdrawal');
    return;
  }

  if (!cryptoType) {
    showMessage('error', '❌ Please select a cryptocurrency');
    return;
  }

  if (!walletAddress) {
    showMessage('error', '❌ Please enter a valid wallet address');
    return;
  }

  // Validate wallet address format
  const validationResult = validateWalletAddress(walletAddress, cryptoType);
  if (!validationResult.valid) {
    showMessage('error', `❌ ${validationResult.message}`);
    return;
  }

  // Show processing overlay
  document.getElementById('processingOverlay').classList.add('show');
  document.getElementById('submitBtn').disabled = true;

  try {
    const userDocRef = doc(db, "users", user.uid);
    
    const withdrawalRequest = {
      amount: amount,
      cryptoType: cryptoType,
      walletAddress: walletAddress,
      status: 'pending',
      timestamp: new Date().toISOString(),
      requestId: 'WD-' + Date.now()
    };

    console.log(`\n📝 === WITHDRAWAL REQUEST ===`);
    console.log(`   Amount: $${amount.toFixed(2)}`);
    console.log(`   Crypto: ${cryptoType}`);
    console.log(`   Request ID: ${withdrawalRequest.requestId}`);
    console.log(`   Old Balance: $${currentBalance.toFixed(2)}`);

    // Update Firestore
    await updateDoc(userDocRef, {
      withdrawalRequests: arrayUnion(withdrawalRequest),
      balance: increment(-amount)
    });

    const newBalance = currentBalance - amount;
    console.log(`   New Balance: $${newBalance.toFixed(2)}`);
    console.log(`✅ Withdrawal request submitted!`);

    // Update displayed balance
    currentBalance = newBalance;
    document.getElementById('availableBalance').textContent = 
      `$${newBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

    // Hide processing
    document.getElementById('processingOverlay').classList.remove('show');
    
    // Show success message
    showMessage('success', `✅ Withdrawal Submitted Successfully!<br><br>
      <strong>Request ID:</strong> ${withdrawalRequest.requestId}<br>
      <strong>Amount:</strong> $${amount.toLocaleString('en-US', {minimumFractionDigits: 2})} (${cryptoType})<br>
      <strong>New Balance:</strong> $${newBalance.toLocaleString('en-US', {minimumFractionDigits: 2})}`);

    // Reset form
    document.getElementById('withdrawalForm').reset();
    document.getElementById('submitBtn').disabled = false;

    // Redirect after delay
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 4000);

  } catch (error) {
    console.error("❌ Withdrawal error:", error);
    document.getElementById('processingOverlay').classList.remove('show');
    document.getElementById('submitBtn').disabled = false;
    
    let errorMsg = error.message;
    if (error.code === 'permission-denied') {
      errorMsg = "Permission denied. Please try again later.";
    }
    
    showMessage('error', `❌ Withdrawal failed: ${errorMsg}`);
  }
});

// ============================================
// MESSAGE HELPER
// ============================================

function showMessage(type, text) {
  const messageEl = document.getElementById('message');
  messageEl.className = `message show ${type}`;
  messageEl.innerHTML = text;
}
