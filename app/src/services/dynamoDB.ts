import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const region = process.env.AWS_REGION || "us-east-2";
export const TABLE_NAME = process.env.TABLE_NAME || "";

const baseClient = new DynamoDBClient({ region });
export const ddbDoc = DynamoDBDocumentClient.from(baseClient);

export interface ShortLinkItem {
	id: string;
	link_og: string;
	link_short: string;
	visits: number;
	timestamp: string;
}

export async function putShortLink(item: ShortLinkItem) {
	if (!TABLE_NAME) throw new Error("TABLE_NAME no definido");
	await ddbDoc.send(new PutCommand({
		TableName: TABLE_NAME,
		Item: item,
		ConditionExpression: "attribute_not_exists(id)"
	}));
	return item;
}

export async function getShortLink(id: string) {
	if (!TABLE_NAME) throw new Error("TABLE_NAME no definido");
	const res = await ddbDoc.send(new GetCommand({
		TableName: TABLE_NAME,
		Key: { id }
	}));
	return res.Item as ShortLinkItem | undefined;
}
