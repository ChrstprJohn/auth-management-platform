# Start n8n (Background / Detached):
cd ~/n8n && docker compose up -d

# Stop & remove containers (Data stays safe):
cd ~/n8n && docker compose down

# Pause n8n temporarily:
cd ~/n8n && docker compose stop

# Resume paused n8n:
cd ~/n8n && docker compose start

# Check running status:
cd ~/n8n && docker compose ps

# View live logs:
cd ~/n8n && docker compose logs -f

# Update and re-download latest n8n version:
cd ~/n8n && docker compose pull && docker compose up -d