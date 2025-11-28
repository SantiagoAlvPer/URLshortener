import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { putShortLink, TABLE_NAME } from "../services/dynamoDB";
import { generateShortId, analyzeUrlCompression, createCompressedUrl } from "../services/urlCompressor";

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export const handler = async (event: any): Promise<APIGatewayProxyResult> => {
  console.log("Event received:", JSON.stringify(event, null, 2));
  
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token",
    "Access-Control-Max-Age": "86400"
  };

  // API Gateway HTTP API v2 uses requestContext.http.method
  const method = event.requestContext?.http?.method || event.httpMethod;
  console.log("Method detected:", method);
  
  if (method === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (method !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  if (!TABLE_NAME) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "TABLE_NAME not configured" })
    };
  }

  let payload: any;
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid JSON body" })
    };
  }

  const originalUrl = payload.url || payload.link || payload.link_og;
  if (!originalUrl || typeof originalUrl !== "string" || !isValidUrl(originalUrl)) {
    return {
      statusCode: 422,
      headers,
      body: JSON.stringify({ error: "Invalid or missing URL" })
    };
  }

  const compression = analyzeUrlCompression(originalUrl);
  
  const id = generateShortId(6);
  const baseUrl = process.env.BASE_URL || "https://example.short";
  const shortUrl = `${baseUrl.replace(/\/$/, "")}/${id}`;
  const timestamp = new Date().toISOString();

  console.log("URL Compression Analysis:", {
    original: originalUrl,
    original_length: originalUrl.length,
    short_url: shortUrl,
    short_url_length: shortUrl.length,
    savings_bytes: originalUrl.length - shortUrl.length,
    short_id_length: id.length,
    reduction_percentage: Math.round((1 - shortUrl.length / originalUrl.length) * 100)
  });

  try {
    const item = {
      id,
      link_og: originalUrl,
      link_short: shortUrl,
      visits: 0,
      timestamp
    };

    console.log("Attempting to save to DynamoDB:", {
      tableName: TABLE_NAME,
      item
    });

    await putShortLink(item);
    
    console.log("Successfully saved to DynamoDB:", id);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        id,
        original_url: originalUrl,
        short_url: shortUrl,
        created_at: timestamp,
        compression: {
          original_length: originalUrl.length,
          short_id_length: id.length,
          total_short_url_length: shortUrl.length,
          reduction_percentage: Math.round((1 - shortUrl.length / originalUrl.length) * 100)
        }
      })
    };
  } catch (error: any) {
    if (error?.name === "ConditionalCheckFailedException") {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({ error: "ID collision, please retry" })
      };
    }

    console.error("Error creating short URL:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error" })
    };
  }
};
