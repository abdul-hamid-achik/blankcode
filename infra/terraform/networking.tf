resource "digitalocean_vpc" "blankcode" {
  name     = "blankcode-vpc"
  region   = var.region
  ip_range = "10.10.10.0/24"
}

resource "digitalocean_firewall" "blankcode" {
  name        = "blankcode-firewall"
  droplet_ids = [digitalocean_droplet.api.id]

  # SSH
  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # HTTP (Let's Encrypt ACME challenge via Caddy)
  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # HTTPS (API traffic)
  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }

  # Docker Swarm management (only needed for multi-node later)
  # inbound_rule {
  #   protocol         = "tcp"
  #   port_range       = "2377"
  #   source_addresses = ["10.10.10.0/24"]
  # }

  # All outbound TCP
  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  # All outbound UDP
  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }

  # ICMP (ping)
  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}
