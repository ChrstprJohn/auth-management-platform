# Realtime Server + Centrifugo Docker Management Reference

A practical reference for operating the reusable realtime system on the Azure VM through Docker Compose.

> **Infrastructure:** Azure VM + Ubuntu 22.04 + Docker Compose
> **Root directory:** ~/realtime/
> **Components:** Centrifugo + Node.js realtime-server
> **Docker network:** app_network
> **Centrifugo internal port:** 8000
> **Realtime-server internal port:** 3000
> **Public realtime host:** https://realtime.chrbuilds.dev
> **Public WebSocket:** wss://realtime.chrbuilds.dev/connection/websocket
> **Public host ports:** only Caddy's 80 and 443

This document contains no actual secrets. Replace placeholders only in the VM-local files where noted.

---

# 1. What This System Does

Centrifugo is the realtime engine. It maintains WebSocket connections, tracks subscriptions, and delivers published events to the clients subscribed to the matching channel.

The realtime-server is the reusable control API around Centrifugo. It creates client JWTs and translates a simple application request into a Centrifugo HTTP API publish call.

Individual applications remain responsible for:

- user authentication
- business logic
- database writes
- deciding when an event happened
- choosing the event type and channel
- deciding what the frontend should do when it receives the event

The basic flow is:

~~~text
User opens an application
        │
        ▼
Frontend requests an authenticated realtime token
        │
        ▼
Application backend → realtime-server:3000/token
        │
        ▼
Frontend connects to wss://realtime.chrbuilds.dev/connection/websocket
        │
        ▼
Frontend subscribes to an authorized application channel
        │
        │ later: a business event happens
        ▼
Application backend → realtime-server:3000/publish
        │
        ▼
realtime-server → http://centrifugo:8000/api
        │
        ▼
Centrifugo publishes to the matching subscribers
~~~

Centrifugo does not poll an application's database and does not understand what an event type means. The application tells the realtime system when to publish; the frontend decides how to handle the received event.

---

# 2. Directory Structure

The complete system lives under one VM directory:

~~~text
~/realtime/
├── centrifugo/
│   ├── config.json
│   └── docker-compose.yml
└── server/
    ├── .env
    ├── Dockerfile
    ├── docker-compose.yml
    ├── package.json
    └── src/
        └── index.js
~~~

The two services are separate Compose projects:

~~~text
~/realtime/centrifugo  → Centrifugo engine
~/realtime/server      → reusable application-facing API
~~~

Do not put application business logic inside either service. App-specific logic belongs in the individual app backend.

---

# 3. Components and Responsibilities

## Centrifugo

Container:

~~~text
centrifugo
~~~

Centrifugo is responsible for:

- accepting browser/app WebSocket connections
- validating client connection JWTs
- managing channel subscriptions
- finding current subscribers
- delivering publications to matching subscribers
- presence and join/leave events when enabled
- short in-memory channel history when enabled
- serving its HTTP API, admin UI, and health endpoint on port 8000

The current setup uses one Centrifugo instance for multiple applications. Applications are logically separated through channel naming and authorization.

## Realtime server

Container:

~~~text
realtime-server
~~~

The current Node.js service is responsible for:

- GET /health — service health check
- POST /token — sign a one-hour Centrifugo client JWT
- POST /publish — publish one event to one Centrifugo channel
- calling Centrifugo's internal HTTP API with the configured API key
- keeping Centrifugo-specific server credentials away from browser code

The service currently listens on 0.0.0.0:3000 inside its container. Port 3000 is not published to the VM host.

## Application backend

An app backend is responsible for:

- authenticating the application user
- requesting a realtime token only after it knows the real user identity
- publishing events after the relevant business operation succeeds
- choosing channels owned by that application
- protecting its own app-to-realtime requests

An app backend on the same Docker network calls:

~~~text
http://realtime-server:3000
~~~

## Frontend client

The frontend is responsible for:

- obtaining a token through the app's authenticated backend flow
- connecting to the public WebSocket URL
- subscribing to channels it is authorized to use
- handling publication payloads by their type
- reconnecting and refreshing tokens when required
- reloading authoritative application data after reconnect when necessary

---

# 4. Network and Address Map

