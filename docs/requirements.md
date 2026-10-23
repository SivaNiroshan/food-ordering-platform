1.Project overview
FoodFlow is a full-stack food ordering platform for a single restaurant, allowing customers to browse the menu, manage a shopping cart, place pickup orders, and track order progress in real time. Customers pay when collecting their orders at the restaurant. Restaurant staff manage menu items and process orders, while administrators manage user accounts and oversee platform operations.
2.User roles
Customer - Register and log in securely, Browse available menu items and view item details, 
          Add, update, and remove items from the cart, Place orders and view order history,
          Track the status of active orders, Cancel eligible orders.
Restaurant Staff - View incoming orders, Accept or reject orders, Update order status, Manage menu items and their prices and availability
Administrator - View and manage registered users, Manage restaurant staff accounts and permissions, View all orders and their statuses,

3.User stories with acceptance criteria

US-01: Customer Registration
As a customer, I want to create an account so that I can place and manage orders.
Acceptance criteria:
The customer can register with a name, email address, and password.
The email address must be valid and unique.
The password must contain at least 8 characters, including at least one letter and one number
Invalid input produces clear validation messages.
Passwords are securely hashed before being stored.

US-02: Customer Login
As a customer, I want to log in securely so that I can access my account.
Acceptance criteria:
- A registered user can log in with a valid email and password.
- Invalid credentials return a generic error without revealing whether the email exists.
- The access token expires after a configured period.
- An authenticated user can log out, and the client clears its authentication state and stored tokens.
- A valid refresh token can be used to obtain a new access token without logging in again.
- Invalid, expired, or revoked refresh tokens are rejected, requiring the user to log in again.
- Refresh tokens are invalidated on logout, according to the chosen token-storage and revocation strategy.
- Protected endpoints reject requests without a valid access token.
- Customers cannot access staff or administrator functionality.
Implementation note: If you use refresh-token rotation, invalidate the previous refresh token whenever a new one is issued.

US-03: Browse Menu
As a customer, I want to browse the food menu so that I can choose items to order.
Acceptance criteria:
The customer can view available menu items with names, descriptions, prices, and images where available.
Unavailable items are clearly identified and cannot be ordered.
The customer can search for items by name.
Menu data is retrieved from the backend API.

US-04: Filter and View Menu Items
As a customer, I want to filter menu items so that I can find suitable food quickly.
Acceptance criteria:
The customer can filter items by category.
Each item displays its current price and availability.
Empty search results display an appropriate message.

US-05: Manage Shopping Cart
As a customer, I want to manage my cart so that I can prepare an order before checkout.
Acceptance criteria:
The customer can add available menu items to the cart.
The customer can update item quantities or remove items.
Quantities must be positive integers.
Subtotals and the cart total are calculated correctly.
Prices and availability are revalidated by the backend during checkout.

US-06: Place an Order
As a customer, I want to place an order so that the restaurant can prepare my selected food.
Acceptance criteria:
The customer must be authenticated to place an order.
An order must contain at least one valid item.
An order must be above the minimum order price.
The backend calculates the final order total using trusted database prices.
The order and its order items are saved consistently in a database transaction.
The order receives a unique identifier and an initial status.
Duplicate submissions must not unintentionally create duplicate orders.

US-07: View Order History
As a customer, I want to view my previous orders so that I can review my purchases.
Acceptance criteria:
The customer can view their own orders.
Each order displays its identifier, items, total, date, and current status.
A customer cannot access another customer's order history.

US-08: Track Order Status
As a customer, I want to track my order so that I know its progress.
Acceptance criteria:
The customer can view the latest status of an order.
Status updates are delivered in real time when the customer is connected.
The customer can retrieve the current status through the API if real-time updates are missed.
Only authorized restaurant staff can update order status.

US-09: Cancel an Order
As a customer, I want to cancel an eligible order so that I can stop an order I no longer need.
Acceptance criteria:
Cancellation is permitted only while the order is in an eligible state.
Orders that are already being prepared or completed cannot be cancelled by the customer under the MVP policy.
The backend validates cancellation eligibility.
The cancellation is recorded and reflected in the order status.

US-10: View Incoming Orders
As a restaurant staff member, I want to view incoming orders so that I can process customer requests.
Acceptance criteria:
Authorized staff can view orders awaiting processing.
Each order displays its items, unique id, quantities, notes if supported, and total.
Orders can be filtered by status.
Customers cannot access staff-only endpoints.

