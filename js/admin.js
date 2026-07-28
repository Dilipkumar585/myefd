import { db } from "../firebase/firebase-config.js";

import {
    collection,
    query,
    where,
    onSnapshot,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

var totalUsersEl = document.getElementById("totalUsers");
var totalAgentsEl = document.getElementById("totalAgents");
var totalOrdersEl = document.getElementById("totalOrders");
var pendingOrdersEl = document.getElementById("pendingOrders");
var completedOrdersEl = document.getElementById("completedOrders");
var totalRevenueEl = document.getElementById("totalRevenue");
var usersTable = document.getElementById("usersTable");
var ordersTable = document.getElementById("ordersTable");

// Users listener
if (totalUsersEl) {
    onSnapshot(collection(db, "users"), function(snapshot) {
        var agents = 0;
        if (usersTable) usersTable.innerHTML = "";
        snapshot.forEach(function(userDoc) {
            var user = userDoc.data();
            if (user.role === "Fuel Agent" || user.role === "Mechanic Agent" || user.role === "Ambulance Agent") {
                agents++;
            }
            if (usersTable) {
                var roleBadge = user.role || "N/A";
                var roleColor = "#888";
                if (roleBadge === "Admin") roleColor = "#f44336";
                else if (roleBadge === "Customer") roleColor = "#4CAF50";
                else if (roleBadge.includes("Agent")) roleColor = "#FF9800";

                usersTable.innerHTML += "<tr><td>" + (user.name || "N/A") + "</td><td>" + (user.email || "N/A") + "</td><td>" + (user.phone || "N/A") + "</td><td><span style='background:" + roleColor + ";color:white;padding:4px 12px;border-radius:20px;font-size:12px;'>" + roleBadge + "</span></td></tr>";
            }
        });
        totalUsersEl.innerHTML = snapshot.size;
        totalAgentsEl.innerHTML = agents;
    });
}

// Orders listener
if (totalOrdersEl) {
    onSnapshot(collection(db, "orders"), function(snapshot) {
        var pending = 0;
        var completed = 0;
        var totalRevenue = 0;
        if (ordersTable) ordersTable.innerHTML = "";
        snapshot.forEach(function(orderDoc) {
            var order = orderDoc.data();
            if (order.status === "Pending" || order.status === "Accepted" || order.status === "On The Way" || order.status === "Reached") {
                pending++;
            } else if (order.status === "Completed") {
                completed++;
                // Calculate revenue from completed orders
                if (order.paymentAmount) {
                    var amt = parseInt(order.paymentAmount.replace(/[^0-9]/g, "")) || 0;
                    totalRevenue += amt;
                }
            }
            if (ordersTable) {
                var statusColor = "#FF9800";
                if (order.status === "Completed") statusColor = "#4CAF50";
                else if (order.status === "Accepted") statusColor = "#2196F3";
                else if (order.status === "On The Way") statusColor = "#FF9800";
                else if (order.status === "Reached") statusColor = "#9C27B0";
                else if (order.status === "Rejected" || order.status === "Cancelled") statusColor = "#f44336";

                ordersTable.innerHTML += "<tr><td>" + (order.customerEmail || "N/A") + "</td><td>" + (order.service || "N/A") + "</td><td><span style='background:" + statusColor + ";color:white;padding:4px 12px;border-radius:20px;font-size:12px;'>" + (order.status || "N/A") + "</span></td><td>" + (order.location || "N/A") + "</td><td><button onclick='viewOrder(\"" + orderDoc.id + "\")'>View</button></td></tr>";
            }
        });
        totalOrdersEl.innerHTML = snapshot.size;
        if (pendingOrdersEl) pendingOrdersEl.innerHTML = pending;
        if (completedOrdersEl) completedOrdersEl.innerHTML = completed;
        if (totalRevenueEl) totalRevenueEl.innerHTML = "\u20B9" + totalRevenue;
    });
}

// Cleanup on page unload
window.addEventListener("beforeunload", function() {
    // Firestore listeners auto-detach when page unloads
});

window.viewOrder = function(id) {
    alert("Order ID: " + id + "\nCheck Firestore console for full details.");
};

