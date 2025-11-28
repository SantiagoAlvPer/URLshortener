variable "aws_region" {
  description = "The AWS region to deploy resources in"
  type        = string
  default     = "us-east-2"

}

variable "table_name" {
  description = "The name of the DynamoDB table"
  type        = string
  default     = "short_links"
}


variable "base_url" {
  description = "The base URL for shortened links"
  type        = string
  default     = "https://example.short"
}