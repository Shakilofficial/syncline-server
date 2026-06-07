# 🚀 Syncline - Task Management & Collaboration Server

Syncline is a progressive, high-performance task management and team collaboration backend built using **NestJS (v11)**, **TypeScript**, **Prisma ORM**, and **PostgreSQL**. It features robust role-based access control, task/project tracking, real-time socket notifications, background queue processing with **BullMQ/Redis**, and secure file uploads to cloud storage.

---

## 🛠️ Tech Stack & Architecture

- **Framework**: [NestJS](https://nestjs.com/) (Modular Architecture)
- **Database ORM**: [Prisma ORM](https://www.prisma.io/) (PostgreSQL dialect)
- **Cache & Message Broker**: [Redis](https://redis.io/)
- **Background Processing**: [BullMQ](https://docs.bullmq.io/)
- **Authentication**: JWT (JSON Web Tokens) with Refresh Token rotation (Secure HTTP-Only Cookies)
- **Real-time Engine**: Socket.IO (NestJS WebSockets)
- **Cloud Storage**: AWS S3 / Cloudflare R2
- **Validation & Transformation**: `class-validator` & `class-transformer`

---

## ✨ Features

- **🔐 Robust Auth & RBAC**:
  - Secure Signup & Login with password hashing (`bcryptjs`).
  - Access Token (header) and Refresh Token (HTTP-Only Cookie) rotation.
  - Role-based Route Protection for roles: `ADMIN`, `PROJECT_MANAGER`, and `TEAM_MEMBER`.
- **📂 Project Management**:
  - Create, view, update, and soft-delete/hard-delete projects.
  - Invite and manage project members.
  - Track project-level audit logs / activity logs dynamically.
- **📋 Task Tracking**:
  - Manage tasks inside projects with statuses (`TODO`, `IN_PROGRESS`, `COMPLETED`) and priorities (`HIGH`, `MEDIUM`, `LOW`).
  - Assign tasks to project members with automatic email/socket alerts.
- **💬 Task Discussions (Comments)**:
  - Discuss and comment on tasks in real-time.
- **📎 File Attachments**:
  - Secure file uploading directly to AWS S3 or Cloudflare R2.
  - Limits file uploads up to 50MB (with configured mimetype protections).
- **🔔 Real-time Notifications**:
  - Action-driven notifications (e.g. project invitation, task assignment).
  - Background task scheduling using BullMQ.
  - Pushed in real-time via WebSockets or saved in-database for offline retrieval.
  - Filtering by read/unread status, sorting, and searchTerm search.

---

## 📁 Directory Structure

```text
src/
├── common/                # Shared utilities, decorators, guards, filters, and interceptors
│   ├── decorators/        # @CurrentUser(), @Public(), @Roles(), @Cookies()
│   ├── dto/               # Global search & pagination QueryDto
│   ├── filters/           # Global HttpExceptionFilter
│   ├── guards/            # JwtAuthGuard, RolesGuard
│   └── interceptors/      # TransformInterceptor (standardized API responses)
├── config/                # Configuration schema and environment validations
├── core/                  # Infrastructure modules
│   ├── prisma/            # Prisma service & database transactions
│   ├── queue/             # BullMQ queue registration (Notifications)
│   ├── redis/             # Redis caching service
│   └── storage/           # AWS S3 / Cloudflare R2 upload helper
└── modules/               # Feature-based business logic
    ├── auth/              # Signup, login, logout, password change
    ├── user/              # User profiles, avatar updates, role/status modifications
    ├── project/           # Project CRUD, members, activity logger
    ├── task/              # Task tracking, status updates, assignees
    ├── comment/           # Task comment feeds
    ├── attachment/        # Upload attachments to tasks
    └── notification/      # Real-time user notifications & FCM registry
```

---

## ⚙️ Project Setup

### 1. Prerequisites
Ensure you have the following installed on your local machine:
- **Node.js** (v18+)
- **NPM** or **PNPM** or **Yarn**
- **PostgreSQL** instance
- **Redis** server running locally or in a container

### 2. Installation
Clone this repository and install the dependencies:
```bash
$ npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory and configure it as shown in `.env.example`:
```ini
# Application
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/syncline_db

# Redis
REDIS_URL=redis://localhost:6379

# JWT Secrets
JWT_ACCESS_SECRET=your-super-secret-access-key-32-chars-long
JWT_REFRESH_SECRET=your-super-secret-refresh-key-64-chars-long
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# AWS S3 / Cloudflare R2
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=syncline-attachments
```

### 4. Database Setup & Migrations
Sync your database schema using Prisma and seed initial data (Admin/Team Members):
```bash
# Apply migrations
$ npx prisma migrate dev

# Run database seed
$ npx prisma db seed
```

---

## 🚀 Execution & Run Scripts

```bash
# Start in Development (watch mode)
$ npm run start:dev

# Build project for production
$ npm run build

# Run built production build
$ npm run start:prod
```

---

## 🧪 Testing

```bash
# Run Unit Tests (Jest)
$ npm run test

# Run End-to-End (E2E) Tests
$ npm run test:e2e

# Run Test Coverage
$ npm run test:cov
```

---

## 📡 API Testing & Postman Collection

We provide a complete Postman Collection in the repository to make testing all API endpoints easy.

### Authentication Flow
The server uses a custom token extractor.
1. When you **Signup** or **Login**, you will receive an `accessToken` inside the JSON response and a `refreshToken` set via secure cookie.
2. For all authenticated endpoints, pass the `accessToken` directly under the `Authorization` header:
   ```http
   Authorization: your_access_token
   ```
   *(Note: Do **NOT** prefix the token with `Bearer`. If using Postman's built-in Bearer Token field, it will automatically prepend the `Bearer ` string, causing token verification to fail. Add the `Authorization` header manually in the Headers tab.)*

### Import Collection
1. Download or locate the Postman JSON file generated in this workspace:
2. Open **Postman** -> **Import** -> Select the JSON file.
3. Configure the **Variables** tab on the Collection root in Postman:
   - `baseUrl`: `http://localhost:5000`
   - `accessToken`: your JWT token
   - Placeholder variables like `projectId`, `taskId`, etc.
