
data "aws_iam_policy_document" "assume_lambda" {
	statement {
		actions = ["sts:AssumeRole"]
		principals {
			type        = "Service"
			identifiers = ["lambda.amazonaws.com"]
		}
	}
}

data "aws_iam_policy_document" "dynamodb_access" {
	statement {
		effect = "Allow"
		actions = [
			"dynamodb:PutItem",
			"dynamodb:GetItem"
		]
		resources = [aws_dynamodb_table.short_links.arn]
	}
}

data "archive_file" "lambda_function" {
	type        = "zip"
	source_dir  = "../app/dist"
	output_path = "lambda_function.zip"
}



