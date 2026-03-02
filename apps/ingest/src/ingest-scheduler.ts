import { createIngestQueue, resolveQueueRuntimeConfig } from "./queue/runtime";
import { upsertRecurringJobSchedulers } from "./queue/scheduler";

async function main() {
  const queueConfig = resolveQueueRuntimeConfig();
  const queue = createIngestQueue(queueConfig);

  try {
    const upserted = await upsertRecurringJobSchedulers(queue);
    console.log(
      JSON.stringify(
        {
          status: "ok",
          queueName: queueConfig.queueName,
          schedulerCount: upserted.length,
          schedulers: upserted
        },
        null,
        2
      )
    );
  } finally {
    await queue.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
