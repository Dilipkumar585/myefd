// =============================================
// EFD Ambulance Booking - Premium v2.0
// With Uber-like Timeline, Cancel, ETA, Agent Info
// =============================================

import { db, auth } from "../firebase/firebase-config.js";

import {
    collection,
    addDoc,
    doc,
    updateDoc,
    query,
    where,
    onSnapshot,
    getDoc,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const bookBtn = document.getElementById("bookAmbulance");

// ===== AUTO-DETECT LOCATION ON PAGE LOAD =====
(function autoDetectLocation() {
    const locationInput = document.getElementById("location3");
    const locationStatus = document.getElementById("locationStatus3");
    const locationIcon = document.getElementById("locationIcon3");

    if (!locationInput) return;

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
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`);
                const data = await res.json();
                const shortAddress = data.address ? 
                    [data.address.road, data.address.suburb, data.address.city || data.address.town || data.address.village]
                        .filter(Boolean).join(", ") : data.display_name;

                locationInput.value = shortAddress || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
                locationInput.style.borderColor = "#4CAF50";
                if (locationStatus) locationStatus.textContent = "(detected)";
                if (locationIcon) locationIcon.innerHTML = '<i class="fa-solid fa-check-circle" style="color:#4CAF50;"></i>';
                
                localStorage.setItem("lastKnownAddress", shortAddress || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
            } catch (err) {
                locationInput.value = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
                locationInput.style.borderColor = "#4CAF50";
                if (locationStatus) locationStatus.textContent = "(detected)";
                if (locationIcon) locationIcon.innerHTML = '<i class="fa-solid fa-check-circle" style="color:#4CAF50;"></i>';
            }
        },
        function(error) {
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
    if (!auth.currentUser) {
        showToast("Please login first", "info");
        window.location = "login.html";
        return;
    }

    const patientName = document.getElementById("patientName").value;
    const emergency = document.getElementById("emergency").value;
    const location = document.getElementById("location3").value;
    const phone = document.getElementById("phone3").value;

    if (patientName === "" || emergency === "" || location === "" || phone === "") {
        showToast("Please fill all fields", "warning");
        return;
    }

    bookBtn.disabled = true;
    bookBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Requesting...';

    navigator.geolocation.getCurrentPosition(
        async function(position) {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;

            try {
                const orderRef = await addDoc(collection(db, "orders"), {
                    service: "Ambulance",
                    patientName: patientName,
                    emergency: emergency,
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

                showToast("Ambulance request sent! 🚑", "success");
                localStorage.setItem("currentOrderId", orderRef.id);

                setTimeout(() => {
                    startTracking(orderRef.id);
                    window.openTimeline();
                }, 500);
            } catch (error) {
                console.log(error);
                showToast(error.message, "error");
                bookBtn.disabled = false;
                bookBtn.innerHTML = '<i class="fa-solid fa-truck-medical"></i> Request Ambulance';
            }
        },
        function(error) {
            showToast("Location permission required", "error");
            bookBtn.disabled = false;
            bookBtn.innerHTML = '<i class="fa-solid fa-truck-medical"></i> Request Ambulance';
        },
        { enableHighAccuracy: true }
    );
});

// ===== TIMELINE TRACKING =====
let currentOrderId = localStorage.getItem("currentOrderId");
let unsubscribeOrder = null;

onAuthStateChanged(auth, (user) => {
    if (!user) return;
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
    if (unsubscribeOrder) unsubscribeOrder();

    unsubscribeOrder = onSnapshot(doc(db, "orders", orderId), (orderDoc) => {
        if (!orderDoc.exists()) return;
        const order = orderDoc.data();
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
    const statusText = document.getElementById("tlStatusText");
    if (statusText) statusText.textContent = status;

    const statusEmojis = {
        "Pending": "⏳", "Accepted": "✅", "On The Way": "🚑", "Reached": "📍", "Completed": "🎉"
    };
    const statusLabel = document.getElementById("tlStatusLabel");
    if (statusLabel) {
        statusLabel.innerHTML = `Status: <strong id="tlStatusText">${status}</strong> ${statusEmojis[status] || ''}`;
    }

    const stepIds = ["stepRequested", "stepAccepted", "stepStarted", "stepReached", "stepCompleted"];
    const timeIds = ["timeRequested", "timeAccepted", "timeStarted", "timeReached", "timeCompleted"];
    const timestamps = [order.createdAt, order.acceptedAt, order.deliveryStartedAt, order.reachedAt, order.completedAt];

    for (let i = 0; i < 5; i++) {
        const dot = document.getElementById(stepIds[i]);
        const time = document.getElementById(timeIds[i]);
        if (!dot) continue;
        dot.classList.remove("completed", "active", "pending");
        if (i === 0) { dot.classList.add("completed"); dot.innerHTML = '✓'; }
        else if (i <= stepIndex) { dot.classList.add("completed"); dot.innerHTML = '✓'; }
        else if (i === stepIndex + 1 && status !== "Completed") { dot.classList.add("active"); dot.innerHTML = `${i + 1}`; }
        else { dot.classList.add("pending"); dot.innerHTML = `${i + 1}`; }
        if (time) {
            if (timestamps[i]) {
                time.textContent = new Date(timestamps[i]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else if (i <= stepIndex) { time.textContent = "Just now"; }
            else { time.textContent = "-"; }
        }
    }

    const timelineContainer = document.getElementById("timelineSteps");
    if (timelineContainer) {
        if (status === "Completed") timelineContainer.classList.add("completed-all");
        else timelineContainer.classList.remove("completed-all");
    }
}

function updateAgentInfo(order) {
    const agentCard = document.getElementById("agentInfoCard");
    if (!agentCard) return;
    if (order.providerId) {
        agentCard.style.display = "flex";
        getDoc(doc(db, "users", order.providerId)).then((agentDoc) => {
            if (agentDoc.exists()) {
                const agent = agentDoc.data();
                const nameEl = document.getElementById("agentName");
                const avatarEl = document.getElementById("agentAvatar");
                const callBtn = document.getElementById("callAgentBtn");
                const serviceTypeEl = document.getElementById("agentServiceType");
                if (nameEl) nameEl.textContent = agent.name || "Agent";
                if (avatarEl) avatarEl.textContent = (agent.name || "A")[0].toUpperCase();
                if (serviceTypeEl) serviceTypeEl.textContent = "Ambulance Specialist";
                if (callBtn && agent.phone) callBtn.href = `tel:${agent.phone}`;
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
    if (order.status === "Pending") { etaDisplay.style.display = "none"; return; }
    etaDisplay.style.display = "flex";
    if (order.status === "Accepted") {
        etaText.textContent = "Agent is preparing to start";
        etaSubtext.textContent = "Will depart shortly";
    } else if (order.status === "On The Way") {
        etaText.textContent = order.eta ? `Arriving in ~${order.eta} mins` : "Ambulance is on the way";
        etaSubtext.textContent = "Estimated time of arrival";
    } else if (order.status === "Reached") {
        etaText.textContent = "Ambulance has arrived! 📍";
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
    if (order.status === "Pending" || order.status === "Accepted") {
        cancelSection.style.display = "block";
    } else {
        cancelSection.style.display = "none";
        if (cancelDialog) cancelDialog.style.display = "none";
    }
}

// ===== CANCEL FLOW =====
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
        if (!selectedReason) { showToast("Please select a reason", "warning"); return; }
        if (!currentOrderId) { showToast("No active order found", "error"); return; }
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
            setTimeout(() => { window.closeTimeline(); window.location = "customer.html"; }, 1000);
        } catch (error) {
            showToast("Error: " + error.message, "error");
            confirmCancelBtn.disabled = false;
            confirmCancelBtn.innerHTML = "Yes, Cancel Order";
        }
    });
}

window.addEventListener("beforeunload", function() {
    if (unsubscribeOrder) unsubscribeOrder();
});

