import { createApp } from "./app.js";
import { db } from "./db.js";

const port = Number(process.env.PORT) || 8080;
createApp(db).listen(port, () => {
  console.log(`elsewhere api listening on :${port}`);
});
