import {auth,db} from "../firebase/firebase-config.js";


import {
onAuthStateChanged
}
from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";


import {
doc,
getDoc
}
from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";



onAuthStateChanged(auth,async(user)=>{


if(!user){

window.location="login.html";

return;

}



const userDoc =
await getDoc(doc(db,"users",user.uid));


const data=userDoc.data();

console.log(data.role);

if(

data.role !== "Fuel Agent" &&

data.role !== "Mechanic Agent" &&

data.role !== "Ambulance Agent"

){


alert("Agent Access Only");


window.location="customer.html";


}



});