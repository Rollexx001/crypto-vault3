// CryptoVault Dashboard Module
import { 
  auth, 
  db,
  onAuthStateChanged,
  signOut,
  doc,
  getDoc,
  onSnapshot
} from './firebase-config.js';

// ============================================
// GLOBAL VARIABLES
// ============================================

let currentBalance = 0;
let balanceCheckInterval = null;
let dashboardAuthChecked = false;

// ============================================
// DEBUG FUNCTION - Call window.debugBalance() in console
// ============================================
window.debugBalance = async function() {
  const user = auth.currentUser;
  if (!user) {
    console.log("❌ No user logged in");
    return;
  }
  console.log("🔍 Debug Info:");
  console.log("   User UID:", user.uid);
  console.log("   User Email:", user.email);
  
  try {
    const userDocRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userDocRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log("   Document exists: ✅");
      console.log("   Raw balance value:", data.balance);
      console.log("   Balance type:", typeof data.balance);
      console.log("   Full user data:", JSON.stringify(data, null, 2));
    } else {
      console.log("   Document exists: ❌ NOT FOUND");
      console.log("   This means the user document was never created in Firestore");
    }
  } catch (error) {
    console.error("   Error fetching document:", error);
  }
};

// ============================================
// AUTH STATE & USER DATA
// ============================================

onAuthStateChanged(auth, (user) => {
  if (user) {
    const storedName = localStorage.getItem(`user_${user.uid}_name`);
    const sessionName = sessionStorage.getItem('userName');
    const userName = storedName || sessionName || user.displayName || user.email.split('@')[0];
    
    if (!storedName && userName !== user.email.split('@')[0]) {
      localStorage.setItem(`user_${user.uid}_name`, userName);
    }
    
    console.log("✅ User logged in:", user.email, "Name:", userName);
    
    // Display user info
    document.getElementById('userGreeting').textContent = userName;
    document.getElementById('userNameNav').textContent = userName;
    document.getElementById('userEmailNav').textContent = user.email;
    document.getElementById('userInitial').textContent = userName.charAt(0).toUpperCase();
    
    // Setup balance listener
    setupBalanceListener(user.uid);
    
    dashboardAuthChecked = true;
  } else {
    if (dashboardAuthChecked) {
      console.log("❌ No user logged in - Redirecting to login");
      window.location.href = 'index.html';
    }
  }
});

// ============================================
// BALANCE LISTENER
// ============================================

function setupBalanceListener(uid) {
  const userDocRef = doc(db, "users", uid);
  
  console.log(`🔄 Setting up real-time balance listener for user: ${uid}`);
  
  // Initial fetch
  getDoc(userDocRef).then((docSnap) => {
    if (docSnap.exists()) {
      const rawBalance = docSnap.data().balance;
      const balance = (typeof rawBalance === 'number' && !isNaN(rawBalance)) ? rawBalance : parseFloat(rawBalance) || 0;
      currentBalance = balance;
      document.getElementById('userBalance').textContent = `$${balance.toFixed(2)}`;
      console.log(`📄 Initial balance loaded: $${balance.toFixed(2)}`);
    }
  }).catch((error) => {
    console.error("❌ Error loading initial balance:", error);
  });
  
  // Real-time listener
  let unsubscribe = onSnapshot(userDocRef, (docSnap) => {
    if (docSnap.exists()) {
      const userData = docSnap.data();
      const rawBalance = userData.balance;
      const balance = (typeof rawBalance === 'number' && !isNaN(rawBalance)) ? rawBalance : parseFloat(rawBalance) || 0;
      
      const balanceElement = document.getElementById('userBalance');
      balanceElement.textContent = `$${balance.toFixed(2)}`;
      
      // Add animation when balance changes
      if (balance !== currentBalance) {
        currentBalance = balance;
        balanceElement.classList.remove('updating');
        void balanceElement.offsetWidth;
        balanceElement.classList.add('updating');
        setTimeout(() => balanceElement.classList.remove('updating'), 1500);
      }
      
      // Update stats
      updateStats(userData);
      
    } else {
      console.warn("⚠️ User document not found!");
      resetStats();
    }
  }, (error) => {
    console.error("❌ Error in balance listener:", error);
  });
  
  // Backup: Check balance every 3 seconds
  if (balanceCheckInterval) clearInterval(balanceCheckInterval);
  balanceCheckInterval = setInterval(async () => {
    try {
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        const userData = docSnap.data();
        const balance = userData.balance || 0;
        if (balance !== currentBalance) {
          console.log(`🔄 Periodic check detected balance change`);
          document.getElementById('userBalance').textContent = `$${balance.toFixed(2)}`;
          currentBalance = balance;
          updateStats(userData);
        }
      }
    } catch (error) {
      console.error("Error in periodic balance check:", error);
    }
  }, 3000);
  
  window.balanceUnsubscribe = unsubscribe;
}

