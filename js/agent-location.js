// =============================================
// EFD Agent Location Tracker v2.0
// With proper cleanup and error recovery
// =============================================

import { db, auth } from "../firebase/firebase-config.js";

import {
    doc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

console.log("Agent Location Script Loaded");

let locationWatchId = null;

function startLocationTracking() {
    if (locationWatchId !== null) {
        navigator.geolocation.clearWatch(locationWatchId);
    }

    locationWatchId = navigator.geolocation.watchPosition(

async(position)=>{


    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;


    console.log("Current Location:");
    console.log(latitude, longitude);



    if(auth.currentUser){


        console.log("User ID:", auth.currentUser.uid);



        await updateDoc(

            doc(db,"users",auth.currentUser.uid),

            {

                latitude: latitude,

                longitude: longitude,

                locationUpdatedAt: new Date().toISOString()

            }

        );


        console.log("Location Saved Successfully");


    }

    else{

        console.log("User Not Logged In");

    }



},


(error)=>{

console.log("Location Error:", error.message);

},


{
    enableHighAccuracy:true,
    maximumAge:0,
    timeout:10000
}

);

    console.log("Location tracking started with ID:", locationWatchId);
}

// Start tracking on load
startLocationTracking();

// Cleanup on page unload - clear geolocation watch to prevent memory leaks
window.addEventListener("beforeunload", function() {
    if (locationWatchId !== null) {
        navigator.geolocation.clearWatch(locationWatchId);
        console.log("Location watch cleared on unload");
    }
});
