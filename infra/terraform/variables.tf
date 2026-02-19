variable "do_token" {
  description = "DigitalOcean API token"
  type        = string
  sensitive   = true
}

variable "ssh_public_key_path" {
  description = "Path to the SSH public key to upload"
  type        = string
  default     = "~/.ssh/id_ed25519.pub"
}

variable "region" {
  description = "DigitalOcean region"
  type        = string
  default     = "nyc3"
}

variable "domain" {
  description = "Root domain name"
  type        = string
  default     = "blankcode.dev"
}

variable "droplet_size" {
  description = "Droplet size slug (2 vCPU, 4GB RAM = $24/mo)"
  type        = string
  default     = "s-2vcpu-4gb"
}
