# ----------------------------------------------------------------------
# project_services: enable GCP APIs
# ----------------------------------------------------------------------

resource "google_project_service" "this" {
  for_each = toset(var.apis)

  project = var.project_id
  service = each.value

  # Do not disable APIs when the module is removed (avoids accidentally turning off services others depend on)
  disable_on_destroy         = false
  disable_dependent_services = false
}
