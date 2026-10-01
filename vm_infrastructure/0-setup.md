# Get Your Public IP Address
Public IP address (e.g., 20.x.x.x).

# Connect to Your VM via SSH
cd Downloads or where the n8n-vm_key.pem(passkey)

# Connect to Azure VM
ssh -i n8n-vm_key.pem azureuser@<YOUR_PUBLIC_IP>

ssh -i n8n-vm_key.pem azureuser@13.70.4.46

ssh -i n8n-vm_key.pem azureuser@74.176.65.214

# Add 2 GB Swap Memory
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# ##################################################################

# Update system packages and install Docker + Docker Compose plugin
sudo apt update && sudo apt install -y docker.io docker-compose-v2

# Grant current user permission to run Docker without sudo
sudo usermod -aG docker $USER
newgrp docker

# Create and navigate to the n8n directory
mkdir -p ~/n8n && cd ~/n8n

# Generate the docker-compose.yml file
cat << 'EOF' > docker-compose.yml
services:
  n8n:
    image: docker.n8n.io/n8nio/n8n:latest
    container_name: n8n
    restart: always
    ports:
      - "80:5678"
    environment:
      - N8N_PORT=5678
      - N8N_HOST=13.70.4.46
      - N8N_PROTOCOL=http
      - WEBHOOK_URL=http://13.70.4.46/
      - N8N_WEBHOOK_URL=http://13.70.4.46/
      - EXECUTIONS_DATA_PRUNE=true
      - EXECUTIONS_DATA_MAX_AGE=168
    volumes:
      - n8n_data:/home/node/.n8n

volumes:
  n8n_data:
EOF

# Launch n8n Container
cd ~/n8n && docker compose up -d

# Verify Installation
docker compose ps