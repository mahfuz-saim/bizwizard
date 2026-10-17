# Real-time notifications

## Setup

Set `NOTIFICATION_WEBHOOK_SECRET` in the server's environment to a long random secret, then restart the API. Keep this value server-side; never put it in a `NEXT_PUBLIC_*` variable. Configure the sending service to POST to:

```
https://YOUR_API_HOST/api/v1/notifications/webhook
```

Use HTTPS in production. This endpoint uses a dedicated bearer secret, not a user's login token. An unset secret disables the webhook with HTTP 503; invalid credentials return 401.

Example (replace the shop/tenant IDs with IDs from your database):

```bash
curl --fail-with-body "$API_URL/api/v1/notifications/webhook" \
  -H "Authorization: Bearer $NOTIFICATION_WEBHOOK_SECRET" \
  -H 'Content-Type: application/json' \
  --data '{
    "eventId": "inventory-low-stock-2026-10-17-001",
    "tenantId": "YOUR_TENANT_ID",
    "shopId": "YOUR_SHOP_ID",
    "title": "Low stock alert",
    "body": "Only 3 units remain. Please restock."
  }'
```

All five fields are required. The shop must belong to the tenant. Title/body limits are 200/5,000 characters. Notifications are persisted even when nobody is connected and without Firebase/device registration. `eventId` must uniquely identify an event within a tenant: retries return the same notification instead of inserting duplicates. The first payload wins; use a new event ID for a new notification. A 200 response confirms persistence. Retry network/5xx failures with the same event ID.

## Browser delivery and UI

- The browser opens `GET /api/v1/notifications/stream/:shopId` through the existing same-origin Next.js proxy. Fetch streaming keeps JWT and tenant credentials in headers, not query strings.
- The API sends SSE `data:` frames containing notification snapshots, including the current user's `ReadStatus`. Webhooks trigger immediate reconciliation on the receiving server. A two-second database reconciliation interval catches writes from other instances, existing notification producers, and read changes from other tabs. This also avoids relying on an in-memory queue for delivery.
- The browser reconnects with exponential backoff (up to 30 seconds). Seen notification IDs prevent repeated toasts within the session. Existing history is not toasted on initial page load. Unseen notifications received after a temporary disconnection are toasted.
- New unread notifications appear at the bottom right for **2 seconds**, then remain in the bell's newest-first list. Dismissing a toast does not mark the notification read.
- The bell has a red dot only while unread items exist. Users can mark an individual notification or all current notifications read. Read state persists on the server.
- `POST /api/v1/notifications/mark-read/:notificationId` requires a JSON body `{ "shopId": "..." }`, the login bearer token, and `x-tenant-id`. Repeating the call is safe.
- Notification history, streaming, and marking read enforce tenant/user/shop visibility. Employees must be assigned to the requested shop. Streams close on JWT expiry, and each reconciliation rechecks shop access.
- Demo mode remains local: no webhook connection or fabricated live notifications.

Allow long-lived streaming requests at your reverse proxy/load balancer. Disable response buffering for the stream route (the API also sends `X-Accel-Buffering: no` and `Cache-Control: no-cache, no-transform`). The current design reads notification history per connection every two seconds; for a large deployment, replace reconciliation with a shared event broker and paginate history.

No database migration is required; existing `Notification` and `NotificationRead` tables are used. Existing mobile FCM delivery is unchanged; webhook notifications are a separate persisted web flow and do not send FCM pushes.

## Analysis and reports

Desktop and mobile navigation now use **Analysis & Reports**. The page has Financial Analysis and Reports tabs; Reports retains Sales, Inventory, and Profit & Loss views. The old `/reports` URL redirects to `/finance/analysis?tab=reports`. Report export and detailed inventory analytics retain their existing disabled/placeholder behavior.

## Verification

```bash
cd client && npm test && npm run build
cd ../server && npm run test:notifications && npm test
```

The notification router test uses an in-memory persistence adapter and real HTTP requests to check webhook authentication/validation, idempotent retries, tenant isolation, SSE delivery, and read status. Client tests cover fragmented UTF-8/SSE frames, unread detection, deduplication, and the two-second toast duration setting. Run with your actual database and proxy before deploying to verify end-to-end infrastructure behavior.
