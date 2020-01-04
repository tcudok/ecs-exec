import * as AWS from 'aws-sdk';
import debug from './debug';
import { createLogEventReadStream } from './logs';

export type EcsExecOptions = {
  cluster?: string;
  taskName: string;
  args?: string[];
  launchType: 'FARGATE' | 'EC2';
  region: string;
  subnetId: string;
  securityGroupId: string;
  assignPublicIp?: boolean;
  logs?: {
    logGroupName: string;
    logStreamPrefix: string;
  };
};

export type EcsExecResult = {
  taskId: string;
  taskUrl: string;
  createLogReadStream: () => AsyncIterable<LogMessage>;
};

export type LogMessage = {
  timestamp: number;
  message: string;
};

export async function ecsExec({
  cluster = 'default',
  taskName,
  args,
  launchType,
  region,
  subnetId,
  securityGroupId,
  assignPublicIp,
  logs,
}: EcsExecOptions): Promise<EcsExecResult> {
  const ecs = new AWS.ECS({ region });

  const params: AWS.ECS.RunTaskRequest = {
    cluster: cluster,
    taskDefinition: taskName,
    launchType: launchType,
    networkConfiguration: {
      awsvpcConfiguration: {
        assignPublicIp: assignPublicIp ? 'ENABLED' : 'DISABLED',
        subnets: [subnetId],
        securityGroups: [securityGroupId],
      },
    },
    overrides: {
      containerOverrides: [
        {
          name: taskName,
          command: args,
        },
      ],
    },
  };

  debug('Executing ECS runTask with params %O', params);

  const result = await ecs.runTask(params).promise();

  debug('ECS runTask executed, result %O', result);

  if (!result.tasks || result.tasks.length === 0) {
    throw new Error(
      `Failed to launch task ${taskName}. ${JSON.stringify(result.failures)}`,
    );
  }

  const task = result.tasks[0];

  if (!task.taskArn) {
    throw new Error(
      `Invalid response from AWS API: ${JSON.stringify(result, null, 2)}`,
    );
  }

  const taskArnMatch = task.taskArn.match(
    /^arn:aws:ecs:[^:]+:[^:]+:task\/(.+)$/,
  );

  if (!taskArnMatch) {
    throw new Error(`Unsupported taskArn ${task.taskArn}`);
  }

  const taskId = taskArnMatch[1];

  return {
    taskId,
    taskUrl: `https://${region}.console.aws.amazon.com/ecs/home?region=${region}#/clusters/${cluster}/tasks/${taskId}/details`,
    createLogReadStream: async function*() {
      if (!logs) {
        return;
      }

      await ecs
        .waitFor('tasksRunning', {
          cluster,
          tasks: [taskId],
        })
        .promise();

      const logStream = createLogEventReadStream({
        region,
        logGroupName: logs.logGroupName,
        logStreamName: `${logs.logStreamPrefix}/${taskName}/${taskId}`,
      });

      ecs
        .waitFor('tasksStopped', {
          cluster,
          tasks: [taskId],
        })
        .promise()
        .then(() => {
          logStream.close();
        });

      for await (const event of logStream) {
        yield { timestamp: event.timestamp, message: event.message };
      }
    },
  };
}
