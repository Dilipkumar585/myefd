import { db, auth } from "../firebase/firebase-config.js";

import {
    collection,
    query,
    where,
    onSnapshot,
    doc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const trackingDetails = document.getElementById("trackingDetails");

let map;
let customerMarker;
let agentMarker;
let customerLocation = null;
let directionsService;
let directionsRenderer;
let currentOrderId = null;

console.log("Tracking JS Loaded");

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(2);
}

function calculateAndDisplayRoute(start, end) {
    if (!directionsService || !directionsRenderer) {
        console.log("Directions service not ready");
        return;
    }
    directionsService.route(
        {
            origin: start,
            destination: end,
            travelMode: google.maps.TravelMode.DRIVING
        },
        (response, status) => {
            let distanceKm = null;
            let durationText = "Calculating...";
            let distanceText = "Calculating...";

            if (status === "OK") {
                directionsRenderer.setDirections(response);
                const route = response.routes[0];
                if (route && route.legs && route.legs[0]) {
                    const leg = route.legs[0];
                    durationText = leg.duration ? leg.duration.text : "Calculating...";
                    distanceText = leg.distance ? leg.distance.text : "Calculating...";
                    distanceKm = leg.distance ? leg.distance.value / 1000 : null;
                    const distanceElement = document.getElementById("distance");
                    if (distanceElement) {
                        distanceElement.innerHTML = 'Distance: <b>' + distanceText + '</b> | ETA: <b>' + durationText + '</b>';
                    }
                }
            } else {
                console.log("Directions request failed:", status);
                distanceKm = parseFloat(calculateDistance(start.lat, start.lng, end.lat, end.lng));
                distanceText = distanceKm.toFixed(2) + ' KM';
                const etaHours = distanceKm / 30;
                const etaMinutes = Math.round(etaHours * 60);
                durationText = '~' + etaMinutes + ' mins';
                const distanceElement = document.getElementById("distance");
                if (distanceElement) {
                    distanceElement.innerHTML = 'Distance: <b>' + distanceText + '</b> | ETA: <b>' + durationText + '</b>';
                }
            }

            // Store distance data to order document for payment calculation
            if (currentOrderId && distanceKm !== null) {
                updateDoc(doc(db, "orders", currentOrderId), {
                    distanceKm: Math.round(distanceKm * 100) / 100,
                    distanceText: distanceText,
                    durationText: durationText
                }).catch(function(err) {
                    console.log("Error storing distance:", err);
                });
            }
        }
    );
}

function smoothMoveMarker(marker, newPosition) {
    const startPosition = marker.getPosition();
    const startLat = startPosition.lat();
    const startLng = startPosition.lng();
    const endLat = newPosition.lat;
    const endLng = newPosition.lng;
    const steps = 30;
    let step = 0;
    const interval = setInterval(function() {
        step++;
        if (step > steps) {
            clearInterval(interval);
            marker.setPosition(newPosition);
            return;
        }
        var lat = startLat + (endLat - startLat) * (step / steps);
        var lng = startLng + (endLng - startLng) * (step / steps);
        marker.setPosition({ lat: lat, lng: lng });
    }, 50);
}

window.initMap = function () {
    console.log("Google Map Started");
    var defaultCenter = { lat: 13.6288, lng: 79.4192 };
    map = new google.maps.Map(
        document.getElementById("map"),
        {
            zoom: 15,
            center: defaultCenter,
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            fullscreenControl: true,
            streetViewControl: false
        }
    );
    console.log("Map Created");
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true,
        polylineOptions: {
            strokeColor: "#1565C0",
            strokeWeight: 5,
            strokeOpacity: 0.8
        }
    });
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                customerLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                console.log("Customer Location:", customerLocation);
                customerMarker = new google.maps.Marker({
                    position: customerLocation,
                    map: map,
                    title: "My Location",
                    icon: {
                        url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                        scaledSize: new google.maps.Size(40, 40)
                    },
                    animation: google.maps.Animation.DROP
                });
                map.setCenter(customerLocation);
                startTracking();
            },
            function(error) {
                console.log("Geolocation Error:", error.message);
                customerLocation = defaultCenter;
                customerMarker = new google.maps.Marker({
                    position: customerLocation,
                    map: map,
                    title: "Customer (approx)",
                    icon: {
                        url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                        scaledSize: new google.maps.Size(40, 40)
                    }
                });
                startTracking();
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    } else {
        customerLocation = defaultCenter;
        customerMarker = new google.maps.Marker({
            position: customerLocation,
            map: map,
            title: "Customer (approx)",
            icon: {
                url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                scaledSize: new google.maps.Size(40, 40)
            }
        });
        startTracking();
    }
};

