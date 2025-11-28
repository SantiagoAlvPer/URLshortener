resource "aws_dynamodb_table" "short_links" {
  name         = var.table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  tags = {
    Module = "shortener"
  }
}

resource "aws_iam_role" "lambda_role" {
  name               = "shorten_lambda_role"
  assume_role_policy = data.aws_iam_policy_document.assume_lambda.json
}

resource "aws_iam_role_policy_attachment" "basic_exec" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_policy" "dynamodb_policy" {
  name        = "shorten_dynamodb_policy"
  description = "Permisos para acceder a la tabla short_links"
  policy      = data.aws_iam_policy_document.dynamodb_access.json
}

resource "aws_iam_role_policy_attachment" "dynamodb_attach" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.dynamodb_policy.arn
}

resource "aws_lambda_function" "shorten" {
  function_name    = "shorten-url"
  role             = aws_iam_role.lambda_role.arn
  handler          = "heandlers/URLshortener.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.lambda_function.output_path
  memory_size      = 128
  timeout          = 10
  source_code_hash = data.archive_file.lambda_function.output_base64sha256
  environment {
    variables = {
      TABLE_NAME = var.table_name
      BASE_URL   = var.base_url
    }
  }
  depends_on = [aws_iam_role_policy_attachment.basic_exec, aws_iam_role_policy_attachment.dynamodb_attach]
}

resource "aws_api_gateway_rest_api" "shortener_api" {
  name        = "ShortenerAPI"
  description = "API for URL shortening service"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

resource "aws_api_gateway_resource" "shorten_resource" {
  rest_api_id = aws_api_gateway_rest_api.shortener_api.id
  parent_id   = aws_api_gateway_rest_api.shortener_api.root_resource_id
  path_part   = "shorten"

}

resource "aws_api_gateway_method" "shorten_post" {
  rest_api_id   = aws_api_gateway_rest_api.shortener_api.id
  resource_id   = aws_api_gateway_resource.shorten_resource.id
  http_method   = "POST"
  authorization = "NONE"
}

# CORS OPTIONS method
resource "aws_api_gateway_method" "shorten_options" {
  rest_api_id   = aws_api_gateway_rest_api.shortener_api.id
  resource_id   = aws_api_gateway_resource.shorten_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "shorten_options_integration" {
  rest_api_id = aws_api_gateway_rest_api.shortener_api.id
  resource_id = aws_api_gateway_resource.shorten_resource.id
  http_method = aws_api_gateway_method.shorten_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "shorten_options_200" {
  rest_api_id = aws_api_gateway_rest_api.shortener_api.id
  resource_id = aws_api_gateway_resource.shorten_resource.id
  http_method = aws_api_gateway_method.shorten_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }

  response_models = {
    "application/json" = "Empty"
  }
}

resource "aws_api_gateway_integration_response" "shorten_options_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.shortener_api.id
  resource_id = aws_api_gateway_resource.shorten_resource.id
  http_method = aws_api_gateway_method.shorten_options.http_method
  status_code = aws_api_gateway_method_response.shorten_options_200.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,PUT,DELETE,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.shorten_options_integration]
}

resource "aws_api_gateway_integration" "shorten_integration" {
  rest_api_id             = aws_api_gateway_rest_api.shortener_api.id
  resource_id             = aws_api_gateway_resource.shorten_resource.id
  http_method             = aws_api_gateway_method.shorten_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.shorten.invoke_arn
}

resource "aws_api_gateway_method_response" "response_200" {
  rest_api_id = aws_api_gateway_rest_api.shortener_api.id
  resource_id = aws_api_gateway_resource.shorten_resource.id
  http_method = aws_api_gateway_method.shorten_post.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
  }
}

resource "aws_api_gateway_integration_response" "response_200" {
  rest_api_id = aws_api_gateway_rest_api.shortener_api.id
  resource_id = aws_api_gateway_resource.shorten_resource.id
  http_method = aws_api_gateway_method.shorten_post.http_method
  status_code = aws_api_gateway_method_response.response_200.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
    "method.response.header.Access-Control-Allow-Methods" = "'GET,POST,PUT,DELETE,OPTIONS'"
  }

  depends_on = [
    aws_api_gateway_integration.shorten_integration
  ]
}

resource "aws_lambda_permission" "shorten_lambda_permission" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.shorten.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.shortener_api.execution_arn}/*/*"

}


resource "aws_api_gateway_deployment" "shortener_deployment" {
  rest_api_id = aws_api_gateway_rest_api.shortener_api.id
  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.shorten_resource.id,
      aws_api_gateway_method.shorten_post.id,
      aws_api_gateway_method.shorten_options.id,
      aws_api_gateway_integration.shorten_integration.id,
      aws_api_gateway_integration.shorten_options_integration.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_integration.shorten_integration,
    aws_api_gateway_integration.shorten_options_integration,
    aws_api_gateway_integration_response.response_200,
    aws_api_gateway_integration_response.shorten_options_integration_response
  ]
}

resource "aws_api_gateway_stage" "prod_stage" {
  stage_name    = "prod"
  rest_api_id   = aws_api_gateway_rest_api.shortener_api.id
  deployment_id = aws_api_gateway_deployment.shortener_deployment.id

  xray_tracing_enabled = false

  tags = {
    Environment = "Production"
    Tier        = "Free"
  }
}

resource "aws_cloudwatch_log_group" "api_gw_logs" {
  name              = "/aws/apigateway/${aws_api_gateway_rest_api.shortener_api.name}"
  retention_in_days = 3
  tags = {
    Environment = "Production"
  }
}

resource "aws_api_gateway_method_settings" "all" {
  rest_api_id = aws_api_gateway_rest_api.shortener_api.id
  stage_name  = aws_api_gateway_stage.prod_stage.stage_name
  method_path = "*/*"

  settings {
    metrics_enabled        = true
    logging_level          = "OFF"
    data_trace_enabled     = false
    throttling_burst_limit = 5000
    throttling_rate_limit  = 10000
  }
}