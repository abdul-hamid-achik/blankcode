resource "digitalocean_ssh_key" "deploy" {
  name       = "blankcode-deploy"
  public_key = file(var.ssh_public_key_path)
}

resource "digitalocean_droplet" "api" {
  name       = "blankcode-api"
  image      = "ubuntu-24-04-x64"
  size       = var.droplet_size
  region     = var.region
  vpc_uuid   = digitalocean_vpc.blankcode.id
  ssh_keys   = [digitalocean_ssh_key.deploy.fingerprint]
  monitoring = true
  backups    = true
  tags       = ["blankcode", "api", "production"]

  # Cloud-init: install Docker, create deploy user, init Swarm
  user_data = <<-EOF
    #!/bin/bash
    set -euo pipefail

    # Update system
    apt-get update && apt-get upgrade -y

    # Install Docker
    curl -fsSL https://get.docker.com | sh

    # Create deploy user with Docker access
    useradd -m -s /bin/bash -G docker deploy
    mkdir -p /home/deploy/.ssh
    cp /root/.ssh/authorized_keys /home/deploy/.ssh/
    chown -R deploy:deploy /home/deploy/.ssh
    chmod 700 /home/deploy/.ssh
    chmod 600 /home/deploy/.ssh/authorized_keys

    # Allow deploy user to use sudo without password (for initial setup only)
    echo "deploy ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/deploy

    # Initialize Docker Swarm
    docker swarm init --advertise-addr $(hostname -I | awk '{print $1}')

    # Create app directory
    mkdir -p /opt/blankcode
    chown deploy:deploy /opt/blankcode

    # Create workspace directory for code execution sandboxes
    mkdir -p /tmp/blankcode-workspaces
    chown deploy:deploy /tmp/blankcode-workspaces

    # Pre-pull Caddy image
    docker pull caddy:2-alpine
  EOF
}
