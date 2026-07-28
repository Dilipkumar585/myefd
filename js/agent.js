import { db, auth } from "../firebase/firebase-config.js";

import {
    collection,
    query,
    where,
    onSnapshot,
    updateDoc,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import {
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// Logout
const logout = document.getElementById("logout");
if (logout) {
    logout.addEventListener("click", async (e) => {
        e.preventDefault();
        await signOut(auth);
        if (typeof showToast === "function") showToast("Logged out successfully", "info");
        window.location = "login.html";
    });
}

// Agent Service
const agentService = localStorage.getItem("agentService");
const ordersContainer = document.getElementById("orders");
const activeOrdersContainer = document.getElementById("activeOrders");

// ===== PENDING ORDERS LISTENER =====
if (agentService) {
    const q = query(
        collection(db, "orders"),
        where("service", "==", agentService),
        where("status", "==", "Pending")
    );

    onSnapshot(q, (snapshot) => {
        ordersContainer.innerHTML = "";
        if (snapshot.empty) {
            ordersContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-inbox" style="font-size:48px;color:#ccc;margin-bottom:15px;"></i>
                    <h3>No Pending Orders</h3>
                    <p style="color:#999;">New orders will appear here</p>
                </div>
            `;
            return;
        }
        snapshot.forEach((orderDoc) => {
            const order = orderDoc.data();
            ordersContainer.innerHTML += getOrderCard(order, orderDoc.id, "Pending");
        });
    });
}

// ===== ACTIVE ORDERS LISTENER (Accepted, On The Way, Reached) =====
onAuthStateChanged(auth, function(user) {
    if (!user) return;
    if (!activeOrdersContainer) return;

    const acceptedQ = query(
        collection(db, "orders"),
        where("providerId", "==", user.uid),
        where("status", "in", ["Accepted", "On The Way", "Reached"])
    );

    onSnapshot(acceptedQ, function(snapshot) {
        activeOrdersContainer.innerHTML = "";
        if (snapshot.empty) {
            activeOrdersContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-clock" style="font-size:48px;color:#ccc;margin-bottom:15px;"></i>
                    <h3>No Active Orders</h3>
                    <p style="color:#999;">Accept an order to get started</p>
                </div>
            `;
            return;
        }
        snapshot.forEach(function(orderDoc) {
            const order = orderDoc.data();
            const statusColors = {
                "Accepted": "#2196F3",
                "On The Way": "#FF9800",
                "Reached": "#9C27B0"
            };
            const borderColor = statusColors[order.status] || "#4CAF50";
            activeOrdersContainer.innerHTML += `
                <div class="card active-card" style="border-left:5px solid ${borderColor};">
                    <div class="card-header">
                        <h2>${order.service}</h2>
                        <span class="status-badge" style="background:${borderColor};color:white;padding:4px 14px;border-radius:20px;font-size:13px;">${order.status}</span>
                    </div>
                    <div class="card-body">
                        <p><i class="fa-solid fa-user"></i> <strong>Customer:</strong> ${order.customerEmail || "N/A"}</p>
                        <p><i class="fa-solid fa-phone"></i> <strong>Phone:</strong> ${order.phone || "N/A"}</p>
                        <p><i class="fa-solid fa-location-dot"></i> <strong>Location:</strong> ${order.location || "N/A"}</p>
                        ${order.fuel ? `<p><i class="fa-solid fa-gas-pump"></i> <strong>Fuel:</strong> ${order.fuel}</p>` : ""}
                        ${order.litres ? `<p><strong>Quantity:</strong> ${order.litres}L</p>` : ""}
                        ${order.problem ? `<p><i class="fa-solid fa-wrench"></i> <strong>Problem:</strong> ${order.problem}</p>` : ""}
                        ${order.vehicleType ? `<p><i class="fa-solid fa-car"></i> <strong>Vehicle:</strong> ${order.vehicleType}</p>` : ""}
                        ${order.patientName ? `<p><i class="fa-solid fa-user-injured"></i> <strong>Patient:</strong> ${order.patientName}</p>` : ""}
                        ${order.emergency ? `<p><i class="fa-solid fa-exclamation-triangle"></i> <strong>Emergency:</strong> ${order.emergency}</p>` : ""}
                    </div>
                    <div class="card-actions">
                        ${getActiveButton(order.status, orderDoc.id)}
                    </div>
                </div>
            `;
        });
    });
});

// ===== HELPER: Get Order Card HTML =====
function getOrderCard(order, id, currentStatus) {
    var details = "";
    if (order.fuel) details += `<p><i class="fa-solid fa-gas-pump"></i> <strong>Fuel:</strong> ${order.fuel}</p>`;
    if (order.litres) details += `<p><strong>Quantity:</strong> ${order.litres} Litres</p>`;
    if (order.problem) details += `<p><i class="fa-solid fa-wrench"></i> <strong>Problem:</strong> ${order.problem}</p>`;
    if (order.vehicleType) details += `<p><i class="fa-solid fa-car"></i> <strong>Vehicle:</strong> ${order.vehicleType}</p>`;
    if (order.patientName) details += `<p><i class="fa-solid fa-user-injured"></i> <strong>Patient:</strong> ${order.patientName}</p>`;
    if (order.emergency) details += `<p><i class="fa-solid fa-exclamation-triangle"></i> <strong>Emergency:</strong> ${order.emergency}</p>`;

    return `
        <div class="card">
            <div class="card-header">
                <h2>${order.service}</h2>
                <span class="status-badge" style="background:#FF9800;color:white;padding:4px 14px;border-radius:20px;font-size:13px;">${currentStatus}</span>
            </div>
            <div class="card-body">
                <p><i class="fa-solid fa-user"></i> <strong>Customer:</strong> ${order.customerEmail || "N/A"}</p>
                <p><i class="fa-solid fa-phone"></i> <strong>Phone:</strong> ${order.phone || "N/A"}</p>
                <p><i class="fa-solid fa-location-dot"></i> <strong>Location:</strong> ${order.location || "N/A"}</p>
                ${details}
            </div>
            <div class="card-actions">
                <button onclick="acceptOrder('${id}')" class="btn btn-accept">
                    <i class="fa-solid fa-check"></i> Accept
                </button>
                <button onclick="rejectOrder('${id}')" class="btn btn-reject">
                    <i class="fa-solid fa-times"></i> Reject
                </button>
            </div>
        </div>
    `;
}

// ===== HELPER: Get Active Button =====
function getActiveButton(status, id) {
    var buttons = "";
    if (status === "Accepted") {
        buttons = `<button onclick="startDelivery('${id}')" class="btn btn-primary">
            <i class="fa-solid fa-truck"></i> Start Delivery
        </button>`;
    } else if (status === "On The Way") {
        buttons = `<button onclick="reachedOrder('${id}')" class="btn btn-success">
            <i class="fa-solid fa-location-dot"></i> Mark Reached
        </button>`;
    } else if (status === "Reached") {
        buttons = `<button onclick="completeOrder('${id}')" class="btn btn-complete">
            <i class="fa-solid fa-check-circle"></i> Complete Order
        </button>
        <button onclick="showMap('${id}')" class="btn btn-info">
            <i class="fa-solid fa-map"></i> View Map
        </button>`;
    }
    return buttons;
}

// ===== ACTIONS =====

// ACCEPT ORDER
window.acceptOrder = async function(id) {
    try {
        await updateDoc(doc(db, "orders", id), {
            status: "Accepted",
            providerId: auth.currentUser.uid,
            providerEmail: auth.currentUser.email
        });
        if (typeof showToast === "function") showToast("Order Accepted ✅", "success");
        else alert("Order Accepted");
    } catch (error) {
        console.log("Accept error:", error);
        if (typeof showToast === "function") showToast("Error accepting order", "error");
        else alert("Error: " + error.message);
    }
};

// REJECT ORDER
window.rejectOrder = async function(id) {
    try {
        await updateDoc(doc(db, "orders", id), { status: "Rejected" });
        if (typeof showToast === "function") showToast("Order Rejected", "warning");
        else alert("Order Rejected");
    } catch (error) {
        console.log("Reject error:", error);
        if (typeof showToast === "function") showToast("Error rejecting order", "error");
        else alert("Error: " + error.message);
    }
};

// START DELIVERY
window.startDelivery = async function(id) {
    try {
        await updateDoc(doc(db, "orders", id), {
            status: "On The Way",
            deliveryStartedAt: new Date().toISOString()
        });
        if (typeof showToast === "function") showToast("Delivery Started 🚗", "info");
        else alert("Delivery Started 🚗");
    } catch (error) {
        console.log("Start delivery error:", error);
        if (typeof showToast === "function") showToast("Error starting delivery", "error");
        else alert("Error: " + error.message);
    }
};

// REACHED LOCATION
window.reachedOrder = async function(id) {
    try {
        await updateDoc(doc(db, "orders", id), {
            status: "Reached",
            reachedAt: new Date().toISOString()
        });
        if (typeof showToast === "function") showToast("Reached Location 📍", "success");
        else alert("Reached Location Successfully");
    } catch (error) {
        console.log("Reached error:", error);
        if (typeof showToast === "function") showToast("Error updating status", "error");
        else alert("Error: " + error.message);
    }
};

// Helper: Calculate distance using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Helper: Calculate fare based on service type and distance
function calculateFare(service, distanceKm) {
    var baseFare, perKmRate, serviceFee;
    switch (service) {
        case "Fuel":
            baseFare = 30;
            perKmRate = 12;
            serviceFee = 30;
            break;
        case "Mechanic":
            baseFare = 50;
            perKmRate = 15;
            serviceFee = 200;
            break;
        case "Ambulance":
            baseFare = 100;
            perKmRate = 20;
            serviceFee = 500;
            break;
        default:
            baseFare = 30;
            perKmRate = 10;
            serviceFee = 50;
    }
    var distanceFare = Math.round(distanceKm * perKmRate);
    var subtotal = baseFare + distanceFare + serviceFee;
    var gst = Math.round(subtotal * 0.18);
    var total = subtotal + gst;
    return {
        baseFare: baseFare,
        distanceFare: distanceFare,
        serviceFee: serviceFee,
        gst: gst,
        total: total,
        distanceKm: Math.round(distanceKm * 100) / 100
    };
}

// COMPLETE ORDER
window.completeOrder = async function(id) {
    try {
        // Fetch order data to calculate distance and fare
        var orderSnap = await getDoc(doc(db, "orders", id));
        var updateData = {
            status: "Completed",
            completedAt: new Date().toISOString()
        };

        if (orderSnap.exists()) {
            var orderData = orderSnap.data();
            var customerLat = orderData.latitude;
            var customerLng = orderData.longitude;
            var service = orderData.service;

            // Get agent's current location to calculate distance
            if (auth.currentUser) {
                var agentSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
                if (agentSnap.exists()) {
                    var agentData = agentSnap.data();
                    var agentLat = agentData.latitude;
                    var agentLng = agentData.longitude;

                    if (customerLat && customerLng && agentLat && agentLng) {
                        var distanceKm = calculateDistance(customerLat, customerLng, agentLat, agentLng);
                        var fare = calculateFare(service, distanceKm);

                        updateData.distanceKm = fare.distanceKm;
                        updateData.distanceText = fare.distanceKm + ' KM';
                        updateData.baseFare = fare.baseFare;
                        updateData.distanceFare = fare.distanceFare;
                        updateData.serviceFee = fare.serviceFee;
                        updateData.fareGst = fare.gst;
                        updateData.calculatedFare = '₹' + fare.total;
                        updateData.calculatedTotal = fare.total;
                    }
                }
            }

            // If distance wasn't calculated above but stored earlier from tracking, use that
            if (!updateData.distanceKm && orderData.distanceKm) {
                var fare = calculateFare(service, orderData.distanceKm);
                updateData.distanceKm = orderData.distanceKm;
                updateData.baseFare = fare.baseFare;
                updateData.distanceFare = fare.distanceFare;
                updateData.serviceFee = fare.serviceFee;
                updateData.fareGst = fare.gst;
                updateData.calculatedFare = '₹' + fare.total;
                updateData.calculatedTotal = fare.total;
            }
        }

        await updateDoc(doc(db, "orders", id), updateData);
        if (typeof showToast === "function") showToast("Order Completed Successfully! 🎉", "success");
        else alert("Order Completed Successfully!");
    } catch (error) {
        console.log("Complete order error:", error);
        if (typeof showToast === "function") showToast("Error completing order: " + error.message, "error");
        else alert("Error completing order: " + error.message);
    }
};

// SHOW MAP
window.showMap = function(id) {
    window.open("tracking.html?order=" + id, "_blank");
};
