import { db, auth } from "../firebase/firebase-config.js";

import {
    collection,
    query,
    where,
    onSnapshot,
    orderBy
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

var ordersContainer = document.getElementById("orders");
var searchInput = document.getElementById("search");
var allOrders = [];

onAuthStateChanged(auth, function(user) {
    if (!user) {
        window.location = "login.html";
        return;
    }

    var q = query(
        collection(db, "orders"),
        where("customerId", "==", user.uid)
    );

    onSnapshot(q, function(snapshot) {
        allOrders = [];
        ordersContainer.innerHTML = "";
        if (snapshot.empty) {
            ordersContainer.innerHTML = "<h3>No orders found</h3>";
            return;
        }
        snapshot.forEach(function(orderDoc) {
            var order = orderDoc.data();
            order._id = orderDoc.id;
            allOrders.push(order);
            renderOrder(order);
        });
    });
});

function renderOrder(order) {
    var statusClass = "pending";
    if (order.status === "Completed") statusClass = "completed";
    else if (order.status === "Rejected" || order.status === "Cancelled") statusClass = "cancelled";

    ordersContainer.innerHTML += `
        <div class="order ${statusClass}">
            <h2>${order.service || "Service"}</h2>
            <p>${order.fuel ? order.fuel + " - " + order.litres + " Litres" : ""}</p>
            <p>${order.problem ? order.problem : ""}</p>
            <p>${order.patientName ? "Patient: " + order.patientName : ""}</p>
            <p>${order.location || "N/A"}</p>
            <span>${order.status}</span>
            ${order.status === "Pending" || order.status === "Accepted" || order.status === "On The Way" || order.status === "Reached"
                ? '<button onclick="window.location=\'tracking.html\'">Track</button>'
                : '<button onclick="window.location=\'tracking.html\'">View</button>'
            }
        </div>
    `;
}

// Search functionality
if (searchInput) {
    searchInput.addEventListener("keyup", function() {
        var value = this.value.toLowerCase();
        var cards = document.querySelectorAll(".order");
        cards.forEach(function(card) {
            var text = card.innerText.toLowerCase();
            if (text.includes(value)) {
                card.style.display = "block";
            } else {
                card.style.display = "none";
            }
        });
    });
}

// Cleanup on page unload
window.addEventListener("beforeunload", function() {
    // Firestore listeners auto-detach on page unload
});