// ============================================
// STATS UPDATE
// ============================================

function updateStats(userData) {
  const depositHistory = userData.depositHistory || [];
  
  // Update transaction number
  document.getElementById('totalAssets').textContent = depositHistory.length.toString();
  
  // Calculate 24h change
  let change24hPercent = 0;
  const totalDeposits = depositHistory.reduce((sum, deposit) => sum + (deposit.amount || 0), 0);
  
  if (totalDeposits > 0) {
    const lastDayDeposits = depositHistory.filter(deposit => {
      const depositTime = new Date(deposit.timestamp);
      const hoursDiff = (new Date() - depositTime) / (1000 * 60 * 60);
      return hoursDiff <= 24;
    }).reduce((sum, deposit) => sum + (deposit.amount || 0), 0);
    
    change24hPercent = ((lastDayDeposits / totalDeposits) * 100).toFixed(1);
  }
  
  // Update 24h change display
  const change24hElement = document.getElementById('change24h');
  const changeSymbol = change24hPercent >= 0 ? '+' : '';
  change24hElement.textContent = `${changeSymbol}${change24hPercent}%`;
  
  // Color code
  if (change24hPercent > 0) {
    change24hElement.style.color = '#4caf50';
  } else if (change24hPercent < 0) {
    change24hElement.style.color = '#ff6b6b';
  } else {
    change24hElement.style.color = '#00d4ff';
  }
}

function resetStats() {
  document.getElementById('userBalance').textContent = "$0.00";
  document.getElementById('totalAssets').textContent = "0";
  document.getElementById('change24h').textContent = "+0%";
}

// ============================================
// LOGOUT FUNCTION
// ============================================

window.logout = function() {
  signOut(auth).then(() => {
    console.log("User logged out");
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('userName');
    window.location.href = 'index.html';
  }).catch((error) => {
    console.error("Logout error:", error);
  });
};

// ============================================
// MENU TOGGLE
// ============================================

window.toggleMenu = function() {
  const menuDropdown = document.getElementById('menuDropdown');
  menuDropdown.classList.toggle('show');
};

// Close menu when clicking outside
document.addEventListener('click', function(event) {
  const menuDropdown = document.getElementById('menuDropdown');
  const menuBtn = event.target.closest('.menu-btn');
  const menuDropdownElement = event.target.closest('.menu-dropdown');
  
  if (!menuBtn && !menuDropdownElement) {
    menuDropdown.classList.remove('show');
  }
});

// Handle menu item clicks
document.querySelectorAll('.dropdown-item').forEach(item => {
  item.addEventListener('click', function() {
    document.getElementById('menuDropdown').classList.remove('show');
  });
});

// ============================================
// MANUAL REFRESH BALANCE
// ============================================

window.manualRefreshBalance = async function() {
  const user = auth.currentUser;
  
  if (!user) {
    alert("❌ You must be logged in to refresh balance");
    return;
  }
  
  const refreshBtn = document.querySelector('.refresh-balance-btn');
  if (refreshBtn) refreshBtn.classList.add('loading');
  
  try {
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const balance = userData.balance || 0;
      
      const balanceElement = document.getElementById('userBalance');
      balanceElement.textContent = `$${balance.toFixed(2)}`;
      currentBalance = balance;
      
      // Animate
      balanceElement.classList.remove('updating');
      void balanceElement.offsetWidth;
      balanceElement.classList.add('updating');
      setTimeout(() => {
        balanceElement.classList.remove('updating');
        if (refreshBtn) refreshBtn.classList.remove('loading');
      }, 1500);
      
      updateStats(userData);
      
    } else {
      alert("❌ User document not found. Please contact support.");
      if (refreshBtn) refreshBtn.classList.remove('loading');
    }
  } catch (error) {
    console.error("❌ Error refreshing balance:", error);
    alert(`❌ Error refreshing balance: ${error.message}`);
    if (refreshBtn) refreshBtn.classList.remove('loading');
  }
};