function startTracking() {
    onAuthStateChanged(auth, function(user) {
        if (!user) {
            window.location = "login.html";
            return;
        }
        var q = query(
            collection(db, "orders"),
            where("customerId", "==", user.uid),
            where("status", "in", ["Accepted", "On The Way", "Reached", "Completed"])
        );
        onSnapshot(q, function(snapshot) {
            console.log("Orders snapshot received, size:", snapshot.size);
            trackingDetails.innerHTML = "";
            if (snapshot.empty) {
                trackingDetails.innerHTML = '<div class="card"><h3>No Active Booking Found</h3><p>You don\'t have any accepted orders right now.</p><a href="customer.html" style="display:inline-block;margin-top:15px;padding:10px 20px;background:#1565C0;color:white;border-radius:8px;text-decoration:none;">Back to Dashboard</a></div>';
                return;
            }
            snapshot.forEach(function(orderDoc) {
                var order = orderDoc.data();
                var orderId = orderDoc.id;
                currentOrderId = orderId;
                console.log("Order Data:", order);
                localStorage.setItem("currentOrderId", orderId);
                var statusIcon = "&#9203;";
                var statusColor = "#FF9800";
                if (order.status === "Accepted") {
                    statusIcon = "&#10004;&#65039;";
                    statusColor = "#4CAF50";
                } else if (order.status === "On The Way") {
                    statusIcon = "&#128661;";
                    statusColor = "#2196F3";
                } else if (order.status === "Reached") {
                    statusIcon = "&#128205;";
                    statusColor = "#9C27B0";
                } else if (order.status === "Completed") {
                    statusIcon = "&#10004;&#65039;";
                    statusColor = "#4CAF50";
                }
                var html = '<div class="card" style="border-left: 5px solid ' + statusColor + ';">';
                html += '<div class="card-header">';
                html += '<h2>' + (order.service || "Service") + ' ' + statusIcon + '</h2>';
                html += '<span class="status-badge" style="background:' + statusColor + ';color:white;padding:5px 15px;border-radius:20px;font-size:14px;">' + order.status + '</span>';
                html += '</div>';
                html += '<div class="card-body">';
                html += '<p><strong>Location:</strong> ' + (order.location || "N/A") + '</p>';
                html += '<p><strong>Phone:</strong> ' + (order.phone || "N/A") + '</p>';
                html += '<p><strong>Agent:</strong> ' + (order.providerEmail || "Waiting for agent...") + '</p>';
                html += '<div id="distance" class="distance-box">Calculating distance...</div>';
                if (order.status === "Reached") {
                    html += '<div class="alert alert-success">Agent has reached your location!</div>';
                }
                if (order.status === "On The Way") {
                    html += '<div class="alert alert-info">Agent is on the way to your location</div>';
                }
                if (order.status === "Completed") {
                    html += '<div class="alert alert-success">Service completed! <a href="rating.html?order=' + orderId + '" class="btn btn-rating">Rate Experience</a></div>';
                    html += '<div class="order-completed-info">';
                    html += '<p><strong>Completed At:</strong> ' + (order.completedAt ? new Date(order.completedAt).toLocaleString() : "N/A") + '</p>';
                    html += '<a href="payment.html?order=' + orderId + '&service=' + order.service + '" class="btn btn-primary">Make Payment</a>';
                    html += '</div>';
                } else {
                    html += '<div class="card-actions"><a href="rating.html?order=' + orderId + '" class="btn btn-secondary">Rate</a></div>';
                }
                html += '</div>';
                html += '</div>';
                trackingDetails.innerHTML = html;
                if (order.providerId && order.status !== "Completed") {
                    listenToAgentLocation(order.providerId, orderId);
                } else {
                    console.log("No provider assigned yet or order completed");
                }
            });
        });
    });
}

function listenToAgentLocation(providerId, orderId) {
    if (!providerId) return;
    console.log("Listening to agent location for:", providerId);
    onSnapshot(
        doc(db, "users", providerId),
        function(agentDoc) {
            if (!agentDoc.exists()) {
                console.log("Agent document does not exist");
                return;
            }
            var agent = agentDoc.data();
            console.log("Agent Data:", agent);
            if (agent.latitude && agent.longitude && customerLocation) {
                var agentPosition = {
                    lat: agent.latitude,
                    lng: agent.longitude
                };
                console.log("Agent Position:", agentPosition);
                if (!agentMarker) {
                    agentMarker = new google.maps.Marker({
                        position: agentPosition,
                        map: map,
                        title: "Service Agent",
                        icon: {
                            url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
                            scaledSize: new google.maps.Size(40, 40)
                        },
                        animation: google.maps.Animation.DROP
                    });
                } else {
                    smoothMoveMarker(agentMarker, agentPosition);
                }
                var bounds = new google.maps.LatLngBounds();
                bounds.extend(customerLocation);
                bounds.extend(agentPosition);
                map.fitBounds(bounds);
                calculateAndDisplayRoute(customerLocation, agentPosition);
            } else {
                console.log("Agent location data incomplete or customer location not set");
            }
        },
        function(error) {
            console.log("Error listening to agent location:", error);
        }
    );
}

// Cleanup on page unload
window.addEventListener("beforeunload", function() {
    console.log("Cleaning up tracking listeners...");
    // Firestore listeners are managed by onSnapshot which auto-detaches
    // when page unloads if we don't hold references
});

console.log("Tracking.js fully loaded with live tracking, directions, distance & ETA");
