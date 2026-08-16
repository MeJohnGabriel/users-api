import express from "express";
import { readFile, writeFile } from "node:fs/promises";

const app = express();
const PORT = Number(process.env.PORT ?? 3000);
const DATA_FILE = new URL("./data/users.json", import.meta.url);

type User = {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
};

app.use(express.json());

async function readUsers(): Promise<User[]> {
  const raw = await readFile(DATA_FILE, "utf-8");
  return JSON.parse(raw);
}

async function writeUsers(users: User[]): Promise<void> {
  await writeFile(DATA_FILE, JSON.stringify(users, null, 2));
}

app.get("/users", async (_req, res) => {
  const users = await readUsers();
  res.json(users);
});

app.get("/users/:id", async (req, res) => {
  const users = await readUsers();
  const user = users.find((u) => u.id === Number(req.params.id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
});

app.post("/users", async (req, res) => {
  const { name, email, phone, address } = req.body ?? {};
  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof phone !== "string" ||
    typeof address !== "string"
  ) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const users = await readUsers();
  const id = Math.max(...users.map((u) => u.id), 0) + 1;
  const user: User = { id, name, email, phone, address };
  users.push(user);
  await writeUsers(users);
  res.status(201).json(user);
});

app.use(
  (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  },
);

app.listen(PORT, () => {
  console.log(`Users API listening on http://localhost:${PORT}`);
});
