# MAISON D'ÉLIXIR PARIS — HAUTE PARFUMERIE & 3D SHOWROOM

An ultra-luxurious, interactive perfume e-commerce web application featuring a Parisian Haute Parfumerie aesthetic, an interactive 3D WebGL showroom, dynamic fragrance spotlights, size-based price calculation, cart management, bespoke checkout with digital invoice generation, WhatsApp concierge integration, and a real-time Product Management System.

---

## 🌟 Key Features & Implementation Highlights

### 1. Interactive 3D Showroom (Homepage)
- **5–6 Flacons on Stage**: Showcases iconic master perfumes (*Nocturne Oud*, *Rose Impériale*, *Ambre Céleste*, *Santal Mystique*, *Fleur Blanche*, *Cuir Soleil*).
- **Realistic 3D WebGL Environment**:
  - Three.js WebGL scene with circular gold-inlaid pedestal, reflective showroom floor, and floating golden fragrance dust particles.
  - Procedurally modeled luxury crystal flacons with refraction, fluid cores with custom tincture colors, 24K gold collar rings, and faceted diamond/crystal stoppers.
- **Dynamic Spotlight & Hover Reaction**:
  - Hovering or tapping any perfume enlarges it smoothly (`scale: 1.18x`) and elevates it.
  - The main dynamic overhead spotlight steers and focuses its cone onto the active bottle.
  - The other perfume bottles dim gracefully in the background.
  - The glassmorphic Spotlight Product Information Dock instantly updates beside the selected bottle.
- **3D Camera & View Controls**:
  - **Panorama**: Wide grand showroom arc.
  - **Focus Solo**: Intimate inspection of the active flacon.
  - **Top Vault**: Bird’s-eye perspective of the perfume circle.
  - **Auto-Orbit & 360° Drag**: Interactive horizontal drag rotation.

---

### 2. Product Information Panel
- **Brand & Fragrance**: Brand name, fragrance title, subtitle, and concentration (*Extrait de Parfum*, *34% Concentration*).
- **Dynamic Pricing by Flacon Size**:
  - Clickable size pills for **30ml**, **50ml**, and **100ml**.
  - Selecting any size instantly recalculates the unit price and total price.
- **Visual Presentation**: High-resolution vector crystal artwork with reflection glares and gold seals.
- **Fragrance Notes & Olfactory Pyramid**: Instant badges for Top Notes, Heart Notes, and Base Notes.
- **Live Atelier Inventory**: Dynamic stock badge (e.g. *"Atelier In-Stock (8 available)"* or *"Rare Reserve — Only 5 flacons remaining"*).
- **Action Buttons**: Elegant "View Details" (opens deep olfactory story modal) and "Add to Cart".

---

### 3. Product Selection & Quantity
- **Interactive Quantity Adjuster**:
  - `+` and `-` buttons with min/max stock boundaries.
  - Direct editable custom quantity input field (type any quantity).
  - Quick quantity pills (`1`, `2`, `3`).
- **Real-Time Price Calculation**: `Unit Price × Quantity` calculated and displayed automatically.
- **Smooth Fly-to-Cart Animation**: A luminous gold orb flies from the button into the shopping bag icon, triggering a bounce animation and luxury toast notification.

---

### 4. Smart Shopping Bag Drawer
- **Multi-Item Support**: Add multiple perfumes in different sizes (e.g., *Nocturne Oud 100ml* and *Rose Impériale 50ml*).
- **Return to Browse**: "Return to Browse Showroom" button closes the drawer seamlessly.
- **Full In-Cart Controls**: Increase/decrease quantities or delete items with smooth fade-out animations.
- **VIP Privilège Codes**:
  - `ROYAL10` — 10% VIP Discount
  - `ELIXIR20` — 20% Haute Parfumerie Discount
  - `MAISON25` — $25 Maison Concierge Gift
- **White-Glove Delivery Calculation**:
  - Complimentary express courier on orders over **$150**.
  - Dynamic progress bar showing the remaining amount to unlock complimentary delivery.
- **Header Badge**: Live count badge with pop animations.

---

### 5. Luxury Checkout & Digital Invoice
- **Checkout Modal**:
  - Full Name, Mobile Phone (formatted for international receipt dispatch).
  - Delivery Destination (Street, Suite/Villa, City, Postal Code, Country, Special Courier Instructions).
  - Payment Method Selection: *Cash/Card upon Handover*, *Credit/Debit Card*, *Apple Pay*.
  - Itemized Order Summary breakdown.
- **Digital Haute Parfumerie Invoice**:
  - Official Paris Atelier invoice layout (`#INV-2026-XXXX`).
  - Watermark emblem, client details, itemized table with sizes and unit prices, tax/delivery calculation, authenticity seal, and QR block.
  - Printable & Save-as-PDF ready (`window.print()` with dedicated `@media print` styling).

---

### 6. Order Confirmation & WhatsApp Concierge
- **Unique Order Reference**: Auto-generates unique order ID (e.g., `#ROYAL-2026-7841`).
- **Celebration Effect**: Canvas confetti explosion on order confirmation.
- **Direct WhatsApp Receipt**:
  - Clicking the WhatsApp button opens `https://wa.me/?text=...` with a pre-filled, emoji-rich receipt containing:
    - Order Reference & Date
    - Client Name & Mobile
    - Delivery Destination
    - Itemized Perfumes (Name, Size, Quantity, Unit Price, Total)
    - Delivery Fee & Grand Total
    - Special Courier Instructions

---

### 7. Product Management System (Admin Panel)
- **Atelier Catalog Manager**:
  - Accessible via the **"Catalog Manager"** button in header, footer link, or shortcut **`Ctrl + Shift + A`**.
  - **Edit Any Perfume**: Modify Name, Brand, Description, Olfactory Notes, 30ml/50ml/100ml prices, inventory stock, and bottle color themes.
  - **Add New Fragrances**: Create and add new perfumes with instant live rendering.
  - **Delete Fragrances**: Remove discontinued editions.
  - **Reset to Defaults**: One-click restore of the factory Haute Parfumerie collection.
  - All modifications persist in `localStorage` and immediately update the 3D Showroom, catalog grid, and shopping cart!

---

## 🚀 How to Run

Simply open `D:\perfume-store\index.html` in any modern web browser (Google Chrome, Microsoft Edge, Mozilla Firefox, Safari).

No installation, build steps, or servers required — it is 100% self-contained.
