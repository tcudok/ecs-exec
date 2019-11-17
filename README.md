# ecs-exec

## Installation

```
yarn add @tcudok/ecs-exec
```

## Usage

```typescript
import { ecsExec } from '@tcudok/ecs-exec';

async function test() {
  const { taskId, taskUrl, createLogReadStream } = await ecsExec({
    taskName: 'test',
    args: [],
    launchType: 'FARGATE',
    region: 'us-east-1',
    subnetId: 'subnet-xxx',
    securityGroupId: 'sg-xxx',
    assignPublicIp: true,
    logs: {
      logGroupName: 'test',
      logStreamPrefix: 'test',
    },
  });
  
  console.log(`Starting ECS task ${taskId}. Details: ${taskUrl}`);
  
  for await (const { message } of createLogReadStream()) {
    console.log(message);
  }
}
```

Check [test/src/test.ts](test/src/test.ts) for a more detailed example.
