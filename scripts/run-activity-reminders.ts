import {
  sendActivityReminders,
} from "../lib/activity-reminders";

async function main() {
  const result =
    await sendActivityReminders();

  console.log(
    "Activity reminder result:",
    result,
  );
}

main().catch(
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);
