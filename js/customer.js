// =============================================
// EFD Customer Dashboard - Premium v2.0
// With Live Booking Card, Quick Book, Stats, Recent
// =============================================

import { auth, db } from "../firebase/firebase-config.js";

import {
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import {
    collection,
    query,
    where,
    onSnapshot,
    doc,
    getDoc,
    updateDoc,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ===== LOGOUT =====
const logout = document.getElementById("logout");
if (logout) {
    logout.addEventListener("click", async (e) => {
        e.preventDefault();
        await signOut(auth);
        showToast("Logged out successfully", "info");
        window.location = "login.html";
    });
}

// ===== AUTH STATE =====
let currentUser = null;
let unsubscribeActiveOrder = null;
let unsubscribeStats = null;
let unsubscribeRecent = null;
let currentOrderId = null;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        
        // Load user name
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const userNameEl = document.getElementById("userName");
                if (userNameEl) {
                    userNameEl.innerText = userData.name || "User";
                }
                
                // Store last used location for quick book
                if (userData.lastLocation) {
                    localStorage.setItem("lastLocation", userData.lastLocation);
                }
            }
        } catch (error) {
            console.log("Error loading user name:", error);
        }

        // Load all dashboard data
        loadActiveOrder(user.uid);
        loadStats(user.uid);
        loadRecentOrders(user.uid);
        loadRepeatLastOrder(user.uid);
    }
});

// ===== ACTIVE ORDER CARD =====
function loadActiveOrder(uid) {
    const container = document.getElementById("currentBookingContainer");
    if (!container) return;

    // Clean up previous listener
    if (unsubscribeActiveOrder) unsubscribeActiveOrder();

    const q = query(
        collection(db, "orders"),
        where("customerId", "==", uid),
        where("status", "in", ["Pending", "Accepted", "On The Way", "Reached"]),
        orderBy("createdAt", "desc"),
        limit(1)
    );

    unsubscribeActiveOrder = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            // Show empty state
            container.innerHTML = `
                <div class="no-booking-card card-stagger">
                    <i class="fa-solid fa-calendar-circle-plus"></i>
                    <h3>No Active Booking</h3>
                    <p>Book a service to see real-time tracking here</p>
                </div>
            `;
            return;
        }

        const orderDoc = snapshot.docs[0];
        const order = orderDoc.data();
        currentOrderId = orderDoc.id;
        localStorage.setItem("currentOrderId", currentOrderId);

        const statusEmojis = {
            "Pending": "⏳",
            "Accepted": "✅",
            "On The Way": "🚗",
            "Reached": "📍"
        };

        const statusColors = {
            "Pending": "#FF9800",
            "Accepted": "#4CAF50",
            "On The Way": "#2196F3",
            "Reached": "#9C27B0"
        };

        const serviceIcons = {
            "Fuel": "fa-solid fa-gas-pump",
            "Mechanic": "fa-solid fa-screwdriver-wrench",
            "Ambulance": "fa-solid fa-truck-medical"
        };

        const cancelAllowed = order.status === "Pending" || order.status === "Accepted";

        container.innerHTML = `
            <div class="current-booking-card">
                <div class="card-label">
                    <span class="live-dot"></span> LIVE ORDER
                </div>
                <h2>
                    <i class="${serviceIcons[order.service] || 'fa-solid fa-box'}"></i> 
                    ${order.service} Service
                </h2>
                <div class="status-line">
                    <span class="status-badge" style="background:${statusColors[order.status] || '#FF9800'}">
                        ${order.status} ${statusEmojis[order.status] || ''}
                    </span>
                </div>
                <div class="booking-meta">
                    <div class="meta-item">
                        <i class="fa-solid fa-location-dot"></i>
                        <span>${order.location || 'Location not set'}</span>
                    </div>
                    <div class="meta-item">
                        <i class="fa-solid fa-clock"></i>
                        <span>${new Date(order.createdAt).toLocaleString()}</span>
                    </div>
                    ${order.phone ? `
                    <div class="meta-item">
                        <i class="fa-solid fa-phone"></i>
                        <span>${order.phone}</span>
                    </div>` : ''}
                </div>
                <div class="booking-actions">
                    <a href="tracking.html?order=${currentOrderId}" class="btn-track">
                        <i class="fa-solid fa-location-dot"></i> Track Live
                    </a>
                    ${cancelAllowed ? `
                    <button class="btn-cancel" onclick="window.cancelActiveOrder('${currentOrderId}')">
                        <i class="fa-solid fa-ban"></i> Cancel
                    </button>` : ''}
                    ${order.status === "Reached" ? `
                    <a href="payment.html?order=${currentOrderId}&service=${order.service}" class="btn-track" style="background:#FF9800;color:white;">
                        <i class="fa-solid fa-credit-card"></i> Pay Now
                    </a>` : ''}
                    ${order.status === "Completed" ? `
                    <a href="rating.html?order=${currentOrderId}" class="btn-track" style="background:#6A1B9A;color:white;">
                        <i class="fa-solid fa-star"></i> Rate
                    </a>` : ''}
                </div>
            </div>
        `;
    });
}

