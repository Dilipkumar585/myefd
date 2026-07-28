import { auth, db } from "../firebase/firebase-config.js";


import {
onAuthStateChanged
}
from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";


import {
doc,
getDoc
}
from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";





onAuthStateChanged(auth, async(user)=>{


if(!user){

window.location="login.html";

return;

}



const userDoc =
await getDoc(
doc(db,"users",user.uid)
);



if(!userDoc.exists()){

window.location="login.html";

return;

}



const data=userDoc.data();



if(data.role !== "Admin"){


alert("Access Denied");


window.location="customer.html";


}



});