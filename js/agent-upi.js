// =============================================
// EFD Agent UPI Settings - v1.0
// Allows agents to set their UPI ID for payments
// =============================================

import { db, auth } from "../firebase/firebase-config.js";

import {
    doc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

console.log("Agent UPI Settings Loaded");

// Open UPI settings modal
window.openUPISettings = function() {
    const modal = document.getElementById("upiModal");
    if (modal) {
        modal.style.display = "flex";
        loadUPIDetails();
    }
};

// Close UPI settings modal
window.closeUPISettings = function() {
    const modal = document.getElementById("upiModal");
    if (modal) {
        modal.style.display = "none";
    }
};

// Load current UPI details
async function loadUPIDetails() {
    if (!auth.currentUser) return;
    
    try {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            const upiInput = document.getElementById("upiIdInput");
            const upiNameInput = document.getElementById("upiNameInput");
            
            if (upiInput && data.upiId) {
                upiInput.value = data.upiId;
            }
            if (upiNameInput && data.upiName) {
                upiNameInput.value = data.upiName;
            }
        }
    } catch (error) {
        console.log("Error loading UPI details:", error);
    }
}

// Save UPI details
window.saveUPIDetails = async function() {
    if (!auth.currentUser) {
        if (typeof showToast === "function") {
            showToast("Please login first", "error");
        }
        return;
    }

    const upiId = document.getElementById("upiIdInput").value.trim();
    const upiName = document.getElementById("upiNameInput").value.trim();

    if (!upiId) {
        if (typeof showToast === "function") {
            showToast("Please enter your UPI ID", "warning");
        }
        return;
    }

    // Basic UPI ID validation (format: something@provider)
    if (!upiId.includes("@")) {
        if (typeof showToast === "function") {
            showToast("Invalid UPI ID. It should be like name@bank", "error");
        }
        return;
    }

    try {
        const saveBtn = document.getElementById("saveUPIBtn");
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        }

        await updateDoc(doc(db, "users", auth.currentUser.uid), {
            upiId: upiId,
            upiName: upiName || "Payment"
        });

        if (typeof showToast === "function") {
            showToast("UPI details saved successfully! ✅", "success");
        }

        // Update display
        const upiDisplay = document.getElementById("upiStatusDisplay");
        if (upiDisplay) {
            upiDisplay.innerHTML = `
                <i class="fa-solid fa-circle-check" style="color:#4CAF50;"></i> 
                UPI: <strong>${upiId}</strong>
            `;
        }

        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save UPI Details';
        }

        window.closeUPISettings();
    } catch (error) {
        console.log("Error saving UPI:", error);
        if (typeof showToast === "function") {
            showToast("Error saving UPI details: " + error.message, "error");
        }
    }
};

// Load and display current UPI status on agent dashboard
onAuthStateChanged(auth, function(user) {
    if (!user) return;
    
    const upiDisplay = document.getElementById("upiStatusDisplay");
    if (!upiDisplay) return;

    getDoc(doc(db, "users", user.uid)).then(function(userDoc) {
        if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.upiId) {
                upiDisplay.innerHTML = `
                    <i class="fa-solid fa-circle-check" style="color:#4CAF50;"></i> 
                    UPI: <strong>${data.upiId}</strong>
                `;
            } else {
                upiDisplay.innerHTML = `
                    <i class="fa-solid fa-circle-exclamation" style="color:#FF9800;"></i> 
                    <span style="color:#FF9800;">UPI not set</span>
                `;
            }
        }
    }).catch(function(err) {
        console.log("Error loading UPI status:", err);
    });
});

