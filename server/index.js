import express from "express";
import logger from "morgan";

import { Server } from "socket.io";
import { createServer } from "node:http";
import { createClient } from "@supabase/supabase-js";

import dotenv from "dotenv";

dotenv.config();

const port = 3000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  connectionStateRecovery: {},
});

// supabase.from("messages");

console.log(supabase);

io.on("connection", async (socket) => {
  console.log("a user connected");

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });

  socket.on("chat message", async (msg) => {
    let result;
    let lastInsertedId;
    let username = socket.handshake.auth.username ?? "Anonymous";
    console.log({ username });

    try {
      result = await supabase
        .from("messages")
        .insert([{ content: msg, username: username }]);

      lastInsertedId = await supabase
        .from("messages")
        .select("id")
        .order("id", { ascending: false })
        .limit(1);
    } catch (error) {
      console.log(error);
      return;
    }
    console.log(lastInsertedId);
    io.emit(
      "chat message",
      msg,
      lastInsertedId.data[0].id.toString(),
      username
    );
  });

  if (!socket.recovered) {
    try {
      console.log("Serveroffset : ", socket.handshake.auth.serverOffset);
      const result = await supabase
        .from("messages")
        .select("id, content, username")
        .gt("id", socket.handshake.auth.serverOffset || 0)
        .order("id", { ascending: false });

      result.data.forEach((element) => {
        io.emit(
          "chat message",
          element.content,
          element.id.toString(),
          element.username
        );
      });
    } catch (error) {
      console.log(error);
      return;
    }
  }
});

app.use(logger("dev"));

app.get("/", (req, res) => {
  res.sendFile(process.cwd() + "/client/index.html");
});

server.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
