import type { Context, SessionFlavor } from "grammy";
import type { SessionData } from "./session";

export type MyContext = Context & SessionFlavor<SessionData>;
