output "api_invoke_url" {
  value = aws_api_gateway_stage.prod_stage.invoke_url
}

output "lambda_arn" {
  value = aws_lambda_function.shorten.arn
}

output "dynamodb_table_name" {
  value = aws_dynamodb_table.short_links.name
}
