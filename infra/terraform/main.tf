terraform {
  required_version = ">= 1.5"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.75"
    }
  }

  # Uncomment to use DigitalOcean Spaces for remote state:
  # backend "s3" {
  #   endpoints    = { s3 = "https://nyc3.digitaloceanspaces.com" }
  #   bucket       = "blankcode-terraform-state"
  #   key          = "terraform.tfstate"
  #   region       = "us-east-1"
  #   skip_credentials_validation = true
  #   skip_requesting_account_id  = true
  #   skip_metadata_api_check     = true
  #   skip_s3_checksum            = true
  # }
}

provider "digitalocean" {
  token = var.do_token
}
