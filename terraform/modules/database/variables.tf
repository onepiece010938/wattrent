variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "location" {
  description = "Firestore location (immutable once created)"
  type        = string
}

variable "labels" {
  description = "Labels (the Firestore database resource does NOT support labels; this field is reserved for forward compatibility)"
  type        = map(string)
  default     = {}
}
