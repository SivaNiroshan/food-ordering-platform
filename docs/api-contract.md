# FoodFlow – API Contract

REST + WebSocket contract between the React frontend and the Express API (MVP).

---

## 1. Conventions

### Base URL

All routes are prefixed with `/api/v1`.

### Route scopes

Routes are grouped by audience, and each group is mounted with its own role middleware:

| Prefix                       | Who                                                 | Example                          |
| ---------------------------- | --------------------------------------------------- | -------------------------------- |
| `/auth`, `/me`               | Public / any logged-in user                         | `POST /auth/login`               |
| `/categories`, `/menu-items` | Public (customer-facing menu)                       | `GET /menu-items`                |
| `/orders`                    | `CUSTOMER` (own orders only)                        | `POST /orders`                   |
| `/staff/...`                 | `STAFF`, `ADMIN` (status transitions: `STAFF` only) | `POST /staff/orders/{id}/accept` |
| `/admin/...`                 | `ADMIN`                                             | `GET /admin/users`               |

### HTTP methods

| Method   | Meaning                                       | Success code                    |
| -------- | --------------------------------------------- | ------------------------------- |
| `GET`    | Read                                          | `200`                           |
| `POST`   | Create, or perform an action                  | `201` (create) / `200` (action) |
| `PATCH`  | Partial update                                | `200`                           |
| `DELETE` | Not used in the MVP (soft delete via `PATCH`) | —                               |

### Status codes

| Code  | When                                                                           |
| ----- | ------------------------------------------------------------------------------ |
| `400` | Validation failed, or a business rule on the input failed (e.g. minimum order) |
| `401` | Not logged in, or token invalid/expired                                        |
| `403` | Logged in, but role not allowed                                                |
| `404` | Resource not found, or it belongs to someone else                              |
| `409` | Conflict: duplicate, invalid status transition, lost race, unavailable item    |
| `429` | Rate limit exceeded                                                            |
| `500` | Unexpected server error (no internal details exposed)                          |

### Error format

