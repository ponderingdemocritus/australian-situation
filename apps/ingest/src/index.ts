import { syncHousingSeries } from "./jobs/sync-housing-series";

async function main() {
  const result = await syncHousingSeries();
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
