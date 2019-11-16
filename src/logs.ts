import { Readable } from 'stream';
import * as AWS from 'aws-sdk';

export type CreateLogEventReadStreamOptions = {
  logGroupName: string;
  logStreamName: string;
  region?: string;
  pollingInterval?: number;
};

export type LogEventReadStream = Readable & { close: () => void };

export function createLogEventReadStream({
  logGroupName,
  logStreamName,
  region,
  pollingInterval = 1000,
}: CreateLogEventReadStreamOptions): LogEventReadStream {
  const readable = new Readable({ objectMode: true }) as LogEventReadStream;
  const cwLogs = new AWS.CloudWatchLogs({ region });
  let isReading = false;
  let timeout: NodeJS.Timeout | undefined;

  readable._read = () => {
    if (isReading) {
      return;
    }

    isReading = true;

    readLogs();
  };

  readable.close = () => {
    readable.push(null);
    isReading = false;

    if (timeout) {
      clearTimeout(timeout);
    }
  };

  async function readLogs(nextToken?: string) {
    if (!isReading) {
      return;
    }

    try {
      const result = await cwLogs
        .getLogEvents({
          logGroupName,
          logStreamName,
          nextToken,
        })
        .promise();

      const events = result.events ?? [];

      for (const event of events) {
        readable.push(event);
      }

      // ignore nextForwardToken if the first read returns no logs,
      // otherwise no logs will be ever returned
      const nextForwardToken =
        !nextToken && events.length === 0 ? undefined : result.nextForwardToken;

      timeout = setTimeout(() => {
        readLogs(nextForwardToken);
      }, pollingInterval);
    } catch (err) {
      readable.emit('error', err);
    }
  }

  return readable;
}
