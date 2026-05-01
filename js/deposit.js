// CryptoVault Deposit Module
import { 
  auth, 
  db,
  onAuthStateChanged,
  doc,
  getDoc,
  updateDoc,
  increment
} from './firebase-config.js';

// ============================================
// AUTH CHECK
// ============================================

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = 'index.html';
  } else {
    console.log("✅ User logged in:", user.email);
  }
});

// ============================================
// DEPOSIT FUNCTION
// ============================================

window.depositFunds = async function(amount) {
  const user = auth.currentUser;
  
  if (!user) {
    alert('❌ You must be logged in to deposit funds!');
    return;
  }

  if (!amount || amount <= 0) {
    alert('❌ Please enter a valid amount');
    return;
  }

  try {
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      console.error('❌ User document not found');
      alert('❌ User document not found. Please logout and login again.');
      return;
    }

    const oldBalance = userDoc.data().balance || 0;
    console.log(`\n📝 === DEPOSIT TRANSACTION START ===`);
    console.log(`   Old Balance: $${oldBalance.toFixed(2)}`);
    console.log(`   Amount to add: $${parseFloat(amount).toFixed(2)}`);
    
    // Update balance
    await updateDoc(userDocRef, {
      balance: increment(parseFloat(amount))
    });
    
    console.log(`✅ Balance updated successfully!`);
    
    // Get updated balance
    let retries = 3;
    let newBalance = oldBalance;
    
    while (retries > 0) {
      const updatedDoc = await getDoc(userDocRef);
      newBalance = updatedDoc.data().balance || 0;
      
      if (newBalance > oldBalance) break;
      retries--;
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`   New Balance: $${newBalance.toFixed(2)}`);
    
    alert(`✅ Deposit successful! $${parseFloat(amount).toFixed(2)} added.\nNew Balance: $${newBalance.toFixed(2)}`);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    window.location.href = 'dashboard.html';
    
  } catch (error) {
    console.error("❌ Deposit error:", error);
    let errorMsg = error.message;
    if (error.code === 'permission-denied') {
      errorMsg = "Permission denied. Check Firestore security rules.";
    }
    alert(`❌ Deposit failed: ${errorMsg}`);
  }
};

// ============================================
// DEPOSIT METHOD HANDLERS
// ============================================

document.addEventListener('DOMContentLoaded', function() {
  const methods = [
    'Bank Transfer',
    'Credit/Debit Card',
    'Cryptocurrency',
    'Digital Wallet',
    'Wire Transfer',
    'Gift Card'
  ];

  document.querySelectorAll('.method-btn').forEach((btn, index) => {
    btn.addEventListener('click', function(e) {
      // Cryptocurrency has its own page
      if (index === 2) return;
      
      e.preventDefault();
      const amount = prompt(`Enter deposit amount ($) for ${methods[index]}:`);
      
      if (amount) {
        window.depositFunds(amount);
      }
    });
  });
});
