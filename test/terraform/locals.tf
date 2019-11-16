locals {
  docker_image = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com/hello-world:${var.docker_image_tag}"
}