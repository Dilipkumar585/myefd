import { db, auth } from "../firebase/firebase-config.js";

import {
    doc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

var urlParams = new URLSearchParams(window.location.search);
var orderId = urlParams.get("order") || localStorage.getItem("currentOrderId");
var serviceType = urlParams.get("service") || "Fuel";

console.log("Payment page loaded, orderId:", orderId, "service:", serviceType);

// Pricing model like Rapido/Uber
var PRICING = {
    "Fuel": {
        baseFare: 30,
        perKmRate: 12,
        serviceFee: 30,
        label: "Fuel Delivery"
    },
    "Mechanic": {
        baseFare: 50,
        perKmRate: 15,
        serviceFee: 200,
        label: "Mechanic Service"
    },
    "Ambulance": {
        baseFare: 100,
        perKmRate: 20,
        serviceFee: 500,
        label: "Ambulance Service"
    }
};

// Haversine distance calculator
function calculateDistance(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Calculate fare breakdown
function calculateFare(service, distanceKm) {
    var pricing = PRICING[service] || PRICING["Fuel"];
    var distanceFare = Math.round(distanceKm * pricing.perKmRate);
    var subtotal = pricing.baseFare + distanceFare + pricing.serviceFee;
    var gst = Math.round(subtotal * 0.18);
    var total = subtotal + gst;
    return {
        baseFare: pricing.baseFare,
        distanceKm: Math.round(distanceKm * 100) / 100,
        distanceFare: distanceFare,
        serviceFee: pricing.serviceFee,
        perKmRate: pricing.perKmRate,
        gst: gst,
        total: total
    };
}

// Update the payment UI with fare data
function updatePaymentUI(order, fare, distanceKm) {
    var service = order.service || serviceType;
    var pricing = PRICING[service] || PRICING["Fuel"];
    var serviceLabel = pricing.label;

    // Customize service label for Fuel
    if (service === "Fuel") {
        var litres = parseInt(order.litres) || 5;
        var fuelCost = litres * 100;
        serviceLabel = "Fuel (" + (order.fuel || "Petrol") + " - " + litres + "L)";
        // Add fuel cost to the total
        fare.serviceFee = pricing.serviceFee + fuelCost;
        var subtotal = fare.baseFare + fare.distanceFare + fare.serviceFee;
        fare.gst = Math.round(subtotal * 0.18);
        fare.total = subtotal + fare.gst;
    }

    // Update service name and amount
    var serviceNameEl = document.getElementById("serviceName");
    var amountEl = document.getElementById("amount");
    if (serviceNameEl) serviceNameEl.innerText = serviceLabel;
    if (amountEl) amountEl.innerText = "";

    // Update location info
    var customerLocationEl = document.getElementById("customerLocation");
    if (customerLocationEl && order.location) {
        customerLocationEl.innerText = order.location;
    }

    // Update distance display
    var distanceDisplayEl = document.getElementById("distanceDisplay");
    if (distanceDisplayEl) {
        if (distanceKm !== null && distanceKm !== undefined) {
            distanceDisplayEl.innerText = distanceKm.toFixed(2) + " KM";
        } else if (order.distanceText) {
            distanceDisplayEl.innerText = order.distanceText;
        } else {
            distanceDisplayEl.innerText = "Calculating...";
        }
    }

    // Update fare breakdown
    var baseFareEl = document.getElementById("baseFare");
    var distanceFareEl = document.getElementById("distanceFare");
    var distanceFareLabelEl = document.getElementById("distanceFareLabel");
    var serviceFeeEl = document.getElementById("serviceFee");
    var serviceFeeLabelEl = document.getElementById("serviceFeeLabel");
    var gstEl = document.getElementById("gst");
    var totalEl = document.getElementById("totalAmount");
    var payBtn = document.getElementById("payBtn");

    if (baseFareEl) baseFareEl.innerText = "\u20B9" + fare.baseFare;
    if (distanceFareEl) distanceFareEl.innerText = "\u20B9" + fare.distanceFare;
    if (distanceFareLabelEl) {
        var km = (distanceKm || order.distanceKm || 0).toFixed(1);
        distanceFareLabelEl.innerText = "Distance Charge (" + km + " km \u00D7 \u20B9" + fare.perKmRate + "/km)";
    }
    if (serviceFeeEl) serviceFeeEl.innerText = "\u20B9" + fare.serviceFee;
    if (serviceFeeLabelEl) {
        if (service === "Fuel") {
            var litres = parseInt(order.litres) || 5;
            var fuelCost = litres * 100;
            serviceFeeLabelEl.innerText = "Service Fee + Fuel (\u20B9" + pricing.serviceFee + " + \u20B9" + fuelCost + ")";
        } else {
            serviceFeeLabelEl.innerText = "Service Fee";
        }
    }
    if (gstEl) gstEl.innerText = "\u20B9" + fare.gst;
    if (totalEl) totalEl.innerText = "\u20B9" + fare.total;
    if (payBtn) payBtn.innerHTML = "\uD83D\uDCB0 Pay \u20B9" + fare.total;
}

// Main: Load order and calculate fare
onAuthStateChanged(auth, function(user) {
    if (!user) {
        window.location = "login.html";
        return;
    }
    if (orderId) {
        getDoc(doc(db, "orders", orderId)).then(function(orderDoc) {
            if (orderDoc.exists()) {
                var order = orderDoc.data();
                var service = order.service || serviceType;
                var distanceKm = order.distanceKm || null;

                console.log("Order loaded:", order);

// If we already have calculated data from agent completion, use it
                if (order.calculatedTotal) {
                    var fare = {
                        baseFare: order.baseFare || 0,
                        distanceKm: order.distanceKm || 0,
                        distanceFare: order.distanceFare || 0,
                        serviceFee: order.serviceFee || 0,
                        perKmRate: 0,
                        gst: order.fareGst || 0,
                        total: order.calculatedTotal || 0
                    };
                    // Find the perKmRate for display
                    var pricing = PRICING[service] || PRICING["Fuel"];
                    fare.perKmRate = pricing.perKmRate;
                    updatePaymentUI(order, fare, distanceKm);
                    // Load agent UPI and generate QR
                    loadAgentUPI(order);
                    return;
                }

                // If distance is known from tracking, calculate fare
                if (distanceKm !== null && distanceKm > 0) {
                    var fare = calculateFare(service, distanceKm);
                    updatePaymentUI(order, fare, distanceKm);
                    // Load agent UPI and generate QR
                    loadAgentUPI(order);
                    return;
                }

                // Try to fetch agent's location and calculate distance manually
                if (order.providerId && order.latitude && order.longitude) {
                    getDoc(doc(db, "users", order.providerId)).then(function(agentDoc) {
                        if (agentDoc.exists()) {
                            var agent = agentDoc.data();
                            if (agent.latitude && agent.longitude) {
                                distanceKm = calculateDistance(
                                    order.latitude, order.longitude,
                                    agent.latitude, agent.longitude
                                );
var fare = calculateFare(service, distanceKm);
                                updatePaymentUI(order, fare, distanceKm);

                                // Store for future use
                                updateDoc(doc(db, "orders", orderId), {
                                    distanceKm: Math.round(distanceKm * 100) / 100,
                                    distanceText: distanceKm.toFixed(2) + ' KM'
                                }).catch(function(err) {
                                    console.log("Error storing distance:", err);
                                });
                                // Load agent UPI for QR
                                loadAgentUPI(order);
                                return;
                            }
                        }
                        // Fallback: use flat rates
                        fallbackFlatRate(order, service);
                    }).catch(function(err) {
                        console.log("Error loading agent:", err);
                        fallbackFlatRate(order, service);
                    });
                } else {
                    // No agent assigned yet or missing coordinates — fallback
                    fallbackFlatRate(order, service);
                }
            }
        }).catch(function(error) {
            console.log("Error loading order:", error);
        });
    }
});

// ===== UPI QR CODE GENERATION =====
function generateUPIQR(upiId, upiName, amount) {
    var qrContainer = document.getElementById("qrcode");
    if (!qrContainer) return;

    // Clear previous QR
    qrContainer.innerHTML = "";

    if (!upiId) {
        qrContainer.innerHTML = '<p style="color:#999;padding:20px;">Agent UPI not configured</p>';
        return;
    }

    // Build UPI deep link URL for QR
    // Format: upi://pay?pa=UPI_ID&pn=NAME&am=AMOUNT&cu=INR
    var amountClean = amount ? amount.toString().replace(/[^0-9]/g, "") : "";
    var upiUrl = "upi://pay?pa=" + encodeURIComponent(upiId) +
                 "&pn=" + encodeURIComponent(upiName || "EFD Agent") +
                 (amountClean ? "&am=" + amountClean : "") +
                 "&cu=INR";

    try {
        new QRCode(qrContainer, {
            text: upiUrl,
            width: 180,
            height: 180,
            colorDark: "#0D47A1",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
        console.log("QR Code generated:", upiUrl);
    } catch (e) {
        console.log("QR generation error:", e);
        qrContainer.innerHTML = '<p style="color:#999;padding:20px;">Could not generate QR</p>';
    }
}

// Load agent UPI details and generate QR
function loadAgentUPI(order) {
    if (!order.providerId) {
        console.log("No provider assigned yet");
        return;
    }

    getDoc(doc(db, "users", order.providerId)).then(function(agentDoc) {
        if (agentDoc.exists()) {
            var agent = agentDoc.data();
            var upiId = agent.upiId || "";
            var upiName = agent.upiName || agent.name || "EFD Agent";

            var upiIdEl = document.getElementById("agentUpiId");
            if (upiIdEl) {
                upiIdEl.innerText = upiId || "Not configured";
                if (!upiId) {
                    upiIdEl.style.color = "#FF9800";
                } else {
                    upiIdEl.style.color = "#333";
                }
            }

            // Get total amount for QR
            var totalEl = document.getElementById("totalAmount");
            var total = totalEl ? totalEl.innerText : "";

            // Show QR section and generate QR code
            var qrSection = document.getElementById("upiQrSection");
            if (qrSection && upiId) {
                qrSection.style.display = "block";
                generateUPIQR(upiId, upiName, total);
            } else if (qrSection) {
                qrSection.style.display = "none";
            }
        }
    }).catch(function(err) {
        console.log("Error loading agent UPI:", err);
    });
}

// Listen to payment method changes to show/hide QR
document.querySelectorAll('input[name="pay"]').forEach(function(radio) {
    radio.addEventListener("change", function() {
        var qrSection = document.getElementById("upiQrSection");
        if (qrSection) {
            if (this.value === "UPI") {
                qrSection.style.display = "block";
                // Re-generate QR with updated amount
                var totalEl = document.getElementById("totalAmount");
                var total = totalEl ? totalEl.innerText : "";
                var upiIdEl = document.getElementById("agentUpiId");
                if (upiIdEl && upiIdEl.innerText && upiIdEl.innerText !== "Loading..." && upiIdEl.innerText !== "Not configured") {
                    var orderSnapPromise = orderId ? getDoc(doc(db, "orders", orderId)) : null;
                    if (orderSnapPromise) {
                        orderSnapPromise.then(function(snap) {
                            if (snap.exists()) {
                                var order = snap.data();
                                if (order.providerId) {
                                    getDoc(doc(db, "users", order.providerId)).then(function(agentDoc) {
                                        if (agentDoc.exists()) {
                                            var agent = agentDoc.data();
                                            generateUPIQR(agent.upiId, agent.upiName || agent.name, total);
                                        }
                                    });
                                }
                            }
                        });
                    }
                }
            } else {
                qrSection.style.display = "none";
            }
        }
    });
});

// ===== UPDATE QR WHEN TOTAL CHANGES =====
var originalUpdateFn = window.updatePaymentUI;
window.updatePaymentUI = function(order, fare, distanceKm) {
    // Call original logic by re-applying
    if (typeof originalUpdateFn === "function") {
        // We can't easily intercept, so we'll observe the total element
    }
};

// MutationObserver to detect when total amount changes and update QR
var totalObserver = new MutationObserver(function() {
    var qrSection = document.getElementById("upiQrSection");
    var selectedUpi = document.querySelector('input[name="pay"]:checked');
    if (qrSection && selectedUpi && selectedUpi.value === "UPI" && qrSection.style.display !== "none") {
        var upiIdEl = document.getElementById("agentUpiId");
        if (upiIdEl && upiIdEl.innerText && upiIdEl.innerText !== "Loading..." && upiIdEl.innerText !== "Not configured") {
            var totalEl = document.getElementById("totalAmount");
            var total = totalEl ? totalEl.innerText : "";
            // Find UPI ID and regenerate
            var orderSnapPromise = orderId ? getDoc(doc(db, "orders", orderId)) : null;
            if (orderSnapPromise) {
                orderSnapPromise.then(function(snap) {
                    if (snap.exists()) {
                        var order = snap.data();
                        if (order.providerId) {
                            getDoc(doc(db, "users", order.providerId)).then(function(agentDoc) {
                                if (agentDoc.exists()) {
                                    var agent = agentDoc.data();
                                    generateUPIQR(agent.upiId, agent.upiName || agent.name, total);
                                }
                            });
                        }
                    }
                }).catch(function() {});
            }
        }
    }
});

var totalEl = document.getElementById("totalAmount");
if (totalEl) {
    totalObserver.observe(totalEl, { childList: true, subtree: true, characterData: true });
}

// Fallback: Use flat rate pricing if distance can't be calculated
function fallbackFlatRate(order, service) {
    var pricing = PRICING[service] || PRICING["Fuel"];
    var amount, serviceLabel;

    if (service === "Fuel") {
        var litres = parseInt(order.litres) || 5;
        amount = litres * 100 + 50 + 30; // fuel cost + delivery + base
        serviceLabel = "Fuel (" + (order.fuel || "Petrol") + " - " + litres + "L)";
    } else if (service === "Mechanic") {
        amount = 350;
        serviceLabel = "Mechanic Service";
    } else if (service === "Ambulance") {
        amount = 1000;
        serviceLabel = "Ambulance Service";
    } else {
        amount = 500;
        serviceLabel = "Service Charge";
    }

    var gst = Math.round(amount * 0.18);
    var total = amount + gst;

    var serviceNameEl = document.getElementById("serviceName");
    var amountEl = document.getElementById("amount");
    var gstEl = document.getElementById("gst");
    var totalEl = document.getElementById("totalAmount");
    var payBtn = document.getElementById("payBtn");
    var distanceDisplayEl = document.getElementById("distanceDisplay");
    var baseFareEl = document.getElementById("baseFare");
    var distanceFareEl = document.getElementById("distanceFare");

    if (serviceNameEl) serviceNameEl.innerText = serviceLabel;
    if (amountEl) amountEl.innerText = "";
    if (gstEl) gstEl.innerText = "\u20B9" + gst;
    if (totalEl) totalEl.innerText = "\u20B9" + total;
    if (payBtn) payBtn.innerHTML = "\uD83D\uDCB0 Pay \u20B9" + total;
    if (distanceDisplayEl) distanceDisplayEl.innerText = "Not available";
    if (baseFareEl) baseFareEl.innerText = "\u20B9" + amount;
    if (distanceFareEl) distanceFareEl.innerText = "\u20B90";
}

// ===== PAYMENT BUTTON =====
var payBtn = document.getElementById("payBtn");
if (payBtn) {
    payBtn.addEventListener("click", async function() {
        if (!auth.currentUser) {
            if (typeof showToast === "function") {
                showToast("Please login first", "error");
            } else {
                alert("Please login first");
            }
            return;
        }

        var paymentMethod = document.querySelector('input[name="pay"]:checked');
        var method = paymentMethod ? paymentMethod.value : "Unknown";
        var totalEl = document.getElementById("totalAmount");
        var amount = totalEl ? totalEl.innerText : "\u20B9500";

        if (!orderId) {
            if (typeof showToast === "function") {
                showToast("No order found for payment", "error");
            } else {
                alert("No order found for payment");
            }
            window.location = "customer.html";
            return;
        }

        try {
            payBtn.disabled = true;
            payBtn.innerHTML = '<span class="loading-spinner"></span> Processing...';
            payBtn.classList.add("loading");

            // Get the fare breakdown for storing
            var orderSnap = await getDoc(doc(db, "orders", orderId));
            var orderData = orderSnap.exists() ? orderSnap.data() : {};

            await updateDoc(doc(db, "orders", orderId), {
                paymentMethod: method,
                paymentStatus: "Paid",
                paymentAmount: amount,
                paidAt: new Date().toISOString(),
                baseFare: orderData.baseFare || (document.getElementById("baseFare") ? document.getElementById("baseFare").innerText : ""),
                distanceFare: orderData.distanceFare || (document.getElementById("distanceFare") ? document.getElementById("distanceFare").innerText : ""),
                serviceFee: orderData.serviceFee || (document.getElementById("serviceFee") ? document.getElementById("serviceFee").innerText : ""),
                fareGst: orderData.fareGst || (document.getElementById("gst") ? document.getElementById("gst").innerText : ""),
                calculatedTotal: orderData.calculatedTotal || parseInt((document.getElementById("totalAmount") ? document.getElementById("totalAmount").innerText : "0").replace(/[^0-9]/g, "")) || 0
            });

            if (typeof showToast === "function") {
                showToast("Payment Successful! \uD83C\uDF89", "success");
            } else {
                alert("Payment Successful!");
            }

            setTimeout(function() {
                window.location = "customer.html";
            }, 1500);
        } catch (error) {
            console.log("Payment error:", error);
            if (typeof showToast === "function") {
                showToast("Payment failed: " + error.message, "error");
            } else {
                alert("Payment failed: " + error.message);
            }
            payBtn.disabled = false;
            payBtn.innerHTML = "\uD83D\uDCB0 Pay Now";
            payBtn.classList.remove("loading");
        }
    });
}

// Cleanup on page unload
window.addEventListener("beforeunload", function() {
    console.log("Payment page unloading...");
});

console.log("Payment.js loaded with distance-based pricing model");


