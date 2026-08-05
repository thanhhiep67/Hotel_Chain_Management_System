<div align="center">

# 🏨 Hotel Chain Management System

**A full-stack hotel chain management platform with real-time notifications, AI-powered analytics, and integrated online payment.**

[![Java](https://img.shields.io/badge/Java-17-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white)](https://openjdk.org/)
[![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.5-6DB33F?style=for-the-badge&logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

[Live Demo](https://your-frontend.onrender.com) · [API Docs](http://localhost:8080/swagger-ui.html) · [Report Bug](https://github.com/your-username/Hotel_Chain_Management_System/issues)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [System Architecture](#-system-architecture)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Run Backend](#run-backend)
  - [Run Frontend](#run-frontend)
- [API Documentation](#-api-documentation)
- [Project Structure](#-project-structure)
- [License](#-license)

---

## 🌐 Overview

**Hotel Chain Management System** is a production-ready web application that centralises the entire operational lifecycle of a hotel chain — from guest booking and online payment to staff check-in and owner analytics — under a single platform.

The system enforces a **4-role RBAC model** (Admin · Owner · Staff · User) with stateless JWT authentication, real-time WebSocket communication, and an atomic MongoDB data layer that prevents race conditions under concurrent load.

---

## ✨ Features

### 👤 Guest (User)
- Register / login with JWT; forgot-password via OTP email
- Search hotels by city, room type, price range
- Interactive map with nearby hotel search powered by MongoDB `$nearSphere` and Leaflet/OpenStreetMap
- Real-time room availability check (conflict detection via compound index)
- Booking with optional discount code; atomic `$inc` prevents coupon oversell
- Online payment via **VNPay** (QR / bank transfer) with HMAC-SHA512 signature
- Cash payment flow with in-person collection guide
- Generate time-limited **QR Code** for check-in
- Post-stay reviews with star rating
- Real-time booking & payment notifications (WebSocket STOMP)
- In-app chat with hotel staff; image upload support
- View payment history and booking history with status tracking
- AI-powered room recommendations (Content-Based + Collaborative Filtering)

### 🏢 Hotel Owner
- Create and manage hotel profiles (pending Admin approval)
- Manage room inventory: type, price, amenities, images
- Confirm / reject guest bookings
- Assign staff accounts to managed hotels
- Real-time chat with guests
- **Analytics Dashboard**: revenue trends, booking-by-status breakdown, top rooms, discount ROI, payment method distribution
- 30-day booking forecast with Moving Average algorithm
- Dynamic price suggestion based on occupancy and historical data
- Export revenue reports to **Excel (.xlsx)** via Apache POI
- Issue refunds through VNPay API

### 🛎️ Hotel Staff
- Confirm bookings and process check-in / check-out
- Scan guest QR codes for check-in verification
- Chat with guests in real time

### 🔑 Platform Admin
- Approve or reject hotel registration requests
- Manage all user accounts: view, lock/unlock, delete
- Moderate guest reviews: hide, restore
- Monitor and resolve suspicious review alerts (automated flagging)
- Platform-wide statistics: hotels, rooms, bookings, users

---

## 🛠 Tech Stack

### Backend

| Layer | Technology | Purpose |
|---|---|---|
| Framework | Spring Boot 3.5 | Application core, auto-configuration |
| Security | Spring Security 6 + JWT (jjwt 0.12) | Stateless auth, RBAC with `@PreAuthorize` |
| Database | MongoDB 7.0 | Primary document store; 2dsphere, compound & TTL indexes |
| Cache | Redis + Spring Cache | JWT denylist, session rate-limiting |
| Real-time | WebSocket STOMP + SockJS | Live notifications, in-app chat |
| Payment | VNPay HMAC-SHA512 | Online payment, IPN server-to-server callback |
| Email | JavaMailSender (Gmail SMTP) | OTP delivery, booking confirmation |
| Reporting | Apache POI 5.3 | Excel revenue report generation |
| QR Code | ZXing 3.5 | Time-limited check-in QR generation |
| API Docs | Springdoc OpenAPI 2.8 | Swagger UI at `/swagger-ui.html` |

### Frontend

| Layer | Technology | Purpose |
|---|---|---|
| Framework | ReactJS 19 + Vite 8 | SPA, HMR dev experience |
| HTTP | Axios | REST API calls with interceptors |
| Routing | React Router DOM 7 | Client-side routing, protected routes |
| Charts | Recharts 3 | Analytics dashboard visualisations |
| Maps | Leaflet + React-Leaflet + OpenStreetMap | Interactive hotel map, nearby search |
| Real-time | STOMP.js + SockJS-client | WebSocket subscriptions |
| Styling | Tailwind CSS v4 | Utility-first design system |

---

## 🏗 System Architecture

The application follows a classic **3-tier architecture**:

```
┌─────────────────────────────────────────────────────┐
│                  Presentation Layer                  │
│        ReactJS 19 SPA  (Vite · Tailwind CSS)        │
│   Axios REST  ·  STOMP WebSocket  ·  Leaflet Map    │
└───────────────────────┬─────────────────────────────┘
                        │ HTTPS / WSS
┌───────────────────────▼─────────────────────────────┐
│                  Application Layer                   │
│         Spring Boot 3.5  (REST + WebSocket)          │
│  Spring Security 6  ·  JWT  ·  RBAC @PreAuthorize   │
│  VNPay Gateway  ·  JavaMailSender  ·  Apache POI    │
└──────────┬────────────────────────┬─────────────────┘
           │                        │
┌──────────▼──────────┐  ┌──────────▼──────────────────┐
│    MongoDB 7.0      │  │         Redis               │
│  Documents · Geo    │  │  JWT denylist · Cache       │
│  Aggregation · TTL  │  │  Rate limiting              │
└─────────────────────┘  └─────────────────────────────┘
```

**Key design decisions:**
- **Stateless JWT** — no server-side session; refresh token stored in Redis denylist on logout.
- **MongoDB compound index** `{ roomId, checkIn, checkOut }` — O(log n) conflict detection for concurrent bookings.
- **Atomic `$inc`** on discount `usedCount` — prevents coupon oversell under high concurrency without distributed locks.
- **2dsphere index** on `Hotel.location` — enables `$nearSphere` geo queries with kilometre-accurate radius filtering.
- **WebSocket STOMP topics** — per-user queue `/user/{id}/queue/notifications` + hotel broadcast `/topic/hotel/{id}`.

---

## 🚀 Getting Started

### Prerequisites

| Tool | Minimum Version |
|---|---|
| Java (JDK) | 17 |
| Apache Maven | 3.9+ |
| MongoDB | 7.0 |
| Redis | 7.0 |
| Node.js | 20 LTS |
| npm | 10+ |

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/Hotel_Chain_Management_System.git
cd Hotel_Chain_Management_System
```

### Environment Variables

Create `Back_End/src/main/resources/application.properties` (or override via environment variables):

| Variable | Description | Example |
|---|---|---|
| `spring.data.mongodb.host` | MongoDB host | `localhost` |
| `spring.data.mongodb.port` | MongoDB port | `27017` |
| `spring.data.mongodb.database` | Database name | `hotel_chain_db` |
| `spring.data.redis.host` | Redis host | `localhost` |
| `spring.data.redis.port` | Redis port | `6379` |
| `jwt.secret` | JWT HMAC-256 secret key (hex, ≥ 256 bit) | `5367566B59703373...` |
| `jwt.access-token.expiration` | Access token TTL (ms) | `900000` *(15 min)* |
| `jwt.refresh-token.expiration` | Refresh token TTL (ms) | `604800000` *(7 days)* |
| `spring.mail.username` | Gmail address for SMTP | `yourapp@gmail.com` |
| `spring.mail.password` | Gmail App Password | `abcd efgh ijkl mnop` |
| `vnpay.tmn-code` | VNPay Terminal Code | `DEMO0123` |
| `vnpay.hash-secret` | VNPay HMAC-SHA512 secret | `YOUR_VNPAY_SECRET` |
| `vnpay.pay-url` | VNPay payment gateway URL | `https://sandbox.vnpayment.vn/...` |
| `vnpay.return-url` | Backend VNPay return URL | `https://your-ngrok.ngrok-free.app/payments/vnpay/return` |
| `vnpay.frontend-return-url` | Frontend result page URL | `http://localhost:3000/payment-result` |
| `app.upload.dir` | Chat image upload directory | `./uploads/chat` |
| `qr.checkin.expiry-minutes` | QR code validity window | `15` |

> **Gmail SMTP** — enable 2FA on your Google account then generate an **App Password** at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).  
> **VNPay** — register a sandbox account at [sandbox.vnpayment.vn](https://sandbox.vnpayment.vn) to obtain `tmn-code` and `hash-secret`.  
> **Ngrok** — required for VNPay IPN server-to-server callbacks during local development: `ngrok http 8080`.

### Run Backend

```bash
cd Back_End

# Install dependencies and compile
mvn clean install -DskipTests

# Start the application (port 8080 by default)
mvn spring-boot:run
```

The backend will start at **`http://localhost:8080`**.  
Swagger UI is available at **`http://localhost:8080/swagger-ui.html`** (no login required).

### Run Frontend

```bash
cd Front_End

# Install dependencies
npm install

# Start Vite dev server (port 3000)
npm run dev
```

The frontend will start at **`http://localhost:3000`**.

---

## 📖 API Documentation

Interactive API documentation is provided via **Swagger UI** powered by Springdoc OpenAPI.

| Resource | URL |
|---|---|
| Swagger UI | `http://localhost:8080/swagger-ui.html` |
| OpenAPI JSON spec | `http://localhost:8080/v3/api-docs` |

**Authenticating in Swagger UI:**
1. Call `POST /auth/login` with your credentials.
2. Copy the `accessToken` from the response.
3. Click the **🔒 Authorize** button (top-right of the Swagger page).
4. Paste the token and click **Authorize** — all secured endpoints will include the `Bearer` header automatically.

---

## 📁 Project Structure

```
Hotel_Chain_Management_System/
│
├── Back_End/                          # Spring Boot application
│   └── src/main/java/com/example/Back_End/
│       ├── config/                    # Security, CORS, WebSocket, OpenAPI config
│       ├── controller/                # 15 REST controllers
│       ├── service/                   # Business logic
│       ├── repository/                # MongoRepository interfaces
│       ├── model/                     # MongoDB document models
│       ├── dto/                       # Request / Response DTOs
│       ├── exception/                 # Global exception handling
│       └── security/                  # JWT filter, user details
│
├── Front_End/                         # React + Vite SPA
│   └── src/
│       ├── api/                       # Axios service modules
│       ├── components/                # Reusable UI components
│       ├── pages/                     # Route-level page components
│       ├── context/                   # React context providers
│       └── hooks/                     # Custom hooks (WebSocket, auth)
│
└── uploads/
    └── chat/                          # User-uploaded chat images (served statically)
```

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Made with by [HuynhThanhHiep](https://github.com/HuynhThanhHiep)

</div>