US-11: Accept or Reject Orders
As a restaurant staff member, I want to accept or reject incoming orders so that I can confirm whether the restaurant can fulfil them.
Acceptance criteria:
Staff can accept an eligible pending order.
Staff can reject an eligible pending order and provide a reason.
Invalid status transitions are rejected.
The resulting status is persisted and made available to the customer.

US-12: Update Preparation Status
As a restaurant staff member, I want to update preparation progress so that customers know when their food is ready.
Acceptance criteria:
Accepted orders can move to the preparation state.
Orders can move from preparation to ready for collection.
Invalid transitions are rejected by the backend.
Status changes are recorded and communicated to the customer.

US-13: Manage Menu Items
As a restaurant staff member, I want to manage menu items so that customers see accurate menu information.
Acceptance criteria:
Authorized staff can create and update menu items.
Staff can update item prices, descriptions, categories, and availability.
Prices cannot be negative.
Invalid input is rejected with clear validation messages.
Menu changes are reflected in subsequent menu requests.

US-14: Manage Users
As an administrator, I want to manage user accounts so that I can maintain platform integrity.
Acceptance criteria:
Administrators can view registered users.
Administrators can deactivate or reactivate accounts.
Deactivated users cannot authenticate or perform protected actions.
Only administrators can access user-management endpoints.

US-15: Manage Staff Accounts
As an administrator, I want to manage restaurant staff accounts so that access is restricted to authorized personnel.
Acceptance criteria:
Administrators can create or assign staff accounts.
Administrators can change authorized account roles or deactivate staff accounts.
Customers cannot assign themselves elevated roles.
Role changes are enforced by the backend on subsequent requests.

US-16: View All Orders
As an administrator, I want to view all platform orders so that I can oversee order processing.
Acceptance criteria:
Administrators can view orders across all customers.
Orders can be filtered by status and date.
Order details include the customer reference, items, total, and status.
Only authorized administrators can access the complete order list.

US-17: Auto-cancel unaccepted orders
As the system, I want to cancel orders that staff don’t accept within 15 minutes, so that customers aren’t left waiting.
A delayed job is scheduled when an order is placed.
If the order is still PENDING when the job runs, it becomes CANCELLED with the reason “Not accepted in time.”
If staff already acted on the order, the job does nothing.
The customer is notified in real time.

US-18: Complete a Collected Order
As a restaurant staff member, I want to mark an order as completed after the customer collects it so that the order lifecycle is accurately recorded.
Acceptance criteria:
Staff can mark an order as COMPLETED only when its current status is READY.
The backend validates the current status before completing the order.
The completed status is persisted in the database.
The customer can see the updated status in their order history and order tracking view.
Attempts to complete an order in any other status are rejected.

US-19: Manage menu categories
As an admin, I want to create, view, update, and deactivate menu categories so that menu items can be organized and customers can filter the menu by category.
Acceptance criteria:
- Admins can create a category with a required name.
- Category names must be unique, ignoring case and leading/trailing whitespace.
- Admins can view all categories and update a category’s name.
- Admins can deactivate a category so it no longer appears as an available customer-facing filter.
- Existing menu items assigned to a deactivated category remain stored; the system must handle their visibility consistently.
- Categories assigned to existing menu items cannot be hard-deleted; admins must deactivate them instead.
- Only admins can manage categories.
- Customers can filter menu items by active category, as specified in US-04.
- when a category is deactivated,  its existing menu items should remain visible without a category filter

4. Order Status State Machine
   
4.1 Order Statuses

Status          Description
PENDING          The order has been placed and awaits restaurant action.
ACCEPTED         The restaurant has accepted the order.
PREPARING        The restaurant is preparing the order.
READY            The order is ready for customer collection.
COMPLETED        The customer has collected the order.
REJECTED         The restaurant has rejected the order.
CANCELLED        The customer or system has cancelled the pending order.

4.2 Allowed Transitions

From          To          Authorized actor
PENDING          ACCEPTED          Restaurant staff
PENDING          REJECTED          Restaurant staff
PENDING          CANCELLED         Customer or system timeout handler
ACCEPTED         PREPARING         Restaurant staff
PREPARING        READY             Restaurant staff
READY            COMPLETED         Restaurant staff, after collection

4.3 Transition Rules

Any transition not explicitly listed in the allowed transitions table must be rejected.
The backend must verify both the current status and the requesting actor's authorization.
A status update must be persisted before it is reported as successful.
Concurrent requests must not cause invalid transitions or overwrite a newer status.
Terminal statuses are COMPLETED, REJECTED, and CANCELLED. Orders in these states cannot transition to another status.
System-triggered cancellation applies only to PENDING orders that exceed a configured timeout. The timeout mechanism is a later enhancement unless explicitly added to the MVP.
Each successful status transition should record the previous status, new status, timestamp, and actor for auditing.

