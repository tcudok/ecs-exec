resource "aws_ecs_task_definition" "default" {
  family = "hello-world"

  execution_role_arn = aws_iam_role.execution.arn
  task_role_arn = aws_iam_role.task.arn

  # https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#container_definitions
  container_definitions = <<EOF
  [
    {
      "name": "hello-world",
      "image": "${local.docker_image}",
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-region": "${data.aws_region.current.name}",
          "awslogs-group": "hello-world",
          "awslogs-stream-prefix": "hello-world"
        }
      }
    }
  ]
  EOF

  cpu = 256
  memory = 512

  requires_compatibilities = ["FARGATE"]
  network_mode = "awsvpc"
}

resource "aws_cloudwatch_log_group" "default" {
  name              = "hello-world"
  retention_in_days = 1
}