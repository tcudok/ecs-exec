import { ecsExec } from '../../src/exec';

(async () => {
  const taskName = 'hello-world';
  const region = process.env.AWS_REGION;
  const subnetId = process.env.TEST_SUBNET_ID;
  const securityGroupId = process.env.TEST_SECURITY_GROUP_ID;

  if (!region || !subnetId || !securityGroupId) {
    throw new Error('Missing env vars, source the .env file.');
  }

  const { taskId, createLogReadStream } = await ecsExec({
    taskName,
    args: [],
    region,
    subnetId,
    securityGroupId,
  });

  console.log(`Waiting for task ${taskId} to start runnning...`);

  const logStream = createLogReadStream();

  for await (const event of logStream) {
    console.log(`${event.timestamp} ${event.message}`);
  }

  console.log('Done!');
})();
