#!/bin/bash
set -euo pipefail

DOCKER_IMAGE_TAG=1

cd terraform
terraform init
terraform apply -var docker_image_tag=$DOCKER_IMAGE_TAG -auto-approve -input=false

docker_image=$(terraform output docker_image)

cd ../docker
docker build -t $docker_image .
docker push $docker_image