4.4 State Machine Testing Requirements

Automated tests must verify:
Every allowed transition succeeds for an authorized actor.
Every unlisted transition is rejected.
Unauthorized actors cannot perform status changes.
A customer cannot cancel an order belonging to another customer.
Completed, rejected, and cancelled orders cannot be reopened.
Concurrent status updates cannot result in an invalid final state.

5.Non-functional requirements
NFR-01: Security
Passwords must be hashed using a suitable password-hashing algorithm.
Authentication and role-based authorization must be enforced on the backend.
Input must be validated and database queries must use safe parameterization or ORM protections.
Secrets and credentials must be stored in environment variables, not committed to Git.
Sensitive customer information must not be exposed in API responses or logs.

NFR-02: Performance
Under the agreed local development test conditions, common API requests should normally complete within 500 ms at the 95th percentile, excluding external services.
Menu endpoints should support pagination where appropriate.
Database queries should use appropriate indexes for frequently queried fields.

NFR-03: Reliability and Data Integrity
Order creation must use database transactions to prevent partially saved orders.
The backend must validate prices, quantities, availability, and status transitions.
Failures must produce consistent error responses without exposing internal details.

NFR-04: Maintainability
Backend code must follow a modular structure with clear separation of routes, controllers, services, and data access.
Business rules must be implemented in reusable service modules.
Environment-specific configuration must be separated from application code.

NFR-05: Testability
Unit tests must cover important business logic.
Integration tests must cover authentication, authorization, and core order APIs.
Tests must cover invalid input, failed transactions, and unauthorized access.
Critical order-processing flows must have automated regression tests.

NFR-06: Scalability
The application must use stateless API instances where practical.
Database connection pooling and pagination must be configured appropriately.
Redis caching and BullMQ-based asynchronous processing.

NFR-07: Observability
The application must record useful operational errors and important order-processing events.
Logs must include relevant request or order correlation identifiers where practical.
Passwords, access tokens, and other secrets must never be written to logs.

NFR-08: Usability and Accessibility
The user interface must be responsive on desktop and mobile screens.
Forms must provide clear validation and error messages.
Important actions must show their current state and outcome.
Core navigation and forms should support keyboard access and accessible labels.

6.MVP scope vs. later scope
6.1 MVP scope
The MVP will focus on a complete ordering workflow for a single restaurant.

Customer features
Registration and login.
Menu browsing, searching, and category filtering.
Cart management using Zustand and localStorage.
Optional order notes of up to 250 characters.
Pickup order placement and pay-on-collection instructions
Order history and status viewing.
Cancellation of PENDING orders
Socket.IO for real-time order status updates.

Restaurant staff features
View incoming orders.
Accept or reject pending orders.
Update preparation status.
Mark orders ready for collection.
Mark collected orders as completed.
Record payment received at collection.
Create, edit, and deactivate menu items

Administrator features
View and manage user accounts.
Manage staff accounts and roles.
View and filter all orders.

Technical requirements
React frontend with a Node.js and Express.js TypeScript REST API.
PostgreSQL database with Prisma ORM.
Zustand and localStorage for frontend cart state.
JWT-based authentication and role-based authorization.
Backend validation and consistent error handling.
Explicit order status state machine with validated transitions.
Separate order and payment statuses.
Transactional order creation and server-side price calculation.
Automated tests for core workflows.
API documentation with Swagger/OpenAPI.
Docker-based local development and a clear README.
CI/CD pipeline and production deployment.
Automatic cancellation of pending orders after a configured timeout.

6.2later scope

Payment gateway integration and verified payment webhooks.
Email notifications for order updates.
Inventory tracking and low-stock alerts.
Discounts, coupons, and promotional campaigns.
Customer ratings and reviews.
Analytics dashboards and order reports.
More advanced monitoring and performance testing.

7.Out of scope 

Multiple restaurants, restaurant discovery, and multi-restaurant carts.
Delivery driver assignment, GPS tracking, and live delivery maps.
Complex delivery-zone and distance-based pricing.
Real-money payment processing.
Refund processing and payment dispute management.
Loyalty points and subscription programs.
AI-powered recommendations and chatbots.
Native Android or iOS applications.
Microservices architecture and Kubernetes deployment.