| Caller | Destination | Address | Purpose |
|---|---|---|---|
| Browser/app client | Caddy → Centrifugo | wss://realtime.chrbuilds.dev/connection/websocket | WebSocket connection |
| Caddy | Centrifugo | centrifugo:8000 | Reverse proxy target |
| App backend on app_network | Realtime server | http://realtime-server:3000 | Token and publish requests |
| Realtime server | Centrifugo | http://centrifugo:8000/api | Internal Centrifugo API calls |
| Operator inside realtime-server | Realtime server | http://127.0.0.1:3000 | Local container health/testing |

The internal and public Centrifugo addresses are intentionally different:

| Use case | Address |
|---|---|
| Browser/client connection | wss://realtime.chrbuilds.dev/connection/websocket |
| Server-to-Centrifugo API call | http://centrifugo:8000/api |

Do not configure the realtime server to call the public hostname from inside Docker. Using the Docker service name avoids an unnecessary trip through Caddy and the public TLS path.

Do not use localhost from one container to reach another container. In a container, localhost means that same container.

---

# 5. Centrifugo Configuration

## Location

~~~bash
cd ~/realtime/centrifugo
~~~

The configuration is mounted read-only into the container:

~~~text
/centrifugo/config.json
~~~

The VM-local file is the source of truth. Do not paste its contents into chat, documentation, GitHub, or browser-side code.

## Functional configuration areas

The active configuration contains functional areas similar to:

~~~text
client.token.hmac_secret_key           = <GENERATED_HMAC_SECRET>
client.allowed_origins                 = <APP_BROWSER_ORIGINS>
admin.enabled                          = true
admin.password                         = <GENERATED_ADMIN_PASSWORD>
admin.secret                           = <GENERATED_ADMIN_SECRET>
http_api.key                           = <GENERATED_HTTP_API_KEY>
health.enabled                         = true
channel.without_namespace.presence     = true
channel.without_namespace.join_leave   = true
channel.without_namespace.history_size = 10
channel.without_namespace.history_ttl  = 300s
~~~

The secret values above are placeholders only.

Current development browser origins discussed in the setup were:

~~~text
http://localhost:3000
http://localhost:5173
~~~

Add the actual deployed application origins when they are known. An allowed origin is the browser application's origin; it is not automatically the realtime hostname.

## Compose shape

The deployed Compose file is authoritative. Its important shape is:

~~~yaml
services:
  centrifugo:
    image: centrifugo/centrifugo:v6
    container_name: centrifugo
    restart: unless-stopped
    command: centrifugo -c /centrifugo/config.json
    volumes:
      - ./config.json:/centrifugo/config.json:ro
    networks:
      - app_network

networks:
  app_network:
    external: true
~~~

The runtime previously reported version 6.9.3; verify the actual image tag and running version on the VM before documenting or changing it.

There is no public 8000:8000 host mapping. Caddy reaches the container through app_network.

---

# 6. Realtime-server Environment

## Location

~~~bash
cd ~/realtime/server
~~~

The VM-local .env contains:

~~~env
PORT=3000
CENTRIFUGO_URL=http://centrifugo:8000
CENTRIFUGO_JWT_SECRET=<KEEP_CURRENT_CENTRIFUGO_HMAC_SECRET_PRIVATE>
CENTRIFUGO_API_KEY=<KEEP_CURRENT_CENTRIFUGO_HTTP_API_KEY_PRIVATE>
~~~

Never commit this file or expose the placeholder values' real replacements.

## Environment variable reference

| Variable | Meaning | Matching Centrifugo setting |
|---|---|---|
| PORT | Internal Node.js listener; currently 3000 | None |
| CENTRIFUGO_URL | Internal service URL; currently http://centrifugo:8000 | Container/service name and port |
| CENTRIFUGO_JWT_SECRET | Signs client connection JWTs | client.token.hmac_secret_key |
| CENTRIFUGO_API_KEY | Authenticates HTTP API requests from the server | http_api.key |

These two secrets have different purposes:

~~~text
CENTRIFUGO_JWT_SECRET
  realtime-server signs a client JWT
  Centrifugo verifies that client JWT

CENTRIFUGO_API_KEY
  realtime-server authenticates a server-side HTTP API request
  Centrifugo accepts publish/control calls
~~~

Do not swap them.

View only non-secret entries:

~~~bash
cd ~/realtime/server
grep -E '^(PORT|CENTRIFUGO_URL)=' .env
~~~

A command that renders the complete Compose configuration can include secret environment values. Run it only in a private terminal and do not copy the output into chat or source control.

---

# 7. Realtime-server API

