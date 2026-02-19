output "droplet_ip" {
  description = "Public IP of the API droplet"
  value       = digitalocean_droplet.api.ipv4_address
}

output "droplet_private_ip" {
  description = "Private IP of the API droplet (within VPC)"
  value       = digitalocean_droplet.api.ipv4_address_private
}

output "ssh_command" {
  description = "SSH command to connect to the droplet"
  value       = "ssh deploy@${digitalocean_droplet.api.ipv4_address}"
}

output "dns_instructions" {
  description = "DNS records to configure in Cloudflare"
  value = <<-EOT
    Configure these DNS records in Cloudflare:

    Type  | Name  | Value                                    | Proxy
    ------|-------|------------------------------------------|----------
    CNAME | @     | cname.vercel-dns.com                     | DNS only
    CNAME | www   | cname.vercel-dns.com                     | DNS only
    A     | api   | ${digitalocean_droplet.api.ipv4_address}  | DNS only
  EOT
}
