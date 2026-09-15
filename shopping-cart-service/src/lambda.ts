import serverlessHttp from "serverless-http";
import { createApp } from "./app";

// Same Express app runs locally (src/server.ts) and in Lambda (this file).
// serverless-http adapts API Gateway's event/response shape to a regular
// Node request/response so Express doesn't need to know it's in Lambda.
// The CloudFormation template wires ANY /{proxy+} and ANY / to this
// function, so Express - not API Gateway - owns all route matching.
export const handler = serverlessHttp(createApp());
