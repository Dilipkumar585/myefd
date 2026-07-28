import { auth, db } from "../firebase/firebase-config.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

console.log("AUTH JS LOADED");

// ================= REGISTER =================

const registerForm = document.getElementById("registerForm");

if (registerForm) {

  registerForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    console.log("Register Button Clicked");

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const role = document.getElementById("role").value;
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    try {

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name: name,
        email: email,
        phone: phone,
        role: role,
        upiId: role !== "Customer" ? (document.getElementById("upiId") ? document.getElementById("upiId").value.trim() : "") : "",
        upiName: role !== "Customer" ? name : ""
      });

      alert("Registration Successful");

      window.location = "login.html";

    } catch (error) {

      console.log(error);
      alert(error.message);

    }

  });

}

// ================= LOGIN =================

const loginBtn = document.getElementById("loginBtn");

if (loginBtn) {

  loginBtn.addEventListener("click", async () => {

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    try {

      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      const uid = userCredential.user.uid;

      const userDoc = await getDoc(doc(db, "users", uid));

      if (!userDoc.exists()) {
        alert("User Data Not Found");
        return;
      }

      const user = userDoc.data();

      switch (user.role) {

        case "Customer":
          window.location = "customer.html";
          break;

        case "Fuel Agent":
          localStorage.setItem("agentService", "Fuel");
          window.location = "agent.html";
          break;

        case "Mechanic Agent":
          localStorage.setItem("agentService", "Mechanic");
          window.location = "agent.html";
          break;

        case "Ambulance Agent":
          localStorage.setItem("agentService", "Ambulance");
          window.location = "agent.html";
          break;

        case "Admin":
          window.location = "admin.html";
          break;

        default:
          alert("Invalid Role");
      }

    } catch (error) {

      console.log(error);
      alert(error.message);

    }

  });

}

// ================= LOGOUT =================

const logout = document.getElementById("logout");

if (logout) {

  logout.addEventListener("click", async (e) => {

    e.preventDefault();

    await signOut(auth);

    window.location = "login.html";

  });

}

// ================= RESET PASSWORD =================

const forgot = document.getElementById("forgot");

if (forgot) {

  forgot.addEventListener("click", async () => {

    const email = prompt("Enter Email");

    if (!email) return;

    try {

      await sendPasswordResetEmail(auth, email);

      alert("Password Reset Link Sent");

    } catch (error) {

      alert(error.message);

    }

  });

}

// ================= SESSION =================

onAuthStateChanged(auth, (user) => {

  if (user) {
    console.log("Logged In");
  } else {
    console.log("Logged Out");
  }

});