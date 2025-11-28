import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { putShortLink, TABLE_NAME } from "../services/dynamoDB";
import { generateShortId } from "../services/urlCompressor";

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export const handler = async (event: any): Promise<APIGatewayProxyResult> => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token",
    "Access-Control-Max-Age": "86400"
  };

  const method = event.requestContext?.http?.method || event.httpMethod;
  
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
  
  const id = generateShortId(6);
  const parsedUrl = new URL(originalUrl);
  const shortUrl = `${parsedUrl.protocol}//${parsedUrl.host}/${id}`;
  const timestamp = new Date().toISOString();

  try {
    const item = {
      id,
      link_og: originalUrl,
      link_short: shortUrl,
      visits: [] as string[],
      timestamp
    };

    await putShortLink(item);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        id,
        original_url: originalUrl,
        short_url: shortUrl,
        created_at: timestamp
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
