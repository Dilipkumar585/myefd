const fuelBtn = document.getElementById("bookFuel");
const loginBtn = document.getElementById("loginBtn");

if (fuelBtn) {
    fuelBtn.addEventListener("click", () => {
        window.location.href = "fuel-booking.html";
    });
}

if (loginBtn) {
    loginBtn.addEventListener("click", () => {
        window.location.href = "login.html";
    });
}