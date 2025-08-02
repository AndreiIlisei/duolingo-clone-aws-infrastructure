import * as cdk from "aws-cdk-lib";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as ecrAssets from "aws-cdk-lib/aws-ecr-assets";
import { Construct } from "constructs";
import * as path from "path";

export class DuolingoInfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const dockerImageAsset = new ecrAssets.DockerImageAsset(
      this,
      "DuolingoDockerImage",
      {
        directory: path.join(__dirname, "../../", "duolingo"),
      }
    );

    const vpc = ec2.Vpc.fromLookup(this, "ExistingDefaultVPC", {
      isDefault: true,
    });

    // 🏗️ ECS Cluster
    const cluster = new ecs.Cluster(this, "DuolingoCluster", {
      clusterName: "duolingo-cdk-cluster",
      vpc,
    });

    // 📋 Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      "DuolingoTaskDef",
      {
        memoryLimitMiB: 1024,
        cpu: 512,
      }
    );

    // 🐳 Container Definition
    taskDefinition.addContainer("DuolingoContainer", {
      image: ecs.ContainerImage.fromDockerImageAsset(dockerImageAsset),
      portMappings: [{ containerPort: 3000 }],
      environment: {
        NODE_ENV: "production",
        DATABASE_URL: process.env.DATABASE_URL || "",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
          process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "",
        CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || "",
        STRIPE_API_KEY: process.env.STRIPE_API_KEY || "",
        STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "",
        CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
        CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",
        CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "",
      },
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: "duolingo-cdk",
      }),
    });

    // ⚖️ Application Load Balancer
    const alb = new elbv2.ApplicationLoadBalancer(this, "DuolingoALB", {
      vpc,
      internetFacing: true,
    });

    // 🎯 Target Group
    const targetGroup = new elbv2.ApplicationTargetGroup(
      this,
      "DuolingoTargets",
      {
        vpc,
        port: 3000,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targetType: elbv2.TargetType.IP,
        healthCheck: {
          path: "/",
          healthyHttpCodes: "200",
        },
      }
    );

    // 👂 Listener
    alb.addListener("DuolingoListener", {
      port: 80,
      defaultTargetGroups: [targetGroup],
    });

    // 🚀 ECS Service
    const service = new ecs.FargateService(this, "DuolingoService", {
      cluster,
      taskDefinition,
      desiredCount: 1,
      assignPublicIp: true,
    });

    // 🔗 Connect Service to Load Balancer
    service.attachToApplicationTargetGroup(targetGroup);

    new cdk.CfnOutput(this, "ClusterName", {
      value: cluster.clusterName,
    });

    new cdk.CfnOutput(this, "LoadBalancerURL", {
      value: `http://${alb.loadBalancerDnsName}`,
      description: "URL to access your app",
    });
  }
}