Every error response has the same shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "field": "email", "message": "Invalid email address" }]
  },
  "requestId": "4f1c2a9e-8d3b-4c1a-9f2e-1a2b3c4d5e6f"
}
```

- `code` is a stable machine-readable string; the frontend switches on it.
- `details` is present only for validation errors.
- `requestId` is also written to the logs (`X-Request-Id` response header).

### Pagination

List endpoints accept `page` (default 1) and `pageSize` (default 20, max 50) and return:

```json
{
  "data": [],
  "meta": { "page": 1, "pageSize": 20, "totalItems": 87, "totalPages": 5 }
}
```

### Data formats

- **Money**: decimal string with 2 places, e.g. `"1200.00"` (LKR). Never JSON numbers.
- **Dates**: ISO 8601 UTC, e.g. `"2026-10-23T09:30:00Z"`.
- **IDs**: UUID strings.
- **JSON keys**: camelCase (database columns are snake_case; Prisma maps them).

### Authentication

- **Access token**: JWT, 15-minute lifetime, sent as `Authorization: Bearer <token>`. Payload: `sub` (user id), `role`.
- **Refresh token**: opaque random string, 7-day lifetime, sent only as an `httpOnly`, `Secure`, `SameSite=Strict` cookie named `refresh_token`, scoped to path `/api/v1/auth`. Stored hashed in the database and rotated on every use.
- On every authenticated request the API checks the user still exists and is active.

### Rate limiting

`POST /auth/login` and `POST /auth/register`: max 5 requests per minute per IP → `429 RATE_LIMITED`.

### Idempotency

`POST /orders` requires an `Idempotency-Key: <uuid>` header (see section 5).

### Not in the API

- **Cart**: stored in the frontend (Zustand + localStorage). The backend only validates items at checkout.
- **Image upload**: the MVP stores an `imageUrl` string only.

---

## 2. Shared Objects

### User

```json
{
  "id": "b3f1c2d4-...",
  "name": "Niroshan S",
  "email": "niro@example.com",
  "role": "CUSTOMER",
  "isActive": true,
  "createdAt": "2026-10-23T09:30:00Z"
}
```

### Category

```json
{ "id": "c1a2...", "name": "Rice & Curry", "description": "Lunch specials", "isActive": true }
```

`isActive` is returned only on `/staff` routes.

### MenuItem

```json
{
  "id": "m7d8...",
  "name": "Chicken Kottu",
  "description": "Chopped roti with chicken and vegetables",
  "price": "1200.00",
  "imageUrl": "https://.../kottu.jpg",
  "isAvailable": true,
  "category": { "id": "c1a2...", "name": "Kottu" }
}
```

`/staff` routes also return `isActive`, `createdAt`, `updatedAt`.

### Order

```json
{
  "id": "o9e8...",
  "status": "PENDING",
  "paymentMethod": "PAY_ON_COLLECTION",
  "paymentStatus": "UNPAID",
  "subtotal": "2850.00",
  "notes": "Less spicy please",
  "acceptanceDeadline": "2026-10-23T09:45:00Z",
  "statusReason": null,
  "items": [
    {
      "menuItemId": "m7d8...",
      "itemName": "Chicken Kottu",
      "unitPrice": "1200.00",
      "quantity": 2,
      "lineTotal": "2400.00"
    },
    {
      "menuItemId": "m3b4...",
      "itemName": "Iced Milo",
      "unitPrice": "450.00",
      "quantity": 1,
      "lineTotal": "450.00"
    }
  ],
  "createdAt": "2026-10-23T09:30:00Z",
  "updatedAt": "2026-10-23T09:30:00Z"
}
```

- `statusReason` is `{ "code": "KITCHEN_BUSY", "note": "..." }` when the order is `REJECTED` or `CANCELLED`, otherwise `null`. It comes from the latest status history row.
- On `/staff` routes the order also includes `customer: { id, name, email }`.
- Detail endpoints (`GET .../orders/{id}`) also include `history`:

```json
"history": [
  { "previousStatus": null, "newStatus": "PENDING", "changeSource": "CUSTOMER", "changedAt": "2026-10-23T09:30:00Z" },
  { "previousStatus": "PENDING", "newStatus": "ACCEPTED", "changeSource": "STAFF", "changedAt": "2026-10-23T09:32:10Z" }
]
```

Staff routes also include `changedBy: { id, name }` in each history entry.

---

## 3. Endpoint Summary

### Auth & profile

| Method | Path             | Auth / Role    | Story | Description                                       |
| ------ | ---------------- | -------------- | ----- | ------------------------------------------------- |
| POST   | `/auth/register` | Public         | US-01 | Register a customer account                       |
| POST   | `/auth/login`    | Public         | US-02 | Log in; returns access token, sets refresh cookie |
| POST   | `/auth/refresh`  | Refresh cookie | US-02 | Rotate refresh token, issue new access token      |
| POST   | `/auth/logout`   | Refresh cookie | US-02 | Revoke refresh token, clear cookie                |
| GET    | `/me`            | Any logged-in  | US-02 | Current user's profile                            |

### Menu (customer-facing)

| Method | Path               | Auth / Role | Story        | Description                                            |
| ------ | ------------------ | ----------- | ------------ | ------------------------------------------------------ |
| GET    | `/categories`      | Public      | US-04        | Active categories                                      |
| GET    | `/menu-items`      | Public      | US-03, US-04 | Active menu items; search, category filter, pagination |
| GET    | `/menu-items/{id}` | Public      | US-03        | One active menu item                                   |

### Customer orders

| Method | Path                  | Auth / Role | Story        | Description                                               |
| ------ | --------------------- | ----------- | ------------ | --------------------------------------------------------- |
| POST   | `/orders`             | CUSTOMER    | US-06        | Place an order (requires `Idempotency-Key`)               |
| GET    | `/orders`             | CUSTOMER    | US-07        | Own order history, newest first; optional `status` filter |
| GET    | `/orders/{id}`        | CUSTOMER    | US-07, US-08 | Own order detail with history                             |
| POST   | `/orders/{id}/cancel` | CUSTOMER    | US-09        | Cancel own order (only while `PENDING`)                   |

### Staff: order processing

| Method | Path                                 | Auth / Role  | Story        | Description                                                |
| ------ | ------------------------------------ | ------------ | ------------ | ---------------------------------------------------------- |
| GET    | `/staff/orders`                      | STAFF, ADMIN | US-10, US-16 | All orders; filter by `status`, `from`, `to`, `customerId` |
| GET    | `/staff/orders/{id}`                 | STAFF, ADMIN | US-10, US-16 | Order detail with full history                             |
| POST   | `/staff/orders/{id}/accept`          | STAFF        | US-11        | `PENDING → ACCEPTED`                                       |
| POST   | `/staff/orders/{id}/reject`          | STAFF        | US-11        | `PENDING → REJECTED` (reason required)                     |
| POST   | `/staff/orders/{id}/start-preparing` | STAFF        | US-12        | `ACCEPTED → PREPARING`                                     |
| POST   | `/staff/orders/{id}/mark-ready`      | STAFF        | US-12        | `PREPARING → READY`                                        |
| POST   | `/staff/orders/{id}/complete`        | STAFF        | US-18        | `READY → COMPLETED`; sets `paymentStatus = PAID`           |

### Staff: menu management

| Method | Path                     | Auth / Role  | Story | Description                                                        |
| ------ | ------------------------ | ------------ | ----- | ------------------------------------------------------------------ |
| GET    | `/staff/categories`      | STAFF, ADMIN | US-13 | All categories, including inactive                                 |
| POST   | `/staff/categories`      | STAFF, ADMIN | US-13 | Create a category                                                  |
| PATCH  | `/staff/categories/{id}` | STAFF, ADMIN | US-13 | Update name/description, or deactivate (`isActive`)                |
| GET    | `/staff/menu-items`      | STAFF, ADMIN | US-13 | All items, including inactive; filter by `isActive`, `isAvailable` |
| POST   | `/staff/menu-items`      | STAFF, ADMIN | US-13 | Create a menu item                                                 |
| PATCH  | `/staff/menu-items/{id}` | STAFF, ADMIN | US-13 | Update fields, availability, or deactivate (`isActive`)            |

### Admin: users

| Method | Path                       | Auth / Role | Story        | Description                                        |
| ------ | -------------------------- | ----------- | ------------ | -------------------------------------------------- |
| GET    | `/admin/users`             | ADMIN       | US-14        | List users; filter by `role`, `isActive`, `search` |
| GET    | `/admin/users/{id}`        | ADMIN       | US-14        | One user                                           |
| POST   | `/admin/users`             | ADMIN       | US-15        | Create a STAFF or ADMIN account                    |
| PATCH  | `/admin/users/{id}/role`   | ADMIN       | US-15        | Change a user's role                               |
| PATCH  | `/admin/users/{id}/status` | ADMIN       | US-14, US-15 | Deactivate / reactivate an account                 |

### Operations

| Method | Path      | Auth / Role | Story | Description                                                    |
| ------ | --------- | ----------- | ----- | -------------------------------------------------------------- |
| GET    | `/health` | Public      | —     | Liveness check for Docker and deployment (checks DB and Redis) |

The auto-cancel of unaccepted orders (US-17) has no endpoint: the BullMQ worker performs it and emits a WebSocket event.

---

## 4. Endpoint Details: Auth

### POST /api/v1/auth/register (US-01)

**Auth:** Public · rate limited

**Request body**

```json
{ "name": "Niroshan S", "email": "niro@example.com", "password": "Secret123" }
```

| Field    | Rules                                                    |
| -------- | -------------------------------------------------------- |
| name     | required, trimmed, 2–100 chars                           |
| email    | required, valid email, max 255                           |
| password | required, 8–72 chars, at least one letter and one number |

**Response 201:** `User` object.

**Errors**

- 400 `VALIDATION_ERROR`
- 409 `EMAIL_ALREADY_EXISTS`: normalized email already registered
- 429 `RATE_LIMITED`

**Notes**

- Role is always `CUSTOMER`; any `role` field in the body is ignored.
- 72-char limit: bcrypt ignores input beyond 72 bytes.
- The user must log in after registering (no automatic login in the MVP).

### POST /api/v1/auth/login (US-02)

**Auth:** Public · rate limited

**Request body**

```json
{ "email": "niro@example.com", "password": "Secret123" }
```

**Response 200**

```json
{
  "accessToken": "eyJhbGciOi...",
  "expiresIn": 900,
  "user": {
    "id": "b3f1...",
    "name": "Niroshan S",
    "email": "niro@example.com",
    "role": "CUSTOMER",
    "isActive": true,
    "createdAt": "..."
  }
}
```

Also sets the `refresh_token` cookie.

**Errors**

- 400 `VALIDATION_ERROR`
- 401 `INVALID_CREDENTIALS`: same error whether the email doesn't exist or the password is wrong
- 403 `ACCOUNT_DEACTIVATED`: returned only after the password is verified, so it doesn't reveal which emails exist
- 429 `RATE_LIMITED`

**Notes**

- When the email doesn't exist, the server still runs a bcrypt comparison against a dummy hash, so response time doesn't reveal whether an account exists.

### POST /api/v1/auth/refresh (US-02)

**Auth:** `refresh_token` cookie (no body, no access token needed)

**Response 200**

```json
{ "accessToken": "eyJhbGciOi...", "expiresIn": 900 }
```

Sets a new `refresh_token` cookie. The old token is marked replaced (`replaced_by_token_id`).

**Errors**

- 401 `INVALID_REFRESH_TOKEN`: missing, unknown, expired, revoked, or user deactivated
- 401 `REFRESH_TOKEN_REUSED`: an already-rotated token was used; **all** of the user's refresh tokens are revoked (likely theft)

**Notes**

- The frontend calls this automatically when any request returns 401 with an expired access token, then retries the original request once.

### POST /api/v1/auth/logout (US-02)

**Auth:** `refresh_token` cookie

**Response 204.** Revokes the current refresh token and clears the cookie. Always returns 204, even if the cookie is missing or already invalid.

### GET /api/v1/me

**Auth:** any logged-in user

**Response 200:** `User` object. Used by the frontend on page load to restore the session.

---

## 5. Endpoint Details: Menu

### GET /api/v1/menu-items (US-03, US-04)

**Auth:** Public

**Query parameters**

| Param         | Type    | Rules                                                 |
| ------------- | ------- | ----------------------------------------------------- |
| search        | string  | optional, 1–100 chars, case-insensitive match on name |
| categoryId    | uuid    | optional                                              |
| availableOnly | boolean | optional, default `false`                             |
| page          | integer | optional, ≥ 1, default 1                              |
| pageSize      | integer | optional, 1–50, default 20                            |

**Response 200:** paginated list of `MenuItem`, sorted by category name, then item name.

**Errors**

- 400 `VALIDATION_ERROR`: e.g. `categoryId` is not a UUID

**Notes**

- Returns only items where `is_active = true` and whose category is active.
- Unavailable items are returned with `isAvailable: false` so the UI can show them as sold out.
- An empty result returns `200` with `data: []`; the frontend shows the empty-state message.
- Cached in Redis for 60 seconds per unique query; the cache is cleared whenever staff create or update a menu item or category.

### GET /api/v1/menu-items/{id} (US-03)

**Response 200:** `MenuItem`. **404** `MENU_ITEM_NOT_FOUND` if it doesn't exist or is inactive.

### GET /api/v1/categories (US-04)

**Response 200:** array of active `Category` objects (not paginated; the list is small).

### POST /api/v1/staff/menu-items (US-13)

**Auth:** STAFF, ADMIN

**Request body**

```json
{
  "categoryId": "c1a2...",
  "name": "Chicken Kottu",
  "description": "Chopped roti with chicken and vegetables",
  "price": "1200.00",
  "imageUrl": "https://.../kottu.jpg",
  "isAvailable": true
}
```

| Field       | Rules                                               |
| ----------- | --------------------------------------------------- |
| categoryId  | required, must be an active category                |
| name        | required, 2–100 chars                               |
| description | optional, max 500                                   |
| price       | required, decimal string, ≥ 0, max 2 decimal places |
| imageUrl    | optional, valid https URL                           |
| isAvailable | optional, default `true`                            |

**Response 201:** staff `MenuItem`.

**Errors:** 400 `VALIDATION_ERROR`, 400 `CATEGORY_NOT_FOUND`, 401, 403.

### PATCH /api/v1/staff/menu-items/{id} (US-13)

Same fields as create, all optional, plus `isActive`. Setting `isActive: false` removes the item from the customer menu (soft delete). Past orders are unaffected because they store snapshots.

**Response 200:** staff `MenuItem`. **Errors:** 400, 401, 403, 404 `MENU_ITEM_NOT_FOUND`.

---

## 6. Endpoint Details: Orders

### POST /api/v1/orders (US-06)

**Auth:** CUSTOMER

**Headers**

```
Authorization: Bearer <accessToken>
Idempotency-Key: 7c9e6679-7425-40de-944b-e07fc1f90ae7
```

**Request body**

```json
{
  "items": [
    { "menuItemId": "m7d8...", "quantity": 2 },
    { "menuItemId": "m3b4...", "quantity": 1 }
  ],
  "notes": "Less spicy please"
}
```

| Field              | Rules                                             |
| ------------------ | ------------------------------------------------- |
| items              | required, 1–30 entries, no duplicate `menuItemId` |
| items[].menuItemId | required, uuid                                    |
| items[].quantity   | required, integer 1–20                            |
| notes              | optional, max 300 chars                           |

**Response 201:** `Order` with `status: PENDING`, `paymentStatus: UNPAID`.

**Replay:** if the same `Idempotency-Key` is sent again by the same customer with the same body, the API returns **200** with the existing order and header `Idempotent-Replayed: true`. No new order is created.

**Errors**

- 400 `VALIDATION_ERROR`, including a missing or invalid `Idempotency-Key`
- 400 `MINIMUM_ORDER_NOT_MET`: subtotal below LKR 500.00
- 401, 403 (non-customer roles cannot place orders)
- 409 `MENU_ITEM_UNAVAILABLE`: one or more items are inactive or unavailable; `details` lists the `menuItemId`s
- 409 `IDEMPOTENCY_KEY_REUSED`: same key sent with a different body

**Processing (server side)**

1. Validate the body with Zod.
2. Check the idempotency key; on a match, return the existing order.
3. Load the menu items from the database; reject inactive or unavailable ones.
4. Calculate line totals and the subtotal from **database prices** (any price sent by the client is ignored).
5. In one transaction: insert the order (`acceptance_deadline = now + 15 min`), its items, and the first history row (`null → PENDING`).
6. After the commit: schedule the BullMQ auto-cancel job and emit `order:created` to staff.

### GET /api/v1/orders (US-07)

**Auth:** CUSTOMER

**Query:** `status` (optional `OrderStatus`), `page`, `pageSize`.

**Response 200:** paginated list of the caller's own `Order` objects, newest first (without `history`).

### GET /api/v1/orders/{id} (US-07, US-08)

**Auth:** CUSTOMER

**Response 200:** `Order` with `history`.

**Errors:** 404 `ORDER_NOT_FOUND`, also returned when the order belongs to another customer.

**Notes:** this is the source of truth for the current status. The frontend refetches it after a WebSocket reconnect.

### POST /api/v1/orders/{id}/cancel (US-09)

**Auth:** CUSTOMER (own order)

**Request body (optional)**

```json
{ "note": "Ordered by mistake" }
```

`note`: optional, max 300 chars. The reason code is always `CUSTOMER_REQUEST`.

**Response 200:** updated `Order` (`status: CANCELLED`).

**Errors**

- 404 `ORDER_NOT_FOUND`
- 409 `INVALID_STATUS_TRANSITION`: the order is no longer `PENDING` (e.g. staff already accepted it)

### GET /api/v1/staff/orders (US-10, US-16)

**Auth:** STAFF, ADMIN

**Query parameters**

| Param          | Type          | Rules                                                        |
| -------------- | ------------- | ------------------------------------------------------------ |
| status         | OrderStatus   | optional, may be repeated: `?status=PENDING&status=ACCEPTED` |
| from           | ISO date-time | optional, `created_at >= from`                               |
| to             | ISO date-time | optional, `created_at < to`                                  |
| customerId     | uuid          | optional                                                     |
| sort           | string        | `oldest` (default, for the kitchen queue) or `newest`        |
| page, pageSize | integer       | as usual                                                     |

**Response 200:** paginated staff `Order` objects (with `customer`, without `history`).

### POST /api/v1/staff/orders/{id}/accept (US-11)

**Auth:** STAFF · **Body:** none

**Response 200:** updated staff `Order` (`status: ACCEPTED`).

**Errors**

- 404 `ORDER_NOT_FOUND`
- 409 `INVALID_STATUS_TRANSITION`: the order is not `PENDING` (e.g. the customer cancelled it or it timed out a moment earlier)

**Notes:** implemented as a conditional update (`WHERE status = 'PENDING'`); 0 rows updated → 409. The status change and history row are written in one transaction, then `order:status_changed` is emitted.

### POST /api/v1/staff/orders/{id}/reject (US-11)

**Auth:** STAFF

**Request body**

```json
{ "reasonCode": "KITCHEN_BUSY", "note": "Very busy right now, please try again in 30 minutes" }
```

| Field      | Rules                                                                          |
| ---------- | ------------------------------------------------------------------------------ |
| reasonCode | required: `ITEM_UNAVAILABLE`, `KITCHEN_BUSY`, `RESTAURANT_CLOSING`, or `OTHER` |
| note       | optional, max 300 chars; **required** when `reasonCode` is `OTHER`             |

**Response 200:** updated staff `Order` (`status: REJECTED`, `statusReason` set).

**Errors:** 400 `VALIDATION_ERROR`, 404 `ORDER_NOT_FOUND`, 409 `INVALID_STATUS_TRANSITION`.

### Other transitions

`start-preparing`, `mark-ready` and `complete` follow the same pattern as `accept`: STAFF only, no body, 200 with the updated order, 404 / 409 errors. `complete` also sets `paymentStatus` to `PAID` in the same transaction.

---

## 7. Endpoint Details: Admin

### POST /api/v1/admin/users (US-15)

**Request body**

```json
{ "name": "Kamal P", "email": "kamal@foodflow.lk", "password": "TempPass123", "role": "STAFF" }
```

`role`: `STAFF` or `ADMIN` only. Same field rules as registration.

**Response 201:** `User`. **Errors:** 400, 401, 403, 409 `EMAIL_ALREADY_EXISTS`.

### PATCH /api/v1/admin/users/{id}/role (US-15)

**Body:** `{ "role": "STAFF" }`

**Response 200:** `User`. All of the user's refresh tokens are revoked, so the new role applies from their next login.

**Errors:** 400, 404 `USER_NOT_FOUND`, 409 `CANNOT_MODIFY_SELF` (an admin cannot change their own role).

### PATCH /api/v1/admin/users/{id}/status (US-14)

**Body:** `{ "isActive": false }`

**Response 200:** `User`. Deactivation revokes all the user's refresh tokens. Their current access token stops working on the next request, because the API checks `is_active` on every authenticated request.

**Errors:** 400, 404 `USER_NOT_FOUND`, 409 `CANNOT_MODIFY_SELF`.

### GET /api/v1/admin/users (US-14)

**Query:** `role`, `isActive`, `search` (name or email), `page`, `pageSize`.
**Response 200:** paginated `User` list, newest first.

---

## 8. WebSocket Contract (Socket.IO)

### Connection

```js
io(API_URL, { auth: { token: accessToken } });
```

- The server verifies the JWT in the handshake. Invalid or expired token → connection refused with error `UNAUTHORIZED`.
- The token is checked only at connection time. When the frontend refreshes its access token, it reconnects the socket with the new token.

### Rooms

The client never chooses rooms; the server assigns them on connection:

| Room            | Joined by                             |
| --------------- | ------------------------------------- |
| `user:{userId}` | Every connected user (their own room) |
| `staff`         | Users with role `STAFF` or `ADMIN`    |

### Events (server → client)

**`order:created`** → room `staff`

```json
{
  "orderId": "o9e8...",
  "customerName": "Niroshan S",
  "subtotal": "2850.00",
  "itemCount": 3,
  "createdAt": "2026-10-23T09:30:00Z"
}
```

**`order:status_changed`** → room `user:{customerId}` and room `staff`

```json
{
  "orderId": "o9e8...",
  "previousStatus": "PENDING",
  "status": "CANCELLED",
  "changeSource": "SYSTEM",
  "reason": { "code": "ACCEPTANCE_TIMEOUT", "note": null },
  "changedAt": "2026-10-23T09:45:00Z"
}
```

`reason` is `null` except for `REJECTED` and `CANCELLED`.

### Emitting from the worker

The BullMQ worker has no socket connections. It publishes events through Redis (`@socket.io/redis-emitter`), and the API's Socket.IO server (with `@socket.io/redis-adapter`) delivers them to the right rooms.

### Reconnection rule (US-08)

Events are notifications, not the source of truth. On every `connect` event, including reconnects, the frontend refetches the data on screen through REST (`GET /orders/{id}`, `GET /staff/orders`). Any updates missed while disconnected are recovered this way.

Events are emitted only **after** the database transaction commits, so a client never receives an event for a change that was rolled back.

---

## 9. Design Decisions

**1. Status transitions use one action endpoint per transition** (`POST /staff/orders/{id}/accept`, `/reject`, ...), not a generic `PATCH /orders/{id}/status`.

- Each transition has different permissions (customer cancel vs staff accept) and different bodies (reject needs a reason; accept needs none). Separate endpoints keep each one's validation simple and explicit.
- The endpoints mirror the state machine, so the allowed transitions are visible in the API itself.
- Each action has its own Swagger entry and its own focused tests.
- `POST` is used because these are actions with side effects (history rows, events, payment status), not plain field updates.

**2. Routes are separated by audience** (`/orders` for customers, `/staff/...`, `/admin/...`) rather than one endpoint that changes behaviour by role.

- Each router is mounted with one role middleware, so a missing authorization check on a single endpoint can't expose staff data to customers.
- Customer queries always filter by the caller's ID; staff queries never need to. There is no `if (role === ...)` branching inside handlers.
- Tests are simpler: each endpoint has one expected behaviour per role (allowed or 403).

**3. Two menu endpoints:** `GET /menu-items` (public, active items only, cached) and `GET /staff/menu-items` (all items, including inactive, not cached). This follows from decision 2: the customer endpoint can never leak inactive items through a forgotten filter, and the public endpoint can be cached safely because its result doesn't depend on who is asking.