The current application-facing contract is intentionally small.

## GET /health

Purpose: verify that the Node.js realtime server is alive.

Request:

~~~http
GET /health
~~~

Expected response:

~~~json
{
  "status": "ok",
  "service": "realtime-server"
}
~~~

This checks the realtime-server process. It does not by itself prove that Centrifugo or the public WebSocket path is working.

## POST /token

Purpose: create a Centrifugo connection JWT for a user.

Request:

~~~http
POST /token
Content-Type: application/json
~~~

~~~json
{
  "userId": "user-123"
}
~~~

Response shape:

~~~json
{
  "token": "eyJ..."
}
~~~

The current implementation signs an HS256 token with:

- sub set to the supplied user ID
- an expiration of one hour

The token is then used by the frontend when connecting to Centrifugo.

Validation:

- missing, null, or blank userId returns HTTP 400
- the returned token is a credential; do not log or share it

Security status:

> The current test implementation accepts userId from the request body and does not yet authenticate the caller. Use it only from a trusted internal path during testing. Before production, the app backend must authenticate the user and the realtime server must authenticate the app backend.

## POST /publish

Purpose: send one event to every currently subscribed client on one channel.

Request:

~~~http
POST /publish
Content-Type: application/json
~~~

~~~json
{
  "channel": "app1:user:123",
  "data": {
    "type": "task_assigned",
    "taskId": 456,
    "title": "Finish homepage"
  }
}
~~~

The realtime server transforms that request into an internal Centrifugo API call equivalent to:

~~~json
{
  "method": "publish",
  "params": {
    "channel": "app1:user:123",
    "data": {
      "type": "task_assigned",
      "taskId": 456,
      "title": "Finish homepage"
    }
  }
}
~~~

The Centrifugo API request uses:

~~~http
Authorization: apikey <CENTRIFUGO_API_KEY>
~~~

Response shape on success:

~~~json
{
  "success": true,
  "result": {}
}
~~~

Validation and errors:

- missing or blank channel returns HTTP 400
- missing data returns HTTP 400
- a Centrifugo timeout returns HTTP 504
- another Centrifugo API failure returns HTTP 502
- the server logs error metadata, not the API key or event credential

publish does not:

- query or update an application database
- open a new WebSocket connection
- decide what an event type means
- select a user by itself
- guarantee delivery to a client that is offline
- authorize a channel merely because its name has an application prefix

It sends the payload to Centrifugo, and Centrifugo delivers it to matching active subscribers.

---

# 8. Usage Examples

## App backend requests a token

The app backend should use the authenticated user identity from its own session or access token.

~~~js
const response = await fetch("http://realtime-server:3000/token", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer APP_TO_REALTIME_CREDENTIAL"
  },
  body: JSON.stringify({ userId: authenticatedUser.id })
});

const { token } = await response.json();
~~~

The Authorization header above describes the production requirement. The current test server does not yet validate that header.

The app should return the token to its own authenticated frontend route rather than exposing the realtime server as a public unauthenticated token-minting endpoint.

## App backend publishes an event

Publish only after the business operation succeeds:

~~~js
await saveTaskAssignmentToDatabase();

await fetch("http://realtime-server:3000/publish", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer APP_TO_REALTIME_CREDENTIAL"
  },
  body: JSON.stringify({
    channel: "app1:user:123",
    data: {
      type: "task_assigned",
      taskId: 456,
      title: "Finish homepage"
    }
  })
});
~~~

The actual event body can contain any JSON structure your application defines. Keep a stable type field so the frontend can route the event to the correct handler.

## Frontend connects and subscribes

Using the Centrifuge JavaScript client:

~~~js
import { Centrifuge } from "centrifuge";

const tokenResponse = await fetch("/api/realtime/token");
const { token } = await tokenResponse.json();

const client = new Centrifuge(
  "wss://realtime.chrbuilds.dev/connection/websocket",
  { token }
);

const subscription = client.newSubscription("app1:user:123");

subscription.on("publication", (context) => {
  const event = context.data;

  if (event.type === "task_assigned") {
    // Refresh or update the task UI.
  }

  if (event.type === "message_received") {
    // Show the new message.
  }
});

subscription.on("error", (error) => {
  console.error("Realtime subscription error", error);
});

subscription.subscribe();
client.connect();
~~~

The frontend should not contain:

