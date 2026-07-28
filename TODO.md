# Task Progress: UPI QR Payment Integration

## Implemented Features:
- [x] **Registration**: UPI ID field for agents (shown when agent role selected)
- [x] **Auth.js**: Saves UPI ID & name to Firestore on registration  
- [x] **Agent UPI Settings** (`js/agent-upi.js`): Modal to set/update UPI ID from agent dashboard
- [x] **Agent Sidebar**: "UPI Settings" link added
- [x] **Payment Page** (`payment.html`): QR section with "Scan to Pay" UI
- [x] **Payment JS** (`js/payment.js`): 
  - Generates QR code via `qrcodejs` library
  - Loads agent's UPI ID from Firestore
  - Builds `upi://pay` deep link URL with amount
  - Shows/hides QR based on payment method selection
  - MutationObserver to update QR when total changes
- [x] **QR Code Library**: `qrcode.min.js` from CDN
- [x] **Tracking JS**: Stores distance data to Firestore for fare calculation
- [x] **Distance-Based Pricing**: Base Fare + Per Km Charge (Rapido/Uber style)

## Files Modified/Created:
- `register.html` - UPI ID input for agents
- `js/auth.js` - Save UPI on registration
- `js/agent-upi.js` - NEW: UPI settings management
- `agent.html` - UPI Settings sidebar link + modal
- `payment.html` - QR scan section
- `js/payment.js` - QR generation + agent UPI loading
- `js/tracking.js` - Store distance to Firestore
- `js/agent.js` - Store distance/fare on completion
- `css/payment.css` - QR section styles

