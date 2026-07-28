// =============================================
// EFD Fuel Booking - Premium v2.0
// With Uber-like Timeline, Cancel, ETA, Agent Info
// =============================================

import { db, auth } from "../firebase/firebase-config.js";

import {
    collection,
    addDoc,
    query,
    where,
    onSnapshot,
    doc,
    updateDoc,
    getDoc,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const bookBtn = document.getElementById("bookBtn");

// ===== AUTO-DETECT LOCATION ON PAGE LOAD =====
(function autoDetectLocation() {
    const locationInput = document.getElementById("location");
    const locationStatus = document.getElementById("locationStatus");
    const locationIcon = document.getElementById("locationIcon");

    if (!locationInput) return;

    // Check if we already have a saved location
    const savedLocation = localStorage.getItem("lastKnownAddress");
    if (savedLocation) {
        locationInput.value = savedLocation;
        locationInput.style.borderColor = "#4CAF50";
        if (locationStatus) locationStatus.textContent = "(detected)";
        if (locationIcon) locationIcon.innerHTML = '<i class="fa-solid fa-check-circle" style="color:#4CAF50;"></i>';
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async function(position) {
            const { latitude, longitude } = position.coords;
            try {
                // Use reverse geocoding via OpenStreetMap Nominatim
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`);
                const data = await res.json();
                const address = data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
                
                // Shorten the address for display
                const shortAddress = data.address ? 
                    [data.address.road, data.address.suburb, data.address.city || data.address.town || data.address.village]
                        .filter(Boolean).join(", ") : address;

                locationInput.value = shortAddress || address;
                locationInput.style.borderColor = "#4CAF50";
                if (locationStatus) locationStatus.textContent = "(detected)";
                if (locationIcon) locationIcon.innerHTML = '<i class="fa-solid fa-check-circle" style="color:#4CAF50;"></i>';
                
                localStorage.setItem("lastKnownAddress", shortAddress || address);
            } catch (err) {
                console.log("Geocode error, using coordinates:", err);
                locationInput.value = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
                locationInput.style.borderColor = "#4CAF50";
                if (locationStatus) locationStatus.textContent = "(detected)";
                if (locationIcon) locationIcon.innerHTML = '<i class="fa-solid fa-check-circle" style="color:#4CAF50;"></i>';
            }
        },
        function(error) {
            console.log("Location error:", error.message);
            locationInput.placeholder = "Enter your location manually";
            locationInput.readOnly = false;
            locationInput.style.background = "#fff";
            locationInput.style.borderColor = "#e0e0e0";
            if (locationStatus) locationStatus.textContent = "(manual)";
            if (locationIcon) locationIcon.innerHTML = '<i class="fa-solid fa-pen" style="color:#888;"></i>';
        },
        { enableHighAccuracy: true, timeout: 8000 }
    );
})();

// ===== BOOKING FORM SUBMIT =====
bookBtn.addEventListener("click", function() {
    const fuel = document.getElementById("fuelType").value;
    const litres = document.getElementById("litres").value;
    const location = document.getElementById("location").value;
    const phone = document.getElementById("phone").value;

    if (litres === "" || location === "" || phone === "") {
        showToast("Please fill all fields", "warning");
        return;
    }

    if (parseInt(litres) < 1) {
        showToast("Please enter a valid quantity", "warning");
        return;
    }

    if (!auth.currentUser) {
        showToast("Please login first", "info");
        window.location = "login.html";
        return;
    }

    bookBtn.disabled = true;
    bookBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Booking...';

    navigator.geolocation.getCurrentPosition(
        async function(position) {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;

            try {
                const orderRef = await addDoc(collection(db, "orders"), {
                    service: "Fuel",
                    fuel: fuel,
                    litres: litres,
                    location: location,
                    phone: phone,
                    customerId: auth.currentUser.uid,
                    customerEmail: auth.currentUser.email,
                    latitude: latitude,
                    longitude: longitude,
                    status: "Pending",
                    createdAt: new Date().toISOString(),
                    paymentStatus: "Pending"
                });

                showToast("Fuel booking successful! 🎉", "success");

                // Store order ID for tracking
                localStorage.setItem("currentOrderId", orderRef.id);

                // Open timeline overlay
                setTimeout(() => {
                    startTracking(orderRef.id);
                    window.openTimeline();
                }, 500);
            } catch (error) {
                console.log(error);
                showToast(error.message, "error");
                bookBtn.disabled = false;
                bookBtn.innerHTML = '<i class="fa-solid fa-truck"></i> Request Fuel Delivery';
            }
        },
        function(error) {
            showToast("Location permission required", "error");
            bookBtn.disabled = false;
            bookBtn.innerHTML = '<i class="fa-solid fa-truck"></i> Request Fuel Delivery';
        },
        { enableHighAccuracy: true }
    );
});

// ===== TIMELINE TRACKING =====
let currentOrderId = localStorage.getItem("currentOrderId");
let currentStatus = "Pending";
let unsubscribeOrder = null;

// Auto-start tracking if there's an active order
onAuthStateChanged(auth, (user) => {
    if (!user) return;
    
    // Check for active orders on page load
    const activeQ = query(
        collection(db, "orders"),
        where("customerId", "==", user.uid),
        where("status", "in", ["Pending", "Accepted", "On The Way", "Reached"]),
        orderBy("createdAt", "desc"),
        limit(1)
    );
    
    onSnapshot(activeQ, (snapshot) => {
        if (!snapshot.empty) {
            const order = snapshot.docs[0].data();
            const orderId = snapshot.docs[0].id;
            // Only auto-open if we're not already tracking this order manually
            if (orderId !== currentOrderId) {
                currentOrderId = orderId;
                localStorage.setItem("currentOrderId", orderId);
                startTracking(orderId);
            }
        }
    });
});

function startTracking(orderId) {
    currentOrderId = orderId;
    localStorage.setItem("currentOrderId", orderId);

    // Clean up previous listener
    if (unsubscribeOrder) unsubscribeOrder();

    // Listen to order changes
    unsubscribeOrder = onSnapshot(doc(db, "orders", orderId), (orderDoc) => {
        if (!orderDoc.exists()) return;
        
        const order = orderDoc.data();
        currentStatus = order.status;
        
        updateTimelineUI(order);
        updateAgentInfo(order);
        updateETA(order);
        updateCancelButton(order);
    });
}

function updateTimelineUI(order) {
    const status = order.status;
    const steps = ["Pending", "Accepted", "On The Way", "Reached", "Completed"];
    const stepIndex = steps.indexOf(status);
    
    // Update status text
    const statusText = document.getElementById("tlStatusText");
    if (statusText) statusText.textContent = status;

    // Status emoji mapping
    const statusEmojis = {
        "Pending": "⏳",
        "Accepted": "✅",
        "On The Way": "🚗",
        "Reached": "📍",
        "Completed": "🎉"
    };
    
    const statusLabel = document.getElementById("tlStatusLabel");
    if (statusLabel) {
        statusLabel.innerHTML = `Status: <strong id="tlStatusText">${status}</strong> ${statusEmojis[status] || ''}`;
    }

    // Update each step
    const stepIds = ["stepRequested", "stepAccepted", "stepStarted", "stepReached", "stepCompleted"];
    const timeIds = ["timeRequested", "timeAccepted", "timeStarted", "timeReached", "timeCompleted"];
    const timestamps = [
        order.createdAt,
        order.acceptedAt,
        order.deliveryStartedAt,
        order.reachedAt,
        order.completedAt
    ];
    const labels = ["Requested", "Accepted", "Started", "Reached", "Completed"];
    const descriptions = [
        "Order has been placed",
        "Agent has accepted your request",
        "Agent is on the way",
        "Agent has arrived at your location",
        "Service has been completed"
    ];

    // Step 0 (Requested) is always completed
    for (let i = 0; i < 5; i++) {
        const dot = document.getElementById(stepIds[i]);
        const time = document.getElementById(timeIds[i]);
        
        if (!dot) continue;
        
        // Remove all classes
        dot.classList.remove("completed", "active", "pending");
        
        if (i === 0) {
            // Requested is always completed
            dot.classList.add("completed");
            dot.innerHTML = '✓';
        } else if (i <= stepIndex) {
            dot.classList.add("completed");
            dot.innerHTML = '✓';
        } else if (i === stepIndex + 1 && status !== "Completed") {
            dot.classList.add("active");
            dot.innerHTML = `${i + 1}`;
        } else {
            dot.classList.add("pending");
            dot.innerHTML = `${i + 1}`;
        }

        // Update time
        if (time) {
            if (timestamps[i]) {
                const date = new Date(timestamps[i]);
                time.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else if (i <= stepIndex) {
                time.textContent = "Just now";
            } else {
                time.textContent = "-";
            }
        }
    }

    // Mark connector line as completed-all if all steps done
    const timelineContainer = document.getElementById("timelineSteps");
    if (timelineContainer) {
        if (status === "Completed") {
            timelineContainer.classList.add("completed-all");
        } else {
            timelineContainer.classList.remove("completed-all");
        }
    }
}

function updateAgentInfo(order) {
    const agentCard = document.getElementById("agentInfoCard");
    if (!agentCard) return;

    if (order.providerId) {
        agentCard.style.display = "flex";
        
        // Get agent details from users collection
        getDoc(doc(db, "users", order.providerId)).then((agentDoc) => {
            if (agentDoc.exists()) {
                const agent = agentDoc.data();
                const nameEl = document.getElementById("agentName");
                const avatarEl = document.getElementById("agentAvatar");
                const callBtn = document.getElementById("callAgentBtn");
                const serviceTypeEl = document.getElementById("agentServiceType");

                if (nameEl) nameEl.textContent = agent.name || "Agent";
                if (avatarEl) avatarEl.textContent = (agent.name || "A")[0].toUpperCase();
                if (serviceTypeEl) serviceTypeEl.textContent = "Fuel Specialist";
                
                // Set call button
                if (callBtn && agent.phone) {
                    callBtn.href = `tel:${agent.phone}`;
                }
            }
        }).catch(err => console.log("Error loading agent:", err));
    } else {
        agentCard.style.display = "none";
    }
}

function updateETA(order) {
    const etaDisplay = document.getElementById("etaDisplay");
    const etaText = document.getElementById("etaText");
    const etaSubtext = document.getElementById("etaSubtext");
    
    if (!etaDisplay || !etaText) return;

    if (order.status === "Pending") {
        etaDisplay.style.display = "none";
        return;
    }

    etaDisplay.style.display = "flex";

    if (order.status === "Accepted") {
        etaText.textContent = "Agent is preparing to start";
        etaSubtext.textContent = "Will depart shortly";
    } else if (order.status === "On The Way") {
        // Calculate ETA based on distance if available
        if (order.eta) {
            etaText.textContent = `Arriving in ~${order.eta} mins`;
        } else {
            etaText.textContent = "Agent is on the way";
        }
        etaSubtext.textContent = "Estimated time of arrival";
    } else if (order.status === "Reached") {
        etaText.textContent = "Agent has arrived! 📍";
        etaSubtext.textContent = "At your location";
    } else if (order.status === "Completed") {
        etaText.textContent = "Service Completed! ✅";
        etaSubtext.textContent = "Thank you for using EFD";
    }
}

function updateCancelButton(order) {
    const cancelSection = document.getElementById("cancelSection");
    const cancelDialog = document.getElementById("cancelReasonDialog");
    
    if (!cancelSection) return;

    // Can cancel only if pending or accepted
    if (order.status === "Pending" || order.status === "Accepted") {
        cancelSection.style.display = "block";
    } else {
        cancelSection.style.display = "none";
        if (cancelDialog) cancelDialog.style.display = "none";
    }
}

// ===== CANCEL ORDER FLOW =====
const cancelOrderBtn = document.getElementById("cancelOrderBtn");
const confirmCancelBtn = document.getElementById("confirmCancelBtn");
const keepOrderBtn = document.getElementById("keepOrderBtn");
const cancelReasonDialog = document.getElementById("cancelReasonDialog");

if (cancelOrderBtn) {
    cancelOrderBtn.addEventListener("click", function() {
        if (cancelReasonDialog) cancelReasonDialog.style.display = "block";
    });
}

if (keepOrderBtn) {
    keepOrderBtn.addEventListener("click", function() {
        if (cancelReasonDialog) cancelReasonDialog.style.display = "none";
    });
}

if (confirmCancelBtn) {
    confirmCancelBtn.addEventListener("click", async function() {
        const selectedReason = document.querySelector('input[name="cancelReason"]:checked');
        if (!selectedReason) {
            showToast("Please select a reason for cancellation", "warning");
            return;
        }

        if (!currentOrderId) {
            showToast("No active order found", "error");
            return;
        }

        try {
            confirmCancelBtn.disabled = true;
            confirmCancelBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cancelling...';

            await updateDoc(doc(db, "orders", currentOrderId), {
                status: "Cancelled",
                cancelledAt: new Date().toISOString(),
                cancelReason: selectedReason.value,
                cancelledBy: "Customer"
            });

            showToast("Order cancelled", "info");
            
            // Close timeline
            setTimeout(() => {
                window.closeTimeline();
                window.location = "customer.html";
            }, 1000);
        } catch (error) {
            console.log("Cancel error:", error);
            showToast("Error cancelling order: " + error.message, "error");
            confirmCancelBtn.disabled = false;
            confirmCancelBtn.innerHTML = "Yes, Cancel Order";
        }
    });
}

// ===== CALL AGENT =====
const callAgentBtn = document.getElementById("callAgentBtn");
if (callAgentBtn) {
    callAgentBtn.addEventListener("click", function(e) {
        const phone = this.getAttribute("href").replace("tel:", "");
        if (!phone || phone === "") {
            e.preventDefault();
            showToast("Agent phone number not available", "info");
        }
    });
}

// Cleanup on page unload
window.addEventListener("beforeunload", function() {
    if (unsubscribeOrder) unsubscribeOrder();
});