- CENTRIFUGO_JWT_SECRET
- CENTRIFUGO_API_KEY
- Centrifugo admin credentials
- the server-side Centrifugo URL
- unrestricted token-minting logic

---

# 9. End-to-end Event Flow

Example: a task is assigned to user 123.

~~~text
1. User 123 opens App 1.
2. App 1 authenticates the user.
3. App 1's backend obtains a token through the private realtime-server API.
4. The browser connects to the public Centrifugo WebSocket URL with that token.
5. The browser subscribes to app1:user:123.
6. An App 1 business operation assigns a task.
7. App 1 saves the task in its database.
8. App 1 sends POST /publish to the realtime-server.
9. The realtime-server calls http://centrifugo:8000/api.
10. Centrifugo finds active subscribers to app1:user:123.
11. Centrifugo pushes the publication over the existing WebSocket.
12. App 1's frontend receives data.type = task_assigned.
13. The frontend updates its UI or refetches authoritative task data.
~~~

One event does not create one new WebSocket connection. The client keeps one connection open and can receive many event types through its authorized subscriptions.

If the client is offline, there is no active WebSocket to receive the immediate publication. The current short history settings may help with limited recovery, but application databases remain the source of truth.

---

# 10. Channel Naming and Authorization

## Naming convention

Use application-prefixed names:

~~~text
<application>:<scope>:<identifier>
~~~

Examples:

~~~text
app1:user:123
app1:notifications
app1:chat:456
app1:team:789
app2:user:55
app2:company:22
~~~

The prefix prevents accidental naming collisions and makes ownership visible. It is an organization convention, not a security boundary.

## Recommended ownership rules

| Channel type | Intended subscribers |
|---|---|
| app1:user:123 | User 123 and explicitly authorized sessions/devices |
| app1:chat:456 | Members of chat 456 |
| app1:team:789 | Members of team 789 |
| app1:notifications | Only the application clients authorized for that stream |
| app2:* | App 2 clients; never App 1 by convention alone |

Before a production app is connected, configure and test the channel authorization mechanism you intend to use. The current user JWT identifies the connection through its sub claim, but the current small server does not automatically prove that the user may subscribe to every channel they name.

The earlier test-channel subscription test returned permission denied after a successful JWT connection. That means:

- WebSocket connectivity worked
- JWT validation worked
- the client was authenticated
- the channel subscription was not authorized

A channel prefix alone must never be treated as permission to listen to another user's channel.

## Publish authorization

The publisher must also be authorized. An app backend should not be able to publish to another application's channels simply by changing the string:

~~~text
app1:user:123
~~~

to:

~~~text
app2:user:55
~~~

Before production, validate application ownership, allowed channel prefixes, payload size, and event shape at the app-to-realtime boundary.

---

# 11. Security Model

## Credential separation

| Credential | Used by | Verified/consumed by | Never expose to |
|---|---|---|---|
| Centrifugo client HMAC secret | realtime-server | Centrifugo JWT verifier | Browser, app bundle, GitHub |
| Centrifugo HTTP API key | realtime-server | Centrifugo HTTP API | Browser, app bundle, GitHub |
| Centrifugo admin password/secret | Administrator | Centrifugo admin interface | Application clients, GitHub |
| App-to-realtime credential | App backend | Realtime-server auth middleware | Browser unless it is a scoped user credential |

## Current security boundary

The current Docker layout provides a network boundary:

- Centrifugo is reachable publicly through Caddy for client WebSocket traffic.
- realtime-server:3000 is not published to the VM host.
- Server-to-server traffic stays on app_network.
- Centrifugo's HTTP API key stays inside the realtime-server environment.
- MongoDB and PostgreSQL remain separate private services.

However, the current /token and /publish implementation does not yet enforce application authentication. Any caller that can reach the private container endpoint could attempt those operations.

Treat the current setup as a working development/test foundation until the following protections are implemented.

## Production readiness checklist

- Authenticate the app backend before allowing /token.
- Do not trust an arbitrary browser-supplied userId.
- Authenticate /publish with an app-specific secret, signed service token, mTLS, or an equivalent trusted mechanism.
- Restrict which application prefixes each app may publish to.
- Validate channel shape, payload size, and event type.
- Rate-limit token and publish requests.
- Allow only real application origins in Centrifugo's client origin list.
- Keep the Centrifugo admin interface protected and restrict administrative access.
- Use HTTPS/WSS for public client traffic.
- Rotate any secret that has previously been pasted into a terminal transcript or chat.
- Keep secrets in VM-local environment/configuration or a proper secret manager.
- Do not log JWTs, API keys, admin credentials, or full sensitive event payloads.
- Treat application databases as authoritative; realtime messages are delivery notifications, not durable storage.

