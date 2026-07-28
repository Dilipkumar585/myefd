import { db, auth } from "../firebase/firebase-config.js";

import {
    doc,
    updateDoc,
    addDoc,
    collection,
    getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const stars = document.querySelectorAll(".star");
let rating = 0;
let currentOrderId = null;

// Get order ID from URL
var urlParams = new URLSearchParams(window.location.search);
currentOrderId = urlParams.get("order") || localStorage.getItem("currentOrderId");

console.log("Rating page loaded, orderId:", currentOrderId);

// Check auth
onAuthStateChanged(auth, function(user) {
    if (!user) {
        if (typeof showToast === "function") showToast("Please login first", "info");
        else alert("Please login first");
        window.location = "login.html";
    }
});

stars.forEach(function(star, index) {
    star.addEventListener("click", function() {
        rating = index + 1;
        stars.forEach(function(s, i) {
            if (i < rating) {
                s.classList.add("active");
            } else {
                s.classList.remove("active");
            }
        });
    });
});

var submitBtn = document.getElementById("submitReview");
if (submitBtn) {
    submitBtn.addEventListener("click", async function() {
        if (rating === 0) {
            if (typeof showToast === "function") showToast("Please select a star rating", "warning");
            else alert("Please select a star rating");
            return;
        }

        var reviewText = document.getElementById("review") ? document.getElementById("review").value : "";

        if (!auth.currentUser) {
            if (typeof showToast === "function") showToast("Please login first", "info");
            else alert("Please login first");
            window.location = "login.html";
            return;
        }

        if (!currentOrderId) {
            if (typeof showToast === "function") showToast("No order found to rate", "error");
            else alert("No order found to rate");
            window.location = "customer.html";
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="loading-spinner"></span> Submitting...';
        submitBtn.classList.add("loading");

        try {
            // Save rating to Firestore under the order document
            await updateDoc(doc(db, "orders", currentOrderId), {
                rating: rating,
                review: reviewText,
                ratedAt: new Date().toISOString()
            });

            // Also save to a ratings collection for analytics
            await addDoc(collection(db, "ratings"), {
                orderId: currentOrderId,
                userId: auth.currentUser.uid,
                userEmail: auth.currentUser.email,
                rating: rating,
                review: reviewText,
                createdAt: new Date().toISOString()
            });

            if (typeof showToast === "function") showToast("Thank you for your feedback! 🌟", "success");
            else alert("Thank you for your feedback!");

            setTimeout(function() {
                window.location = "customer.html";
            }, 1500);
        } catch (error) {
            console.log("Rating error:", error);
            if (typeof showToast === "function") showToast("Failed to save rating: " + error.message, "error");
            else alert("Failed to save rating: " + error.message);
            submitBtn.disabled = false;
            submitBtn.innerHTML = "Submit Review";
            submitBtn.classList.remove("loading");
        }
    });
}

// Cleanup on page unload
window.addEventListener("beforeunload", function() {
    // No continuous listeners to clean up in rating page
});
