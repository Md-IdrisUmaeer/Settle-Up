# SettleUp

A full-stack group expense-splitting app — track shared costs, see who owes who, and settle up with the minimum number of payments. Built as a real project for a group of friends, not a tutorial clone.

**Live demo:** [SettleUp](https://settle-up-wheat.vercel.app/)

## Features

- **Group expenses** — create groups, add itemized expenses, and split them among members
- **Smart settle-up** — a debt-simplification algorithm reduces a group's balances to the minimum number of transactions needed to settle everyone up (instead of naively pairing every debt)
- **Real-time sync** — balances and settlements update live across every connected client via Socket.IO, no refresh needed
- **Invite via link** — share a link, preview the group before signing up, and auto-join after login/signup
- **Group ownership & membership management** — transfer ownership, remove members, leave a group, or delete a group entirely (all gated on everyone being settled up first)
- **Account deletion** — soft-deletes and anonymizes a user's account while preserving group ledger history
- **Authorization built in** — only the payer or receiver of a settlement can confirm or delete it; only group owners can manage membership

## Tech Stack

**Frontend:** React (Vite), React Router, Socket.IO client, Axios, Tailwind CSS  
**Backend:** Node.js, Express, MongoDB, Mongoose, Socket.IO, JWT auth, bcrypt  
**Testing:** Jest (debt-simplification, expense-split, and balance logic)

## Project Structure

```
SettleUp/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Route handlers (auth, groups, expenses, settlements)
│   │   ├── middleware/      # Auth & group-membership guards
│   │   ├── models/          # Mongoose schemas
│   │   ├── routes/          # Express routers
│   │   ├── services/        # Balance calculation & debt simplification
│   │   └── socket.js        # Socket.IO setup
│   ├── tests/                # Jest test suites
│   └── server.js
└── frontend/
    └── src/
        ├── api/              # Axios API client wrappers
        ├── components/       # Shared UI components
        ├── context/          # Auth context
        └── pages/            # Route-level pages
```

## Getting Started

### Prerequisites
- Node.js 18+
- A MongoDB instance (local or [MongoDB Atlas](https://www.mongodb.com/atlas))

### 1. Clone the repo
```bash
git clone [Add your repo URL here]
cd SettleUp
```

### 2. Backend setup
```bash
cd backend
npm install
```

Create a `backend/.env` file:
```env
PORT=5000
MONGO_URI=[Add your MongoDB connection string here]
JWT_SECRET=[Add a long random secret here]
JWT_EXPIRES_IN=7d
CLIENT_ORIGIN=http://localhost:5173
```

```bash
npm run dev
```

### 3. Frontend setup
```bash
cd frontend
npm install
npm run dev
```

The frontend dev server proxies `/api` and `/socket.io` to `http://localhost:5000` automatically — no extra frontend env vars needed for local development.

### 4. Run tests
```bash
cd backend
npm test
```

## Deployment

Deployed frontend using Vercel and backend using Render , Make sure to connect the frontend and backend by updating the Environment in Vercel and Render
 for seamless connection
## Author
Mohamed Idris Umaeer 

[Your name] — [Your GitHub/LinkedIn/portfolio link here]