---

# 12. Container Management

## Check the shared network

~~~bash
docker network inspect app_network
~~~

Both realtime containers must appear on app_network:

~~~text
centrifugo
realtime-server
~~~

If the external network does not exist, create it only as part of the VM's intended infrastructure setup:

~~~bash
docker network create app_network
~~~

Check first; do not create a duplicate network with a similar name.

## Start Centrifugo

~~~bash
cd ~/realtime/centrifugo
docker compose ps
docker compose up -d
docker compose ps
~~~

## Start the realtime server

~~~bash
cd ~/realtime/server
docker compose ps
docker compose up -d
docker compose ps
~~~

## Stop or restart

Stop without removing the container:

~~~bash
cd ~/realtime/centrifugo
docker compose stop

cd ~/realtime/server
docker compose stop
~~~

Restart:

~~~bash
cd ~/realtime/centrifugo
docker compose restart

cd ~/realtime/server
docker compose restart
~~~

Remove and recreate the containers without touching application database data:

~~~bash
cd ~/realtime/centrifugo
docker compose down
docker compose up -d

cd ~/realtime/server
docker compose down
docker compose up -d
~~~

The realtime-server has no persistent application data volume. Do not add -v casually to cleanup commands; it is unnecessary for this service and can remove named volumes if the Compose file changes later.

## Logs

~~~bash
docker logs centrifugo --tail 50
docker logs realtime-server --tail 50
~~~

Follow one service:

~~~bash
docker logs -f centrifugo
~~~

or:

~~~bash
docker logs -f realtime-server
~~~

Stop following logs with Ctrl+C.

Expected realtime-server startup log:

~~~text
Realtime server listening on :3000
~~~

Expected Centrifugo startup log includes:

~~~text
serving websocket, api, admin, health endpoints on :8000
~~~

---

# 13. Configuration Validation

## Validate Centrifugo

~~~bash
cd ~/realtime/centrifugo
docker run --rm \
  -v "$PWD:/centrifugo" \
  centrifugo/centrifugo:v6 \
  centrifugo checkconfig -c /centrifugo/config.json
~~~

Use the image tag from the deployed Compose file if it differs from v6.

Then recreate the service:

~~~bash
cd ~/realtime/centrifugo
docker compose up -d
docker logs centrifugo --tail 50
~~~

## Validate the realtime-server

A safe operational check is:

~~~bash
cd ~/realtime/server
docker compose ps
docker logs realtime-server --tail 50
docker inspect realtime-server --format '{{.State.Status}}'
docker inspect realtime-server --format '{{json .NetworkSettings.Networks}}'
~~~

Do not copy the output of a fully rendered Compose configuration into documentation because the environment section may contain the two Centrifugo secrets.

---

# 14. Deployment and Update Workflow

## Centrifugo image or configuration update

~~~bash
cd ~/realtime/centrifugo
docker compose pull
docker compose up -d
docker compose ps
docker logs centrifugo --tail 50
~~~

If config.json changes, validate it before recreating the container.

## Realtime-server source or Dockerfile update

~~~bash
cd ~/realtime/server
docker compose build --pull
docker compose up -d
docker compose ps
docker logs realtime-server --tail 50
~~~

The VM does not need Node.js installed on the host. The Docker image contains Node.js and the npm dependencies.

## Realtime-server environment update

When only .env changes:

~~~bash
cd ~/realtime/server
docker compose up -d
docker compose ps
docker logs realtime-server --tail 50
~~~

Recreating the container makes Compose load the updated environment.

## Safe release order

For a coordinated realtime release:

~~~text
1. Back up the VM-local configuration if changing secrets or Centrifugo settings.
2. Validate Centrifugo configuration.
3. Update/recreate Centrifugo if needed.
4. Build and recreate realtime-server.
5. Check both containers and their network membership.
6. Test /health.
7. Test server → Centrifugo connectivity.
8. Test token generation without sharing the JWT.
9. Run an authorized WebSocket subscription test.
10. Run /publish and verify the subscriber receives the event.
~~~

---

# 15. Health and Connectivity Tests

## Realtime-server health

