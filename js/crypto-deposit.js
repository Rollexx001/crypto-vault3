// CryptoVault Crypto Deposit Module
import { 
  auth, 
  db,
  onAuthStateChanged,
  doc,
  getDoc,
  updateDoc,
  increment,
  arrayUnion
} from './firebase-config.js';

// ============================================
// GLOBAL VARIABLES
// ============================================

let currentUser = null;

// Website wallet addresses for each cryptocurrency
const websiteWallets = {
  bitcoin: "1A1z7agoat3vTgGKjzCvCc8ksFzEJzC6TN",
  ethereum: "0x742d35Cc6634C0532925a3b844Bc9e7595f4bEb2",
  litecoin: "LgGxuHjJBqeqjFrVrczXkkV1rWiQZwwWgP",
  ripple: "rN7n7otQDd6FczFgLdhmKAh4RNrYKKiVJC",
  cardano: "addr1qx5r2wqnkf3n0gvnqdq4l8yl0z7l8p5k3n0z7p2f5q4r3s2t1",
  solana: "9B5X4z3vYaGx9Zt6pQwJ8kL4nQ3mR5sT2yU1vW0xM9",
  polkadot: "1ZiETiM6m3eZpq2rS6e9qL8L1L9L8M7M6M5L4K3J2",
  dogecoin: "DPaHvbH5V4d7r9t6r4v2p9m8n1j3k5l7q2s4u6w8y"
};

const cryptoNames = {
  bitcoin: "Bitcoin",
  ethereum: "Ethereum",
  litecoin: "Litecoin",
  ripple: "XRP",
  cardano: "Cardano",
  solana: "Solana",
  polkadot: "Polkadot",
  dogecoin: "Dogecoin"
};

// ============================================
// WALLET ADDRESS VALIDATION PATTERNS
// ============================================

const walletPatterns = {
  bitcoin: {
    patterns: [
      /^1[a-km-zA-HJ-NP-Z1-9]{25,34}$/,
      /^3[a-km-zA-HJ-NP-Z1-9]{25,34}$/,
      /^bc1[a-z0-9]{39,59}$/,
      /^bc1p[a-z0-9]{58}$/
    ],
    example: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
  },
  ethereum: {
    patterns: [/^0x[a-fA-F0-9]{40}$/],
    example: "0x742d35Cc6634C0532925a3b844Bc454e4438f44E"
  },
  litecoin: {
    patterns: [
      /^[LM][a-km-zA-HJ-NP-Z1-9]{26,33}$/,
      /^ltc1[a-z0-9]{39,59}$/
    ],
    example: "LgGxuHjJBqeqjFrVrczXkkV1rWiQZwwWgP"
  },
  ripple: {
    patterns: [/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/],
    example: "rN7n7otQDd6FczFgLdhmKAh4RNrYKKiVJC"
  },
  cardano: {
    patterns: [/^addr1[a-z0-9]{58,98}$/],
    example: "addr1qx5r2wqnkf3..."
  },
  solana: {
    patterns: [/^[1-9A-HJ-NP-Za-km-z]{32,44}$/],
    example: "9B5X4z3vYaGx9Zt6pQwJ8kL4nQ3mR5sT2yU1vW0xM9"
  },
  polkadot: {
    patterns: [/^1[a-zA-Z0-9]{30,50}$/],
    example: "1ZiETiM6m3eZpq2rS6e9qL8L..."
  },
  dogecoin: {
    patterns: [/^D[5-9A-HJ-NP-U][a-km-zA-HJ-NP-Z1-9]{24,33}$/],
    example: "DPaHvbH5V4d7r9t6r4v2p9m8n1j3k5l7"
  }
};

