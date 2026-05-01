// CryptoVault Authentication Module
import { 
  auth, 
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  doc,
  setDoc
} from './firebase-config.js';

// ============================================
// UI HELPER FUNCTIONS
// ============================================

function showMessage(text, type = 'success') {
  const messageEl = document.getElementById("message");
  messageEl.innerText = text;
  messageEl.className = `message show ${type}`;
  setTimeout(() => {
    messageEl.classList.remove('show');
  }, 6000);
}

// ============================================
// MODE SWITCHING (Login/Signup)
// ============================================

window.switchMode = function(mode) {
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const tabs = document.querySelectorAll('.auth-tab');
  
  if (mode === 'login') {
    loginForm.classList.add('active');
    signupForm.classList.remove('active');
    tabs[0].classList.add('active');
    tabs[1].classList.remove('active');
  } else {
    loginForm.classList.remove('active');
    signupForm.classList.add('active');
    tabs[0].classList.remove('active');
    tabs[1].classList.add('active');
  }
  document.getElementById("message").className = 'message';
};

// ============================================
// SIGN UP FUNCTION
// ============================================

document.getElementById('signupForm').addEventListener('submit', function(e) {
  e.preventDefault();
  
  const name = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;
  const submitBtn = document.getElementById("signupBtn");

  // Validation
  if (!name || !email || !password) {
    showMessage('⚠️ Please fill in all fields', 'error');
    return;
  }

  if (name.length < 2) {
    showMessage('⚠️ Please enter a valid name', 'error');
    return;
  }

  if (password.length < 6) {
    showMessage('⚠️ Password must be at least 6 characters', 'error');
    return;
  }

  if (!email.includes('@')) {
    showMessage('⚠️ Please enter a valid email', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating Account...';

  createUserWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      return userCredential.user.getIdToken().then(async () => {
        const user = userCredential.user;
        console.log('User created:', user.email);
        
        // Store name in localStorage
        localStorage.setItem(`user_${user.uid}_name`, name);
        localStorage.setItem(`user_${user.uid}_email`, email);
        
        // Create user document in Firestore
        try {
          await setDoc(doc(db, "users", user.uid), {
            name: name,
            email: user.email,
            balance: 0,
            createdAt: new Date().toISOString()
          });
          console.log("✅ User document created in Firestore");
        } catch (error) {
          console.error("Error creating user document:", error);
        }
        
        showMessage('✅ Account created successfully!', 'success');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Account';
        setTimeout(() => {
          document.getElementById("signupName").value = '';
          document.getElementById("signupEmail").value = '';
          document.getElementById("signupPassword").value = '';
          window.switchMode('login');
          document.getElementById("loginEmail").value = email;
          showMessage('📧 You can now sign in with your account!', 'success');
        }, 1500);
      });
    })
    .catch(err => {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Account';
      let errorMsg = err.message;
      if (err.code === 'auth/email-already-in-use') {
        errorMsg = 'This email is already registered. Try signing in instead.';
      } else if (err.code === 'auth/weak-password') {
        errorMsg = 'Password is too weak. Use at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        errorMsg = 'Invalid email address.';
      }
      showMessage(`❌ ${errorMsg}`, 'error');
    });
});

// ============================================
// LOGIN FUNCTION
// ============================================

document.getElementById('loginForm').addEventListener('submit', function(e) {
  e.preventDefault();
  
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const submitBtn = document.getElementById("loginBtn");

  if (!email || !password) {
    showMessage('⚠️ Please enter email and password', 'error');
    return;
  }

  if (!email.includes('@')) {
    showMessage('⚠️ Please enter a valid email', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Logging in...';

  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      const user = userCredential.user;
      const storedName = localStorage.getItem(`user_${user.uid}_name`);
      const userName = storedName || user.displayName || email.split('@')[0];
      
      if (!storedName && userName) {
        localStorage.setItem(`user_${user.uid}_name`, userName);
      }
      
      console.log("✅ User logged in:", email, "Name:", userName);
      
      // Store current user info in sessionStorage
      sessionStorage.setItem('currentUser', JSON.stringify({
        uid: user.uid,
        email: user.email,
        name: userName
      }));
      sessionStorage.setItem('userName', userName);
      
      showMessage(`✅ Welcome ${userName}!`, 'success');
      
      // Redirect to dashboard
      window.location.href = 'dashboard.html';
    })
    .catch(err => {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Login to Account';
      let errorMsg = err.message;
      if (err.code === 'auth/user-not-found') {
        errorMsg = 'No account found with this email. Please create an account first.';
      } else if (err.code === 'auth/wrong-password') {
        errorMsg = 'Incorrect password. Please try again.';
      } else if (err.code === 'auth/invalid-credential') {
        errorMsg = 'Invalid email or password. Please check and try again.';
      } else if (err.code === 'auth/too-many-requests') {
        errorMsg = 'Too many failed login attempts. Please try again later.';
      }
      showMessage(`❌ ${errorMsg}`, 'error');
    });
});

// ============================================
// PASSWORD RESET
// ============================================

window.resetPassword = function() {
  const email = document.getElementById("loginEmail").value.trim();

  if (!email) {
    showMessage('⚠️ Please enter your email address', 'error');
    return;
  }

  if (!email.includes('@')) {
    showMessage('⚠️ Please enter a valid email', 'error');
    return;
  }

  sendPasswordResetEmail(auth, email)
    .then(() => {
      showMessage('📧 Password reset email sent! Check your inbox.', 'success');
    })
    .catch(err => {
      let errorMsg = err.message;
      if (err.code === 'auth/user-not-found') {
        errorMsg = 'No account found with this email.';
      }
      showMessage(`❌ ${errorMsg}`, 'error');
    });
};

// ============================================
// AUTH STATE LISTENER
// ============================================

let isRedirecting = false;
onAuthStateChanged(auth, (user) => {
  if (user && !isRedirecting) {
    const userName = localStorage.getItem(`user_${user.uid}_name`) || user.displayName || user.email.split('@')[0];
    console.log("✅ User already logged in:", user.email);
    
    window.currentUser = {
      uid: user.uid,
      email: user.email,
      name: userName
    };
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

window.getCurrentUser = function() {
  return window.currentUser || JSON.parse(sessionStorage.getItem('currentUser')) || null;
};

window.displayUserGreeting = function(elementId = 'user-greeting') {
  const user = window.getCurrentUser();
  if (user && document.getElementById(elementId)) {
    document.getElementById(elementId).innerHTML = `Welcome, <strong>${user.name}</strong>! 👋`;
  }
};

// Auto-display greeting on page load
document.addEventListener('DOMContentLoaded', function() {
  window.displayUserGreeting();
});