Run from the VM:

~~~bash
docker exec realtime-server wget -qO- \
  http://127.0.0.1:3000/health
~~~

Expected:

~~~json
{"status":"ok","service":"realtime-server"}
~~~

This is the correct test when port 3000 is not published to the VM host.

A host-side request such as curl http://localhost:3000/health is expected to fail in the current design because the server is private to Docker.

## Realtime-server → Centrifugo

~~~bash
docker exec realtime-server wget -qO- \
  http://centrifugo:8000/
~~~

A normal Centrifugo HTML or HTTP response confirms Docker DNS and network reachability. It does not expose the HTTP API key.

## Public Caddy route

~~~bash
curl -I https://realtime.chrbuilds.dev
~~~

This checks DNS, TLS, Caddy, and the public Centrifugo route. The root response is not the same as a successful authenticated WebSocket subscription.

## Token generation

Run only in a private VM terminal:

~~~bash
docker exec realtime-server wget -qO- \
  --header="Content-Type: application/json" \
  --post-data='{"userId":"YOUR_TEST_USER_ID"}' \
  http://127.0.0.1:3000/token
~~~

The output contains a real JWT. Do not paste it into chat, source control, screenshots, tickets, or this document.

## Publish request

For an internal smoke test:

~~~bash
docker exec realtime-server wget -qO- \
  --header="Content-Type: application/json" \
  --post-data='{"channel":"AUTHORIZED_TEST_CHANNEL","data":{"type":"test","message":"Hello from realtime-server"}}' \
  http://127.0.0.1:3000/publish
~~~

A successful response proves that the realtime-server accepted the request and received a successful response path from Centrifugo. It does not prove that a client was subscribed or received the message.

---

# 16. WebSocket and Publish Test

A complete test needs all parts:

~~~text
authorized JWT
    ↓
WebSocket connection
    ↓
authorized channel subscription
    ↓
/publish request
    ↓
publication received by the subscriber
~~~

## Start a temporary WebSocket client

This avoids installing Node.js or wscat on the VM host:

~~~bash
docker run --rm -it --network app_network node:22-alpine sh
~~~

Inside that temporary container:

~~~bash
npm install -g wscat
wscat -c wss://realtime.chrbuilds.dev/connection/websocket
~~~

When the > prompt appears, send a fresh token immediately:

~~~json
{"id":1,"connect":{"token":"YOUR_FULL_JWT"}}
~~~

A successful response proves that:

- the public Caddy route works
- the WebSocket upgrade works
- the JWT signature matches the Centrifugo HMAC secret
- Centrifugo authenticated the connection

Then request a channel subscription:

~~~json
{"id":2,"subscribe":{"channel":"AUTHORIZED_TEST_CHANNEL"}}
~~~

Use a channel that is actually authorized in the current Centrifugo configuration. If the response is permission denied, the JWT connection can still be valid; the channel authorization is the part that failed.

## Publish from another terminal

Leave the WebSocket client open and run:

~~~bash
docker exec realtime-server wget -qO- \
  --header="Content-Type: application/json" \
  --post-data='{"channel":"AUTHORIZED_TEST_CHANNEL","data":{"type":"test","message":"Hello from realtime-server"}}' \
  http://127.0.0.1:3000/publish
~~~

The subscriber should receive a publication containing:

~~~json
{
  "type": "test",
  "message": "Hello from realtime-server"
}
~~~

This proves:

~~~text
App-style publish request
        ↓
realtime-server /publish
        ↓
Centrifugo HTTP API
        ↓
authorized channel
        ↓
WebSocket subscriber
~~~

---

# 17. Troubleshooting

| Symptom | Meaning or next check |
|---|---|
| curl localhost:3000 from the VM fails | Expected while the realtime-server has no host port mapping; use docker exec or an app container on app_network. |
| GET /health fails inside realtime-server | Check docker logs realtime-server, container status, and the Node listener. |
| realtime-server cannot resolve centrifugo | Inspect both containers with docker network inspect app_network; both Compose projects must attach to the same external network. |
| /publish returns 502 | Check Centrifugo status/logs, CENTRIFUGO_URL, the internal /api path, and the matching HTTP API key. |
| /publish returns 504 | Centrifugo did not answer within the realtime-server timeout; check container health and network connectivity. |
| JWT connection succeeds but subscription returns permission denied | Authentication worked; channel authorization does not allow that client/channel combination. |
| WebSocket closes with 3502 stale | The connection was opened but the Centrifugo connect command was not sent quickly enough. Send the command at the > prompt immediately. |
| Public hostname has TLS/DNS errors | Check DNS, Azure port 80/443 rules, Caddy, and the realtime.chrbuilds.dev → centrifugo:8000 route. |
| JWT validation fails | Confirm the realtime server's JWT secret exactly matches client.token.hmac_secret_key; do not confuse it with the HTTP API key. |
| Centrifugo API authentication fails | Confirm the realtime server's API key exactly matches http_api.key; do not use the JWT secret in its place. |