// ===== CANCEL ACTIVE ORDER (from dashboard) =====
window.cancelActiveOrder = async function(orderId) {
    if (!orderId) {
        showToast("No active order found", "error");
        return;
    }

    // Simple confirmation - in production use a proper dialog
    const reason = prompt("Why do you want to cancel? (Optional)");
    
    try {
        await updateDoc(doc(db, "orders", orderId), {
            status: "Cancelled",
            cancelledAt: new Date().toISOString(),
            cancelReason: reason || "Cancelled by customer",
            cancelledBy: "Customer"
        });
        showToast("Order cancelled successfully", "info");
    } catch (error) {
        showToast("Error cancelling: " + error.message, "error");
    }
};

// ===== STATS =====
function loadStats(uid) {
    if (unsubscribeStats) unsubscribeStats();

    const q = query(
        collection(db, "orders"),
        where("customerId", "==", uid)
    );

    unsubscribeStats = onSnapshot(q, (snapshot) => {
        let total = 0;
        let pending = 0;
        let completed = 0;

        snapshot.forEach((doc) => {
            total++;
            const order = doc.data();
            if (["Pending", "Accepted", "On The Way", "Reached"].includes(order.status)) {
                pending++;
            }
            if (order.status === "Completed") {
                completed++;
            }
        });

        animateNumber("totalOrders", total);
        animateNumber("pendingOrders", pending);
        animateNumber("completedOrders", completed);
    });
}

function animateNumber(elementId, target) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    const current = parseInt(el.innerText) || 0;
    if (current === target) return;

    // Animate with count-up effect
    const diff = target - current;
    const steps = Math.min(Math.abs(diff), 20);
    const increment = diff / steps;
    let step = 0;

    el.classList.add("animate-count");
    
    const timer = setInterval(() => {
        step++;
        if (step >= steps) {
            el.innerText = target;
            clearInterval(timer);
            return;
        }
        const newVal = Math.round(current + (increment * step));
        el.innerText = newVal;
    }, 30);
}

// ===== RECENT ORDERS =====
function loadRecentOrders(uid) {
    const container = document.getElementById("recentOrders");
    if (!container) return;

    if (unsubscribeRecent) unsubscribeRecent();

    const q = query(
        collection(db, "orders"),
        where("customerId", "==", uid),
        orderBy("createdAt", "desc"),
        limit(5)
    );

    unsubscribeRecent = onSnapshot(q, (snapshot) => {
        container.innerHTML = "";
        
        if (snapshot.empty) {
            container.innerHTML = `
                <div style="text-align:center;padding:20px;color:#999;">
                    <p>No orders yet</p>
                    <p style="font-size:12px;margin-top:4px;">Book a service to get started</p>
                </div>
            `;
            return;
        }

        const serviceIcons = {
            "Fuel": "fuel",
            "Mechanic": "mechanic",
            "Ambulance": "ambulance"
        };

        const statusColors = {
            "Pending": "#FF9800",
            "Accepted": "#2196F3",
            "On The Way": "#FF9800",
            "Reached": "#9C27B0",
            "Completed": "#4CAF50",
            "Cancelled": "#f44336",
            "Rejected": "#f44336"
        };

        snapshot.forEach((orderDoc) => {
            const order = orderDoc.data();
            const iconClass = serviceIcons[order.service] || "fuel";
            const statusColor = statusColors[order.status] || "#999";

            container.innerHTML += `
                <div class="recent-item">
                    <div class="ri-icon ${iconClass}">
                        <i class="${order.service === 'Fuel' ? 'fa-solid fa-gas-pump' : order.service === 'Mechanic' ? 'fa-solid fa-screwdriver-wrench' : 'fa-solid fa-truck-medical'}"></i>
                    </div>
                    <div class="ri-content">
                        <h4>${order.service} Service</h4>
                        <p>${order.location || 'N/A'} • ${order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ''}</p>
                    </div>
                    <span class="ri-status" style="background:${statusColor};color:white;">
                        ${order.status}
                    </span>
                </div>
            `;
        });
    });
}

// ===== REPEAT LAST ORDER =====
function loadRepeatLastOrder(uid) {
    const container = document.getElementById("repeatLastOrder");
    const lastServiceEl = document.getElementById("lastOrderService");
    if (!container || !lastServiceEl) return;

    const q = query(
        collection(db, "orders"),
        where("customerId", "==", uid),
        orderBy("createdAt", "desc"),
        limit(1)
    );

    onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const order = snapshot.docs[0].data();
            if (order.service) {
                container.style.display = "flex";
                lastServiceEl.textContent = `Rebook ${order.service}`;
                
                const serviceRoutes = {
                    "Fuel": "fuel-booking.html",
                    "Mechanic": "mechanic-booking.html",
                    "Ambulance": "ambulance-booking.html"
                };

                container.onclick = () => {
                    window.location = serviceRoutes[order.service] || "fuel-booking.html";
                };
            }
        }
    });
}

// ===== CLEANUP =====
window.addEventListener("beforeunload", () => {
    if (unsubscribeActiveOrder) unsubscribeActiveOrder();
    if (unsubscribeStats) unsubscribeStats();
    if (unsubscribeRecent) unsubscribeRecent();
});

