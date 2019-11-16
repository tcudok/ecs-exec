import * as AWS from 'aws-sdk';
import debug from './debug';
import { createLogEventReadableStream } from './logs';

export type EcsExecOptions = {
  cluster?: string;
  taskName: string;
  args?: string[];
  region: string;
  subnetId: string;
  securityGroupId: string;
};

export type EcsExecResult = {
  taskId: string;
  taskUrl: string;
  createLogReadStream: () => AsyncGenerator<LogMessage, void, unknown>;
};

export type LogMessage = {
  timestamp: number;
  message: string;
};

export async function ecsExec({
  cluster,
  taskName,
  args,
  region,
  subnetId,
  securityGroupId,
}: EcsExecOptions): Promise<EcsExecResult> {
  const ecs = new AWS.ECS({ region });

  const params: AWS.ECS.RunTaskRequest = {
    cluster: cluster,
    taskDefinition: taskName,
    launchType: 'FARGATE',
    networkConfiguration: {
      awsvpcConfiguration: {
        assignPublicIp: 'ENABLED',
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
      await ecs
        .waitFor('tasksRunning', {
          tasks: [taskId],
        })
        .promise();

      const logStream = createLogEventReadableStream({
        region,
        logGroupName: taskName,
        logStreamName: `${taskName}/${taskName}/${taskId}`,
      });

      ecs
        .waitFor('tasksStopped', {
          tasks: [taskId],
        })
        .promise()
        .then(() => {
          logStream.destroy();
        });

      for await (const event of logStream) {
        yield { timestamp: event.timestamp, message: event.message };
      }
    },
  };
}
