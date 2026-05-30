import "dotenv/config";
import { createServer } from "node:http";
import app from "./app.js";
import { connectDB } from "./server.js";
import { initSocketServer } from "./socket/index.js";
import colors from "colors";

const port = process.env.PORT || 3001;

async function start() {
  await connectDB();
  const httpServer = createServer(app);
  initSocketServer(httpServer);
  httpServer.listen(port, () => {
    console.log(colors.cyan.bold(`[Socket Server] Escuchando en puerto ${port}`));
    console.log(colors.cyan(`[Socket Server] API interna disponible en /internal`));
  });
}

start();