---

# 18. Future Application Integration

When building a new app, use the existing system in this order.

## Backend checklist

1. Attach the app's backend container to the external app_network.
2. Call http://realtime-server:3000, not the public Centrifugo URL, for server-side token/publish operations.
3. Authenticate the app user using the app's own auth system.
4. Request a realtime JWT for the authenticated user.
5. Publish only after the app's database operation succeeds.
6. Use an application-prefixed channel.
7. Validate that the app owns the channel it is publishing to.
8. Add app-to-realtime authentication before treating the integration as production-ready.

## Frontend checklist

1. Get the token through the app's authenticated backend route.
2. Connect to wss://realtime.chrbuilds.dev/connection/websocket.
3. Subscribe only to channels the user is allowed to use.
4. Handle publication data using a stable type field.
5. Handle disconnects, token refresh, and reconnects.
6. Refetch authoritative data after reconnect if an event may have been missed.
7. Never include Centrifugo server credentials in browser code.

## Example App 1 integration

Backend event:

~~~json
{
  "channel": "app1:user:123",
  "data": {
    "type": "task_assigned",
    "taskId": 456
  }
}
~~~

Frontend behavior:

~~~text
Receive event
  ├─ type = task_assigned → update task UI
  ├─ type = message_received → show message
  └─ type = appointment_updated → refresh appointment
~~~

The realtime system does not need to know what a task, message, or appointment is. App 1 owns those meanings.

## Reuse across multiple apps

~~~text
App 1 ─┐
App 2 ─┤
App 3 ─┼── HTTP → realtime-server → HTTP API → Centrifugo → WebSocket clients
App 4 ─┘
~~~

Use one shared service while the VM capacity and operational requirements are appropriate. If the system later needs durable history, multiple realtime replicas, or higher scale, revisit the engine/storage architecture rather than assuming the current memory engine is durable.

---

# 19. Quick Command Cheat Sheet

~~~bash
# Centrifugo
cd ~/realtime/centrifugo
docker compose ps
docker compose up -d
docker logs centrifugo --tail 50
docker compose pull
docker compose up -d

# Realtime server
cd ~/realtime/server
docker compose ps
docker compose build --pull
docker compose up -d
docker logs realtime-server --tail 50

# Network
docker network inspect app_network

# Health
docker exec realtime-server wget -qO- \
  http://127.0.0.1:3000/health

# Server → Centrifugo
docker exec realtime-server wget -qO- \
  http://centrifugo:8000/

# Public route
curl -I https://realtime.chrbuilds.dev

# Safe environment view
cd ~/realtime/server
grep -E '^(PORT|CENTRIFUGO_URL)=' .env
~~~

---

# 20. Important Safety Rules

- Never commit .env, config.json secrets, JWTs, API keys, admin credentials, or private connection strings.
- Never paste a real JWT or secret into documentation, GitHub, screenshots, or chat.
- Keep CENTRIFUGO_JWT_SECRET matched with client.token.hmac_secret_key.
- Keep CENTRIFUGO_API_KEY matched with http_api.key.
- Keep CENTRIFUGO_URL as the private Docker URL http://centrifugo:8000.
- Keep Centrifugo port 8000 private and expose it publicly only through Caddy.
- Keep realtime-server port 3000 private to app_network.
- Use realtime-server:3000 for internal app-backend calls.
- Use the public wss://realtime.chrbuilds.dev/connection/websocket only for client WebSocket connections.
- Do not treat channel names as authorization.
- Do not let a browser choose an arbitrary user ID for token generation.
- Do not allow an app to publish outside its authorized application/channel scope.
- Do not use realtime history as a replacement for the application database.
- Do not treat the current memory engine as durable storage.
- Back up important application data separately.
- Before production, add and test authentication for app backend → realtime-server requests.
