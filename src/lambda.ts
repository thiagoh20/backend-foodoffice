import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import serverlessExpress from '@vendia/serverless-express';
import app from '../api/index.js';

// Convertir Express app a handler Lambda
// @ts-ignore - serverless-express puede tener problemas de tipos con ESM
const serverlessApp = serverlessExpress({ app });

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  // Asegurar que el contexto no expire antes de tiempo
  context.callbackWaitsForEmptyEventLoop = false;
  
  // @ts-ignore
  return serverlessApp(event, context);
};
