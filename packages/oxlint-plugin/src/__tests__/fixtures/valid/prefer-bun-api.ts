import { Database } from "bun:sqlite";

const requestId = Bun.randomUUIDv7();
const matcher = new Bun.Glob("*.ts");

void Database;
void requestId;
void matcher;