function validateWalletAddress(address, cryptoType) {
  if (!address || !cryptoType) {
    return { valid: false, message: "Please select a cryptocurrency and enter address" };
  }

  const crypto = walletPatterns[cryptoType];
  if (!crypto) {
    return { valid: false, message: "Unknown cryptocurrency" };
  }

  const isValid = crypto.patterns.some(pattern => pattern.test(address));

  if (isValid) {
    return { valid: true, message: `✓ Valid ${cryptoNames[cryptoType]} address` };
  } else {
    return { 
      valid: false, 
      message: `Invalid ${cryptoNames[cryptoType]} address format. Example: ${crypto.example.substring(0, 20)}...` 
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
  } else {
    validationEl.className = 'wallet-validation invalid';
    iconEl.textContent = '✗';
  }
  
  textEl.textContent = result.message;
}

// Wallet validation event listener
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
  } else {
    document.getElementById('walletValidation').style.display = 'none';
  }
});

document.getElementById('cryptoType').addEventListener('change', function() {
  const address = document.getElementById('walletAddress').value.trim();
  if (address.length > 10) {
    const result = validateWalletAddress(address, this.value);
    updateValidationUI(result);
  }
});

// ============================================
// AUTH CHECK
// ============================================

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = 'index.html';
  } else {
    currentUser = user;
    console.log("✅ User logged in:", user.email);
  }
});

// ============================================
// WALLET ADDRESS DISPLAY
// ============================================

window.updateWebsiteWallet = function() {
  const cryptoType = document.getElementById("cryptoType").value;
  const websiteWalletBox = document.getElementById("websiteWalletBox");
  const websiteWalletAddress = document.getElementById("websiteWalletAddress");

  if (cryptoType && websiteWallets[cryptoType]) {
    websiteWalletAddress.textContent = websiteWallets[cryptoType];
    websiteWalletBox.classList.add('show');
  } else {
    websiteWalletBox.classList.remove('show');
  }
};

// ============================================
// COPY WALLET ADDRESS
// ============================================

window.copyWalletAddress = function() {
  const walletAddress = document.getElementById("websiteWalletAddress").textContent;
  
  if (walletAddress === "--") {
    showMessage("⚠️ Please select a cryptocurrency first", "error");
    return;
  }

  navigator.clipboard.writeText(walletAddress).then(() => {
    showMessage("✅ Wallet address copied to clipboard!", "success");
  }).catch((err) => {
    console.error("Failed to copy:", err);
    showMessage("❌ Failed to copy address", "error");
  });
};

// ============================================
// CRYPTO DEPOSIT HANDLER
// ============================================

