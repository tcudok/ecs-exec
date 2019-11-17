import { ecsExec, EcsExecResult, LogMessage } from '../../src/exec';
import { PassThrough, Readable } from 'stream';
import chalk from 'chalk';
import Randoma from 'randoma';

const random = new Randoma({ seed: 1 });

(async () => {
  const taskName = 'hello-world';
  const region = process.env.AWS_REGION;
  const subnetId = process.env.TEST_SUBNET_ID;
  const securityGroupId = process.env.TEST_SECURITY_GROUP_ID;

  if (!region || !subnetId || !securityGroupId) {
    throw new Error('Missing env vars, source the .env file.');
  }

  const batches = [1, 2, 3, 4];

  const tasks = await Promise.all(
    batches.map(() =>
      ecsExec({
        taskName,
        args: [],
        launchType: 'FARGATE',
        region,
        subnetId,
        securityGroupId,
        assignPublicIp: true,
        logs: {
          logGroupName: taskName,
          logStreamPrefix: taskName,
        },
      }),
    ),
  );

  const logStream = interleave(tasks.map(createLogReadStream));
  const dateFormat = new Intl.DateTimeFormat('default', {
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });

  for await (const event of logStream) {
    const prefix = chalk.hex(event.color)(`[${event.taskId}]`);
    const date = dateFormat.format(new Date(event.timestamp));

    console.log(`${prefix} ${date}: ${event.message}`);
  }

  console.log('All done!');
})();

async function* createLogReadStream(
  task: EcsExecResult,
): AsyncIterable<
  LogMessage & Pick<EcsExecResult, 'taskId'> & { color: string }
> {
  const taskInfo = {
    taskId: task.taskId.substr(0, 7),
    color: random.color(0.5).hex(),
  };

  yield {
    ...taskInfo,
    timestamp: Date.now(),
    message: `Starting ECS task... Open ${task.taskUrl} for full details.`,
  };

  for await (const event of task.createLogReadStream()) {
    yield { ...taskInfo, ...event };
  }

  yield {
    ...taskInfo,
    timestamp: Date.now(),
    message: 'Stopped',
  };
}

function interleave<T>(iterators: AsyncIterable<T>[]): AsyncIterable<T> {
  const output = new PassThrough({ objectMode: true });
  let streams = iterators.map(i => Readable.from(i));

  for (const stream of streams) {
    stream.once('end', () => ended(stream));
    stream.once('error', err => output.emit('error', err));
    stream.pipe(output, { end: false });
  }

  function ended(stream: Readable) {
    streams = streams.filter(s => s !== stream);

    if (streams.length === 0 && output.readable) {
      output.end();
    }
  }

  return output;
}
