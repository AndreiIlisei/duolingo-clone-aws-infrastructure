#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { DuolingoInfrastructureStack } from "../lib/duolingo-infrastructure-stack";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config();

const requiredEnvVars = [
  "DATABASE_URL",
  "STRIPE_API_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "CLOUDINARY_CLOUD_NAME",
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
];

console.log("🔍 Running pre-deploy safety checks...");

// ✅ 1. Check environment variables
let envErrors = false;
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    console.log(`⚠️  Missing env variable: ${key}`);
    envErrors = true;
  }
}

// ✅ 2. Check if Dockerfile exists
const dockerDir = path.join(__dirname, "../../", "duolingo");
const dockerfilePath = path.join(dockerDir, "Dockerfile");

if (!fs.existsSync(dockerfilePath)) {
  console.log(`❌ Dockerfile not found in: ${dockerDir}`);
  envErrors = true;
} else {
  console.log("✅ Dockerfile found.");
}

// ✅ 3. Check if directory builds (test build only, optional)
// You could spawn a `docker build` test here if needed

(async () => {
  const app = new cdk.App();

  // ✅ Final check
  if (envErrors) {
    console.log(
      "🛑 Safety check failed. Please fix the above issues before deploying."
    );
    process.exit(1); // Prevents CDK deploy from continuing
  } else {
    console.log("✅ All pre-deploy checks passed. Proceeding with deployment.");
    new DuolingoInfrastructureStack(app, "DuolingoInfrastructureStack", {
      env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: "eu-west-1",
      },
    });
  }
})();