window.handleCryptoDeposit = async function(event) {
  event.preventDefault();

  if (!currentUser) {
    showMessage("❌ You must be logged in to deposit crypto!", "error");
    return;
  }

  const cryptoType = document.getElementById("cryptoType").value;
  const rawAmount = document.getElementById("cryptoAmount").value;
  const amount = parseFloat(rawAmount);
  const walletAddress = document.getElementById("walletAddress").value.trim();
  const submitBtn = document.getElementById("submitBtn");

  console.log("📝 Deposit attempt - Raw amount:", rawAmount, "Parsed amount:", amount);

  // Validation
  if (!cryptoType) {
    showMessage("⚠️ Please select a cryptocurrency", "error");
    return;
  }

  if (isNaN(amount) || amount < 10) {
    showMessage("⚠️ Minimum deposit is $10 USD (enter a valid number)", "error");
    return;
  }

  if (!walletAddress || walletAddress.length < 20) {
    showMessage("⚠️ Please enter a valid wallet address", "error");
    return;
  }

  // Validate wallet address format
  const validationResult = validateWalletAddress(walletAddress, cryptoType);
  if (!validationResult.valid) {
    showMessage(`❌ ${validationResult.message}`, "error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Processing...";

  try {
    // Show processing screen
    document.getElementById("cryptoForm").style.display = "none";
    document.getElementById("message").style.display = "none";
    document.getElementById("processingScreen").classList.add("show");

    // Get user's current balance
    const userDocRef = doc(db, "users", currentUser.uid);
    const userDocBefore = await getDoc(userDocRef);
    
    if (!userDocBefore.exists()) {
      throw new Error("User document not found. Please contact support.");
    }

    const rawOldBalance = userDocBefore.data().balance;
    const oldBalance = (typeof rawOldBalance === 'number' && !isNaN(rawOldBalance)) ? rawOldBalance : parseFloat(rawOldBalance) || 0;

    // Simulate blockchain verification
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Generate transaction ID
    const transactionId = "TX" + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();

    console.log(`\n📝 === CRYPTO DEPOSIT START ===`);
    console.log(`   Crypto Type: ${cryptoType}`);
    console.log(`   Old Balance: $${oldBalance.toFixed(2)}`);
    console.log(`   Amount to add: $${amount.toFixed(2)}`);
    console.log(`   Transaction ID: ${transactionId}`);

    // Update Firestore
    await updateDoc(userDocRef, {
      balance: increment(amount),
      lastCryptoDeposit: {
        type: cryptoType,
        amount: amount,
        walletAddress: walletAddress,
        timestamp: new Date().toISOString(),
        transactionId: transactionId,
        status: "completed"
      },
      depositHistory: arrayUnion({
        transactionId: transactionId,
        type: cryptoType,
        amount: amount,
        walletAddress: walletAddress,
        timestamp: new Date().toISOString(),
        status: "completed"
      }),
      lastTransactionTime: new Date().toISOString()
    });

    console.log(`✅ Firestore updated successfully`);

    // Get updated balance
    let retries = 5;
    let newBalance = oldBalance;
    
    while (retries > 0) {
      const userDocAfter = await getDoc(userDocRef);
      if (userDocAfter.exists()) {
        const rawNewBalance = userDocAfter.data().balance;
        newBalance = (typeof rawNewBalance === 'number' && !isNaN(rawNewBalance)) ? rawNewBalance : parseFloat(rawNewBalance) || 0;
      } else {
        newBalance = 0;
      }
      
      if (newBalance > oldBalance) break;
      retries--;
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`   New Balance: $${newBalance.toFixed(2)}`);
    console.log(`📝 === CRYPTO DEPOSIT COMPLETE ===\n`);
    
    // Show success screen
    showSuccessScreen(cryptoType, amount, walletAddress, oldBalance, newBalance, transactionId);

  } catch (error) {
    console.error("❌ Crypto deposit error:", error);
    document.getElementById("processingScreen").classList.remove("show");
    document.getElementById("cryptoForm").style.display = "block";
    
    let errorMsg = error.message;
    if (error.code === 'permission-denied') {
      errorMsg = "Permission denied. Check Firestore security rules.";
    }
    
    showMessage(`❌ Deposit failed: ${errorMsg}`, "error");
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit & Deposit Funds";
  }
};

// ============================================
// SUCCESS SCREEN
// ============================================

function showSuccessScreen(cryptoType, amount, userWallet, oldBalance, newBalance, transactionId) {
  const toWallet = websiteWallets[cryptoType] || "Unknown";

  // Populate success screen
  document.getElementById("successCryptoType").textContent = cryptoNames[cryptoType] || cryptoType;
  document.getElementById("successAmount").textContent = `$${amount.toFixed(2)} USD`;
  document.getElementById("transactionId").textContent = transactionId;
  document.getElementById("successFromWallet").textContent = userWallet;
  document.getElementById("successToWallet").textContent = toWallet;
  document.getElementById("successTime").textContent = new Date().toLocaleString();
  document.getElementById("oldBalance").textContent = oldBalance.toFixed(2);
  document.getElementById("newBalance").textContent = newBalance.toFixed(2);

  // Hide processing, show success
  document.getElementById("processingScreen").classList.remove("show");
  document.getElementById("successScreen").classList.add("show");
}

// ============================================
// MESSAGE HELPER
// ============================================

function showMessage(text, type = 'success') {
  const messageEl = document.getElementById("message");
  messageEl.innerText = text;
  messageEl.className = `message show ${type}`;
  setTimeout(() => {
    messageEl.classList.remove('show');
  }, 5000);
}
