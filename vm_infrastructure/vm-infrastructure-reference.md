# Azure VM Infrastructure Reference

> Concise reference based on the current setup described in the Backend Setup Help conversation. No secrets or passwords are included.

## VM

- **Platform:** Azure VM
- **OS:** Ubuntu 22.04 LTS
- **SSH user:** `azureuser`
- **Current/example public IP:** `13.70.4.46`

## Architecture

Internet traffic enters through **Caddy**, which provides HTTPS/TLS and routes requests to private Docker services on the shared external network `app_network`.

```text
Internet
  └─ chrbuilds.dev subdomains
       └─ Caddy (:80, :443)
            ├─ n8n.chrbuilds.dev → n8n:5678
            └─ api.chrbuilds.dev → hello_api:3000

Docker network: app_network
  ├─ caddy
  ├─ n8n
  ├─ hello_api
  └─ postgres
```

## Containers and ports

| Container | Internal port | Host exposure | Purpose |
|---|---:|---|---|
| `caddy` | 80, 443 | Public `80`, `443` | Reverse proxy and HTTPS/TLS |
| `n8n` | 5678 | Via Caddy | n8n service |
| `hello_api` | 3000 | `127.0.0.1:3000:3000` | API service; local host binding |
| `postgres` | 5432 | `127.0.0.1:5432:5432` | PostgreSQL; local host binding |

PostgreSQL is reached by other containers through the Docker service/container name: `postgres:5432`. Services on `app_network` use container names for private communication rather than public IP addresses.

## VM directory structure

```text
~/apps/hello_api/
~/infrastructure/caddy/Caddyfile
~/n8n/docker-compose.yml
~/postgres/docker-compose.yml
```

The services are managed as containers. The external/shared `app_network` lets separately managed Compose projects attach to the same private network.

## Caddy routes

```text
n8n.chrbuilds.dev → n8n:5678
api.chrbuilds.dev → hello_api:3000
```

Caddy is the only service intended to receive normal public web traffic.

## DNS

```text
n8n.chrbuilds.dev  → 13.70.4.46
api.chrbuilds.dev  → 13.70.4.46
```

If the VM public IP changes, update the DNS records and verify Caddy certificate/routing behavior.

## Deployment workflow

```text
Local development → GitHub → pull/update on VM → rebuild/restart containers
```

Keep application source and infrastructure configuration versioned where appropriate, while storing secrets outside committed files.

## Important commands

```bash
ssh azureuser@YOUR_VM_IP
docker ps
docker network ls
docker network inspect app_network
docker compose up -d
docker logs <container_name>
docker compose logs -f
```

Run Compose commands from the relevant directory, such as `~/n8n` or `~/postgres`.

## Crucial rules

- Do not commit passwords, API keys, tokens, or private credentials to GitHub.
- Keep PostgreSQL bound to `127.0.0.1`; do not expose port `5432` publicly unless deliberately secured.
- Keep `hello_api` bound to `127.0.0.1` when public access should go through Caddy.
- Expose only the required public web ports: `80` and `443`.
- Use Docker service/container names for internal traffic (`postgres`, `n8n`, `hello_api`).
- Ensure all required services join the external `app_network`.
- Restrict Azure firewall/security-group rules to required ports and trusted administrative access.
- Back up PostgreSQL data and protect n8n data/credentials.
- Treat `13.70.4.46` as current/example infrastructure data; verify it before DNS or firewall changes.
